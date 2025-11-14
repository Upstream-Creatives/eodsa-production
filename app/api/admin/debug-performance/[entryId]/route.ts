import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';
import { db } from '@/lib/database';

/**
 * GET /api/admin/debug-performance/[entryId]
 * Debug endpoint to check if a performance exists for an entry and verify its data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  try {
    const { entryId } = await params;
    const sqlClient = getSql();

    // Get the entry
    const entry = await sqlClient`
      SELECT 
        ee.*,
        e.id as event_id_from_event,
        e.name as event_name
      FROM event_entries ee
      LEFT JOIN events e ON ee.event_id = e.id
      WHERE ee.id = ${entryId}
    ` as any[];

    if (entry.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Entry not found',
        entryId
      });
    }

    const entryData = entry[0];

    // Check if performance exists
    const performance = await sqlClient`
      SELECT 
        p.*,
        e.id as event_id_from_event,
        e.name as event_name
      FROM performances p
      LEFT JOIN events e ON p.event_id = e.id
      WHERE p.event_entry_id = ${entryId}
    ` as any[];

    // Get all performances for this event to see what's being returned
    const allEventPerformances = await sqlClient`
      SELECT 
        p.id,
        p.title,
        p.event_entry_id,
        p.event_id,
        p.status
      FROM performances p
      WHERE p.event_id = ${entryData.event_id}
      ORDER BY p.id DESC
      LIMIT 20
    ` as any[];

    return NextResponse.json({
      success: true,
      entry: {
        id: entryData.id,
        itemName: entryData.item_name,
        eventId: entryData.event_id,
        eventName: entryData.event_name,
        approved: entryData.approved,
        paymentStatus: entryData.payment_status
      },
      performance: performance.length > 0 ? {
        id: performance[0].id,
        title: performance[0].title,
        eventId: performance[0].event_id,
        eventIdFromEvent: performance[0].event_id_from_event,
        eventName: performance[0].event_name,
        eventEntryId: performance[0].event_entry_id,
        status: performance[0].status,
        entryType: performance[0].entry_type
      } : null,
      allEventPerformances: allEventPerformances.map(p => ({
        id: p.id,
        title: p.title,
        eventEntryId: p.event_entry_id,
        eventId: p.event_id
      })),
      diagnostic: {
        entryHasPerformance: performance.length > 0,
        performanceEventIdMatches: performance.length > 0 
          ? performance[0].event_id === entryData.event_id 
          : null,
        totalPerformancesForEvent: allEventPerformances.length
      }
    });

  } catch (error: any) {
    console.error('Error debugging performance:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to debug performance',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

