import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eodsaId: string }> }
) {
  try {
    const { eodsaId } = await params;
    const sql = getSql();

    // Get dancer
    const dancer = (await sql`
      SELECT id, eodsa_id, name FROM dancers WHERE eodsa_id = ${eodsaId} LIMIT 1
    `) as any[];

    if (dancer.length === 0) {
      return NextResponse.json({ error: 'Dancer not found' }, { status: 404 });
    }

    const dancerId = dancer[0].id;
    const dancerEodsaId = dancer[0].eodsa_id;

    // Check total entries
    const total = (await sql`SELECT COUNT(*) as count FROM event_entries`) as any[];
    const totalCount = total[0]?.count || 0;

    // Check entries by eodsa_id
    const byEodsaId = (await sql`
      SELECT COUNT(*) as count FROM event_entries WHERE eodsa_id = ${eodsaId}
    `) as any[];

    // Check entries by contestant_id
    const byContestantId = (await sql`
      SELECT COUNT(*) as count FROM event_entries 
      WHERE contestant_id = ${eodsaId} OR contestant_id = ${dancerId}
    `) as any[];

    // Check entries by participant_ids
    const byParticipantIds = (await sql`
      SELECT COUNT(*) as count FROM event_entries 
      WHERE participant_ids::text LIKE ${`%${eodsaId}%`} 
         OR participant_ids::text LIKE ${`%${dancerId}%`}
    `) as any[];

    // Get sample entries from database
    const samples = (await sql`
      SELECT id, eodsa_id, contestant_id, participant_ids, item_name 
      FROM event_entries 
      LIMIT 10
    `) as any[];

    // Try to find any entries matching our search
    const matchingEntries = (await sql`
      SELECT id, eodsa_id, contestant_id, participant_ids, item_name 
      FROM event_entries 
      WHERE eodsa_id = ${eodsaId}
         OR contestant_id = ${eodsaId}
         OR contestant_id = ${dancerId}
         OR participant_ids::text LIKE ${`%${eodsaId}%`}
         OR participant_ids::text LIKE ${`%${dancerId}%`}
      LIMIT 10
    `) as any[];

    return NextResponse.json({
      dancer: {
        id: dancerId,
        eodsaId: dancerEodsaId,
        name: dancer[0].name,
      },
      statistics: {
        totalEntriesInDatabase: totalCount,
        entriesByEodsaId: byEodsaId[0]?.count || 0,
        entriesByContestantId: byContestantId[0]?.count || 0,
        entriesByParticipantIds: byParticipantIds[0]?.count || 0,
        matchingEntriesFound: matchingEntries.length,
      },
      sampleEntries: samples.map(e => ({
        id: e.id,
        eodsa_id: e.eodsa_id,
        contestant_id: e.contestant_id,
        participant_ids: e.participant_ids,
        item_name: e.item_name,
      })),
      matchingEntries: matchingEntries.map(e => ({
        id: e.id,
        eodsa_id: e.eodsa_id,
        contestant_id: e.contestant_id,
        participant_ids: e.participant_ids,
        item_name: e.item_name,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

