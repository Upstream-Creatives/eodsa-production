#!/usr/bin/env node

/**
 * Verification Script: Check Event Fee Configuration
 * 
 * This script checks all events in the database to verify:
 * 1. Fee configuration columns exist
 * 2. All events have fee values set
 * 3. Shows current fee configuration for each event
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env' });

async function verifyEventFees() {
  console.log('🔍 Starting Event Fee Configuration Verification...\n');
  
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const sql = neon(DATABASE_URL);

  try {
    // Check if fee columns exist
    console.log('📊 Checking fee configuration columns...');
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'events' 
      AND column_name IN (
        'registration_fee_per_dancer',
        'solo_1_fee',
        'solo_2_fee',
        'solo_3_fee',
        'solo_additional_fee',
        'duo_trio_fee_per_dancer',
        'group_fee_per_dancer',
        'large_group_fee_per_dancer',
        'currency'
      )
      ORDER BY column_name
    `;
    
    if (columns.length === 9) {
      console.log('✅ All 9 fee configuration columns exist\n');
    } else {
      console.log('⚠️  Missing columns! Found:', columns.length);
      console.log('   Expected: 9 columns');
      console.log('   Found:', columns.map(c => c.column_name).join(', '));
      console.log('\n');
    }

    // Get all events with fee configuration
    console.log('📋 Checking events...\n');
    const events = await sql`
      SELECT 
        id,
        name,
        region,
        event_date,
        status,
        registration_fee_per_dancer,
        solo_1_fee,
        solo_2_fee,
        solo_3_fee,
        solo_additional_fee,
        duo_trio_fee_per_dancer,
        group_fee_per_dancer,
        large_group_fee_per_dancer,
        currency
      FROM events
      ORDER BY event_date DESC
    `;

    if (events.length === 0) {
      console.log('ℹ️  No events found in database\n');
      return;
    }

    console.log(`Found ${events.length} event(s):\n`);

    let eventsWithoutFees = 0;
    let eventsWithFees = 0;

    events.forEach((event, index) => {
      const hasFees = event.registration_fee_per_dancer !== null && 
                      event.solo_1_fee !== null;
      
      if (hasFees) {
        eventsWithFees++;
      } else {
        eventsWithoutFees++;
      }

      console.log(`${index + 1}. ${event.name}`);
      console.log(`   ID: ${event.id}`);
      console.log(`   Region: ${event.region}`);
      console.log(`   Date: ${event.event_date}`);
      console.log(`   Status: ${event.status}`);
      console.log(`   Currency: ${event.currency || 'NULL (⚠️  NOT SET)'}`);
      console.log(`   Registration Fee: ${event.registration_fee_per_dancer !== null ? event.registration_fee_per_dancer : 'NULL (⚠️  NOT SET)'}`);
      console.log(`   1 Solo Package: ${event.solo_1_fee !== null ? event.solo_1_fee : 'NULL (⚠️  NOT SET)'}`);
      console.log(`   2 Solos Package: ${event.solo_2_fee !== null ? event.solo_2_fee : 'NULL (⚠️  NOT SET)'}`);
      console.log(`   3 Solos Package: ${event.solo_3_fee !== null ? event.solo_3_fee : 'NULL (⚠️  NOT SET)'}`);
      console.log(`   Each Additional Solo: ${event.solo_additional_fee !== null ? event.solo_additional_fee : 'NULL (⚠️  NOT SET)'}`);
      console.log(`   Duo/Trio (per dancer): ${event.duo_trio_fee_per_dancer !== null ? event.duo_trio_fee_per_dancer : 'NULL (⚠️  NOT SET)'}`);
      console.log(`   Small Group (per dancer): ${event.group_fee_per_dancer !== null ? event.group_fee_per_dancer : 'NULL (⚠️  NOT SET)'}`);
      console.log(`   Large Group (per dancer): ${event.large_group_fee_per_dancer !== null ? event.large_group_fee_per_dancer : 'NULL (⚠️  NOT SET)'}`);
      
      if (!hasFees) {
        console.log(`   ❌ STATUS: Fee configuration NOT SET`);
      } else {
        console.log(`   ✅ STATUS: Fee configuration complete`);
      }
      console.log('');
    });

    // Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('SUMMARY');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Total Events: ${events.length}`);
    console.log(`✅ Events with fee configuration: ${eventsWithFees}`);
    console.log(`❌ Events without fee configuration: ${eventsWithoutFees}`);
    
    if (eventsWithoutFees > 0) {
      console.log('\n⚠️  WARNING: Some events are missing fee configuration!');
      console.log('   These events will use fallback defaults:');
      console.log('   - Registration Fee: 300');
      console.log('   - 1 Solo: 400');
      console.log('   - 2 Solos: 750');
      console.log('   - 3 Solos: 1050');
      console.log('   - Additional Solos: 100');
      console.log('   - Duo/Trio: 280 per dancer');
      console.log('   - Small Group: 220 per dancer');
      console.log('   - Large Group: 190 per dancer');
      console.log('\n   To fix this, edit each event in the Admin Dashboard');
      console.log('   and set the fee configuration manually.\n');
    } else {
      console.log('\n✅ All events have fee configuration set!\n');
    }

  } catch (error) {
    console.error('❌ Error verifying fees:', error);
    process.exit(1);
  }
}

// Run verification
verifyEventFees()
  .then(() => {
    console.log('✅ Verification complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });

