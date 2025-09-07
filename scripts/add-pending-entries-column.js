// Add pending_entries_data column to payments table
// This allows webhook to automatically create entries after successful payment

const { neon } = require('@neondatabase/serverless');

async function addPendingEntriesColumn() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const sql = neon(DATABASE_URL);

  try {
    console.log('🏗️  Adding pending_entries_data column to payments table...');

    // Add pending_entries_data column to store entry data for batch payments
    await sql`
      ALTER TABLE payments 
      ADD COLUMN IF NOT EXISTS pending_entries_data JSONB
    `;

    console.log('✅ Successfully added pending_entries_data column to payments table');
    console.log('🎯 Webhook can now automatically create entries after successful payment');

  } catch (error) {
    console.error('💥 Database migration error:', error);
    process.exit(1);
  }
}

// Run the migration
addPendingEntriesColumn();
