/**
 * Transaction Records Management
 * 
 * This module handles creation and management of transaction records
 * that track payment details including expected amounts, paid amounts,
 * registration flags, and mismatch detection.
 */

import { getSql } from './database';

export interface CreateTransactionRecordOptions {
  entryId?: string;
  eventId: string;
  dancerId?: string;
  eodsaId: string;
  expectedAmount: number;
  amountPaid?: number;
  registrationPaidFlag?: boolean;
  registrationChargedFlag: boolean;
  status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded';
  paymentMethod: 'payfast' | 'eft' | 'credit_card' | 'bank_transfer' | 'invoice';
  paymentReference?: string;
  clientSentTotal?: number;
  computedTotal: number;
  mismatchDetected?: boolean;
  mismatchReason?: string;
}

/**
 * Create a transaction record
 */
export async function createTransactionRecord(
  options: CreateTransactionRecordOptions
): Promise<string> {
  const sql = getSql();
  const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
  const now = new Date().toISOString();

  // Check for mismatch
  let mismatchDetected = options.mismatchDetected || false;
  let mismatchReason = options.mismatchReason;

  if (options.clientSentTotal !== undefined && options.computedTotal !== undefined) {
    const difference = Math.abs(options.clientSentTotal - options.computedTotal);
    if (difference > 0.01) { // Allow for small floating point differences
      mismatchDetected = true;
      mismatchReason = `Client sent ${options.clientSentTotal}, computed ${options.computedTotal}, difference: ${difference}`;
    }
  }

  await sql`
    INSERT INTO transaction_records (
      id, entry_id, event_id, dancer_id, eodsa_id,
      expected_amount, amount_paid, registration_paid_flag, registration_charged_flag,
      status, payment_method, payment_reference,
      client_sent_total, computed_total, mismatch_detected, mismatch_reason,
      created_at, updated_at
    )
    VALUES (
      ${id}, ${options.entryId || null}, ${options.eventId}, 
      ${options.dancerId || null}, ${options.eodsaId},
      ${options.expectedAmount}, ${options.amountPaid || 0}, 
      ${options.registrationPaidFlag || false}, ${options.registrationChargedFlag},
      ${options.status}, ${options.paymentMethod}, ${options.paymentReference || null},
      ${options.clientSentTotal || null}, ${options.computedTotal},
      ${mismatchDetected}, ${mismatchReason || null},
      ${now}, ${now}
    )
  `;

  // Log mismatch for admin review
  if (mismatchDetected) {
    console.error(`⚠️ PAYMENT MISMATCH DETECTED:`, {
      transactionId: id,
      eventId: options.eventId,
      eodsaId: options.eodsaId,
      clientSentTotal: options.clientSentTotal,
      computedTotal: options.computedTotal,
      reason: mismatchReason
    });
  }

  return id;
}

/**
 * Update transaction record status
 */
