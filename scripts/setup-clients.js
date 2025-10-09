const { neon } = require('@neondatabase/serverless');
const fs = require('fs');

async function setupClients() {
  try {
    console.log('📦 Setting up clients table...');
    
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL not found in environment');
      console.log('Please set DATABASE_URL environment variable');
      process.exit(1);
    }
    
    const sql = neon(process.env.DATABASE_URL);
    const script = fs.readFileSync('./scripts/create-clients-table.sql', 'utf8');
    
    console.log('🔄 Executing SQL script...');
    
    // Execute the entire script
    await sql.unsafe(script);
    
    console.log('✅ Database setup complete!');
    console.log('🏛️ Clients table created successfully!');
    console.log('');
    console.log('📝 Sample client account created:');
    console.log('   Email: client@example.com');
    console.log('   Password: client123');
    console.log('   Dashboards: announcer, media, registration');
    console.log('');
    console.log('🎯 Next steps:');
    console.log('1. Go to /admin → Clients tab to create real clients');
    console.log('2. Or test with: /portal/client');
    console.log('');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.message.includes('already exists')) {
      console.log('');
      console.log('⚠️  Table already exists! This is OK.');
      console.log('✅ Your clients system is ready to use!');
    } else {
      process.exit(1);
    }
  }
}

setupClients();