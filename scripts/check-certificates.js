const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

async function checkCertificates() {
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    console.log('📋 Checking certificates...\n');
    
    const certs = await sql`SELECT id, dancer_id, dancer_name, eodsa_id, event_date, created_at FROM certificates ORDER BY created_at DESC LIMIT 10`;
    
    if (certs.length === 0) {
      console.log('❌ No certificates found in database');
      return;
    }
    
    console.log(`✅ Found ${certs.length} certificate(s):\n`);
    certs.forEach(cert => {
      console.log(`- ${cert.dancer_name}`);
      console.log(`  Dancer ID: ${cert.dancer_id}`);
      console.log(`  EODSA ID: ${cert.eodsa_id || 'N/A'}`);
      console.log(`  Event Date: ${cert.event_date}`);
      console.log(`  Created: ${cert.created_at}`);
      console.log();
    });
    
    // Check dancers table to see real dancer IDs
    console.log('\n📋 Sample dancers from database:\n');
    const dancers = await sql`SELECT id, eodsa_id, name FROM dancers LIMIT 5`;
    dancers.forEach(d => {
      console.log(`- ${d.name}: ID=${d.id}, EODSA=${d.eodsa_id}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkCertificates();

