import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eodsaId = searchParams.get('eodsaId');
    const debug = searchParams.get('debug') === 'true';
    
    if (!eodsaId) {
      return NextResponse.json(
        { success: false, error: 'EODSA ID is required' },
        { status: 400 }
      );
    }

    // Get all event entries for this contestant (owned OR participating in)
    const allEntries = await db.getAllEventEntries();
    
    // We need to get the dancer's internal ID to check participantIds properly
    // Based on database.ts, participantIds may contain either EODSA IDs or internal dancer IDs
    let dancerInternalId: string | null = null;
    try {
      const { unifiedDb } = await import('@/lib/database');
      const dancer = await unifiedDb.getDancerByEodsaId(eodsaId);
      if (dancer) {
        dancerInternalId = dancer.id;
      }
    } catch (error) {
      if (debug) console.log('Could not get dancer internal ID:', error);
    }
    
    if (debug) {
      console.log(`Total entries in database: ${allEntries.length}`);
      console.log(`Looking for entries for EODSA ID: ${eodsaId}`);
      console.log(`Dancer internal ID: ${dancerInternalId}`);
    }
    
    const contestantEntries = allEntries.filter(entry => {
      // Include if user owns the entry
      if (entry.eodsaId === eodsaId) {
        if (debug) console.log(`Found owned entry: ${entry.id} - ${entry.itemName}`);
        return true;
      }
      
      // Include if user is a participant in the group entry
      if (entry.participantIds && Array.isArray(entry.participantIds)) {
        // Check both EODSA ID and internal dancer ID
        const isParticipantByEodsaId = entry.participantIds.includes(eodsaId);
        const isParticipantByInternalId = dancerInternalId && entry.participantIds.includes(dancerInternalId);
        
        if (isParticipantByEodsaId || isParticipantByInternalId) {
          if (debug) {
            console.log(`Found participant entry: ${entry.id} - ${entry.itemName}`);
            console.log(`Participants: ${JSON.stringify(entry.participantIds)}`);
            console.log(`Matched by EODSA ID: ${isParticipantByEodsaId}, by internal ID: ${isParticipantByInternalId}`);
          }
          return true;
        }
      }
      
      return false;
    });
    
    if (debug) {
      console.log(`Found ${contestantEntries.length} entries for dancer ${eodsaId}`);
    }
    
    // Get additional info for each entry
    const entriesWithDetails = await Promise.all(
      contestantEntries.map(async (entry) => {
        try {
          // Get event details
          const events = await db.getAllEvents();
          const event = events.find(e => e.id === entry.eventId);
          
          return {
            ...entry,
            eventName: event?.name || 'Unknown Event',
            eventDate: event?.eventDate || null,
            venue: event?.venue || 'TBD',
            region: event?.region || null,
            entryFee: entry.calculatedFee || 0,
            paid: entry.paymentStatus === 'paid'
          };
        } catch (error) {
          console.error('Error getting event details for entry:', entry.id, error);
          return {
            ...entry,
            eventName: 'Unknown Event',
            eventDate: null,
            venue: 'TBD',
            region: null,
            entryFee: entry.calculatedFee || 0,
            paid: entry.paymentStatus === 'paid'
          };
        }
      })
    );
    
    return NextResponse.json({
      success: true,
      entries: entriesWithDetails,
      debug: debug ? {
        totalEntriesInDb: allEntries.length,
        entriesFoundForDancer: contestantEntries.length,
        eodsaIdSearched: eodsaId,
        dancerInternalId: dancerInternalId,
        sampleParticipantIds: allEntries.slice(0, 3).map(e => ({ 
          entryId: e.id, 
          participantIds: e.participantIds,
          eodsaId: e.eodsaId 
        }))
      } : undefined
    });
  } catch (error) {
    console.error('Error getting contestant entries:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get entries' },
      { status: 500 }
    );
  }
}
