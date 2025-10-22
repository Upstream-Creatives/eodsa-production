require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

async function resetRegistrationFees() {
  console.log('🔄 Resetting all registration fees to FALSE...\n');
  
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    const sql = neon(process.env.DATABASE_URL);
    
    // First, check current status
    console.log('📊 Current registration fee status:');
    const beforeStatus = await sql`
      SELECT 
        COUNT(*) as total_dancers,
        COUNT(CASE WHEN registration_fee_paid = TRUE THEN 1 END) as paid_count,
        COUNT(CASE WHEN registration_fee_paid = FALSE OR registration_fee_paid IS NULL THEN 1 END) as unpaid_count
      FROM dancers
    `;
    console.log('   Total dancers:', beforeStatus[0].total_dancers);
    console.log('   With registration_fee_paid = TRUE:', beforeStatus[0].paid_count);
    console.log('   With registration_fee_paid = FALSE:', beforeStatus[0].unpaid_count);
    
    // Reset all dancers' registration fee status to FALSE
    console.log('\n🔄 Resetting all registration fees...');
    await sql`
      UPDATE dancers 
      SET registration_fee_paid = FALSE,
          registration_fee_paid_at = NULL,
          registration_fee_mastery_level = NULL
    `;
    
    // Check status after reset
    console.log('\n✅ Registration fees reset successfully!\n');
    console.log('📊 New registration fee status:');
    const afterStatus = await sql`
      SELECT 
        COUNT(*) as total_dancers,
        COUNT(CASE WHEN registration_fee_paid = TRUE THEN 1 END) as paid_count,
        COUNT(CASE WHEN registration_fee_paid = FALSE OR registration_fee_paid IS NULL THEN 1 END) as unpaid_count
      FROM dancers
    `;
    console.log('   Total dancers:', afterStatus[0].total_dancers);
    console.log('   With registration_fee_paid = TRUE:', afterStatus[0].paid_count);
    console.log('   With registration_fee_paid = FALSE:', afterStatus[0].unpaid_count);
    
    console.log('\n🎯 Result: All dancers now have registration_fee_paid = FALSE');
    console.log('💡 Registration fees will now be calculated per-event based on existing entries\n');
    
  } catch (error) {
    console.error('❌ Error resetting registration fees:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

resetRegistrationFees();

