/**
 * Migration Script: Event Types & Qualification System
 * 
 * This script adds:
 * - event_type, event_mode, qualification_required, qualification_source, minimum_qualification_score columns to events table
 * - event_manual_qualifications table
 * - qualification_audit_logs table
 * 
 * Run: node scripts/migrate-event-types-qualifications.js
 * Rollback: See ROLLBACK.sql at the end of this file
 */

const { neon } = require('@neondatabase/serverless');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function migrate() {
  try {
    console.log('🚀 Starting Event Types & Qualification System migration...\n');

    // Step 1: Add new columns to events table
    console.log('📝 Step 1: Adding new columns to events table...');
    
    await sql`
      ALTER TABLE events 
      ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'REGIONAL_EVENT' 
      CHECK (event_type IN ('REGIONAL_EVENT', 'NATIONAL_EVENT', 'QUALIFIER_EVENT', 'INTERNATIONAL_VIRTUAL_EVENT'))
    `;
    console.log('  ✅ Added event_type column');

    await sql`
      ALTER TABLE events 
      ADD COLUMN IF NOT EXISTS event_mode TEXT NOT NULL DEFAULT 'HYBRID' 
      CHECK (event_mode IN ('LIVE', 'VIRTUAL', 'HYBRID'))
    `;
    console.log('  ✅ Added event_mode column');

    await sql`
      ALTER TABLE events 
      ADD COLUMN IF NOT EXISTS qualification_required BOOLEAN NOT NULL DEFAULT FALSE
    `;
    console.log('  ✅ Added qualification_required column');

    await sql`
      ALTER TABLE events 
      ADD COLUMN IF NOT EXISTS qualification_source TEXT 
      CHECK (qualification_source IN ('NONE', 'REGIONAL', 'ANY_NATIONAL_LEVEL', 'MANUAL', 'CUSTOM'))
    `;
    console.log('  ✅ Added qualification_source column');

    await sql`
      ALTER TABLE events 
      ADD COLUMN IF NOT EXISTS minimum_qualification_score INTEGER
    `;
    console.log('  ✅ Added minimum_qualification_score column\n');

    // Step 2: Create event_manual_qualifications table
    console.log('📝 Step 2: Creating event_manual_qualifications table...');
    await sql`
      CREATE TABLE IF NOT EXISTS event_manual_qualifications (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        dancer_id TEXT NOT NULL,
        added_by TEXT,
        created_at TIMESTAMP DEFAULT now()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_event_manual_qualifications_event_id ON event_manual_qualifications(event_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_event_manual_qualifications_dancer_id ON event_manual_qualifications(dancer_id)`;
    console.log('  ✅ Created event_manual_qualifications table with indexes\n');

    // Step 3: Create qualification_audit_logs table
    console.log('📝 Step 3: Creating qualification_audit_logs table...');
    await sql`
      CREATE TABLE IF NOT EXISTS qualification_audit_logs (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        event_id TEXT,
        dancer_id TEXT,
        action_type TEXT NOT NULL,
        action_details JSONB,
        performed_by TEXT,
        performed_at TIMESTAMP DEFAULT now()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_qualification_audit_logs_event_id ON qualification_audit_logs(event_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_qualification_audit_logs_dancer_id ON qualification_audit_logs(dancer_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_qualification_audit_logs_action_type ON qualification_audit_logs(action_type)`;
    console.log('  ✅ Created qualification_audit_logs table with indexes\n');

    // Step 4: Migrate existing events
    console.log('📝 Step 4: Migrating existing events...');
    const existingEvents = await sql`
      SELECT id, name, event_type FROM events
    `;

    let migratedCount = 0;
    for (const event of existingEvents) {
      // If event_type is already set (not default), skip
      if (event.event_type && event.event_type !== 'REGIONAL_EVENT') {
        continue;
      }

      // Best-effort: if name contains "national" (case-insensitive), set to NATIONAL_EVENT
      const nameLower = (event.name || '').toLowerCase();
      if (nameLower.includes('national')) {
        await sql`
          UPDATE events 
          SET event_type = 'NATIONAL_EVENT',
              qualification_required = true,
              qualification_source = 'REGIONAL',
              minimum_qualification_score = 75
          WHERE id = ${event.id}
        `;
        migratedCount++;
        console.log(`  ✅ Migrated event "${event.name}" to NATIONAL_EVENT`);
      }
    }

    if (migratedCount === 0) {
      console.log('  ℹ️  No events needed migration (all already set or no "national" in name)');
    } else {
      console.log(`  ✅ Migrated ${migratedCount} event(s)\n`);
    }

    console.log('✅ Migration completed successfully!\n');
    console.log('📋 Summary:');
    console.log('  • Added 5 new columns to events table');
    console.log('  • Created event_manual_qualifications table');
    console.log('  • Created qualification_audit_logs table');
    console.log(`  • Migrated ${migratedCount} existing event(s)\n`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('🎉 Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

/**
 * ROLLBACK SQL
 * 
 * To rollback this migration, run the following SQL commands:
 * 
 * -- Drop tables
 * DROP TABLE IF EXISTS qualification_audit_logs CASCADE;
 * DROP TABLE IF EXISTS event_manual_qualifications CASCADE;
 * 
 * -- Drop columns from events table
 * ALTER TABLE events DROP COLUMN IF EXISTS minimum_qualification_score;
 * ALTER TABLE events DROP COLUMN IF EXISTS qualification_source;
 * ALTER TABLE events DROP COLUMN IF EXISTS qualification_required;
 * ALTER TABLE events DROP COLUMN IF EXISTS event_mode;
 * ALTER TABLE events DROP COLUMN IF EXISTS event_type;
 * 
 * Note: This will remove all qualification data. Use with caution.
 */

