import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

/**
 * Check if a dancer is qualified to enter an event
 * GET /api/events/[id]/check-qualification?dancerId=xxx
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const { searchParams } = new URL(request.url);
    const dancerId = searchParams.get('dancerId');

    if (!dancerId) {
      return NextResponse.json(
        { success: false, error: 'dancerId parameter is required' },
        { status: 400 }
      );
    }

    // Get event details
    const event = await db.getEventById(eventId);
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Check qualification requirements
    const eventType = (event as any).eventType || 'REGIONAL_EVENT';
    let qualificationRequired = (event as any).qualificationRequired ?? false;

    // Auto-enforce qualification for NATIONAL_EVENT
    if (!(event as any).eventType && event.name && event.name.toLowerCase().includes('national')) {
      qualificationRequired = true;
    }

    if (eventType === 'NATIONAL_EVENT' && !qualificationRequired) {
      qualificationRequired = true;
    }

    // If qualification not required, allow entry
    if (!qualificationRequired) {
      return NextResponse.json({
        success: true,
        qualified: true,
        message: 'No qualification required for this event'
      });
    }

    // Check qualification based on source
    const qualificationSource = (event as any).qualificationSource || 'REGIONAL';
    const minimumQualificationScore = (event as any).minimumQualificationScore || 75;

    let qualified = false;
    let reason = '';

    if (qualificationSource === 'REGIONAL') {
      qualified = await db.checkRegionalQualification(dancerId, minimumQualificationScore);
      if (!qualified) {
        reason = `You must qualify from a Regional Event with a minimum score of ${minimumQualificationScore}% to enter this event. Please participate in a Regional Event first.`;
      }
    } else if (qualificationSource === 'ANY_NATIONAL_LEVEL') {
      qualified = await db.checkNationalLevelQualification(
        dancerId,
        minimumQualificationScore || undefined
      );
      if (!qualified) {
        const scoreText = minimumQualificationScore 
          ? ` with a minimum score of ${minimumQualificationScore}%`
          : '';
        reason = `You must have participated in a National or Qualifier Event${scoreText} to enter this event.`;
      }
    } else if (qualificationSource === 'MANUAL') {
      qualified = await db.checkManualQualification(eventId, dancerId);
      if (!qualified) {
        reason = 'This event requires manual qualification. Please contact the event administrator.';
      }
    } else if (qualificationSource === 'CUSTOM') {
      qualified = false;
      reason = 'This event has custom qualification requirements. Please contact the event administrator for more information.';
    }

    return NextResponse.json({
      success: true,
      qualified,
      reason: qualified ? null : reason,
      qualificationSource,
      minimumQualificationScore
    });
  } catch (error: any) {
    console.error('Error checking qualification:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to check qualification' },
      { status: 500 }
    );
  }
}

