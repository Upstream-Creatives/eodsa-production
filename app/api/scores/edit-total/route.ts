import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { scoreId, performanceId, judgeId, newTotal, editedBy, editedByName } = body;

    if (!scoreId || !performanceId || !judgeId || newTotal === undefined || !editedBy) {
      return NextResponse.json(
        { success: false, error: 'Score ID, performance ID, judge ID, new total, and editor ID are required' },
        { status: 400 }
      );
    }

    // Validate total
    if (newTotal < 0 || newTotal > 100) {
      return NextResponse.json(
        { success: false, error: 'Total score must be between 0 and 100' },
        { status: 400 }
      );
    }

    // Update the score total with audit logging
    await db.updateScoreTotalWithAudit(scoreId, performanceId, judgeId, newTotal, editedBy, editedByName);

    return NextResponse.json({
      success: true,
      message: 'Score total updated successfully'
    });
  } catch (error) {
    console.error('Error updating score total:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update score total' },
      { status: 500 }
    );
  }
}
