import { NextResponse } from 'next/server';
import { db, unifiedDb, initializeDatabase } from '@/lib/database';
import { autoMarkRegistrationForParticipants } from '@/lib/registration-fee-tracker';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Before doing anything, ensure the necessary columns exist.
    // This is a more robust way to handle migrations at runtime.
    await db.addRegistrationFeeColumns();
    
    const { id } = await params;
    const entryId = id;
    
    // Get the current entry
    const allEntries = await db.getAllEventEntries();
    const entry = allEntries.find(e => e.id === entryId);
    
    if (!entry) {
      return NextResponse.json(
        { success: false, error: 'Event entry not found' },
        { status: 404 }
      );
    }

    // Update the entry to approved and mark payment as paid
    const updatedEntry = {
      ...entry,
      approved: true,
      paymentStatus: 'paid' as const, // Mark payment as paid when approved
      approvedAt: new Date().toISOString()
    };

    await db.updateEventEntry(entryId, updatedEntry);

    // CRITICAL: Auto-create performance for this approved entry (idempotent)
    try {
      const { getSql } = await import('@/lib/database');
      const sqlClient = getSql();
      
      // Use direct SQL query to check if performance exists (more reliable)
      const existingPerformanceCheck = await sqlClient`
        SELECT id FROM performances WHERE event_entry_id = ${entryId} LIMIT 1
      ` as any[];
      
      const alreadyExists = existingPerformanceCheck.length > 0;
      
      if (!alreadyExists) {
        console.log(`🎭 Creating performance for approved entry: ${entryId} (${entry.itemName})`);
        
        // Build participant names using unified dancer records when available
        const participantNames: string[] = [];
        try {
          for (let i = 0; i < entry.participantIds.length; i++) {
            const pid = entry.participantIds[i];
            try {
              const dancer = await unifiedDb.getDancerById(pid);
              if (dancer?.name) {
                participantNames.push(dancer.name);
                continue;
              }
            } catch {}
            participantNames.push(`Participant ${i + 1}`);
          }
        } catch {
          entry.participantIds.forEach((_, i) => participantNames.push(`Participant ${i + 1}`));
        }

        // CRITICAL FIX: Validate contestant_id exists before creating performance
        let validContestantId = entry.contestantId;
        try {
          // Check if contestant exists
          const contestantCheck = await sqlClient`
            SELECT id FROM contestants WHERE id = ${entry.contestantId}
          ` as any[];
          
          if (contestantCheck.length === 0) {
            console.warn(`⚠️  Contestant ${entry.contestantId} doesn't exist, using first participant as contestant`);
            
            // Try to use first participant as contestant
            if (entry.participantIds && entry.participantIds.length > 0) {
              const firstParticipant = entry.participantIds[0];
              
              // Check if participant is a dancer
              const dancerCheck = await sqlClient`
                SELECT id FROM dancers WHERE id = ${firstParticipant} OR eodsa_id = ${firstParticipant}
              ` as any[];
              
              if (dancerCheck.length > 0) {
                validContestantId = dancerCheck[0].id;
                console.log(`✅ Using dancer ID as contestant: ${validContestantId}`);
              } else {
                // Use entry contestant_id anyway and let it fail with proper error
                console.error(`❌ Cannot find valid contestant for entry ${entryId}`);
              }
            }
          }
        } catch (checkErr) {
          console.error('Error checking contestant:', checkErr);
        }

        const createdPerformance = await db.createPerformance({
          eventId: entry.eventId,
          eventEntryId: entryId,
          contestantId: validContestantId,
          title: entry.itemName,
          participantNames,
          duration: entry.estimatedDuration || 0,
          choreographer: entry.choreographer,
          mastery: entry.mastery,
          itemStyle: entry.itemStyle,
          status: 'scheduled',
          itemNumber: entry.itemNumber || undefined,
          entryType: entry.entryType || 'live',
          videoExternalUrl: entry.videoExternalUrl,
          videoExternalType: entry.videoExternalType,
          musicFileUrl: entry.musicFileUrl,
          musicFileName: entry.musicFileName
        });
        
        // Verify the performance was actually created
        const verifyPerformance = await sqlClient`
          SELECT id FROM performances WHERE event_entry_id = ${entryId} LIMIT 1
        ` as any[];
        
        if (verifyPerformance.length > 0) {
          console.log(`✅ Performance created successfully for entry: ${entryId} (Performance ID: ${verifyPerformance[0].id})`);
        } else {
          console.error(`❌ CRITICAL: Performance creation reported success but performance not found in database for entry: ${entryId}`);
        }
      } else {
        console.log(`ℹ️  Performance already exists for entry: ${entryId} (Performance ID: ${existingPerformanceCheck[0].id})`);
      }
    } catch (perfErr) {
      console.error('⚠️  CRITICAL: Failed to auto-create performance for entry', entryId);
      console.error('Error details:', perfErr);
      // Log the full error stack for debugging
      if (perfErr instanceof Error) {
        console.error('Error stack:', perfErr.stack);
        console.error('Error message:', perfErr.message);
      }
      // Don't fail the approval if performance creation fails
      // But log it prominently so we can investigate
    }

    // Auto-mark registration fees as paid for all participants since entry is now paid
    if (entry.participantIds && entry.participantIds.length > 0 && entry.mastery) {
      try {
        const registrationResults = await autoMarkRegistrationForParticipants(entry.participantIds, entry.mastery);
        console.log('Registration fee auto-marking results:', registrationResults);
      } catch (error) {
        console.error('Failed to auto-mark registration fees on approval:', error);
      }
    }

    // Mark registration fees as paid for all participants after admin approval
    if (entry.participantIds && entry.participantIds.length > 0) {
      try {
        for (const participantId of entry.participantIds) {
          // Get the entry to find the mastery level
          const mastery = entry.mastery || 'Eisteddfod';
          
          // CRITICAL FIX: Look up the dancer by their primary ID (which should be the EODSA ID)
          // The participantId from the entry might be a temporary or non-EODSA ID.
          const dancer = await unifiedDb.getDancerById(participantId);

          if (dancer) {
            await unifiedDb.markRegistrationFeePaid(dancer.id, mastery);
          } else {
            console.warn(`Could not find dancer with ID: ${participantId} to mark registration fee as paid.`);
          }
        }
        console.log('✅ Registration fees marked as paid for approved entry participants');
      } catch (error) {
        console.warn('Failed to update registration status after approval:', error);
        // Don't fail the approval if registration status update fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Event entry approved successfully'
    });
  } catch (error) {
    console.error('Error approving event entry:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to approve event entry' },
      { status: 500 }
    );
  }
} 