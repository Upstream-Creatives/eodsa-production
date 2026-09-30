/**
 * Create / reconcile event entries from PayFast batch pending_entries_data.
 * Idempotent: skips items already saved for the same payment (by cart line id, or name + style + choreographer + type + dancers).
 */

import { getSql } from './database';
import { autoMarkRegistrationForParticipants } from './registration-fee-tracker';
import { markBatchRegistrationCharged, prepareEntriesForBatchCreation } from './payment-validation';
import {
  findExistingEntryIdForLine,
  batchEntryFingerprint,
  parseParticipantIds,
} from './entry-dedup';
import { ITEM_STYLES, type Performance } from './types';

export interface PendingBatchEntry {
  eventId: string;
  contestantId: string;
  eodsaId: string;
  participantIds: string[];
  calculatedFee: number;
  itemName: string;
  choreographer: string;
  mastery: string;
  itemStyle: string;
  estimatedDuration: number;
  entryType?: 'live' | 'virtual';
  musicFileUrl?: string | null;
  musicFileName?: string | null;
  videoExternalUrl?: string | null;
  videoExternalType?: string | null;
  suitabilityStatement?: string | null;
  performanceType?: string;
  clientLineId?: string;
}

export interface BatchEntryCreationResult {
  created: Array<{ entryId: string; itemName: string; performanceType?: string; fee: number }>;
  skipped: Array<{ itemName: string; reason: string; existingEntryId?: string }>;
  errors: Array<{ itemName: string; index: number; error: string }>;
}

export { batchEntryFingerprint, parseParticipantIds } from './entry-dedup';

