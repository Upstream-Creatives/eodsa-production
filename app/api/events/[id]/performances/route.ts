import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

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

    // Include virtualItemNumber by joining entries (if present)
    try {
      const entries = await db.getAllEventEntries();
      const withVirtual = performances.map((p: any) => {
        const entry = entries.find(e => e.id === p.eventEntryId);
        return entry && entry.virtualItemNumber ? { ...p, virtualItemNumber: entry.virtualItemNumber } : p;
      });
      
      // Debug: Log entry types to help diagnose filtering issues
      console.log('Performance entry types:', withVirtual.map(p => ({
        id: p.id,
        title: p.title,
        entryType: p.entryType,
        participantCount: p.participantNames?.length || 0
      })));
      
      return NextResponse.json({ success: true, performances: withVirtual });
    } catch {
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