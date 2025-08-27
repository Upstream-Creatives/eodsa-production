// PayFast Payment System Database Migration
// Run this to add payment tracking to your competition system

const { neon } = require('@neondatabase/serverless');

async function addPaymentSystem() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const sql = neon(DATABASE_URL);

  try {
    console.log('🏗️  Adding payment system to database...');

    // Create payments table
    await sql`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        payment_id VARCHAR(255) UNIQUE NOT NULL,
        entry_id TEXT REFERENCES event_entries(id) ON DELETE CASCADE,
        event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
        user_id TEXT,
        
        -- Payment details
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'ZAR',
        description TEXT,
        
        -- PayFast specific fields
        pf_payment_id VARCHAR(255),
        merchant_id VARCHAR(255),
        merchant_key VARCHAR(255),
        
        -- Payment status tracking
        status VARCHAR(50) DEFAULT 'pending',
        
        -- PayFast response data
        payment_status VARCHAR(50),
        item_name VARCHAR(255),
        item_description TEXT,
        amount_gross DECIMAL(10,2),
        amount_fee DECIMAL(10,2),
        amount_net DECIMAL(10,2),
        
        -- Security & verification
        signature VARCHAR(255),
        token VARCHAR(255),
        
        -- Timestamps
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        paid_at TIMESTAMP,
        
        -- Additional tracking
        ip_address INET,
        user_agent TEXT,
        
        -- Metadata for debugging
        raw_response JSONB
      )
    `;

    // Create indexes for payments table
    await sql`CREATE INDEX IF NOT EXISTS idx_payments_payment_id ON payments(payment_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_payments_entry_id ON payments(entry_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_payments_event_id ON payments(event_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_payments_pf_payment_id ON payments(pf_payment_id)`;

    // Add payment_status column to event_entries
    await sql`
      ALTER TABLE event_entries 
      ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'unpaid'
    `;

    // Add payment_id column to event_entries
    await sql`
      ALTER TABLE event_entries 
      ADD COLUMN IF NOT EXISTS payment_id VARCHAR(255)
    `;

    // Add payment_required column to events (some events might be free)
    await sql`
      ALTER TABLE events 
      ADD COLUMN IF NOT EXISTS payment_required BOOLEAN DEFAULT true
    `;

    // Add entry_fee column to events
    await sql`
      ALTER TABLE events 
      ADD COLUMN IF NOT EXISTS entry_fee DECIMAL(10,2) DEFAULT 25.00
    `;

    // Create payment_logs table for detailed tracking
    await sql`
      CREATE TABLE IF NOT EXISTS payment_logs (
        id SERIAL PRIMARY KEY,
        payment_id VARCHAR(255) REFERENCES payments(payment_id) ON DELETE CASCADE,
        event_type VARCHAR(100) NOT NULL,
        event_data JSONB,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create indexes for payment_logs table
    await sql`CREATE INDEX IF NOT EXISTS idx_payment_logs_payment_id ON payment_logs(payment_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_payment_logs_event_type ON payment_logs(event_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_payment_logs_created_at ON payment_logs(created_at)`;

    console.log('✅ Payment system tables created successfully!');
    console.log('');
    console.log('📋 What was added:');
    console.log('   • payments table - tracks all payment transactions');
    console.log('   • payment_logs table - detailed payment event logging');
    console.log('   • payment_status column in event_entries');
    console.log('   • payment_id column in event_entries');
    console.log('   • payment_required column in events');
    console.log('   • entry_fee column in events');
    console.log('');
    console.log('🔧 Next steps:');
    console.log('   1. Add PayFast credentials to your .env file');
    console.log('   2. Test payment flow in development mode');
    console.log('   3. Configure webhook URLs in PayFast dashboard');

  } catch (error) {
    console.error('❌ Error creating payment system:', error);
    process.exit(1);
  }
}

addPaymentSystem();