async function acquireReconcileLock(sql: ReturnType<typeof getSql>, paymentId: string): Promise<boolean> {
  try {
    await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS entries_reconcile_started_at TIMESTAMPTZ`;
  } catch {
    // ignore
  }
  const rows = await sql`
    UPDATE payments
    SET entries_reconcile_started_at = NOW()
    WHERE payment_id = ${paymentId}
      AND (
        entries_reconcile_started_at IS NULL
        OR entries_reconcile_started_at < NOW() - INTERVAL '3 minutes'
      )
    RETURNING payment_id
  ` as Array<{ payment_id: string }>;
  return rows.length > 0;
}

async function releaseReconcileLock(sql: ReturnType<typeof getSql>, paymentId: string): Promise<void> {
  try {
    await sql`
      UPDATE payments
      SET entries_reconcile_started_at = NULL
      WHERE payment_id = ${paymentId}
    `;
  } catch (err) {
    console.warn(`⚠️ Could not release reconcile lock for ${paymentId}:`, err);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadExistingFingerprintsForPayment(paymentId: string): Promise<Map<string, string>> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, item_name, participant_ids, item_style, choreographer, performance_type, entry_line_key
    FROM event_entries
    WHERE payment_id = ${paymentId}
  ` as Array<{
    id: string;
    item_name: string;
    participant_ids: unknown;
    item_style?: string | null;
    choreographer?: string | null;
    performance_type?: string | null;
    entry_line_key?: string | null;
  }>;

  const map = new Map<string, string>();
  for (const row of rows) {
    const ids = parseParticipantIds(row.participant_ids);
    map.set(
      batchEntryFingerprint(row.item_name, ids, {
        storedLineKey: row.entry_line_key,
        itemStyle: row.item_style,
        choreographer: row.choreographer,
        performanceType: row.performance_type,
      }),
      row.id
    );
  }
  return map;
}

async function performanceExistsForEntry(entryId: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    SELECT id FROM performances WHERE event_entry_id = ${entryId} LIMIT 1
  ` as Array<{ id: string }>;
  return rows.length > 0;
}

async function ensurePerformanceForEntry(
  eventEntry: { id: string },
  entry: PendingBatchEntry,
  unifiedDb: { getDancerById: (id: string) => Promise<{ name?: string } | null> },
  db: { createPerformance: (performance: Omit<Performance, 'id'>) => Promise<{ id: string }> }
): Promise<void> {
  if (await performanceExistsForEntry(eventEntry.id)) return;

  const participantNames: string[] = [];
  const ids = entry.participantIds || [];
  for (let i = 0; i < ids.length; i++) {
    try {
      const dancer = await unifiedDb.getDancerById(ids[i]);
      participantNames.push(dancer?.name || `Participant ${i + 1}`);
    } catch {
      participantNames.push(`Participant ${i + 1}`);
    }
  }

  const performanceContestantId =
    entry.participantIds?.length > 0 ? entry.participantIds[0] : entry.contestantId;

  await db.createPerformance({
    eventId: entry.eventId,
    eventEntryId: eventEntry.id,
    contestantId: performanceContestantId,
    title: entry.itemName,
    participantNames,
    duration: entry.estimatedDuration || 0,
    choreographer: entry.choreographer,
    mastery: entry.mastery,
    itemStyle: entry.itemStyle,
    status: 'scheduled',
    itemNumber: undefined,
    entryType: entry.entryType || 'live',
    videoExternalUrl: entry.videoExternalUrl || undefined,
    videoExternalType:
      entry.videoExternalType && ['youtube', 'vimeo', 'other'].includes(entry.videoExternalType)
        ? (entry.videoExternalType as 'youtube' | 'vimeo' | 'other')
        : undefined,
    musicFileUrl: entry.musicFileUrl || undefined,
    musicFileName: entry.musicFileName || undefined,
  });
}

/**
 * Create missing entries for a completed batch payment. Safe to call multiple times (webhook retries).
 */
export async function reconcileBatchEntriesFromPending(
  paymentId: string,
  entriesData: PendingBatchEntry[],
  source: 'webhook' | 'process_entries' | 'recovery_script' = 'webhook'
): Promise<BatchEntryCreationResult> {
  const result: BatchEntryCreationResult = { created: [], skipped: [], errors: [] };
  if (!paymentId || !Array.isArray(entriesData) || entriesData.length === 0) {
    return result;
  }

  const sql = getSql();
  const { db, unifiedDb } = await import('./database');

  let locked = false;
  for (let attempt = 0; attempt < 6; attempt++) {
    locked = await acquireReconcileLock(sql, paymentId);
    if (locked) break;
    console.log(`⏳ [${source}] Waiting for reconcile lock on ${paymentId} (attempt ${attempt + 1})`);
    await sleep(400);
  }

  try {
  const existingByFingerprint = await loadExistingFingerprintsForPayment(paymentId);

  const eventId = entriesData[0]?.eventId;
  let entriesToProcess = entriesData;
  let registrationCharges: Array<{ eodsaId: string; dancerId: string }> = [];

  if (eventId) {
    try {
      const prepared = await prepareEntriesForBatchCreation(entriesData, eventId);
      entriesToProcess = prepared.entries;
      registrationCharges = prepared.newlyCharged;
    } catch (prepError) {
      console.warn(`⚠️ [${source}] Could not enrich batch entries with registration fees:`, prepError);
    }
  }

  for (let i = 0; i < entriesToProcess.length; i++) {
    const entry = entriesToProcess[i];
    const participantIds = parseParticipantIds(entry.participantIds);
    const lineExtras = {
      clientLineId: entry.clientLineId,
      itemStyle: entry.itemStyle,
      choreographer: entry.choreographer,
      performanceType: entry.performanceType,
    };
    const fingerprint = batchEntryFingerprint(entry.itemName, participantIds, lineExtras);

    if (!entry.itemStyle || !ITEM_STYLES.includes(entry.itemStyle)) {
      result.errors.push({
        itemName: entry.itemName || `Entry ${i + 1}`,
        index: i,
        error: 'Item Style is required. Please select a valid style.',
      });
      continue;
    }

    let existingId = existingByFingerprint.get(fingerprint);

    // Also block duplicates from a second payment / retry (different payment_id)
    if (!existingId) {
      const globalExisting = await findExistingEntryIdForLine(
        entry.eventId,
        entry.itemName,
        participantIds,
        lineExtras
      );
      if (globalExisting) {
        existingId = globalExisting;
        existingByFingerprint.set(fingerprint, globalExisting);
      }
    }

    if (existingId) {
      result.skipped.push({
        itemName: entry.itemName,
        reason: 'already_exists',
        existingEntryId: existingId,
      });
      // Link orphaned duplicate row to this payment if it had no payment_id
      try {
        await sql`
          UPDATE event_entries
          SET payment_id = COALESCE(payment_id, ${paymentId})
          WHERE id = ${existingId}
        `;
      } catch (linkErr) {
        console.warn(`⚠️ [${source}] Could not link payment to existing entry ${existingId}:`, linkErr);
      }
      try {
        await ensurePerformanceForEntry({ id: existingId }, { ...entry, participantIds }, unifiedDb, db);
      } catch (perfErr) {
        console.warn(`⚠️ [${source}] Performance ensure failed for existing entry ${existingId}:`, perfErr);
      }
      continue;
    }

    try {
      const eventEntry = await db.createEventEntry({
        eventId: entry.eventId,
        contestantId: entry.contestantId,
        eodsaId: entry.eodsaId,
        participantIds,
        calculatedFee: entry.calculatedFee,
        paymentStatus: 'paid',
        paymentMethod: 'payfast',
        approved: true,
        qualifiedForNationals: true,
        itemNumber: undefined,
        itemName: entry.itemName,
        choreographer: entry.choreographer,
        mastery: entry.mastery,
        itemStyle: entry.itemStyle,
        estimatedDuration: entry.estimatedDuration,
        entryType: entry.entryType || 'live',
        musicFileUrl: entry.musicFileUrl || undefined,
        musicFileName: entry.musicFileName || undefined,
        videoFileUrl: undefined,
        videoFileName: undefined,
        videoExternalUrl: entry.videoExternalUrl || undefined,
        videoExternalType:
          entry.videoExternalType && ['youtube', 'vimeo', 'other'].includes(entry.videoExternalType)
            ? (entry.videoExternalType as 'youtube' | 'vimeo' | 'other')
            : undefined,
        suitabilityStatement: entry.suitabilityStatement || undefined,
        performanceType: entry.performanceType,
        entryLineKey: fingerprint,
      } as Parameters<typeof db.createEventEntry>[0]);

      await sql`
        UPDATE event_entries
        SET payment_id = ${paymentId},
            performance_type = COALESCE(performance_type, ${entry.performanceType || null})
        WHERE id = ${eventEntry.id}
      `;

      existingByFingerprint.set(fingerprint, eventEntry.id);

      await ensurePerformanceForEntry(eventEntry, { ...entry, participantIds }, unifiedDb, db);

      if (participantIds.length > 0 && entry.mastery) {
        try {
          await autoMarkRegistrationForParticipants(participantIds, entry.mastery);
        } catch (regErr) {
          console.warn(`⚠️ [${source}] Registration mark failed for ${eventEntry.id}:`, regErr);
        }
      }

      result.created.push({
        entryId: eventEntry.id,
        itemName: entry.itemName,
        performanceType: entry.performanceType,
        fee: entry.calculatedFee,
      });
    } catch (error: unknown) {
      const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: string }).code) : '';
      if (code === '23505') {
        result.skipped.push({
          itemName: entry.itemName,
          reason: 'unique_conflict',
        });
        continue;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ [${source}] Entry ${i + 1} (${entry.itemName}):`, error);
      result.errors.push({ itemName: entry.itemName, index: i, error: message });
    }
  }

  if (eventId && registrationCharges.length > 0) {
    try {
      await markBatchRegistrationCharged(eventId, registrationCharges);
    } catch (regFlagError) {
      console.warn(`⚠️ [${source}] Failed to mark registration charged flags:`, regFlagError);
    }
  }

  return result;
  } finally {
    if (locked) {
      await releaseReconcileLock(sql, paymentId);
    }
  }
}

export function parsePendingEntriesData(raw: unknown): PendingBatchEntry[] {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!Array.isArray(data)) return [];
  return data as PendingBatchEntry[];
}
