const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

async function checkCertUrl() {
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    const certs = await sql`
      SELECT id, dancer_name, certificate_url, created_at 
      FROM certificates 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    
    if (certs.length === 0) {
      console.log('❌ No certificates found');
      return;
    }
    
    const cert = certs[0];
    console.log('\n📜 Latest Certificate:');
    console.log('Dancer:', cert.dancer_name);
    console.log('Created:', cert.created_at);
    console.log('URL:', cert.certificate_url || '(empty)');
    console.log('URL Length:', cert.certificate_url ? cert.certificate_url.length : 0);
    console.log('Is Valid?', cert.certificate_url && cert.certificate_url.startsWith('http'));
    
    // Check Cloudinary config
    console.log('\n☁️ Cloudinary Configuration:');
    console.log('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME:', process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '❌ NOT SET');
    console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? '✅ SET' : '❌ NOT SET');
    console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? '✅ SET' : '❌ NOT SET');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkCertUrl();

