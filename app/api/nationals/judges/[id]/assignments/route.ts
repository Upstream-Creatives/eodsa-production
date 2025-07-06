import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: judgeId } = await params;

    if (!judgeId) {
      return NextResponse.json(
        { success: false, error: 'Judge ID is required' },
        { status: 400 }
      );
    }

    // Get nationals judge assignments for this judge
    const assignments = await db.getNationalsJudgeAssignments(judgeId);

    return NextResponse.json({
      success: true,
      assignments
    });
  } catch (error) {
    console.error('Error fetching nationals judge assignments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch nationals judge assignments' },
      { status: 500 }
    );
  }
} 