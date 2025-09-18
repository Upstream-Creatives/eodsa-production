// Registration Fee Tracking System
// This module handles tracking of one-time registration fees per dancer

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
  }
) => {
  // REGISTRATION FEE CHECKING FOR ALL PERFORMANCE TYPES
  // Get dancer registration status for all participants regardless of performance type
  const dancers = await unifiedDb.getDancersWithRegistrationStatus(participantIds);
  
  // SIMPLE FIX: Check for any pending entries that include registration fees for these dancers
  const dancersWithPendingCheck = await Promise.all(
    dancers.map(async (dancer) => {
      // Check if this dancer has any pending entries that include registration fees
      const hasPendingRegistrationEntry = await unifiedDb.hasPendingRegistrationEntry(dancer.id, masteryLevel);
      
      console.log(`🔍 Dancer ${dancer.name} (${dancer.id}):`);
      console.log(`   - Registration fee paid: ${dancer.registrationFeePaid}`);
      console.log(`   - Registration fee mastery level: ${dancer.registrationFeeMasteryLevel}`);
      console.log(`   - Has pending registration entry: ${hasPendingRegistrationEntry}`);
      
      return {
        ...dancer,
        // If they have a pending entry with registration fee, consider it as "paid" for calculation purposes
        registrationFeePaid: dancer.registrationFeePaid || hasPendingRegistrationEntry,
        registrationFeeMasteryLevel: dancer.registrationFeeMasteryLevel || (hasPendingRegistrationEntry ? masteryLevel : undefined)
      };
    })
  );
  
  // Calculate fees with intelligent registration fee handling
  const feeBreakdown = calculateEODSAFee(
    masteryLevel,
    performanceType,
    participantIds.length,
    {
      soloCount: options?.soloCount || 1,
      includeRegistration: true,
      participantDancers: dancersWithPendingCheck // Use the enhanced dancer data
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
  performanceType?: 'Solo' | 'Duet' | 'Trio' | 'Group'
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
    const registrationFeePerPerson = {
      'Water (Competitive)': 300,
      'Fire (Advanced)': 300,
      'Nationals': 300
    }[masteryLevel] || 300; // Default to R300 if unknown mastery level

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