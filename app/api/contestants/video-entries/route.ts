import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

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

    // Get all event entries for this contestant (owned OR participating in)
    // CRITICAL FIX: Query BOTH event_entries AND nationals_event_entries
    const regularEntries = await db.getAllEventEntries();
    const nationalsEntries = await db.getAllNationalsEventEntries();
    const allEntries = [...regularEntries, ...nationalsEntries];
    const contestantEntries = allEntries.filter(entry => {
      // Include if user owns the entry
      if (entry.eodsaId === eodsaId) return true;
      
      // Include if user is a participant in the group entry
      if (entry.participantIds && Array.isArray(entry.participantIds)) {
        return entry.participantIds.includes(eodsaId);
      }
      
      return false;
    });
    
    // Filter virtual entries (with or without video - allow updates)
    // Nationals entries are all virtual and don't have entryType field
    const entriesNeedingVideo = contestantEntries.filter(entry => {
      const isVirtual = (entry as any).entryType === 'virtual' || (entry as any).nationalsEventId; // nationals entries are virtual
      return isVirtual;
    });
    
    // Get additional info for each entry
    const entriesWithDetails = await Promise.all(
      entriesNeedingVideo.map(async (entry) => {
        try {
          // Get event details
          // Handle both eventId (regular entries) and nationalsEventId (nationals entries)
          const events = await db.getAllEvents();
          const eventId = (entry as any).eventId || (entry as any).nationalsEventId;
          const event = events.find(e => e.id === eventId);
          
          return {
            ...entry,
            eventName: event?.name || 'Unknown Event',
            eventDate: event?.eventDate || null,
            venue: event?.venue || 'TBD'
          };
        } catch (error) {
          console.error('Error getting event details for entry:', entry.id, error);
          return {
            ...entry,
            eventName: 'Unknown Event',
            eventDate: null,
            venue: 'TBD'
          };
        }
      })
    );
    
    return NextResponse.json({
      success: true,
      entries: entriesWithDetails,
      total: entriesWithDetails.length
    });
    
  } catch (error: any) {
    console.error('Error fetching contestant video entries:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch entries' },
      { status: 500 }
    );
  }
}
