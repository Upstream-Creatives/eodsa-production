import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const performanceId = id;
    const { status } = await request.json();

    // Validate status
    const validStatuses = ['scheduled', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be one of: ' + validStatuses.join(', ') },
        { status: 400 }
      );
    }

    // Check if performance exists
    const allPerformances = await db.getAllPerformances();
    const performance = allPerformances.find(p => p.id === performanceId);
    
    if (!performance) {
      return NextResponse.json(
        { error: 'Performance not found' },
        { status: 404 }
      );
    }

    // Update performance status
    await db.updatePerformanceStatus(performanceId, status);

    return NextResponse.json({
      success: true,
      message: `Performance status updated to ${status}`,
      performance: {
        ...performance,
        status
      }
    });

  } catch (error) {
    console.error('Error updating performance status:', error);
    return NextResponse.json(
      { error: 'Failed to update performance status' },
      { status: 500 }
    );
  }
}


