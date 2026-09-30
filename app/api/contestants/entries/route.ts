import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import {
  getAllContestantEntriesForDancer,
  getDancerInternalId,
  normalizeEntryEventId,
} from '@/lib/contestant-entries';

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

    const [contestantEntries, dancerInternalId, regularEntries, nationalsEntries] =
      await Promise.all([
        getAllContestantEntriesForDancer(eodsaId),
        getDancerInternalId(eodsaId),
        db.getAllEventEntries(),
        db.getAllNationalsEventEntries(),
      ]);

    if (debug) {
      console.log(`Total regular entries: ${regularEntries.length}`);
      console.log(`Total nationals entries: ${nationalsEntries.length}`);
      console.log(`Total entries in database: ${regularEntries.length + nationalsEntries.length}`);
      console.log(`Looking for entries for EODSA ID: ${eodsaId}`);
      console.log(`Dancer internal ID: ${dancerInternalId}`);
      console.log(`Found ${contestantEntries.length} entries for dancer ${eodsaId}`);
    }
    
    const events = await db.getAllEvents();

    const entriesWithDetails = contestantEntries.map((entry) => {
      try {
        const eventId = normalizeEntryEventId(entry);
        const event = events.find((e) => e.id === eventId);
        
        return {
          ...entry,
          eventId,
          eventName: event?.name || 'Unknown Event',
          eventType: event?.eventType || null,
          eventDate: event?.eventDate || null,
          venue: event?.venue || 'TBD',
          region: event?.region || null,
          entryFee: entry.calculatedFee || 0,
          paid: entry.paymentStatus === 'paid',
        };
      } catch (error) {
        console.error('Error getting event details for entry:', entry.id, error);
        const eventId = normalizeEntryEventId(entry);
        return {
          ...entry,
          eventId,
          eventName: 'Unknown Event',
          eventDate: null,
          venue: 'TBD',
          region: null,
          entryFee: entry.calculatedFee || 0,
          paid: entry.paymentStatus === 'paid',
        };
      }
    });
    
    return NextResponse.json({
      success: true,
      entries: entriesWithDetails,
      debug: debug
        ? {
            totalRegularEntries: regularEntries.length,
            totalNationalsEntries: nationalsEntries.length,
            totalEntriesInDb: regularEntries.length + nationalsEntries.length,
            entriesFoundForDancer: contestantEntries.length,
            eodsaIdSearched: eodsaId,
            dancerInternalId,
            sampleRegularEntries: regularEntries.slice(0, 2).map((e) => ({
              entryId: e.id,
              itemName: e.itemName,
              participantIds: e.participantIds,
              eodsaId: e.eodsaId,
            })),
            sampleNationalsEntries: nationalsEntries.slice(0, 2).map((e) => ({
              entryId: e.id,
              itemName: e.itemName,
              participantIds: e.participantIds,
              eodsaId: e.eodsaId,
            })),
          }
        : undefined,
    });
  } catch (error) {
    console.error('Error getting contestant entries:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get entries' },
      { status: 500 }
    );
  }
}
