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

    // Validate that all performances have required fields
    for (const perf of performances) {
      if (!perf.id || typeof perf.itemNumber !== 'number') {
        return NextResponse.json(
          { error: 'Each performance must have id and itemNumber' },
          { status: 400 }
        );
      }
    }

    // Update item numbers for all performances
    let updateCount = 0;
    
    for (const performance of performances) {
      try {
        // Update both event_entries and performances tables
        await db.updateEventEntry(performance.id, { 
          itemNumber: performance.itemNumber 
        });

        // Also update the corresponding performance record
        const allPerformances = await db.getAllPerformances();
        const performanceRecord = allPerformances.find(p => p.eventEntryId === performance.id);
        
        if (performanceRecord) {
          await db.updatePerformanceItemNumber(performanceRecord.id, performance.itemNumber);
        }

        updateCount++;
      } catch (error) {
        console.error(`Error updating performance ${performance.id}:`, error);
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
