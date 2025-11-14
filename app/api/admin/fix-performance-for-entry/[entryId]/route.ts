import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';
import { db, unifiedDb } from '@/lib/database';

/**
 * POST /api/admin/fix-performance-for-entry/[entryId]
 * Creates or fixes a performance for a specific entry
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  try {
    const { entryId } = await params;
    const sqlClient = getSql();

    console.log(`🔧 Fixing performance for entry: ${entryId}`);

    // Get the entry
    const entryResult = await sqlClient`
      SELECT 
        ee.*,
        e.id as event_id_from_event,
        e.name as event_name
      FROM event_entries ee
      LEFT JOIN events e ON ee.event_id = e.id
      WHERE ee.id = ${entryId}
    ` as any[];

    if (entryResult.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Entry not found',
        entryId
      }, { status: 404 });
    }

    const entry = entryResult[0];

    if (!entry.approved) {
      return NextResponse.json({
        success: false,
        error: 'Entry is not approved',
        entryId,
        approved: entry.approved
      }, { status: 400 });
    }

    // Check if performance already exists
    const existingPerformance = await sqlClient`
      SELECT id, event_id FROM performances WHERE event_entry_id = ${entryId} LIMIT 1
    ` as any[];

    if (existingPerformance.length > 0) {
      const perf = existingPerformance[0];
      
      // Check if event_id matches
      if (perf.event_id !== entry.event_id) {
        console.log(`⚠️ Performance exists but event_id mismatch. Updating...`);
        await sqlClient`
          UPDATE performances 
          SET event_id = ${entry.event_id}
          WHERE id = ${perf.id}
        `;
        
        return NextResponse.json({
          success: true,
          message: 'Performance event_id fixed',
          performanceId: perf.id,
          oldEventId: perf.event_id,
          newEventId: entry.event_id
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Performance already exists',
        performanceId: perf.id,
        eventId: perf.event_id
      });
    }

    // Performance doesn't exist - create it
    console.log(`🎭 Creating performance for entry: ${entryId}`);

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
        console.warn(`⚠️  Contestant ${entry.contestant_id} doesn't exist, trying first participant...`);
        
        if (participantIds.length > 0) {
          const firstParticipant = participantIds[0];
          const dancerCheck = await sqlClient`
            SELECT id FROM dancers WHERE id = ${firstParticipant} OR eodsa_id = ${firstParticipant}
          ` as any[];
          
          if (dancerCheck.length > 0) {
            validContestantId = dancerCheck[0].id;
            console.log(`✅ Using dancer ID as contestant: ${validContestantId}`);
          } else {
            throw new Error(`No valid contestant found for entry ${entryId}`);
          }
        }
      }
    } catch (checkErr: any) {
      console.error(`❌ Error validating contestant: ${checkErr.message}`);
      throw checkErr;
    }

    // Generate unique ID
    const performanceId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const participantNamesJson = JSON.stringify(participantNames);

    // Ensure age_category column exists (it might not exist in all databases)
    try {
      await sqlClient`ALTER TABLE performances ADD COLUMN IF NOT EXISTS age_category TEXT`;
    } catch {}

    // Create the performance
    await sqlClient`
      INSERT INTO performances (
        id, event_id, event_entry_id, contestant_id, title, participant_names, duration,
        choreographer, mastery, item_style, scheduled_time, status, item_number, music_cue,
        entry_type, video_external_url, video_external_type, music_file_url, music_file_name
      )
      VALUES (
        ${performanceId}, ${entry.event_id}, ${entryId}, ${validContestantId}, ${entry.item_name},
        ${participantNamesJson}, ${entry.estimated_duration || 0}, ${entry.choreographer},
        ${entry.mastery}, ${entry.item_style}, NULL, 'scheduled',
        ${entry.item_number || null}, NULL,
        ${entry.entry_type || 'live'}, ${entry.video_external_url || null}, ${entry.video_external_type || null},
        ${entry.music_file_url || null}, ${entry.music_file_name || null}
      )
    `;

    // Verify the performance was created
    const verifyPerformance = await sqlClient`
      SELECT id, event_id FROM performances WHERE event_entry_id = ${entryId} LIMIT 1
    ` as any[];

    if (verifyPerformance.length > 0) {
      console.log(`✅ Performance created successfully! (Performance ID: ${verifyPerformance[0].id})`);
      
      return NextResponse.json({
        success: true,
        message: 'Performance created successfully',
        performanceId: verifyPerformance[0].id,
        eventId: verifyPerformance[0].event_id,
        entryId,
        entryName: entry.item_name
      });
    } else {
      throw new Error('Performance creation reported success but performance not found in database');
    }

  } catch (error: any) {
    console.error('❌ Error fixing performance:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fix performance',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

