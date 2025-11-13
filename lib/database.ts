import { neon } from '@neondatabase/serverless';
import type { Contestant, Performance, Judge, Score, Dancer, EventEntry, Ranking, Event } from './types';
import { getMedalFromPercentage } from './types';

// Create database connection using Neon serverless driver
// Only initialize if we have a DATABASE_URL (server-side only)
let sql: ReturnType<typeof neon> | null = null;
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

export const getSql = () => {
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

// Initialize database tables for Phase 1 - only runs once per server instance
export const initializeDatabase = async () => {
  try {
    console.log('🚀 Ensuring database schema is up to date...');
    const sqlClient = getSql();
    
    // Use robust "IF NOT EXISTS" for all schema changes
    await sqlClient`ALTER TABLE dancers ADD COLUMN IF NOT EXISTS registration_fee_paid BOOLEAN DEFAULT FALSE`;
    await sqlClient`ALTER TABLE dancers ADD COLUMN IF NOT EXISTS registration_fee_paid_at TEXT`;
    await sqlClient`ALTER TABLE dancers ADD COLUMN IF NOT EXISTS registration_fee_mastery_level TEXT`;
    await sqlClient`ALTER TABLE dancers ADD COLUMN IF NOT EXISTS province TEXT`;
    
    // Add other checks here as needed, for example:
    await sqlClient`ALTER TABLE event_entries ADD COLUMN IF NOT EXISTS qualified_for_nationals BOOLEAN DEFAULT FALSE`;
    await sqlClient`ALTER TABLE event_entries ADD COLUMN IF NOT EXISTS item_number INTEGER`;
    await sqlClient`ALTER TABLE event_entries ADD COLUMN IF NOT EXISTS payment_reference TEXT`;
    await sqlClient`ALTER TABLE event_entries ADD COLUMN IF NOT EXISTS payment_date TEXT`;
    await sqlClient`ALTER TABLE event_entries ADD COLUMN IF NOT EXISTS virtual_item_number INTEGER`;
    // Add rankings API required columns
    await sqlClient`ALTER TABLE event_entries ADD COLUMN IF NOT EXISTS performance_type TEXT`;
    await sqlClient`ALTER TABLE event_entries ADD COLUMN IF NOT EXISTS age_category TEXT`;
    await sqlClient`ALTER TABLE events ADD COLUMN IF NOT EXISTS event_end_date TEXT`;
    await sqlClient`ALTER TABLE performances ADD COLUMN IF NOT EXISTS item_number INTEGER`;
    await sqlClient`ALTER TABLE performances ADD COLUMN IF NOT EXISTS performance_order INTEGER`;
    await sqlClient`ALTER TABLE performances ADD COLUMN IF NOT EXISTS withdrawn_from_judging BOOLEAN DEFAULT FALSE`;
    await sqlClient`ALTER TABLE performances ADD COLUMN IF NOT EXISTS announced BOOLEAN DEFAULT FALSE`;
    await sqlClient`ALTER TABLE performances ADD COLUMN IF NOT EXISTS announced_by TEXT`;
    await sqlClient`ALTER TABLE performances ADD COLUMN IF NOT EXISTS announced_at TEXT`;
    await sqlClient`ALTER TABLE performances ADD COLUMN IF NOT EXISTS announcer_notes TEXT`;
    
    // Add configurable fee structure columns to events table
    await sqlClient`ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_fee_per_dancer DECIMAL(10,2) DEFAULT 300`;
    await sqlClient`ALTER TABLE events ADD COLUMN IF NOT EXISTS solo_1_fee DECIMAL(10,2) DEFAULT 400`;
    await sqlClient`ALTER TABLE events ADD COLUMN IF NOT EXISTS solo_2_fee DECIMAL(10,2) DEFAULT 750`;
    await sqlClient`ALTER TABLE events ADD COLUMN IF NOT EXISTS solo_3_fee DECIMAL(10,2) DEFAULT 1050`;
    await sqlClient`ALTER TABLE events ADD COLUMN IF NOT EXISTS solo_additional_fee DECIMAL(10,2) DEFAULT 100`;
    await sqlClient`ALTER TABLE events ADD COLUMN IF NOT EXISTS duo_trio_fee_per_dancer DECIMAL(10,2) DEFAULT 280`;
    await sqlClient`ALTER TABLE events ADD COLUMN IF NOT EXISTS group_fee_per_dancer DECIMAL(10,2) DEFAULT 220`;
    await sqlClient`ALTER TABLE events ADD COLUMN IF NOT EXISTS large_group_fee_per_dancer DECIMAL(10,2) DEFAULT 190`;
    await sqlClient`ALTER TABLE events ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'ZAR'`;
    
    // Add participation mode column to events table (live, virtual, or hybrid)
    await sqlClient`ALTER TABLE events ADD COLUMN IF NOT EXISTS participation_mode TEXT DEFAULT 'hybrid' CHECK (participation_mode IN ('live', 'virtual', 'hybrid'))`;

    // Phase 2: Virtual entry support columns
    await sqlClient`ALTER TABLE performances ADD COLUMN IF NOT EXISTS entry_type TEXT DEFAULT 'live'`;
    await sqlClient`ALTER TABLE performances ADD COLUMN IF NOT EXISTS video_external_url TEXT`;
    await sqlClient`ALTER TABLE performances ADD COLUMN IF NOT EXISTS video_external_type TEXT`;
    await sqlClient`ALTER TABLE performances ADD COLUMN IF NOT EXISTS music_file_url TEXT`;
    await sqlClient`ALTER TABLE performances ADD COLUMN IF NOT EXISTS music_file_name TEXT`;
    
    // Create EFT payment logs table for tracking manual payments
    await sqlClient`
      CREATE TABLE IF NOT EXISTS eft_payment_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        user_email TEXT,
        user_name TEXT,
        eodsa_id TEXT,
        amount DECIMAL(10,2),
        invoice_number TEXT,
        item_description TEXT,
        entries_count INTEGER DEFAULT 0,
        submitted_at TEXT,
        status TEXT DEFAULT 'pending_verification',
        verified_by TEXT,
        verified_at TEXT,
        notes TEXT,
        registration_paid BOOLEAN DEFAULT FALSE
      )
    `;

    // Create registration_charged_flags table to track if registration was CHARGED (not necessarily paid)
    await sqlClient`
      CREATE TABLE IF NOT EXISTS registration_charged_flags (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        event_id TEXT NOT NULL,
        dancer_id TEXT,
        eodsa_id TEXT NOT NULL,
        charged_at TEXT NOT NULL,
        UNIQUE(event_id, eodsa_id)
      )
    `;

    // Create transaction_records table for payment tracking
    await sqlClient`
      CREATE TABLE IF NOT EXISTS transaction_records (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        entry_id TEXT REFERENCES event_entries(id) ON DELETE SET NULL,
        event_id TEXT NOT NULL,
        dancer_id TEXT,
        eodsa_id TEXT NOT NULL,
        expected_amount DECIMAL(10,2) NOT NULL,
        amount_paid DECIMAL(10,2) DEFAULT 0,
        registration_paid_flag BOOLEAN DEFAULT FALSE,
        registration_charged_flag BOOLEAN DEFAULT FALSE,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'refunded')),
        payment_method TEXT CHECK (payment_method IN ('payfast', 'eft', 'credit_card', 'bank_transfer', 'invoice')),
        payment_reference TEXT,
        client_sent_total DECIMAL(10,2),
        computed_total DECIMAL(10,2),
        mismatch_detected BOOLEAN DEFAULT FALSE,
        mismatch_reason TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create indexes for transaction_records
    await sqlClient`CREATE INDEX IF NOT EXISTS idx_transaction_records_entry_id ON transaction_records(entry_id)`;
    await sqlClient`CREATE INDEX IF NOT EXISTS idx_transaction_records_event_id ON transaction_records(event_id)`;
    await sqlClient`CREATE INDEX IF NOT EXISTS idx_transaction_records_eodsa_id ON transaction_records(eodsa_id)`;
    await sqlClient`CREATE INDEX IF NOT EXISTS idx_transaction_records_status ON transaction_records(status)`;
    await sqlClient`CREATE INDEX IF NOT EXISTS idx_transaction_records_mismatch ON transaction_records(mismatch_detected) WHERE mismatch_detected = true`;

    // Create indexes for registration_charged_flags
    await sqlClient`CREATE INDEX IF NOT EXISTS idx_registration_charged_event_eodsa ON registration_charged_flags(event_id, eodsa_id)`;
    
    // Fix performance type constraint to allow 'All' - FORCE UPDATE
    try {
      console.log('🔧 Updating performance type constraint...');
      await sqlClient`
        DO $$ 
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'events_performance_type_check'
          ) THEN
            ALTER TABLE events DROP CONSTRAINT events_performance_type_check;
          END IF;
          
          ALTER TABLE events ADD CONSTRAINT events_performance_type_check 
            CHECK (performance_type IN ('Solo', 'Duet', 'Trio', 'Group', 'All'));
        END $$;
      `;
      console.log('✅ Performance type constraint updated successfully');
    } catch (error) {
      console.error('❌ Error updating performance type constraint:', error);
    }

    // Fix payment method constraint to allow 'eft' - FORCE UPDATE
    try {
      console.log('🔧 Updating payment method constraint...');
      await sqlClient`
        DO $$ 
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'event_entries_payment_method_check'
          ) THEN
            ALTER TABLE event_entries DROP CONSTRAINT event_entries_payment_method_check;
          END IF;
          
          ALTER TABLE event_entries ADD CONSTRAINT event_entries_payment_method_check 
            CHECK (payment_method IN ('credit_card', 'bank_transfer', 'invoice', 'payfast', 'eft'));
        END $$;
      `;
      console.log('✅ Payment method constraint updated successfully');
    } catch (error) {
      console.error('❌ Error updating payment method constraint:', error);
    }

    // Remove foreign key constraint for contestant_id since it can reference both contestants and dancers
    try {
      console.log('🔧 Removing contestant_id foreign key constraint...');
      await sqlClient`ALTER TABLE event_entries DROP CONSTRAINT IF EXISTS event_entries_contestant_id_fkey`;
      console.log('✅ Contestant ID foreign key constraint removed successfully');
    } catch (error) {
      console.error('❌ Error removing contestant_id foreign key constraint:', error);
    }

    // 🏆 NATIONALS TABLES - REMOVED
    // The nationals system has been removed. Regional competitions are now referred to as "Nationals".

    // NEW: Add role column to judges table for new user types
    await sqlClient`ALTER TABLE judges ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'judge'`;
    
    // NEW: Performance presence tracking table
    await sqlClient`
      CREATE TABLE IF NOT EXISTS performance_presence (
        id TEXT PRIMARY KEY,
        performance_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        present BOOLEAN DEFAULT FALSE,
        checked_in_by TEXT,
        checked_in_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // NEW: Score approval system table
    await sqlClient`
      CREATE TABLE IF NOT EXISTS score_approvals (
        id TEXT PRIMARY KEY,
        performance_id TEXT NOT NULL,
        judge_id TEXT NOT NULL,
        score_id TEXT NOT NULL,
        approved_by TEXT,
        approved_at TEXT,
        rejected BOOLEAN DEFAULT FALSE,
        rejection_reason TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // NEW: Add completed status to performances for announcer tracking
    await sqlClient`ALTER TABLE performances ADD COLUMN IF NOT EXISTS announced BOOLEAN DEFAULT FALSE`;
    await sqlClient`ALTER TABLE performances ADD COLUMN IF NOT EXISTS announced_by TEXT`;
    await sqlClient`ALTER TABLE performances ADD COLUMN IF NOT EXISTS announced_at TEXT`;

    // Add published flag to performances for score publishing
    await sqlClient`ALTER TABLE performances ADD COLUMN IF NOT EXISTS scores_published BOOLEAN DEFAULT FALSE`;
    await sqlClient`ALTER TABLE performances ADD COLUMN IF NOT EXISTS scores_published_at TEXT`;
    await sqlClient`ALTER TABLE performances ADD COLUMN IF NOT EXISTS scores_published_by TEXT`;

    // GABRIEL'S SCORE APPROVAL TABLE
    await sqlClient`
      CREATE TABLE IF NOT EXISTS score_approvals (
        id TEXT PRIMARY KEY,
        performance_id TEXT NOT NULL,
        judge_id TEXT NOT NULL,
        judge_name TEXT NOT NULL,
        performance_title TEXT NOT NULL,
        score_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        approved_by TEXT,
        approved_at TEXT,
        rejected BOOLEAN DEFAULT FALSE,
        rejection_reason TEXT,
        created_at TEXT NOT NULL
      )
    `;

    // Score edit audit logs table
    await sqlClient`
      CREATE TABLE IF NOT EXISTS score_edit_logs (
        id TEXT PRIMARY KEY,
        score_id TEXT NOT NULL,
        performance_id TEXT NOT NULL,
        judge_id TEXT NOT NULL,
        judge_name TEXT,
        old_values JSONB,
        new_values JSONB,
        edited_by TEXT NOT NULL,
        edited_by_name TEXT,
        edited_at TEXT NOT NULL
      )
    `;

    // Certificates table
    await sqlClient`
      CREATE TABLE IF NOT EXISTS certificates (
        id TEXT PRIMARY KEY,
        dancer_id TEXT NOT NULL,
        dancer_name TEXT NOT NULL,
        eodsa_id TEXT,
        email TEXT,
        performance_id TEXT,
        event_entry_id TEXT,
        percentage DECIMAL(5,2) NOT NULL,
        style TEXT NOT NULL,
        title TEXT NOT NULL,
        medallion TEXT NOT NULL,
        event_date TEXT,
        certificate_url TEXT,
        cloudinary_public_id TEXT,
        sent_at TEXT,
        sent_by TEXT,
        downloaded BOOLEAN DEFAULT FALSE,
        downloaded_at TEXT,
        created_at TEXT NOT NULL,
        created_by TEXT
      )
    `;

    // Certificate position settings per dancer
    await sqlClient`
      CREATE TABLE IF NOT EXISTS certificate_positions (
        id TEXT PRIMARY KEY,
        dancer_id TEXT NOT NULL UNIQUE,
        dancer_name TEXT NOT NULL,
        name_top DECIMAL(5,2),
        name_font_size INTEGER,
        percentage_top DECIMAL(5,2),
        percentage_left DECIMAL(5,2),
        percentage_font_size INTEGER,
        style_top DECIMAL(5,2),
        style_left DECIMAL(5,2),
        style_font_size INTEGER,
        title_top DECIMAL(5,2),
        title_left DECIMAL(5,2),
        title_font_size INTEGER,
        medallion_top DECIMAL(5,2),
        medallion_left DECIMAL(5,2),
        medallion_font_size INTEGER,
        date_top DECIMAL(5,2),
        date_left DECIMAL(5,2),
        date_font_size INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `;

    console.log('✅ Database schema is up to date.');
    
    // Return the database object for use in API routes
    return db; 
    
    } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error; // Re-throw to fail the API request if db init fails
  }
};

// Clean database and create only the main admin account
export const cleanDatabase = async () => {
  try {
    const sqlClient = getSql();
    const bcrypt = await import('bcryptjs');
    
    console.log('🧹 Cleaning database completely...');
    
    // Delete all data in dependency order (most dependent first)
    await sqlClient`DELETE FROM scores`;
    await sqlClient`DELETE FROM rankings`;
    await sqlClient`DELETE FROM performances`;
    await sqlClient`DELETE FROM event_entries`;
    await sqlClient`DELETE FROM nationals_event_entries`;
    await sqlClient`DELETE FROM judge_event_assignments`;
    await sqlClient`DELETE FROM events`;
    await sqlClient`DELETE FROM studio_applications`;
    await sqlClient`DELETE FROM dancers`;
    await sqlClient`DELETE FROM contestants`;
    await sqlClient`DELETE FROM studios`;
    
    // Remove ALL judges (including admins)
    await sqlClient`DELETE FROM judges`;
    
    // Create the main admin account
    console.log('👑 Creating main admin account...');
    const hashedPassword = await bcrypt.hash('624355Mage55!', 10);
    const newAdminId = `judge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await sqlClient`
      INSERT INTO judges (id, name, email, password, is_admin, specialization) 
      VALUES (${newAdminId}, 'Main Admin', 'mains@elementscentral.com', ${hashedPassword}, true, '[]')
    `;
    
    console.log('✅ Database cleaned successfully - Only main admin account remains');
    console.log('📝 Admin login: mains@elementscentral.com / 624355Mage55!');
  } catch (error) {
    console.error('Error cleaning database:', error);
    throw error;
  }
};

// Helper function to get total judges assigned to an event
// Returns the count of judges assigned, or falls back to the number of scores submitted if no judges assigned
export async function getTotalJudgesForEvent(eventId: string, performanceId?: string): Promise<number> {
  const sqlClient = getSql();
  
  try {
    // First, try to get count from judge_event_assignments
    const judgeCountResult = await sqlClient`
      SELECT COUNT(DISTINCT judge_id) as total_judges
      FROM judge_event_assignments
      WHERE event_id = ${eventId}
    ` as any[];
    
    const totalJudges = parseInt(judgeCountResult[0]?.total_judges || '0');
    
    // If judges are assigned, return that count
    if (totalJudges > 0) {
      return totalJudges;
    }
    
    // Fallback: if no judges assigned yet, use count of scores submitted for this performance
    // This prevents division by zero and handles edge cases
    if (performanceId) {
      const scoreCountResult = await sqlClient`
        SELECT COUNT(DISTINCT judge_id) as scored_judges
        FROM scores
        WHERE performance_id = ${performanceId}
      ` as any[];
      
      const scoredJudges = parseInt(scoreCountResult[0]?.scored_judges || '0');
      return scoredJudges > 0 ? scoredJudges : 1; // Minimum 1 to avoid division by zero
    }
    
    // If no performance ID provided and no judges assigned, default to 1
    return 1;
  } catch (error) {
    console.error('Error getting total judges for event:', error);
    // Safe fallback: return 1 to avoid division by zero
    return 1;
  }
}

// Database operations

export const db = {
  // Contestants
  async createContestant(contestant: Omit<Contestant, 'id' | 'eodsaId' | 'registrationDate' | 'eventEntries'>) {
    const sqlClient = getSql();
    const id = Date.now().toString();
    const eodsaId = generateEODSAId();
    const registrationDate = new Date().toISOString();
    
    await sqlClient`
      INSERT INTO contestants (id, eodsa_id, name, email, phone, type, date_of_birth, registration_date)
      VALUES (${id}, ${eodsaId}, ${contestant.name}, ${contestant.email}, ${contestant.phone}, 
              ${contestant.type}, ${contestant.dateOfBirth}, ${registrationDate})
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
      privacyPolicyAcceptedAt: registrationDate
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
      guardianInfo: undefined, // Guardian info not stored in contestants table
      privacyPolicyAccepted: true, // Default to true for created contestants
      privacyPolicyAcceptedAt: contestant.registration_date, // Use registration date
      studioName: undefined, // Studio info not stored in contestants table
      studioInfo: undefined, // Studio info not stored in contestants table
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

  async getContestantByEmail(email: string) {
    const sqlClient = getSql();
    const result = await sqlClient`SELECT * FROM contestants WHERE email = ${email}` as any[];
    if (result.length === 0) return null;
    
    const contestant = result[0];
    const dancers = await sqlClient`SELECT * FROM dancers WHERE eodsa_id = ${contestant.eodsa_id}` as any[];
    const eventEntries = await sqlClient`SELECT * FROM event_entries WHERE contestant_id = ${contestant.id}` as any[];
    
    return {
      id: contestant.id,
      eodsaId: contestant.eodsa_id,
      name: contestant.name,
      email: contestant.email,
      phone: contestant.phone,
      type: contestant.type,
      dateOfBirth: contestant.date_of_birth,
      guardianInfo: undefined, // Guardian info not stored in contestants table
      privacyPolicyAccepted: true, // Default to true for created contestants
      privacyPolicyAcceptedAt: contestant.registration_date, // Use registration date
      studioName: undefined, // Studio info not stored in contestants table
      studioInfo: undefined, // Studio info not stored in contestants table
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
      guardianInfo: undefined, // Guardian info not stored in contestants table
      privacyPolicyAccepted: true, // Default to true for created contestants
      privacyPolicyAcceptedAt: row.registration_date, // Use registration date
      studioName: undefined, // Studio info not stored in contestants table
      studioInfo: undefined, // Studio info not stored in contestants table
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
        INSERT INTO event_entries (
          id, event_id, contestant_id, eodsa_id, participant_ids, calculated_fee, payment_status, submitted_at,
          approved, qualified_for_nationals, item_number, item_name, choreographer, mastery, item_style, estimated_duration,
          entry_type, music_file_url, music_file_name, video_file_url, video_file_name, video_external_url, video_external_type,
          performance_type, age_category
        )
        VALUES (
          ${id}, ${eventEntry.eventId}, ${eventEntry.contestantId}, ${eventEntry.eodsaId}, ${JSON.stringify(eventEntry.participantIds)},
          ${eventEntry.calculatedFee}, ${eventEntry.paymentStatus}, ${submittedAt}, ${eventEntry.approved},
          ${eventEntry.qualifiedForNationals || false}, ${eventEntry.itemNumber || null}, ${eventEntry.itemName},
          ${eventEntry.choreographer}, ${eventEntry.mastery}, ${eventEntry.itemStyle}, ${eventEntry.estimatedDuration},
          ${eventEntry.entryType || 'live'}, ${eventEntry.musicFileUrl || null}, ${eventEntry.musicFileName || null},
          ${eventEntry.videoFileUrl || null}, ${eventEntry.videoFileName || null}, ${eventEntry.videoExternalUrl || null},
          ${eventEntry.videoExternalType || null}, ${(eventEntry as any).performanceType || null}, ${(eventEntry as any).ageCategory || null}
        )
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
              VALUES (${eventEntry.contestantId}, ${dancer.eodsaId}, ${dancer.name}, ${dancer.email || `temp-${dancer.id}@example.com`}, ${dancer.phone || '0000000000'}, 'private', ${dancer.dateOfBirth}, ${new Date().toISOString()})
              ON CONFLICT (id) DO NOTHING
            `;
            
            console.log(`✅ Contestant record created for dancer ${dancer.name}`);
            
            // Verify contestant was created before trying again
            const newContestant = await unifiedDb.getDancerById(eventEntry.contestantId);

            if (newContestant) {
            // Now try to insert the event entry again
            await sqlClient`
              INSERT INTO event_entries (
                id, event_id, contestant_id, eodsa_id, participant_ids, calculated_fee, payment_status, submitted_at,
                approved, qualified_for_nationals, item_number, item_name, choreographer, mastery, item_style, estimated_duration,
                entry_type, music_file_url, music_file_name, video_file_url, video_file_name, video_external_url, video_external_type,
                performance_type, age_category
              )
              VALUES (
                ${id}, ${eventEntry.eventId}, ${eventEntry.contestantId}, ${eventEntry.eodsaId}, ${JSON.stringify(eventEntry.participantIds)},
                ${eventEntry.calculatedFee}, ${eventEntry.paymentStatus}, ${submittedAt}, ${eventEntry.approved},
                ${eventEntry.qualifiedForNationals || false}, ${eventEntry.itemNumber || null}, ${eventEntry.itemName},
                ${eventEntry.choreographer}, ${eventEntry.mastery}, ${eventEntry.itemStyle}, ${eventEntry.estimatedDuration},
                ${eventEntry.entryType || 'live'}, ${eventEntry.musicFileUrl || null}, ${eventEntry.musicFileName || null},
                ${eventEntry.videoFileUrl || null}, ${eventEntry.videoFileName || null}, ${eventEntry.videoExternalUrl || null},
                ${eventEntry.videoExternalType || null}, ${(eventEntry as any).performanceType || null}, ${(eventEntry as any).ageCategory || null}
              )
            `;

            console.log(`✅ Event entry ${id} created successfully after creating contestant record`);
            } else {
                throw new Error(`Failed to create or find contestant record for dancer ID: ${eventEntry.contestantId}`);
            }
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
      itemNumber: row.item_number,
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
      paymentReference: row.payment_reference,
      paymentDate: row.payment_date,
      submittedAt: row.submitted_at,
      approved: row.approved,
      qualifiedForNationals: row.qualified_for_nationals,
      itemNumber: row.item_number,
      virtualItemNumber: row.virtual_item_number,
      itemName: row.item_name,
      choreographer: row.choreographer,
      mastery: row.mastery,
      itemStyle: row.item_style,
      estimatedDuration: row.estimated_duration,
      // PHASE 2: Live vs Virtual Entry Support
      entryType: row.entry_type || 'live',
      musicFileUrl: row.music_file_url,
      musicFileName: row.music_file_name,
      videoFileUrl: row.video_file_url,
      videoFileName: row.video_file_name,
      videoExternalUrl: row.video_external_url,
      videoExternalType: row.video_external_type,
      performanceType: row.performance_type,
      ageCategory: row.age_category
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
    
    if (updates.paymentReference !== undefined) {
      await sqlClient`
        UPDATE event_entries 
        SET payment_reference = ${updates.paymentReference}
        WHERE id = ${id}
      `;
    }
    
    if (updates.paymentDate !== undefined) {
      await sqlClient`
        UPDATE event_entries 
        SET payment_date = ${updates.paymentDate}
        WHERE id = ${id}
      `;
    }
    
        // PHASE 2: Handle music file updates
    if (updates.musicFileUrl !== undefined) {
      await sqlClient`
        UPDATE event_entries 
        SET music_file_url = ${updates.musicFileUrl || null}
        WHERE id = ${id}
      `;
    }

    if (updates.musicFileName !== undefined) {
      await sqlClient`
        UPDATE event_entries 
        SET music_file_name = ${updates.musicFileName || null}
        WHERE id = ${id}
      `;
    }
    
        // Handle video file updates for virtual entries
    if (updates.videoFileUrl !== undefined) {
      await sqlClient`
        UPDATE event_entries 
        SET video_file_url = ${updates.videoFileUrl || null}
        WHERE id = ${id}
      `;
    }

    if (updates.videoFileName !== undefined) {
      await sqlClient`
        UPDATE event_entries 
        SET video_file_name = ${updates.videoFileName || null}
        WHERE id = ${id}
      `;
    }

    if (updates.videoExternalUrl !== undefined) {
      await sqlClient`
        UPDATE event_entries 
        SET video_external_url = ${updates.videoExternalUrl || null}
        WHERE id = ${id}
      `;
    }

    if (updates.videoExternalType !== undefined) {
      await sqlClient`
        UPDATE event_entries 
        SET video_external_type = ${updates.videoExternalType || null}
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

  // DEPRECATED: Use calculateEODSAFee from types.ts instead
  async calculateFee(ageCategory: string, performanceType: string) {
    // Return simplified fees for backwards compatibility
    switch (performanceType.toLowerCase()) {
      case 'solo': return 400; // R400 for 1 solo
      case 'duet': return 280; // R280 per dancer
      case 'trio': return 280; // R280 per dancer
      case 'group': return 220; // R220 per dancer (default to small group)
      default: return 0;
    }
  },

  // Performances (updated for Phase 1)
  async createPerformance(performance: Omit<Performance, 'id'>) {
    const sqlClient = getSql();
    const id = Date.now().toString();
    
    // Ensure optional music cue column exists
    try {
      await sqlClient`ALTER TABLE performances ADD COLUMN IF NOT EXISTS music_cue TEXT`;
    } catch {}

    await sqlClient`
      INSERT INTO performances (
        id, event_id, event_entry_id, contestant_id, title, participant_names, duration,
        choreographer, mastery, item_style, scheduled_time, status, item_number, music_cue, age_category
      )
      VALUES (
        ${id}, ${performance.eventId}, ${performance.eventEntryId}, ${performance.contestantId}, ${performance.title},
        ${JSON.stringify(performance.participantNames)}, ${performance.duration}, ${performance.choreographer},
        ${performance.mastery}, ${performance.itemStyle}, ${performance.scheduledTime || null}, ${performance.status},
        ${performance.itemNumber || null}, ${((performance as any).musicCue) || null}, ${performance.ageCategory || null}
      )
    `;
    
    return { ...performance, id };
  },

  async getAllPerformances() {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT p.*, c.name as contestant_name 
      FROM performances p 
      LEFT JOIN contestants c ON p.contestant_id = c.id 
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
      itemNumber: row.item_number,
      performanceOrder: row.performance_order,
      withdrawnFromJudging: row.withdrawn_from_judging || false,
      choreographer: row.choreographer,
      mastery: row.mastery,
      itemStyle: row.item_style,
      ageCategory: row.age_category || null,
      scheduledTime: row.scheduled_time,
      status: row.status,
      contestantName: row.contestant_name,
      musicCue: row.music_cue || null
    })) as (Performance & { contestantName: string })[];
  },

  async getPerformanceById(performanceId: string) {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT p.*, c.name as contestant_name 
      FROM performances p 
      LEFT JOIN contestants c ON p.contestant_id = c.id 
      WHERE p.id = ${performanceId}
    ` as any[];
    
    if (result.length === 0) return null;
    
    const row = result[0];
    
    // Safely parse participant_names - handle both JSON and plain string/array
    let participantNames: string[] = [];
    try {
      if (row.participant_names) {
        if (typeof row.participant_names === 'string') {
          // Try to parse as JSON first
          try {
            participantNames = JSON.parse(row.participant_names);
          } catch {
            // If not JSON, treat as a single string or comma-separated
            participantNames = row.participant_names.includes(',') 
              ? row.participant_names.split(',').map((n: string) => n.trim())
              : [row.participant_names];
          }
        } else if (Array.isArray(row.participant_names)) {
          participantNames = row.participant_names;
        }
      }
    } catch (error) {
      console.error('Error parsing participant_names:', error, row.participant_names);
      participantNames = [];
    }
    
    return {
      id: row.id,
      eventId: row.event_id,
      eventEntryId: row.event_entry_id,
      contestantId: row.contestant_id,
      title: row.title,
      participantNames,
      duration: row.duration,
      itemNumber: row.item_number,
      withdrawnFromJudging: row.withdrawn_from_judging || false,
      choreographer: row.choreographer,
      mastery: row.mastery,
      itemStyle: row.item_style,
      scheduledTime: row.scheduled_time,
      status: row.status,
      contestantName: row.contestant_name,
      musicCue: row.music_cue || null
    } as Performance & { contestantName: string };
  },

  // Withdrawal management
  async withdrawPerformanceFromJudging(performanceId: string) {
    const sqlClient = getSql();
    await sqlClient`
      UPDATE performances 
      SET withdrawn_from_judging = true 
      WHERE id = ${performanceId}
    `;
    return true;
  },

  async restorePerformanceToJudging(performanceId: string) {
    const sqlClient = getSql();
    await sqlClient`
      UPDATE performances 
      SET withdrawn_from_judging = false 
      WHERE id = ${performanceId}
    `;
    return true;
  },

  async updatePerformanceStatus(performanceId: string, status: string) {
    const sqlClient = getSql();
    await sqlClient`
      UPDATE performances 
      SET status = ${status}
      WHERE id = ${performanceId}
    `;
    return true;
  },

  async updatePerformanceMusicCue(performanceId: string, musicCue: 'onstage' | 'offstage') {
    const sqlClient = getSql();
    // Ensure column exists
    try {
      await sqlClient`ALTER TABLE performances ADD COLUMN IF NOT EXISTS music_cue TEXT`;
    } catch {}
    await sqlClient`
      UPDATE performances
      SET music_cue = ${musicCue}
      WHERE id = ${performanceId}
    `;
    return true;
  },

  // Rankings and Tabulation
  async calculateNationalsRankings(eventIds?: string[]) {
    const sqlClient = getSql();
    
    try {
      console.log('Calculating nationals rankings with eventIds:', eventIds);
      
      let result: any[] = [];

      // Handle event filtering
      if (eventIds && eventIds.length > 0) {
        console.log('Filtering by specific nationals events:', eventIds);
        
        // For single event (most common case)
        if (eventIds.length === 1) {
          const eventId = eventIds[0];
          result = await sqlClient`
            SELECT 
              nee.id as performance_id,
              ne.id as event_id,
              ne.name as event_name,
              'Nationals' as region,
              nee.age_category,
              nee.performance_type,
              nee.item_name as title,
              nee.item_style,
              nee.participant_ids,
              c.name as contestant_name,
              c.type as contestant_type,
              c.studio_name,
              AVG(ns.technical_score + ns.musical_score + ns.performance_score + ns.styling_score + ns.overall_impression_score) as total_score,
              AVG((ns.technical_score + ns.musical_score + ns.performance_score + ns.styling_score + ns.overall_impression_score) / 5) as average_score,
              COUNT(ns.id) as judge_count,
              nee.choreographer,
              nee.mastery,
              nee.item_number
            FROM nationals_event_entries nee
            JOIN nationals_events ne ON nee.nationals_event_id = ne.id
            JOIN contestants c ON nee.contestant_id = c.id
            LEFT JOIN nationals_scores ns ON nee.id = ns.performance_id
            WHERE ne.id = ${eventId} AND nee.approved = true
            GROUP BY nee.id, ne.id, ne.name, nee.age_category, nee.performance_type, nee.item_name, nee.item_style, nee.participant_ids, c.name, c.type, c.studio_name, nee.choreographer, nee.mastery, nee.item_number
            HAVING COUNT(ns.id) > 0
            ORDER BY total_score DESC
          ` as any[];
        } else {
          // For multiple events, query each separately and combine
          const allResults = [];
          for (const eventId of eventIds) {
            const eventResult = await sqlClient`
              SELECT 
                nee.id as performance_id,
                ne.id as event_id,
                ne.name as event_name,
                'Nationals' as region,
                nee.age_category,
                nee.performance_type,
                nee.item_name as title,
                nee.item_style,
                nee.participant_ids,
                c.name as contestant_name,
                c.type as contestant_type,
                c.studio_name,
                AVG(ns.technical_score + ns.musical_score + ns.performance_score + ns.styling_score + ns.overall_impression_score) as total_score,
                AVG((ns.technical_score + ns.musical_score + ns.performance_score + ns.styling_score + ns.overall_impression_score) / 5) as average_score,
                COUNT(ns.id) as judge_count,
                nee.choreographer,
                nee.mastery,
                nee.item_number
              FROM nationals_event_entries nee
              JOIN nationals_events ne ON nee.nationals_event_id = ne.id
              JOIN contestants c ON nee.contestant_id = c.id
              LEFT JOIN nationals_scores ns ON nee.id = ns.performance_id
              WHERE ne.id = ${eventId} AND nee.approved = true
              GROUP BY nee.id, ne.id, ne.name, nee.age_category, nee.performance_type, nee.item_name, nee.item_style, nee.participant_ids, c.name, c.type, c.studio_name, nee.choreographer, nee.mastery, nee.item_number
              HAVING COUNT(ns.id) > 0
              ORDER BY total_score DESC
            ` as any[];
            allResults.push(...eventResult);
          }
          result = allResults;
        }
      } else {
        // No event filtering - get all nationals rankings
        result = await sqlClient`
          SELECT 
            nee.id as performance_id,
            ne.id as event_id,
            ne.name as event_name,
            'Nationals' as region,
            nee.age_category,
            nee.performance_type,
            nee.item_name as title,
            nee.item_style,
            nee.participant_ids,
            c.name as contestant_name,
            c.type as contestant_type,
            c.studio_name,
            AVG(ns.technical_score + ns.musical_score + ns.performance_score + ns.styling_score + ns.overall_impression_score) as total_score,
            AVG((ns.technical_score + ns.musical_score + ns.performance_score + ns.styling_score + ns.overall_impression_score) / 5) as average_score,
            COUNT(ns.id) as judge_count,
            nee.choreographer,
            nee.mastery,
            nee.item_number
          FROM nationals_event_entries nee
          JOIN nationals_events ne ON nee.nationals_event_id = ne.id
          JOIN contestants c ON nee.contestant_id = c.id
          LEFT JOIN nationals_scores ns ON nee.id = ns.performance_id
          WHERE nee.approved = true
          GROUP BY nee.id, ne.id, ne.name, nee.age_category, nee.performance_type, nee.item_name, nee.item_style, nee.participant_ids, c.name, c.type, c.studio_name, nee.choreographer, nee.mastery, nee.item_number
          HAVING COUNT(ns.id) > 0
          ORDER BY total_score DESC
        ` as any[];
      }
      
      console.log('Nationals Rankings SQL Result:', result);
      console.log('Nationals Result length:', result.length);
      
      // Ensure result is an array
      if (!Array.isArray(result)) {
        console.warn('Nationals rankings query did not return an array:', result);
        return [];
      }

      // If no results, return empty array
      if (result.length === 0) {
        console.log('No nationals rankings found for the given criteria');
        return [];
      }

      // Calculate rankings within each category
      const formattedResult = result.map((row: any, index: number) => {
        const participantNames = row.participant_ids ? JSON.parse(row.participant_ids) : [];
        const totalScore = parseFloat(row.total_score) || 0;
        const averageScore = parseFloat(row.average_score) || 0;
        const judgeCount = parseInt(row.judge_count) || 0;
        const maxPossibleScore = judgeCount * 100; // Each judge can give max 100 points
        const percentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
        
        const medalInfo = getMedalFromPercentage(percentage);
        const rankingLevel = medalInfo.label;
        
        return {
          performanceId: row.performance_id,
          eventId: row.event_id,
          eventName: row.event_name,
          region: row.region,
          ageCategory: row.age_category,
          performanceType: row.performance_type,
          title: row.title,
          itemStyle: row.item_style,
          contestantName: participantNames.length > 0 ? participantNames.join(', ') : row.contestant_name,
          participantNames: participantNames,
          studioName: row.studio_name,
          totalScore: totalScore,
          averageScore: averageScore,
          rank: index + 1, // Simple ranking based on total score order
          judgeCount: judgeCount,
          percentage: Math.round(percentage),
          rankingLevel: rankingLevel,
          choreographer: row.choreographer,
          mastery: row.mastery,
          itemNumber: row.item_number
        };
      });

      // Sort by total score descending and assign proper ranks
      formattedResult.sort((a, b) => b.totalScore - a.totalScore);
      
      // Assign ranks considering ties
      let currentRank = 1;
      for (let i = 0; i < formattedResult.length; i++) {
        if (i > 0 && formattedResult[i].totalScore < formattedResult[i-1].totalScore) {
          currentRank = i + 1;
        }
        formattedResult[i].rank = currentRank;
      }

      console.log('Formatted nationals rankings result:', formattedResult);
      return formattedResult;
      
    } catch (error) {
      console.error('Error in calculateNationalsRankings:', error);
      return [];
    }
  },

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
              p.item_number,
              p.mastery,
              p.event_entry_id,
              e.id as event_id,
              e.name as event_name,
              e.region,
              e.age_category,
              COALESCE(
                ee.performance_type,
                CASE 
                  WHEN jsonb_array_length(ee.participant_ids::jsonb) = 1 THEN 'Solo'
                  WHEN jsonb_array_length(ee.participant_ids::jsonb) = 2 THEN 'Duet'
                  WHEN jsonb_array_length(ee.participant_ids::jsonb) = 3 THEN 'Trio'
                  WHEN jsonb_array_length(ee.participant_ids::jsonb) >= 4 THEN 'Group'
                  ELSE e.performance_type
                END
              ) as performance_type,
              e.event_date,
              p.title,
              p.item_style,
              p.participant_names,
              c.name as contestant_name,
              c.type as contestant_type,
              c.studio_name,
              ee.participant_ids,
              ee.entry_type,
              SUM(s.technical_score + s.musical_score + s.performance_score + s.styling_score + s.overall_impression_score) as total_score,
              COUNT(DISTINCT jea.judge_id) as total_judges_assigned,
              COUNT(s.id) as judge_count
            FROM performances p
            JOIN events e ON p.event_id = e.id
            LEFT JOIN contestants c ON p.contestant_id = c.id
            LEFT JOIN event_entries ee ON ee.id = p.event_entry_id
            LEFT JOIN scores s ON p.id = s.performance_id
            LEFT JOIN judge_event_assignments jea ON jea.event_id = e.id
            WHERE e.id = ${eventId} AND p.scores_published = true
            GROUP BY p.id, p.item_number, p.mastery, p.event_entry_id, e.id, e.name, e.region, e.age_category, ee.performance_type, e.performance_type, e.event_date, p.title, p.item_style, p.participant_names, c.name, c.type, c.studio_name, ee.participant_ids, ee.entry_type
            HAVING COUNT(s.id) > 0
            ORDER BY e.region, e.age_category, performance_type, total_score DESC
          ` as any[];
        } else {
          // For multiple events, we'll query each separately and combine
          const allResults = [];
          for (const eventId of eventIds) {
            const eventResult = await sqlClient`
              SELECT 
                p.id as performance_id,
                p.item_number,
                p.mastery,
                p.event_entry_id,
                e.id as event_id,
                e.name as event_name,
                e.region,
                e.age_category,
                COALESCE(
                  ee.performance_type,
                  CASE 
                    WHEN jsonb_array_length(ee.participant_ids::jsonb) = 1 THEN 'Solo'
                    WHEN jsonb_array_length(ee.participant_ids::jsonb) = 2 THEN 'Duet'
                    WHEN jsonb_array_length(ee.participant_ids::jsonb) = 3 THEN 'Trio'
                    WHEN jsonb_array_length(ee.participant_ids::jsonb) >= 4 THEN 'Group'
                    ELSE e.performance_type
                  END
                ) as performance_type,
                e.event_date,
                p.title,
                p.item_style,
                p.participant_names,
                c.name as contestant_name,
                c.type as contestant_type,
                c.studio_name,
                ee.participant_ids,
                ee.entry_type,
                SUM(s.technical_score + s.musical_score + s.performance_score + s.styling_score + s.overall_impression_score) as total_score,
                COUNT(DISTINCT jea.judge_id) as total_judges_assigned,
                COUNT(s.id) as judge_count
              FROM performances p
              JOIN events e ON p.event_id = e.id
              JOIN contestants c ON p.contestant_id = c.id
              LEFT JOIN event_entries ee ON ee.id = p.event_entry_id
              LEFT JOIN scores s ON p.id = s.performance_id
              LEFT JOIN judge_event_assignments jea ON jea.event_id = e.id
              WHERE e.id = ${eventId} AND p.scores_published = true
              GROUP BY p.id, p.item_number, p.mastery, p.event_entry_id, e.id, e.name, e.region, e.age_category, ee.performance_type, e.performance_type, e.event_date, p.title, p.item_style, p.participant_names, c.name, c.type, c.studio_name, ee.participant_ids, ee.entry_type
              HAVING COUNT(s.id) > 0
              ORDER BY e.region, e.age_category, performance_type, total_score DESC
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
              p.item_number,
              p.mastery,
              p.event_entry_id,
              e.id as event_id,
              e.name as event_name,
              e.region,
              e.age_category,
              e.performance_type,
              e.event_date,
              p.title,
              p.item_style,
              p.participant_names,
              c.name as contestant_name,
              c.type as contestant_type,
              c.studio_name,
              ee.participant_ids,
              ee.entry_type,
              SUM(s.technical_score + s.musical_score + s.performance_score + s.styling_score + s.overall_impression_score) as total_score,
              COUNT(DISTINCT jea.judge_id) as total_judges_assigned,
              COUNT(s.id) as judge_count
              FROM performances p
              JOIN events e ON p.event_id = e.id
              LEFT JOIN contestants c ON p.contestant_id = c.id
              LEFT JOIN event_entries ee ON ee.id = p.event_entry_id
              LEFT JOIN scores s ON p.id = s.performance_id
              LEFT JOIN judge_event_assignments jea ON jea.event_id = e.id
              WHERE e.region = ${region} AND e.age_category = ${ageCategory} AND e.performance_type = ${performanceType} AND p.scores_published = true
            GROUP BY p.id, p.item_number, p.mastery, p.event_entry_id, e.id, e.name, e.region, e.age_category, e.performance_type, e.event_date, p.title, p.item_style, p.participant_names, c.name, c.type, c.studio_name, ee.participant_ids, ee.entry_type
            HAVING COUNT(s.id) > 0
            ORDER BY e.region, e.age_category, e.performance_type, total_score DESC
          ` as any[];
        } else if (region && ageCategory) {
          result = await sqlClient`
            SELECT 
              p.id as performance_id,
              p.item_number,
              p.mastery,
              p.event_entry_id,
              e.id as event_id,
              e.name as event_name,
              e.region,
              e.age_category,
              e.performance_type,
              e.event_date,
              p.title,
              p.item_style,
              p.participant_names,
              c.name as contestant_name,
              c.type as contestant_type,
              c.studio_name,
              ee.participant_ids,
              ee.entry_type,
              SUM(s.technical_score + s.musical_score + s.performance_score + s.styling_score + s.overall_impression_score) as total_score,
              COUNT(DISTINCT jea.judge_id) as total_judges_assigned,
              COUNT(s.id) as judge_count
              FROM performances p
              JOIN events e ON p.event_id = e.id
              LEFT JOIN contestants c ON p.contestant_id = c.id
              LEFT JOIN event_entries ee ON ee.id = p.event_entry_id
              LEFT JOIN scores s ON p.id = s.performance_id
              LEFT JOIN judge_event_assignments jea ON jea.event_id = e.id
              WHERE e.region = ${region} AND e.age_category = ${ageCategory} AND p.scores_published = true
            GROUP BY p.id, p.item_number, p.mastery, p.event_entry_id, e.id, e.name, e.region, e.age_category, e.performance_type, e.event_date, p.title, p.item_style, p.participant_names, c.name, c.type, c.studio_name, ee.participant_ids, ee.entry_type
            HAVING COUNT(s.id) > 0
            ORDER BY e.region, e.age_category, e.performance_type, total_score DESC
          ` as any[];
        } else if (region) {
          result = await sqlClient`
            SELECT 
              p.id as performance_id,
              p.item_number,
              p.mastery,
              p.event_entry_id,
              e.id as event_id,
              e.name as event_name,
              e.region,
              e.age_category,
              e.performance_type,
              e.event_date,
              p.title,
              p.item_style,
              p.participant_names,
              c.name as contestant_name,
              c.type as contestant_type,
              c.studio_name,
              ee.participant_ids,
              ee.entry_type,
              SUM(s.technical_score + s.musical_score + s.performance_score + s.styling_score + s.overall_impression_score) as total_score,
              COUNT(DISTINCT jea.judge_id) as total_judges_assigned,
              COUNT(s.id) as judge_count
              FROM performances p
              JOIN events e ON p.event_id = e.id
              LEFT JOIN contestants c ON p.contestant_id = c.id
              LEFT JOIN event_entries ee ON ee.id = p.event_entry_id
              LEFT JOIN scores s ON p.id = s.performance_id
              LEFT JOIN judge_event_assignments jea ON jea.event_id = e.id
              WHERE e.region = ${region} AND p.scores_published = true
            GROUP BY p.id, p.item_number, p.mastery, p.event_entry_id, e.id, e.name, e.region, e.age_category, e.performance_type, e.event_date, p.title, p.item_style, p.participant_names, c.name, c.type, c.studio_name, ee.participant_ids, ee.entry_type
            HAVING COUNT(s.id) > 0
            ORDER BY e.region, e.age_category, e.performance_type, total_score DESC
          ` as any[];
        } else {
          result = await sqlClient`
            SELECT 
              p.id as performance_id,
              p.item_number,
              p.mastery,
              p.event_entry_id,
              e.id as event_id,
              e.name as event_name,
              e.region,
              e.age_category,
              COALESCE(
                ee.performance_type,
                CASE 
                  WHEN jsonb_array_length(ee.participant_ids::jsonb) = 1 THEN 'Solo'
                  WHEN jsonb_array_length(ee.participant_ids::jsonb) = 2 THEN 'Duet'
                  WHEN jsonb_array_length(ee.participant_ids::jsonb) = 3 THEN 'Trio'
                  WHEN jsonb_array_length(ee.participant_ids::jsonb) >= 4 THEN 'Group'
                  ELSE e.performance_type
                END
              ) as performance_type,
              e.event_date,
              p.title,
              p.item_style,
              p.participant_names,
              c.name as contestant_name,
              c.type as contestant_type,
              c.studio_name,
              ee.participant_ids,
              ee.entry_type,
              SUM(s.technical_score + s.musical_score + s.performance_score + s.styling_score + s.overall_impression_score) as total_score,
              COUNT(DISTINCT jea.judge_id) as total_judges_assigned,
              COUNT(s.id) as judge_count
              FROM performances p
              JOIN events e ON p.event_id = e.id
              LEFT JOIN contestants c ON p.contestant_id = c.id
              LEFT JOIN event_entries ee ON ee.id = p.event_entry_id
              LEFT JOIN scores s ON p.id = s.performance_id
              LEFT JOIN judge_event_assignments jea ON jea.event_id = e.id
              WHERE p.scores_published = true
            GROUP BY p.id, p.item_number, p.mastery, p.event_entry_id, e.id, e.name, e.region, e.age_category, ee.performance_type, e.performance_type, e.event_date, p.title, p.item_style, p.participant_names, c.name, c.type, c.studio_name, ee.participant_ids, ee.entry_type
            HAVING COUNT(s.id) > 0
            ORDER BY e.region, e.age_category, performance_type, total_score DESC
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
        console.log('⚠️ No rankings found for the given criteria');
        console.log('⚠️ Query filters:', { region, ageCategory, performanceType, eventIds });
        console.log('⚠️ This means either:');
        console.log('   1. No performances have scores_published = true');
        console.log('   2. No performances have scores in the scores table');
        console.log('   3. No performances match the filter criteria');
        return [];
      }
      
      console.log('✅ Found', result.length, 'rankings');
    
      // Calculate age categories for all results first
      const { calculateAgeCategoryForEntry } = await import('./age-category-calculator');
      const resultsWithAgeCategories = await Promise.all(
        result.map(async (row: any) => {
          let calculatedAgeCategory = row.age_category;
          
          // Try to calculate age category from participant_ids if available
          if (row.participant_ids && row.event_date) {
            try {
              const participantIds = JSON.parse(row.participant_ids || '[]');
              if (participantIds.length > 0) {
                calculatedAgeCategory = await calculateAgeCategoryForEntry(
                  participantIds,
                  row.event_date,
                  sqlClient
                );
              }
            } catch (error) {
              console.warn('Error calculating age category for ranking:', error);
              // Fall back to event age category
            }
          }
          
          return {
            ...row,
            calculated_age_category: calculatedAgeCategory
          };
        })
      );
    
      // Build final result objects with participant names
      // Note: No deduplication here - the frontend handles deduplication when filters are applied
      const finalResults = await Promise.all(resultsWithAgeCategories.map(async (row: any) => {
        
        // Parse participant names from JSON
        let participantNames: string[] = [];
        try {
          // participant_names might be a JSON string or already parsed array
          if (typeof row.participant_names === 'string') {
            participantNames = JSON.parse(row.participant_names || '[]');
          } else if (Array.isArray(row.participant_names)) {
            participantNames = row.participant_names;
          }
          
          // Filter out null, undefined, and empty strings
          participantNames = participantNames.filter((name: any) => name && typeof name === 'string' && name.trim() !== '');
        } catch (error) {
          console.warn('Error parsing participant names:', error);
        }
        
        // If participant_names is empty but we have participant_ids, fetch names from dancers table
        if (participantNames.length === 0 && row.participant_ids) {
          try {
            const participantIds = typeof row.participant_ids === 'string' 
              ? JSON.parse(row.participant_ids) 
              : row.participant_ids;
            
            if (Array.isArray(participantIds) && participantIds.length > 0) {
              // Fetch dancer names from database using SQL directly
              // Try both by ID and by EODSA ID (participant_ids might contain either)
              const sqlClient = getSql();
              
              // First try by internal ID
              let dancerResults = await sqlClient`
                SELECT id, eodsa_id, name FROM dancers WHERE id = ANY(${participantIds})
              ` as any[];
              
              // If no results, try by EODSA ID
              if (dancerResults.length === 0) {
                dancerResults = await sqlClient`
                  SELECT id, eodsa_id, name FROM dancers WHERE eodsa_id = ANY(${participantIds})
                ` as any[];
              }
              
              // Add names in the order they appear in participant_ids
              for (const pid of participantIds) {
                const dancer = dancerResults.find((d: any) => d.id === pid || d.eodsa_id === pid);
                if (dancer?.name) {
                  participantNames.push(dancer.name);
                } else {
                  // Log missing dancer for debugging
                  console.warn(`⚠️ Dancer not found for participant ID: ${pid} in performance ${row.performance_id}`);
                  participantNames.push('Unknown Dancer');
                }
              }
            }
          } catch (error) {
            console.warn('Error fetching participant names from IDs:', error);
          }
        }
        
        // Create display name based on performance type and data available
        let displayName = '';
        let studioInfo = '';
        
        if (participantNames.length > 0) {
          // Use actual participant names (the dancers)
          displayName = participantNames.join(', ');
        } else {
          // Fallback: use contestant name or title
          if (row.contestant_name && row.contestant_name !== 'Unknown') {
            displayName = row.contestant_name;
          } else {
            displayName = row.title || 'Unknown Participants';
          }
        }
        
        // Get studio information - try multiple sources
        // First try from contestant (for group/studio entries)
        if (row.contestant_type === 'studio' && row.studio_name) {
          studioInfo = row.studio_name;
        } else if (row.studio_name) {
          // Sometimes studio_name might be set even if contestant_type is not 'studio'
          studioInfo = row.studio_name;
        } else {
          // For solo/individual performances, get studio from dancer's studio association
          // Check if we have participant_ids to look up dancer studio associations
          if (row.participant_ids) {
            try {
              const participantIds = typeof row.participant_ids === 'string' 
                ? JSON.parse(row.participant_ids) 
                : row.participant_ids;
              
              if (Array.isArray(participantIds) && participantIds.length > 0) {
                // Fetch studio name from dancer's studio applications
                // For solo performances, check the first (and only) participant's studio
                // For group performances, check the first participant's studio (all should be from same studio)
                const firstParticipantId = participantIds[0];
                
                try {
                  // First, find the dancer by EODSA ID or internal ID
                  // participant_ids might contain either EODSA IDs (like "E123456") or internal IDs
                  const dancerInfo = await sqlClient`
                    SELECT id, eodsa_id FROM dancers 
                    WHERE eodsa_id = ${firstParticipantId} OR id = ${firstParticipantId}
                    LIMIT 1
                  ` as any[];
                  
                  if (dancerInfo.length > 0) {
                    const dancerId = dancerInfo[0].id;
                    
                    // Now look up the studio association using the dancer's internal ID
                    const studioResult = await sqlClient`
                      SELECT s.name as studio_name
                      FROM studio_applications sa
                      JOIN studios s ON sa.studio_id = s.id
                      WHERE sa.dancer_id = ${dancerId} AND sa.status = 'accepted'
                      LIMIT 1
                    ` as any[];
                    
                    if (studioResult.length > 0) {
                      studioInfo = studioResult[0].studio_name;
                    }
                  }
                } catch (error) {
                  console.warn('Error fetching studio name from dancer associations:', error);
                }
              }
            } catch (error) {
              console.warn('Error parsing participant_ids for studio lookup:', error);
            }
          }
        }
        
        return {
          performanceId: row.performance_id,
          eventId: row.event_id,
          eventName: row.event_name,
          region: row.region,
          ageCategory: row.calculated_age_category, // Use calculated age category
          performanceType: row.performance_type,
          title: row.title,
          itemStyle: row.item_style,
          contestantName: displayName, // Now shows participant names instead of contestant name
          participantNames: participantNames, // Keep original participant names for reference
          studioName: studioInfo, // Studio information for display
          totalScore: parseFloat(row.total_score) || 0,
          // Calculate average using total judges assigned (not just scores submitted)
          totalJudgesAssigned: parseInt(row.total_judges_assigned) || parseInt(row.judge_count) || 1,
          averageScore: (() => {
            const totalScore = parseFloat(row.total_score) || 0;
            const totalJudges = parseInt(row.total_judges_assigned) || parseInt(row.judge_count) || 1;
            return totalJudges > 0 ? totalScore / totalJudges : 0;
          })(),
          rank: 0, // Rank is calculated on the frontend based on view mode
          judgeCount: parseInt(row.judge_count) || 0,
          itemNumber: row.item_number,
          mastery: row.mastery,
          entryType: row.entry_type || 'live' // Add entry type (live/virtual)
        };
      }));
      
      return finalResults;
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
        WHERE p.scores_published = true
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
      role: judge.role || 'judge', // Add the missing role field
      specialization: (() => {
        try {
          return judge.specialization ? JSON.parse(judge.specialization) : [];
        } catch (e) {
          console.warn(`Invalid JSON in specialization for judge ${judge.id}:`, judge.specialization);
          return [];
        }
      })(),
      createdAt: judge.created_at
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
      role: judge.role || 'judge', // Add the missing role field
      specialization: (() => {
        try {
          return judge.specialization ? JSON.parse(judge.specialization) : [];
        } catch (e) {
          console.warn(`Invalid JSON in specialization for judge ${judge.id}:`, judge.specialization);
          return [];
        }
      })(),
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
      specialization: (() => {
        try {
          return row.specialization ? JSON.parse(row.specialization) : [];
        } catch (e) {
          // Handle invalid JSON in specialization field
          console.warn(`Invalid JSON in specialization for judge ${row.id}:`, row.specialization);
          return [];
        }
      })(),
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

  // NEW: Update only the total score (admin simplified edit)
  async updateScoreTotalWithAudit(scoreId: string, performanceId: string, judgeId: string, newTotal: number, editedBy: string, editedByName?: string) {
    const sqlClient = getSql();

    // Validate total
    if (newTotal < 0 || newTotal > 100) {
      throw new Error('Total score must be between 0 and 100');
    }

    // Get old score values first
    const oldScoreResult = await sqlClient`
      SELECT s.*, j.name as judge_name
      FROM scores s
      JOIN judges j ON j.id = s.judge_id
      WHERE s.id = ${scoreId}
    ` as any[];

    if (oldScoreResult.length === 0) {
      throw new Error('Score not found');
    }

    const oldScore = oldScoreResult[0];
    const oldTotal = parseFloat(oldScore.technical_score) + parseFloat(oldScore.musical_score) +
                     parseFloat(oldScore.performance_score) + parseFloat(oldScore.styling_score) +
                     parseFloat(oldScore.overall_impression_score);

    // Calculate proportional distribution if total changed
    let technical = parseFloat(oldScore.technical_score);
    let musical = parseFloat(oldScore.musical_score);
    let performance = parseFloat(oldScore.performance_score);
    let styling = parseFloat(oldScore.styling_score);
    let overall = parseFloat(oldScore.overall_impression_score);

    if (oldTotal !== newTotal && oldTotal > 0) {
      // Distribute proportionally
      const ratio = newTotal / oldTotal;
      technical = Math.round(technical * ratio * 10) / 10;
      musical = Math.round(musical * ratio * 10) / 10;
      performance = Math.round(performance * ratio * 10) / 10;
      styling = Math.round(styling * ratio * 10) / 10;
      overall = Math.round(overall * ratio * 10) / 10;

      // Adjust for rounding errors
      const calculatedTotal = technical + musical + performance + styling + overall;
      const diff = newTotal - calculatedTotal;
      if (Math.abs(diff) > 0.01) {
        overall += diff;
        overall = Math.round(overall * 10) / 10;
      }
    }

    // Update the score
    await sqlClient`
      UPDATE scores
      SET technical_score = ${technical},
          musical_score = ${musical},
          performance_score = ${performance},
          styling_score = ${styling},
          overall_impression_score = ${overall}
      WHERE id = ${scoreId}
    `;

    // Create audit log
    const auditId = `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    const oldValues = {
      total: oldTotal
    };

    const newValues = {
      total: newTotal
    };

    await sqlClient`
      INSERT INTO score_edit_logs (id, score_id, performance_id, judge_id, judge_name, old_values, new_values, edited_by, edited_by_name, edited_at)
      VALUES (${auditId}, ${scoreId}, ${performanceId}, ${judgeId}, ${oldScore.judge_name}, ${JSON.stringify(oldValues)}, ${JSON.stringify(newValues)}, ${editedBy}, ${editedByName || 'Admin'}, ${timestamp})
    `;

    return { success: true };
  },

  async updateScoreWithAudit(scoreId: string, performanceId: string, judgeId: string, newScore: any, editedBy: string, editedByName?: string) {
    const sqlClient = getSql();

    // Get old score values first
    const oldScoreResult = await sqlClient`
      SELECT s.*, j.name as judge_name
      FROM scores s
      JOIN judges j ON j.id = s.judge_id
      WHERE s.id = ${scoreId}
    ` as any[];

    if (oldScoreResult.length === 0) {
      throw new Error('Score not found');
    }

    const oldScore = oldScoreResult[0];

    // Update the score
    await sqlClient`
      UPDATE scores
      SET technical_score = ${newScore.technicalScore},
          musical_score = ${newScore.musicalScore},
          performance_score = ${newScore.performanceScore},
          styling_score = ${newScore.stylingScore},
          overall_impression_score = ${newScore.overallImpressionScore},
          comments = ${newScore.comments || ''}
      WHERE id = ${scoreId}
    `;

    // Create audit log
    const auditId = `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    const oldValues = {
      technicalScore: parseFloat(oldScore.technical_score),
      musicalScore: parseFloat(oldScore.musical_score),
      performanceScore: parseFloat(oldScore.performance_score),
      stylingScore: parseFloat(oldScore.styling_score),
      overallImpressionScore: parseFloat(oldScore.overall_impression_score),
      comments: oldScore.comments,
      total: parseFloat(oldScore.technical_score) + parseFloat(oldScore.musical_score) +
             parseFloat(oldScore.performance_score) + parseFloat(oldScore.styling_score) +
             parseFloat(oldScore.overall_impression_score)
    };

    const newValues = {
      technicalScore: newScore.technicalScore,
      musicalScore: newScore.musicalScore,
      performanceScore: newScore.performanceScore,
      stylingScore: newScore.stylingScore,
      overallImpressionScore: newScore.overallImpressionScore,
      comments: newScore.comments || '',
      total: newScore.technicalScore + newScore.musicalScore + newScore.performanceScore +
             newScore.stylingScore + newScore.overallImpressionScore
    };

    await sqlClient`
      INSERT INTO score_edit_logs (id, score_id, performance_id, judge_id, judge_name, old_values, new_values, edited_by, edited_by_name, edited_at)
      VALUES (${auditId}, ${scoreId}, ${performanceId}, ${judgeId}, ${oldScore.judge_name}, ${JSON.stringify(oldValues)}, ${JSON.stringify(newValues)}, ${editedBy}, ${editedByName || 'Admin'}, ${timestamp})
    `;

    return { success: true };
  },

  async getScoreEditLogs(performanceId?: string) {
    const sqlClient = getSql();

    const query = performanceId
      ? sqlClient`
          SELECT sel.*, p.title as performance_title
          FROM score_edit_logs sel
          JOIN performances p ON p.id = sel.performance_id
          WHERE sel.performance_id = ${performanceId}
          ORDER BY sel.edited_at DESC
        `
      : sqlClient`
          SELECT sel.*, p.title as performance_title
          FROM score_edit_logs sel
          JOIN performances p ON p.id = sel.performance_id
          ORDER BY sel.edited_at DESC
        `;

    const logs = await query as any[];

    return logs.map((log: any) => ({
      id: log.id,
      scoreId: log.score_id,
      performanceId: log.performance_id,
      performanceTitle: log.performance_title,
      judgeId: log.judge_id,
      judgeName: log.judge_name,
      oldValues: typeof log.old_values === 'string' ? JSON.parse(log.old_values) : log.old_values,
      newValues: typeof log.new_values === 'string' ? JSON.parse(log.new_values) : log.new_values,
      editedBy: log.edited_by,
      editedByName: log.edited_by_name,
      editedAt: log.edited_at
    }));
  },

  async publishPerformanceScores(performanceId: string, publishedBy: string) {
    const sqlClient = getSql();
    const timestamp = new Date().toISOString();

    await sqlClient`
      UPDATE performances
      SET scores_published = true, scores_published_at = ${timestamp}, scores_published_by = ${publishedBy}
      WHERE id = ${performanceId}
    `;

    return { success: true };
  },

  async deleteScore(id: string) {
    const sqlClient = getSql();
    await sqlClient`
      DELETE FROM scores WHERE id = ${id}
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
    try {
      const result = await sqlClient`
        SELECT 
          s.id,
          s.judge_id,
          s.performance_id,
          s.technical_score,
          s.musical_score,
          s.performance_score,
          s.styling_score,
          s.overall_impression_score,
          s.comments,
          s.submitted_at,
          j.name as judge_name,
          j.email as judge_email
        FROM scores s
        INNER JOIN judges j ON s.judge_id = j.id
        WHERE s.performance_id = ${performanceId}
        ORDER BY s.submitted_at
      ` as any[];

      return result.map((row: any) => ({
        id: row.id,
        judgeId: row.judge_id,
        performanceId: row.performance_id,
        technicalScore: parseFloat(row.technical_score || 0),
        musicalScore: parseFloat(row.musical_score || 0),
        performanceScore: parseFloat(row.performance_score || 0),
        stylingScore: parseFloat(row.styling_score || 0),
        overallImpressionScore: parseFloat(row.overall_impression_score || 0),
        comments: row.comments || '',
        submittedAt: row.submitted_at,
        judgeName: row.judge_name || 'Unknown Judge',
        judgeEmail: row.judge_email || ''
      })) as (Score & { judgeName: string; judgeEmail: string })[];
    } catch (error) {
      console.error('Error in getScoresByPerformance:', error);
      throw new Error(`Database query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  // Get published scores for a dancer by their EODSA ID
  async getDancerScores(eodsaId: string) {
    const sqlClient = getSql();

    // First, get the dancer's ID from their EODSA ID
    // This is needed because participant_ids may contain dancer IDs instead of EODSA IDs
    const dancerResult = await sqlClient`
      SELECT id FROM dancers WHERE eodsa_id = ${eodsaId}
    ` as any[];
    
    const dancerId = dancerResult.length > 0 ? dancerResult[0].id : null;

    // Get all published scores for performances where this dancer participated
    // Check both EODSA ID and dancer ID in participant_ids for consistency
    const result = await sqlClient`
      SELECT
        s.*,
        j.name as judge_name,
        p.id as performance_id,
        p.title as performance_title,
        p.scores_published,
        p.scores_published_at,
        ee.item_name as entry_title
      FROM event_entries ee
      JOIN performances p ON p.event_entry_id = ee.id
      JOIN scores s ON s.performance_id = p.id
      JOIN judges j ON j.id = s.judge_id
      WHERE (
        ee.eodsa_id = ${eodsaId}
        OR ee.participant_ids::text LIKE ${`%${eodsaId}%`}
        ${dancerId ? sqlClient`OR ee.participant_ids::text LIKE ${`%${dancerId}%`}` : sqlClient``}
      )
      AND p.scores_published = true
      ORDER BY s.submitted_at DESC
    ` as any[];

    return result.map((row: any) => ({
      id: row.id,
      judgeId: row.judge_id,
      judgeName: row.judge_name,
      performanceId: row.performance_id,
      performanceTitle: row.performance_title || row.entry_title,
      technicalScore: parseFloat(row.technical_score),
      musicalScore: parseFloat(row.musical_score || 0),
      performanceScore: parseFloat(row.performance_score || 0),
      stylingScore: parseFloat(row.styling_score || 0),
      overallImpressionScore: parseFloat(row.overall_impression_score || 0),
      comments: row.comments,
      submittedAt: row.submitted_at,
      scoredAt: row.submitted_at
    }));
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
      INSERT INTO events (
        id, name, description, region, age_category, performance_type, event_date, event_end_date, 
        registration_deadline, venue, status, max_participants, entry_fee, created_by, created_at,
        registration_fee_per_dancer, solo_1_fee, solo_2_fee, solo_3_fee, solo_additional_fee,
        duo_trio_fee_per_dancer, group_fee_per_dancer, large_group_fee_per_dancer, currency
      )
      VALUES (
        ${id}, ${event.name}, ${event.description}, ${event.region}, ${event.ageCategory}, 
        ${event.performanceType}, ${event.eventDate}, ${event.eventEndDate || null}, 
        ${event.registrationDeadline}, ${event.venue}, ${event.status}, ${event.maxParticipants || null}, 
        ${event.entryFee}, ${event.createdBy}, ${createdAt},
        ${event.registrationFeePerDancer ?? 300}, ${event.solo1Fee ?? 400}, ${event.solo2Fee ?? 750}, 
        ${event.solo3Fee ?? 1050}, ${event.soloAdditionalFee ?? 100}, ${event.duoTrioFeePerDancer ?? 280},
        ${event.groupFeePerDancer ?? 220}, ${event.largeGroupFeePerDancer ?? 190}, ${event.currency || 'ZAR'}
      )
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
      createdAt: row.created_at,
      registrationFeePerDancer: row.registration_fee_per_dancer != null ? parseFloat(row.registration_fee_per_dancer) : 300,
      solo1Fee: row.solo_1_fee != null ? parseFloat(row.solo_1_fee) : 400,
      solo2Fee: row.solo_2_fee != null ? parseFloat(row.solo_2_fee) : 750,
      solo3Fee: row.solo_3_fee != null ? parseFloat(row.solo_3_fee) : 1050,
      soloAdditionalFee: row.solo_additional_fee != null ? parseFloat(row.solo_additional_fee) : 100,
      duoTrioFeePerDancer: row.duo_trio_fee_per_dancer != null ? parseFloat(row.duo_trio_fee_per_dancer) : 280,
      groupFeePerDancer: row.group_fee_per_dancer != null ? parseFloat(row.group_fee_per_dancer) : 220,
      largeGroupFeePerDancer: row.large_group_fee_per_dancer != null ? parseFloat(row.large_group_fee_per_dancer) : 190,
      currency: row.currency || 'ZAR'
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
      createdAt: row.created_at,
      registrationFeePerDancer: row.registration_fee_per_dancer != null ? parseFloat(row.registration_fee_per_dancer) : 300,
      solo1Fee: row.solo_1_fee != null ? parseFloat(row.solo_1_fee) : 400,
      solo2Fee: row.solo_2_fee != null ? parseFloat(row.solo_2_fee) : 750,
      solo3Fee: row.solo_3_fee != null ? parseFloat(row.solo_3_fee) : 1050,
      soloAdditionalFee: row.solo_additional_fee != null ? parseFloat(row.solo_additional_fee) : 100,
      duoTrioFeePerDancer: row.duo_trio_fee_per_dancer != null ? parseFloat(row.duo_trio_fee_per_dancer) : 280,
      groupFeePerDancer: row.group_fee_per_dancer != null ? parseFloat(row.group_fee_per_dancer) : 220,
      largeGroupFeePerDancer: row.large_group_fee_per_dancer != null ? parseFloat(row.large_group_fee_per_dancer) : 190,
      currency: row.currency || 'ZAR',
      participationMode: row.participation_mode || 'hybrid'
    } as Event;
  },

  // NEW: Judge Event Assignment methods
  async createJudgeEventAssignment(assignment: {
    judgeId: string;
    eventId: string;
    assignedBy: string;
  }) {
    const sqlClient = getSql();
    
    // Check if this judge is already assigned to this event
    const existingAssignment = await sqlClient`
      SELECT id FROM judge_event_assignments 
      WHERE judge_id = ${assignment.judgeId} 
      AND event_id = ${assignment.eventId}
      AND status = 'active'
    ` as any[];
    
    if (existingAssignment.length > 0) {
      throw new Error('This judge is already assigned to this event');
    }
    
    // Check how many judges are already assigned to this event
    const judgeCount = await sqlClient`
      SELECT COUNT(*) as count FROM judge_event_assignments 
      WHERE event_id = ${assignment.eventId}
      AND status = 'active'
    ` as any[];
    
    const currentJudgeCount = parseInt(judgeCount[0].count);
    if (currentJudgeCount >= 4) {
      throw new Error('This event already has the maximum of 4 judges assigned');
    }
    
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
      SELECT jea.*, j.name as judge_name, j.email as judge_email, e.name as event_name, e.region
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
      eventName: row.event_name,
      region: row.region
    }));
  },

  async removeJudgeEventAssignment(assignmentId: string) {
    const sqlClient = getSql();
    
    await sqlClient`
      DELETE FROM judge_event_assignments 
      WHERE id = ${assignmentId}
    `;
    
    return { success: true };
  },

  // NEW: Get judge assignments grouped by region
  async getJudgeAssignmentsByRegion() {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT 
        j.id as judge_id,
        j.name as judge_name, 
        j.email as judge_email,
        e.region,
        COUNT(jea.id) as event_count
      FROM judge_event_assignments jea
      JOIN judges j ON jea.judge_id = j.id
      JOIN events e ON jea.event_id = e.id
      WHERE jea.status = 'active'
      GROUP BY j.id, j.name, j.email, e.region
      ORDER BY e.region, j.name
    ` as any[];
    
    return result.map((row: any) => ({
      id: `${row.judge_id}-${row.region}`,
      judgeId: row.judge_id,
      region: row.region,
      judgeName: row.judge_name,
      judgeEmail: row.judge_email,
      regionName: row.region,
      eventCount: parseInt(row.event_count)
    }));
  },

  // NEW: Get performances by event ID
  async getPerformancesByEvent(eventId: string) {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT 
        p.*, 
        c.name as contestant_name,
        ee.entry_type,
        ee.music_file_url,
        ee.music_file_name,
        ee.video_external_url,
        ee.video_external_type,
        ee.participant_ids,
        e.age_category
      FROM performances p 
      LEFT JOIN contestants c ON p.contestant_id = c.id 
      LEFT JOIN event_entries ee ON p.event_entry_id = ee.id
      LEFT JOIN events e ON p.event_id = e.id
      WHERE p.event_id = ${eventId}
      ORDER BY COALESCE(p.performance_order, p.item_number, 999) ASC
    ` as any[];

    // Resolve participant names if stored values are missing/unknown
    const sqlClientInner = sqlClient; // reuse client inside map
    const performances = await Promise.all(result.map(async (row: any) => {
      let participantNames: string[] = [];
      try {
        participantNames = JSON.parse(row.participant_names || '[]');
      } catch {
        participantNames = [];
      }

      const needsResolve = !participantNames || participantNames.length === 0 || participantNames.some((n: string) => n === 'Unknown Dancer');

      if (needsResolve) {
        try {
          const ids: string[] = JSON.parse(row.participant_ids || '[]');
          if (Array.isArray(ids) && ids.length > 0) {
            const resolved: string[] = [];
            for (let i = 0; i < ids.length; i++) {
              try {
                const dancerRows = await sqlClientInner`
                  SELECT name FROM dancers WHERE id = ${ids[i]} LIMIT 1
                ` as any[];
                resolved.push(dancerRows.length > 0 ? dancerRows[0].name : `Participant ${i + 1}`);
              } catch {
                resolved.push(`Participant ${i + 1}`);
              }
            }
            participantNames = resolved;
          }
        } catch {}
      }

      return {
        id: row.id,
        eventId: row.event_id,
        eventEntryId: row.event_entry_id,
        contestantId: row.contestant_id,
        title: row.title,
        participantNames,
        duration: row.duration,
        itemNumber: row.item_number,
        performanceOrder: row.performance_order,
        withdrawnFromJudging: row.withdrawn_from_judging || false,
        choreographer: row.choreographer,
        mastery: row.mastery,
        itemStyle: row.item_style,
        scheduledTime: row.scheduled_time,
        status: row.status,
        contestantName: row.contestant_name,
        // PHASE 2: Live vs Virtual Entry Support
        entryType: row.entry_type || 'live',
        musicFileUrl: row.music_file_url,
        musicFileName: row.music_file_name,
        videoExternalUrl: row.video_external_url,
        videoExternalType: row.video_external_type,
        announcerNotes: row.announcer_notes || null,
        musicCue: row.music_cue || null,
        ageCategory: row.age_category || null
      } as Performance & { contestantName: string };
    }));

    return performances;
  },

  // Database cleaning - reset all data and create only main admin
  async cleanDatabase() {
    const sqlClient = getSql();
    const bcrypt = await import('bcryptjs');
    
    console.log('🧹 Cleaning database completely...');
    
    // Delete all data in dependency order (most dependent first)
    await sqlClient`DELETE FROM scores`;
    await sqlClient`DELETE FROM rankings`;
    await sqlClient`DELETE FROM performances`;
    await sqlClient`DELETE FROM event_entries`;
    await sqlClient`DELETE FROM nationals_event_entries`;
    await sqlClient`DELETE FROM judge_event_assignments`;
    await sqlClient`DELETE FROM events`;
    await sqlClient`DELETE FROM studio_applications`;
    await sqlClient`DELETE FROM dancers`;
    await sqlClient`DELETE FROM contestants`;
    await sqlClient`DELETE FROM studios`;
    
    // Remove ALL judges (including admins)
    await sqlClient`DELETE FROM judges`;
    
    // Create the main admin account
    console.log('👑 Creating main admin account...');
    const hashedPassword = await bcrypt.hash('624355Mage55!', 10);
    const newAdminId = `judge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await sqlClient`
      INSERT INTO judges (id, name, email, password, is_admin, specialization) 
      VALUES (${newAdminId}, 'Main Admin', 'mains@elementscentral.com', ${hashedPassword}, true, '[]')
    `;
    
    console.log('✅ Database cleaned successfully - Only main admin account remains');
    console.log('📝 Admin login: mains@elementscentral.com / 624355Mage55!');
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

  async updateEventPerformanceType(eventId: string, performanceType: string) {
    const sqlClient = getSql();
    
    await sqlClient`
      UPDATE events 
      SET performance_type = ${performanceType}
      WHERE id = ${eventId}
    `;
    
    console.log(`✅ Event ${eventId} updated to ${performanceType} performance type`);
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
  },

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

  // Registration fee tracking functions
  async markRegistrationFeePaid(dancerId: string, masteryLevel: string) {
    const sqlClient = getSql();
    const paidAt = new Date().toISOString();
    
    await sqlClient`
      UPDATE dancers 
      SET registration_fee_paid = TRUE, 
          registration_fee_paid_at = ${paidAt}, 
          registration_fee_mastery_level = ${masteryLevel}
      WHERE id = ${dancerId}
    `;
    
    return { success: true };
  },

  async getDancerRegistrationStatus(dancerId: string) {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT registration_fee_paid, registration_fee_paid_at, registration_fee_mastery_level
      FROM dancers 
      WHERE id = ${dancerId}
    ` as any[];
    
    if (result.length === 0) {
      throw new Error('Dancer not found');
    }
    
    return {
      registrationFeePaid: result[0].registration_fee_paid || false,
      registrationFeePaidAt: result[0].registration_fee_paid_at,
      registrationFeeMasteryLevel: result[0].registration_fee_mastery_level
    };
  },

  async getDancersWithRegistrationStatus(dancerIds: string[]) {
    const sqlClient = getSql();
    // Enhanced query to check both registration_fee_paid column AND existing paid entries
    const result = await sqlClient`
      SELECT d.id, d.name, d.age, d.date_of_birth, d.national_id, d.eodsa_id,
             d.registration_fee_paid, d.registration_fee_paid_at, d.registration_fee_mastery_level,
             CASE 
               WHEN d.registration_fee_paid = TRUE THEN TRUE
               WHEN EXISTS (
                 SELECT 1 FROM event_entries ee 
                 WHERE ee.eodsa_id = d.eodsa_id 
                 AND ee.payment_status = 'paid'
               ) THEN TRUE
               ELSE FALSE
             END as effective_registration_paid
      FROM dancers d
      WHERE d.id = ANY(${dancerIds})
    ` as any[];
    
    return result.map((row: any) => ({
      id: row.id,
      name: row.name,
      age: row.age,
      dateOfBirth: row.date_of_birth,
      nationalId: row.national_id,
      eodsaId: row.eodsa_id,
      registrationFeePaid: row.effective_registration_paid || false,
      registrationFeePaidAt: row.registration_fee_paid_at,
      registrationFeeMasteryLevel: row.registration_fee_mastery_level,
      style: '', // For compatibility
      approved: true // For compatibility
    }));
  },

  // Database migration to add registration fee tracking columns
  async addRegistrationFeeColumns() {
    const sqlClient = getSql();
    
    try {
      // Add registration fee tracking columns if they don't exist
      await sqlClient`ALTER TABLE dancers ADD COLUMN IF NOT EXISTS registration_fee_paid BOOLEAN DEFAULT FALSE`;
      await sqlClient`ALTER TABLE dancers ADD COLUMN IF NOT EXISTS registration_fee_paid_at TEXT`;
      await sqlClient`ALTER TABLE dancers ADD COLUMN IF NOT EXISTS registration_fee_mastery_level TEXT`;
      
      // Add solo count column to nationals entries table
      await sqlClient`ALTER TABLE nationals_event_entries ADD COLUMN IF NOT EXISTS solo_count INTEGER DEFAULT 0`;
      
      console.log('✅ Added registration fee tracking columns to dancers table');
      console.log('✅ Added solo_count column to nationals_event_entries table');
    } catch (error) {
      console.log('Registration fee columns may already exist:', error);
    }
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

    // Use separate queries for each field to avoid unsafe parameter usage
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
    
    return { success: true, message: 'Entry updated successfully' };
  },

  // Admin-only entry deletion
  async deleteEntryAsAdmin(adminId: string, entryId: string) {
    const sqlClient = getSql();
    
    // Verify admin exists and has admin privileges
    const admin = await sqlClient`
      SELECT id, is_admin FROM judges WHERE id = ${adminId} AND is_admin = true
    ` as any[];
    
    if (admin.length === 0) {
      throw new Error('Admin privileges required to delete entries');
    }
    
    // Check if entry exists
    const entry = await sqlClient`
      SELECT id FROM event_entries WHERE id = ${entryId}
    ` as any[];
    
    if (entry.length === 0) {
      throw new Error('Entry not found');
    }
    
    // Delete the entry and any associated performances/scores
    await sqlClient`DELETE FROM scores WHERE performance_id IN (
      SELECT id FROM performances WHERE event_entry_id = ${entryId}
    )`;
    
    await sqlClient`DELETE FROM performances WHERE event_entry_id = ${entryId}`;
    
    await sqlClient`DELETE FROM event_entries WHERE id = ${entryId}`;
    
    return { success: true, message: 'Entry deleted successfully by admin' };
  },

  // 🏆 NATIONALS DATABASE OPERATIONS
  
  // Create nationals event
  async createNationalsEvent(event: {
    name: string;
    description?: string;
    eventDate: string;
    eventEndDate?: string;
    registrationDeadline: string;
    venue: string;
    maxParticipants?: number;
    createdBy: string;
  }) {
    const sqlClient = getSql();
    const id = `nationals-${Date.now()}`;
    const createdAt = new Date().toISOString();
    
    // Automatically set the correct initial status based on dates
    const now = new Date();
    const eventDate = new Date(event.eventDate);
    const registrationDeadline = new Date(event.registrationDeadline);
    
    let initialStatus: 'upcoming' | 'registration_open' | 'registration_closed' | 'in_progress' | 'completed' = 'upcoming';
    if (now < registrationDeadline) {
      initialStatus = 'registration_open';
    } else if (now >= registrationDeadline && now < eventDate) {
      initialStatus = 'registration_closed';
    } else if (now >= eventDate) {
      initialStatus = 'completed';
    }
    
    await sqlClient`
      INSERT INTO nationals_events (
        id, name, description, event_date, event_end_date, registration_deadline, 
        venue, status, max_participants, created_by, created_at
      ) VALUES (
        ${id}, ${event.name}, ${event.description || null}, ${event.eventDate}, 
        ${event.eventEndDate || null}, ${event.registrationDeadline}, ${event.venue}, 
        ${initialStatus}, ${event.maxParticipants || null}, ${event.createdBy}, ${createdAt}
      )
    `;
    
    return {
      id,
      ...event,
      status: initialStatus,
      createdAt
    };
  },

  // Get all nationals events
  async getAllNationalsEvents() {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT * FROM nationals_events 
      ORDER BY event_date DESC
    ` as any[];
    
    return result.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      eventDate: row.event_date,
      eventEndDate: row.event_end_date,
      registrationDeadline: row.registration_deadline,
      venue: row.venue,
      status: row.status,
      maxParticipants: row.max_participants,
      createdBy: row.created_by,
      createdAt: row.created_at
    }));
  },

  // Get nationals event by ID
  async getNationalsEventById(eventId: string) {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT * FROM nationals_events WHERE id = ${eventId}
    ` as any[];
    
    if (result.length === 0) return null;
    
    const row = result[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      eventDate: row.event_date,
      eventEndDate: row.event_end_date,
      registrationDeadline: row.registration_deadline,
      venue: row.venue,
      status: row.status,
      maxParticipants: row.max_participants,
      createdBy: row.created_by,
      createdAt: row.created_at
    };
  },

  // Create nationals judge assignment
  async createNationalsJudgeAssignment(assignment: {
    judgeId: string;
    nationalsEventId: string;
    assignedBy: string;
  }) {
    const sqlClient = getSql();
    
    // Check if this judge is already assigned to this nationals event
    const existingAssignment = await sqlClient`
      SELECT id FROM nationals_judge_assignments 
      WHERE judge_id = ${assignment.judgeId} 
      AND nationals_event_id = ${assignment.nationalsEventId}
    ` as any[];
    
    if (existingAssignment.length > 0) {
      throw new Error('This judge is already assigned to this nationals event');
    }
    
    // Check how many judges are already assigned to this nationals event
    const judgeCount = await sqlClient`
      SELECT COUNT(*) as count FROM nationals_judge_assignments 
      WHERE nationals_event_id = ${assignment.nationalsEventId}
    ` as any[];
    
    const currentJudgeCount = parseInt(judgeCount[0].count);
    
    if (currentJudgeCount >= 4) {
      throw new Error('This nationals event already has the maximum of 4 judges assigned');
    }
    
    const id = `nationals-judge-${Date.now()}`;
    const assignedAt = new Date().toISOString();
    
    await sqlClient`
      INSERT INTO nationals_judge_assignments (
        id, judge_id, nationals_event_id, assigned_by, assigned_at
      ) VALUES (
        ${id}, ${assignment.judgeId}, ${assignment.nationalsEventId}, 
        ${assignment.assignedBy}, ${assignedAt}
      )
    `;
    
    return {
      id,
      ...assignment,
      assignedAt
    };
  },

  // Get nationals judge assignments
  async getNationalsJudgeAssignments(judgeId: string) {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT nja.*, ne.name as event_name, ne.event_date, ne.venue
      FROM nationals_judge_assignments nja
      JOIN nationals_events ne ON nja.nationals_event_id = ne.id
      WHERE nja.judge_id = ${judgeId}
      ORDER BY ne.event_date ASC
    ` as any[];
    
    return result.map((row: any) => ({
      id: row.id,
      judgeId: row.judge_id,
      nationalsEventId: row.nationals_event_id,
      assignedBy: row.assigned_by,
      assignedAt: row.assigned_at,
      event: {
        id: row.nationals_event_id,
        name: row.event_name,
        eventDate: row.event_date,
        venue: row.venue
      }
    }));
  },

  // Get all nationals judge assignments for an event
  async getNationalsJudgeAssignmentsByEvent(eventId: string) {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT nja.*, j.name as judge_name, j.email as judge_email
      FROM nationals_judge_assignments nja
      JOIN judges j ON nja.judge_id = j.id
      WHERE nja.nationals_event_id = ${eventId}
      ORDER BY nja.assigned_at ASC
    ` as any[];
    
    return result.map((row: any) => ({
      id: row.id,
      judgeId: row.judge_id,
      nationalsEventId: row.nationals_event_id,
      assignedBy: row.assigned_by,
      assignedAt: row.assigned_at,
      judgeName: row.judge_name,
      judgeEmail: row.judge_email
    }));
  },

  // Get judge count for a nationals event
  async getNationalsEventJudgeCount(eventId: string) {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT COUNT(*) as count FROM nationals_judge_assignments 
      WHERE nationals_event_id = ${eventId}
    ` as any[];
    
    return parseInt(result[0].count);
  },

  // Remove a judge from a nationals event
  async removeNationalsJudgeAssignment(assignmentId: string) {
    const sqlClient = getSql();
    
    await sqlClient`
      DELETE FROM nationals_judge_assignments 
      WHERE id = ${assignmentId}
    `;
    
    return { success: true };
  },

  // Calculate nationals fee based on performance type and number of solos
  async calculateNationalsFee(performanceType: string, soloCount: number = 1, participantCount: number = 1, participantIds: string[] = [], eventId?: string) {
    const sqlClient = getSql();
    let registrationFee = 0;
    let performanceFee = 0;
    
    // Get event-specific fee configuration if eventId is provided
    let event: Event | null = null;
    if (eventId) {
      event = await this.getEventById(eventId);
    }
    
    // Default fees (can be overridden by event config)
    const regFeePerDancer = event?.registrationFeePerDancer || 300;
    const solo1Fee = event?.solo1Fee || 400;
    const solo2Fee = event?.solo2Fee || 750;
    const solo3Fee = event?.solo3Fee || 1050;
    const soloAdditionalFee = event?.soloAdditionalFee || 100;
    const duoTrioFee = event?.duoTrioFeePerDancer || 280;
    const groupFee = event?.groupFeePerDancer || 220;
    const largeGroupFee = event?.largeGroupFeePerDancer || 190;
    
    // Check registration fee status for participants
    // IMPORTANT: Check per EVENT, not globally
    if (participantIds.length > 0) {
      // For groups, check each participant's registration status FOR THIS EVENT
      for (const participantId of participantIds) {
        try {
          let needsRegistration = false;

          if (eventId) {
            // Check if this dancer has already paid for THIS specific event
            const paidEntries = await sqlClient`
              SELECT COUNT(*) as count FROM event_entries
              WHERE contestant_id = ${participantId}
              AND event_id = ${eventId}
              AND payment_status = 'paid'
              LIMIT 1
            ` as any[];

            needsRegistration = !paidEntries || paidEntries[0].count === 0;
          } else {
            // Fallback to global registration status if no eventId
            const registrationStatus = await this.getDancerRegistrationStatus(participantId);
            needsRegistration = !registrationStatus.registrationFeePaid;
          }

          if (needsRegistration) {
            registrationFee += regFeePerDancer; // Per dancer who hasn't paid for this event
          }
        } catch (error) {
          // If error, assume they need to pay registration
          console.warn(`Could not check registration for participant ${participantId}:`, error);
          registrationFee += regFeePerDancer;
        }
      }
    } else {
      // For single participant (solo), check if they need registration for this event
      if (eventId) {
        // Without participant IDs, we can't check, so assume they need to pay
        registrationFee = regFeePerDancer;
      } else {
        registrationFee = regFeePerDancer;
      }
    }
    
    // Calculate performance fees based on type
    if (performanceType === 'Solo') {
      // Solo fee structure - using event-specific fees
      if (soloCount === 1) {
        performanceFee = solo1Fee;
      } else if (soloCount === 2) {
        performanceFee = solo2Fee;
      } else if (soloCount === 3) {
        performanceFee = solo3Fee;
      } else {
        // More than 3 solos: 3-solo package + additional solos
        performanceFee = solo3Fee + ((soloCount - 3) * soloAdditionalFee);
      }
    } else if (performanceType === 'Duet' || performanceType === 'Trio') {
      // Duos/trios - per person
      performanceFee = duoTrioFee * participantCount;
    } else if (performanceType === 'Group') {
      // Group pricing - determine pricing based on participant count
      if (participantCount >= 10) {
        performanceFee = largeGroupFee * participantCount; // Large group pricing (10+)
      } else {
        performanceFee = groupFee * participantCount; // Small group pricing (4-9)
      }
    }
    
    return {
      registrationFee,
      performanceFee,
      totalFee: registrationFee + performanceFee,
      participantsNeedingRegistration: registrationFee / 300 // Number of participants who need to pay registration
    };
  },

  // Create nationals event entry
  async createNationalsEventEntry(entry: {
    nationalsEventId: string;
    contestantId: string;
    eodsaId: string;
    participantIds: string[];
    calculatedFee: number;
    paymentStatus: string;
    paymentMethod?: string;
    approved: boolean;
    qualifiedForNationals: boolean;
    itemNumber?: number;
    itemName: string;
    choreographer: string;
    mastery: string;
    itemStyle: string;
    estimatedDuration: number;
    performanceType: string;
    ageCategory: string;
    soloCount?: number;
    soloDetails?: any;
    additionalNotes?: string;
  }) {
    const sqlClient = getSql();
    const id = `nationals-entry-${Date.now()}`;
    const submittedAt = new Date().toISOString();
    const createdAt = new Date().toISOString();
    
    // Create solo_details and additional_notes columns if they don't exist
    try {
      await sqlClient`ALTER TABLE nationals_event_entries ADD COLUMN IF NOT EXISTS solo_details TEXT`;
      await sqlClient`ALTER TABLE nationals_event_entries ADD COLUMN IF NOT EXISTS additional_notes TEXT`;
    } catch (error) {
      // Columns may already exist
    }
    
    await sqlClient`
      INSERT INTO nationals_event_entries (
        id, nationals_event_id, contestant_id, eodsa_id, participant_ids, 
        calculated_fee, payment_status, payment_method, submitted_at, approved, 
        qualified_for_nationals, item_number, item_name, choreographer, mastery, 
        item_style, estimated_duration, created_at, performance_type, age_category, 
        solo_count, solo_details, additional_notes
      ) VALUES (
        ${id}, ${entry.nationalsEventId}, ${entry.contestantId}, ${entry.eodsaId}, 
        ${JSON.stringify(entry.participantIds)}, ${entry.calculatedFee}, 
        ${entry.paymentStatus}, ${entry.paymentMethod || null}, ${submittedAt}, 
        ${entry.approved}, ${entry.qualifiedForNationals}, ${entry.itemNumber || null}, 
        ${entry.itemName}, ${entry.choreographer}, ${entry.mastery}, ${entry.itemStyle}, 
        ${entry.estimatedDuration}, ${createdAt}, ${entry.performanceType}, ${entry.ageCategory}, 
        ${entry.soloCount || 0}, ${entry.soloDetails ? JSON.stringify(entry.soloDetails) : null}, 
        ${entry.additionalNotes || null}
      )
    `;
    
    return {
      id,
      ...entry,
      submittedAt,
      createdAt
    };
  },

  // Get nationals event entries
  async getAllNationalsEventEntries() {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT nee.*, ne.name as event_name, ne.event_date, ne.venue, c.name as contestant_name
      FROM nationals_event_entries nee
      JOIN nationals_events ne ON nee.nationals_event_id = ne.id
      JOIN contestants c ON nee.contestant_id = c.id
      ORDER BY nee.submitted_at DESC
    ` as any[];
    
    return result.map((row: any) => ({
      id: row.id,
      nationalsEventId: row.nationals_event_id,
      contestantId: row.contestant_id,
      eodsaId: row.eodsa_id,
      participantIds: JSON.parse(row.participant_ids),
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
      performanceType: row.performance_type,
      ageCategory: row.age_category,
      soloCount: row.solo_count || 0,
      soloDetails: row.solo_details ? JSON.parse(row.solo_details) : null,
      additionalNotes: row.additional_notes,
      createdAt: row.created_at,
      event: {
        name: row.event_name,
        eventDate: row.event_date,
        venue: row.venue
      },
      contestantName: row.contestant_name
    }));
  },

  // Update nationals event entry
  async updateNationalsEventEntry(entryId: string, updates: { approved?: boolean; itemNumber?: number }) {
    const sqlClient = getSql();
    
    // First verify the entry exists
    const existingEntry = await sqlClient`
      SELECT id FROM nationals_event_entries WHERE id = ${entryId}
    ` as any[];
    
    if (existingEntry.length === 0) {
      console.log(`⚠️  Nationals event entry ${entryId} not found`);
      return null;
    }

    // Update the entry
    if (updates.approved !== undefined) {
      await sqlClient`
        UPDATE nationals_event_entries 
        SET approved = ${updates.approved}
        WHERE id = ${entryId}
      `;
    }
    
    if (updates.itemNumber !== undefined) {
      await sqlClient`
        UPDATE nationals_event_entries 
        SET item_number = ${updates.itemNumber}
        WHERE id = ${entryId}
      `;
    }

    // Get the updated entry
    const updatedEntry = await sqlClient`
      SELECT * FROM nationals_event_entries WHERE id = ${entryId}
    ` as any[];
    
    if (updatedEntry.length === 0) {
      console.log(`⚠️  Failed to retrieve updated nationals event entry ${entryId}`);
      return null;
    }
    
    const entry = updatedEntry[0];
    console.log(`✅ Nationals event entry ${entryId} updated successfully`);
    
    return {
      id: entry.id,
      nationalsEventId: entry.nationals_event_id,
      contestantId: entry.contestant_id,
      eodsaId: entry.eodsa_id,
      approved: entry.approved,
      itemNumber: entry.item_number,
      calculatedFee: parseFloat(entry.calculated_fee),
      paymentStatus: entry.payment_status,
      submittedAt: entry.submitted_at
    };
  },

  async updateNationalsEventPayment(entryId: string, paymentStatus: string) {
    const sqlClient = getSql();
    
    // First verify the entry exists
    const existingEntry = await sqlClient`
      SELECT id FROM nationals_event_entries WHERE id = ${entryId}
    ` as any[];
    
    if (existingEntry.length === 0) {
      console.log(`⚠️  Nationals event entry ${entryId} not found`);
      return null;
    }

    // Update the payment status
    await sqlClient`
      UPDATE nationals_event_entries 
      SET payment_status = ${paymentStatus}
      WHERE id = ${entryId}
    `;

    // Get the updated entry
    const updatedEntry = await sqlClient`
      SELECT * FROM nationals_event_entries WHERE id = ${entryId}
    ` as any[];

    if (updatedEntry.length === 0) {
      console.log(`⚠️  Failed to retrieve updated nationals event entry ${entryId}`);
      return null;
    }

    const entry = updatedEntry[0];
    console.log(`✅ Payment status for nationals event entry ${entryId} updated to ${paymentStatus}`);
    
    return {
      id: entry.id,
      nationalsEventId: entry.nationals_event_id,
      contestantId: entry.contestant_id,
      eodsaId: entry.eodsa_id,
      approved: entry.approved,
      calculatedFee: parseFloat(entry.calculated_fee),
      paymentStatus: entry.payment_status,
      submittedAt: entry.submitted_at
    };
  },

  async updateNationalsEventStatuses() {
    const sqlClient = getSql();
    const now = new Date();
    
    await sqlClient`
      UPDATE nationals_events 
      SET status = 'registration_closed' 
      WHERE status = 'registration_open' 
      AND registration_deadline <= ${now.toISOString()}
    `;
    
    await sqlClient`
      UPDATE nationals_events 
      SET status = 'in_progress' 
      WHERE status = 'registration_closed' 
      AND event_date <= ${now.toISOString()}
    `;
  },

  // Nationals scoring methods
  async createNationalsScore(score: {
    entryId: string;
    judgeId: string;
    technicalScore: number;
    musicalScore: number;
    performanceScore: number;
    stylingScore: number;
    overallImpressionScore: number;
    comments?: string;
  }) {
    const sqlClient = getSql();
    const id = generateEODSAId();
    
    await sqlClient`
      INSERT INTO nationals_scores (
        id, performance_id, judge_id, 
        technical_score, musical_score, performance_score, 
        styling_score, overall_impression_score, comments, 
        submitted_at
      ) VALUES (
        ${id}, ${score.entryId}, ${score.judgeId},
        ${score.technicalScore}, ${score.musicalScore}, ${score.performanceScore},
        ${score.stylingScore}, ${score.overallImpressionScore}, ${score.comments || ''},
        ${new Date().toISOString()}
      )
    `;
    
    console.log(`✅ Nationals score created for entry ${score.entryId} by judge ${score.judgeId}`);
    return { id };
  },

  async getNationalsScoreByJudgeAndPerformance(judgeId: string, entryId: string) {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT * FROM nationals_scores 
      WHERE judge_id = ${judgeId} AND performance_id = ${entryId}
    ` as any[];
    
    if (result.length === 0) return null;
    
    const score = result[0];
    return {
      id: score.id,
      entryId: score.performance_id,
      judgeId: score.judge_id,
      technicalScore: score.technical_score,
      musicalScore: score.musical_score,
      performanceScore: score.performance_score,
      stylingScore: score.styling_score,
      overallImpressionScore: score.overall_impression_score,
      comments: score.comments,
      submittedAt: score.submitted_at
    };
  },

  async updateNationalsScore(id: string, updates: {
    technicalScore?: number;
    musicalScore?: number;
    performanceScore?: number;
    stylingScore?: number;
    overallImpressionScore?: number;
    comments?: string;
  }) {
    const sqlClient = getSql();
    
    await sqlClient`
      UPDATE nationals_scores 
      SET 
        technical_score = ${updates.technicalScore || 0},
        musical_score = ${updates.musicalScore || 0},
        performance_score = ${updates.performanceScore || 0},
        styling_score = ${updates.stylingScore || 0},
        overall_impression_score = ${updates.overallImpressionScore || 0},
        comments = ${updates.comments || ''}
      WHERE id = ${id}
    `;
    
    console.log(`✅ Nationals score ${id} updated`);
  },

  async getNationalsScoresByEntry(entryId: string) {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT ns.*, j.name as judge_name 
      FROM nationals_scores ns
      JOIN judges j ON ns.judge_id = j.id
      WHERE ns.performance_id = ${entryId}
    ` as any[];
    
    return result.map((score: any) => ({
      id: score.id,
      entryId: score.performance_id,
      judgeId: score.judge_id,
      judgeName: score.judge_name,
      technicalScore: score.technical_score,
      musicalScore: score.musical_score,
      performanceScore: score.performance_score,
      stylingScore: score.styling_score,
      overallImpressionScore: score.overall_impression_score,
      comments: score.comments,
      submittedAt: score.submitted_at
    }));
  },

  // NEW: Performance presence management
  async setPerformancePresence(performanceId: string, eventId: string, present: boolean, checkedInBy: string) {
    const sqlClient = getSql();
    const id = Date.now().toString();
    const timestamp = new Date().toISOString();
    
    // Check if record exists
    const existing = await sqlClient`
      SELECT id FROM performance_presence 
      WHERE performance_id = ${performanceId}
    ` as any[];
    
    if (existing.length > 0) {
      // Update existing record
      await sqlClient`
        UPDATE performance_presence 
        SET present = ${present}, checked_in_by = ${checkedInBy}, checked_in_at = ${timestamp}
        WHERE performance_id = ${performanceId}
      `;
    } else {
      // Create new record
      await sqlClient`
        INSERT INTO performance_presence 
        (id, performance_id, event_id, present, checked_in_by, checked_in_at)
        VALUES (${id}, ${performanceId}, ${eventId}, ${present}, ${checkedInBy}, ${timestamp})
      `;
    }
    
    return { success: true };
  },

  async getPerformancePresence(performanceId: string) {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT * FROM performance_presence 
      WHERE performance_id = ${performanceId}
    ` as any[];
    
    if (result.length === 0) return null;
    
    const presence = result[0];
    return {
      id: presence.id,
      performanceId: presence.performance_id,
      eventId: presence.event_id,
      present: presence.present,
      checkedInBy: presence.checked_in_by,
      checkedInAt: presence.checked_in_at
    };
  },

  // NEW: Score approval system
  async createScoreApproval(performanceId: string, judgeId: string, scoreId: string) {
    const sqlClient = getSql();
    const id = Date.now().toString();
    const timestamp = new Date().toISOString();
    
    await sqlClient`
      INSERT INTO score_approvals 
      (id, performance_id, judge_id, score_id, status, created_at)
      VALUES (${id}, ${performanceId}, ${judgeId}, ${scoreId}, 'pending', ${timestamp})
    `;
    
    return { id };
  },

  async approveScore(approvalId: string, approvedBy: string) {
    const sqlClient = getSql();
    const timestamp = new Date().toISOString();
    
    await sqlClient`
      UPDATE score_approvals 
      SET status = 'approved', approved_by = ${approvedBy}, approved_at = ${timestamp}
      WHERE id = ${approvalId}
    `;
    
    return { success: true };
  },

  async rejectScore(approvalId: string, rejectedBy: string, reason: string) {
    const sqlClient = getSql();
    const timestamp = new Date().toISOString();
    
    await sqlClient`
      UPDATE score_approvals 
      SET status = 'rejected', approved_by = ${rejectedBy}, approved_at = ${timestamp}, 
          rejected = true, rejection_reason = ${reason}
      WHERE id = ${approvalId}
    `;
    
    return { success: true };
  },

  async getScoreApprovals(performanceId?: string) {
    const sqlClient = getSql();

    // IMPORTANT: Get performances with ALL judges scored - aggregated view
    // This query is DYNAMIC - it counts actual judges assigned, NOT hard-coded to 4
    // Performance appears when: scored_judges = total_judges (regardless of number)
    const performancesQuery = performanceId
      ? sqlClient`
          WITH performance_judge_counts AS (
            SELECT
              p.id as performance_id,
              p.title as performance_title,
              p.event_id,
              p.scores_published,
              COUNT(DISTINCT jea.judge_id) as total_judges,
              COUNT(DISTINCT s.judge_id) as scored_judges
            FROM performances p
            JOIN judge_event_assignments jea ON jea.event_id = p.event_id
            LEFT JOIN scores s ON s.performance_id = p.id
            WHERE p.id = ${performanceId}
            GROUP BY p.id, p.title, p.event_id, p.scores_published
          )
          SELECT * FROM performance_judge_counts
          WHERE scored_judges > 0 AND scored_judges = total_judges
        `
      : sqlClient`
          WITH performance_judge_counts AS (
            SELECT
              p.id as performance_id,
              p.title as performance_title,
              p.event_id,
              p.scores_published,
              COUNT(DISTINCT jea.judge_id) as total_judges,
              COUNT(DISTINCT s.judge_id) as scored_judges
            FROM performances p
            JOIN judge_event_assignments jea ON jea.event_id = p.event_id
            LEFT JOIN scores s ON s.performance_id = p.id
            GROUP BY p.id, p.title, p.event_id, p.scores_published
          )
          SELECT * FROM performance_judge_counts
          WHERE scored_judges > 0 AND scored_judges = total_judges
          ORDER BY performance_id DESC
        `;

    const performances = await performancesQuery as any[];
    
    // Debug logging to help diagnose issues
    console.log(`📊 Score Approvals Query Result: Found ${performances.length} performances ready for approval`);

    // For each performance, get all judge scores
    const result = await Promise.all(performances.map(async (perf: any) => {
      const scoresQuery = await sqlClient`
        SELECT
          s.id as score_id,
          s.judge_id,
          s.technical_score,
          s.musical_score,
          s.performance_score,
          s.styling_score,
          s.overall_impression_score,
          s.comments,
          s.submitted_at,
          j.name as judge_name
        FROM scores s
        JOIN judges j ON j.id = s.judge_id
        WHERE s.performance_id = ${perf.performance_id}
        ORDER BY j.name
      ` as any[];

      const judgeScores = scoresQuery.map((score: any) => ({
        judgeId: score.judge_id,
        judgeName: score.judge_name,
        scoreId: score.score_id,
        technicalScore: parseFloat(score.technical_score),
        musicalScore: parseFloat(score.musical_score),
        performanceScore: parseFloat(score.performance_score),
        stylingScore: parseFloat(score.styling_score),
        overallImpressionScore: parseFloat(score.overall_impression_score),
        total: parseFloat(score.technical_score) + parseFloat(score.musical_score) +
               parseFloat(score.performance_score) + parseFloat(score.styling_score) +
               parseFloat(score.overall_impression_score),
        comments: score.comments,
        submittedAt: score.submitted_at
      }));

      // Calculate average using total judges assigned to event (not just scores submitted)
      const totalSum = judgeScores.reduce((sum, js) => sum + js.total, 0);
      const totalJudgesAssigned = perf.total_judges || judgeScores.length;
      // Use total judges assigned, with fallback to scores.length if judges not assigned yet
      const average = totalJudgesAssigned > 0 ? totalSum / totalJudgesAssigned : 0;
      const percentage = average; // Already out of 100

      // Get medal from existing function
      const { getMedalFromPercentage } = await import('./types');
      const medal = getMedalFromPercentage(percentage);

      return {
        performanceId: perf.performance_id,
        performanceTitle: perf.performance_title,
        eventId: perf.event_id,
        totalJudges: perf.total_judges,
        scoredJudges: perf.scored_judges,
        judgeScores,
        averageScore: average,
        percentage,
        medal,
        status: perf.scores_published ? 'published' : 'pending',
        scoresPublished: perf.scores_published || false
      };
    }));

    return result;
  },

  // NEW: Announcer functionality
  async markPerformanceAnnounced(performanceId: string, announcedBy: string, note?: string) {
    const sqlClient = getSql();
    const timestamp = new Date().toISOString();
    
    // Ensure columns exist for announcer tracking (idempotent)
    try {
      await sqlClient`ALTER TABLE performances ADD COLUMN IF NOT EXISTS announced BOOLEAN DEFAULT FALSE`;
      await sqlClient`ALTER TABLE performances ADD COLUMN IF NOT EXISTS announced_by TEXT`;
      await sqlClient`ALTER TABLE performances ADD COLUMN IF NOT EXISTS announced_at TEXT`;
      await sqlClient`ALTER TABLE performances ADD COLUMN IF NOT EXISTS announcer_notes TEXT`;
    } catch {}

    await sqlClient`
      UPDATE performances 
      SET announced = true, announced_by = ${announcedBy}, announced_at = ${timestamp}, announcer_notes = COALESCE(${note || null}, announcer_notes)
      WHERE id = ${performanceId}
    `;
    
    return { success: true };
  },

  async getAnnouncedPerformances(eventId: string) {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT * FROM performances 
      WHERE event_id = ${eventId} AND announced = true
      ORDER BY announced_at DESC
    ` as any[];
    
    return result.map((p: any) => ({
      id: p.id,
      title: p.title,
      eventId: p.event_id,
      announced: p.announced,
      announcedBy: p.announced_by,
      announcedAt: p.announced_at
    }));
  },

  // NEW: Create different role users
  async createRoleUser(userData: {
    name: string;
    email: string;
    password: string;
    role: 'backstage_manager' | 'announcer' | 'registration' | 'media';
  }) {
    const sqlClient = getSql();
    const id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    
    await sqlClient`
      INSERT INTO judges (id, name, email, password, is_admin, role, specialization, created_at)
      VALUES (${id}, ${userData.name}, ${userData.email}, ${userData.password}, false, ${userData.role}, '[]', ${timestamp})
    `;
    
    return { id, ...userData, isAdmin: false, specialization: [], createdAt: timestamp };
  },

  async getUserByRole(role: string) {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT * FROM judges WHERE role = ${role}
    ` as any[];
    
    return result.map((user: any) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isAdmin: user.is_admin,
      createdAt: user.created_at
    }));
  },

  // Clean studios method - removes dancers without registrations
  async cleanStudios() {
    const sqlClient = getSql();
    
    console.log('🧹 Cleaning studios...');
    
    // Delete all data in dependency order (most dependent first)
    await sqlClient`DELETE FROM studio_applications`;
    await sqlClient`DELETE FROM dancers`;
    await sqlClient`DELETE FROM contestants`;
    await sqlClient`DELETE FROM studios`;
    
    // Keep only admin users, remove regular studios
    await sqlClient`DELETE FROM studios WHERE is_admin = false`;
    
    console.log('✅ Studios cleaned successfully - Admin user and fee schedule preserved');
  },

  async updatePerformanceItemNumber(performanceId: string, itemNumber: number) {
    const sqlClient = getSql();
    await sqlClient`
      UPDATE performances 
      SET item_number = ${itemNumber}
      WHERE id = ${performanceId}
    `;
    return { success: true };
  },

  async updatePerformanceOrder(performanceId: string, performanceOrder: number) {
    const sqlClient = getSql();
    await sqlClient`
      UPDATE performances 
      SET performance_order = ${performanceOrder}
      WHERE id = ${performanceId}
    `;
    return { success: true };
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
    province: string;
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
    
    // Create both records to ensure consistency
    try {
      // Create the dancer record
    await sqlClient`
      INSERT INTO dancers (id, eodsa_id, name, date_of_birth, age, national_id, province, email, phone, 
                          guardian_name, guardian_email, guardian_phone, approved, approved_at)
      VALUES (${id}, ${eodsaId}, ${dancer.name}, ${dancer.dateOfBirth}, ${age}, ${dancer.nationalId},
              ${dancer.province}, ${dancer.email || null}, ${dancer.phone || null}, ${dancer.guardianName || null},
              ${dancer.guardianEmail || null}, ${dancer.guardianPhone || null}, TRUE, ${approvedAt})
    `;
      
      // CONSISTENCY FIX: Also create a corresponding contestant record
      // This prevents future foreign key constraint violations
      await sqlClient`
        INSERT INTO contestants (id, eodsa_id, name, email, phone, type, date_of_birth, registration_date)
        VALUES (${id}, ${eodsaId}, ${dancer.name}, ${dancer.email || `temp-${id}@example.com`}, 
                ${dancer.phone || '0000000000'}, 'private', ${dancer.dateOfBirth}, ${approvedAt})
      `;
      
      console.log(`✅ Created unified dancer and contestant records for: ${dancer.name} (${eodsaId})`);
      
    } catch (error) {
      console.error('❌ Failed to create dancer and contestant records:', error);
      throw error;
    }
    
    return { id, eodsaId };
  },

  // Get all dancers for admin approval
  async getAllDancers(status?: 'pending' | 'approved' | 'rejected') {
    const sqlClient = getSql();
    
    let result: any[];
    
    if (status === 'pending') {
      result = await sqlClient`
        SELECT d.*, j.name as approved_by_name,
               s.name as studio_name, s.id as studio_id, s.email as studio_email
        FROM dancers d 
        LEFT JOIN judges j ON d.approved_by = j.id
        LEFT JOIN studio_applications sa ON d.id = sa.dancer_id AND sa.status = 'accepted'
        LEFT JOIN studios s ON sa.studio_id = s.id
        WHERE d.approved = false AND d.rejection_reason IS NULL
        ORDER BY d.created_at DESC
      ` as any[];
    } else if (status === 'approved') {
      result = await sqlClient`
        SELECT d.*, j.name as approved_by_name,
               s.name as studio_name, s.id as studio_id, s.email as studio_email
        FROM dancers d 
        LEFT JOIN judges j ON d.approved_by = j.id
        LEFT JOIN studio_applications sa ON d.id = sa.dancer_id AND sa.status = 'accepted'
        LEFT JOIN studios s ON sa.studio_id = s.id
        WHERE d.approved = true
        ORDER BY d.created_at DESC
      ` as any[];
    } else if (status === 'rejected') {
      result = await sqlClient`
        SELECT d.*, j.name as approved_by_name,
               s.name as studio_name, s.id as studio_id, s.email as studio_email
        FROM dancers d 
        LEFT JOIN judges j ON d.approved_by = j.id
        LEFT JOIN studio_applications sa ON d.id = sa.dancer_id AND sa.status = 'accepted'
        LEFT JOIN studios s ON sa.studio_id = s.id
        WHERE d.approved = false AND d.rejection_reason IS NOT NULL
        ORDER BY d.created_at DESC
      ` as any[];
    } else {
      result = await sqlClient`
        SELECT d.*, j.name as approved_by_name,
               s.name as studio_name, s.id as studio_id, s.email as studio_email
        FROM dancers d 
        LEFT JOIN judges j ON d.approved_by = j.id
        LEFT JOIN studio_applications sa ON d.id = sa.dancer_id AND sa.status = 'accepted'
        LEFT JOIN studios s ON sa.studio_id = s.id
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
      createdAt: row.created_at,
      // Registration fee tracking fields
      registrationFeePaid: row.registration_fee_paid || false,
      registrationFeePaidAt: row.registration_fee_paid_at,
      registrationFeeMasteryLevel: row.registration_fee_mastery_level,
      // Studio information
      studioName: row.studio_name,
      studioId: row.studio_id,
      studioEmail: row.studio_email
    }));
  },

  // Admin approve/reject dancer
  async approveDancer(dancerId: string, adminId: string) {
    const sqlClient = getSql();
    const approvedAt = new Date().toISOString();
    
    try {
      // First, get the dancer info before updating
      const dancer = await sqlClient`
        SELECT * FROM dancers WHERE id = ${dancerId}
      ` as any[];
      
      if (dancer.length === 0) {
        throw new Error(`Dancer not found: ${dancerId}`);
      }
      
      const dancerData = dancer[0];
      
      // Update dancer approval status
    await sqlClient`
      UPDATE dancers 
      SET approved = true, approved_by = ${adminId}, approved_at = ${approvedAt}, rejection_reason = null
      WHERE id = ${dancerId}
    `;
      
      // CONSISTENCY FIX: Create corresponding contestant record to prevent future FK errors
      await sqlClient`
        INSERT INTO contestants (id, eodsa_id, name, email, phone, type, date_of_birth, registration_date)
        VALUES (
          ${dancerData.id}, 
          ${dancerData.eodsa_id}, 
          ${dancerData.name}, 
          ${dancerData.email || `temp-${dancerData.id}@example.com`}, 
          ${dancerData.phone || '0000000000'}, 
          'private', 
          ${dancerData.date_of_birth}, 
          ${approvedAt}
        )
        ON CONFLICT (id) DO NOTHING
      `;
      
      console.log(`✅ Approved dancer and created contestant record for: ${dancerData.name} (${dancerData.eodsa_id})`);
      
    } catch (error) {
      console.error('❌ Failed to approve dancer and create contestant record:', error);
      throw error;
    }
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

    // Get NEW system dancers with studio applications
    const newDancers = await sqlClient`
      SELECT d.*, sa.applied_at, sa.responded_at
      FROM dancers d
      JOIN studio_applications sa ON d.id = sa.dancer_id
      WHERE sa.studio_id = ${studioId} AND sa.status = 'accepted' AND d.approved = true
      ORDER BY sa.responded_at DESC
    ` as any[];

    // Get studio info to match legacy contestants
    const studio = await studioDb.getStudioById(studioId);
    const legacyContestants = studio ? await sqlClient`
      SELECT DISTINCT c.eodsa_id, c.id, c.name, c.date_of_birth, c.email, c.phone
      FROM contestants c
      WHERE c.type = 'studio' AND (c.email = ${studio.email} OR c.studio_name = ${studio.name})
    ` as any[] : [];

    // Map new dancers
    const mappedNewDancers = newDancers.map((row: any) => ({
      id: row.id,
      eodsaId: row.eodsa_id,
      name: row.name,
      age: row.age,
      dateOfBirth: row.date_of_birth,
      nationalId: row.national_id,
      email: row.email,
      phone: row.phone,
      approved: row.approved,
      joinedAt: row.responded_at,
      isLegacy: false
    }));

    // Map legacy contestants with all required fields
    const mappedLegacyContestants = legacyContestants.map((row: any) => {
      // Calculate age from date of birth if available
      let age = 0;
      if (row.date_of_birth) {
        try {
          const birthDate = new Date(row.date_of_birth);
          const today = new Date();
          age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
        } catch (e) {
          age = 0;
        }
      }

      return {
        id: row.id,
        eodsaId: row.eodsa_id,
        name: row.name || 'Unknown',
        age: age,
        dateOfBirth: row.date_of_birth || '',
        nationalId: '', // Legacy contestants don't have national_id in contestants table
        email: row.email || '',
        phone: row.phone || '',
        approved: true, // Legacy contestants are considered approved
        joinedAt: null,
        isLegacy: true
      };
    });

    // Combine both lists, avoiding duplicates
    const combinedDancers = [...mappedNewDancers];
    for (const legacy of mappedLegacyContestants) {
      if (!combinedDancers.find(d => d.eodsaId === legacy.eodsaId)) {
        combinedDancers.push(legacy);
      }
    }

    return combinedDancers;
  },

  // Get all competition entries for a studio's dancers
  async getStudioEntries(studioId: string) {
    const sqlClient = getSql();
    
    // First get all dancers belonging to the studio
    const studioDancers = await this.getStudioDancers(studioId);
    const dancerEodsaIds = studioDancers.map(d => d.eodsaId);
    const dancerIds = studioDancers.map(d => d.id);
    
    // Get all event entries for these dancers AND entries created directly by the studio
    // QUERY BOTH event_entries AND nationals_event_entries tables
    const regularEntries = await sqlClient`
      SELECT ee.*, e.name as event_name, e.region, e.event_date, e.venue, e.performance_type,
             COALESCE(c.name, d.name, 'Studio Entry') as contestant_name, 
             CASE 
               WHEN c.type IS NOT NULL THEN c.type 
               ELSE 'studio' 
             END as contestant_type
      FROM event_entries ee
      JOIN events e ON ee.event_id = e.id
      LEFT JOIN contestants c ON ee.contestant_id = c.id
      LEFT JOIN dancers d ON ee.contestant_id = d.id
      WHERE ee.eodsa_id = ${studioId}
         OR (${dancerEodsaIds.length > 0} AND ee.eodsa_id = ANY(${dancerEodsaIds}))
         OR (${dancerIds.length > 0} AND ee.contestant_id = ANY(${dancerIds}))
         OR (${dancerIds.length > 0} AND ee.participant_ids::text LIKE ANY(${dancerIds.map(id => `%"${id}"%`)}))
      ORDER BY ee.submitted_at DESC
    ` as any[];
    
    const nationalsEntries = await sqlClient`
      SELECT nee.*, 
             nee.nationals_event_id as event_id,
             e.name as event_name, 
             e.region, 
             e.event_date, 
             e.venue, 
             e.performance_type,
             COALESCE(c.name, d.name, 'Studio Entry') as contestant_name, 
             CASE 
               WHEN c.type IS NOT NULL THEN c.type 
               ELSE 'studio' 
             END as contestant_type
      FROM nationals_event_entries nee
      JOIN events e ON nee.nationals_event_id = e.id
      LEFT JOIN contestants c ON nee.contestant_id = c.id
      LEFT JOIN dancers d ON nee.contestant_id = d.id
      WHERE nee.eodsa_id = ${studioId}
         OR (${dancerEodsaIds.length > 0} AND nee.eodsa_id = ANY(${dancerEodsaIds}))
         OR (${dancerIds.length > 0} AND nee.contestant_id = ANY(${dancerIds}))
         OR (${dancerIds.length > 0} AND nee.participant_ids::text LIKE ANY(${dancerIds.map(id => `%"${id}"%`)}))
      ORDER BY nee.submitted_at DESC
    ` as any[];
    
    const result = [...regularEntries, ...nationalsEntries];
    
    // Enhance entries with participant names
    const enhancedEntries = await Promise.all(
      result.map(async (row: any) => {
        try {
          let participantNames = [];
          
          // Try to get participant names from unified system first
          const participantIds = JSON.parse(row.participant_ids);
          for (let i = 0; i < participantIds.length; i++) {
            const participantId = participantIds[i];
            const dancer = await this.getDancerById(participantId);
            if (dancer) {
              participantNames.push(dancer.name);
              continue;
            }
            // Fallback to legacy contestants
            const contestant = await db.getContestantById(row.contestant_id);
            const contestantDancer = contestant?.dancers.find(d => d.id === participantId);
            if (contestantDancer?.name) {
              participantNames.push(contestantDancer.name);
            } else {
              // Final fallback: label Participant 1/2/... instead of "Unknown Dancer"
              participantNames.push(`Participant ${i + 1}`);
            }
          }
          
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
            createdAt: row.created_at,
            // PHASE 2: Live vs Virtual Entry Support
            entryType: row.entry_type || 'live',
            musicFileUrl: row.music_file_url,
            musicFileName: row.music_file_name,
            videoFileUrl: row.video_file_url,
            videoFileName: row.video_file_name,
            videoExternalUrl: row.video_external_url,
            videoExternalType: row.video_external_type
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
    musicFileUrl?: string;
    musicFileName?: string;
    videoFileUrl?: string;
    videoFileName?: string;
  }) {
    const sqlClient = getSql();
    
    // Verify this entry belongs to this studio using the same logic as getStudioEntries
    const allStudioEntries = await this.getStudioEntries(studioId);
    const entry = allStudioEntries.find(e => e.id === entryId);
    
    if (!entry) {
      throw new Error('Entry not found or not owned by this studio');
    }
    
    // Check if entry is still editable (not approved or event hasn't passed)
    const eventResult = await sqlClient`
      SELECT registration_deadline, event_date 
      FROM events 
      WHERE id = ${entry.eventId}
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
    
    // Use separate queries for each field to avoid unsafe parameter usage
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
    
    // PHASE 2: Handle music file updates for studio music uploads
    if (updates.musicFileUrl !== undefined) {
      await sqlClient`UPDATE event_entries SET music_file_url = ${updates.musicFileUrl || null} WHERE id = ${entryId}`;
    }
    if (updates.musicFileName !== undefined) {
      await sqlClient`UPDATE event_entries SET music_file_name = ${updates.musicFileName || null} WHERE id = ${entryId}`;
    }
    
    return { success: true, message: 'Entry updated successfully' };
  },

  // Admin-only entry deletion
  async deleteEntryAsAdmin(adminId: string, entryId: string) {
    const sqlClient = getSql();
    
    // Verify admin exists and has admin privileges
    const admin = await sqlClient`
      SELECT id, is_admin FROM judges WHERE id = ${adminId} AND is_admin = true
    ` as any[];
    
    if (admin.length === 0) {
      throw new Error('Admin privileges required to delete entries');
    }
    
    // Check if entry exists
    const entry = await sqlClient`
      SELECT id FROM event_entries WHERE id = ${entryId}
    ` as any[];
    
    if (entry.length === 0) {
      throw new Error('Entry not found');
    }
    
    // Delete the entry and any associated performances/scores
    await sqlClient`DELETE FROM scores WHERE performance_id IN (
      SELECT id FROM performances WHERE event_entry_id = ${entryId}
    )`;
    
    await sqlClient`DELETE FROM performances WHERE event_entry_id = ${entryId}`;
    
    await sqlClient`DELETE FROM event_entries WHERE id = ${entryId}`;
    
    return { success: true, message: 'Entry deleted successfully by admin' };
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
  },

  // Registration fee tracking functions
  async markRegistrationFeePaid(dancerId: string, masteryLevel: string) {
    const sqlClient = getSql();
    const paidAt = new Date().toISOString();
    
    await sqlClient`
      UPDATE dancers 
      SET registration_fee_paid = TRUE, 
          registration_fee_paid_at = ${paidAt}, 
          registration_fee_mastery_level = ${masteryLevel}
      WHERE id = ${dancerId}
    `;
    
    return { success: true };
  },

  async getDancerRegistrationStatus(dancerId: string) {
    const sqlClient = getSql();
    const result = await sqlClient`
      SELECT registration_fee_paid, registration_fee_paid_at, registration_fee_mastery_level
      FROM dancers 
      WHERE id = ${dancerId}
    ` as any[];
    
    if (result.length === 0) {
      throw new Error('Dancer not found');
    }
    
    return {
      registrationFeePaid: result[0].registration_fee_paid || false,
      registrationFeePaidAt: result[0].registration_fee_paid_at,
      registrationFeeMasteryLevel: result[0].registration_fee_mastery_level
    };
  },

  async getDancersWithRegistrationStatus(dancerIds: string[]) {
    const sqlClient = getSql();
    // Enhanced query to check both registration_fee_paid column AND existing paid entries
    const result = await sqlClient`
      SELECT d.id, d.name, d.age, d.date_of_birth, d.national_id, d.eodsa_id,
             d.registration_fee_paid, d.registration_fee_paid_at, d.registration_fee_mastery_level,
             CASE 
               WHEN d.registration_fee_paid = TRUE THEN TRUE
               WHEN EXISTS (
                 SELECT 1 FROM event_entries ee 
                 WHERE ee.eodsa_id = d.eodsa_id 
                 AND ee.payment_status = 'paid'
               ) THEN TRUE
               ELSE FALSE
             END as effective_registration_paid
      FROM dancers d
      WHERE d.id = ANY(${dancerIds})
    ` as any[];
    
    return result.map((row: any) => ({
      id: row.id,
      name: row.name,
      age: row.age,
      dateOfBirth: row.date_of_birth,
      nationalId: row.national_id,
      eodsaId: row.eodsa_id,
      registrationFeePaid: row.effective_registration_paid || false,
      registrationFeePaidAt: row.registration_fee_paid_at,
      registrationFeeMasteryLevel: row.registration_fee_mastery_level,
      style: '', // For compatibility
      approved: true // For compatibility
    }));
  },

  // Database migration to add registration fee tracking columns
  async addRegistrationFeeColumns() {
    const sqlClient = getSql();
    
    try {
      // Add registration fee tracking columns if they don't exist
      await sqlClient`ALTER TABLE dancers ADD COLUMN IF NOT EXISTS registration_fee_paid BOOLEAN DEFAULT FALSE`;
      await sqlClient`ALTER TABLE dancers ADD COLUMN IF NOT EXISTS registration_fee_paid_at TEXT`;
      await sqlClient`ALTER TABLE dancers ADD COLUMN IF NOT EXISTS registration_fee_mastery_level TEXT`;
      
      // Add solo count column to nationals entries table
      await sqlClient`ALTER TABLE nationals_event_entries ADD COLUMN IF NOT EXISTS solo_count INTEGER DEFAULT 0`;
      
      console.log('✅ Added registration fee tracking columns to dancers table');
      console.log('✅ Added solo_count column to nationals_event_entries table');
    } catch (error) {
      console.log('Registration fee columns may already exist:', error);
    }
  },

  // Create nationals event entry
  async createNationalsEventEntry(entry: {
    nationalsEventId: string;
    contestantId: string;
    eodsaId: string;
    participantIds: string[];
    calculatedFee: number;
    paymentStatus: string;
    paymentMethod?: string;
    approved: boolean;
    qualifiedForNationals: boolean;
    itemNumber?: number;
    itemName: string;
    choreographer: string;
    mastery: string;
    itemStyle: string;
    estimatedDuration: number;
    performanceType: string;
    ageCategory: string;
    soloCount?: number;
    soloDetails?: any;
    additionalNotes?: string;
  }) {
    return await db.createNationalsEventEntry(entry);
  },

  // Calculate nationals fee with solo packages
  async calculateNationalsFee(
    performanceType: string,
    soloCount: number = 1,
    participantCount: number = 1,
    participantIds: string[] = [],
    eventId?: string
  ) {
    const registrationFeePerDancer = 300; // R300 per dancer
    let performanceFee = 0;
    let participantsNeedingRegistration = participantCount;

    // Calculate performance fee based on type and solo count
    if (performanceType === 'Solo') {
      // Solo package pricing: 1 solo R400, 2 solos R750, 3 solos R1000, 4 solos R1200, 5th FREE, additional R100
      if (soloCount === 1) {
        performanceFee = 400;
      } else if (soloCount === 2) {
        performanceFee = 750;
      } else if (soloCount === 3) {
        performanceFee = 1000;
      } else if (soloCount === 4) {
        performanceFee = 1200;
      } else if (soloCount === 5) {
        performanceFee = 1200; // 5th solo is FREE
      } else if (soloCount > 5) {
        performanceFee = 1200 + ((soloCount - 5) * 100); // Additional solos R100 each
      }
    } else if (performanceType === 'Duet' || performanceType === 'Trio') {
      performanceFee = 280 * participantCount; // R280 per person
    } else if (performanceType === 'Group') {
      if (participantCount >= 4 && participantCount <= 9) {
        performanceFee = 220 * participantCount; // Small groups R220 per person
      } else if (participantCount >= 10) {
        performanceFee = 190 * participantCount; // Large groups R190 per person
      }
    }

    const registrationFee = registrationFeePerDancer * participantsNeedingRegistration;
    const totalFee = registrationFee + performanceFee;

    return {
      registrationFee,
      performanceFee,
      totalFee,
      participantsNeedingRegistration,
      breakdown: {
        performanceType,
        soloCount: performanceType === 'Solo' ? soloCount : undefined,
        participantCount,
        registrationFeePerDancer,
        performanceFeeStructure: performanceType === 'Solo' 
          ? `Solo package (${soloCount} solo${soloCount > 1 ? 's' : ''})`
          : `${performanceType} (${participantCount} participant${participantCount > 1 ? 's' : ''})`
      }
    };
  },

  // Get all nationals event entries
  async getAllNationalsEventEntries() {
    return await db.getAllNationalsEventEntries();
  },

  // Get nationals judge assignments by event
  async getNationalsJudgeAssignmentsByEvent(eventId: string) {
    return await db.getNationalsJudgeAssignmentsByEvent(eventId);
  },

  // Get judge count for nationals event
  async getNationalsEventJudgeCount(eventId: string) {
    return await db.getNationalsEventJudgeCount(eventId);
  },

  // Remove judge assignment from nationals event
  async removeNationalsJudgeAssignment(assignmentId: string) {
    return await db.removeNationalsJudgeAssignment(assignmentId);
  },

  // Create nationals score
  async createNationalsScore(score: {
    entryId: string;
    judgeId: string;
    technicalScore: number;
    musicalScore: number;
    performanceScore: number;
    stylingScore: number;
    overallImpressionScore: number;
    comments?: string;
  }) {
    return await db.createNationalsScore(score);
  },

  // Get nationals score by judge and performance
  async getNationalsScoreByJudgeAndPerformance(judgeId: string, entryId: string) {
    return await db.getNationalsScoreByJudgeAndPerformance(judgeId, entryId);
  },

  // Update nationals score
  async updateNationalsScore(id: string, updates: {
    technicalScore?: number;
    musicalScore?: number;
    performanceScore?: number;
    stylingScore?: number;
    overallImpressionScore?: number;
    comments?: string;
  }) {
    return await db.updateNationalsScore(id, updates);
  },

  // Get all nationals scores for an entry
  async getNationalsScoresByEntry(entryId: string) {
    return await db.getNationalsScoresByEntry(entryId);
  },

  // Get nationals events with scores for rankings
  async getNationalsEventsWithScores() {
    const sqlClient = getSql();
    
    try {
      const result = await sqlClient`
        SELECT 
          ne.id,
          ne.name,
          ne.event_date,
          ne.venue,
          ne.status,
          COUNT(DISTINCT nee.id) as entry_count,
          COUNT(DISTINCT ns.id) as score_count
        FROM nationals_events ne
        LEFT JOIN nationals_event_entries nee ON ne.id = nee.nationals_event_id AND nee.approved = true
        LEFT JOIN nationals_scores ns ON nee.id = ns.performance_id
        GROUP BY ne.id, ne.name, ne.event_date, ne.venue, ne.status
        ORDER BY ne.event_date DESC
      ` as any[];
      
      return result.map((row: any) => ({
        id: row.id,
        name: row.name,
        eventDate: row.event_date,
        venue: row.venue,
        status: row.status,
        entryCount: parseInt(row.entry_count) || 0,
        scoreCount: parseInt(row.score_count) || 0
      }));
    } catch (error) {
      console.error('Error fetching nationals events with scores:', error);
      return [];
    }
  },

  // Calculate nationals rankings
  async calculateNationalsRankings(eventIds?: string[]) {
    return await db.calculateNationalsRankings(eventIds);
  },

  // Add payment reference columns
  async addPaymentReferenceColumns() {
    const sqlClient = getSql();
    
    try {
      console.log('🔄 Adding payment reference columns to event_entries table...');
      
      // Add payment_reference column
      await sqlClient`ALTER TABLE event_entries ADD COLUMN IF NOT EXISTS payment_reference TEXT`;
      console.log('✅ Added payment_reference column');
      
      // Add payment_date column
      await sqlClient`ALTER TABLE event_entries ADD COLUMN IF NOT EXISTS payment_date TEXT`;
      console.log('✅ Added payment_date column');
      
      console.log('✅ Payment reference columns migration completed');
      return true;
    } catch (error) {
      console.error('❌ Error adding payment reference columns:', error);
      return false;
    }
  },

  // Mark registration fee as unpaid
  async markRegistrationFeeUnpaid(dancerId: string) {
    const sqlClient = getSql();
    await sqlClient`
      UPDATE dancers 
      SET registration_fee_paid = false, 
          registration_fee_paid_at = NULL,
          registration_fee_mastery_level = NULL
      WHERE id = ${dancerId}
    `;
    
    return { success: true };
  },

  // Check if a dancer has any pending entries that include registration fees
  async hasPendingRegistrationEntry(dancerId: string, masteryLevel: string) {
    const sqlClient = getSql();
    
    try {
      // Get the dancer's EODSA ID
      const dancer = await sqlClient`
        SELECT eodsa_id FROM dancers WHERE id = ${dancerId}
      ` as any[];
      
      if (dancer.length === 0) {
        console.log(`❌ No dancer found with ID: ${dancerId}`);
        return false;
      }
      
      const eodsaId = dancer[0].eodsa_id;
      console.log(`🔍 Checking pending entries for dancer ${eodsaId} (internal ID: ${dancerId}) with mastery ${masteryLevel}`);
      
      // Check for pending entries that include this dancer and have registration fees
      // Use the internal dancer ID for participant_ids search since that's what's stored there
      const pendingEntries = await sqlClient`
        SELECT ee.*
        FROM event_entries ee
        WHERE ee.approved = FALSE 
          AND ee.payment_status = 'pending'
          AND (
            ee.eodsa_id = ${eodsaId}
            OR ee.participant_ids::text LIKE ${'%' + dancerId + '%'}
          )
      ` as any[];
      
      console.log(`📋 Found ${pendingEntries.length} pending entries for dancer ${eodsaId}`);
      for (const entry of pendingEntries) {
        console.log(`   - Entry: ${entry.item_name} - Fee: R${entry.calculated_fee} - Approved: ${entry.approved} - Mastery: ${entry.mastery}`);
      }
      
      // Also check all pending entries for this dancer regardless of mastery level
      const allPendingEntries = await sqlClient`
        SELECT ee.*
        FROM event_entries ee
        WHERE ee.approved = FALSE 
          AND ee.payment_status = 'pending'
          AND (
            ee.eodsa_id = ${eodsaId}
            OR ee.participant_ids::text LIKE ${'%' + dancerId + '%'}
          )
      ` as any[];
      
      console.log(`📋 Total pending entries for dancer ${eodsaId}: ${allPendingEntries.length}`);
      for (const entry of allPendingEntries) {
        console.log(`   - Entry: ${entry.item_name} - Fee: R${entry.calculated_fee} - Approved: ${entry.approved} - Mastery: ${entry.mastery}`);
      }
      
      // If there are any pending entries, assume they include registration fees
      // This is a conservative approach to prevent double-charging
      return pendingEntries.length > 0;
      
    } catch (error) {
      console.error('Error checking pending registration entries:', error);
      return false;
    }
  }
};

 