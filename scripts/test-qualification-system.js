/**
 * Quick Test Script for Event Types & Qualification System
 * 
 * This script helps verify that the database schema is set up correctly
 * and provides some basic validation checks.
 * 
 * Usage: node scripts/test-qualification-system.js
 */

const { neon } = require('@neondatabase/serverless');

async function testQualificationSystem() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  
  console.log('🧪 Testing Event Types & Qualification System...\n');

  try {
    // Test 1: Check if new columns exist in events table
    console.log('1️⃣ Checking events table columns...');
    const eventColumns = await sql`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'events'
      AND column_name IN (
        'event_type', 
        'event_mode', 
        'qualification_required', 
        'qualification_source', 
        'minimum_qualification_score'
      )
      ORDER BY column_name
    `;
    
    const requiredColumns = [
      'event_type',
      'event_mode', 
      'qualification_required',
      'qualification_source',
      'minimum_qualification_score'
    ];
    
    const foundColumns = eventColumns.map(col => col.column_name);
    const missingColumns = requiredColumns.filter(col => !foundColumns.includes(col));
    
    if (missingColumns.length > 0) {
      console.error(`   ❌ Missing columns: ${missingColumns.join(', ')}`);
      console.error('   💡 Run the migration script: node scripts/migrate-event-types-qualifications.js');
    } else {
      console.log('   ✅ All required columns exist');
      eventColumns.forEach(col => {
        console.log(`      - ${col.column_name}: ${col.data_type} (default: ${col.column_default || 'NULL'})`);
      });
    }

    // Test 2: Check if event_manual_qualifications table exists
    console.log('\n2️⃣ Checking event_manual_qualifications table...');
    const manualQualTable = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'event_manual_qualifications'
    `;
    
    if (manualQualTable.length === 0) {
      console.error('   ❌ event_manual_qualifications table does not exist');
      console.error('   💡 Run the migration script: node scripts/migrate-event-types-qualifications.js');
    } else {
      console.log('   ✅ event_manual_qualifications table exists');
      
      // Check columns
      const manualQualColumns = await sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'event_manual_qualifications'
        ORDER BY column_name
      `;
      console.log('   Columns:');
      manualQualColumns.forEach(col => {
        console.log(`      - ${col.column_name}: ${col.data_type}`);
      });
    }

    // Test 3: Check if qualification_audit_logs table exists
    console.log('\n3️⃣ Checking qualification_audit_logs table...');
    const auditLogTable = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'qualification_audit_logs'
    `;
    
    if (auditLogTable.length === 0) {
      console.error('   ❌ qualification_audit_logs table does not exist');
      console.error('   💡 Run the migration script: node scripts/migrate-event-types-qualifications.js');
    } else {
      console.log('   ✅ qualification_audit_logs table exists');
    }

    // Test 4: Check existing events have default values
    console.log('\n4️⃣ Checking existing events configuration...');
    const events = await sql`
      SELECT 
        id,
        name,
        event_type,
        event_mode,
        qualification_required,
        qualification_source,
        minimum_qualification_score
      FROM events
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    if (events.length === 0) {
      console.log('   ℹ️  No events found in database');
    } else {
      console.log(`   Found ${events.length} recent events:`);
      events.forEach(event => {
        const issues = [];
        if (!event.event_type) issues.push('missing event_type');
        if (!event.event_mode) issues.push('missing event_mode');
        if (event.qualification_required === null) issues.push('qualification_required is null');
        
        if (issues.length > 0) {
          console.log(`      ⚠️  ${event.name}: ${issues.join(', ')}`);
        } else {
          console.log(`      ✅ ${event.name}: ${event.event_type} / ${event.event_mode}`);
        }
      });
    }

    // Test 5: Check for indexes
    console.log('\n5️⃣ Checking indexes...');
    const indexes = await sql`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE tablename IN ('event_manual_qualifications', 'qualification_audit_logs')
      ORDER BY tablename, indexname
    `;
    
    if (indexes.length === 0) {
      console.log('   ⚠️  No indexes found (this is okay if tables are empty)');
    } else {
      console.log('   ✅ Found indexes:');
      indexes.forEach(idx => {
        console.log(`      - ${idx.tablename}.${idx.indexname}`);
      });
    }

    // Test 6: Check constraint validity
    console.log('\n6️⃣ Checking constraints...');
    const constraints = await sql`
      SELECT 
        conname as constraint_name,
        contype as constraint_type,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'events'::regclass
      AND conname LIKE '%event_type%' OR conname LIKE '%event_mode%' OR conname LIKE '%qualification%'
      ORDER BY conname
    `;
    
    if (constraints.length > 0) {
      console.log('   ✅ Found constraints:');
      constraints.forEach(con => {
        console.log(`      - ${con.constraint_name}: ${con.definition}`);
      });
    } else {
      console.log('   ⚠️  No constraints found (check migration script)');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Summary');
    console.log('='.repeat(60));
    
    const allTestsPassed = 
      missingColumns.length === 0 &&
      manualQualTable.length > 0 &&
      auditLogTable.length > 0;
    
    if (allTestsPassed) {
      console.log('✅ All database schema checks passed!');
      console.log('\n💡 Next steps:');
      console.log('   1. Review TESTING_GUIDE.md for manual testing steps');
      console.log('   2. Test event creation with different event types');
      console.log('   3. Test qualification validation with real entries');
      console.log('   4. Test manual qualifications UI');
    } else {
      console.log('❌ Some checks failed. Please run the migration script:');
      console.log('   node scripts/migrate-event-types-qualifications.js');
    }
    
  } catch (error) {
    console.error('\n❌ Error running tests:', error);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Run tests
testQualificationSystem()
  .then(() => {
    console.log('\n✨ Test script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

