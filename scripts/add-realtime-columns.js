/**
 * Migration Script: Add Real-time Support Columns
 * Adds status and display_order columns for real-time event management
 */

const { neon } = require('@neondatabase/serverless');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function addRealtimeColumns() {
  try {
    console.log('🚀 Starting real-time support migration...\n');

    // Add status column to performances table
    console.log('📝 Adding status column to performances...');
    await sql`
      ALTER TABLE performances 
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'scheduled' 
      CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled'))
    `;

    // Add display_order column to performances
    console.log('📝 Adding display_order column to performances...');
    await sql`
      ALTER TABLE performances 
      ADD COLUMN IF NOT EXISTS display_order INTEGER
    `;

    // Add display_order column to event_entries
    console.log('📝 Adding display_order column to event_entries...');
    await sql`
      ALTER TABLE event_entries 
      ADD COLUMN IF NOT EXISTS display_order INTEGER
    `;

    // Add updated_at column to performances for change tracking
    console.log('📝 Adding updated_at column to performances...');
    await sql`
      ALTER TABLE performances 
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `;

    // Set initial display_order values based on item_number
    console.log('📝 Setting initial display_order values...');
    
    // For event_entries
    await sql`
      UPDATE event_entries 
      SET display_order = item_number 
      WHERE item_number IS NOT NULL AND display_order IS NULL
    `;

    // For performances
    await sql`
      UPDATE performances 
      SET display_order = item_number 
      WHERE item_number IS NOT NULL AND display_order IS NULL
    `;

    // Create index for better performance on queries
    console.log('📝 Creating indexes for performance optimization...');
    
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_performances_status ON performances(status)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_performances_display_order ON performances(display_order)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_event_entries_display_order ON event_entries(display_order)`;
    } catch (indexError) {
      console.warn('⚠️ Some indexes may already exist:', indexError.message);
    }

    // Verify the changes
    console.log('🔍 Verifying table structure...');
    
    const performancesStructure = await sql`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'performances' 
      AND column_name IN ('status', 'display_order', 'updated_at')
      ORDER BY column_name
    `;

    const entriesStructure = await sql`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'event_entries' 
      AND column_name = 'display_order'
    `;

    console.log('\n✅ Performances table columns:');
    performancesStructure.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (default: ${col.column_default || 'none'})`);
    });

    console.log('\n✅ Event entries table columns:');
    entriesStructure.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (default: ${col.column_default || 'none'})`);
    });

    // Count updated records
    const updatedPerformances = await sql`
      SELECT COUNT(*) as count FROM performances WHERE display_order IS NOT NULL
    `;
    
    const updatedEntries = await sql`
      SELECT COUNT(*) as count FROM event_entries WHERE display_order IS NOT NULL
    `;

    console.log(`\n📊 Migration completed successfully!`);
    console.log(`   Updated ${updatedPerformances[0].count} performances with display_order`);
    console.log(`   Updated ${updatedEntries[0].count} entries with display_order`);
    console.log('\n🎭 Your system is now ready for real-time backstage control!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
addRealtimeColumns();
