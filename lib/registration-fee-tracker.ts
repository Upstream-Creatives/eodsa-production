// Registration Fee Tracking System
// This module handles tracking of registration fees per dancer per event
// Since we don't have per-event registration tracking, we check for existing entries in the event

import { unifiedDb } from './database';
import { Dancer, calculateEODSAFee } from './types';

export interface RegistrationFeeStatus {
  registrationFeePaid: boolean;
  registrationFeePaidAt?: string;
  registrationFeeMasteryLevel?: string;
}

export interface EnhancedDancer extends Dancer {
  registrationFeePaid?: boolean;
  registrationFeePaidAt?: string;
  registrationFeeMasteryLevel?: string;
}

// Enhanced fee calculation that checks dancer registration status
export const calculateSmartEODSAFee = async (
  masteryLevel: string,
  performanceType: 'Solo' | 'Duet' | 'Trio' | 'Group',
  participantIds: string[],
  options?: {
    soloCount?: number;
    eventId?: string;
  }
) => {
  // REGISTRATION FEE CHECKING FOR ALL PERFORMANCE TYPES
  // Get dancer registration status for all participants regardless of performance type
  const dancers = await unifiedDb.getDancersWithRegistrationStatus(participantIds);

  // SIMPLIFIED APPROACH: Ignore global registration_fee_paid column
  // Only check if dancer has ANY entries for THIS specific event
  const dancersWithPendingCheck = await Promise.all(
    dancers.map(async (dancer) => {
      // Check if this dancer has ANY entries for THIS specific event (paid or unpaid)
      let hasEntryForThisEvent = false;

      if (options?.eventId) {
        try {
          const { getSql } = await import('./database');
          const sqlClient = getSql();
          // Check for ANY entries for this dancer in this event
          const existingEntries = await sqlClient`
            SELECT COUNT(*) as count FROM event_entries
            WHERE contestant_id = ${dancer.id}
            AND event_id = ${options.eventId}
            LIMIT 1
          ` as any[];

          hasEntryForThisEvent = existingEntries && existingEntries[0] && existingEntries[0].count > 0;

          console.log(`🔍 Dancer ${dancer.name} (${dancer.id}):`);
          console.log(`   - Has entry for this event (${options.eventId}): ${hasEntryForThisEvent}`);
          console.log(`   - Registration fee logic: ${hasEntryForThisEvent ? 'WAIVED (already has entry in this event)' : 'CHARGED (new entry for this event)'}`);
        } catch (error) {
          console.error(`Error checking existing entries for dancer ${dancer.id}:`, error);
        }
      }

      return {
        ...dancer,
        // Only consider registration fee as "paid" if they already have an entry for THIS event
        registrationFeePaid: hasEntryForThisEvent,
        registrationFeeMasteryLevel: hasEntryForThisEvent ? masteryLevel : undefined
      };
    })
  );
  
  // Fetch ALL event-specific fees if eventId provided
  let eventFees: any = {};
  if (options?.eventId) {
    try {
      const { db } = await import('./database');
      const event = await db.getEventById(options.eventId);
      if (event) {
        eventFees = {
          eventRegistrationFee: event.registrationFeePerDancer,
          eventSolo1Fee: event.solo1Fee,
          eventSolo2Fee: event.solo2Fee,
          eventSolo3Fee: event.solo3Fee,
          eventSoloAdditionalFee: event.soloAdditionalFee,
          eventDuoTrioFee: event.duoTrioFeePerDancer,
          eventGroupFee: event.groupFeePerDancer,
          eventCurrency: event.currency
        };
        
        console.log(`💰 Using event-specific fees for event ${options.eventId}:`);
        console.log(`   - Currency: ${event.currency}`);
        console.log(`   - Registration: ${event.currency}${event.registrationFeePerDancer}`);
        console.log(`   - Solo 1: ${event.currency}${event.solo1Fee}`);
        console.log(`   - Duo/Trio per dancer: ${event.currency}${event.duoTrioFeePerDancer}`);
        console.log(`   - Group per dancer: ${event.currency}${event.groupFeePerDancer}`);
      }
    } catch (error) {
      console.error('Error fetching event fees:', error);
    }
  }

  // Calculate fees with intelligent registration fee handling and event-specific fees
  const feeBreakdown = calculateEODSAFee(
    masteryLevel,
    performanceType,
    participantIds.length,
    {
      soloCount: options?.soloCount || 1,
      includeRegistration: true,
      participantDancers: dancersWithPendingCheck, // Use the enhanced dancer data
      eventId: options?.eventId, // Pass eventId for event-specific fees
      ...eventFees // Spread all event-specific fees
    }
  );

  return {
    ...feeBreakdown,
    unpaidRegistrationDancers: dancersWithPendingCheck.filter(d => 
      !d.registrationFeePaid || 
      (d.registrationFeeMasteryLevel && d.registrationFeeMasteryLevel !== masteryLevel)
    ),
    paidRegistrationDancers: dancersWithPendingCheck.filter(d => 
      d.registrationFeePaid && d.registrationFeeMasteryLevel === masteryLevel
    )
  };
};

