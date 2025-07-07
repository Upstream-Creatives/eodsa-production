import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function GET() {
  try {
    const assignments = await db.getAllJudgeAssignments();
    return NextResponse.json({
      success: true,
      assignments
    });
  } catch (error) {
    console.error('Error fetching judge assignments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch judge assignments' },
      { status: 500 }
    );
  }
} 