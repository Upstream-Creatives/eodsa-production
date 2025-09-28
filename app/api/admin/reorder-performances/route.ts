import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, performances } = body;

    if (!eventId || !performances || !Array.isArray(performances)) {
      return NextResponse.json(
        { error: 'Event ID and performances array are required' },
        { status: 400 }
      );
    }

    // Validate that all performances have required fields (Gabriel's requirement)
    for (const perf of performances) {
      if (!perf.id || typeof perf.performanceOrder !== 'number') {
        return NextResponse.json(
          { error: 'Each performance must have id and performanceOrder' },
          { status: 400 }
        );
      }
    }

    // GABRIEL'S REQUIREMENT: Update performance order only, keep item numbers locked
    let updateCount = 0;
    
    // We expect the incoming payload to include performance ids and new performance orders.
    // Update ONLY the performanceOrder, keeping itemNumber unchanged (locked after admin assignment).
    for (const perf of performances) {
      try {
        // Validate performanceOrder
        if (typeof perf.performanceOrder !== 'number' || perf.performanceOrder < 1) continue;

        // Update ONLY performance order, not itemNumber (Gabriel's requirement)
        await db.updatePerformanceOrder(perf.id, perf.performanceOrder);
        
        // Do NOT update event entry's itemNumber - that stays locked for judging reference

        updateCount++;
      } catch (error) {
        console.error(`Error updating performance order for ${perf.id}:`, error);
        // Continue with other updates even if one fails
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${updateCount} performances`,
      updatedCount: updateCount
    });

  } catch (error) {
    console.error('Error reordering performances:', error);
    return NextResponse.json(
      { error: 'Failed to reorder performances' },
      { status: 500 }
    );
  }
}
