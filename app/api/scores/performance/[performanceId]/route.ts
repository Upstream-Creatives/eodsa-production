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

    // Get all scores for this performance with error handling
    let scores: any[] = [];
    try {
      scores = await db.getScoresByPerformance(performanceId);
    } catch (error) {
      console.error('Error fetching scores:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Database query failed while fetching scores',
          details: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
      );
    }
    
    // Get the event ID for this performance to find assigned judges with error handling
    let performance: any = null;
    try {
      performance = await db.getPerformanceById(performanceId);
    } catch (error) {
      console.error('Error fetching performance:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Database query failed while fetching performance',
          details: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
      );
    }

    if (!performance) {
      return NextResponse.json(
        { success: false, error: 'Performance not found' },
        { status: 404 }
      );
    }

    // Get all judges assigned to this event with error handling
    let allAssignments: any[] = [];
    try {
      allAssignments = await db.getAllJudgeAssignments();
    } catch (error) {
      console.error('Error fetching judge assignments:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Database query failed while fetching judge assignments',
          details: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
      );
    }

    const eventAssignments = allAssignments.filter(assignment => assignment.eventId === performance.eventId);
    const assignedJudgeIds = eventAssignments.map(assignment => assignment.judgeId);

    // Get all judges to get their names with error handling
    let allJudges: any[] = [];
    try {
      allJudges = await db.getAllJudges();
    } catch (error) {
      console.error('Error fetching judges:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Database query failed while fetching judges',
          details: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
      );
    }

    const judgeMap = new Map(allJudges.map(judge => [judge.id, { name: judge.name, email: judge.email }]));

    // Calculate scoring status
    const totalJudges = assignedJudgeIds.length;
    const scoredJudges = scores.length;
    const isFullyScored = scoredJudges >= totalJudges && totalJudges >= 3; // Require at least 3 judges and all must score
    const isPartiallyScored = scoredJudges > 0;

    // Get judge details who have scored
    const scoredJudgeIds = scores.map(score => score.judgeId);
    const pendingJudgeIds = assignedJudgeIds.filter(judgeId => !scoredJudgeIds.includes(judgeId));

    // Create pending judges list with names and emails
    const pendingJudges = pendingJudgeIds.map(judgeId => {
      const judgeInfo = judgeMap.get(judgeId);
      return {
        judgeId,
        judgeName: judgeInfo?.name || 'Unknown Judge',
        judgeEmail: judgeInfo?.email || ''
      };
    });

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
        pendingJudges, // Include judge names and emails for pending judges
        scores: scores.map(score => ({
          judgeId: score.judgeId,
          judgeName: score.judgeName,
          judgeEmail: score.judgeEmail,
          totalScore: score.technicalScore + score.musicalScore + score.performanceScore + score.stylingScore + score.overallImpressionScore,
          submittedAt: score.submittedAt
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching performance scoring status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch scoring status';
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        details: error instanceof Error ? error.stack : String(error)
      },
      { status: 500 }
    );
  }
} 