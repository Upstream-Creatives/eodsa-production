import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { scoreId, performanceId, judgeId, score, editedBy, editedByName } = body;

    if (!scoreId || !performanceId || !judgeId || !score || !editedBy) {
      return NextResponse.json(
        { success: false, error: 'Score ID, performance ID, judge ID, editor ID, and score data are required' },
        { status: 400 }
      );
    }

    // Validate score values
    const { technicalScore, musicalScore, performanceScore, stylingScore, overallImpressionScore } = score;

    if ([technicalScore, musicalScore, performanceScore, stylingScore, overallImpressionScore].some(s => s < 0 || s > 20)) {
      return NextResponse.json(
        { success: false, error: 'All scores must be between 0 and 20' },
        { status: 400 }
      );
    }

    // Update the score with audit logging
    await db.updateScoreWithAudit(scoreId, performanceId, judgeId, score, editedBy, editedByName);

    return NextResponse.json({
      success: true,
      message: 'Score updated successfully'
    });
  } catch (error) {
    console.error('Error updating score:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update score' },
      { status: 500 }
    );
  }
}
