/**
 * Pricing utility functions for consistent fee calculation across the application
 * Fixes the critical bug where solo entry pricing was not progressive
 */

/**
 * Calculate the correct fee for a solo entry based on how many solo entries 
 * the dancer already has for the specific event
 * 
 * @param currentSoloCount - The total number of solo entries (including this new one)
 * @returns The fee that should be charged for this specific solo entry
 */
export function calculateSoloEntryFee(currentSoloCount: number): number {
  // Solo packages: 1 solo R400, 2 solos R750, 3 solos R1000, 4 solos R1200, 5th FREE, additional solos R100 each
  
  if (currentSoloCount === 1) {
    return 400; // First solo: R400
  } else if (currentSoloCount === 2) {
    return 750 - 400; // Second solo: Total R750 - already paid R400 = R350
  } else if (currentSoloCount === 3) {
    return 1000 - 750; // Third solo: Total R1000 - already paid R750 = R250
  } else if (currentSoloCount === 4) {
    return 1200 - 1000; // Fourth solo: Total R1200 - already paid R1000 = R200
  } else if (currentSoloCount === 5) {
    return 0; // Fifth solo is FREE
  } else {
    return 100; // Additional solos R100 each
  }
}

/**
 * Calculate the total cumulative fee for multiple solo entries
 * 
 * @param totalSoloCount - Total number of solo entries
 * @returns The total fee that should have been paid for all solo entries
 */
export function calculateCumulativeSoloFee(totalSoloCount: number): number {
  if (totalSoloCount <= 0) return 0;
  
  if (totalSoloCount === 1) return 400;
  if (totalSoloCount === 2) return 750;
  if (totalSoloCount === 3) return 1000;
  if (totalSoloCount === 4) return 1200;
  if (totalSoloCount === 5) return 1200; // 5th is free
  
  // More than 5: 1200 + (additional * 100)
  return 1200 + ((totalSoloCount - 5) * 100);
}

/**
 * Get existing solo entries for a dancer/contestant for a specific event
 * Handles both legacy and unified system dancers
 * 
 * @param allEntries - All event entries from the database
 * @param eventId - The event ID to check
 * @param eodsaId - The dancer's EODSA ID
 * @param contestantId - The contestant ID (for legacy system)
 * @param dancerId - The dancer's internal ID (for unified system)
 * @returns Array of existing solo entries for this dancer in this event
 */
export function getExistingSoloEntries(
  allEntries: any[],
  eventId: string,
  eodsaId: string,
  contestantId?: string,
  dancerId?: string
): any[] {
  return allEntries.filter(entry => {
    // Must be the same event and a solo entry
    if (entry.eventId !== eventId || entry.participantIds.length !== 1) {
      return false;
    }
    
    // Check if dancer owns the entry (legacy system)
    if (entry.eodsaId === eodsaId || (contestantId && entry.contestantId === contestantId)) {
      return true;
    }
    
    // Check if dancer is a participant (unified system)
    if (entry.participantIds.includes(eodsaId) || 
        (dancerId && entry.participantIds.includes(dancerId))) {
      return true;
    }
    
    return false;
  });
}

/**
 * Calculate fee for non-solo performance types
 * 
 * @param performanceType - 'Duet', 'Trio', or 'Group'
 * @param participantCount - Number of participants
 * @returns The calculated fee
 */
export function calculateNonSoloFee(performanceType: string, participantCount: number): number {
  if (performanceType === 'Duet' || performanceType === 'Trio') {
    return 280 * participantCount; // R280 per person
  } else if (performanceType === 'Group') {
    return participantCount <= 9 ? 220 * participantCount : 190 * participantCount;
  }
  return 0;
}

/**
 * Validate and correct an entry fee for any performance type
 * This is the main function that should be used for server-side fee validation
 * 
 * @param performanceType - 'Solo', 'Duet', 'Trio', or 'Group'
 * @param participantCount - Number of participants
 * @param submittedFee - The fee that was submitted from the frontend
 * @param existingSoloCount - Number of existing solo entries (for solo only)
 * @returns Object with validated fee and correction info
 */
export function validateAndCorrectEntryFee(
  performanceType: string,
  participantCount: number,
  submittedFee: number,
  existingSoloCount: number = 0
): {
  validatedFee: number;
  wasCorrect: boolean;
  explanation: string;
} {
  let correctFee: number;
  let explanation: string;
  
  if (performanceType === 'Solo') {
    const currentSoloCount = existingSoloCount + 1;
    correctFee = calculateSoloEntryFee(currentSoloCount);
    explanation = `Solo entry #${currentSoloCount}: ${getSoloFeeExplanation(currentSoloCount)}`;
  } else {
    correctFee = calculateNonSoloFee(performanceType, participantCount);
    explanation = `${performanceType} with ${participantCount} participants`;
  }
  
  return {
    validatedFee: correctFee,
    wasCorrect: submittedFee === correctFee,
    explanation
  };
}

/**
 * Get a human-readable explanation for solo pricing
 */
function getSoloFeeExplanation(soloCount: number): string {
  if (soloCount === 1) return 'R400 (first solo)';
  if (soloCount === 2) return 'R350 (package total R750)';
  if (soloCount === 3) return 'R250 (package total R1000)';
  if (soloCount === 4) return 'R200 (package total R1200)';
  if (soloCount === 5) return 'R0 (fifth solo is FREE)';
  return 'R100 (additional solo)';
}

/**
 * Constants for easy reference
 */
export const PRICING_CONSTANTS = {
  SOLO_PACKAGES: {
    1: 400,
    2: 750,
    3: 1000,
    4: 1200,
    5: 1200 // 5th is free, so total stays at 1200
  },
  SOLO_INCREMENTAL: {
    1: 400,
    2: 350, // 750 - 400
    3: 250, // 1000 - 750
    4: 200, // 1200 - 1000
    5: 0,   // FREE
    additional: 100
  },
  NON_SOLO: {
    DUET_TRIO_PER_PERSON: 280,
    SMALL_GROUP_PER_PERSON: 220, // 4-9 people
    LARGE_GROUP_PER_PERSON: 190  // 10+ people
  }
};
