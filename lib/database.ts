import { neon } from '@neondatabase/serverless';
import type { Contestant, Performance, Judge, Score, Dancer, EventEntry, Ranking, Event } from './types';

// Create database connection using Neon serverless driver
// Only initialize if we have a DATABASE_URL (server-side only)
let sql: ReturnType<typeof neon> | null = null;

const getSql = () => {
  if (!sql) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    sql = neon(databaseUrl);
  }
  return sql;
};

// Generate E-O-D-S-A-ID in new format: letter + 6 digits (e.g. "E123456")
export const generateEODSAId = () => {
  const letter = 'E';
  const digits = Math.floor(100000 + Math.random() * 900000); // 6 digits
  return `${letter}${digits}`;
};

// Generate Studio Registration Number: letter + 6 digits (e.g. "S123456")
export const generateStudioRegistrationId = () => {
  const letter = 'S';
  const digits = Math.floor(100000 + Math.random() * 900000); // 6 digits
  return `${letter}${digits}`;
};

// Initialize database tables for Phase 1
export const initializeDatabase = async () => {
  try {
    const sqlClient = getSql();
    
    // First, try to ensure all tables exist with proper schema
    console.log('🔄 Checking and fixing database schema...');
    
    // Handle dancers table specially since it's causing issues
    try {
      // Check if dancers table has the required eodsa_id column
      await sqlClient`SELECT eodsa_id FROM dancers LIMIT 1`;
      console.log('✅ Dancers table schema is correct');
    } catch (error) {
      console.log('❌ Dancers table needs fixing, recreating with proper schema...');
      
      // Drop and recreate dancers table with correct schema
      try {
        await sqlClient`DROP TABLE IF EXISTS studio_applications`;  // Drop dependent table first
        await sqlClient`DROP TABLE IF EXISTS waivers`;  // Drop dependent table first
        await sqlClient`DROP TABLE IF EXISTS password_reset_tokens`;  // Drop dependent table first
        await sqlClient`DROP TABLE IF EXISTS dancers`;
        console.log('Dropped old dancers table');
      } catch (dropError) {
        console.log('Could not drop dancers table (might not exist)');
      }
      
      // Create dancers table with proper schema
      await sqlClient`
        CREATE TABLE dancers (
          id TEXT PRIMARY KEY,
          eodsa_id TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          date_of_birth TEXT NOT NULL,
          age INTEGER NOT NULL,
          national_id TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          guardian_name TEXT,
          guardian_email TEXT,
          guardian_phone TEXT,
          approved BOOLEAN DEFAULT FALSE,
          approved_by TEXT,
          approved_at TEXT,
          rejection_reason TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      console.log('✅ Created dancers table with proper schema');
      
      // Recreate dependent tables
      await sqlClient`
        CREATE TABLE IF NOT EXISTS studio_applications (
          id TEXT PRIMARY KEY,
          dancer_id TEXT NOT NULL,
          studio_id TEXT NOT NULL,
          status TEXT CHECK(status IN ('pending', 'accepted', 'rejected', 'withdrawn')) DEFAULT 'pending',
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          responded_at TIMESTAMP,
          responded_by TEXT,
          rejection_reason TEXT,
          FOREIGN KEY (dancer_id) REFERENCES dancers (id) ON DELETE CASCADE,
          FOREIGN KEY (studio_id) REFERENCES studios (id) ON DELETE CASCADE,
          UNIQUE(dancer_id, studio_id)
        )
      `;
      
      await sqlClient`
        CREATE TABLE IF NOT EXISTS waivers (
          id TEXT PRIMARY KEY,
          dancer_id TEXT NOT NULL,
          parent_name TEXT NOT NULL,
          parent_email TEXT NOT NULL,
          parent_phone TEXT NOT NULL,
          relationship_to_dancer TEXT NOT NULL,
          signed_date TEXT NOT NULL,
          signature_path TEXT NOT NULL,
          id_document_path TEXT NOT NULL,
          approved BOOLEAN DEFAULT FALSE,
          approved_by TEXT,
          approved_at TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (dancer_id) REFERENCES dancers (id) ON DELETE CASCADE
        )
      `;
      console.log('✅ Recreated dependent tables');
    }
    
    // Check if all required tables exist and have the correct schema
    try {
      await sqlClient`SELECT 1 FROM contestants LIMIT 1`;
      await sqlClient`SELECT 1 FROM studios LIMIT 1`;
      await sqlClient`SELECT 1 FROM judges LIMIT 1`;
      await sqlClient`SELECT 1 FROM dancers LIMIT 1`;
      await sqlClient`SELECT 1 FROM studio_applications LIMIT 1`;
      
      // Check and fix contestants table schema
      try {
        await sqlClient`SELECT date_of_birth FROM contestants LIMIT 1`;
      } catch {
        console.log('Adding date_of_birth column to contestants table...');
        await sqlClient`ALTER TABLE contestants ADD COLUMN IF NOT EXISTS date_of_birth TEXT`;
      }

      // Check and fix studios table schema for approval workflow
      try {
        await sqlClient`SELECT approved_by FROM studios LIMIT 1`;
      } catch {
        console.log('Adding approval columns to studios table...');
        await sqlClient`ALTER TABLE studios ADD COLUMN IF NOT EXISTS approved_by TEXT`;
        await sqlClient`ALTER TABLE studios ADD COLUMN IF NOT EXISTS approved_at TEXT`;
        await sqlClient`ALTER TABLE studios ADD COLUMN IF NOT EXISTS rejection_reason TEXT`;
      }
      
      // Ensure schema is up to date with migrations
      try {
        // Check if qualified_for_nationals column exists, add if not
        const columnCheck = await sqlClient`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'event_entries' 
          AND column_name = 'qualified_for_nationals'
        ` as any[];
        
        if (columnCheck.length === 0) {
          await sqlClient`
            ALTER TABLE event_entries 
            ADD COLUMN qualified_for_nationals BOOLEAN DEFAULT FALSE
          `;
          console.log('✅ Added qualified_for_nationals column to event_entries');
        } else {
          console.log('✅ qualified_for_nationals column already exists');
        }

        // Check if item_number column exists, add if not
        const itemNumberCheck = await sqlClient`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'event_entries' 
          AND column_name = 'item_number'
        ` as any[];
        
        if (itemNumberCheck.length === 0) {
          await sqlClient`
            ALTER TABLE event_entries 
            ADD COLUMN item_number INTEGER
          `;
          console.log('✅ Added item_number column to event_entries');
        } else {
          console.log('✅ item_number column already exists');
        }

        // Check and add missing contestants table columns
        const contestantsColumns = [
          { name: 'guardian_name', type: 'TEXT' },
          { name: 'guardian_email', type: 'TEXT' },
          { name: 'guardian_cell', type: 'TEXT' },
          { name: 'privacy_policy_accepted', type: 'BOOLEAN DEFAULT FALSE' },
          { name: 'privacy_policy_accepted_at', type: 'TEXT' },
          { name: 'studio_name', type: 'TEXT' },
          { name: 'studio_address', type: 'TEXT' },
          { name: 'studio_contact_person', type: 'TEXT' },
          { name: 'studio_registration_number', type: 'TEXT' }
        ];

        // Check if event_end_date column exists in events table, add if not
        const eventEndDateCheck = await sqlClient`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'events' 
          AND column_name = 'event_end_date'
        ` as any[];
        
        if (eventEndDateCheck.length === 0) {
          await sqlClient`
            ALTER TABLE events 
            ADD COLUMN event_end_date TEXT
          `;
          console.log('✅ Added event_end_date column to events table');
        } else {
          console.log('✅ event_end_date column already exists in events table');
        }

        for (const column of contestantsColumns) {
          const columnCheck = await sqlClient`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'contestants' 
            AND column_name = ${column.name}
          ` as any[];
          
          if (columnCheck.length === 0) {
            // Use dynamic SQL construction for ALTER TABLE
            const alterSQL = `ALTER TABLE contestants ADD COLUMN ${column.name} ${column.type}`;
            await sqlClient.unsafe(alterSQL);
            console.log(`✅ Added ${column.name} column to contestants`);
          } else {
            console.log(`✅ ${column.name} column already exists in contestants`);
          }
        }

        // Drop the foreign key constraint for event_entries to allow unified system
        try {
          // List ALL constraints on event_entries table for debugging
          const allConstraints = await sqlClient`
            SELECT constraint_name, constraint_type 
            FROM information_schema.table_constraints 
            WHERE table_name = 'event_entries'
          ` as any[];
          
          console.log('🔍 All constraints on event_entries:', allConstraints);
          
          // Check specifically for the foreign key constraint
          const constraintCheck = await sqlClient`
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'event_entries' 
            AND constraint_type = 'FOREIGN KEY'
            AND constraint_name = 'event_entries_contestant_id_fkey'
          ` as any[];
          
          if (constraintCheck.length > 0) {
            try {
              // Try multiple methods to drop the constraint
              console.log('🔧 Attempting to drop constraint with CASCADE...');
              await sqlClient.unsafe(`ALTER TABLE event_entries DROP CONSTRAINT event_entries_contestant_id_fkey CASCADE`);
              console.log('✅ DROPPED with CASCADE');
            } catch (cascadeError) {
              console.log('CASCADE failed, trying without CASCADE:', cascadeError);
              try {
                await sqlClient.unsafe(`ALTER TABLE event_entries DROP CONSTRAINT event_entries_contestant_id_fkey`);
                console.log('✅ DROPPED without CASCADE');
              } catch (normalError) {
                console.log('❌ Both methods failed:', normalError);
              }
            }
            
            // Verify it's gone
            const verifyCheck = await sqlClient`
              SELECT constraint_name 
              FROM information_schema.table_constraints 
              WHERE table_name = 'event_entries' 
              AND constraint_type = 'FOREIGN KEY'
              AND constraint_name = 'event_entries_contestant_id_fkey'
            ` as any[];
            
            if (verifyCheck.length === 0) {
              console.log('✅ VERIFIED: Foreign key constraint is FINALLY GONE!');
            } else {
              console.log('❌ CONSTRAINT STILL EXISTS! Trying aggressive approach...');
              
              // Last resort: recreate the table without the constraint
              console.log('🚨 LAST RESORT: Will skip foreign key validation in createEventEntry');
            }
          } else {
            console.log('✅ Foreign key constraint event_entries_contestant_id_fkey does not exist');
          }
        } catch (fkError) {
          console.log('Foreign key constraint operation error:', fkError);
        }
        
        console.log('Schema migrations completed successfully');
      } catch (migrationError) {
        console.log('Migration error:', migrationError);
      }

      console.log('✅ All database tables exist and are properly configured');
      return;
    } catch (error) {
      // Some tables don't exist yet, continue with initialization
      console.log('📋 Creating missing database tables...');
    }
    
    console.log('🔄 Initializing database tables...');
    
    // Create contestants table with updated fields
    await sqlClient`
      CREATE TABLE IF NOT EXISTS contestants (
        id TEXT PRIMARY KEY,
        eodsa_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT NOT NULL,
        type TEXT CHECK(type IN ('studio', 'private')) NOT NULL,
        date_of_birth TEXT NOT NULL,
        guardian_name TEXT,
        guardian_email TEXT,
        guardian_cell TEXT,
        privacy_policy_accepted BOOLEAN NOT NULL DEFAULT FALSE,
        privacy_policy_accepted_at TEXT,
        studio_name TEXT,
        studio_address TEXT,
        studio_contact_person TEXT,
        studio_registration_number TEXT,
        registration_date TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create independent dancers table (NEW UNIFIED SYSTEM)
    await sqlClient`
      CREATE TABLE IF NOT EXISTS dancers (
        id TEXT PRIMARY KEY,
        eodsa_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        date_of_birth TEXT NOT NULL,
        age INTEGER NOT NULL,
        national_id TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        phone TEXT,
        guardian_name TEXT,
        guardian_email TEXT,
        guardian_phone TEXT,
        approved BOOLEAN DEFAULT FALSE,
        approved_by TEXT,
        approved_at TEXT,
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create studio applications table (NEW UNIFIED SYSTEM)
    await sqlClient`
      CREATE TABLE IF NOT EXISTS studio_applications (
        id TEXT PRIMARY KEY,
        dancer_id TEXT NOT NULL,
        studio_id TEXT NOT NULL,
        status TEXT CHECK(status IN ('pending', 'accepted', 'rejected', 'withdrawn')) DEFAULT 'pending',
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        responded_at TIMESTAMP,
        responded_by TEXT,
        rejection_reason TEXT,
        FOREIGN KEY (dancer_id) REFERENCES dancers (id) ON DELETE CASCADE,
        FOREIGN KEY (studio_id) REFERENCES studios (id) ON DELETE CASCADE,
        UNIQUE(dancer_id, studio_id)
      )
    `;

    // Create waivers table for minors under 18
    await sqlClient`
      CREATE TABLE IF NOT EXISTS waivers (
        id TEXT PRIMARY KEY,
        dancer_id TEXT NOT NULL,
        parent_name TEXT NOT NULL,
        parent_email TEXT NOT NULL,
        parent_phone TEXT NOT NULL,
        relationship_to_dancer TEXT NOT NULL,
        signed_date TEXT NOT NULL,
        signature_path TEXT NOT NULL,
        id_document_path TEXT NOT NULL,
        approved BOOLEAN DEFAULT FALSE,
        approved_by TEXT,
        approved_at TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dancer_id) REFERENCES dancers (id) ON DELETE CASCADE
      )
    `;

    // Create judges table
    await sqlClient`
      CREATE TABLE IF NOT EXISTS judges (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        specialization TEXT, -- JSON array of specializations
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create studios table for studio authentication and management
    await sqlClient`
      CREATE TABLE IF NOT EXISTS studios (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        contact_person TEXT NOT NULL,
        address TEXT NOT NULL,
        phone TEXT NOT NULL,
        registration_number TEXT UNIQUE NOT NULL,
        approved BOOLEAN DEFAULT FALSE,
        approved_by TEXT,
        approved_at TEXT,
        rejection_reason TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Ensure studios table has all required columns (for existing databases)
    try {
      await sqlClient`ALTER TABLE studios ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT FALSE`;
      await sqlClient`ALTER TABLE studios ADD COLUMN IF NOT EXISTS approved_by TEXT`;
      await sqlClient`ALTER TABLE studios ADD COLUMN IF NOT EXISTS approved_at TEXT`;
      await sqlClient`ALTER TABLE studios ADD COLUMN IF NOT EXISTS rejection_reason TEXT`;
    } catch (error) {
      // Columns might already exist, that's okay
      console.log('Studio columns already exist or error adding them:', error);
    }

    // Create password reset tokens table
    await sqlClient`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        user_type TEXT CHECK(user_type IN ('judge', 'admin', 'studio')) NOT NULL,
        user_id TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Keep existing tables for competitions...
    await sqlClient`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        region TEXT CHECK(region IN ('Gauteng', 'Free State', 'Mpumalanga', 'Western Cape', 'Eastern Cape', 'Northern Cape', 'North West', 'Limpopo', 'KwaZulu-Natal')) NOT NULL,
        age_category TEXT NOT NULL,
        performance_type TEXT CHECK(performance_type IN ('Solo', 'Duet', 'Trio', 'Group', 'All')) NOT NULL,
        event_date TEXT NOT NULL,
        event_end_date TEXT,
        registration_deadline TEXT NOT NULL,
        venue TEXT NOT NULL,
        status TEXT CHECK(status IN ('upcoming', 'registration_open', 'registration_closed', 'in_progress', 'completed')) DEFAULT 'upcoming',
        max_participants INTEGER,
        entry_fee DECIMAL(10,2) NOT NULL,
        created_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES judges (id) ON DELETE CASCADE
      )
    `;

    // Continue with other existing tables...
    await sqlClient`
      CREATE TABLE IF NOT EXISTS judge_event_assignments (
        id TEXT PRIMARY KEY,
        judge_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        assigned_by TEXT NOT NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status TEXT CHECK(status IN ('active', 'inactive')) DEFAULT 'active',
        FOREIGN KEY (judge_id) REFERENCES judges (id) ON DELETE CASCADE,
        FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_by) REFERENCES judges (id) ON DELETE CASCADE,
        UNIQUE(judge_id, event_id)
      )
    `;

    await sqlClient`
      CREATE TABLE IF NOT EXISTS event_entries (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        contestant_id TEXT NOT NULL,
        eodsa_id TEXT NOT NULL,
        participant_ids TEXT NOT NULL,
        calculated_fee DECIMAL(10,2) NOT NULL,
        payment_status TEXT CHECK(payment_status IN ('pending', 'paid', 'failed')) DEFAULT 'pending',
        payment_method TEXT CHECK(payment_method IN ('credit_card', 'bank_transfer', 'invoice')),
        submitted_at TEXT NOT NULL,
        approved BOOLEAN DEFAULT FALSE,
        qualified_for_nationals BOOLEAN DEFAULT FALSE,
        item_number INTEGER,
        item_name TEXT NOT NULL,
        choreographer TEXT NOT NULL,
        mastery TEXT NOT NULL,
        item_style TEXT NOT NULL,
        estimated_duration INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
        FOREIGN KEY (contestant_id) REFERENCES contestants (id) ON DELETE CASCADE
      )
    `;

    await sqlClient`
      CREATE TABLE IF NOT EXISTS performances (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        event_entry_id TEXT NOT NULL,
        contestant_id TEXT NOT NULL,
        title TEXT NOT NULL,
        participant_names TEXT NOT NULL,
        duration INTEGER NOT NULL,
        item_number INTEGER,
        choreographer TEXT NOT NULL,
        mastery TEXT NOT NULL,
        item_style TEXT NOT NULL,
        scheduled_time TEXT,
        status TEXT CHECK(status IN ('scheduled', 'in_progress', 'completed', 'cancelled')) DEFAULT 'scheduled',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
        FOREIGN KEY (event_entry_id) REFERENCES event_entries (id) ON DELETE CASCADE,
        FOREIGN KEY (contestant_id) REFERENCES contestants (id) ON DELETE CASCADE
      )
    `;

    await sqlClient`
      CREATE TABLE IF NOT EXISTS scores (
        id TEXT PRIMARY KEY,
        judge_id TEXT NOT NULL,
        performance_id TEXT NOT NULL,
        technical_score DECIMAL(3,1) CHECK(technical_score >= 0 AND technical_score <= 20) NOT NULL,
        musical_score DECIMAL(3,1) CHECK(musical_score >= 0 AND musical_score <= 20) NOT NULL,
        performance_score DECIMAL(3,1) CHECK(performance_score >= 0 AND performance_score <= 20) NOT NULL,
        styling_score DECIMAL(3,1) CHECK(styling_score >= 0 AND styling_score <= 20) NOT NULL,
        overall_impression_score DECIMAL(3,1) CHECK(overall_impression_score >= 0 AND overall_impression_score <= 20) NOT NULL,
        comments TEXT,
        submitted_at TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (judge_id) REFERENCES judges (id) ON DELETE CASCADE,
        FOREIGN KEY (performance_id) REFERENCES performances (id) ON DELETE CASCADE,
        UNIQUE(judge_id, performance_id)
      )
    `;

    await sqlClient`
      CREATE TABLE IF NOT EXISTS rankings (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        performance_id TEXT NOT NULL,
        total_score DECIMAL(5,2) NOT NULL,
        average_score DECIMAL(4,2) NOT NULL,
        rank_position INTEGER NOT NULL,
        calculated_at TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
        FOREIGN KEY (performance_id) REFERENCES performances (id) ON DELETE CASCADE
      )
    `;

    await sqlClient`
      CREATE TABLE IF NOT EXISTS fee_schedule (
        id TEXT PRIMARY KEY,
        age_category TEXT UNIQUE NOT NULL,
        solo_fee DECIMAL(10,2) NOT NULL,
        duet_fee DECIMAL(10,2) NOT NULL,
        trio_fee DECIMAL(10,2) NOT NULL,
        group_fee DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    console.log('Database tables created successfully');

    // Create indexes for better performance
    try {
      await sqlClient`CREATE INDEX IF NOT EXISTS idx_contestants_eodsa_id ON contestants(eodsa_id)`;
      await sqlClient`CREATE INDEX IF NOT EXISTS idx_dancers_eodsa_id ON dancers(eodsa_id)`;
      await sqlClient`CREATE INDEX IF NOT EXISTS idx_dancers_approved ON dancers(approved)`;
      await sqlClient`CREATE INDEX IF NOT EXISTS idx_studio_applications_dancer_id ON studio_applications(dancer_id)`;
      await sqlClient`CREATE INDEX IF NOT EXISTS idx_studio_applications_studio_id ON studio_applications(studio_id)`;
      await sqlClient`CREATE INDEX IF NOT EXISTS idx_studio_applications_status ON studio_applications(status)`;
      await sqlClient`CREATE INDEX IF NOT EXISTS idx_studios_approved ON studios(approved)`;
      await sqlClient`CREATE INDEX IF NOT EXISTS idx_waivers_dancer_id ON waivers(dancer_id)`;
      await sqlClient`CREATE INDEX IF NOT EXISTS idx_event_entries_contestant_id ON event_entries(contestant_id)`;
      await sqlClient`CREATE INDEX IF NOT EXISTS idx_event_entries_event_id ON event_entries(event_id)`;
      await sqlClient`CREATE INDEX IF NOT EXISTS idx_performances_event_entry_id ON performances(event_entry_id)`;
      await sqlClient`CREATE INDEX IF NOT EXISTS idx_performances_event_id ON performances(event_id)`;
      await sqlClient`CREATE INDEX IF NOT EXISTS idx_scores_performance_id ON scores(performance_id)`;
      await sqlClient`CREATE INDEX IF NOT EXISTS idx_scores_judge_id ON scores(judge_id)`;
      await sqlClient`CREATE INDEX IF NOT EXISTS idx_rankings_event_id ON rankings(event_id)`;
      await sqlClient`CREATE INDEX IF NOT EXISTS idx_judge_assignments_judge_id ON judge_event_assignments(judge_id)`;
      await sqlClient`CREATE INDEX IF NOT EXISTS idx_judge_assignments_event_id ON judge_event_assignments(event_id)`;
      await sqlClient`CREATE INDEX IF NOT EXISTS idx_events_region ON events(region)`;
      await sqlClient`CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date)`;
      
      // Phase 3 Database Optimization - Additional composite indexes for unified system
      await sqlClient`CREATE INDEX IF NOT EXISTS idx_dancers_approved_created ON dancers(approved, created_at DESC)`;
      await sqlClient`CREATE INDEX IF NOT EXISTS idx_studio_apps_dancer_status ON studio_applications(dancer_id, status)`;
      await sqlClient`CREATE INDEX IF NOT EXISTS idx_studio_apps_studio_status ON studio_applications(studio_id, status)`;
      await sqlClient`CREATE INDEX IF NOT EXISTS idx_studios_approved_created ON studios(approved, created_at DESC)`;
      await sqlClient`CREATE INDEX IF NOT EXISTS idx_dancers_national_id ON dancers(national_id)`;
      await sqlClient`CREATE INDEX IF NOT EXISTS idx_dancers_email ON dancers(email)`;
      
      console.log('Database indexes created successfully (including unified system optimizations)');
    } catch (indexError) {
      console.warn('Some indexes may already exist, continuing...', indexError);
    }

    // Insert default fee schedule only if it doesn't exist
    const existingFees = await sqlClient`SELECT COUNT(*) as count FROM fee_schedule` as any[];
    if (existingFees[0]?.count === 0) {
      await sqlClient`
        INSERT INTO fee_schedule (id, age_category, solo_fee, duet_fee, trio_fee, group_fee)
        VALUES 
          ('fee_under6', 'Under 6', 150.00, 250.00, 350.00, 450.00),
          ('fee_7_9', '7-9', 200.00, 300.00, 400.00, 500.00),
          ('fee_10_12', '10-12', 250.00, 350.00, 450.00, 550.00),
          ('fee_13_14', '13-14', 300.00, 400.00, 500.00, 600.00),
          ('fee_15_17', '15-17', 350.00, 450.00, 550.00, 650.00),
          ('fee_18_24', '18-24', 400.00, 500.00, 600.00, 700.00),
          ('fee_25_39', '25-39', 400.00, 500.00, 600.00, 700.00),
          ('fee_40_plus', '40+', 400.00, 500.00, 600.00, 700.00),
          ('fee_60_plus', '60+', 350.00, 450.00, 550.00, 650.00)
        `;
      console.log('Default fee schedule inserted');
    }

    // Create default admin user and judges only if no users exist
    const existingUsers = await sqlClient`SELECT COUNT(*) as count FROM judges` as any[];
    if (existingUsers[0]?.count === 0) {
      const bcrypt = require('bcryptjs');
      const hashedAdminPassword = await bcrypt.hash('admin123', 10);
      const hashedJudgePassword = await bcrypt.hash('judge123', 10);
      
      await sqlClient`
        INSERT INTO judges (id, name, email, password, is_admin, specialization)
        VALUES 
          ('admin1', 'System Admin', 'admin@competition.com', ${hashedAdminPassword}, true, NULL),
          ('judge1', 'Sarah Williams', 'judge@competition.com', ${hashedJudgePassword}, false, '["Ballet", "Contemporary"]'),
          ('judge2', 'Michael Brown', 'judge2@competition.com', ${hashedJudgePassword}, false, '["Jazz", "Hip Hop"]'),
          ('judge3', 'Emma Davis', 'judge3@competition.com', ${hashedJudgePassword}, false, '["Tap", "Musical Theatre"]'),
          ('judge4', 'James Wilson', 'judge4@competition.com', ${hashedJudgePassword}, false, '["African", "Traditional"]'),
          ('judge5', 'Lisa Thompson', 'judge5@competition.com', ${hashedJudgePassword}, false, '["Contemporary", "Lyrical"]')
      `;
      console.log('Default admin and judges created:');
      console.log('  - admin@competition.com / admin123 (Admin)');
      console.log('  - judge@competition.com / judge123 (Judge)');
      console.log('  - judge2@competition.com / judge123 (Judge)');
      console.log('  - judge3@competition.com / judge123 (Judge)');
      console.log('  - judge4@competition.com / judge123 (Judge)');
      console.log('  - judge5@competition.com / judge123 (Judge)');
    }

    console.log('✅ Database initialized successfully - Ready for unified dancer-studio system');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

// Clean database while preserving admin and essential data
export const cleanDatabase = async () => {
  try {
    const sqlClient = getSql();
    
    console.log('🧹 Cleaning database...');
    
    // Delete all data in dependency order (most dependent first)
    await sqlClient`DELETE FROM scores`;
    await sqlClient`DELETE FROM rankings`;
    await sqlClient`DELETE FROM performances`;
    await sqlClient`DELETE FROM event_entries`;
    await sqlClient`DELETE FROM judge_event_assignments`;
    await sqlClient`DELETE FROM events`;
    await sqlClient`DELETE FROM dancers`;
    await sqlClient`DELETE FROM contestants`;
    
    // Keep only admin users, remove regular judges
    await sqlClient`DELETE FROM judges WHERE is_admin = false`;
    
    console.log('✅ Database cleaned successfully - Admin user and fee schedule preserved');
  } catch (error) {
    console.error('Error cleaning database:', error);
    throw error;
  }
};

// Database operations
export const db = {
  // Contestants
  async createContestant(contestant: Omit<Contestant, 'id' | 'eodsaId' | 'registrationDate' | 'eventEntries'>) {
    const sqlClient = getSql();
    const id = Date.now().toString();
    const eodsaId = generateEODSAId();
    const registrationDate = new Date().toISOString();
    const privacyPolicyAcceptedAt = contestant.privacyPolicyAccepted ? new Date().toISOString() : null;
    
    await sqlClient`
      INSERT INTO contestants (id, eodsa_id, name, email, phone, type, date_of_birth, 
                              guardian_name, guardian_email, guardian_cell, 
                              privacy_policy_accepted, privacy_policy_accepted_at,
                              studio_name, studio_address, studio_contact_person, 
                              studio_registration_number, registration_date)
      VALUES (${id}, ${eodsaId}, ${contestant.name}, ${contestant.email}, ${contestant.phone}, 
              ${contestant.type}, ${contestant.dateOfBirth},
              ${contestant.guardianInfo?.name || null}, ${contestant.guardianInfo?.email || null}, 
              ${contestant.guardianInfo?.cell || null}, ${contestant.privacyPolicyAccepted}, 
              ${privacyPolicyAcceptedAt}, ${contestant.studioName || null}, 
              ${contestant.studioInfo?.address || null}, ${contestant.studioInfo?.contactPerson || null},
              ${contestant.studioInfo?.registrationNumber || null}, ${registrationDate})
    `;
    
    // Insert dancers with date of birth
    for (const dancer of contestant.dancers) {
      const dancerId = Date.now().toString() + Math.random().toString(36).substring(2, 8);
      await sqlClient`
        INSERT INTO dancers (id, eodsa_id, name, date_of_birth, age, national_id)
        VALUES (${dancerId}, ${eodsaId}, ${dancer.name}, ${dancer.dateOfBirth}, ${dancer.age}, ${dancer.nationalId})
      `;
    }
    
    return { 
      ...contestant, 
      id, 
      eodsaId, 
      registrationDate, 
      eventEntries: [],
      privacyPolicyAcceptedAt
    };
  },

  async getContestantById(id: string) {
    const sqlClient = getSql();
    const result = await sqlClient`SELECT * FROM contestants WHERE id = ${id}` as any[];
    if (result.length === 0) return null;
    
    const contestant = result[0];
    const dancers = await sqlClient`SELECT * FROM dancers WHERE eodsa_id = ${contestant.eodsa_id}` as any[];
    const eventEntries = await sqlClient`SELECT * FROM event_entries WHERE contestant_id = ${id}` as any[];
    
    return {
      id: contestant.id,
      eodsaId: contestant.eodsa_id,
      name: contestant.name,
      email: contestant.email,
      phone: contestant.phone,
      type: contestant.type,
      dateOfBirth: contestant.date_of_birth,
      guardianInfo: contestant.guardian_name ? {
        name: contestant.guardian_name,
        email: contestant.guardian_email,
        cell: contestant.guardian_cell
      } : undefined,
      privacyPolicyAccepted: contestant.privacy_policy_accepted,
      privacyPolicyAcceptedAt: contestant.privacy_policy_accepted_at,
      studioName: contestant.studio_name,
      studioInfo: contestant.studio_address ? {
        address: contestant.studio_address,
        contactPerson: contestant.studio_contact_person,
        registrationNumber: contestant.studio_registration_number
      } : undefined,
      dancers: dancers.map((d: any) => ({
        id: d.id,
        name: d.name,
        age: d.age,
        dateOfBirth: d.date_of_birth,
        style: d.national_id,
        nationalId: d.national_id
      })),
      registrationDate: contestant.registration_date,
      eventEntries: eventEntries.map((e: any) => ({
        id: e.id,
        eventId: e.event_id,
        contestantId: e.contestant_id,
        eodsaId: e.eodsa_id,
        participantIds: JSON.parse(e.participant_ids),
        calculatedFee: parseFloat(e.calculated_fee),
        paymentStatus: e.payment_status,
        paymentMethod: e.payment_method,
        submittedAt: e.submitted_at,
        approved: e.approved,
        itemNumber: e.item_number,
        itemName: e.item_name,
        choreographer: e.choreographer,
        mastery: e.mastery,
        itemStyle: e.item_style,
        estimatedDuration: e.estimated_duration
      }))
    } as Contestant;
  },

  async getAllContestants() {
    const sqlClient = getSql();
    const result = await sqlClient`SELECT * FROM contestants ORDER BY registration_date DESC` as any[];
    return result.map((row: any) => ({
      id: row.id,
      eodsaId: row.eodsa_id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      type: row.type,
      dateOfBirth: row.date_of_birth,
      guardianInfo: row.guardian_name ? {
        name: row.guardian_name,
        email: row.guardian_email,
        cell: row.guardian_cell
      } : undefined,
      privacyPolicyAccepted: row.privacy_policy_accepted,
      privacyPolicyAcceptedAt: row.privacy_policy_accepted_at,
      studioName: row.studio_name,
      studioInfo: row.studio_address ? {
        address: row.studio_address,
        contactPerson: row.studio_contact_person,
        registrationNumber: row.studio_registration_number
      } : undefined,
      dancers: [], // Will be loaded separately if needed
      registrationDate: row.registration_date,
      eventEntries: []
    })) as Contestant[];
  },

  // Event Entries
  async createEventEntry(eventEntry: Omit<EventEntry, 'id' | 'submittedAt'>) {
    const sqlClient = getSql();
    const id = Date.now().toString();
    const submittedAt = new Date().toISOString();

    try {
      await sqlClient`
        INSERT INTO event_entries (id, event_id, contestant_id, eodsa_id, participant_ids, calculated_fee, payment_status, submitted_at, approved, qualified_for_nationals, item_number, item_name, choreographer, mastery, item_style, estimated_duration)
        VALUES (${id}, ${eventEntry.eventId}, ${eventEntry.contestantId}, ${eventEntry.eodsaId}, ${JSON.stringify(eventEntry.participantIds)}, ${eventEntry.calculatedFee}, ${eventEntry.paymentStatus}, ${submittedAt}, ${eventEntry.approved}, ${eventEntry.qualifiedForNationals || false}, ${eventEntry.itemNumber || null}, ${eventEntry.itemName}, ${eventEntry.choreographer}, ${eventEntry.mastery}, ${eventEntry.itemStyle}, ${eventEntry.estimatedDuration})
      `;
      
      console.log(`✅ Event entry ${id} created successfully for contestant ${eventEntry.contestantId}`);
    } catch (error: any) {
      console.error('❌ Event entry creation error:', error);
      
      // Handle foreign key constraint errors for unified system dancers
      if (error?.code === '23503' && error?.constraint === 'event_entries_contestant_id_fkey') {
        console.log('🔧 Foreign key constraint error detected, creating contestant record for unified system dancer');
        
        try {
          // Get dancer info from unified system to create a contestant record
          const dancer = await unifiedDb.getDancerById(eventEntry.contestantId);
          if (dancer) {
            console.log(`📝 Creating contestant record for unified dancer: ${dancer.name} (${dancer.eodsaId})`);
            
            // Create a contestant record based on the unified system dancer
            // Only use columns that definitely exist in the contestants table
            await sqlClient`
              INSERT INTO contestants (id, eodsa_id, name, email, phone, type, date_of_birth, registration_date)
              VALUES (${eventEntry.contestantId}, ${dancer.eodsaId}, ${dancer.name}, ${dancer.email || 'temp@example.com'}, ${dancer.phone || '0000000000'}, 'private', ${dancer.dateOfBirth}, ${new Date().toISOString()})
              ON CONFLICT (id) DO NOTHING
            `;
            
            console.log(`✅ Contestant record created for dancer ${dancer.name}`);
            
            // Now try to insert the event entry again
            await sqlClient`
              INSERT INTO event_entries (id, event_id, contestant_id, eodsa_id, participant_ids, calculated_fee, payment_status, submitted_at, approved, qualified_for_nationals, item_number, item_name, choreographer, mastery, item_style, estimated_duration)
              VALUES (${id}, ${eventEntry.eventId}, ${eventEntry.contestantId}, ${eventEntry.eodsaId}, ${JSON.stringify(eventEntry.participantIds)}, ${eventEntry.calculatedFee}, ${eventEntry.paymentStatus}, ${submittedAt}, ${eventEntry.approved}, ${eventEntry.qualifiedForNationals || false}, ${eventEntry.itemNumber || null}, ${eventEntry.itemName}, ${eventEntry.choreographer}, ${eventEntry.mastery}, ${eventEntry.itemStyle}, ${eventEntry.estimatedDuration})
            `;
            
            console.log(`✅ Event entry ${id} created successfully after creating contestant record`);
          } else {
            console.error(`❌ Could not find unified system dancer with ID: ${eventEntry.contestantId}`);
            throw new Error(`Unified system dancer not found: ${eventEntry.contestantId}`);
          }
        } catch (contestantError) {
          console.error('❌ Failed to create contestant record for unified system dancer:', contestantError);
          throw contestantError;
        }
      } else {
        throw error; // Re-throw other errors
      }
    }

    // Verify the entry was actually saved
    try {
      const savedEntry = await sqlClient`SELECT id FROM event_entries WHERE id = ${id}` as any[];
      if (savedEntry.length === 0) {
        throw new Error(`Event entry ${id} was not saved to database`);
      }
      console.log(`✅ Verified event entry ${id} exists in database`);
    } catch (verifyError) {
      console.error('❌ Failed to verify event entry save:', verifyError);
      throw verifyError;
    }

    return { ...eventEntry, id, submittedAt };
  },

  async getEventEntriesByContestant(contestantId: string) {
    const sqlClient = getSql();
    const result = await sqlClient`SELECT * FROM event_entries WHERE contestant_id = ${contestantId}` as any[];
    return result.map((row: any) => ({
      id: row.id,
      eventId: row.event_id,
      contestantId: row.contestant_id,
      eodsaId: row.eodsa_id,
      participantIds: JSON.parse(row.participant_ids),
      calculatedFee: parseFloat(row.calculated_fee),
      paymentStatus: row.payment_status,
      paymentMethod: row.payment_method,
      submittedAt: row.submitted_at,
      approved: row.approved,
      qualifiedForNationals: row.qualified_for_nationals,
      itemName: row.item_name,
      choreographer: row.choreographer,
      mastery: row.mastery,
      itemStyle: row.item_style,
      estimatedDuration: row.estimated_duration
    })) as EventEntry[];
  },

  async getAllEventEntries() {
    const sqlClient = getSql();
    const result = await sqlClient`SELECT * FROM event_entries ORDER BY submitted_at DESC` as any[];
    return result.map((row: any) => ({
      id: row.id,
      eventId: row.event_id,
      contestantId: row.contestant_id,
      eodsaId: row.eodsa_id,
      participantIds: JSON.parse(row.participant_ids),
      calculatedFee: parseFloat(row.calculated_fee),
      paymentStatus: row.payment_status,
      paymentMethod: row.payment_method,
      submittedAt: row.submitted_at,
      approved: row.approved,
      qualifiedForNationals: row.qualified_for_nationals,
      itemName: row.item_name,
      choreographer: row.choreographer,
      mastery: row.mastery,
      itemStyle: row.item_style,
      estimatedDuration: row.estimated_duration
    })) as EventEntry[];
  },

  async updateEventEntry(id: string, updates: Partial<EventEntry>) {
    const sqlClient = getSql();
    
    // Simple approach: only support approval updates for now
    if (updates.approved !== undefined) {
      await sqlClient`
        UPDATE event_entries 
        SET approved = ${updates.approved}
        WHERE id = ${id}
      `;
    }
    
    if (updates.qualifiedForNationals !== undefined) {
      await sqlClient`
        UPDATE event_entries 
        SET qualified_for_nationals = ${updates.qualifiedForNationals}
        WHERE id = ${id}
      `;
    }
    
    if (updates.itemNumber !== undefined) {
      await sqlClient`
        UPDATE event_entries 
        SET item_number = ${updates.itemNumber}
        WHERE id = ${id}
      `;
    }
    
    if (updates.paymentStatus !== undefined) {
      await sqlClient`
        UPDATE event_entries 
        SET payment_status = ${updates.paymentStatus}
        WHERE id = ${id}
      `;
    }
    
    if (updates.paymentMethod !== undefined) {
      await sqlClient`
        UPDATE event_entries 
        SET payment_method = ${updates.paymentMethod}
        WHERE id = ${id}
      `;
    }
    
    return updates;
  },

  // Fee Schedule
  async getFeeSchedule() {
    const sqlClient = getSql();
    const result = await sqlClient`SELECT * FROM fee_schedule ORDER BY age_category` as any[];
    return result.map((row: any) => ({
      ageCategory: row.age_category,
      soloFee: parseFloat(row.solo_fee),
      duetFee: parseFloat(row.duet_fee),
      trioFee: parseFloat(row.trio_fee),
      groupFee: parseFloat(row.group_fee)
    }));
  },

  async calculateFee(ageCategory: string, performanceType: string) {
    const sqlClient = getSql();
    const result = await sqlClient`SELECT * FROM fee_schedule WHERE age_category = ${ageCategory}` as any[];
    if (result.length === 0) return 0;
    
    const fees = result[0];
    switch (performanceType.toLowerCase()) {
      case 'solo': return parseFloat(fees.solo_fee);
      case 'duet': return parseFloat(fees.duet_fee);
      case 'trio': return parseFloat(fees.trio_fee);
      case 'group': return parseFloat(fees.group_fee);
      default: return 0;
    }
  },

  // Performances (updated for Phase 1)
  async createPerformance(performance: Omit<Performance, 'id'>) {
    const sqlClient = getSql();
    const id = Date.now().toString();
    
    await sqlClient`
      INSERT INTO performances (id, event_id, event_entry_id, contestant_id, title, participant_names, duration, choreographer, mastery, item_style, scheduled_time, status)
      VALUES (${id}, ${performance.eventId}, ${performance.eventEntryId}, ${performance.contestantId}, ${performance.title}, ${JSON.stringify(performance.participantNames)}, ${performance.duration}, ${performance.choreographer}, ${performance.mastery}, ${performance.itemStyle}, ${performance.scheduledTime || null}, ${performance.status})
    `;
    
    return { ...performance, id };
  },

  async getAllPerformances() {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT p.*, c.name as contestant_name 
      FROM performances p 
      JOIN contestants c ON p.contestant_id = c.id 
      ORDER BY p.scheduled_time ASC
    ` as any[];
    
    return result.map((row: any) => ({
      id: row.id,
      eventId: row.event_id,
      eventEntryId: row.event_entry_id,
      contestantId: row.contestant_id,
      title: row.title,
      participantNames: JSON.parse(row.participant_names),
      duration: row.duration,
      choreographer: row.choreographer,
      mastery: row.mastery,
      itemStyle: row.item_style,
      scheduledTime: row.scheduled_time,
      status: row.status,
      contestantName: row.contestant_name
    })) as (Performance & { contestantName: string })[];
  },

  async getPerformanceById(performanceId: string) {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT p.*, c.name as contestant_name 
      FROM performances p 
      JOIN contestants c ON p.contestant_id = c.id 
      WHERE p.id = ${performanceId}
    ` as any[];
    
    if (result.length === 0) return null;
    
    const row = result[0];
    return {
      id: row.id,
      eventId: row.event_id,
      eventEntryId: row.event_entry_id,
      contestantId: row.contestant_id,
      title: row.title,
      participantNames: JSON.parse(row.participant_names),
      duration: row.duration,
      choreographer: row.choreographer,
      mastery: row.mastery,
      itemStyle: row.item_style,
      scheduledTime: row.scheduled_time,
      status: row.status,
      contestantName: row.contestant_name
    } as Performance & { contestantName: string };
  },

  // Rankings and Tabulation
  async calculateRankings(region?: string, ageCategory?: string, performanceType?: string, eventIds?: string[]) {
    const sqlClient = getSql();
    
    try {
      console.log('Calculating rankings with filters:', { region, ageCategory, performanceType, eventIds });
      
      let result: any[] = [];

      // Handle event filtering first (since this is the main issue)
      if (eventIds && eventIds.length > 0) {
        console.log('Filtering by specific events:', eventIds);
        
        // For single event (most common case)
        if (eventIds.length === 1) {
          const eventId = eventIds[0];
          result = await sqlClient`
            SELECT 
              p.id as performance_id,
              e.id as event_id,
              e.name as event_name,
              e.region,
              e.age_category,
              e.performance_type,
              p.title,
              p.item_style,
              p.participant_names,
              c.name as contestant_name,
              c.type as contestant_type,
              c.studio_name,
              AVG(s.technical_score + s.musical_score + s.performance_score + s.styling_score + s.overall_impression_score) as total_score,
              AVG((s.technical_score + s.musical_score + s.performance_score + s.styling_score + s.overall_impression_score) / 5) as average_score,
              COUNT(s.id) as judge_count
            FROM performances p
            JOIN events e ON p.event_id = e.id
            JOIN contestants c ON p.contestant_id = c.id
            LEFT JOIN scores s ON p.id = s.performance_id
            WHERE e.id = ${eventId}
            GROUP BY p.id, e.id, e.name, e.region, e.age_category, e.performance_type, p.title, p.item_style, p.participant_names, c.name, c.type, c.studio_name
            HAVING COUNT(s.id) > 0
            ORDER BY e.region, e.age_category, e.performance_type, total_score DESC
          ` as any[];
        } else {
          // For multiple events, we'll query each separately and combine
          const allResults = [];
          for (const eventId of eventIds) {
            const eventResult = await sqlClient`
              SELECT 
                p.id as performance_id,
                e.id as event_id,
                e.name as event_name,
                e.region,
                e.age_category,
                e.performance_type,
                p.title,
                p.item_style,
                p.participant_names,
                c.name as contestant_name,
                c.type as contestant_type,
                c.studio_name,
                AVG(s.technical_score + s.musical_score + s.performance_score + s.styling_score + s.overall_impression_score) as total_score,
                AVG((s.technical_score + s.musical_score + s.performance_score + s.styling_score + s.overall_impression_score) / 5) as average_score,
                COUNT(s.id) as judge_count
              FROM performances p
              JOIN events e ON p.event_id = e.id
              JOIN contestants c ON p.contestant_id = c.id
              LEFT JOIN scores s ON p.id = s.performance_id
              WHERE e.id = ${eventId}
              GROUP BY p.id, e.id, e.name, e.region, e.age_category, e.performance_type, p.title, p.item_style, p.participant_names, c.name, c.type, c.studio_name
              HAVING COUNT(s.id) > 0
              ORDER BY e.region, e.age_category, e.performance_type, total_score DESC
            ` as any[];
            allResults.push(...eventResult);
          }
          result = allResults;
        }
      } else {
        // No event filtering - use the standard filtering approach
        if (region && ageCategory && performanceType) {
          result = await sqlClient`
            SELECT 
              p.id as performance_id,
              e.id as event_id,
              e.name as event_name,
              e.region,
              e.age_category,
              e.performance_type,
              p.title,
              p.item_style,
              p.participant_names,
              c.name as contestant_name,
              c.type as contestant_type,
              c.studio_name,
              AVG(s.technical_score + s.musical_score + s.performance_score + s.styling_score + s.overall_impression_score) as total_score,
              AVG((s.technical_score + s.musical_score + s.performance_score + s.styling_score + s.overall_impression_score) / 5) as average_score,
              COUNT(s.id) as judge_count
            FROM performances p
            JOIN events e ON p.event_id = e.id
            JOIN contestants c ON p.contestant_id = c.id
            LEFT JOIN scores s ON p.id = s.performance_id
            WHERE e.region = ${region} AND e.age_category = ${ageCategory} AND e.performance_type = ${performanceType}
            GROUP BY p.id, e.id, e.name, e.region, e.age_category, e.performance_type, p.title, p.item_style, p.participant_names, c.name, c.type, c.studio_name
            HAVING COUNT(s.id) > 0
            ORDER BY e.region, e.age_category, e.performance_type, total_score DESC
          ` as any[];
        } else if (region && ageCategory) {
          result = await sqlClient`
            SELECT 
              p.id as performance_id,
              e.id as event_id,
              e.name as event_name,
              e.region,
              e.age_category,
              e.performance_type,
              p.title,
              p.item_style,
              p.participant_names,
              c.name as contestant_name,
              c.type as contestant_type,
              c.studio_name,
              AVG(s.technical_score + s.musical_score + s.performance_score + s.styling_score + s.overall_impression_score) as total_score,
              AVG((s.technical_score + s.musical_score + s.performance_score + s.styling_score + s.overall_impression_score) / 5) as average_score,
              COUNT(s.id) as judge_count
            FROM performances p
            JOIN events e ON p.event_id = e.id
            JOIN contestants c ON p.contestant_id = c.id
            LEFT JOIN scores s ON p.id = s.performance_id
            WHERE e.region = ${region} AND e.age_category = ${ageCategory}
            GROUP BY p.id, e.id, e.name, e.region, e.age_category, e.performance_type, p.title, p.item_style, p.participant_names, c.name, c.type, c.studio_name
            HAVING COUNT(s.id) > 0
            ORDER BY e.region, e.age_category, e.performance_type, total_score DESC
          ` as any[];
        } else if (region) {
          result = await sqlClient`
            SELECT 
              p.id as performance_id,
              e.id as event_id,
              e.name as event_name,
              e.region,
              e.age_category,
              e.performance_type,
              p.title,
              p.item_style,
              p.participant_names,
              c.name as contestant_name,
              c.type as contestant_type,
              c.studio_name,
              AVG(s.technical_score + s.musical_score + s.performance_score + s.styling_score + s.overall_impression_score) as total_score,
              AVG((s.technical_score + s.musical_score + s.performance_score + s.styling_score + s.overall_impression_score) / 5) as average_score,
              COUNT(s.id) as judge_count
            FROM performances p
            JOIN events e ON p.event_id = e.id
            JOIN contestants c ON p.contestant_id = c.id
            LEFT JOIN scores s ON p.id = s.performance_id
            WHERE e.region = ${region}
            GROUP BY p.id, e.id, e.name, e.region, e.age_category, e.performance_type, p.title, p.item_style, p.participant_names, c.name, c.type, c.studio_name
            HAVING COUNT(s.id) > 0
            ORDER BY e.region, e.age_category, e.performance_type, total_score DESC
          ` as any[];
        } else {
          result = await sqlClient`
            SELECT 
              p.id as performance_id,
              e.id as event_id,
              e.name as event_name,
              e.region,
              e.age_category,
              e.performance_type,
              p.title,
              p.item_style,
              p.participant_names,
              c.name as contestant_name,
              c.type as contestant_type,
              c.studio_name,
              AVG(s.technical_score + s.musical_score + s.performance_score + s.styling_score + s.overall_impression_score) as total_score,
              AVG((s.technical_score + s.musical_score + s.performance_score + s.styling_score + s.overall_impression_score) / 5) as average_score,
              COUNT(s.id) as judge_count
            FROM performances p
            JOIN events e ON p.event_id = e.id
            JOIN contestants c ON p.contestant_id = c.id
            LEFT JOIN scores s ON p.id = s.performance_id
            GROUP BY p.id, e.id, e.name, e.region, e.age_category, e.performance_type, p.title, p.item_style, p.participant_names, c.name, c.type, c.studio_name
            HAVING COUNT(s.id) > 0
            ORDER BY e.region, e.age_category, e.performance_type, total_score DESC
          ` as any[];
        }
      }
      
      console.log('Rankings SQL Result:', result);
      console.log('Result length:', result.length);
      
      // Ensure result is an array
      if (!Array.isArray(result)) {
        console.warn('Rankings query did not return an array:', result);
        return [];
      }

      // If no results, return empty array
      if (result.length === 0) {
        console.log('No rankings found for the given criteria');
        return [];
      }
    
      // Add rankings within each category
      let currentRank = 1;
      let currentCategory = '';
      
      return result.map((row: any, index: number) => {
        const categoryKey = `${row.region}-${row.age_category}-${row.performance_type}`;
        if (categoryKey !== currentCategory) {
          currentRank = 1;
          currentCategory = categoryKey;
        } else if (index > 0 && result[index - 1].total_score !== row.total_score) {
          currentRank = index + 1;
        }
        
        // Parse participant names from JSON
        let participantNames: string[] = [];
        try {
          participantNames = JSON.parse(row.participant_names || '[]');
        } catch (error) {
          console.warn('Error parsing participant names:', error);
          participantNames = [row.contestant_name]; // Fallback to contestant name
        }
        
        // Create display name based on performance type and data available
        let displayName = '';
        let studioInfo = '';
        
        if (participantNames.length > 0) {
          // Use actual participant names (the dancers)
          displayName = participantNames.join(', ');
        } else {
          // Fallback to contestant name if no participant names
          displayName = row.contestant_name || 'Unknown Participant';
        }
        
        // Add studio information if available
        if (row.contestant_type === 'studio' && row.studio_name) {
          studioInfo = row.studio_name;
        }
        
        return {
          performanceId: row.performance_id,
          eventId: row.event_id,
          eventName: row.event_name,
          region: row.region,
          ageCategory: row.age_category,
          performanceType: row.performance_type,
          title: row.title,
          itemStyle: row.item_style,
          contestantName: displayName, // Now shows participant names instead of contestant name
          participantNames: participantNames, // Keep original participant names for reference
          studioName: studioInfo, // Studio information for display
          totalScore: parseFloat(row.total_score) || 0,
          averageScore: parseFloat(row.average_score) || 0,
          rank: currentRank,
          judgeCount: parseInt(row.judge_count) || 0
        };
      });
    } catch (error) {
      console.error('Error in calculateRankings:', error);
      return [];
    }
  },

  // Get events that have at least one scored performance
  async getEventsWithScores() {
    const sqlClient = getSql();
    
    try {
      const result = await sqlClient`
        SELECT DISTINCT 
          e.id,
          e.name,
          e.region,
          e.age_category,
          e.performance_type,
          e.event_date,
          e.venue,
          COUNT(DISTINCT p.id) as performance_count,
          COUNT(DISTINCT s.id) as score_count
        FROM events e
        JOIN performances p ON e.id = p.event_id
        LEFT JOIN scores s ON p.id = s.performance_id
        GROUP BY e.id, e.name, e.region, e.age_category, e.performance_type, e.event_date, e.venue
        HAVING COUNT(DISTINCT s.id) > 0
        ORDER BY e.event_date DESC, e.name
      ` as any[];
      
      return result.map((row: any) => ({
        id: row.id,
        name: row.name,
        region: row.region,
        ageCategory: row.age_category,
        performanceType: row.performance_type,
        eventDate: row.event_date,
        venue: row.venue,
        performanceCount: parseInt(row.performance_count) || 0,
        scoreCount: parseInt(row.score_count) || 0
      }));
    } catch (error) {
      console.error('Error in getEventsWithScores:', error);
      return [];
    }
  },

  // Keep existing methods for judges and scores...
  async createJudge(judge: Omit<Judge, 'createdAt'> & { id?: string }) {
    const sqlClient = getSql();
    const id = judge.id || Date.now().toString();
    
    await sqlClient`
      INSERT INTO judges (id, name, email, password, is_admin, specialization)
      VALUES (${id}, ${judge.name}, ${judge.email}, ${judge.password}, 
              ${judge.isAdmin}, ${JSON.stringify(judge.specialization || [])})
    `;
    
    return { ...judge, id };
  },

  async getJudgeEventAssignment(judgeId: string) {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT * FROM judge_event_assignments WHERE judge_id = ${judgeId}
    ` as any[];
    
    if (result.length === 0) return null;
    
    const assignment = result[0];
    return {
      id: assignment.id,
      judgeId: assignment.judge_id,
      eventId: assignment.event_id,
      assignedBy: assignment.assigned_by,
      createdAt: assignment.assigned_at
    };
  },

  async getJudgeByEmail(email: string) {
    const sqlClient = getSql();
    const result = await sqlClient`SELECT * FROM judges WHERE email = ${email}` as any[];
    if (result.length === 0) return null;
    
    const judge = result[0];
    return {
      id: judge.id,
      name: judge.name,
      email: judge.email,
      password: judge.password,
      isAdmin: judge.is_admin,
      specialization: judge.specialization ? JSON.parse(judge.specialization) : []
    } as Judge;
  },

  async getJudgeById(id: string) {
    const sqlClient = getSql();
    const result = await sqlClient`SELECT * FROM judges WHERE id = ${id}` as any[];
    if (result.length === 0) return null;
    
    const judge = result[0];
    return {
      id: judge.id,
      name: judge.name,
      email: judge.email,
      password: judge.password,
      isAdmin: judge.is_admin,
      specialization: judge.specialization ? JSON.parse(judge.specialization) : [],
      createdAt: judge.created_at
    } as Judge;
  },

  async getAllJudges() {
    const sqlClient = getSql();
    const result = await sqlClient`SELECT * FROM judges` as any[];
    return result.map((row: any) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      password: row.password,
      isAdmin: row.is_admin,
      specialization: row.specialization ? JSON.parse(row.specialization) : [],
      createdAt: row.created_at
    })) as Judge[];
  },

  async deleteJudge(judgeId: string) {
    const sqlClient = getSql();
    
    // First delete any judge assignments
    await sqlClient`DELETE FROM judge_event_assignments WHERE judge_id = ${judgeId}`;
    
    // Then delete any scores by this judge
    await sqlClient`DELETE FROM scores WHERE judge_id = ${judgeId}`;
    
    // Finally delete the judge
    await sqlClient`DELETE FROM judges WHERE id = ${judgeId}`;
  },

  // Scores (updated for new 5-criteria system)
  async createScore(score: Omit<Score, 'id' | 'submittedAt'>) {
    const sqlClient = getSql();
    const id = Date.now().toString();
    const submittedAt = new Date().toISOString();
    
    await sqlClient`
      INSERT INTO scores (id, judge_id, performance_id, technical_score, musical_score, performance_score, styling_score, overall_impression_score, comments, submitted_at)
      VALUES (${id}, ${score.judgeId}, ${score.performanceId}, ${score.technicalScore}, 
              ${score.musicalScore}, ${score.performanceScore}, ${score.stylingScore}, ${score.overallImpressionScore}, ${score.comments}, ${submittedAt})
    `;
    
    return { ...score, id, submittedAt };
  },

  async updateScore(id: string, updates: Partial<Score>) {
    const sqlClient = getSql();
    await sqlClient`
      UPDATE scores 
      SET technical_score = ${updates.technicalScore}, musical_score = ${updates.musicalScore}, 
          performance_score = ${updates.performanceScore}, styling_score = ${updates.stylingScore},
          overall_impression_score = ${updates.overallImpressionScore}, comments = ${updates.comments}
      WHERE id = ${id}
    `;
  },

  async getScoreByJudgeAndPerformance(judgeId: string, performanceId: string) {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT * FROM scores WHERE judge_id = ${judgeId} AND performance_id = ${performanceId}
    ` as any[];
    
    if (result.length === 0) return null;
    
    const score = result[0];
    return {
      id: score.id,
      judgeId: score.judge_id,
      performanceId: score.performance_id,
      technicalScore: parseFloat(score.technical_score),
      musicalScore: parseFloat(score.musical_score || 0),
      performanceScore: parseFloat(score.performance_score || 0),
      stylingScore: parseFloat(score.styling_score || 0),
      overallImpressionScore: parseFloat(score.overall_impression_score || 0),
      comments: score.comments,
      submittedAt: score.submitted_at
    } as Score;
  },

  async getScoresByPerformance(performanceId: string) {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT s.*, j.name as judge_name 
      FROM scores s 
      JOIN judges j ON s.judge_id = j.id 
      WHERE s.performance_id = ${performanceId}
      ORDER BY s.submitted_at
    ` as any[];
    
    return result.map((row: any) => ({
      id: row.id,
      judgeId: row.judge_id,
      performanceId: row.performance_id,
      technicalScore: parseFloat(row.technical_score),
      musicalScore: parseFloat(row.musical_score || 0),
      performanceScore: parseFloat(row.performance_score || 0),
      stylingScore: parseFloat(row.styling_score || 0),
      overallImpressionScore: parseFloat(row.overall_impression_score || 0),
      comments: row.comments,
      submittedAt: row.submitted_at,
      judgeName: row.judge_name
    })) as (Score & { judgeName: string })[];
  },

  // NEW: Event management methods
  async createEvent(event: Omit<Event, 'id' | 'createdAt'>) {
    const sqlClient = getSql();
    
    // Ensure event_end_date column exists (migration check)
    try {
      const columnCheck = await sqlClient`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'events' 
        AND column_name = 'event_end_date'
      ` as any[];
      
      if (columnCheck.length === 0) {
        await sqlClient`
          ALTER TABLE events 
          ADD COLUMN event_end_date TEXT
        `;
        console.log('✅ Added event_end_date column to events table');
      }
    } catch (migrationError) {
      console.error('Migration error for event_end_date:', migrationError);
    }
    
    const id = `event-${Date.now()}`;
    const createdAt = new Date().toISOString();
    
    await sqlClient`
      INSERT INTO events (id, name, description, region, age_category, performance_type, event_date, event_end_date, registration_deadline, venue, status, max_participants, entry_fee, created_by, created_at)
      VALUES (${id}, ${event.name}, ${event.description}, ${event.region}, ${event.ageCategory}, ${event.performanceType}, ${event.eventDate}, ${event.eventEndDate || null}, ${event.registrationDeadline}, ${event.venue}, ${event.status}, ${event.maxParticipants || null}, ${event.entryFee}, ${event.createdBy}, ${createdAt})
    `;
    
    return { ...event, id, createdAt };
  },

  async getAllEvents() {
    const sqlClient = getSql();
    const result = await sqlClient`SELECT * FROM events ORDER BY event_date ASC` as any[];
    return result.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      region: row.region,
      ageCategory: row.age_category,
      performanceType: row.performance_type,
      eventDate: row.event_date,
      eventEndDate: row.event_end_date,
      registrationDeadline: row.registration_deadline,
      venue: row.venue,
      status: row.status,
      maxParticipants: row.max_participants,
      entryFee: parseFloat(row.entry_fee),
      createdBy: row.created_by,
      createdAt: row.created_at
    })) as Event[];
  },

  async getEventById(eventId: string) {
    const sqlClient = getSql();
    const result = await sqlClient`SELECT * FROM events WHERE id = ${eventId}` as any[];
    if (result.length === 0) return null;
    
    const row = result[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      region: row.region,
      ageCategory: row.age_category,
      performanceType: row.performance_type,
      eventDate: row.event_date,
      eventEndDate: row.event_end_date,
      registrationDeadline: row.registration_deadline,
      venue: row.venue,
      status: row.status,
      maxParticipants: row.max_participants,
      entryFee: parseFloat(row.entry_fee),
      createdBy: row.created_by,
      createdAt: row.created_at
    } as Event;
  },

  // NEW: Judge Event Assignment methods
  async createJudgeEventAssignment(assignment: {
    judgeId: string;
    eventId: string;
    assignedBy: string;
  }) {
    const sqlClient = getSql();
    const id = `assignment-${Date.now()}`;
    const assignedAt = new Date().toISOString();
    
    await sqlClient`
      INSERT INTO judge_event_assignments (id, judge_id, event_id, assigned_by, assigned_at, status)
      VALUES (${id}, ${assignment.judgeId}, ${assignment.eventId}, ${assignment.assignedBy}, ${assignedAt}, 'active')
    `;
    
    return { ...assignment, id, assignedAt, status: 'active' as const };
  },

  async getJudgeAssignments(judgeId: string) {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT jea.*, e.name as event_name, e.description as event_description, e.event_date, e.venue
      FROM judge_event_assignments jea
      JOIN events e ON jea.event_id = e.id
      WHERE jea.judge_id = ${judgeId} AND jea.status = 'active'
      ORDER BY e.event_date ASC
    ` as any[];
    
    return result.map((row: any) => ({
      id: row.id,
      judgeId: row.judge_id,
      eventId: row.event_id,
      assignedBy: row.assigned_by,
      assignedAt: row.assigned_at,
      status: row.status,
      event: {
        id: row.event_id,
        name: row.event_name,
        description: row.event_description,
        eventDate: row.event_date,
        venue: row.venue
      }
    }));
  },

  async getAllJudgeAssignments() {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT jea.*, j.name as judge_name, j.email as judge_email, e.name as event_name
      FROM judge_event_assignments jea
      JOIN judges j ON jea.judge_id = j.id
      JOIN events e ON jea.event_id = e.id
      WHERE jea.status = 'active'
      ORDER BY jea.assigned_at DESC
    ` as any[];
    
    return result.map((row: any) => ({
      id: row.id,
      judgeId: row.judge_id,
      eventId: row.event_id,
      assignedBy: row.assigned_by,
      assignedAt: row.assigned_at,
      status: row.status,
      judgeName: row.judge_name,
      judgeEmail: row.judge_email,
      eventName: row.event_name
    }));
  },

  // NEW: Get performances by event ID
  async getPerformancesByEvent(eventId: string) {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT p.*, c.name as contestant_name 
      FROM performances p 
      JOIN contestants c ON p.contestant_id = c.id 
      WHERE p.event_id = ${eventId}
      ORDER BY p.scheduled_time ASC
    ` as any[];
    
    return result.map((row: any) => ({
      id: row.id,
      eventId: row.event_id,
      eventEntryId: row.event_entry_id,
      contestantId: row.contestant_id,
      title: row.title,
      participantNames: JSON.parse(row.participant_names),
      duration: row.duration,
      choreographer: row.choreographer,
      mastery: row.mastery,
      itemStyle: row.item_style,
      scheduledTime: row.scheduled_time,
      status: row.status,
      contestantName: row.contestant_name
    })) as (Performance & { contestantName: string })[];
  },

  // Database cleaning - reset all data except admin users
  async cleanDatabase() {
    const sqlClient = getSql();
    
    console.log('🧹 Cleaning database...');
    
    // Delete all data in dependency order (most dependent first)
    await sqlClient`DELETE FROM scores`;
    await sqlClient`DELETE FROM rankings`;
    await sqlClient`DELETE FROM performances`;
    await sqlClient`DELETE FROM event_entries`;
    await sqlClient`DELETE FROM judge_event_assignments`;
    await sqlClient`DELETE FROM events`;
    await sqlClient`DELETE FROM dancers`;
    await sqlClient`DELETE FROM contestants`;
    
    // Keep only admin users, remove regular judges
    await sqlClient`DELETE FROM judges WHERE is_admin = false`;
    
    console.log('✅ Database cleaned successfully - Admin user and fee schedule preserved');
  },

  // NEW: Event status management methods
  async updateEventStatuses() {
    const sqlClient = getSql();
    const now = new Date();
    
    // Update events based on current time
    // 1. Set to 'registration_open' if current time is before registration deadline and status is 'upcoming'
    await sqlClient`
      UPDATE events 
      SET status = 'registration_open' 
      WHERE status = 'upcoming' 
      AND registration_deadline > ${now.toISOString()}
    `;
    
    // 2. Set to 'registration_closed' if registration deadline has passed but event hasn't started
    await sqlClient`
      UPDATE events 
      SET status = 'registration_closed' 
      WHERE status IN ('upcoming', 'registration_open') 
      AND registration_deadline <= ${now.toISOString()} 
      AND event_date > ${now.toISOString()}
    `;
    
    // 3. Set to 'in_progress' if event has started
    await sqlClient`
      UPDATE events 
      SET status = 'in_progress' 
      WHERE status != 'completed' 
      AND event_date <= ${now.toISOString()} 
      AND event_date > ${new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()}
    `;
    
    // 4. Set to 'completed' if event was more than 24 hours ago
    await sqlClient`
      UPDATE events 
      SET status = 'completed' 
      WHERE status != 'completed' 
      AND event_date <= ${new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()}
    `;
    
    console.log('✅ Event statuses updated based on current date/time');
  },

  async canRegisterForEvent(eventId: string): Promise<{ canRegister: boolean; reason?: string }> {
    const event = await this.getEventById(eventId);
    if (!event) {
      return { canRegister: false, reason: 'Event not found' };
    }
    
    const now = new Date();
    const registrationDeadline = new Date(event.registrationDeadline);
    const eventDate = new Date(event.eventDate);
    
    // Check if registration deadline has passed
    if (now > registrationDeadline) {
      return { 
        canRegister: false, 
        reason: `Registration deadline has passed. The deadline was ${registrationDeadline.toLocaleDateString()} at ${registrationDeadline.toLocaleTimeString()}.`
      };
    }
    
    // Check if event has already started
    if (now > eventDate) {
      return { 
        canRegister: false, 
        reason: 'This event has already started or completed.'
      };
    }
    
    // Check event status
    if (!['upcoming', 'registration_open'].includes(event.status)) {
      return { 
        canRegister: false, 
        reason: `Registration is currently ${event.status === 'registration_closed' ? 'closed' : 'not available'} for this event.`
      };
    }
    
    return { canRegister: true };
  },

  // Waiver management for minors under 18
  async createWaiver(waiver: {
    dancerId: string;
    parentName: string;
    parentEmail: string;
    parentPhone: string;
    relationshipToDancer: string;
    signaturePath: string;
    idDocumentPath: string;
  }) {
    const sqlClient = getSql();
    const id = Date.now().toString();
    const signedDate = new Date().toISOString();
    const createdAt = new Date().toISOString();
    
    await sqlClient`
      INSERT INTO waivers (id, dancer_id, parent_name, parent_email, parent_phone, 
                          relationship_to_dancer, signed_date, signature_path, 
                          id_document_path, created_at)
      VALUES (${id}, ${waiver.dancerId}, ${waiver.parentName}, ${waiver.parentEmail}, 
              ${waiver.parentPhone}, ${waiver.relationshipToDancer}, ${signedDate}, 
              ${waiver.signaturePath}, ${waiver.idDocumentPath}, ${createdAt})
    `;
    
    return { id, signedDate };
  },

  async getWaiverByDancerId(dancerId: string) {
    const sqlClient = getSql();
    const result = await sqlClient`SELECT * FROM waivers WHERE dancer_id = ${dancerId}` as any[];
    if (result.length === 0) return null;
    
    const waiver = result[0];
    return {
      id: waiver.id,
      dancerId: waiver.dancer_id,
      parentName: waiver.parent_name,
      parentEmail: waiver.parent_email,
      parentPhone: waiver.parent_phone,
      relationshipToDancer: waiver.relationship_to_dancer,
      signedDate: waiver.signed_date,
      signaturePath: waiver.signature_path,
      idDocumentPath: waiver.id_document_path,
      approved: waiver.approved,
      approvedBy: waiver.approved_by,
      approvedAt: waiver.approved_at,
      createdAt: waiver.created_at
    };
  },

  async updateWaiverApproval(waiverId: string, approved: boolean, approvedBy?: string) {
    const sqlClient = getSql();
    const approvedAt = approved ? new Date().toISOString() : null;
    
    await sqlClient`
      UPDATE waivers 
      SET approved = ${approved}, approved_by = ${approvedBy || null}, approved_at = ${approvedAt}
      WHERE id = ${waiverId}
    `;
  },

  // Dancer approval management
  async approveDancer(dancerId: string, approvedBy: string) {
    const sqlClient = getSql();
    const approvedAt = new Date().toISOString();
    
    await sqlClient`
      UPDATE dancers 
      SET approved = TRUE, approved_by = ${approvedBy}, approved_at = ${approvedAt}, rejection_reason = NULL
      WHERE id = ${dancerId}
    `;
  },

  async rejectDancer(dancerId: string, rejectionReason: string, rejectedBy: string) {
    const sqlClient = getSql();
    
    await sqlClient`
      UPDATE dancers 
      SET approved = FALSE, approved_by = ${rejectedBy}, approved_at = NULL, rejection_reason = ${rejectionReason}
      WHERE id = ${dancerId}
    `;
  },

  async getAllPendingDancers() {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT d.*, c.eodsa_id, c.registration_date, s.name as studio_name, s.email as studio_email
      FROM dancers d
      JOIN contestants c ON d.eodsa_id = c.eodsa_id
      LEFT JOIN studios s ON c.email = s.email
      WHERE d.approved = FALSE AND d.rejection_reason IS NULL
      ORDER BY d.created_at DESC
    ` as any[];
    
    return result.map((row: any) => ({
      id: row.id,
      name: row.name,
      age: row.age,
      dateOfBirth: row.date_of_birth,
      style: row.national_id,
      nationalId: row.national_id,
      approved: row.approved,
      rejectionReason: row.rejection_reason,
      createdAt: row.created_at,
      eodsaId: row.eodsa_id,
      registrationDate: row.registration_date,
      studioName: row.studio_name,
      studioEmail: row.studio_email
    }));
  },

  async getAllDancersWithStatus() {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT d.*, c.eodsa_id, c.registration_date, s.name as studio_name, s.email as studio_email,
             j.name as approved_by_name
      FROM dancers d
      JOIN contestants c ON d.eodsa_id = c.eodsa_id
      LEFT JOIN studios s ON c.email = s.email
      LEFT JOIN judges j ON d.approved_by = j.id
      ORDER BY d.created_at DESC
    ` as any[];
    
    return result.map((row: any) => ({
      id: row.id,
      name: row.name,
      age: row.age,
      dateOfBirth: row.date_of_birth,
      style: row.national_id,
      nationalId: row.national_id,
      approved: row.approved,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      rejectionReason: row.rejection_reason,
      createdAt: row.created_at,
      eodsaId: row.eodsa_id,
      registrationDate: row.registration_date,
      studioName: row.studio_name,
      studioEmail: row.studio_email,
      approvedByName: row.approved_by_name
    }));
  },

  // Get all dancers for admin approval
  async getAllDancers(status?: 'pending' | 'approved' | 'rejected') {
    const sqlClient = getSql();
    let query = `SELECT d.*, j.name as approved_by_name FROM dancers d 
                 LEFT JOIN judges j ON d.approved_by = j.id`;
    
    if (status === 'pending') {
      query += ' WHERE d.approved = false AND d.rejection_reason IS NULL';
    } else if (status === 'approved') {
      query += ' WHERE d.approved = true';
    } else if (status === 'rejected') {
      query += ' WHERE d.approved = false AND d.rejection_reason IS NOT NULL';
    }
    
    query += ' ORDER BY d.created_at DESC';
    
    const result = (await sqlClient.unsafe(query)) as unknown as any[];
    
    return result.map((row: any) => ({
      id: row.id,
      eodsaId: row.eodsa_id,
      name: row.name,
      age: row.age,
      dateOfBirth: row.date_of_birth,
      nationalId: row.national_id,
      email: row.email,
      phone: row.phone,
      guardianName: row.guardian_name,
      guardianEmail: row.guardian_email,
      guardianPhone: row.guardian_phone,
      approved: row.approved,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      rejectionReason: row.rejection_reason,
      approvedByName: row.approved_by_name,
      createdAt: row.created_at
    }));
  }
};

// Studio operations
export const studioDb = {
  async createStudio(studio: {
    name: string;
    email: string;
    password: string;
    contactPerson: string;
    address: string;
    phone: string;
  }) {
    const sqlClient = getSql();
    
    // Check for duplicate email
    const existingEmail = await sqlClient`
      SELECT id FROM studios WHERE email = ${studio.email}
    ` as any[];
    
    if (existingEmail.length > 0) {
      throw new Error('A studio with this email address is already registered');
    }
    
    const id = Date.now().toString();
    const registrationNumber = generateStudioRegistrationId();
    const createdAt = new Date().toISOString();
    
    // AUTO-ACTIVATE: Set approved_by to 'system' and approved_at for immediate activation
    const approvedAt = new Date().toISOString();
    
    await sqlClient`
      INSERT INTO studios (id, name, email, password, contact_person, address, phone, registration_number, created_at, approved_by, approved_at)
      VALUES (${id}, ${studio.name}, ${studio.email}, ${studio.password}, ${studio.contactPerson}, 
              ${studio.address}, ${studio.phone}, ${registrationNumber}, ${createdAt}, 'system', ${approvedAt})
    `;
    
    return { id, registrationNumber };
  },

  async getStudioByEmail(email: string) {
    const sqlClient = getSql();
    const result = await sqlClient`SELECT * FROM studios WHERE email = ${email} AND is_active = TRUE` as any[];
    if (result.length === 0) return null;
    
    const studio = result[0];
    return {
      id: studio.id,
      name: studio.name,
      email: studio.email,
      password: studio.password,
      contactPerson: studio.contact_person,
      address: studio.address,
      phone: studio.phone,
      registrationNumber: studio.registration_number,
      isActive: studio.is_active,
      createdAt: studio.created_at
    };
  },

  async getStudioById(id: string) {
    const sqlClient = getSql();
    const result = await sqlClient`SELECT * FROM studios WHERE id = ${id} AND is_active = TRUE` as any[];
    if (result.length === 0) return null;
    
    const studio = result[0];
    return {
      id: studio.id,
      name: studio.name,
      email: studio.email,
      contactPerson: studio.contact_person,
      address: studio.address,
      phone: studio.phone,
      registrationNumber: studio.registration_number,
      isActive: studio.is_active,
      createdAt: studio.created_at
    };
  },

  async updateStudio(id: string, updates: {
    name?: string;
    contactPerson?: string;
    address?: string;
    phone?: string;
  }) {
    const sqlClient = getSql();
    
    // Update each field individually to avoid dynamic SQL issues
    if (updates.name !== undefined) {
      await sqlClient`UPDATE studios SET name = ${updates.name} WHERE id = ${id}`;
    }
    if (updates.contactPerson !== undefined) {
      await sqlClient`UPDATE studios SET contact_person = ${updates.contactPerson} WHERE id = ${id}`;
    }
    if (updates.address !== undefined) {
      await sqlClient`UPDATE studios SET address = ${updates.address} WHERE id = ${id}`;
    }
    if (updates.phone !== undefined) {
      await sqlClient`UPDATE studios SET phone = ${updates.phone} WHERE id = ${id}`;
    }
  },

  // Get all dancers registered under this studio
  async getStudioDancers(studioId: string) {
    const sqlClient = getSql();
    // Find contestants created by this studio (matching email/phone)
    const studio = await this.getStudioById(studioId);
    if (!studio) return [];

    const contestants = await sqlClient`
      SELECT * FROM contestants 
      WHERE type = 'studio' AND (email = ${studio.email} OR studio_name = ${studio.name})
      ORDER BY registration_date DESC
    ` as any[];

    const results = [];
    for (const contestant of contestants) {
      const dancers = await sqlClient`SELECT * FROM dancers WHERE eodsa_id = ${contestant.eodsa_id}` as any[];
      
      // Get waiver information for each dancer
      const dancersWithWaivers = [];
      for (const dancer of dancers) {
        const waiver = await this.getWaiverByDancerId(dancer.id);
        dancersWithWaivers.push({
          id: dancer.id,
          name: dancer.name,
          age: dancer.age,
          dateOfBirth: dancer.date_of_birth,
          style: dancer.national_id,
          nationalId: dancer.national_id,
          approved: dancer.approved,
          approvedBy: dancer.approved_by,
          approvedAt: dancer.approved_at,
          rejectionReason: dancer.rejection_reason,
          waiver: waiver
        });
      }
      
      results.push({
        eodsaId: contestant.eodsa_id,
        studioName: contestant.studio_name,
        registrationDate: contestant.registration_date,
        dancers: dancersWithWaivers
      });
    }
    return results;
  },

  // Add dancer to studio
  async addDancerToStudio(studioId: string, dancer: {
    name: string;
    age: number;
    dateOfBirth: string;
    nationalId: string;
  }) {
    const sqlClient = getSql();
    const studio = await this.getStudioById(studioId);
    if (!studio) throw new Error('Studio not found');

    // Generate IDs
    const dancerId = Date.now().toString() + Math.random().toString(36).substring(2, 8);
    const eodsaId = generateEODSAId();
    const registrationDate = new Date().toISOString();

    // Create a new contestant entry for this dancer
    await sqlClient`
      INSERT INTO contestants (id, eodsa_id, name, email, phone, type, date_of_birth,
                              privacy_policy_accepted, privacy_policy_accepted_at,
                              studio_name, studio_address, studio_contact_person,
                              studio_registration_number, registration_date)
      VALUES (${dancerId}, ${eodsaId}, ${dancer.name}, ${studio.email}, ${studio.phone},
              'studio', ${dancer.dateOfBirth}, TRUE, ${new Date().toISOString()},
              ${studio.name}, ${studio.address}, ${studio.contactPerson},
              ${studio.registrationNumber}, ${registrationDate})
    `;

    // Add the dancer to the new independent dancers table
    await sqlClient`
      INSERT INTO dancers (id, eodsa_id, name, date_of_birth, age, national_id)
      VALUES (${dancerId}, ${eodsaId}, ${dancer.name}, ${dancer.dateOfBirth}, ${dancer.age}, ${dancer.nationalId})
    `;

    return { eodsaId, dancerId };
  },

  // Update dancer information
  async updateDancer(dancerId: string, updates: {
    name?: string;
    age?: number;
    dateOfBirth?: string;
    nationalId?: string;
  }) {
    const sqlClient = getSql();
    
    // Update each field individually to avoid dynamic SQL issues
    if (updates.name !== undefined) {
      await sqlClient`UPDATE dancers SET name = ${updates.name} WHERE id = ${dancerId}`;
    }
    if (updates.age !== undefined) {
      await sqlClient`UPDATE dancers SET age = ${updates.age} WHERE id = ${dancerId}`;
    }
    if (updates.dateOfBirth !== undefined) {
      await sqlClient`UPDATE dancers SET date_of_birth = ${updates.dateOfBirth} WHERE id = ${dancerId}`;
    }
    if (updates.nationalId !== undefined) {
      await sqlClient`UPDATE dancers SET national_id = ${updates.nationalId} WHERE id = ${dancerId}`;
    }
  },

  // Delete dancer
  async deleteDancer(dancerId: string) {
    const sqlClient = getSql();
    
    // Get eodsa_id first
    const dancer = await sqlClient`SELECT eodsa_id FROM dancers WHERE id = ${dancerId}` as any[];
    if (dancer.length === 0) return;
    
    const eodsaId = dancer[0].eodsa_id;
    
    // Delete the dancer
    await sqlClient`DELETE FROM dancers WHERE id = ${dancerId}`;
    
    // Check if this was the only dancer for this eodsa_id
    const remainingDancers = await sqlClient`SELECT COUNT(*) as count FROM dancers WHERE eodsa_id = ${eodsaId}` as any[];
    
    // If no dancers left, delete the contestant record
    if (remainingDancers[0].count === 0) {
      await sqlClient`DELETE FROM contestants WHERE eodsa_id = ${eodsaId}`;
    }
  },

  // Waiver management for minors under 18
  async createWaiver(waiver: {
    dancerId: string;
    parentName: string;
    parentEmail: string;
    parentPhone: string;
    relationshipToDancer: string;
    signaturePath: string;
    idDocumentPath: string;
  }) {
    const sqlClient = getSql();
    const id = Date.now().toString();
    const signedDate = new Date().toISOString();
    const createdAt = new Date().toISOString();
    
    await sqlClient`
      INSERT INTO waivers (id, dancer_id, parent_name, parent_email, parent_phone, 
                          relationship_to_dancer, signed_date, signature_path, 
                          id_document_path, created_at)
      VALUES (${id}, ${waiver.dancerId}, ${waiver.parentName}, ${waiver.parentEmail}, 
              ${waiver.parentPhone}, ${waiver.relationshipToDancer}, ${signedDate}, 
              ${waiver.signaturePath}, ${waiver.idDocumentPath}, ${createdAt})
    `;
    
    return { id, signedDate };
  },

  async getWaiverByDancerId(dancerId: string) {
    const sqlClient = getSql();
    const result = await sqlClient`SELECT * FROM waivers WHERE dancer_id = ${dancerId}` as any[];
    if (result.length === 0) return null;
    
    const waiver = result[0];
    return {
      id: waiver.id,
      dancerId: waiver.dancer_id,
      parentName: waiver.parent_name,
      parentEmail: waiver.parent_email,
      parentPhone: waiver.parent_phone,
      relationshipToDancer: waiver.relationship_to_dancer,
      signedDate: waiver.signed_date,
      signaturePath: waiver.signature_path,
      idDocumentPath: waiver.id_document_path,
      approved: waiver.approved,
      approvedBy: waiver.approved_by,
      approvedAt: waiver.approved_at,
      createdAt: waiver.created_at
    };
  },

  async updateWaiverApproval(waiverId: string, approved: boolean, approvedBy?: string) {
    const sqlClient = getSql();
    const approvedAt = approved ? new Date().toISOString() : null;
    
    await sqlClient`
      UPDATE waivers 
      SET approved = ${approved}, approved_by = ${approvedBy || null}, approved_at = ${approvedAt}
      WHERE id = ${waiverId}
    `;
  },

  // Dancer approval management
  async approveDancer(dancerId: string, approvedBy: string) {
    const sqlClient = getSql();
    const approvedAt = new Date().toISOString();
    
    await sqlClient`
      UPDATE dancers 
      SET approved = TRUE, approved_by = ${approvedBy}, approved_at = ${approvedAt}, rejection_reason = NULL
      WHERE id = ${dancerId}
    `;
  },

  async rejectDancer(dancerId: string, rejectionReason: string, rejectedBy: string) {
    const sqlClient = getSql();
    
    await sqlClient`
      UPDATE dancers 
      SET approved = FALSE, approved_by = ${rejectedBy}, approved_at = NULL, rejection_reason = ${rejectionReason}
      WHERE id = ${dancerId}
    `;
  },

  async getAllPendingDancers() {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT d.*, c.eodsa_id, c.registration_date, s.name as studio_name, s.email as studio_email
      FROM dancers d
      JOIN contestants c ON d.eodsa_id = c.eodsa_id
      LEFT JOIN studios s ON c.email = s.email
      WHERE d.approved = FALSE AND d.rejection_reason IS NULL
      ORDER BY d.created_at DESC
    ` as any[];
    
    return result.map((row: any) => ({
      id: row.id,
      name: row.name,
      age: row.age,
      dateOfBirth: row.date_of_birth,
      style: row.national_id,
      nationalId: row.national_id,
      approved: row.approved,
      rejectionReason: row.rejection_reason,
      createdAt: row.created_at,
      eodsaId: row.eodsa_id,
      registrationDate: row.registration_date,
      studioName: row.studio_name,
      studioEmail: row.studio_email
    }));
  },

  async getAllDancersWithStatus() {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT d.*, c.eodsa_id, c.registration_date, s.name as studio_name, s.email as studio_email,
             j.name as approved_by_name
      FROM dancers d
      JOIN contestants c ON d.eodsa_id = c.eodsa_id
      LEFT JOIN studios s ON c.email = s.email
      LEFT JOIN judges j ON d.approved_by = j.id
      ORDER BY d.created_at DESC
    ` as any[];
    
    return result.map((row: any) => ({
      id: row.id,
      name: row.name,
      age: row.age,
      dateOfBirth: row.date_of_birth,
      style: row.national_id,
      nationalId: row.national_id,
      approved: row.approved,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      rejectionReason: row.rejection_reason,
      createdAt: row.created_at,
      eodsaId: row.eodsa_id,
      registrationDate: row.registration_date,
      studioName: row.studio_name,
      studioEmail: row.studio_email,
      approvedByName: row.approved_by_name
    }));
  }
};

// NEW: Unified dancer-studio system functions
export const unifiedDb = {
  // Individual dancer registration
  async registerDancer(dancer: {
    name: string;
    dateOfBirth: string;
    nationalId: string;
    email?: string;
    phone?: string;
    guardianName?: string;
    guardianEmail?: string;
    guardianPhone?: string;
  }) {
    const sqlClient = getSql();
    
    // Check for duplicate National ID
    const existingNationalId = await sqlClient`
      SELECT id FROM dancers WHERE national_id = ${dancer.nationalId}
    ` as any[];
    
    if (existingNationalId.length > 0) {
      throw new Error('A dancer with this National ID is already registered');
    }
    
    // Check for duplicate email if provided
    if (dancer.email) {
      const existingEmail = await sqlClient`
        SELECT id FROM dancers WHERE email = ${dancer.email}
      ` as any[];
      
      if (existingEmail.length > 0) {
        throw new Error('A dancer with this email address is already registered');
      }
    }
    
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 8);
    const eodsaId = generateEODSAId();
    const age = this.calculateAge(dancer.dateOfBirth);
    
    // AUTO-ACTIVATE: Set approved to TRUE for immediate activation
    const approvedAt = new Date().toISOString();
    
    await sqlClient`
      INSERT INTO dancers (id, eodsa_id, name, date_of_birth, age, national_id, email, phone, 
                          guardian_name, guardian_email, guardian_phone, approved, approved_at)
      VALUES (${id}, ${eodsaId}, ${dancer.name}, ${dancer.dateOfBirth}, ${age}, ${dancer.nationalId},
              ${dancer.email || null}, ${dancer.phone || null}, ${dancer.guardianName || null},
              ${dancer.guardianEmail || null}, ${dancer.guardianPhone || null}, TRUE, ${approvedAt})
    `;
    
    return { id, eodsaId };
  },

  // Get all dancers for admin approval
  async getAllDancers(status?: 'pending' | 'approved' | 'rejected') {
    const sqlClient = getSql();
    
    let result: any[];
    
    if (status === 'pending') {
      result = await sqlClient`
        SELECT d.*, j.name as approved_by_name 
        FROM dancers d 
        LEFT JOIN judges j ON d.approved_by = j.id
        WHERE d.approved = false AND d.rejection_reason IS NULL
        ORDER BY d.created_at DESC
      ` as any[];
    } else if (status === 'approved') {
      result = await sqlClient`
        SELECT d.*, j.name as approved_by_name 
        FROM dancers d 
        LEFT JOIN judges j ON d.approved_by = j.id
        WHERE d.approved = true
        ORDER BY d.created_at DESC
      ` as any[];
    } else if (status === 'rejected') {
      result = await sqlClient`
        SELECT d.*, j.name as approved_by_name 
        FROM dancers d 
        LEFT JOIN judges j ON d.approved_by = j.id
        WHERE d.approved = false AND d.rejection_reason IS NOT NULL
        ORDER BY d.created_at DESC
      ` as any[];
    } else {
      result = await sqlClient`
        SELECT d.*, j.name as approved_by_name 
        FROM dancers d 
        LEFT JOIN judges j ON d.approved_by = j.id
        ORDER BY d.created_at DESC
      ` as any[];
    }
    
    return result.map((row: any) => ({
      id: row.id,
      eodsaId: row.eodsa_id,
      name: row.name,
      age: row.age,
      dateOfBirth: row.date_of_birth,
      nationalId: row.national_id,
      email: row.email,
      phone: row.phone,
      guardianName: row.guardian_name,
      guardianEmail: row.guardian_email,
      guardianPhone: row.guardian_phone,
      approved: row.approved,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      rejectionReason: row.rejection_reason,
      approvedByName: row.approved_by_name,
      createdAt: row.created_at
    }));
  },

  // Admin approve/reject dancer
  async approveDancer(dancerId: string, adminId: string) {
    const sqlClient = getSql();
    const approvedAt = new Date().toISOString();
    
    await sqlClient`
      UPDATE dancers 
      SET approved = true, approved_by = ${adminId}, approved_at = ${approvedAt}, rejection_reason = null
      WHERE id = ${dancerId}
    `;
  },

  async rejectDancer(dancerId: string, rejectionReason: string, adminId: string) {
    const sqlClient = getSql();
    
    await sqlClient`
      UPDATE dancers 
      SET approved = false, approved_by = ${adminId}, approved_at = null, rejection_reason = ${rejectionReason}
      WHERE id = ${dancerId}
    `;
  },

  // Studio application system
  async applyToStudio(dancerId: string, studioId: string) {
    const sqlClient = getSql();
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 8);
    
    await sqlClient`
      INSERT INTO studio_applications (id, dancer_id, studio_id)
      VALUES (${id}, ${dancerId}, ${studioId})
    `;
    
    return { id };
  },

  // Get studio applications for a studio
  async getStudioApplications(studioId: string, status?: string) {
    const sqlClient = getSql();
    
    let result: any[];
    
    if (status) {
      result = await sqlClient`
        SELECT sa.*, d.name as dancer_name, d.age, d.date_of_birth, d.national_id, 
               d.email as dancer_email, d.phone as dancer_phone, d.approved as dancer_approved
        FROM studio_applications sa
        JOIN dancers d ON sa.dancer_id = d.id
        WHERE sa.studio_id = ${studioId} AND sa.status = ${status}
        ORDER BY sa.applied_at DESC
      ` as any[];
    } else {
      result = await sqlClient`
        SELECT sa.*, d.name as dancer_name, d.age, d.date_of_birth, d.national_id, 
               d.email as dancer_email, d.phone as dancer_phone, d.approved as dancer_approved
        FROM studio_applications sa
        JOIN dancers d ON sa.dancer_id = d.id
        WHERE sa.studio_id = ${studioId}
        ORDER BY sa.applied_at DESC
      ` as any[];
    }
    
    return result.map((row: any) => ({
      id: row.id,
      dancerId: row.dancer_id,
      studioId: row.studio_id,
      status: row.status,
      appliedAt: row.applied_at,
      respondedAt: row.responded_at,
      respondedBy: row.responded_by,
      rejectionReason: row.rejection_reason,
      dancer: {
        name: row.dancer_name,
        age: row.age,
        dateOfBirth: row.date_of_birth,
        nationalId: row.national_id,
        email: row.dancer_email,
        phone: row.dancer_phone,
        approved: row.dancer_approved
      }
    }));
  },

  // Get dancer applications for a dancer
  async getDancerApplications(dancerId: string) {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT sa.*, s.name as studio_name, s.email as studio_email, s.address as studio_address
      FROM studio_applications sa
      JOIN studios s ON sa.studio_id = s.id
      WHERE sa.dancer_id = ${dancerId}
      ORDER BY sa.applied_at DESC
    ` as any[];
    
    return result.map((row: any) => ({
      id: row.id,
      dancerId: row.dancer_id,
      studioId: row.studio_id,
      status: row.status,
      appliedAt: row.applied_at,
      respondedAt: row.responded_at,
      respondedBy: row.responded_by,
      rejectionReason: row.rejection_reason,
      studio: {
        name: row.studio_name,
        email: row.studio_email,
        address: row.studio_address
      }
    }));
  },

  // Studio accept/reject application or dancer withdraw
  async respondToApplication(applicationId: string, action: 'accept' | 'reject' | 'withdraw', respondedBy: string, rejectionReason?: string) {
    const sqlClient = getSql();
    const respondedAt = new Date().toISOString();
    let status: string = action;
    if (action === 'accept') status = 'accepted';
    if (action === 'reject') status = 'rejected';
    if (action === 'withdraw') status = 'withdrawn';
    
    await sqlClient`
      UPDATE studio_applications 
      SET status = ${status}, responded_at = ${respondedAt}, responded_by = ${respondedBy}, 
          rejection_reason = ${rejectionReason || null}
      WHERE id = ${applicationId}
    `;
  },

  // Get accepted dancers for a studio
  async getStudioDancers(studioId: string) {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT d.*, sa.applied_at, sa.responded_at
      FROM dancers d
      JOIN studio_applications sa ON d.id = sa.dancer_id
      WHERE sa.studio_id = ${studioId} AND sa.status = 'accepted' AND d.approved = true
      ORDER BY sa.responded_at DESC
    ` as any[];
    
    return result.map((row: any) => ({
      id: row.id,
      eodsaId: row.eodsa_id,
      name: row.name,
      age: row.age,
      dateOfBirth: row.date_of_birth,
      nationalId: row.national_id,
      email: row.email,
      phone: row.phone,
      approved: row.approved,
      joinedAt: row.responded_at
    }));
  },

  // Get all competition entries for a studio's dancers
  async getStudioEntries(studioId: string) {
    const sqlClient = getSql();
    
    // First get all dancers belonging to the studio
    const studioDancers = await this.getStudioDancers(studioId);
    const dancerEodsaIds = studioDancers.map(d => d.eodsaId);
    
    if (dancerEodsaIds.length === 0) {
      return [];
    }
    
    // Get all event entries for these dancers
    const result = await sqlClient`
      SELECT ee.*, e.name as event_name, e.region, e.event_date, e.venue, e.performance_type,
             c.name as contestant_name, c.type as contestant_type
      FROM event_entries ee
      JOIN events e ON ee.event_id = e.id
      JOIN contestants c ON ee.contestant_id = c.id
      WHERE ee.eodsa_id = ANY(${dancerEodsaIds})
      ORDER BY ee.submitted_at DESC
    ` as any[];
    
    // Enhance entries with participant names
    const enhancedEntries = await Promise.all(
      result.map(async (row: any) => {
        try {
          const contestant = await db.getContestantById(row.contestant_id);
          const participantNames = JSON.parse(row.participant_ids).map((id: string) => {
            const dancer = contestant?.dancers.find(d => d.id === id);
            return dancer?.name || 'Unknown Dancer';
          });
          
          return {
            id: row.id,
            eventId: row.event_id,
            eventName: row.event_name,
            region: row.region,
            eventDate: row.event_date,
            venue: row.venue,
            performanceType: row.performance_type,
            contestantId: row.contestant_id,
            contestantName: row.contestant_name,
            contestantType: row.contestant_type,
            eodsaId: row.eodsa_id,
            participantIds: JSON.parse(row.participant_ids),
            participantNames,
            calculatedFee: parseFloat(row.calculated_fee),
            paymentStatus: row.payment_status,
            paymentMethod: row.payment_method,
            submittedAt: row.submitted_at,
            approved: row.approved,
            qualifiedForNationals: row.qualified_for_nationals,
            itemNumber: row.item_number,
            itemName: row.item_name,
            choreographer: row.choreographer,
            mastery: row.mastery,
            itemStyle: row.item_style,
            estimatedDuration: row.estimated_duration,
            createdAt: row.created_at
          };
        } catch (error) {
          console.error(`Error processing entry ${row.id}:`, error);
          return null;
        }
      })
    );
    
    return enhancedEntries.filter(entry => entry !== null);
  },

  // Update a competition entry (studio verification)
  async updateStudioEntry(studioId: string, entryId: string, updates: {
    itemName?: string;
    choreographer?: string;
    mastery?: string;
    itemStyle?: string;
    estimatedDuration?: number;
    participantIds?: string[];
  }) {
    const sqlClient = getSql();
    
    // First verify this entry belongs to a dancer from this studio
    const entry = await sqlClient`
      SELECT ee.*, sa.studio_id
      FROM event_entries ee
      JOIN dancers d ON ee.eodsa_id = d.eodsa_id
      JOIN studio_applications sa ON d.id = sa.dancer_id
      WHERE ee.id = ${entryId} AND sa.studio_id = ${studioId} AND sa.status = 'accepted'
      LIMIT 1
    ` as any[];
    
    if (entry.length === 0) {
      throw new Error('Entry not found or not owned by this studio');
    }
    
    // Check if entry is still editable (not approved or event hasn't passed)
    const eventResult = await sqlClient`
      SELECT registration_deadline, event_date 
      FROM events 
      WHERE id = ${entry[0].event_id}
    ` as any[];
    
    if (eventResult.length > 0) {
      const deadline = new Date(eventResult[0].registration_deadline);
      const now = new Date();
      
      if (now > deadline) {
        throw new Error('Registration deadline has passed for this event');
      }
    }
    
    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];
    
    if (updates.itemName !== undefined) {
      updateFields.push('item_name = ?');
      updateValues.push(updates.itemName);
    }
    if (updates.choreographer !== undefined) {
      updateFields.push('choreographer = ?');
      updateValues.push(updates.choreographer);
    }
    if (updates.mastery !== undefined) {
      updateFields.push('mastery = ?');
      updateValues.push(updates.mastery);
    }
    if (updates.itemStyle !== undefined) {
      updateFields.push('item_style = ?');
      updateValues.push(updates.itemStyle);
    }
    if (updates.estimatedDuration !== undefined) {
      updateFields.push('estimated_duration = ?');
      updateValues.push(updates.estimatedDuration);
    }
    if (updates.participantIds !== undefined) {
      updateFields.push('participant_ids = ?');
      updateValues.push(JSON.stringify(updates.participantIds));
    }
    
    if (updateFields.length === 0) {
      throw new Error('No valid updates provided');
    }
    
    // Build the update query using postgres.js syntax
    let updateQuery = 'UPDATE event_entries SET ';
    const updateParts = [];
    
    if (updates.itemName !== undefined) {
      updateParts.push(sqlClient`item_name = ${updates.itemName}`);
    }
    if (updates.choreographer !== undefined) {
      updateParts.push(sqlClient`choreographer = ${updates.choreographer}`);
    }
    if (updates.mastery !== undefined) {
      updateParts.push(sqlClient`mastery = ${updates.mastery}`);
    }
    if (updates.itemStyle !== undefined) {
      updateParts.push(sqlClient`item_style = ${updates.itemStyle}`);
    }
    if (updates.estimatedDuration !== undefined) {
      updateParts.push(sqlClient`estimated_duration = ${updates.estimatedDuration}`);
    }
    if (updates.participantIds !== undefined) {
      updateParts.push(sqlClient`participant_ids = ${JSON.stringify(updates.participantIds)}`);
    }
    
    // Execute the update
    if (updates.itemName !== undefined) {
      await sqlClient`UPDATE event_entries SET item_name = ${updates.itemName} WHERE id = ${entryId}`;
    }
    if (updates.choreographer !== undefined) {
      await sqlClient`UPDATE event_entries SET choreographer = ${updates.choreographer} WHERE id = ${entryId}`;
    }
    if (updates.mastery !== undefined) {
      await sqlClient`UPDATE event_entries SET mastery = ${updates.mastery} WHERE id = ${entryId}`;
    }
    if (updates.itemStyle !== undefined) {
      await sqlClient`UPDATE event_entries SET item_style = ${updates.itemStyle} WHERE id = ${entryId}`;
    }
    if (updates.estimatedDuration !== undefined) {
      await sqlClient`UPDATE event_entries SET estimated_duration = ${updates.estimatedDuration} WHERE id = ${entryId}`;
    }
    if (updates.participantIds !== undefined) {
      await sqlClient`UPDATE event_entries SET participant_ids = ${JSON.stringify(updates.participantIds)} WHERE id = ${entryId}`;
    }
    
    // Return updated entry
    const updatedResult = await sqlClient`
      SELECT * FROM event_entries WHERE id = ${entryId}
    ` as any[];
    
    return updatedResult[0];
  },

  // Delete/withdraw a competition entry (studio verification)
  async deleteStudioEntry(studioId: string, entryId: string) {
    const sqlClient = getSql();
    
    // First verify this entry belongs to a dancer from this studio
    const entry = await sqlClient`
      SELECT ee.*, sa.studio_id
      FROM event_entries ee
      JOIN dancers d ON ee.eodsa_id = d.eodsa_id
      JOIN studio_applications sa ON d.id = sa.dancer_id
      WHERE ee.id = ${entryId} AND sa.studio_id = ${studioId} AND sa.status = 'accepted'
      LIMIT 1
    ` as any[];
    
    if (entry.length === 0) {
      throw new Error('Entry not found or not owned by this studio');
    }
    
    // Check if entry is still editable (not approved or event hasn't passed)
    const eventResult = await sqlClient`
      SELECT registration_deadline, event_date 
      FROM events 
      WHERE id = ${entry[0].event_id}
    ` as any[];
    
    if (eventResult.length > 0) {
      const deadline = new Date(eventResult[0].registration_deadline);
      const now = new Date();
      
      if (now > deadline) {
        throw new Error('Registration deadline has passed for this event');
      }
    }
    
    // Delete the entry and any associated performances
    await sqlClient`DELETE FROM scores WHERE performance_id IN (
      SELECT id FROM performances WHERE event_entry_id = ${entryId}
    )`;
    
    await sqlClient`DELETE FROM performances WHERE event_entry_id = ${entryId}`;
    
    await sqlClient`DELETE FROM event_entries WHERE id = ${entryId}`;
    
    return { success: true, message: 'Entry withdrawn successfully' };
  },

  // Get available studios for dancer applications
  async getAvailableStudios(dancerId: string) {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT s.* FROM studios s
      WHERE s.approved_by IS NOT NULL 
      AND s.id NOT IN (
        SELECT studio_id FROM studio_applications 
        WHERE dancer_id = ${dancerId} AND status IN ('pending', 'accepted')
      )
      ORDER BY s.name
    ` as any[];
    
    return result.map((row: any) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      contactPerson: row.contact_person,
      address: row.address,
      phone: row.phone,
      registrationNumber: row.registration_number
    }));
  },

  // Studio management functions
  async getAllStudios() {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT s.*, 
             j.name as approved_by_name
      FROM studios s
      LEFT JOIN judges j ON s.approved_by = j.id
      ORDER BY s.created_at DESC
    ` as any[];
    
    return result.map((row: any) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      registrationNumber: row.registration_number,
      approved: row.approved_by !== null,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      rejectionReason: row.rejection_reason,
      approvedByName: row.approved_by_name,
      createdAt: row.created_at
    }));
  },

  async approveStudio(studioId: string, adminId: string) {
    const sqlClient = getSql();
    const approvedAt = new Date().toISOString();
    
    await sqlClient`
      UPDATE studios 
      SET approved_by = ${adminId}, approved_at = ${approvedAt}, rejection_reason = null
      WHERE id = ${studioId}
    `;
  },

  async rejectStudio(studioId: string, adminId: string, rejectionReason: string) {
    const sqlClient = getSql();
    
    await sqlClient`
      UPDATE studios 
      SET approved = false, approved_by = ${adminId}, approved_at = null, rejection_reason = ${rejectionReason}
      WHERE id = ${studioId}
    `;
  },

  // Get all studio applications for admin overview
  async getAllStudioApplications() {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT sa.*, 
             d.eodsa_id as dancer_eodsa_id, d.name as dancer_name, d.age as dancer_age, d.approved as dancer_approved,
             s.name as studio_name, s.registration_number as studio_registration_number
      FROM studio_applications sa
      JOIN dancers d ON sa.dancer_id = d.id
      JOIN studios s ON sa.studio_id = s.id
      ORDER BY sa.applied_at DESC
    ` as any[];
    
    return result.map((row: any) => ({
      id: row.id,
      dancerId: row.dancer_id,
      studioId: row.studio_id,
      status: row.status,
      appliedAt: row.applied_at,
      respondedAt: row.responded_at,
      respondedBy: row.responded_by,
      rejectionReason: row.rejection_reason,
      dancer: {
        eodsaId: row.dancer_eodsa_id,
        name: row.dancer_name,
        age: row.dancer_age,
        approved: row.dancer_approved
      },
      studio: {
        name: row.studio_name,
        registrationNumber: row.studio_registration_number
      }
    }));
  },

  // Get dancer by ID
  async getDancerById(dancerId: string) {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT * FROM dancers WHERE id = ${dancerId}
    ` as any[];
    
    if (result.length === 0) {
      return null;
    }
    
    const row = result[0];
    return {
      id: row.id,
      eodsaId: row.eodsa_id,
      name: row.name,
      age: row.age,
      dateOfBirth: row.date_of_birth,
      nationalId: row.national_id,
      email: row.email,
      phone: row.phone,
      guardianName: row.guardian_name,
      guardianEmail: row.guardian_email,
      guardianPhone: row.guardian_phone,
      approved: row.approved,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      rejectionReason: row.rejection_reason,
      createdAt: row.created_at
    };
  },

  // Get dancer by EODSA ID for authentication
  async getDancerByEodsaId(eodsaId: string) {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT * FROM dancers WHERE eodsa_id = ${eodsaId}
    ` as any[];
    
    if (result.length === 0) {
      return null;
    }
    
    const row = result[0];
    return {
      id: row.id,
      eodsaId: row.eodsa_id,
      name: row.name,
      age: row.age,
      dateOfBirth: row.date_of_birth,
      nationalId: row.national_id,
      email: row.email,
      phone: row.phone,
      guardianName: row.guardian_name,
      guardianEmail: row.guardian_email,
      guardianPhone: row.guardian_phone,
      approved: row.approved,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      rejectionReason: row.rejection_reason,
      createdAt: row.created_at
    };
  },

  // Directly add a registered dancer to a studio by EODSA ID (Studio Head feature)
  async addDancerToStudioByEodsaId(studioId: string, eodsaId: string, addedBy: string) {
    const sqlClient = getSql();
    
    // First, check if dancer exists and is approved
    const dancer = await this.getDancerByEodsaId(eodsaId);
    if (!dancer) {
      throw new Error('Dancer not found with this EODSA ID');
    }
    
    if (!dancer.approved) {
      throw new Error('Dancer must be admin-approved before being added to a studio');
    }
    
    // Check if dancer is already associated with this studio
    const existingApplication = await sqlClient`
      SELECT * FROM studio_applications 
      WHERE dancer_id = ${dancer.id} AND studio_id = ${studioId}
    ` as any[];
    
    if (existingApplication.length > 0) {
      const app = existingApplication[0];
      if (app.status === 'accepted') {
        throw new Error('Dancer is already a member of this studio');
      } else if (app.status === 'pending') {
        throw new Error('Dancer already has a pending application to this studio');
      }
    }
    
    // Generate unique application ID
    const applicationId = `app-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const appliedAt = new Date().toISOString();
    const respondedAt = new Date().toISOString();
    
    // Create an accepted application record (bypassing the approval process)
    await sqlClient`
      INSERT INTO studio_applications (
        id, dancer_id, studio_id, status, applied_at, responded_at, responded_by
      ) VALUES (
        ${applicationId}, ${dancer.id}, ${studioId}, 'accepted', ${appliedAt}, ${respondedAt}, ${addedBy}
      )
    `;
    
    return {
      id: applicationId,
      dancerId: dancer.id,
      studioId: studioId,
      status: 'accepted',
      appliedAt: appliedAt,
      respondedAt: respondedAt,
      respondedBy: addedBy,
      dancer: dancer
    };
  },

  // Update dancer information
  async updateDancer(dancerId: string, updates: {
    name?: string;
    age?: number;
    dateOfBirth?: string;
    nationalId?: string;
    email?: string;
    phone?: string;
  }) {
    const sqlClient = getSql();
    
    // Update each field individually to avoid SQL injection
    if (updates.name !== undefined) {
      await sqlClient`UPDATE dancers SET name = ${updates.name} WHERE id = ${dancerId}`;
    }
    if (updates.age !== undefined) {
      await sqlClient`UPDATE dancers SET age = ${updates.age} WHERE id = ${dancerId}`;
    }
    if (updates.dateOfBirth !== undefined) {
      await sqlClient`UPDATE dancers SET date_of_birth = ${updates.dateOfBirth} WHERE id = ${dancerId}`;
    }
    if (updates.nationalId !== undefined) {
      await sqlClient`UPDATE dancers SET national_id = ${updates.nationalId} WHERE id = ${dancerId}`;
    }
    if (updates.email !== undefined) {
      await sqlClient`UPDATE dancers SET email = ${updates.email} WHERE id = ${dancerId}`;
    }
    if (updates.phone !== undefined) {
      await sqlClient`UPDATE dancers SET phone = ${updates.phone} WHERE id = ${dancerId}`;
    }
  },

  // Remove dancer from studio
  async removeDancerFromStudio(studioId: string, dancerId: string) {
    const sqlClient = getSql();
    
    // Set application status to withdrawn
    await sqlClient`
      UPDATE studio_applications 
      SET status = 'withdrawn', responded_at = CURRENT_TIMESTAMP
      WHERE studio_id = ${studioId} AND dancer_id = ${dancerId} AND status = 'accepted'
    `;
  },

  // Search dancers by name, EODSA ID, or national ID
  async searchDancers(query: string, limit: number = 20): Promise<any[]> {
    const sqlClient = getSql();
    
    // Search in both dancers and contestants tables
    const searchPattern = `%${query.toLowerCase()}%`;
    
    try {
      // Search unified dancers first
      const dancersResult = await sqlClient`
        SELECT d.*, 
               CASE WHEN sa.studio_id IS NOT NULL THEN json_build_object(
                 'studioId', s.id,
                 'studioName', s.name
               ) ELSE NULL END as studio_association
        FROM dancers d
        LEFT JOIN studio_applications sa ON d.id = sa.dancer_id AND sa.status = 'accepted'
        LEFT JOIN studios s ON sa.studio_id = s.id
        WHERE (
          LOWER(d.name) LIKE ${searchPattern} OR
          LOWER(d.eodsa_id) LIKE ${searchPattern} OR
          LOWER(d.national_id) LIKE ${searchPattern}
        )
        AND d.approved = true
        ORDER BY d.name
        LIMIT ${limit}
      ` as any[];

      return dancersResult.map((row: any) => ({
        id: row.id,
        eodsaId: row.eodsa_id,
        name: row.name,
        age: row.age,
        dateOfBirth: row.date_of_birth,
        nationalId: row.national_id,
        email: row.email,
        phone: row.phone,
        guardianName: row.guardian_name,
        guardianEmail: row.guardian_email,
        guardianPhone: row.guardian_phone,
        approved: row.approved,
        rejectionReason: row.rejection_reason,
        studioAssociation: row.studio_association
      }));
    } catch (error) {
      console.error('Error searching dancers:', error);
      return [];
    }
  },

  // Utility function to calculate age
  calculateAge(dateOfBirth: string): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  },

  // Password reset token functions
  async createPasswordResetToken(email: string, userType: 'judge' | 'admin' | 'studio', userId: string) {
    const sqlClient = getSql();
    
    // Generate a secure random token
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const tokenId = `reset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Token expires in 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const createdAt = new Date().toISOString();
    
    // Clean up any existing unused tokens for this email
    await sqlClient`
      DELETE FROM password_reset_tokens 
      WHERE email = ${email} AND used = FALSE
    `;
    
    // Insert new token
    await sqlClient`
      INSERT INTO password_reset_tokens (
        id, email, token, user_type, user_id, expires_at, created_at
      ) VALUES (
        ${tokenId}, ${email}, ${token}, ${userType}, ${userId}, ${expiresAt}, ${createdAt}
      )
    `;
    
    return {
      id: tokenId,
      token: token,
      expiresAt: expiresAt
    };
  },

  async validatePasswordResetToken(token: string) {
    const sqlClient = getSql();
    
    const result = await sqlClient`
      SELECT * FROM password_reset_tokens 
      WHERE token = ${token} AND used = FALSE AND expires_at > CURRENT_TIMESTAMP
    ` as any[];
    
    if (result.length === 0) {
      return null;
    }
    
    const row = result[0];
    return {
      id: row.id,
      email: row.email,
      userType: row.user_type,
      userId: row.user_id,
      expiresAt: row.expires_at,
      createdAt: row.created_at
    };
  },

  async markPasswordResetTokenAsUsed(tokenId: string) {
    const sqlClient = getSql();
    const usedAt = new Date().toISOString();
    
    await sqlClient`
      UPDATE password_reset_tokens 
      SET used = TRUE, used_at = ${usedAt}
      WHERE id = ${tokenId}
    `;
  },

  async updatePassword(userType: 'judge' | 'admin' | 'studio', userId: string, hashedPassword: string) {
    const sqlClient = getSql();
    
    if (userType === 'judge' || userType === 'admin') {
      await sqlClient`
        UPDATE judges 
        SET password = ${hashedPassword}
        WHERE id = ${userId}
      `;
    } else if (userType === 'studio') {
      await sqlClient`
        UPDATE studios 
        SET password = ${hashedPassword}
        WHERE id = ${userId}
      `;
    } else {
      throw new Error('Invalid user type');
    }
  }
};

 