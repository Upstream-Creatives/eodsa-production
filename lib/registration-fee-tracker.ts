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
  // Only check if dancer has ANY entries for THIS specific event (paid or unpaid)
  const dancersWithPendingCheck = await Promise.all(
    dancers.map(async (dancer) => {
      // Check if this dancer has ANY entries for THIS specific event (paid or unpaid)
      let hasEntryForThisEvent = false;

      if (options?.eventId) {
        try {
          const { getSql } = await import('./database');
          const sqlClient = getSql();
          // Check for ANY entries for this dancer in this event
          // Check by participant_ids (JSON array), eodsa_id, or contestant_id
          // Use JSONB containment for proper JSON array checking
          const existingEntries = await sqlClient`
            SELECT COUNT(*) as count FROM event_entries
            WHERE event_id = ${options.eventId}
            AND (
              eodsa_id = ${dancer.eodsaId || dancer.id}
              OR contestant_id = ${dancer.id}
              OR (participant_ids::jsonb ? ${dancer.id})
              OR (participant_ids::jsonb ? ${dancer.eodsaId || ''})
            )
            LIMIT 1
          ` as any[];

          hasEntryForThisEvent = existingEntries && existingEntries[0] && existingEntries[0].count > 0;

          console.log(`🔍 Dancer ${dancer.name} (${dancer.id}, EODSA: ${dancer.eodsaId}):`);
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

  // For solo entries: calculate cumulative package pricing with proper deduction
  // BACKEND IS SOURCE OF TRUTH - calculates everything from scratch
  let calculatedPerformanceFee = 0;
  let calculatedRegistrationFee = 0;
  let existingSoloCount = 0;
  
  if (performanceType === 'Solo' && options?.eventId && participantIds.length === 1) {
    const participantId = participantIds[0];
    
    // First, get the dancer's EODSA ID from the internal ID
    const { getSql } = await import('./database');
    const sqlClient = getSql();
    
    let dancerEodsaId: string | null = null;
    try {
      const dancerInfo = await sqlClient`
        SELECT eodsa_id FROM dancers WHERE id = ${participantId} LIMIT 1
      ` as any[];
      
      if (dancerInfo.length > 0 && dancerInfo[0].eodsa_id) {
        dancerEodsaId = dancerInfo[0].eodsa_id;
      }
    } catch (error) {
      console.error('Error getting dancer EODSA ID:', error);
    }
    
    // Get ALL existing solo entries for this dancer in this event (paid AND unpaid)
    // MUST check by BOTH internal ID (participant_ids) and EODSA ID in multiple ways
    // participant_ids can be stored as internal IDs OR EODSA IDs, so check both
    
    // Also try to get all dancer IDs (internal and EODSA) that might match
    let allDancerIds: string[] = [participantId];
    if (dancerEodsaId) {
      allDancerIds.push(dancerEodsaId);
    }
    
    // Try to find any other internal IDs for the same EODSA ID (in case dancer has multiple internal IDs)
    if (dancerEodsaId) {
      try {
        const otherInternalIds = await sqlClient`
          SELECT id FROM dancers WHERE eodsa_id = ${dancerEodsaId}
        ` as any[];
        otherInternalIds.forEach((row: any) => {
          if (row.id && !allDancerIds.includes(row.id)) {
            allDancerIds.push(row.id);
          }
        });
      } catch (error) {
        console.error('Error getting other internal IDs:', error);
      }
    }
    
    console.log(`🔍 Searching for existing solos with IDs: ${allDancerIds.join(', ')}`);
    
    // Build comprehensive query that checks all possible matching fields
    // Get ALL solos for this event first, then filter client-side (more reliable)
    // This avoids complex SQL queries with dynamic conditions
    const allSolosInEvent = await sqlClient`
      SELECT id, calculated_fee, payment_status, participant_ids, eodsa_id, contestant_id
      FROM event_entries
      WHERE event_id = ${options.eventId}
      AND performance_type = 'Solo'
      ORDER BY submitted_at ASC
    ` as any[];
    
    console.log(`🔍 Found ${allSolosInEvent.length} total solo entries in event ${options.eventId}`);
    
    // Filter client-side by checking if any ID matches
    let existingSoloEntries: any[] = [];
    
    for (const entry of allSolosInEvent) {
      const entryEodsaId = entry.eodsa_id;
      const entryContestantId = entry.contestant_id;
      let entryParticipantIds: string[] = [];
      
      try {
        if (typeof entry.participant_ids === 'string') {
          entryParticipantIds = JSON.parse(entry.participant_ids);
        } else if (Array.isArray(entry.participant_ids)) {
          entryParticipantIds = entry.participant_ids;
        }
      } catch (e) {
        console.error('Error parsing participant_ids:', e);
      }
      
      // Check if any of our IDs match any field
      const matches = allDancerIds.some(id => 
        entryEodsaId === id ||
        entryContestantId === id ||
        entryParticipantIds.includes(id)
      ) || (dancerEodsaId && (
        entryEodsaId === dancerEodsaId ||
        entryParticipantIds.includes(dancerEodsaId)
      ));
      
      if (matches) {
        existingSoloEntries.push(entry);
        console.log(`   - ✅ Matched entry ${entry.id}: eodsa_id=${entryEodsaId}, contestant_id=${entryContestantId}, participant_ids=${JSON.stringify(entryParticipantIds)}`);
      }
    }
    
    // If no results, try alternative query with more flexible matching
    if (existingSoloEntries.length === 0 && dancerEodsaId) {
      console.log(`⚠️ No entries found with first query, trying alternative query...`);
      // Try querying ALL solos for this event and filtering client-side
      const allSolos = await sqlClient`
        SELECT id, calculated_fee, payment_status, participant_ids, eodsa_id, contestant_id
        FROM event_entries
        WHERE event_id = ${options.eventId}
        AND performance_type = 'Solo'
        ORDER BY submitted_at ASC
      ` as any[];
      
      console.log(`   - Found ${allSolos.length} total solo entries in event`);
      
      // Filter client-side by checking if any ID matches
      existingSoloEntries = allSolos.filter((entry: any) => {
        const entryEodsaId = entry.eodsa_id;
        const entryContestantId = entry.contestant_id;
        let entryParticipantIds: string[] = [];
        
        try {
          if (typeof entry.participant_ids === 'string') {
            entryParticipantIds = JSON.parse(entry.participant_ids);
          } else if (Array.isArray(entry.participant_ids)) {
            entryParticipantIds = entry.participant_ids;
          }
        } catch (e) {
          console.error('Error parsing participant_ids:', e);
        }
        
        // Check if any of our IDs match any field
        const matches = allDancerIds.some(id => 
          entryEodsaId === id ||
          entryContestantId === id ||
          entryParticipantIds.includes(id)
        ) || (dancerEodsaId && (
          entryEodsaId === dancerEodsaId ||
          entryParticipantIds.includes(dancerEodsaId)
        ));
        
        if (matches) {
          console.log(`   - ✅ Matched entry ${entry.id}: eodsa_id=${entryEodsaId}, contestant_id=${entryContestantId}, participant_ids=${JSON.stringify(entryParticipantIds)}`);
        }
        
        return matches;
      });
      
      console.log(`   - After client-side filtering: ${existingSoloEntries.length} entries found`);
    }
    
    console.log(`🔍 Looking for existing solos for dancer ${participantId} (EODSA: ${dancerEodsaId || 'N/A'}) in event ${options.eventId}`);
    console.log(`   - Found ${existingSoloEntries.length} existing solo entries`);
    existingSoloEntries.forEach((entry, idx) => {
      console.log(`   - Entry ${idx + 1}: ID ${entry.id}, Fee R${entry.calculated_fee}, Payment: ${entry.payment_status}`);
      console.log(`     - participant_ids: ${JSON.stringify(entry.participant_ids)}`);
      console.log(`     - eodsa_id: ${entry.eodsa_id}`);
      console.log(`     - contestant_id: ${entry.contestant_id}`);
    });
    
    if (existingSoloEntries.length === 0 && dancerEodsaId) {
      console.warn(`⚠️ No existing solo entries found for dancer ${participantId} (EODSA: ${dancerEodsaId}) in event ${options.eventId}`);
      console.warn(`   - This might be correct if this is their first solo, or there might be a matching issue`);
    }
    
    existingSoloCount = existingSoloEntries.length;
    
    // Get package fees (these are CUMULATIVE package totals, not individual fees)
    const solo1Package = eventFees.eventSolo1Fee || 550;  // 1 Solo Package total (performance only)
    const solo2Package = eventFees.eventSolo2Fee || 942;   // 2 Solos Package total (performance only)
    const solo3Package = eventFees.eventSolo3Fee || 1256;  // 3 Solos Package total (performance only)
    const additionalSoloFee = eventFees.eventSoloAdditionalFee || 349;
    const registrationFee = eventFees.eventRegistrationFee || 175;
    
    // Check if registration was already assigned (has ANY entry in this event, paid or unpaid)
    // This includes checking other entry types too, not just solos
    const registrationAlreadyAssigned = existingSoloEntries.length > 0 || 
      await (async () => {
        let anyEntry: any[] = [];
        if (dancerEodsaId) {
          anyEntry = await sqlClient`
            SELECT COUNT(*) as count FROM event_entries
            WHERE event_id = ${options.eventId}
            AND (
              eodsa_id = ${dancerEodsaId}
              OR contestant_id = ${participantId}
              OR (participant_ids::jsonb ? ${participantId})
              OR (participant_ids::jsonb ? ${dancerEodsaId})
            )
            LIMIT 1
          ` as any[];
        } else {
          anyEntry = await sqlClient`
            SELECT COUNT(*) as count FROM event_entries
            WHERE event_id = ${options.eventId}
            AND (
              contestant_id = ${participantId}
              OR (participant_ids::jsonb ? ${participantId})
            )
            LIMIT 1
          ` as any[];
        }
        return anyEntry && anyEntry[0] && anyEntry[0].count > 0;
      })();
    
    // Calculate what package total they should have been charged for existing solos
    // This is based on the solo count, not what they actually paid
    let previousPackageTotal = 0;
    if (existingSoloCount === 0) {
      previousPackageTotal = 0;
    } else if (existingSoloCount === 1) {
      previousPackageTotal = solo1Package;
    } else if (existingSoloCount === 2) {
      previousPackageTotal = solo2Package;
    } else if (existingSoloCount === 3) {
      previousPackageTotal = solo3Package;
    } else {
      // 4+ solos: 3-solo package + additional solos
      previousPackageTotal = solo3Package + ((existingSoloCount - 3) * additionalSoloFee);
    }
    
    // Calculate new total solo count
    const newTotalSoloCount = existingSoloCount + 1;
    
    // Calculate new package total (performance fees only, registration is separate)
    let newPackagePerformanceTotal = 0;
    if (newTotalSoloCount === 1) {
      newPackagePerformanceTotal = solo1Package;
    } else if (newTotalSoloCount === 2) {
      newPackagePerformanceTotal = solo2Package;
    } else if (newTotalSoloCount === 3) {
      newPackagePerformanceTotal = solo3Package;
    } else {
      // 4+ solos: 3-solo package + additional solos
      newPackagePerformanceTotal = solo3Package + ((newTotalSoloCount - 3) * additionalSoloFee);
    }
    
    // Calculate performance fee increment (new package total - previous package total)
    // This is what they should pay for performance fees NOW
    calculatedPerformanceFee = Math.max(0, newPackagePerformanceTotal - previousPackageTotal);
    
    // Registration fee: only charge if NOT already assigned
    calculatedRegistrationFee = registrationAlreadyAssigned ? 0 : registrationFee;
    
    // Calculate total amount already charged (sum of ALL calculated_fee values)
    // This is what they've ACTUALLY been charged (might include previous registration)
    const previousChargesTotal = existingSoloEntries.reduce((sum, entry) => {
      return sum + (parseFloat(entry.calculated_fee) || 0);
    }, 0);
    
    // Total amount due now = performance increment + registration (if not assigned)
    const amountDueNow = calculatedPerformanceFee + calculatedRegistrationFee;
    
    console.log(`💰 Backend Fee Calculation (Source of Truth):`);
    console.log(`   - Existing solo entries: ${existingSoloCount}`);
    console.log(`   - Previous package total: R${previousPackageTotal}`);
    console.log(`   - Previous charges total (actual): R${previousChargesTotal}`);
    console.log(`   - New total solo count: ${newTotalSoloCount}`);
    console.log(`   - New package performance total: R${newPackagePerformanceTotal}`);
    console.log(`   - Registration already assigned: ${registrationAlreadyAssigned}`);
    console.log(`   - Performance fee increment: R${calculatedPerformanceFee}`);
    console.log(`   - Registration fee: R${calculatedRegistrationFee}`);
    console.log(`   - Amount due now: R${amountDueNow}`);
    console.log(`   - Breakdown: Performance R${calculatedPerformanceFee} + Registration R${calculatedRegistrationFee}`);
    
    // Return calculated fees (backend is source of truth)
    return {
      registrationFee: calculatedRegistrationFee,
      performanceFee: calculatedPerformanceFee,
      totalFee: calculatedPerformanceFee + calculatedRegistrationFee,
      breakdown: `Solo Package (${existingSoloCount + 1} solos total) - Previous: R${previousPackageTotal}`,
      registrationBreakdown: calculatedRegistrationFee > 0 
        ? `Registration fee (first entry in this event)`
        : `Registration fee waived (already assigned on previous entry)`,
      currency: eventFees.eventCurrency || 'ZAR',
      unpaidRegistrationDancers: calculatedRegistrationFee > 0 ? participantIds : [],
      paidRegistrationDancers: calculatedRegistrationFee === 0 ? participantIds : []
    };
  }

  // For non-solo entries: standard calculation with registration check
  const feeBreakdown = calculateEODSAFee(
    masteryLevel,
    performanceType,
    participantIds.length,
    {
      soloCount: options?.soloCount || 1,
      includeRegistration: true,
      participantDancers: dancersWithPendingCheck,
      eventId: options?.eventId,
      ...eventFees
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