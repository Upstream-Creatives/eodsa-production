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

    // Track solo counts per dancer using comprehensive matching (eodsaId, contestantId, participantIds)
    // This matches the logic used in calculateSmartEODSAFee
    const soloCountsByDancerKey = new Map<string, number>();

    for (const entry of sortedEntries) {
      try {
        // Determine performance type from participant count
        const participantCount = entry.participantIds?.length || 1;
        let performanceType: 'Solo' | 'Duet' | 'Trio' | 'Group' = 'Solo';
        if (participantCount === 2) performanceType = 'Duet';
        else if (participantCount === 3) performanceType = 'Trio';
        else if (participantCount >= 4) performanceType = 'Group';

        // For solo entries, determine solo count using comprehensive matching
        // IMPORTANT: Count entries BEFORE this one in the sorted list (by submitted date)
        // This gives us the correct solo number for this entry
        let soloCount = 1;
        if (performanceType === 'Solo' && entry.participantIds && entry.participantIds.length === 1) {
          // Count existing solos for this dancer (entries before current one in sorted list)
          // Use comprehensive matching like calculateSmartEODSAFee does
          const existingSolosForDancer = sortedEntries
            .filter(e => {
              // Must be a different entry (not the one we're recalculating)
              if (e.id === entry.id) return false;
              // Must be before current entry in submission order
              if (new Date(e.submittedAt).getTime() >= new Date(entry.submittedAt).getTime()) return false;
              // Must be solo
              const eParticipantCount = e.participantIds?.length || 1;
              if (eParticipantCount !== 1) return false;
              // Must match dancer (using comprehensive matching: eodsaId, contestantId, or participantIds)
              return e.eodsaId === entry.eodsaId || 
                     e.contestantId === entry.contestantId ||
                     (e.participantIds && e.participantIds.length === 1 && 
                      entry.participantIds && entry.participantIds.length === 1 &&
                      e.participantIds[0] === entry.participantIds[0]);
            })
            .length;
          
          soloCount = existingSolosForDancer + 1;
          console.log(`📊 Entry ${entry.id} (${entry.itemName}): Found ${existingSolosForDancer} existing solos, this is solo #${soloCount}`);
        }

        // Recalculate fee using event's actual configuration
        // Note: calculateSmartEODSAFee will count existing entries in the database
        // Since we're recalculating an existing entry, we need to temporarily exclude it
        // by using a workaround: pass soloCount based on entries processed so far
        // But actually, the function queries the database, so it will count the entry itself
        // We need to let it calculate naturally - it will find existing entries excluding this one
        // if we query before this entry was created. But since entries are sorted by date,
        // entries processed before this one will be counted correctly.
        
        // Actually, the issue is that calculateSmartEODSAFee counts ALL existing entries
        // including the one we're recalculating. We need to pass the correct soloCount
        // based on entries processed BEFORE this one.
        const feeBreakdown = await calculateSmartEODSAFee(
          entry.mastery || 'Water (Competitive)',
          performanceType,
          entry.participantIds || [],
          {
            soloCount: performanceType === 'Solo' ? soloCount : undefined,
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

