import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ performanceId: string }> }
) {
  try {
    const { performanceId } = await params;

    if (!performanceId) {
      return NextResponse.json(
        { success: false, error: 'Performance ID is required' },
        { status: 400 }
      );
    }

    // Get all scores for this performance
    const scores = await db.getScoresByPerformance(performanceId);
    
    // Get the event ID for this performance to find assigned judges
    const performance = await db.getPerformanceById(performanceId);
    if (!performance) {
      return NextResponse.json(
        { success: false, error: 'Performance not found' },
        { status: 404 }
      );
    }

    // Get all judges assigned to this event
    const allAssignments = await db.getAllJudgeAssignments();
    const eventAssignments = allAssignments.filter(assignment => assignment.eventId === performance.eventId);
    const assignedJudgeIds = eventAssignments.map(assignment => assignment.judgeId);

    // Calculate scoring status
    const totalJudges = assignedJudgeIds.length;
    const scoredJudges = scores.length;
    const isFullyScored = scoredJudges >= totalJudges && totalJudges >= 3; // Require at least 3 judges and all must score
    const isPartiallyScored = scoredJudges > 0;

    // Get judge details who have scored
    const scoredJudgeIds = scores.map(score => score.judgeId);
    const pendingJudgeIds = assignedJudgeIds.filter(judgeId => !scoredJudgeIds.includes(judgeId));

    return NextResponse.json({
      success: true,
      performanceId,
      eventId: performance.eventId,
      scoringStatus: {
        totalJudges,
        scoredJudges,
        isFullyScored,
        isPartiallyScored,
        scoredJudgeIds,
        pendingJudgeIds,
        scores: scores.map(score => ({
          judgeId: score.judgeId,
          judgeName: score.judgeName,
          totalScore: score.technicalScore + score.musicalScore + score.performanceScore + score.stylingScore + score.overallImpressionScore,
          submittedAt: score.submittedAt
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching performance scoring status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch scoring status' },
      { status: 500 }
    );
  }
} 