// Script to update event_mode for existing events based on participation_mode
// This fixes the issue where existing events show as 'HYBRID' because event_mode is NULL

require('dotenv').config({ path: '.env.local' });

const { neon } = require('@neondatabase/serverless');

async function updateEventModes() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  try {
    console.log('🔧 Updating event_mode for existing events...\n');

    // Get all events and update event_mode to match participation_mode
    const events = await sql`
      SELECT id, name, participation_mode, event_mode, event_type
      FROM events
      ORDER BY created_at DESC
    `;

    if (events.length === 0) {
      console.log('No events found.');
      return;
    }

    console.log(`Found ${events.length} event(s) to check:\n`);

    let updatedCount = 0;
    for (const event of events) {
      // Determine event_mode based on participation_mode
      let newEventMode = 'HYBRID'; // Default
      
      if (event.participation_mode === 'live') {
        newEventMode = 'LIVE';
      } else if (event.participation_mode === 'virtual') {
        newEventMode = 'VIRTUAL';
      } else {
        // If participation_mode is 'hybrid' or null, default to HYBRID
        newEventMode = 'HYBRID';
      }

      // Only update if event_mode doesn't match participation_mode
      if (event.event_mode !== newEventMode) {
        console.log(`  - "${event.name}" (ID: ${event.id})`);
        console.log(`    Current: participation_mode=${event.participation_mode || 'NULL'}, event_mode=${event.event_mode || 'NULL'}`);
        console.log(`    Setting: event_mode=${newEventMode}`);

        await sql`
          UPDATE events
          SET event_mode = ${newEventMode}
          WHERE id = ${event.id}
        `;

        updatedCount++;
        console.log(`    ✅ Updated\n`);
      }
    }

    console.log(`\n✨ Successfully updated ${updatedCount} event(s)!`);
    console.log('\nNote: You may want to review and manually adjust event_mode for specific events if needed.');
  } catch (error) {
    console.error('❌ Error updating event modes:', error);
    process.exit(1);
  }
}

updateEventModes();

