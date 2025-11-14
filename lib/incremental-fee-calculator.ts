/**
 * Incremental Fee Calculator
 * 
 * This module provides server-side fee calculation that computes fees from database truth.
 * It ensures that:
 * - Registration fees are charged only once per dancer per event (when registration_charged = false)
 * - Entry fees are calculated incrementally based on existing entries count
 * - Fees are never negative
 * - All calculations are based on actual database records, not session/cart data
 */

import { getSql } from './database';
import { calculateSoloEntryFee, calculateNonSoloFee, EventFeeConfig } from './pricing-utils';
import type { Event } from './types';

export interface IncrementalFeeResult {
  registrationFee: number;
  entryFee: number;
  totalFee: number;
  registrationCharged: boolean;
  registrationWasAlreadyCharged: boolean;
  entryCount: number;
  breakdown: string;
  warnings: string[];
}

export interface IncrementalFeeOptions {
  eventId: string;
  dancerId: string; // contestant_id or dancer id
  eodsaId: string;
  performanceType: 'Solo' | 'Duet' | 'Trio' | 'Group';
  participantIds: string[]; // For duet/trio/group, includes all participants
  masteryLevel: string;
}

/**
 * Compute incremental fee for a new entry based on database truth
 * 
 * This function:
 * 1. Checks if registration was already CHARGED (not necessarily paid) for this dancer/event
 * 2. Counts existing entries of the same type from database
 * 3. Calculates incremental entry fee based on existing count
 * 4. Adds registration fee only if not already charged
 * 5. Ensures fee is never negative
 */
export async function computeIncrementalFee(
  options: IncrementalFeeOptions
): Promise<IncrementalFeeResult> {
  const {
    eventId,
    dancerId,
    eodsaId,
    performanceType,
    participantIds,
    masteryLevel
  } = options;

  const sql = getSql();
  const warnings: string[] = [];

  // Step 1: Get event configuration
  const eventResult = await sql`
    SELECT 
      registration_fee_per_dancer, solo_1_fee, solo_2_fee, solo_3_fee, solo_additional_fee,
      duo_trio_fee_per_dancer, group_fee_per_dancer, large_group_fee_per_dancer, currency
    FROM events
    WHERE id = ${eventId}
  ` as any[];

  if (!eventResult || eventResult.length === 0) {
    throw new Error(`Event ${eventId} not found`);
  }

  const event = eventResult[0];
  const eventConfig: EventFeeConfig = {
    registrationFeePerDancer: parseFloat(event.registration_fee_per_dancer) || 300,
    solo1Fee: parseFloat(event.solo_1_fee) || 400,
    solo2Fee: parseFloat(event.solo_2_fee) || 750,
    solo3Fee: parseFloat(event.solo_3_fee) || 1050,
    soloAdditionalFee: parseFloat(event.solo_additional_fee) || 100,
    duoTrioFeePerDancer: parseFloat(event.duo_trio_fee_per_dancer) || 280,
    groupFeePerDancer: parseFloat(event.group_fee_per_dancer) || 220,
    largeGroupFeePerDancer: parseFloat(event.large_group_fee_per_dancer) || 190,
    currency: event.currency || 'ZAR'
  };

  // Step 2: Check if registration was already CHARGED for this dancer/event
  // We check registration_charged_flag table OR existing entries
  let registrationCharged = false;
  
  // Check registration_charged_flag table first
  const registrationChargedResult = await sql`
    SELECT COUNT(*) as count
    FROM registration_charged_flags
    WHERE event_id = ${eventId}
    AND (dancer_id = ${dancerId} OR eodsa_id = ${eodsaId})
  ` as any[];

  if (registrationChargedResult && registrationChargedResult[0]?.count > 0) {
    registrationCharged = true;
  } else {
    // Fallback: Check if dancer has ANY entries for this event (paid or unpaid)
    const existingEntriesResult = await sql`
      SELECT COUNT(*) as count
      FROM event_entries
      WHERE event_id = ${eventId}
      AND (contestant_id = ${dancerId} OR eodsa_id = ${eodsaId})
      LIMIT 1
    ` as any[];

    registrationCharged = existingEntriesResult && existingEntriesResult[0]?.count > 0;
  }

  // Step 3: Count existing entries of the same type for this dancer/event
  let entryCount = 0;

  if (performanceType === 'Solo') {
    // For solo entries, count solo entries for this specific dancer
    // Solo entries have exactly 1 participant, and we need to check if this dancer is that participant
    const soloEntriesResult = await sql`
      SELECT COUNT(*) as count
      FROM event_entries
      WHERE event_id = ${eventId}
      AND performance_type = 'Solo'
      AND (
        contestant_id = ${dancerId} OR 
        eodsa_id = ${eodsaId} OR
        (participant_ids::text LIKE ${`%"${dancerId}"%`} OR participant_ids::text LIKE ${`%"${eodsaId}"%`})
      )
    ` as any[];

    entryCount = soloEntriesResult && soloEntriesResult[0] ? parseInt(soloEntriesResult[0].count) : 0;
  } else {
    // For duet/trio/group, count entries where this dancer is a participant
    // We need to check participant_ids array - dancer can be any participant
    const groupEntriesResult = await sql`
      SELECT COUNT(*) as count
      FROM event_entries
      WHERE event_id = ${eventId}
      AND performance_type = ${performanceType}
      AND (
        contestant_id = ${dancerId} OR 
        eodsa_id = ${eodsaId} OR
        (participant_ids::text LIKE ${`%"${dancerId}"%`} OR participant_ids::text LIKE ${`%"${eodsaId}"%`})
      )
    ` as any[];

    entryCount = groupEntriesResult && groupEntriesResult[0] ? parseInt(groupEntriesResult[0].count) : 0;
  }

  // Step 4: Calculate entry fee incrementally
  let entryFee = 0;
  let breakdown = '';

  if (performanceType === 'Solo') {
    // For solo entries, the solo number is: existing count + 1
    const soloNumber = entryCount + 1;
    entryFee = calculateSoloEntryFee(soloNumber, eventConfig);
    breakdown = `Solo entry #${soloNumber}: ${getSoloFeeBreakdown(soloNumber, eventConfig)}`;
  } else {
    // For duet/trio/group, fee is per participant
    entryFee = calculateNonSoloFee(performanceType, participantIds.length, eventConfig);
    breakdown = `${performanceType} with ${participantIds.length} participant(s): ${eventConfig.currency}${entryFee}`;
  }

  // Step 5: Calculate registration fee (only if not already charged)
  let registrationFee = 0;
  const registrationWasAlreadyCharged = registrationCharged;

  if (!registrationCharged) {
    registrationFee = eventConfig.registrationFeePerDancer || 0;
  }

  // Step 6: Calculate total and ensure it's never negative
  let totalFee = registrationFee + entryFee;
  
  if (totalFee < 0) {
    warnings.push(`Computed fee was negative (${totalFee}), correcting to 0. Manual review required.`);
    totalFee = 0;
    entryFee = Math.max(0, entryFee);
    registrationFee = Math.max(0, registrationFee);
  }

  // Step 7: Build breakdown string
  let fullBreakdown = '';
  if (registrationFee > 0) {
    fullBreakdown = `Registration fee: ${eventConfig.currency}${registrationFee} + ${breakdown}`;
  } else if (registrationWasAlreadyCharged) {
    fullBreakdown = `${breakdown} (Registration fee already charged)`;
  } else {
    fullBreakdown = breakdown;
  }

  return {
    registrationFee,
    entryFee,
    totalFee,
    registrationCharged: !registrationWasAlreadyCharged && registrationFee > 0,
    registrationWasAlreadyCharged,
    entryCount,
    breakdown: fullBreakdown,
    warnings
  };
}

