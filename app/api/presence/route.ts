import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { performanceId, eventId, present, checkedInBy } = body;

    if (!performanceId || !eventId || typeof present !== 'boolean' || !checkedInBy) {
      return NextResponse.json(
        { success: false, error: 'Performance ID, Event ID, presence status, and checker ID are required' },
        { status: 400 }
      );
    }

    const result = await db.setPerformancePresence(performanceId, eventId, present, checkedInBy);

    return NextResponse.json({
      success: true,
      message: `Performance marked as ${present ? 'present' : 'absent'}`,
      result
    });
  } catch (error) {
    console.error('Error updating presence:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update presence status' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const performanceId = searchParams.get('performanceId');

    if (!performanceId) {
      return NextResponse.json(
        { success: false, error: 'Performance ID is required' },
        { status: 400 }
      );
    }

    const presence = await db.getPerformancePresence(performanceId);

    return NextResponse.json({
      success: true,
      presence
    });
  } catch (error) {
    console.error('Error fetching presence:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch presence status' },
      { status: 500 }
    );
  }
}

