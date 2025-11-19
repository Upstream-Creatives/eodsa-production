// Script to check event_mode values in the database

require('dotenv').config({ path: '.env.local' });

const { neon } = require('@neondatabase/serverless');

async function checkEventModes() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  try {
    console.log('🔍 Checking event_mode values in database...\n');

    const events = await sql`
      SELECT id, name, participation_mode, event_mode, event_type
      FROM events
      ORDER BY created_at DESC
      LIMIT 20
    `;

    if (events.length === 0) {
      console.log('No events found.');
      return;
    }

    console.log(`Found ${events.length} event(s):\n`);

    const modeCounts = { LIVE: 0, VIRTUAL: 0, HYBRID: 0, NULL: 0, OTHER: 0 };

    for (const event of events) {
      const eventMode = event.event_mode || 'NULL';
      const participationMode = event.participation_mode || 'NULL';
      
      console.log(`  - "${event.name}"`);
      console.log(`    event_mode: ${eventMode}`);
      console.log(`    participation_mode: ${participationMode}`);
      console.log(`    event_type: ${event.event_type || 'NULL'}\n`);

      if (eventMode === 'LIVE') modeCounts.LIVE++;
      else if (eventMode === 'VIRTUAL') modeCounts.VIRTUAL++;
      else if (eventMode === 'HYBRID') modeCounts.HYBRID++;
      else if (!eventMode || eventMode === 'NULL') modeCounts.NULL++;
      else modeCounts.OTHER++;
    }

    console.log('\n📊 Summary:');
    console.log(`  LIVE: ${modeCounts.LIVE}`);
    console.log(`  VIRTUAL: ${modeCounts.VIRTUAL}`);
    console.log(`  HYBRID: ${modeCounts.HYBRID}`);
    console.log(`  NULL: ${modeCounts.NULL}`);
    console.log(`  OTHER: ${modeCounts.OTHER}`);
  } catch (error) {
    console.error('❌ Error checking event modes:', error);
    process.exit(1);
  }
}

checkEventModes();

