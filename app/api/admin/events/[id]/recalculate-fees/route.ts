import { NextRequest, NextResponse } from 'next/server';
import { db, getSql } from '@/lib/database';
import { calculateSmartEODSAFee } from '@/lib/registration-fee-tracker';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const eventId = id;
    
    // Verify admin authentication
    const body = await request.json().catch(() => ({}));
    const { adminId } = body;
    
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: 'Admin ID required' },
        { status: 400 }
      );
    }

    // Verify the user is actually an admin
    const admin = await db.getJudgeById(adminId);
    if (!admin || !admin.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }

    // Get the event
    const event = await db.getEventById(eventId);
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Get all entries for this event
    const allEntries = await db.getAllEventEntries();
    const eventEntries = allEntries.filter(entry => entry.eventId === eventId);
    
    if (eventEntries.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No entries found for this event',
        updated: 0
      });
    }

    const sqlClient = getSql();
    const results = [];
    let updatedCount = 0;
    let errorCount = 0;

    // Sort entries by submitted date to determine solo order
    const sortedEntries = [...eventEntries].sort((a, b) => 
      new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
    );

    // Track solo counts per dancer
    const soloCountsByDancer = new Map<string, number>();

    for (const entry of sortedEntries) {
      try {
        // Determine performance type from participant count
        const participantCount = entry.participantIds?.length || 1;
        let performanceType: 'Solo' | 'Duet' | 'Trio' | 'Group' = 'Solo';
        if (participantCount === 2) performanceType = 'Duet';
        else if (participantCount === 3) performanceType = 'Trio';
        else if (participantCount >= 4) performanceType = 'Group';

        // For solo entries, determine solo count
        let soloCount = 1;
        if (performanceType === 'Solo' && entry.participantIds && entry.participantIds.length === 1) {
          const dancerId = entry.participantIds[0];
          const currentCount = soloCountsByDancer.get(dancerId) || 0;
          soloCount = currentCount + 1;
          soloCountsByDancer.set(dancerId, soloCount);
        }

        // Recalculate fee using event's actual configuration
        const feeBreakdown = await calculateSmartEODSAFee(
          entry.mastery || 'Water (Competitive)',
          performanceType,
          entry.participantIds || [],
          {
            soloCount,
            eventId
          }
        );

        const newCalculatedFee = feeBreakdown.totalFee;
        const oldCalculatedFee = entry.calculatedFee;

        // Only update if fee has changed
        if (Math.abs(newCalculatedFee - oldCalculatedFee) > 0.01) {
          await sqlClient`
            UPDATE event_entries 
            SET calculated_fee = ${newCalculatedFee}
            WHERE id = ${entry.id}
          `;

          results.push({
            entryId: entry.id,
            itemName: entry.itemName,
            oldFee: oldCalculatedFee,
            newFee: newCalculatedFee,
            performanceType,
            soloCount: performanceType === 'Solo' ? soloCount : undefined,
            performanceFee: feeBreakdown.performanceFee,
            registrationFee: feeBreakdown.registrationFee
          });

          updatedCount++;
        } else {
          results.push({
            entryId: entry.id,
            itemName: entry.itemName,
            oldFee: oldCalculatedFee,
            newFee: newCalculatedFee,
            performanceType,
            soloCount: performanceType === 'Solo' ? soloCount : undefined,
            status: 'unchanged'
          });
        }
      } catch (error: any) {
        console.error(`Error recalculating fee for entry ${entry.id}:`, error);
        errorCount++;
        results.push({
          entryId: entry.id,
          itemName: entry.itemName,
          error: error.message || 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Recalculated fees for ${eventEntries.length} entries`,
      eventName: event.name,
      updated: updatedCount,
      unchanged: eventEntries.length - updatedCount - errorCount,
      errors: errorCount,
      results
    });

  } catch (error: any) {
    console.error('Error recalculating fees:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to recalculate fees' },
      { status: 500 }
    );
  }
}