/**
 * Get human-readable breakdown for solo pricing
 */
function getSoloFeeBreakdown(soloNumber: number, eventConfig: EventFeeConfig): string {
  const currency = eventConfig.currency === 'USD' ? '$' : 
                   eventConfig.currency === 'EUR' ? '€' : 
                   eventConfig.currency === 'GBP' ? '£' : 'R';
  
  // Ensure all fee values are defined with defaults
  const solo1Fee = eventConfig.solo1Fee ?? 400;
  const solo2Fee = eventConfig.solo2Fee ?? 750;
  const solo3Fee = eventConfig.solo3Fee ?? 1050;
  const soloAdditionalFee = eventConfig.soloAdditionalFee ?? 100;
  
  if (soloNumber === 1) {
    return `${currency}${solo1Fee} (1st solo)`;
  } else if (soloNumber === 2) {
    return `${currency}${solo2Fee} (2nd solo)`;
  } else if (soloNumber === 3) {
    return `${currency}${solo3Fee} (3rd solo)`;
  } else {
    return `${currency}${soloAdditionalFee} (${soloNumber}th solo)`;
  }
}

/**
 * Mark registration as charged for a dancer/event
 * This should be called when a payment is initiated (not necessarily completed)
 */
export async function markRegistrationCharged(
  eventId: string,
  dancerId: string,
  eodsaId: string
): Promise<void> {
  const sql = getSql();

  const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);

  // Insert or update registration_charged_flag
  await sql`
    INSERT INTO registration_charged_flags (id, event_id, dancer_id, eodsa_id, charged_at)
    VALUES (${id}, ${eventId}, ${dancerId}, ${eodsaId}, ${new Date().toISOString()})
    ON CONFLICT (event_id, eodsa_id) DO NOTHING
  `;
}

/**
 * Check if registration was charged for a dancer/event
 */
export async function isRegistrationCharged(
  eventId: string,
  dancerId: string,
  eodsaId: string
): Promise<boolean> {
  const sql = getSql();

  const result = await sql`
    SELECT COUNT(*) as count
    FROM registration_charged_flags
    WHERE event_id = ${eventId}
    AND (dancer_id = ${dancerId} OR eodsa_id = ${eodsaId})
  ` as any[];

  return result && result[0]?.count > 0;
}