export async function updateTransactionRecord(
  transactionId: string,
  updates: {
    status?: 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded';
    amountPaid?: number;
    registrationPaidFlag?: boolean;
    paymentReference?: string;
  }
): Promise<void> {
  const sql = getSql();
  const now = new Date().toISOString();

  const updateFields: string[] = [];
  const values: any[] = [];

  if (updates.status !== undefined) {
    updateFields.push('status');
    values.push(updates.status);
  }
  if (updates.amountPaid !== undefined) {
    updateFields.push('amount_paid');
    values.push(updates.amountPaid);
  }
  if (updates.registrationPaidFlag !== undefined) {
    updateFields.push('registration_paid_flag');
    values.push(updates.registrationPaidFlag);
  }
  if (updates.paymentReference !== undefined) {
    updateFields.push('payment_reference');
    values.push(updates.paymentReference);
  }

  if (updateFields.length === 0) {
    return;
  }

  // Build dynamic UPDATE query using conditional logic with tagged template
  // Since neon uses tagged templates, we need to build the query conditionally
  updateFields.push('updated_at');
  values.push(now);
  values.push(transactionId);

  // Build the query conditionally based on which fields are present
  // Use conditional logic to construct the SET clause with all possible combinations
  const hasStatus = updateFields.includes('status');
  const hasAmountPaid = updateFields.includes('amount_paid');
  const hasPaymentReference = updateFields.includes('payment_reference');
  const hasRegistrationPaidFlag = updateFields.includes('registration_paid_flag');

  // Build SET clause parts
  const setParts: string[] = [];
  if (hasStatus) setParts.push('status');
  if (hasAmountPaid) setParts.push('amount_paid');
  if (hasPaymentReference) setParts.push('payment_reference');
  if (hasRegistrationPaidFlag) setParts.push('registration_paid_flag');
  setParts.push('updated_at');

  // Execute based on combination - handle all 16 possible combinations
  if (hasStatus && hasAmountPaid && hasPaymentReference && hasRegistrationPaidFlag) {
    await sql`
      UPDATE transaction_records 
      SET status = ${updates.status}, 
          amount_paid = ${updates.amountPaid}, 
          payment_reference = ${updates.paymentReference}, 
          registration_paid_flag = ${updates.registrationPaidFlag}, 
          updated_at = ${now}
      WHERE id = ${transactionId}
    `;
  } else if (hasStatus && hasAmountPaid && hasPaymentReference) {
    await sql`
      UPDATE transaction_records 
      SET status = ${updates.status}, 
          amount_paid = ${updates.amountPaid}, 
          payment_reference = ${updates.paymentReference}, 
          updated_at = ${now}
      WHERE id = ${transactionId}
    `;
  } else if (hasStatus && hasAmountPaid && hasRegistrationPaidFlag) {
    await sql`
      UPDATE transaction_records 
      SET status = ${updates.status}, 
          amount_paid = ${updates.amountPaid}, 
          registration_paid_flag = ${updates.registrationPaidFlag}, 
          updated_at = ${now}
      WHERE id = ${transactionId}
    `;
  } else if (hasStatus && hasPaymentReference && hasRegistrationPaidFlag) {
    await sql`
      UPDATE transaction_records 
      SET status = ${updates.status}, 
          payment_reference = ${updates.paymentReference}, 
          registration_paid_flag = ${updates.registrationPaidFlag}, 
          updated_at = ${now}
      WHERE id = ${transactionId}
    `;
  } else if (hasAmountPaid && hasPaymentReference && hasRegistrationPaidFlag) {
    await sql`
      UPDATE transaction_records 
      SET amount_paid = ${updates.amountPaid}, 
          payment_reference = ${updates.paymentReference}, 
          registration_paid_flag = ${updates.registrationPaidFlag}, 
          updated_at = ${now}
      WHERE id = ${transactionId}
    `;
  } else if (hasStatus && hasAmountPaid) {
    await sql`
      UPDATE transaction_records 
      SET status = ${updates.status}, 
          amount_paid = ${updates.amountPaid}, 
          updated_at = ${now}
      WHERE id = ${transactionId}
    `;
  } else if (hasStatus && hasPaymentReference) {
    await sql`
      UPDATE transaction_records 
      SET status = ${updates.status}, 
          payment_reference = ${updates.paymentReference}, 
          updated_at = ${now}
      WHERE id = ${transactionId}
    `;
  } else if (hasStatus && hasRegistrationPaidFlag) {
    await sql`
      UPDATE transaction_records 
      SET status = ${updates.status}, 
          registration_paid_flag = ${updates.registrationPaidFlag}, 
          updated_at = ${now}
      WHERE id = ${transactionId}
    `;
  } else if (hasAmountPaid && hasPaymentReference) {
    await sql`
      UPDATE transaction_records 
      SET amount_paid = ${updates.amountPaid}, 
          payment_reference = ${updates.paymentReference}, 
          updated_at = ${now}
      WHERE id = ${transactionId}
    `;
  } else if (hasAmountPaid && hasRegistrationPaidFlag) {
    await sql`
      UPDATE transaction_records 
      SET amount_paid = ${updates.amountPaid}, 
          registration_paid_flag = ${updates.registrationPaidFlag}, 
          updated_at = ${now}
      WHERE id = ${transactionId}
    `;
  } else if (hasPaymentReference && hasRegistrationPaidFlag) {
    await sql`
      UPDATE transaction_records 
      SET payment_reference = ${updates.paymentReference}, 
          registration_paid_flag = ${updates.registrationPaidFlag}, 
          updated_at = ${now}
      WHERE id = ${transactionId}
    `;
  } else if (hasStatus) {
    await sql`
      UPDATE transaction_records 
      SET status = ${updates.status}, 
          updated_at = ${now}
      WHERE id = ${transactionId}
    `;
  } else if (hasAmountPaid) {
    await sql`
      UPDATE transaction_records 
      SET amount_paid = ${updates.amountPaid}, 
          updated_at = ${now}
      WHERE id = ${transactionId}
    `;
  } else if (hasPaymentReference) {
    await sql`
      UPDATE transaction_records 
      SET payment_reference = ${updates.paymentReference}, 
          updated_at = ${now}
      WHERE id = ${transactionId}
    `;
  } else if (hasRegistrationPaidFlag) {
    await sql`
      UPDATE transaction_records 
      SET registration_paid_flag = ${updates.registrationPaidFlag}, 
          updated_at = ${now}
      WHERE id = ${transactionId}
    `;
  }
}

/**
 * Get transaction records with mismatches (for admin alerts)
 */
export async function getMismatchTransactions(): Promise<any[]> {
  const sql = getSql();

  const results = await sql`
    SELECT 
      id, entry_id, event_id, eodsa_id,
      expected_amount, amount_paid, client_sent_total, computed_total,
      mismatch_reason, status, payment_method, created_at
    FROM transaction_records
    WHERE mismatch_detected = true
    ORDER BY created_at DESC
    LIMIT 100
  ` as any[];

  return results;
}

/**
 * Get transaction record by entry ID
 */
export async function getTransactionByEntryId(entryId: string): Promise<any | null> {
  const sql = getSql();

  const results = await sql`
    SELECT *
    FROM transaction_records
    WHERE entry_id = ${entryId}
    ORDER BY created_at DESC
    LIMIT 1
  ` as any[];

  return results && results.length > 0 ? results[0] : null;
}

