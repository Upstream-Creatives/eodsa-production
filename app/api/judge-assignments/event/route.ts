import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { judgeId, eventId, assignedBy } = body;

    if (!judgeId || !eventId || !assignedBy) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify the event exists
    const event = await db.getEventById(eventId);
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 400 }
      );
    }

    // Verify the judge exists
    const judge = await db.getJudgeById(judgeId);
    if (!judge) {
      return NextResponse.json(
        { success: false, error: 'Judge not found' },
        { status: 400 }
      );
    }

    // Create judge assignment for the specific event
    try {
      const assignment = await db.createJudgeEventAssignment({
        judgeId,
        eventId,
        assignedBy
      });

      console.log(`✅ Judge ${judge.name} assigned to event "${event.name}"`);

      return NextResponse.json({
        success: true,
        assignment,
        message: `Judge ${judge.name} assigned to event "${event.name}"`
      });
    } catch (error: any) {
      if (error.message.includes('already assigned')) {
        return NextResponse.json(
          { success: false, error: 'Judge is already assigned to this event' },
          { status: 400 }
        );
      }
      if (error.message.includes('maximum of 4 judges')) {
        return NextResponse.json(
          { success: false, error: 'This event already has the maximum of 4 judges assigned' },
          { status: 400 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error('Error creating judge assignment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create judge assignment' },
      { status: 500 }
    );
  }
} 