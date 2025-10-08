import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { judgeId, performanceId, technique, musicality, performance, styling, overallImpression, comments } = body;

    // Validate required fields
    if (!judgeId || !performanceId || technique === undefined || musicality === undefined || performance === undefined || styling === undefined || overallImpression === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate score ranges
    if (technique < 0 || technique > 20 || 
        musicality < 0 || musicality > 20 || 
        performance < 0 || performance > 20 ||
        styling < 0 || styling > 20 ||
        overallImpression < 0 || overallImpression > 20) {
      return NextResponse.json(
        { success: false, error: 'Scores must be between 0 and 20' },
        { status: 400 }
      );
    }

    // Check if this judge has already scored this performance
    const existingScore = await db.getScoreByJudgeAndPerformance(judgeId, performanceId);

    let score;
    if (existingScore) {
      // SECURITY: Prevent judges from editing submitted scores
      return NextResponse.json(
        { success: false, error: 'Score already submitted. Judges cannot edit submitted scores. Contact admin if changes are needed.' },
        { status: 403 }
      );
    } else {
      // Create new score
      score = await db.createScore({
        judgeId,
        performanceId,
        technicalScore: Number(technique),
        musicalScore: Number(musicality),
        performanceScore: Number(performance),
        stylingScore: Number(styling),
        overallImpressionScore: Number(overallImpression),
        comments: comments || ''
      });
      
      return NextResponse.json({ 
        success: true, 
        score,
        message: 'Score submitted successfully'
      });
    }
  } catch (error: any) {
    console.error('Error submitting score:', error);
    
    // Handle specific database errors with user-friendly messages
    if (error.message) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { success: false, error: 'Performance or judge not found' },
          { status: 404 }
        );
      }
      
      if (error.message.includes('FOREIGN KEY')) {
        return NextResponse.json(
          { success: false, error: 'Invalid judge or performance ID' },
          { status: 400 }
        );
      }
      
      if (error.message.includes('CHECK constraint') || error.message.includes('score')) {
        return NextResponse.json(
          { success: false, error: 'Invalid score values. Scores must be between 1 and 10' },
          { status: 400 }
        );
      }
      
      // Return the specific error message from the database layer
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to submit score' },
      { status: 500 }
    );
  }
} 