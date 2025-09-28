import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

// Update fields on a performance (currently supports music cue)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const performanceId = id;
    const body = await request.json();

    // Support music cue update: { musicCue: 'onstage' | 'offstage' }
    if (body.musicCue) {
      const value = body.musicCue;
      if (value !== 'onstage' && value !== 'offstage') {
        return NextResponse.json({ error: 'Invalid musicCue' }, { status: 400 });
      }
      await db.updatePerformanceMusicCue(performanceId, value);
      return NextResponse.json({ success: true, message: 'Music cue updated', musicCue: value });
    }

    return NextResponse.json({ error: 'No supported fields to update' }, { status: 400 });
  } catch (error) {
    console.error('Error updating performance:', error);
    return NextResponse.json({ error: 'Failed to update performance' }, { status: 500 });
  }
}

// Fetch a single performance by id
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const perf = await db.getPerformanceById(id);
    if (!perf) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, performance: perf });
  } catch (error) {
    console.error('Error fetching performance:', error);
    return NextResponse.json({ error: 'Failed to fetch performance' }, { status: 500 });
  }
}



