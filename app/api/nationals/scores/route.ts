import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      performanceId, 
      judgeId, 
      technique, 
      musicality, 
      performance, 
      styling, 
      overallImpression, 
      comments 
    } = body;

    // Validate required fields
    if (!performanceId || !judgeId) {
      return NextResponse.json(
        { error: 'Performance ID and Judge ID are required' },
        { status: 400 }
      );
    }

    // Extract entry ID from performance ID (format: "nationals-{entryId}")
    const entryId = performanceId.replace('nationals-', '');

    // Check if score already exists for this judge and performance
    const existingScore = await db.getNationalsScoreByJudgeAndPerformance(judgeId, entryId);
    
    if (existingScore) {
      // Update existing score
      await db.updateNationalsScore(existingScore.id, {
        technicalScore: technique,
        musicalScore: musicality,
        performanceScore: performance,
        stylingScore: styling,
        overallImpressionScore: overallImpression,
        comments
      });
    } else {
      // Create new score
      await db.createNationalsScore({
        entryId,
        judgeId,
        technicalScore: technique,
        musicalScore: musicality,
        performanceScore: performance,
        stylingScore: styling,
        overallImpressionScore: overallImpression,
        comments
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Score submitted successfully'
    });

  } catch (error) {
    console.error('Error submitting nationals score:', error);
    return NextResponse.json(
      { error: 'Failed to submit score' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const performanceId = searchParams.get('performanceId');
    const judgeId = searchParams.get('judgeId');
    
    if (!performanceId || !judgeId) {
      return NextResponse.json(
        { error: 'Performance ID and Judge ID are required' },
        { status: 400 }
      );
    }

    // Extract entry ID from performance ID
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
      { error: 'Failed to fetch score' },
      { status: 500 }
    );
  }
} 