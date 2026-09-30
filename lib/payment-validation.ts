/**
 * Payment Validation Helpers
 *
 * Uses flat pricing + every-Nth-solo discount with per-event registration charging.
 */

import { createTransactionRecord } from './transaction-records';
import { ensureAuditionSchema, getSql } from './database';
import {
  calculateEventPricing,
  collectRegistrationKeys,
  getFixedEntryPrice,
  getParticipantCount,
  getPricingDancerKey,
  resolveEventRegistrationFee,
} from './event-pricing';
import { applyComputedBatchFees } from './batch-registration-fees';
import { markRegistrationCharged } from './incremental-fee-calculator';

export { enrichBatchEntriesWithRegistrationFees } from './batch-registration-fees';

export interface BatchPricingResult {
  totalComputedFee: number;
  registrationTotal: number;
  registrationFeePerDancer: number;
  alreadyRegistered: Set<string>;
  pricing: ReturnType<typeof calculateEventPricing>;
  validations: EntryFeeValidation[];
}

function collectParticipantKeys(entry: any): string[] {
  return collectRegistrationKeys(entry);
}

export async function markBatchRegistrationCharged(
  eventId: string,
  charges: Array<{ eodsaId: string; dancerId: string }>
): Promise<void> {
  for (const charge of charges) {
    if (!charge.eodsaId) continue;
    await markRegistrationCharged(eventId, charge.dancerId, charge.eodsaId);
  }
}

export async function computeBatchEntryPricing(
  entries: any[],
  eventId: string
): Promise<BatchPricingResult> {
  const sql = getSql();
  await ensureAuditionSchema(sql);
  const normalizedEntries = Array.isArray(entries) ? entries : [];

  const eventRows = await sql`
    SELECT solo_price, duet_price, group_price, discount_enabled, discount_min_entries, discount_amount,
           registration_fee, registration_fee_per_dancer, event_type, audition_payment_type, audition_flat_fee
    FROM events
    WHERE id = ${eventId}
  ` as any[];
  if (!eventRows.length) throw new Error(`Event ${eventId} not found`);

  const event = eventRows[0];
  if (event.event_type === 'AUDITION_EVENT') {
    const flat = event.audition_payment_type === 'paid' ? Number(event.audition_flat_fee) || 0 : 0;
    const validations: EntryFeeValidation[] = normalizedEntries.map((entry, i) => ({
      entryIndex: i,
      entry,
      computedFee: flat,
      clientSentFee: entry.calculatedFee || 0,
      registrationFee: 0,
      entryFee: flat,
      registrationCharged: false,
      registrationWasAlreadyCharged: false,
      entryCount: getParticipantCount(entry),
      breakdown: flat > 0 ? `Audition flat fee ${flat}` : 'Free audition',
      warnings: [],
      isValid: true,
      mismatchDetected: false,
    }));
    return {
      totalComputedFee: flat * normalizedEntries.length,
      registrationTotal: 0,
      registrationFeePerDancer: 0,
      alreadyRegistered: new Set<string>(),
      pricing: {
        itemizedEntries: normalizedEntries.map((entry, index) => ({
          index,
          type: entry.performanceType || 'Audition',
          price: flat,
        })),
        subtotal: flat * normalizedEntries.length,
        discount: 0,
        registrationTotal: 0,
        total: flat * normalizedEntries.length,
        entryDiscounts: normalizedEntries.map(() => 0),
      },
      validations,
    };
  }
  const registrationFeePerDancer = resolveEventRegistrationFee(event);

  const allParticipantIds = new Set<string>();
  normalizedEntries.forEach((entry) => {
    collectParticipantKeys(entry).forEach((id) => allParticipantIds.add(id));
  });

  const alreadyRegistered = new Set<string>();
  for (const pid of allParticipantIds) {
    const existing = await sql`
      SELECT id FROM event_entries
      WHERE event_id = ${eventId}
      AND (
        eodsa_id = ${pid}
        OR participant_ids::text LIKE ${`%${pid}%`}
      )
      LIMIT 1
    ` as any[];
    if (existing.length > 0) alreadyRegistered.add(pid);

    const charged = await sql`
      SELECT id FROM registration_charged_flags
      WHERE event_id = ${eventId} AND eodsa_id = ${pid}
      LIMIT 1
    ` as any[];
    if (charged.length > 0) alreadyRegistered.add(pid);
  }

  const existingSoloCountByDancer: Record<string, number> = {};
  for (let i = 0; i < normalizedEntries.length; i++) {
    const key = getPricingDancerKey(normalizedEntries[i], i);
    if (key.startsWith('__unassigned_')) continue;
    if (existingSoloCountByDancer[key] !== undefined) continue;
    const likePattern = `%${key}%`;
    const [cntRow] = await sql`
      SELECT COUNT(*)::int AS c
      FROM event_entries
      WHERE event_id = ${eventId}
      AND LOWER(TRIM(COALESCE(performance_type, ''))) = 'solo'
      AND (
        eodsa_id = ${key}
        OR participant_ids::text LIKE ${likePattern}
      )
    ` as any[];
    existingSoloCountByDancer[key] = cntRow?.c ?? 0;
  }

  const pricing = calculateEventPricing(normalizedEntries, {
    soloPrice: event.solo_price,
    duetPrice: event.duet_price,
    groupPrice: event.group_price,
    discountEnabled: event.discount_enabled,
    discountMinEntries: event.discount_min_entries,
    discountAmount: event.discount_amount,
    registrationFee: registrationFeePerDancer,
  }, Array.from(alreadyRegistered), existingSoloCountByDancer);

  const entryDiscounts = pricing.entryDiscounts?.length === normalizedEntries.length
    ? pricing.entryDiscounts
    : normalizedEntries.map(() => 0);

  const validations: EntryFeeValidation[] = [];
  for (let i = 0; i < normalizedEntries.length; i++) {
    const entry = normalizedEntries[i];
    const participantCount = getParticipantCount(entry);
    const basePrice = getFixedEntryPrice(entry.performanceType, {
      soloPrice: event.solo_price,
      duetPrice: event.duet_price,
      groupPrice: event.group_price,
    }, participantCount);
    const lineDiscount = entryDiscounts[i] || 0;
    const computedFee = Math.max(0, basePrice - lineDiscount);
    const typeLabel = (entry.performanceType || '').toLowerCase();
    const breakdown =
      typeLabel === 'solo'
        ? `Solo ${basePrice}`
        : `${entry.performanceType} (${participantCount} × rate = ${basePrice})`;

    validations.push({
      entryIndex: i,
      entry,
      computedFee,
      clientSentFee: entry.calculatedFee || 0,
      registrationFee: 0,
      entryFee: basePrice,
      registrationCharged: false,
      registrationWasAlreadyCharged: false,
      entryCount: participantCount,
      breakdown,
      warnings: [],
      isValid: true,
      mismatchDetected: false,
    });
  }

  return {
    totalComputedFee: pricing.total,
    registrationTotal: pricing.registrationTotal,
    registrationFeePerDancer,
    alreadyRegistered,
    pricing,
    validations,
  };
}

