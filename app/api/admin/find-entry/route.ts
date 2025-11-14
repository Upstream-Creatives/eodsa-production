import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';

/**
 * GET /api/admin/find-entry
 * Find entries by dancer name or studio name
 * Query params: dancerName, studioName, eventId (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dancerName = searchParams.get('dancerName');
    const studioName = searchParams.get('studioName');
    const eventId = searchParams.get('eventId');

    if (!dancerName && !studioName) {
      return NextResponse.json(
        { success: false, error: 'dancerName or studioName parameter is required' },
        { status: 400 }
      );
    }

    const sqlClient = getSql();

    // Build the query based on search parameters
    let results: any[] = [];

    if (dancerName) {
      // First find dancers matching the name
      const dancers = await sqlClient`
        SELECT id, eodsa_id, name FROM dancers 
        WHERE LOWER(name) LIKE LOWER(${'%' + dancerName + '%'})
        LIMIT 20
      ` as any[];

      if (dancers.length > 0) {
        const dancerIds = dancers.map(d => d.id);
        const eodsaIds = dancers.map(d => d.eodsa_id).filter(Boolean);

        // Find entries with these dancers as participants
        // Use a simpler approach: check each dancer ID
        let entries: any[] = [];
        
        for (const dancerId of dancerIds.slice(0, 10)) { // Limit to first 10 to avoid too many queries
          const foundEntries = await sqlClient`
            SELECT 
              ee.id as entry_id,
              ee.item_name,
              ee.event_id,
              ee.approved,
              ee.payment_status,
              ee.entry_type,
              ee.participant_ids,
              e.name as event_name,
              p.id as performance_id,
              p.event_id as performance_event_id
            FROM event_entries ee
            JOIN events e ON ee.event_id = e.id
            LEFT JOIN performances p ON p.event_entry_id = ee.id
            WHERE ee.participant_ids::text LIKE ${`%"${dancerId}"%`}
              ${eventId ? sqlClient`AND ee.event_id = ${eventId}` : sqlClient``}
            ORDER BY ee.submitted_at DESC
            LIMIT 50
          ` as any[];
          
          entries.push(...foundEntries);
        }
        
        // Also check by eodsa_id
        if (eodsaIds.length > 0) {
          const eodsaEntries = await sqlClient`
            SELECT 
              ee.id as entry_id,
              ee.item_name,
              ee.event_id,
              ee.approved,
              ee.payment_status,
              ee.entry_type,
              ee.participant_ids,
              e.name as event_name,
              p.id as performance_id,
              p.event_id as performance_event_id
            FROM event_entries ee
            JOIN events e ON ee.event_id = e.id
            LEFT JOIN performances p ON p.event_entry_id = ee.id
            WHERE ee.eodsa_id = ANY(${eodsaIds})
              ${eventId ? sqlClient`AND ee.event_id = ${eventId}` : sqlClient``}
            ORDER BY ee.submitted_at DESC
            LIMIT 50
          ` as any[];
          
          entries.push(...eodsaEntries);
        }
        
        // Remove duplicates
        const uniqueEntries = Array.from(new Map(entries.map(e => [e.entry_id, e])).values());
        entries = uniqueEntries.slice(0, 50);

        results = entries;
      }
    } else if (studioName) {
      // Find entries by studio name
      const studios = await sqlClient`
        SELECT id, name FROM studios 
        WHERE LOWER(name) LIKE LOWER(${'%' + studioName + '%'})
        LIMIT 10
      ` as any[];

      if (studios.length > 0) {
        const studioIds = studios.map(s => s.id);
        
        // Get dancers from these studios
        const studioDancers = await sqlClient`
          SELECT d.id, d.eodsa_id FROM dancers d
          JOIN studio_applications sa ON d.id = sa.dancer_id
          WHERE sa.studio_id = ANY(${studioIds})
          AND sa.status = 'accepted'
        ` as any[];

        if (studioDancers.length > 0) {
          const dancerIds = studioDancers.map(d => d.id);
          const eodsaIds = studioDancers.map(d => d.eodsa_id).filter(Boolean);

          const entries = await sqlClient`
            SELECT 
              ee.id as entry_id,
              ee.item_name,
              ee.event_id,
              ee.approved,
              ee.payment_status,
              ee.entry_type,
              ee.participant_ids,
              e.name as event_name,
              p.id as performance_id,
              p.event_id as performance_event_id
            FROM event_entries ee
            JOIN events e ON ee.event_id = e.id
            LEFT JOIN performances p ON p.event_entry_id = ee.id
            WHERE (
              ${eventId ? sqlClient`ee.event_id = ${eventId} AND` : sqlClient``}
              (
                ee.participant_ids::text LIKE ANY(${dancerIds.map(id => `%"${id}"%`)})
                OR ee.eodsa_id = ANY(${eodsaIds})
              )
            )
            ORDER BY ee.submitted_at DESC
            LIMIT 50
          ` as any[];

          results = entries;
        }
      }
    }

    const entries = await Promise.all(results.map(async (row) => {
      // Get participant names
      let participantNames: string[] = [];
      try {
        const participantIds = typeof row.participant_ids === 'string' 
          ? JSON.parse(row.participant_ids)
          : row.participant_ids || [];
        
        for (const pid of participantIds) {
          try {
            const dancerResult = await sqlClient`
              SELECT name FROM dancers WHERE id = ${pid} OR eodsa_id = ${pid} LIMIT 1
            ` as any[];
            
            if (dancerResult.length > 0) {
              participantNames.push(dancerResult[0].name);
            }
          } catch {}
        }
      } catch {}

      return {
        entryId: row.entry_id,
        itemName: row.item_name,
        eventId: row.event_id,
        eventName: row.event_name,
        approved: row.approved,
        paymentStatus: row.payment_status,
        entryType: row.entry_type,
        hasPerformance: !!row.performance_id,
        performanceId: row.performance_id,
        performanceEventId: row.performance_event_id,
        eventIdMatches: row.performance_event_id === row.event_id,
        participantNames
      };
    }));

    return NextResponse.json({
      success: true,
      entries,
      count: entries.length
    });

  } catch (error: any) {
    console.error('Error finding entry:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to find entry',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

