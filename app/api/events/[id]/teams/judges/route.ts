import { NextResponse } from 'next/server';
import { getSql, initializeDatabase } from '@/lib/database';

// POST /api/events/[id]/teams/judges - Add judge to event
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Ensure database is initialized
  await initializeDatabase();
  
  const { id: eventId } = await params;
  let judgeId: string | undefined;
  try {
    const body = await request.json();
    judgeId = body.judgeId;
    const { assignedBy } = body;
    
    if (!judgeId || !assignedBy) {
      return NextResponse.json(
        { success: false, error: 'judgeId and assignedBy are required' },
        { status: 400 }
      );
    }
    
    const sqlClient = getSql();
    
    // Verify judge exists and is actually a judge
    const judgeResult = await sqlClient`
      SELECT id, name, role FROM judges WHERE id = ${judgeId}
    ` as any[];
    
    if (judgeResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Judge not found' },
        { status: 404 }
      );
    }
    
    if (judgeResult[0].role !== 'judge') {
      return NextResponse.json(
        { success: false, error: 'User is not a judge' },
        { status: 400 }
      );
    }
    
    // Check if already assigned
    const existingResult = await sqlClient`
      SELECT id FROM judge_event_assignments 
      WHERE judge_id = ${judgeId} 
        AND event_id = ${eventId} 
        AND (status = 'active' OR status IS NULL)
    ` as any[];
    
    if (existingResult.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Judge is already assigned to this event' },
        { status: 400 }
      );
    }
    
    // Get the event's numberOfJudges setting
    // First, ensure the column exists
    try {
      await sqlClient`
        ALTER TABLE events ADD COLUMN IF NOT EXISTS number_of_judges INTEGER DEFAULT 4
      `;
    } catch (alterError: any) {
      // Ignore if column already exists or other non-critical errors
      console.warn('Note: Could not ensure number_of_judges column exists:', alterError?.message);
    }
    
    // Try to get the event's numberOfJudges setting
    let maxJudges = 4; // Default to 4
    try {
      const eventResult = await sqlClient`
        SELECT number_of_judges FROM events WHERE id = ${eventId}
      ` as any[];
      
      if (eventResult.length > 0 && eventResult[0].number_of_judges != null) {
        maxJudges = parseInt(eventResult[0].number_of_judges, 10);
      }
    } catch (queryError: any) {
      // If column doesn't exist, use default of 4
      console.warn('Note: Could not query number_of_judges, using default of 4:', queryError?.message);
      maxJudges = 4;
    }
    
    // Check current judge count
    const currentCountResult = await sqlClient`
      SELECT COUNT(*) as count
      FROM judge_event_assignments
      WHERE event_id = ${eventId} 
        AND (status = 'active' OR status IS NULL)
    ` as any[];
    
    const currentCount = parseInt(currentCountResult[0]?.count || '0', 10);
    
    if (currentCount >= maxJudges) {
      return NextResponse.json(
        { success: false, error: `Maximum number of judges (${maxJudges}) has been reached for this event` },
        { status: 400 }
      );
    }
    
    // Get next display order
    const maxOrderResult = await sqlClient`
      SELECT COALESCE(MAX(display_order), 0) as max_order
      FROM judge_event_assignments
      WHERE event_id = ${eventId} AND (status = 'active' OR status IS NULL)
    ` as any[];
    
    const nextOrder = (maxOrderResult[0]?.max_order || 0) + 1;
    
    // Create assignment
    const assignmentId = `assignment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const assignedAt = new Date().toISOString();
    
    await sqlClient`
      INSERT INTO judge_event_assignments (
        id, judge_id, event_id, assigned_by, assigned_at, status, display_order
      )
      VALUES (
        ${assignmentId}, ${judgeId}, ${eventId}, ${assignedBy}, ${assignedAt}, 'active', ${nextOrder}
      )
    `;
    
    return NextResponse.json({
      success: true,
      assignment: {
        id: assignmentId,
        judgeId,
        eventId,
        assignedBy,
        assignedAt,
        displayOrder: nextOrder
      },
      message: 'Judge assigned successfully'
    });
  } catch (error: any) {
    console.error('Error assigning judge:', error);
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
      eventId,
      judgeId: judgeId || 'unknown'
    });
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to assign judge' },
      { status: 500 }
    );
  }
}

// DELETE /api/events/[id]/teams/judges?judgeId=xxx - Remove judge from event
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const { searchParams } = new URL(request.url);
    const judgeId = searchParams.get('judgeId');
    
    if (!judgeId) {
      return NextResponse.json(
        { success: false, error: 'judgeId is required' },
        { status: 400 }
      );
    }
    
    const sqlClient = getSql();
    
    // Check if judge has scored any performances for this event
    const scoreResult = await sqlClient`
      SELECT COUNT(*) as score_count
      FROM scores s
      JOIN performances p ON s.performance_id = p.id
      WHERE s.judge_id = ${judgeId}
        AND p.event_id = ${eventId}
    ` as any[];
    
    const scoreCount = parseInt(scoreResult[0]?.score_count || '0', 10);
    
    if (scoreCount > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot remove judge: This judge has already scored ${scoreCount} item(s) for this event. Judges with scores cannot be removed.` 
        },
        { status: 400 }
      );
    }
    
    // Remove assignment
    await sqlClient`
      DELETE FROM judge_event_assignments
      WHERE judge_id = ${judgeId} 
        AND event_id = ${eventId}
        AND (status = 'active' OR status IS NULL)
    `;
    
    return NextResponse.json({
      success: true,
      message: 'Judge removed from event successfully'
    });
  } catch (error) {
    console.error('Error removing judge:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove judge' },
      { status: 500 }
    );
  }
}


