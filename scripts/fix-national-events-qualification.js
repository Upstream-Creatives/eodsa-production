/**
 * Fix script to ensure all NATIONAL_EVENT events have qualification_required = true
 * 
 * This fixes the bug where existing NATIONAL_EVENT events might not have
 * qualification_required set, allowing unqualified dancers to enter.
 * 
 * Usage: node scripts/fix-national-events-qualification.js
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { neon } = require('@neondatabase/serverless');

async function fixNationalEvents() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  
  console.log('🔧 Fixing NATIONAL_EVENT qualification settings...\n');

  try {
    // Find all NATIONAL_EVENT events that don't have qualification_required = true
    const eventsToFix = await sql`
      SELECT 
        id,
        name,
        event_type,
        qualification_required,
        qualification_source,
        minimum_qualification_score
      FROM events
      WHERE event_type = 'NATIONAL_EVENT'
      AND (
        qualification_required IS NULL 
        OR qualification_required = false
        OR qualification_source IS NULL
        OR minimum_qualification_score IS NULL
      )
    `;
    
    if (eventsToFix.length === 0) {
      console.log('✅ All NATIONAL_EVENT events are properly configured!');
      return;
    }
    
    console.log(`Found ${eventsToFix.length} NATIONAL_EVENT(s) that need fixing:\n`);
    eventsToFix.forEach(evt => {
      console.log(`  - ${evt.name} (${evt.id})`);
      console.log(`    Current: qualification_required=${evt.qualification_required}, source=${evt.qualification_source}, min_score=${evt.minimum_qualification_score}`);
    });
    
    // Fix each event
    console.log('\n🔧 Applying fixes...\n');
    for (const event of eventsToFix) {
      await sql`
        UPDATE events
        SET 
          qualification_required = true,
          qualification_source = COALESCE(qualification_source, 'REGIONAL'),
          minimum_qualification_score = COALESCE(minimum_qualification_score, 75)
        WHERE id = ${event.id}
      `;
      
      console.log(`✅ Fixed: ${event.name}`);
      console.log(`   - qualification_required: true`);
      console.log(`   - qualification_source: REGIONAL`);
      console.log(`   - minimum_qualification_score: 75`);
    }
    
    // Verify the fix
    console.log('\n🔍 Verifying fixes...\n');
    const remainingIssues = await sql`
      SELECT id, name
      FROM events
      WHERE event_type = 'NATIONAL_EVENT'
      AND (
        qualification_required IS NULL 
        OR qualification_required = false
        OR qualification_source IS NULL
        OR minimum_qualification_score IS NULL
      )
    `;
    
    if (remainingIssues.length > 0) {
      console.error(`❌ ${remainingIssues.length} event(s) still have issues:`);
      remainingIssues.forEach(evt => {
        console.error(`   - ${evt.name} (${evt.id})`);
      });
    } else {
      console.log('✅ All NATIONAL_EVENT events are now properly configured!');
    }
    
    // Show summary
    const allNationalEvents = await sql`
      SELECT COUNT(*) as count
      FROM events
      WHERE event_type = 'NATIONAL_EVENT'
    `;
    
    console.log(`\n📊 Summary:`);
    console.log(`   - Total NATIONAL_EVENT events: ${allNationalEvents[0].count}`);
    console.log(`   - Events fixed: ${eventsToFix.length}`);
    console.log(`   - Events already correct: ${allNationalEvents[0].count - eventsToFix.length}`);
    
  } catch (error) {
    console.error('❌ Error fixing events:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the fix
fixNationalEvents()
  .then(() => {
    console.log('\n✨ Fix script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

