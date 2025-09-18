import { NextRequest, NextResponse } from 'next/server';
import { db, unifiedDb, getSql } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    console.log('🎼 Admin Music Tracking: Fetching approved entries...');

    // Get all approved entries
    const allEntries = await db.getAllEventEntries();
    const approvedEntries = allEntries.filter(entry => entry.approved === true);

    console.log(`📊 Found ${approvedEntries.length} approved entries`);

    // Get additional data for each entry
    const entriesWithDetails = await Promise.all(
      approvedEntries.map(async (entry) => {
        try {
          // Get event details
          const events = await db.getAllEvents();
          const event = events.find(e => e.id === entry.eventId);

          // Get dancer name using contestant_id (which is the internal dancer ID)
          let contestantName = 'Unknown Contestant';
          let studioName = 'Independent';
          
          try {
            const sqlClient = getSql();
            
            // contestant_id is the internal dancer ID, so query dancers table directly
            const dancerResult = await sqlClient`
              SELECT name FROM dancers WHERE id = ${entry.contestantId}
            ` as any[];
            
            if (dancerResult.length > 0) {
              contestantName = dancerResult[0].name;
              console.log(`✅ Found dancer name: ${contestantName} for entry ${entry.id} using contestant_id ${entry.contestantId}`);
            } else {
              console.warn(`❌ Could not find dancer for entry ${entry.id} with contestant_id: ${entry.contestantId}`);
            }
          } catch (error) {
            console.error(`❌ Error fetching dancer for entry ${entry.id}:`, error);
          }

          return {
            ...entry,
            eventName: event?.name || 'Unknown Event',
            eventDate: event?.eventDate || null,
            venue: event?.venue || 'TBD',
            contestantName,
            studioName
          };
        } catch (error) {
          console.error('Error getting details for entry:', entry.id, error);
          return {
            ...entry,
            eventName: 'Unknown Event',
            eventDate: null,
            venue: 'TBD',
            contestantName: 'Unknown Contestant',
            studioName: 'Independent'
          };
        }
      })
    );

    // Sort by event date and entry type (live entries first, then by missing music)
    const sortedEntries = entriesWithDetails.sort((a, b) => {
      // Prioritize live entries without music first
      if (a.entryType === 'live' && !a.musicFileUrl && (b.entryType !== 'live' || b.musicFileUrl)) {
        return -1;
      }
      if (b.entryType === 'live' && !b.musicFileUrl && (a.entryType !== 'live' || a.musicFileUrl)) {
        return 1;
      }
      
      // Then sort by event date
      const dateA = a.eventDate ? new Date(a.eventDate).getTime() : 0;
      const dateB = b.eventDate ? new Date(b.eventDate).getTime() : 0;
      return dateA - dateB;
    });

    console.log(`✅ Returning ${sortedEntries.length} entries with details`);

    return NextResponse.json({
      success: true,
      entries: sortedEntries,
      summary: {
        total: sortedEntries.length,
        withMusic: sortedEntries.filter(entry => entry.musicFileUrl).length,
        missingMusic: sortedEntries.filter(entry => !entry.musicFileUrl && entry.entryType === 'live').length,
        virtual: sortedEntries.filter(entry => entry.entryType === 'virtual').length
      }
    });

  } catch (error: any) {
    console.error('Error in music tracking API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch music tracking data',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
