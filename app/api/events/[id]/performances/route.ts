import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { calculateAgeCategoryForEntry } from '@/lib/age-category-calculator';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const eventId = id;

    // First check if the event exists
    const event = await db.getEventById(eventId);
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Get all performances for this event
    const performances = await db.getPerformancesByEvent(eventId);

    // Debug: Log what item numbers we're getting
    console.log('Performances loaded for event', eventId, ':', performances.map(p => ({
      id: p.id,
      title: p.title,
      itemNumber: p.itemNumber
    })));

    // Get SQL client for age calculations
    const { getSql } = await import('@/lib/database');
    const sqlClient = getSql();

    // Include virtualItemNumber and calculate age categories
    try {
      const entries = await db.getAllEventEntries();

      const withVirtualAndAges = await Promise.all(
        performances.map(async (p: any) => {
          const entry = entries.find(e => e.id === p.eventEntryId);

          // Calculate age category dynamically using helper function
          const ageCategory = entry && entry.participantIds
            ? await calculateAgeCategoryForEntry(entry.participantIds, event.eventDate, sqlClient)
            : 'N/A';

          return {
            ...p,
            virtualItemNumber: entry && entry.virtualItemNumber ? entry.virtualItemNumber : undefined,
            ageCategory // Add calculated age category
          };
        })
      );

      // Debug: Log entry types to help diagnose filtering issues
      console.log('Performance entry types:', withVirtualAndAges.map(p => ({
        id: p.id,
        title: p.title,
        entryType: p.entryType,
        ageCategory: p.ageCategory,
        participantCount: p.participantNames?.length || 0
      })));

      return NextResponse.json({ success: true, performances: withVirtualAndAges });
    } catch (error) {
      console.error('Error processing performances:', error);
      return NextResponse.json({ success: true, performances });
    }
  } catch (error) {
    console.error('Error fetching event performances:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch event performances' },
      { status: 500 }
    );
  }
}
