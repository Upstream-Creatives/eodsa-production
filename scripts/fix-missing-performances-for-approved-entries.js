/**
 * Script to find and create missing performances for approved entries
 * 
 * Usage: node scripts/fix-missing-performances-for-approved-entries.js
 */

require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

async function fixMissingPerformances() {
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    console.log('🔍 Searching for approved entries without performances...\n');
    
    // Find all approved entries that don't have performances
    const missingPerformances = await sql`
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
        e.name as event_name,
        ee.approved,
        ee.payment_status
      FROM event_entries ee
      JOIN events e ON ee.event_id = e.id
      WHERE ee.approved = true
        AND NOT EXISTS (
          SELECT 1 FROM performances p 
          WHERE p.event_entry_id = ee.id
        )
      ORDER BY ee.submitted_at DESC
    `;

    if (missingPerformances.length === 0) {
      console.log('✅ No missing performances found! All approved entries have performances.');
      return;
    }

    console.log(`📊 Found ${missingPerformances.length} approved entries without performances:\n`);
    
    let created = 0;
    let failed = 0;
    const errors = [];

    for (const entry of missingPerformances) {
      try {
        console.log(`\n🎭 Processing entry: ${entry.item_name} (ID: ${entry.entry_id})`);
        
        // Parse participant IDs
        let participantIds = [];
        try {
          participantIds = typeof entry.participant_ids === 'string' 
            ? JSON.parse(entry.participant_ids)
            : entry.participant_ids || [];
        } catch {
          participantIds = [];
        }

        // Build participant names using dancer records when available
        const participantNames = [];
        for (let i = 0; i < participantIds.length; i++) {
          const pid = participantIds[i];
          try {
            // Try to get dancer by ID or EODSA ID
            const dancerResult = await sql`
              SELECT name FROM dancers WHERE id = ${pid} OR eodsa_id = ${pid} LIMIT 1
            `;
            
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
          const contestantCheck = await sql`
            SELECT id FROM contestants WHERE id = ${entry.contestant_id}
          `;
          
          if (contestantCheck.length === 0) {
            console.warn(`  ⚠️  Contestant ${entry.contestant_id} doesn't exist, trying first participant...`);
            
            if (participantIds.length > 0) {
              const firstParticipant = participantIds[0];
              const dancerCheck = await sql`
                SELECT id FROM dancers WHERE id = ${firstParticipant} OR eodsa_id = ${firstParticipant}
              `;
              
              if (dancerCheck.length > 0) {
                validContestantId = dancerCheck[0].id;
                console.log(`  ✅ Using dancer ID as contestant: ${validContestantId}`);
              } else {
                console.error(`  ❌ Cannot find valid contestant for entry ${entry.entry_id}`);
                throw new Error(`No valid contestant found for entry ${entry.entry_id}`);
              }
            }
          }
        } catch (checkErr) {
          console.error(`  ❌ Error validating contestant: ${checkErr.message}`);
          throw checkErr;
        }

        // Build performance data
        // Generate unique ID: timestamp + random number to avoid collisions
        const performanceId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const participantNamesJson = JSON.stringify(participantNames);

        // Create the performance directly in the database
        await sql`
          INSERT INTO performances (
            id, event_id, event_entry_id, contestant_id, title, participant_names, duration,
            choreographer, mastery, item_style, scheduled_time, status, item_number, music_cue, age_category,
            entry_type, video_external_url, video_external_type, music_file_url, music_file_name
          )
          VALUES (
            ${performanceId}, ${entry.event_id}, ${entry.entry_id}, ${validContestantId}, ${entry.item_name},
            ${participantNamesJson}, ${entry.estimated_duration || 0}, ${entry.choreographer},
            ${entry.mastery}, ${entry.item_style}, NULL, 'scheduled',
            ${entry.item_number || null}, NULL, NULL,
            ${entry.entry_type || 'live'}, ${entry.video_external_url || null}, ${entry.video_external_type || null},
            ${entry.music_file_url || null}, ${entry.music_file_name || null}
          )
        `;

        // Verify the performance was created
        const verifyPerformance = await sql`
          SELECT id FROM performances WHERE event_entry_id = ${entry.entry_id} LIMIT 1
        `;

        if (verifyPerformance.length > 0) {
          console.log(`  ✅ Performance created successfully! (Performance ID: ${verifyPerformance[0].id})`);
          created++;
        } else {
          throw new Error('Performance creation reported success but performance not found in database');
        }

      } catch (error) {
        console.error(`  ❌ Failed to create performance for entry ${entry.entry_id}:`, error.message);
        failed++;
        errors.push({
          entryId: entry.entry_id,
          itemName: entry.item_name,
          error: error.message
        });
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully created: ${created} performances`);
    console.log(`❌ Failed: ${failed} performances`);
    console.log(`📝 Total processed: ${missingPerformances.length} entries`);
    
    if (errors.length > 0) {
      console.log('\n❌ ERRORS:');
      errors.forEach(err => {
        console.log(`  - Entry ${err.entryId} (${err.itemName}): ${err.error}`);
      });
    }
    
    console.log('\n✅ Script completed!\n');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  fixMissingPerformances()
    .then(() => {
      console.log('Script finished successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixMissingPerformances };

