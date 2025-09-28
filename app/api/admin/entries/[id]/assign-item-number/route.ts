import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entryId = id;
    const { itemNumber, programType } = await request.json();

    // Validate input
    if (!itemNumber || itemNumber < 1) {
      return NextResponse.json(
        { error: 'Valid item number is required' },
        { status: 400 }
      );
    }

    // Check if item number is already assigned to another entry
    const allEntries = await db.getAllEventEntries();
    const existingEntry = allEntries.find(entry => 
      entry.itemNumber === itemNumber && entry.id !== entryId
    );

    if (existingEntry) {
      return NextResponse.json(
        { error: `Item number ${itemNumber} is already assigned to another entry` },
        { status: 400 }
      );
    }

    // Update the entry with the item number (support separate numbering for virtual program)
    const entryUpdates: any = { itemNumber };
    if (programType === 'virtual') {
      entryUpdates.virtualItemNumber = itemNumber;
    }
    await db.updateEventEntry(entryId, entryUpdates);

    // AUTO-SYNC: Update the corresponding performance as well
    try {
      const allPerformances = await db.getAllPerformances();
      const performance = allPerformances.find(p => p.eventEntryId === entryId);
      
      if (performance) {
        await db.updatePerformanceItemNumber(performance.id, itemNumber);
        console.log(`Auto-synced item number ${itemNumber} to performance ${performance.id}`);
      }
    } catch (syncError) {
      console.warn('Failed to auto-sync performance item number:', syncError);
      // Don't fail the whole request if sync fails
    }

    return NextResponse.json({
      success: true,
      message: `Item number ${itemNumber} assigned successfully`
    });

  } catch (error) {
    console.error('Error assigning item number:', error);
    return NextResponse.json(
      { error: 'Failed to assign item number' },
      { status: 500 }
    );
  }
} 