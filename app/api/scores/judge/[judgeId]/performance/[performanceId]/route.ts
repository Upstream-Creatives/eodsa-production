import { NextResponse } from 'next/server';
import { db as database, initializeDatabase } from '@/lib/database';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ judgeId: string; performanceId: string }> }
) {
  try {
    const { judgeId, performanceId } = await params;

    if (!judgeId || !performanceId) {
      return NextResponse.json(
        { success: false, error: 'Judge ID and Performance ID are required' },
        { status: 400 }
      );
    }

    const score = await database.getScoreByJudgeAndPerformance(judgeId, performanceId);

    return NextResponse.json({
      success: true,
      score
    });
  } catch (error) {
    console.error('Error fetching score:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch score' },
      { status: 500 }
    );
  }
} 