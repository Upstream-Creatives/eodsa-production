import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ performanceId: string; judgeId: string }> }
) {
  try {
    const { performanceId, judgeId } = await params;
    
    // Extract entry ID from performance ID (format: "nationals-{entryId}")
    const entryId = performanceId.replace('nationals-', '');

    // Get score for this judge and performance
    const score = await db.getNationalsScoreByJudgeAndPerformance(judgeId, entryId);

    return NextResponse.json({
      success: true,
      score
    });

  } catch (error) {
    console.error('Error fetching nationals score:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch score' },
      { status: 500 }
    );
  }
} 