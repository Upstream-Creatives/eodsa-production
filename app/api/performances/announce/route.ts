import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { performanceId, announcedBy, note } = body;

    if (!performanceId || !announcedBy) {
      return NextResponse.json(
        { success: false, error: 'Performance ID and announcer ID are required' },
        { status: 400 }
      );
    }

    const result = await db.markPerformanceAnnounced(performanceId, announcedBy, note);

    return NextResponse.json({
      success: true,
      message: 'Performance marked as announced',
      result
    });
  } catch (error) {
    console.error('Error marking performance as announced:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to mark performance as announced' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'Event ID is required' },
        { status: 400 }
      );
    }

    const announced = await db.getAnnouncedPerformances(eventId);

    return NextResponse.json({
      success: true,
      announced
    });
  } catch (error) {
    console.error('Error fetching announced performances:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch announced performances' },
      { status: 500 }
    );
  }
}

