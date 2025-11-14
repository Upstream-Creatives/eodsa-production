import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';

/**
 * POST /api/admin/fix-event-performances/[eventId]
 * Creates missing performances for all approved entries in an event
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const sqlClient = getSql();

    console.log(`🔧 Fixing performances for event: ${eventId}`);

    // Get all approved entries for this event that don't have performances
    const missingPerformances = await sqlClient`
      SELECT 
        ee.id as entry_id,
        ee.item_name,
        ee.event_id,
        ee.contestant_id,
        ee.participant_ids,
        ee.choreographer,
        ee.mastery,
        ee.item_style,
        ee.estimated_duration,
        ee.item_number,
        ee.entry_type,
        ee.video_external_url,
        ee.video_external_type,
        ee.music_file_url,
        ee.music_file_name,
        e.name as event_name
      FROM event_entries ee
      JOIN events e ON ee.event_id = e.id
      WHERE ee.event_id = ${eventId}
        AND ee.approved = true
        AND NOT EXISTS (
          SELECT 1 FROM performances p 
          WHERE p.event_entry_id = ee.id
        )
      ORDER BY ee.submitted_at DESC
    ` as any[];

    if (missingPerformances.length === 0) {
      // Check if performances exist but might have wrong event_id
      const existingPerformances = await sqlClient`
        SELECT 
          p.id,
          p.event_id,
          p.event_entry_id,
          ee.event_id as entry_event_id,
          ee.item_name
        FROM performances p
        JOIN event_entries ee ON p.event_entry_id = ee.id
        WHERE ee.event_id = ${eventId}
      ` as any[];

      const mismatched = existingPerformances.filter(p => p.event_id !== p.entry_event_id);

      if (mismatched.length > 0) {
        // Fix event_id mismatches
        for (const perf of mismatched) {
          await sqlClient`
            UPDATE performances 
            SET event_id = ${perf.entry_event_id}
            WHERE id = ${perf.id}
          `;
        }

        return NextResponse.json({
          success: true,
          message: `Fixed ${mismatched.length} performances with incorrect event_id`,
          fixed: mismatched.length,
          created: 0
        });
      }

      return NextResponse.json({
        success: true,
        message: 'All approved entries already have performances',
        created: 0,
        fixed: 0
      });
    }

    console.log(`📊 Found ${missingPerformances.length} approved entries without performances`);
    
    let created = 0;
    let failed = 0;
    const errors: Array<{ entryId: string; itemName: string; error: string }> = [];

    for (const entry of missingPerformances) {
      try {
        console.log(`🎭 Creating performance for entry: ${entry.item_name} (ID: ${entry.entry_id})`);
        
        // Parse participant IDs
        let participantIds: string[] = [];
        try {
          participantIds = typeof entry.participant_ids === 'string' 
            ? JSON.parse(entry.participant_ids)
            : entry.participant_ids || [];
        } catch {
          participantIds = [];
        }

        // Build participant names using dancer records when available
        const participantNames: string[] = [];
        for (let i = 0; i < participantIds.length; i++) {
          const pid = participantIds[i];
          try {
            const dancerResult = await sqlClient`
              SELECT name FROM dancers WHERE id = ${pid} OR eodsa_id = ${pid} LIMIT 1
            ` as any[];
            
            if (dancerResult.length > 0 && dancerResult[0].name) {
              participantNames.push(dancerResult[0].name);
              continue;
            }
          } catch {}
          participantNames.push(`Participant ${i + 1}`);
        }

        // Validate contestant_id exists
        let validContestantId = entry.contestant_id;
        try {
          const contestantCheck = await sqlClient`
            SELECT id FROM contestants WHERE id = ${entry.contestant_id}
          ` as any[];
          
          if (contestantCheck.length === 0) {
            console.warn(`  ⚠️  Contestant ${entry.contestant_id} doesn't exist, trying first participant...`);
            
            if (participantIds.length > 0) {
              const firstParticipant = participantIds[0];
              const dancerCheck = await sqlClient`
                SELECT id FROM dancers WHERE id = ${firstParticipant} OR eodsa_id = ${firstParticipant}
              ` as any[];
              
              if (dancerCheck.length > 0) {
                validContestantId = dancerCheck[0].id;
                console.log(`  ✅ Using dancer ID as contestant: ${validContestantId}`);
              } else {
                throw new Error(`No valid contestant found for entry ${entry.entry_id}`);
              }
            }
          }
        } catch (checkErr: any) {
          console.error(`  ❌ Error validating contestant: ${checkErr.message}`);
          throw checkErr;
        }

        // Generate unique ID
        const performanceId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const participantNamesJson = JSON.stringify(participantNames);

        // Ensure age_category column exists (it might not exist in all databases)
        try {
          await sqlClient`ALTER TABLE performances ADD COLUMN IF NOT EXISTS age_category TEXT`;
        } catch {}

        // Create the performance - CRITICAL: Use entry.event_id (not eventId param, in case of mismatch)
        await sqlClient`
          INSERT INTO performances (
            id, event_id, event_entry_id, contestant_id, title, participant_names, duration,
            choreographer, mastery, item_style, scheduled_time, status, item_number, music_cue,
            entry_type, video_external_url, video_external_type, music_file_url, music_file_name
          )
          VALUES (
            ${performanceId}, ${entry.event_id}, ${entry.entry_id}, ${validContestantId}, ${entry.item_name},
            ${participantNamesJson}, ${entry.estimated_duration || 0}, ${entry.choreographer},
            ${entry.mastery}, ${entry.item_style}, NULL, 'scheduled',
            ${entry.item_number || null}, NULL,
            ${entry.entry_type || 'live'}, ${entry.video_external_url || null}, ${entry.video_external_type || null},
            ${entry.music_file_url || null}, ${entry.music_file_name || null}
          )
        `;

        // Verify the performance was created
        const verifyPerformance = await sqlClient`
          SELECT id, event_id FROM performances WHERE event_entry_id = ${entry.entry_id} LIMIT 1
        ` as any[];

        if (verifyPerformance.length > 0) {
          console.log(`  ✅ Performance created successfully! (Performance ID: ${verifyPerformance[0].id}, Event ID: ${verifyPerformance[0].event_id})`);
          created++;
        } else {
          throw new Error('Performance creation reported success but performance not found in database');
        }

      } catch (error: any) {
        console.error(`  ❌ Failed to create performance for entry ${entry.entry_id}:`, error.message);
        failed++;
        errors.push({
          entryId: entry.entry_id,
          itemName: entry.item_name,
          error: error.message
        });
      }
    }

    // Also check and fix any existing performances with wrong event_id
    const existingPerformances = await sqlClient`
      SELECT 
        p.id,
        p.event_id,
        p.event_entry_id,
        ee.event_id as entry_event_id
      FROM performances p
      JOIN event_entries ee ON p.event_entry_id = ee.id
      WHERE ee.event_id = ${eventId}
        AND p.event_id != ee.event_id
    ` as any[];

    let fixed = 0;
    for (const perf of existingPerformances) {
      await sqlClient`
        UPDATE performances 
        SET event_id = ${perf.entry_event_id}
        WHERE id = ${perf.id}
      `;
      fixed++;
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${missingPerformances.length} entries`,
      created,
      fixed,
      failed,
      total: missingPerformances.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error('❌ Error fixing event performances:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fix event performances',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

