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
  // Get dancer registration status for all participants
  const dancers = await unifiedDb.getDancersWithRegistrationStatus(participantIds);
  
  // Calculate fees with intelligent registration fee handling
  const feeBreakdown = calculateEODSAFee(
    masteryLevel,
    performanceType,
    participantIds.length,
    {
      soloCount: options?.soloCount || 1,
      includeRegistration: true,
      participantDancers: dancers
    }
  );

  return {
    ...feeBreakdown,
    unpaidRegistrationDancers: dancers.filter(d => 
      !d.registrationFeePaid || 
      (d.registrationFeeMasteryLevel && d.registrationFeeMasteryLevel !== masteryLevel)
    ),
    paidRegistrationDancers: dancers.filter(d => 
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

// Check if a group of dancers need to pay registration fees
export const checkGroupRegistrationStatus = async (
  dancerIds: string[],
  masteryLevel: string
) => {
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
      'Water (Competitive)': 250,
      'Fire (Advanced)': 250
    }[masteryLevel] || 0;

    analysis.registrationFeeRequired = registrationFeePerPerson * analysis.needRegistration.length;
  }

  return analysis;
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