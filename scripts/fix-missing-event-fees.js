#!/usr/bin/env node

/**
 * Fix Script: Set Default Fee Configuration for Events
 * 
 * This script updates all events that have NULL fee values
 * and sets them to the default EODSA Nationals pricing
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env' });

async function fixMissingFees() {
  console.log('🔧 Starting Fee Configuration Fix...\n');
  
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const sql = neon(DATABASE_URL);

  try {
    // Find events with missing fees
    console.log('🔍 Checking for events with missing fee configuration...\n');
    
    const eventsNeedingFix = await sql`
      SELECT id, name, 
        registration_fee_per_dancer,
        solo_1_fee,
        currency
      FROM events
      WHERE registration_fee_per_dancer IS NULL 
        OR solo_1_fee IS NULL 
        OR currency IS NULL
    `;

    if (eventsNeedingFix.length === 0) {
      console.log('✅ All events already have fee configuration!\n');
      return;
    }

    console.log(`Found ${eventsNeedingFix.length} event(s) needing fee configuration:\n`);
    eventsNeedingFix.forEach((event, index) => {
      console.log(`${index + 1}. ${event.name} (${event.id})`);
      console.log(`   Registration Fee: ${event.registration_fee_per_dancer || 'NULL'}`);
      console.log(`   1 Solo Fee: ${event.solo_1_fee || 'NULL'}`);
      console.log(`   Currency: ${event.currency || 'NULL'}`);
    });

    console.log('\n📝 Applying default fee configuration...');
    console.log('   Default values:');
    console.log('   - Currency: ZAR (R)');
    console.log('   - Registration Fee (per dancer): 300');
    console.log('   - 1 Solo Package: 400');
    console.log('   - 2 Solos Package: 750');
    console.log('   - 3 Solos Package: 1050');
    console.log('   - Each Additional Solo: 100');
    console.log('   - Duo/Trio (per dancer): 280');
    console.log('   - Small Group (per dancer, 4-9): 220');
    console.log('   - Large Group (per dancer, 10+): 190\n');

    // Update events with default values
    const result = await sql`
      UPDATE events 
      SET 
        registration_fee_per_dancer = COALESCE(registration_fee_per_dancer, 300),
        solo_1_fee = COALESCE(solo_1_fee, 400),
        solo_2_fee = COALESCE(solo_2_fee, 750),
        solo_3_fee = COALESCE(solo_3_fee, 1050),
        solo_additional_fee = COALESCE(solo_additional_fee, 100),
        duo_trio_fee_per_dancer = COALESCE(duo_trio_fee_per_dancer, 280),
        group_fee_per_dancer = COALESCE(group_fee_per_dancer, 220),
        large_group_fee_per_dancer = COALESCE(large_group_fee_per_dancer, 190),
        currency = COALESCE(currency, 'ZAR')
      WHERE 
        registration_fee_per_dancer IS NULL 
        OR solo_1_fee IS NULL 
        OR currency IS NULL
      RETURNING id, name
    `;

    if (result.length > 0) {
      console.log(`✅ Successfully updated ${result.length} event(s):\n`);
      result.forEach((event, index) => {
        console.log(`${index + 1}. ${event.name} (${event.id})`);
      });
    }

    // Verify the fix
    console.log('\n🔍 Verifying fix...\n');
    const remainingIssues = await sql`
      SELECT id, name 
      FROM events
      WHERE registration_fee_per_dancer IS NULL 
        OR solo_1_fee IS NULL 
        OR currency IS NULL
    `;

    if (remainingIssues.length === 0) {
      console.log('✅ All events now have complete fee configuration!');
    } else {
      console.log(`⚠️  Still found ${remainingIssues.length} events with issues:`);
      remainingIssues.forEach(event => {
        console.log(`   - ${event.name} (${event.id})`);
      });
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('IMPORTANT NOTES');
    console.log('═══════════════════════════════════════════════════════');
    console.log('1. Default values have been applied to events');
    console.log('2. If you need different pricing for specific events,');
    console.log('   please update them manually in the Admin Dashboard');
    console.log('3. Future events will use the fee configuration you set');
    console.log('   when creating the event\n');

  } catch (error) {
    console.error('❌ Error fixing fees:', error);
    process.exit(1);
  }
}

// Run fix
fixMissingFees()
  .then(() => {
    console.log('✅ Fix complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  });

