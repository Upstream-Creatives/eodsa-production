import { NextResponse } from 'next/server';
import { db, unifiedDb } from '@/lib/database';
import { EODSA_FEES } from '@/lib/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eodsaId: string }> }
) {
  try {
    const { eodsaId } = await params;
    
    // Get the dancer info
    const dancer = await unifiedDb.getDancerByEodsaId(eodsaId);
    if (!dancer) {
      return NextResponse.json(
        { success: false, error: 'Dancer not found' },
        { status: 404 }
      );
    }

    // Get all event entries
    const allEntries = await db.getAllEventEntries();
    
    // Filter entries related to this dancer
    const relatedEntries = allEntries.filter(entry => {
      // Entry is related if:
      // 1. The dancer is the main contestant (entry.eodsaId === eodsaId)
      // 2. The dancer is a participant in the entry (participantIds includes dancer.id)
      return entry.eodsaId === eodsaId || 
             entry.participantIds.includes(dancer.id);
    });

    // Get all events to include event names
    const allEvents = await db.getAllEvents();
    const eventMap = allEvents.reduce((map, event) => {
      map[event.id] = event;
      return map;
    }, {} as Record<string, any>);

    // Process entries to add additional context
    const enhancedEntries = await Promise.all(
      relatedEntries.map(async (entry) => {
        const event = eventMap[entry.eventId];
        
        // Determine the dancer's role in this entry
        let participationRole = 'solo';
        let isMainContestant = entry.eodsaId === eodsaId;
        
        if (entry.participantIds.length > 1) {
          if (entry.participantIds.length === 2) participationRole = 'duet';
          else if (entry.participantIds.length === 3) participationRole = 'trio';
          else participationRole = 'group';
        }

        // Get all participant names for group entries
        let participantNames: string[] = [];
        if (entry.participantIds.length > 1) {
          participantNames = await Promise.all(
            entry.participantIds.map(async (participantId) => {
              try {
                const participant = await unifiedDb.getDancerById(participantId);
                return participant ? participant.name : 'Unknown Dancer';
              } catch (error) {
                return 'Unknown Dancer';
              }
            })
          );
        }

        // Calculate this dancer's share of the fee
        let dancerShare = entry.calculatedFee;
        if (entry.participantIds.length > 1 && !isMainContestant) {
          // For group entries where this dancer is not the main contestant,
          // we assume they share the cost equally (this might need business logic adjustment)
          dancerShare = entry.calculatedFee / entry.participantIds.length;
        }

        return {
          ...entry,
          eventName: event?.name || 'Unknown Event',
          eventDate: event?.eventDate,
          participationRole,
          isMainContestant,
          participantNames,
          dancerShare,
          isGroupEntry: entry.participantIds.length > 1
        };
      })
    );

    // Separate solo and group entries for display
    const soloEntries = enhancedEntries.filter(entry => entry.participationRole === 'solo');
    const groupEntries = enhancedEntries.filter(entry => entry.participationRole !== 'solo');

    // Calculate total outstanding balance
    const registrationFeeOutstanding = dancer.registrationFeePaid ? 0 : EODSA_FEES.REGISTRATION.Nationals;
    
    // For outstanding calculation, we only count unpaid entries
    const unpaidEntries = enhancedEntries.filter(entry => entry.paymentStatus !== 'paid');
    const totalEntryOutstanding = unpaidEntries.reduce((total, entry) => {
      // If it's a group entry and dancer is not main contestant, they pay a share
      return total + (entry.dancerShare || 0);
    }, 0);

    const totalOutstanding = registrationFeeOutstanding + totalEntryOutstanding;

    // Calculate total paid
    const paidEntries = enhancedEntries.filter(entry => entry.paymentStatus === 'paid');
    const totalPaid = paidEntries.reduce((total, entry) => {
      return total + (entry.dancerShare || 0);
    }, 0);

    return NextResponse.json({
      success: true,
      dancer: {
        id: dancer.id,
        name: dancer.name,
        eodsaId: dancer.eodsaId,
        registrationFeePaid: dancer.registrationFeePaid || false,
        registrationFeePaidAt: dancer.registrationFeePaidAt,
        registrationFeeMasteryLevel: dancer.registrationFeeMasteryLevel
      },
      financial: {
        registrationFeeAmount: EODSA_FEES.REGISTRATION.Nationals,
        registrationFeeOutstanding,
        totalEntryOutstanding,
        totalOutstanding,
        totalPaid
      },
      entries: {
        all: enhancedEntries,
        solo: soloEntries,
        group: groupEntries,
        totalEntries: enhancedEntries.length,
        soloCount: soloEntries.length,
        groupCount: groupEntries.length
      }
    });

  } catch (error) {
    console.error('Error fetching dancer finances:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dancer financial data' },
      { status: 500 }
    );
  }
}