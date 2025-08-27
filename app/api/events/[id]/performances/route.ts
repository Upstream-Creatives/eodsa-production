import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    // Get performances for the event using the database method
    const performances = await db.getPerformancesByEvent(id);

    return NextResponse.json({
      success: true,
      performances,
      count: performances.length
    });

  } catch (error) {
    console.error('Error fetching event performances:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event performances' },
      { status: 500 }
    );
  }
} 