// Mark registration fee as paid for multiple dancers
export const markGroupRegistrationFeePaid = async (
  dancerIds: string[],
  masteryLevel: string
) => {
  const results = [];
  for (const dancerId of dancerIds) {
    try {
      await unifiedDb.markRegistrationFeePaid(dancerId, masteryLevel);
      results.push({ dancerId, success: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      results.push({ dancerId, success: false, error: errorMessage });
    }
  }
  return results;
};

// Check if a group of dancers need to pay registration fees (ALL PERFORMANCE TYPES)
export const checkGroupRegistrationStatus = async (
  dancerIds: string[],
  masteryLevel: string,
  performanceType?: 'Solo' | 'Duet' | 'Trio' | 'Group',
  eventId?: string
) => {
  // REGISTRATION FEE CHECKING FOR ALL PERFORMANCE TYPES
  
  const dancers = await unifiedDb.getDancersWithRegistrationStatus(dancerIds);
  
  const analysis = {
    totalDancers: dancers.length,
    needRegistration: dancers.filter(d => 
      !d.registrationFeePaid || 
      (d.registrationFeeMasteryLevel && d.registrationFeeMasteryLevel !== masteryLevel)
    ),
    alreadyPaid: dancers.filter(d => 
      d.registrationFeePaid && d.registrationFeeMasteryLevel === masteryLevel
    ),
    registrationFeeRequired: 0
  };

  if (analysis.needRegistration.length > 0) {
    // Try to get event-specific registration fee
    let registrationFeePerPerson = 300; // Default
    
    if (eventId) {
      try {
        const { db } = await import('./database');
        const event = await db.getEventById(eventId);
        if (event && event.registrationFeePerDancer) {
          registrationFeePerPerson = event.registrationFeePerDancer;
        }
      } catch (error) {
        console.error('Error fetching event for registration fee:', error);
      }
    }

    analysis.registrationFeeRequired = registrationFeePerPerson * analysis.needRegistration.length;
  }

  return analysis;
};

// Automatically mark registration fee as paid when dancer gets their first paid entry
export const autoMarkRegistrationFeePaid = async (eodsaId: string, masteryLevel: string) => {
  try {
    console.log(`🎫 Auto-marking registration fee for dancer: ${eodsaId} (${masteryLevel})`);
    
    // Find the dancer by EODSA ID
    const basicDancer = await unifiedDb.getDancerByEodsaId(eodsaId);
    if (!basicDancer) {
      console.warn(`⚠️ No dancer found with EODSA ID: ${eodsaId}`);
      return { success: false, reason: 'Dancer not found' };
    }

    // Get registration status for this dancer
    const dancers = await unifiedDb.getDancersWithRegistrationStatus([basicDancer.id]);
    const dancer = dancers[0];
    
    if (!dancer) {
      console.warn(`⚠️ Could not get registration status for dancer: ${eodsaId}`);
      return { success: false, reason: 'Registration status not found' };
    }

    // Check if registration fee is already marked as paid for this mastery level
    if (dancer.registrationFeePaid && dancer.registrationFeeMasteryLevel === masteryLevel) {
      console.log(`✅ Registration fee already marked as paid for dancer: ${eodsaId} (${masteryLevel})`);
      return { success: true, reason: 'Already paid for this mastery level' };
    }

    // Mark registration fee as paid
    await unifiedDb.markRegistrationFeePaid(dancer.id, masteryLevel);
    console.log(`✅ Auto-marked registration fee as paid for dancer: ${eodsaId} (${masteryLevel})`);
    
    return { success: true, reason: 'Marked as paid' };
  } catch (error) {
    console.error('❌ Failed to auto-mark registration fee as paid:', error);
    return { success: false, reason: 'Error occurred' };
  }
};

// Auto-mark registration fees for multiple participants when entry is paid
export const autoMarkRegistrationForParticipants = async (participantIds: string[], masteryLevel: string) => {
  const results = [];
  
  for (const participantId of participantIds) {
    try {
      // Get dancer info
      const dancer = await unifiedDb.getDancerById(participantId);
      if (dancer && dancer.eodsaId) {
        const result = await autoMarkRegistrationFeePaid(dancer.eodsaId, masteryLevel);
        results.push({ participantId, eodsaId: dancer.eodsaId, ...result });
      } else {
        results.push({ participantId, success: false, reason: 'No EODSA ID found' });
      }
    } catch (error) {
      console.error(`Error processing participant ${participantId}:`, error);
      results.push({ participantId, success: false, reason: 'Error occurred' });
    }
  }
  
  return results;
};

// Initialize registration fee tracking in database
export const initializeRegistrationFeeTracking = async () => {
  try {
    await unifiedDb.addRegistrationFeeColumns();
    console.log('✅ Registration fee tracking initialized');
  } catch (error) {
    console.error('❌ Failed to initialize registration fee tracking:', error);
  }
}; 