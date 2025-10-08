import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eodsaId = searchParams.get('eodsaId');

    if (!eodsaId) {
      return NextResponse.json(
        { success: false, error: 'EODSA ID is required' },
        { status: 400 }
      );
    }

    // Get all performances for this dancer's entries
    const scores = await db.getDancerScores(eodsaId);

    return NextResponse.json({
      success: true,
      scores
    });
  } catch (error) {
    console.error('Error fetching dancer scores:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch scores' },
      { status: 500 }
    );
  }
}
