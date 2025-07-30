#!/usr/bin/env node

/**
 * Migration Script: Add Payment Reference Columns
 * 
 * This script adds the new payment tracking columns to the event_entries table:
 * - payment_reference TEXT (for storing transaction IDs, check numbers, etc.)
 * - payment_date TEXT (for storing when payment was processed)
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

async function addPaymentReferenceColumns() {
  console.log('🚀 Starting payment reference columns migration...');
  
  try {
    // Use DATABASE_URL from environment variables (.env.local, .env, etc.)
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL environment variable is required');
      console.error('💡 Make sure you have DATABASE_URL in one of these files:');
      console.error('   - .env.local (recommended for Next.js)');
      console.error('   - .env');
      console.error('   - .env.development');
      throw new Error('DATABASE_URL environment variable is required');
    }
    
    const sql = neon(process.env.DATABASE_URL);
    
    // Check if migration is needed
    console.log('🔍 Checking current schema...');
    const tableInfo = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'event_entries' 
      AND table_schema = 'public'
      AND column_name IN ('payment_reference', 'payment_date')
    `;
    const existingColumns = tableInfo.map(col => col.column_name);
    
    const hasPaymentReference = existingColumns.includes('payment_reference');
    const hasPaymentDate = existingColumns.includes('payment_date');
    
    if (hasPaymentReference && hasPaymentDate) {
      console.log('✅ Database already has payment reference columns');
      return;
    }
    
    console.log('🔄 Adding payment tracking columns to event_entries table...');
    
    // Add payment_reference column
    if (!hasPaymentReference) {
      console.log('📝 Adding payment_reference column...');
      await sql`
        ALTER TABLE event_entries 
        ADD COLUMN payment_reference TEXT
      `;
      console.log('✅ Successfully added payment_reference column');
    } else {
      console.log('⏭️ payment_reference column already exists');
    }
    
    // Add payment_date column
    if (!hasPaymentDate) {
      console.log('📝 Adding payment_date column...');
      await sql`
        ALTER TABLE event_entries 
        ADD COLUMN payment_date TEXT
      `;
      console.log('✅ Successfully added payment_date column');
    } else {
      console.log('⏭️ payment_date column already exists');
    }
    
    // Verify the columns were added
    console.log('🔍 Verifying columns were added...');
    const result = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'event_entries' 
      AND column_name IN ('payment_reference', 'payment_date')
      ORDER BY column_name
    `;
    
    if (result.length >= 2) {
      console.log('✅ Column verification successful:');
      result.forEach(col => {
        console.log(`   - Column: ${col.column_name}`);
        console.log(`     Type: ${col.data_type}`);
        console.log(`     Nullable: ${col.is_nullable}`);
        console.log(`     Default: ${col.column_default || 'NULL'}`);
      });
    } else {
      console.log('❌ Column verification failed - some columns not found');
    }
    
    // Check current event entries count to show impact
    const entryCount = await sql`SELECT COUNT(*) as count FROM event_entries`;
    console.log(`📊 Total event entries in database: ${entryCount[0].count}`);
    
    // Show sample of existing entries with payment status
    if (entryCount[0].count > 0) {
      const sampleEntries = await sql`
        SELECT payment_status, COUNT(*) as count 
        FROM event_entries 
        GROUP BY payment_status
      `;
      console.log('📈 Current payment status distribution:');
      sampleEntries.forEach(entry => {
        console.log(`   - ${entry.payment_status}: ${entry.count} entries`);
      });
    }
    
    console.log('🎉 Payment reference columns migration completed successfully!');
    console.log('');
    console.log('📋 What was added:');
    console.log('   - payment_reference: For storing transaction IDs, check numbers, etc.');
    console.log('   - payment_date: For storing when payment was processed');
    console.log('');
    console.log('🔄 Next steps:');
    console.log('   - Restart your application to use the new columns');
    console.log('   - Admin users can now track payment references when marking entries as paid');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('');
    console.error('🔧 Troubleshooting:');
    console.error('   - Ensure DATABASE_URL environment variable is set');
    console.error('   - Check database connection and permissions');
    console.error('   - Verify the event_entries table exists');
    process.exit(1);
  }
}

// Run the migration if called directly
if (require.main === module) {
  addPaymentReferenceColumns();
}

module.exports = { addPaymentReferenceColumns };