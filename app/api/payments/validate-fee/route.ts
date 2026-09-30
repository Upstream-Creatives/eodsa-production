/**
 * Payment Fee Validation API
 * POST /api/payments/validate-fee
 * 
 * Validates that the client-sent fee matches the server-computed incremental fee.
 * This endpoint should be called before initiating payment to ensure fee accuracy.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';
import { calculateEventPricing, getFixedEntryPrice, getParticipantCount, resolveEventRegistrationFee } from '@/lib/event-pricing';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, eodsaId, performanceType, participantIds, clientSentTotal } = body;

    // Validate required fields
    if (!eventId || !eodsaId || !performanceType || !participantIds) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: eventId, eodsaId, performanceType, participantIds'
      }, { status: 400 });
    }
    const sql = getSql();
    const [event] = await sql`
      SELECT solo_price, duet_price, group_price, discount_enabled, discount_min_entries, discount_amount,
             registration_fee, registration_fee_per_dancer, event_type, audition_payment_type, audition_flat_fee
      FROM events
      WHERE id = ${eventId}
    ` as any[];
    if (!event) throw new Error(`Event ${eventId} not found`);

    if (event.event_type === 'AUDITION_EVENT') {
      const flat = event.audition_payment_type === 'paid' ? Number(event.audition_flat_fee) || 0 : 0;
      const difference = clientSentTotal !== undefined ? Math.abs(clientSentTotal - flat) : 0;
      const mismatchDetected = clientSentTotal !== undefined && difference > 0.01;
      return NextResponse.json({
        success: true,
        computedFee: flat,
        registrationFee: 0,
        entryFee: flat,
        registrationCharged: false,
        registrationWasAlreadyCharged: true,
        entryCount: Array.isArray(participantIds) ? participantIds.length : 1,
        breakdown: flat > 0 ? `Audition flat fee ${flat}` : 'Free audition',
        warnings: [],
        mismatchDetected,
        mismatchReason: mismatchDetected ? `Client sent ${clientSentTotal}, computed ${flat}` : undefined,
        isValid: !mismatchDetected
      });
    }

    const registrationFeePerDancer = resolveEventRegistrationFee(event);

    const normalizedParticipantIds = Array.isArray(participantIds) ? participantIds : [participantIds];
    const alreadyRegistered: string[] = [];
    for (const pid of normalizedParticipantIds) {
      const existing = await sql`
        SELECT id FROM event_entries
        WHERE event_id = ${eventId}
        AND (
          eodsa_id = ${pid}
          OR participant_ids::text LIKE ${`%${pid}%`}
        )
        LIMIT 1
      ` as any[];
      if (existing.length > 0) alreadyRegistered.push(pid);
    }

    let existingSoloCountByDancer: Record<string, number> = {};
    const primaryId = normalizedParticipantIds[0];
    if (primaryId && (performanceType || '').toLowerCase() === 'solo') {
      const likePattern = `%${primaryId}%`;
      const [cntRow] = await sql`
        SELECT COUNT(*)::int AS c
        FROM event_entries
        WHERE event_id = ${eventId}
        AND LOWER(TRIM(COALESCE(performance_type, ''))) = 'solo'
        AND (
          eodsa_id = ${primaryId}
          OR participant_ids::text LIKE ${likePattern}
        )
      ` as any[];
      existingSoloCountByDancer = { [primaryId]: cntRow?.c ?? 0 };
    }

    const feeResult = calculateEventPricing([{
      performanceType,
      participantIds: normalizedParticipantIds,
      eodsaId
    }], {
      soloPrice: event.solo_price,
      duetPrice: event.duet_price,
      groupPrice: event.group_price,
      discountEnabled: event.discount_enabled,
      discountMinEntries: event.discount_min_entries,
      discountAmount: event.discount_amount,
      registrationFee: registrationFeePerDancer
    }, alreadyRegistered, existingSoloCountByDancer);

    // Check for mismatch
    let mismatchDetected = false;
    let mismatchReason = '';

    if (clientSentTotal !== undefined) {
      const difference = Math.abs(clientSentTotal - feeResult.total);
      if (difference > 0.01) { // Allow for small floating point differences
        mismatchDetected = true;
        mismatchReason = `Client sent ${clientSentTotal}, computed ${feeResult.total}, difference: ${difference}`;
      }
    }

    return NextResponse.json({
      success: true,
      computedFee: feeResult.total,
      registrationFee: feeResult.registrationTotal,
      entryFee: getFixedEntryPrice(
        performanceType,
        {
          soloPrice: event.solo_price,
          duetPrice: event.duet_price,
          groupPrice: event.group_price,
        },
        getParticipantCount({ performanceType, participantIds: normalizedParticipantIds, eodsaId })
      ),
      registrationCharged: feeResult.registrationTotal > 0,
      registrationWasAlreadyCharged: feeResult.registrationTotal === 0,
      entryCount: normalizedParticipantIds.length,
      breakdown: `${performanceType} pricing (per dancer for duet/trio/group)`,
      warnings: [],
      mismatchDetected,
      mismatchReason: mismatchDetected ? mismatchReason : undefined,
      isValid: !mismatchDetected
    });

  } catch (error: any) {
    console.error('Fee validation error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to validate fee'
    }, { status: 500 });
  }
}

