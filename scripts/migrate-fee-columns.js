/**
 * Migration Script: Add Fee Configuration Columns to Events Table
 * Run this with: node scripts/migrate-fee-columns.js
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env' });

async function migrateFeeColumns() {
  console.log('🚀 Starting fee columns migration...');
  
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.error('Make sure you have a .env file with DATABASE_URL');
    process.exit(1);
  }

  const sql = neon(DATABASE_URL);

  try {
    console.log('📝 Adding fee configuration columns to events table...');
    
    // Add all fee configuration columns with IF NOT EXISTS
    await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_fee_per_dancer DECIMAL(10,2) DEFAULT 300`;
    console.log('✅ Added: registration_fee_per_dancer');
    
    await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS solo_1_fee DECIMAL(10,2) DEFAULT 400`;
    console.log('✅ Added: solo_1_fee');
    
    await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS solo_2_fee DECIMAL(10,2) DEFAULT 750`;
    console.log('✅ Added: solo_2_fee');
    
    await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS solo_3_fee DECIMAL(10,2) DEFAULT 1050`;
    console.log('✅ Added: solo_3_fee');
    
    await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS solo_additional_fee DECIMAL(10,2) DEFAULT 100`;
    console.log('✅ Added: solo_additional_fee');
    
    await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS duo_trio_fee_per_dancer DECIMAL(10,2) DEFAULT 280`;
    console.log('✅ Added: duo_trio_fee_per_dancer');
    
    await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS group_fee_per_dancer DECIMAL(10,2) DEFAULT 220`;
    console.log('✅ Added: group_fee_per_dancer');
    
    await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS large_group_fee_per_dancer DECIMAL(10,2) DEFAULT 190`;
    console.log('✅ Added: large_group_fee_per_dancer');
    
    await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'ZAR'`;
    console.log('✅ Added: currency');

    // Verify the columns were added
    console.log('\n🔍 Verifying columns...');
    const result = await sql`
      SELECT column_name, data_type, column_default
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

    console.log('\n📊 Fee Configuration Columns:');
    result.forEach(col => {
      console.log(`   ${col.column_name} (${col.data_type}) - Default: ${col.column_default}`);
    });

    console.log('\n✨ Migration completed successfully!');
    console.log('You can now create events with custom fee configurations.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('\nError details:', error.message);
    process.exit(1);
  }
}

// Run the migration
migrateFeeColumns()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });

