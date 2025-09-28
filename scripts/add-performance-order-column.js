const { neon } = require('@neondatabase/serverless');

// Database connection - hardcoded for migration
const sql = neon('postgres://neondb_owner:npg_Z0wdXg6knSvy@ep-blue-glitter-a4xc1mko-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function addPerformanceOrderColumn() {
  try {
    console.log('🔧 Adding performance_order column to performances table...');
    
    // Add the performance_order column
    await sql`
      ALTER TABLE performances 
      ADD COLUMN IF NOT EXISTS performance_order INTEGER
    `;
    
    console.log('✅ Successfully added performance_order column to performances table');
    
    // Initialize performance_order to match item_number for existing records
    console.log('🔄 Initializing performance_order values from item_number...');
    await sql`
      UPDATE performances 
      SET performance_order = item_number 
      WHERE performance_order IS NULL AND item_number IS NOT NULL
    `;
    
    // For records without item_number, set performance_order based on creation order
    console.log('🔄 Setting performance_order for records without item_number...');
    await sql`
      WITH numbered_performances AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) as row_num
        FROM performances 
        WHERE performance_order IS NULL
      )
      UPDATE performances 
      SET performance_order = np.row_num
      FROM numbered_performances np
      WHERE performances.id = np.id
    `;
    
    console.log('✅ Successfully initialized performance_order values');
    
    // Verify the column was added
    const result = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'performances' AND column_name = 'performance_order'
    `;
    
    if (result.length > 0) {
      console.log('✅ Confirmed: performance_order column exists');
      console.log('Column details:', result[0]);
      
      // Show sample data
      const sampleData = await sql`
        SELECT id, item_number, performance_order, title 
        FROM performances 
        WHERE item_number IS NOT NULL 
        ORDER BY performance_order 
        LIMIT 5
      `;
      console.log('📊 Sample data:');
      console.table(sampleData);
      
    } else {
      console.log('❌ Warning: performance_order column not found after creation');
    }
    
  } catch (error) {
    console.error('❌ Error adding performance_order column:', error);
    process.exit(1);
  }
}

// Run the migration
addPerformanceOrderColumn();
