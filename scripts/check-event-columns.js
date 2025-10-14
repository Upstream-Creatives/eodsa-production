const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

async function checkEventColumns() {
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    // Check what columns exist in the events table
    const columns = await sql`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'events' 
      AND (column_name LIKE '%fee%' OR column_name = 'currency')
      ORDER BY column_name
    `;
    
    console.log('\n📋 Fee-related columns in events table:');
    console.log('─'.repeat(80));
    
    const expectedColumns = [
      'currency',
      'duo_trio_fee_per_dancer',
      'entry_fee',
      'group_fee_per_dancer',
      'large_group_fee_per_dancer',
      'registration_fee_per_dancer',
      'solo_1_fee',
      'solo_2_fee',
      'solo_3_fee',
      'solo_additional_fee'
    ];
    
    columns.forEach(col => {
      const status = expectedColumns.includes(col.column_name) ? '✅' : '❓';
      console.log(`${status} ${col.column_name.padEnd(30)} ${col.data_type.padEnd(20)} Default: ${col.column_default || 'NULL'}`);
    });
    
    console.log('\n🔍 Missing columns:');
    expectedColumns.forEach(expected => {
      const exists = columns.some(col => col.column_name === expected);
      if (!exists) {
        console.log(`❌ ${expected}`);
      }
    });
    
    // Check the most recent event to see what fee values it has
    console.log('\n📊 Most recent event fee configuration:');
    const recentEvent = await sql`
      SELECT 
        name, 
        currency,
        registration_fee_per_dancer,
        solo_1_fee,
        solo_2_fee,
        solo_3_fee,
        solo_additional_fee,
        duo_trio_fee_per_dancer,
        group_fee_per_dancer,
        large_group_fee_per_dancer,
        entry_fee
      FROM events 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    
    if (recentEvent.length > 0) {
      const event = recentEvent[0];
      console.log(`Event: ${event.name}`);
      console.log(`Currency: ${event.currency || 'NULL'}`);
      console.log(`Registration Fee Per Dancer: ${event.registration_fee_per_dancer || 'NULL'}`);
      console.log(`Solo 1 Fee: ${event.solo_1_fee || 'NULL'}`);
      console.log(`Solo 2 Fee: ${event.solo_2_fee || 'NULL'}`);
      console.log(`Solo 3 Fee: ${event.solo_3_fee || 'NULL'}`);
      console.log(`Solo Additional Fee: ${event.solo_additional_fee || 'NULL'}`);
      console.log(`Duo/Trio Fee Per Dancer: ${event.duo_trio_fee_per_dancer || 'NULL'}`);
      console.log(`Group Fee Per Dancer: ${event.group_fee_per_dancer || 'NULL'}`);
      console.log(`Large Group Fee Per Dancer: ${event.large_group_fee_per_dancer || 'NULL'}`);
      console.log(`Entry Fee (deprecated): ${event.entry_fee || 'NULL'}`);
    } else {
      console.log('No events found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkEventColumns();


