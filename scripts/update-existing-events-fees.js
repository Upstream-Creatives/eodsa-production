/**
 * Update Existing Events with Default Fee Values
 * Run this with: node scripts/update-existing-events-fees.js
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env' });

async function updateExistingEvents() {
  console.log('🚀 Updating existing events with default fee values...');
  
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const sql = neon(DATABASE_URL);

  try {
    // Get count of existing events
    const [countResult] = await sql`SELECT COUNT(*) as count FROM events`;
    const totalEvents = parseInt(countResult.count);
    
    console.log(`📊 Found ${totalEvents} existing events`);
    
    if (totalEvents === 0) {
      console.log('✅ No existing events to update');
      return;
    }

    // Update events that have NULL values for fee columns
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
      console.log(`\n✅ Updated ${result.length} events with default fee values:`);
      result.forEach(event => {
        console.log(`   - ${event.name} (${event.id})`);
      });
    } else {
      console.log('\n✅ All events already have fee values set');
    }

    // Show sample of events with their fee configuration
    const sampleEvents = await sql`
      SELECT 
        name, 
        currency,
        registration_fee_per_dancer,
        solo_1_fee,
        duo_trio_fee_per_dancer,
        group_fee_per_dancer
      FROM events 
      ORDER BY created_at DESC 
      LIMIT 3
    `;

    if (sampleEvents.length > 0) {
      console.log('\n📋 Sample events with fee configuration:');
      sampleEvents.forEach(event => {
        console.log(`\n   ${event.name}`);
        console.log(`   - Currency: ${event.currency}`);
        console.log(`   - Registration: ${event.registration_fee_per_dancer}`);
        console.log(`   - 1 Solo: ${event.solo_1_fee}`);
        console.log(`   - Duo/Trio: ${event.duo_trio_fee_per_dancer} per dancer`);
        console.log(`   - Group: ${event.group_fee_per_dancer} per dancer`);
      });
    }

    console.log('\n✨ Update completed successfully!');
    
  } catch (error) {
    console.error('❌ Update failed:', error);
    console.error('\nError details:', error.message);
    process.exit(1);
  }
}

// Run the update
updateExistingEvents()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });

