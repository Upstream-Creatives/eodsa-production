import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import {
  getAllContestantEntriesForDancer,
  isVirtualEntry,
  normalizeEntryEventId,
} from '@/lib/contestant-entries';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eodsaId = searchParams.get('eodsaId');
    
    if (!eodsaId) {
      return NextResponse.json(
        { success: false, error: 'EODSA ID is required' },
        { status: 400 }
      );
    }

    const contestantEntries = await getAllContestantEntriesForDancer(eodsaId);
    const eventsForFilter = await db.getAllEvents();
    const auditionEventIds = new Set(
      eventsForFilter.filter((event) => event.eventType === 'AUDITION_EVENT').map((event) => event.id)
    );
    const entriesNeedingVideo = contestantEntries.filter((entry) => {
      if (!isVirtualEntry(entry)) return false;
      const eventId = normalizeEntryEventId(entry);
      return !!eventId && !auditionEventIds.has(eventId);
    });
    
    const events = eventsForFilter;

    const entriesWithDetails = entriesNeedingVideo.map((entry) => {
      try {
        const eventId = normalizeEntryEventId(entry);
        const event = events.find((e) => e.id === eventId);
        
        return {
          ...entry,
          eventId,
          eventName: event?.name || 'Unknown Event',
          eventDate: event?.eventDate || null,
          venue: event?.venue || 'TBD',
        };
      } catch (error) {
        console.error('Error getting event details for entry:', entry.id, error);
        return {
          ...entry,
          eventId: normalizeEntryEventId(entry),
          eventName: 'Unknown Event',
          eventDate: null,
          venue: 'TBD',
        };
      }
    });
    
    return NextResponse.json({
      success: true,
      entries: entriesWithDetails,
      total: entriesWithDetails.length,
    });
    
  } catch (error: unknown) {
    console.error('Error fetching contestant video entries:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch entries' },
      { status: 500 }
    );
  }
}
