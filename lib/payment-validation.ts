/**
 * Payment Validation Helpers
 * 
 * Functions to validate payment amounts against computed incremental fees
 * and create transaction records for payment tracking.
 */

import { computeIncrementalFee, markRegistrationCharged } from './incremental-fee-calculator';
import { createTransactionRecord } from './transaction-records';
import { getSql } from './database';

export interface EntryFeeValidation {
  entryIndex: number;
  entry: any;
  computedFee: number;
  clientSentFee: number;
  registrationFee: number;
  entryFee: number;
  registrationCharged: boolean;
  registrationWasAlreadyCharged: boolean;
  entryCount: number;
  breakdown: string;
  warnings: string[];
  isValid: boolean;
  mismatchDetected: boolean;
  mismatchReason?: string;
}

export interface BatchValidationResult {
  totalComputedFee: number;
  totalClientSentFee: number;
  validations: EntryFeeValidation[];
  allValid: boolean;
  mismatchDetected: boolean;
  mismatchReason?: string;
}

/**
 * Validate fees for a batch of entries
 */
export async function validateBatchEntryFees(
  entries: any[],
  eventId: string,
  clientSentTotal: number
): Promise<BatchValidationResult> {
  const validations: EntryFeeValidation[] = [];
  let totalComputedFee = 0;

  // Track solo counts per dancer as we process entries
  // This is critical for batch additions where multiple solos are added at once
  const soloCountTracker: Map<string, number> = new Map(); // Map<eodsaId, currentSoloCount>

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    
    try {
      // For solo entries, we need to track the solo count as we process entries in the batch
      // This ensures that if 3 solos are added at once, they get solo numbers 1, 2, 3
      let existingSoloCount = 0;
      if (entry.performanceType === 'Solo') {
        const soloEodsaId = entry.eodsaId || (entry.participantIds && entry.participantIds[0]);
        if (soloEodsaId) {
          // Get existing count from database
          const initialFeeResult = await computeIncrementalFee({
            eventId,
            dancerId: entry.contestantId || entry.eodsaId,
            eodsaId: soloEodsaId,
            performanceType: 'Solo',
            participantIds: Array.isArray(entry.participantIds) ? entry.participantIds : [entry.participantIds],
            masteryLevel: entry.mastery
          });
          
          existingSoloCount = initialFeeResult.entryCount;
          
          // Add count from entries already processed in this batch
          const batchSoloCount = soloCountTracker.get(soloEodsaId) || 0;
          existingSoloCount += batchSoloCount;
          
          // Update tracker for next entry
          soloCountTracker.set(soloEodsaId, batchSoloCount + 1);
        }
      }

      // Compute incremental fee for this entry
      // For solo entries, we need to manually calculate based on the tracked solo count
      let feeResult;
      if (entry.performanceType === 'Solo' && existingSoloCount !== undefined) {
        // Manually calculate solo fee using the tracked count
        const { getSql } = await import('./database');
        const sql = getSql();
        
        // Get event config
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
        const eventConfig = {
          registrationFeePerDancer: parseFloat(event.registration_fee_per_dancer) || 300,
          solo1Fee: parseFloat(event.solo_1_fee) || 400,
          solo2Fee: parseFloat(event.solo_2_fee) || 200,
          solo3Fee: parseFloat(event.solo_3_fee) || 100,
          soloAdditionalFee: parseFloat(event.solo_additional_fee) || 100,
          duoTrioFeePerDancer: parseFloat(event.duo_trio_fee_per_dancer) || 280,
          groupFeePerDancer: parseFloat(event.group_fee_per_dancer) || 220,
          largeGroupFeePerDancer: parseFloat(event.large_group_fee_per_dancer) || 190,
          currency: event.currency || 'ZAR'
        };

        // Check registration charged status
        const soloEodsaId = entry.eodsaId || (entry.participantIds && entry.participantIds[0]);
        const registrationChargedResult = await sql`
          SELECT COUNT(*) as count
          FROM registration_charged_flags
          WHERE event_id = ${eventId}
          AND (dancer_id = ${entry.contestantId || entry.eodsaId} OR eodsa_id = ${soloEodsaId})
        ` as any[];

        let registrationCharged = false;
        if (registrationChargedResult && registrationChargedResult[0]?.count > 0) {
          registrationCharged = true;
        } else {
          const existingEntriesResult = await sql`
            SELECT COUNT(*) as count
            FROM event_entries
            WHERE event_id = ${eventId}
            AND (contestant_id = ${entry.contestantId || entry.eodsaId} OR eodsa_id = ${soloEodsaId})
            LIMIT 1
          ` as any[];
          registrationCharged = existingEntriesResult && existingEntriesResult[0]?.count > 0;
        }

        // Calculate solo fee based on solo number
        const soloNumber = existingSoloCount + 1;
        const { calculateSoloEntryFee } = await import('./pricing-utils');
        const entryFee = calculateSoloEntryFee(soloNumber, eventConfig);
        const registrationFee = registrationCharged ? 0 : eventConfig.registrationFeePerDancer;
        const totalFee = entryFee + registrationFee;

        feeResult = {
          registrationFee,
          entryFee,
          totalFee,
          registrationCharged: !registrationCharged && registrationFee > 0,
          registrationWasAlreadyCharged: registrationCharged,
          entryCount: existingSoloCount,
          breakdown: `Solo entry #${soloNumber}: ${eventConfig.currency}${entryFee}${registrationFee > 0 ? ` + Registration: ${eventConfig.currency}${registrationFee}` : ' (Registration already charged)'}`,
          warnings: []
        };
      } else {
        // For non-solo entries, use the standard computeIncrementalFee
        feeResult = await computeIncrementalFee({
          eventId,
          dancerId: entry.contestantId || entry.eodsaId,
          eodsaId: entry.eodsaId,
          performanceType: entry.performanceType as 'Solo' | 'Duet' | 'Trio' | 'Group',
          participantIds: Array.isArray(entry.participantIds) ? entry.participantIds : [entry.participantIds],
          masteryLevel: entry.mastery
        });
      }

      const clientSentFee = entry.calculatedFee || 0;
      const mismatchDetected = Math.abs(clientSentFee - feeResult.totalFee) > 0.01;
      const mismatchReason = mismatchDetected 
        ? `Entry ${i + 1}: Client sent ${clientSentFee}, computed ${feeResult.totalFee}, difference: ${Math.abs(clientSentFee - feeResult.totalFee)}`
        : undefined;

      validations.push({
        entryIndex: i,
        entry,
        computedFee: feeResult.totalFee,
        clientSentFee,
        registrationFee: feeResult.registrationFee,
        entryFee: feeResult.entryFee,
        registrationCharged: feeResult.registrationCharged,
        registrationWasAlreadyCharged: feeResult.registrationWasAlreadyCharged,
        entryCount: feeResult.entryCount,
        breakdown: feeResult.breakdown,
        warnings: feeResult.warnings,
        isValid: !mismatchDetected,
        mismatchDetected,
        mismatchReason
      });

      totalComputedFee += feeResult.totalFee;
    } catch (error: any) {
      console.error(`Error validating entry ${i + 1}:`, error);
      validations.push({
        entryIndex: i,
        entry,
        computedFee: 0,
        clientSentFee: entry.calculatedFee || 0,
        registrationFee: 0,
        entryFee: 0,
        registrationCharged: false,
        registrationWasAlreadyCharged: false,
        entryCount: 0,
        breakdown: '',
        warnings: [`Error computing fee: ${error.message}`],
        isValid: false,
        mismatchDetected: true,
        mismatchReason: `Error computing fee for entry ${i + 1}: ${error.message}`
      });
    }
  }

  // Check total mismatch
  const totalMismatchDetected = Math.abs(clientSentTotal - totalComputedFee) > 0.01;
  const totalMismatchReason = totalMismatchDetected
    ? `Total mismatch: Client sent ${clientSentTotal}, computed ${totalComputedFee}, difference: ${Math.abs(clientSentTotal - totalComputedFee)}`
    : undefined;

  return {
    totalComputedFee,
    totalClientSentFee: clientSentTotal,
    validations,
    allValid: validations.every(v => v.isValid) && !totalMismatchDetected,
    mismatchDetected: totalMismatchDetected || validations.some(v => v.mismatchDetected),
    mismatchReason: totalMismatchReason || validations.find(v => v.mismatchDetected)?.mismatchReason
  };
}

