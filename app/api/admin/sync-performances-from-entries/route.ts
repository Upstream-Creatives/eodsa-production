import { NextRequest, NextResponse } from 'next/server';
import { db, unifiedDb } from '@/lib/database';

// POST /api/admin/sync-performances-from-entries
// Backfills missing Performance rows from approved live Event Entries for a given eventId
export async function POST(request: NextRequest) {
  try {
    const { eventId } = await request.json();
    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    }

    const entries = await db.getAllEventEntries();
    const performances = await db.getAllPerformances();

    const approvedLive = entries.filter(e => e.eventId === eventId && e.approved && (e.entryType || 'live') === 'live');
    const existingByEntry = new Set(performances.filter(p => p.eventId === eventId).map(p => p.eventEntryId));

    let created = 0;
    for (const entry of approvedLive) {
      if (existingByEntry.has(entry.id)) continue;

      // Build participant names using unified dancer records when available
      const participantNames: string[] = [];
      try {
        for (let i = 0; i < entry.participantIds.length; i++) {
          const pid = entry.participantIds[i];
          try {
            const dancer = await unifiedDb.getDancerById(pid);
            if (dancer?.name) {
              participantNames.push(dancer.name);
              continue;
            }
          } catch {}
          participantNames.push(`Participant ${i + 1}`);
        }
      } catch {
        entry.participantIds.forEach((_, i) => participantNames.push(`Participant ${i + 1}`));
      }

      await db.createPerformance({
        eventId: entry.eventId,
        eventEntryId: entry.id,
        contestantId: entry.contestantId,
        title: entry.itemName,
        participantNames,
        duration: entry.estimatedDuration || 0,
        choreographer: entry.choreographer,
        mastery: entry.mastery,
        itemStyle: entry.itemStyle,
        status: 'scheduled',
        itemNumber: entry.itemNumber || null as any
      });
      created++;
    }

    return NextResponse.json({ success: true, created });
  } catch (error) {
    console.error('sync-performances-from-entries error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


