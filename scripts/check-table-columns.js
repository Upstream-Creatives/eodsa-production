// Check actual table column structure from database
const { neon } = require('@neondatabase/serverless');

async function checkTableColumns() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const sql = neon(DATABASE_URL);

  try {
    console.log('📋 CHECKING TABLE STRUCTURES\n');

    // Check event_entries table
    console.log('🎯 EVENT_ENTRIES TABLE COLUMNS:');
    const eventEntriesColumns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'event_entries'
      ORDER BY ordinal_position
    `;
    
    eventEntriesColumns.forEach((col, index) => {
      console.log(`${index + 1}. ${col.column_name} (${col.data_type})`);
    });

    console.log('\n🎭 DANCERS TABLE COLUMNS:');
    const dancersColumns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'dancers'
      ORDER BY ordinal_position
    `;
    
    dancersColumns.forEach((col, index) => {
      console.log(`${index + 1}. ${col.column_name} (${col.data_type})`);
    });

    console.log('\n👥 CONTESTANTS TABLE COLUMNS:');
    const contestantsColumns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'contestants'
      ORDER BY ordinal_position
    `;
    
    contestantsColumns.forEach((col, index) => {
      console.log(`${index + 1}. ${col.column_name} (${col.data_type})`);
    });

    console.log('\n🎪 PERFORMANCES TABLE COLUMNS:');
    const performancesColumns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'performances'
      ORDER BY ordinal_position
    `;
    
    performancesColumns.forEach((col, index) => {
      console.log(`${index + 1}. ${col.column_name} (${col.data_type})`);
    });

  } catch (error) {
    console.error('💥 Error checking table columns:', error);
    process.exit(1);
  }
}

checkTableColumns();