export async function prepareEntriesForBatchCreation(
  entries: any[],
  eventId: string
): Promise<{ entries: any[]; newlyCharged: Array<{ eodsaId: string; dancerId: string }> }> {
  const batchPricing = await computeBatchEntryPricing(entries, eventId);
  const performanceFees = batchPricing.validations.map((v) => v.computedFee);
  // Backend performance fees + registration once per new dancer.
  // Do not add registration on top of client-sent totals (EFT was doing that).
  return applyComputedBatchFees(
    entries,
    performanceFees,
    batchPricing.registrationFeePerDancer,
    batchPricing.alreadyRegistered
  );
}

export interface EntryFeeValidation {
  entryIndex: number;
  entry: any;
  computedFee: number;
  clientSentFee: number;
  registrationFee: number;
  entryFee: number;
  registrationCharged: boolean;
  registrationWasAlreadyCharged: boolean;
  entryCount: number;
  breakdown: string;
  warnings: string[];
  isValid: boolean;
  mismatchDetected: boolean;
  mismatchReason?: string;
}

export interface BatchValidationResult {
  totalComputedFee: number;
  totalClientSentFee: number;
  validations: EntryFeeValidation[];
  allValid: boolean;
  mismatchDetected: boolean;
  mismatchReason?: string;
}

/**
 * Validate fees for a batch of entries
 */
export async function validateBatchEntryFees(
  entries: any[],
  eventId: string,
  clientSentTotal: number
): Promise<BatchValidationResult> {
  const batchPricing = await computeBatchEntryPricing(entries, eventId);
  const totalComputedFee = batchPricing.totalComputedFee;
  const validations = batchPricing.validations;

  const totalMismatchDetected = Math.abs(clientSentTotal - totalComputedFee) > 0.01;
  const totalMismatchReason = totalMismatchDetected
    ? `Total mismatch: Client sent ${clientSentTotal}, computed ${totalComputedFee}, difference: ${Math.abs(clientSentTotal - totalComputedFee)}`
    : undefined;

  console.log(`📊 Batch validation summary:`, {
    entriesCount: entries.length,
    clientSentTotal,
    totalComputedFee,
    registrationTotal: batchPricing.registrationTotal,
    mismatchDetected: totalMismatchDetected,
    mismatchReason: totalMismatchReason,
    validations: validations.map(v => ({
      index: v.entryIndex,
      itemName: v.entry.itemName,
      clientSent: v.clientSentFee,
      computed: v.computedFee,
      mismatch: v.mismatchDetected
    }))
  });

  return {
    totalComputedFee,
    totalClientSentFee: clientSentTotal,
    validations,
    allValid: !totalMismatchDetected,
    mismatchDetected: totalMismatchDetected,
    mismatchReason: totalMismatchReason
  };
}

/**
 * Create transaction records for batch entries and mark registration as charged
 */
export async function createBatchTransactionRecords(
  entries: any[],
  eventId: string,
  paymentId: string,
  paymentMethod: 'payfast' | 'eft',
  clientSentTotal: number,
  computedTotal: number
): Promise<string[]> {
  const transactionIds: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    try {
      const transactionId = await createTransactionRecord({
        entryId: undefined,
        eventId,
        dancerId: entry.contestantId || entry.eodsaId,
        eodsaId: entry.eodsaId,
        expectedAmount: entry.calculatedFee || 0,
        amountPaid: 0,
        registrationPaidFlag: false,
        registrationChargedFlag: false,
        status: 'pending',
        paymentMethod,
        paymentReference: paymentId,
        clientSentTotal: entry.calculatedFee,
        computedTotal: entry.calculatedFee || 0,
        mismatchDetected: false
      });

      transactionIds.push(transactionId);
    } catch (error: any) {
      console.error(`Error creating transaction record for entry ${i + 1}:`, error);
    }
  }

  return transactionIds;
}

/**
 * Update transaction record with entry ID after entry is created
 */
export async function updateTransactionWithEntryId(
  transactionId: string,
  entryId: string
): Promise<void> {
  const sql = getSql();
  
  await sql`
    UPDATE transaction_records
    SET entry_id = ${entryId}
    WHERE id = ${transactionId}
  `;
}
