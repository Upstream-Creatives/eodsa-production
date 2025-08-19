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
    const allEntries = await db.getAllEventEntries();
    const contestantEntries = allEntries.filter(entry => {
      // Include if user owns the entry
      if (entry.eodsaId === eodsaId) return true;
      
      // Include if user is a participant in the group entry
      if (entry.participantIds && Array.isArray(entry.participantIds)) {
        return entry.participantIds.includes(eodsaId);
      }
      
      return false;
    });
    
    // Filter entries that need music upload (live entries without music)
    const entriesNeedingMusic = contestantEntries.filter(entry => 
      entry.entryType === 'live' && !entry.musicFileUrl
    );
    
    // Get additional info for each entry
    const entriesWithDetails = await Promise.all(
      entriesNeedingMusic.map(async (entry) => {
        try {
          // Get event details
          const events = await db.getAllEvents();
          const event = events.find(e => e.id === entry.eventId);
          
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
    console.error('Error fetching contestant music entries:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch entries' },
      { status: 500 }
    );
  }
}
