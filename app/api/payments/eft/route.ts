import { NextRequest, NextResponse } from 'next/server';
import { ensureAuditionSchema, getSql } from '@/lib/database';
import { validateBatchEntryFees, createBatchTransactionRecords, prepareEntriesForBatchCreation, markBatchRegistrationCharged } from '@/lib/payment-validation';
import {
  findExistingEntryIdForLine,
  countEntriesForEftInvoice,
  parseParticipantIds,
  batchEntryFingerprint,
} from '@/lib/entry-dedup';

export async function POST(request: NextRequest) {
  try {
    await ensureAuditionSchema();
    const body = await request.json();
    const {
      eventId,
      userId,
      userEmail,
      userName,
      eodsaId,
      amount,
      invoiceNumber,
      itemDescription,
      entries,
      submitImmediately
    } = body;

    console.log('🏦 Processing EFT payment submission:', {
      userName,
      userEmail,
      eodsaId,
      amount,
      invoiceNumber,
      entriesCount: entries?.length
    });

    const sqlClient = getSql();
    const paymentLogId = Date.now().toString();
    let createdCount = 0;

    // SAFETY CHECK: Validate fees before processing
    let computedTotal = amount || 0;
    let validationResult = null;
    
    if (entries && entries.length > 0) {
      // Validate each entry's fee against computed incremental fee
      validationResult = await validateBatchEntryFees(
        entries,
        eventId,
        amount || 0
      );

      computedTotal = validationResult.totalComputedFee;

      // Check for mismatch - log warning but use backend's computed total (source of truth)
      if (validationResult.mismatchDetected) {
        console.warn(' Fee mismatch detected - using backend computed total:', {
          clientSentTotal: amount,
          computedTotal: validationResult.totalComputedFee,
          mismatchReason: validationResult.mismatchReason,
          validations: validationResult.validations.map(v => ({
            entryIndex: v.entryIndex,
            itemName: v.entry.itemName,
            clientSent: v.clientSentFee,
            computed: v.computedFee,
            registrationFee: v.registrationFee,
            entryFee: v.entryFee,
            mismatch: v.mismatchDetected
          }))
        });
        
        // Use backend's computed total (source of truth)
        // This handles cases where registration was already charged or entry fees differ
        computedTotal = validationResult.totalComputedFee;
      } else {
        // Use computed total instead of client-sent amount
        computedTotal = validationResult.totalComputedFee;
      }
    }

    // Create transaction records BEFORE creating entries
    let transactionIds: string[] = [];
    if (entries && entries.length > 0) {
      try {
        const paymentReference = invoiceNumber || `EFT_${Date.now()}`;
        transactionIds = await createBatchTransactionRecords(
          entries,
          eventId,
          paymentReference,
          'eft',
          amount || 0,
          computedTotal
        );
        console.log(` Created ${transactionIds.length} transaction records for EFT payment`);
      } catch (error) {
        console.error(' Failed to create transaction records, but continuing with EFT submission:', error);
      }
    }

    if (submitImmediately && entries && entries.length > 0) {
      // Block duplicate EFT submission (double-click / resubmit same invoice)
      if (invoiceNumber?.trim()) {
        const existingForInvoice = await countEntriesForEftInvoice(eventId, invoiceNumber);
        if (existingForInvoice >= entries.length) {
          console.warn(' EFT duplicate submission blocked — entries already exist for invoice:', invoiceNumber);
          return NextResponse.json({
            success: true,
            message: 'Entries already submitted for this invoice reference.',
            paymentId: paymentLogId,
            entriesSubmitted: 0,
            duplicateBlocked: true,
            computedTotal,
            clientSentTotal: amount,
          });
        }
      }

      let entriesToInsert = entries;
      let registrationCharges: Array<{ eodsaId: string; dancerId: string }> = [];
      try {
        const prepared = await prepareEntriesForBatchCreation(entries, eventId);
        entriesToInsert = prepared.entries;
        registrationCharges = prepared.newlyCharged;
      } catch (prepError) {
        console.warn(' Could not enrich EFT entries with registration fees:', prepError);
      }

      // Submit all entries to the database immediately with pending payment status
      for (let i = 0; i < entriesToInsert.length; i++) {
        const entry = entriesToInsert[i];
        const participantIds = parseParticipantIds(entry.participantIds);

        const lineExtras = {
          clientLineId: entry.clientLineId,
          itemStyle: entry.itemStyle,
          choreographer: entry.choreographer,
          performanceType: entry.performanceType,
        };
        const existingEntryId = await findExistingEntryIdForLine(
          entry.eventId,
          entry.itemName,
          participantIds,
          lineExtras
        );
        if (existingEntryId) {
          console.warn(` Skipping duplicate EFT line: ${entry.itemName} (existing ${existingEntryId})`);
          continue;
        }

        const entryId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        const entryLineKey = batchEntryFingerprint(entry.itemName, participantIds, lineExtras);
        
        try {
          await sqlClient`
            INSERT INTO event_entries (
              id, event_id, contestant_id, eodsa_id, participant_ids, calculated_fee, 
              payment_status, payment_method, payment_reference, submitted_at, 
              approved, qualified_for_nationals, item_number, item_name, choreographer, mastery, 
              item_style, estimated_duration, entry_type, music_file_url, music_file_name, 
              video_file_url, video_file_name, video_external_url, video_external_type, performance_type,
              entry_line_key, suitability_statement
            )
            VALUES (
              ${entryId}, ${entry.eventId}, ${entry.contestantId}, ${entry.eodsaId}, 
              ${JSON.stringify(entry.participantIds)}, ${entry.calculatedFee}, 
              'pending', 'eft', ${invoiceNumber}, ${new Date().toISOString()}, 
              false, true, ${entry.itemNumber || null}, ${entry.itemName}, ${entry.choreographer}, ${entry.mastery}, 
              ${entry.itemStyle}, ${entry.estimatedDuration}, ${entry.entryType || 'live'}, 
              ${entry.musicFileUrl || null}, ${entry.musicFileName || null}, 
              ${entry.videoFileUrl || null}, ${entry.videoFileName || null},
              ${entry.videoExternalUrl || null}, ${entry.videoExternalType || null},
              ${entry.performanceType || null}, ${entryLineKey}, ${entry.suitabilityStatement || null}
            )
          `;

          // Update transaction record with entry ID
          if (transactionIds[i]) {
            await sqlClient`
              UPDATE transaction_records
              SET entry_id = ${entryId}
              WHERE id = ${transactionIds[i]}
            `;
          }

          createdCount++;
          console.log(` Entry ${entryId} created successfully for EFT payment`);
        } catch (dbError: any) {
          if (dbError?.code === '23505') {
            console.warn(` Skipping duplicate EFT line: ${entry.itemName}`);
            continue;
          }
          console.error(` Failed to create entry ${entryId}:`, dbError);
          throw new Error(`Failed to submit entry: ${entry.itemName}`);
        }
      }

      if (registrationCharges.length > 0) {
        try {
          await markBatchRegistrationCharged(eventId, registrationCharges);
        } catch (regError) {
          console.warn(' Failed to mark registration charged for EFT batch:', regError);
        }
      }
    }

    // Log the EFT payment attempt
    try {
      // Determine registration_paid status - for EFT, it's only paid after admin verification
      // But we can check if registration was charged
      const registrationCharged = validationResult?.validations.some(v => v.registrationCharged) || false;
      
      await sqlClient`
        INSERT INTO eft_payment_logs (
          id, user_id, user_email, user_name, eodsa_id, amount, 
          invoice_number, item_description, entries_count, submitted_at, status,
          registration_paid
        )
        VALUES (
          ${paymentLogId}, ${userId}, ${userEmail}, ${userName}, ${eodsaId}, 
          ${computedTotal}, ${invoiceNumber}, ${itemDescription}, ${entries?.length || 0}, 
          ${new Date().toISOString()}, 'pending_verification',
          false
        )
      `;
    } catch (logError) {
      console.warn('Failed to log EFT payment, but continuing:', logError);
      // Don't fail the main process if logging fails
    }

    console.log(' EFT payment processed successfully');

    return NextResponse.json({
      success: true,
      message: 'EFT payment submitted successfully. Entries are now pending payment verification.',
      paymentId: paymentLogId,
      entriesSubmitted: createdCount || entries?.length || 0,
      computedTotal: computedTotal, // Return computed total for frontend display
      clientSentTotal: amount // Return original client-sent total for reference
    });

  } catch (error: any) {
    console.error(' EFT payment processing error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to process EFT payment submission' 
      },
      { status: 500 }
    );
  }
}
