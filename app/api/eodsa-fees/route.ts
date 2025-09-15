import { NextRequest, NextResponse } from 'next/server';
import { calculateEODSAFee } from '@/lib/types';
import { calculateSmartEODSAFee } from '@/lib/registration-fee-tracker';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const masteryLevel = searchParams.get('masteryLevel');
    const performanceType = searchParams.get('performanceType') as 'Solo' | 'Duet' | 'Trio' | 'Group';
    const numberOfParticipants = parseInt(searchParams.get('numberOfParticipants') || '1');
    const soloCount = parseInt(searchParams.get('soloCount') || '1');
    const includeRegistration = searchParams.get('includeRegistration') !== 'false';
    const participantIds = searchParams.get('participantIds')?.split(',').filter(Boolean) || [];
    
    if (!masteryLevel || !performanceType) {
      return NextResponse.json(
        { error: 'masteryLevel and performanceType are required' },
        { status: 400 }
      );
    }

    let feeBreakdown;
    
    // Use smart calculation if participant IDs are provided
    if (participantIds.length > 0) {
      feeBreakdown = await calculateSmartEODSAFee(
        masteryLevel,
        performanceType,
        participantIds,
        {
          soloCount
        }
      );
    } else {
      // Fallback to basic calculation
      feeBreakdown = calculateEODSAFee(
        masteryLevel,
        performanceType,
        numberOfParticipants,
        {
          soloCount,
          includeRegistration
        }
      );
    }
    
    return NextResponse.json({
      success: true,
      fees: feeBreakdown,
      details: {
        masteryLevel,
        performanceType,
        numberOfParticipants,
        soloCount: performanceType === 'Solo' ? soloCount : undefined,
        includeRegistration
      }
    });
  } catch (error) {
    console.error('Error calculating EODSA fees:', error);
    return NextResponse.json(
      { error: 'Failed to calculate fees' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      masteryLevel, 
      performanceType, 
      numberOfParticipants = 1, 
      soloCount = 1, 
      includeRegistration = true,
      participantIds = []
    } = body;
    
    if (!masteryLevel || !performanceType) {
      return NextResponse.json(
        { error: 'masteryLevel and performanceType are required' },
        { status: 400 }
      );
    }

    let feeBreakdown;
    
    // Use smart calculation if participant IDs are provided
    if (participantIds && participantIds.length > 0) {
      feeBreakdown = await calculateSmartEODSAFee(
        masteryLevel,
        performanceType,
        participantIds,
        {
          soloCount
        }
      );
    } else {
      // Fallback to basic calculation
      feeBreakdown = calculateEODSAFee(
        masteryLevel,
        performanceType,
        numberOfParticipants,
        {
          soloCount,
          includeRegistration
        }
      );
    }
    
    return NextResponse.json({
      success: true,
      fees: feeBreakdown,
      details: {
        masteryLevel,
        performanceType,
        numberOfParticipants,
        soloCount: performanceType === 'Solo' ? soloCount : undefined,
        includeRegistration
      }
    });
  } catch (error) {
    console.error('Error calculating EODSA fees:', error);
    return NextResponse.json(
      { error: 'Failed to calculate fees' },
      { status: 500 }
    );
  }
} 