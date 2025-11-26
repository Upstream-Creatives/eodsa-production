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
        // For solo entries, we've already calculated the correct soloCount
        // But calculateSmartEODSAFee will query the database and find this entry too
        // So we need to calculate fees directly based on event configuration and soloCount
        
        let feeBreakdown: any;
        
        if (performanceType === 'Solo' && soloCount && event) {
          // Calculate fees directly based on event configuration
          const regFee = event.registrationFeePerDancer || 0;
          const solo1Fee = event.solo1Fee || 0;
          const solo2Fee = event.solo2Fee || 0;
          const solo3Fee = event.solo3Fee || 0;
          const soloAdditionalFee = event.soloAdditionalFee || 0;
          
          // Calculate performance fee based on solo count (incremental pricing)
          let performanceFee = 0;
          if (soloCount === 1) {
            performanceFee = solo1Fee;
          } else if (soloCount === 2 && solo2Fee > 0 && solo1Fee > 0) {
            performanceFee = solo2Fee - solo1Fee; // Incremental cost for 2nd solo
          } else if (soloCount === 3 && solo3Fee > 0 && solo2Fee > 0) {
            performanceFee = solo3Fee - solo2Fee; // Incremental cost for 3rd solo
          } else if (soloCount > 3) {
            performanceFee = soloAdditionalFee;
          }
          
          // Check if registration fee should be charged (first entry for this dancer in this event)
          // Count all entries (any type) for this dancer before this entry
          const hasPreviousEntry = sortedEntries.some(e => {
            if (e.id === entry.id) return false;
            if (new Date(e.submittedAt).getTime() >= new Date(entry.submittedAt).getTime()) return false;
            return e.eodsaId === entry.eodsaId || 
                   e.contestantId === entry.contestantId ||
                   (e.participantIds && entry.participantIds && 
                    e.participantIds.length > 0 && entry.participantIds.length > 0 &&
                    e.participantIds.some(id => entry.participantIds.includes(id)));
          });
          
          const registrationFee = hasPreviousEntry ? 0 : regFee;
          
          feeBreakdown = {
            performanceFee,
            registrationFee,
            totalFee: performanceFee + registrationFee,
            breakdown: `Solo #${soloCount}`,
            registrationBreakdown: registrationFee > 0 
              ? 'Registration fee (first entry in this event)'
              : 'Registration fee waived (already assigned on previous entry)'
          };
        } else {
          // For non-solo entries, use calculateSmartEODSAFee
          feeBreakdown = await calculateSmartEODSAFee(
            entry.mastery || 'Water (Competitive)',
            performanceType,
            entry.participantIds || [],
            {
              eventId
            }
          );
        }

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

