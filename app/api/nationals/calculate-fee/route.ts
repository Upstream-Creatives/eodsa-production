import { NextRequest, NextResponse } from 'next/server';
import { unifiedDb } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.performanceType || body.participantCount === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: performanceType, participantCount' },
        { status: 400 }
      );
    }

    const {
      performanceType,
      soloCount = 1,
      participantCount = 1,
      participantIds = []
    } = body;

    // Calculate nationals fee using the unified database function
    const feeBreakdown = await unifiedDb.calculateNationalsFee(
      performanceType,
      soloCount,
      participantCount,
      participantIds
    );

    return NextResponse.json({
      success: true,
      feeBreakdown
    });

  } catch (error) {
    console.error('Error calculating nationals fee:', error);
    return NextResponse.json(
      { error: 'Failed to calculate nationals fee' },
      { status: 500 }
    );
  }
} 