/**
 * Create transaction records for batch entries and mark registration as charged
 */
export async function createBatchTransactionRecords(
  entries: any[],
  eventId: string,
  paymentId: string,
  paymentMethod: 'payfast' | 'eft',
  clientSentTotal: number,
  computedTotal: number
): Promise<string[]> {
  const transactionIds: string[] = [];
  const sql = getSql();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    
    try {
      // Compute fee to get registration charged status
      const feeResult = await computeIncrementalFee({
        eventId,
        dancerId: entry.contestantId || entry.eodsaId,
        eodsaId: entry.eodsaId,
        performanceType: entry.performanceType as 'Solo' | 'Duet' | 'Trio' | 'Group',
        participantIds: Array.isArray(entry.participantIds) ? entry.participantIds : [entry.participantIds],
        masteryLevel: entry.mastery
      });

      // Mark registration as charged if this entry charges registration
      if (feeResult.registrationCharged) {
        await markRegistrationCharged(
          eventId,
          entry.contestantId || entry.eodsaId,
          entry.eodsaId
        );
      }

      // Create transaction record (entry_id will be set later when entry is created)
      const transactionId = await createTransactionRecord({
        entryId: undefined, // Will be set when entry is created
        eventId,
        dancerId: entry.contestantId || entry.eodsaId,
        eodsaId: entry.eodsaId,
        expectedAmount: feeResult.totalFee,
        amountPaid: 0, // Will be updated when payment completes
        registrationPaidFlag: false, // Will be updated when payment completes
        registrationChargedFlag: feeResult.registrationCharged,
        status: 'pending',
        paymentMethod,
        paymentReference: paymentId,
        clientSentTotal: entry.calculatedFee,
        computedTotal: feeResult.totalFee,
        mismatchDetected: Math.abs((entry.calculatedFee || 0) - feeResult.totalFee) > 0.01,
        mismatchReason: Math.abs((entry.calculatedFee || 0) - feeResult.totalFee) > 0.01
          ? `Entry ${i + 1}: Client sent ${entry.calculatedFee}, computed ${feeResult.totalFee}`
          : undefined
      });

      transactionIds.push(transactionId);
    } catch (error: any) {
      console.error(`Error creating transaction record for entry ${i + 1}:`, error);
    }
  }

  return transactionIds;
}

/**
 * Update transaction record with entry ID after entry is created
 */
export async function updateTransactionWithEntryId(
  transactionId: string,
  entryId: string
): Promise<void> {
  const sql = getSql();
  
  await sql`
    UPDATE transaction_records
    SET entry_id = ${entryId}
    WHERE id = ${transactionId}
  `;
}

