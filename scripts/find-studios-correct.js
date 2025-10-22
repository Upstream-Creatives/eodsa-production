const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

async function findStudiosCorrect() {
  console.log('🔍 Finding studios for legacy entries (Items 44, 29, 63, 101)...\n');
  
  try {
    const sql = neon(process.env.DATABASE_URL);
    
    const targetItems = [44, 29, 63, 101];
    
    for (const itemNum of targetItems) {
      const entries = await sql`
        SELECT * FROM event_entries WHERE item_number = ${itemNum} ORDER BY created_at DESC LIMIT 1
      `;
      
      if (entries.length === 0) {
        console.log(`❌ Item #${itemNum}: Not found\n`);
        continue;
      }
      
      const entry = entries[0];
      const participantIds = JSON.parse(entry.participant_ids);
      
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📝 Item #${itemNum}: ${entry.item_name || 'Unknown'}`);
      console.log(`   Entry ID: ${entry.id}`);
      console.log(`   EODSA ID: ${entry.eodsa_id}`);
      console.log(`   Participants: ${participantIds.length}`);
      console.log('');
      
      // Check each participant for studio
      const studios = new Set();
      
      for (let i = 0; i < participantIds.length; i++) {
        const pid = participantIds[i];
        
        // Get dancer with studio via studio_applications
        const dancers = await sql`
          SELECT 
            d.id,
            d.name,
            d.eodsa_id,
            s.id as studio_id,
            s.name as studio_name,
            s.registration_number as studio_reg
          FROM dancers d
          LEFT JOIN studio_applications sa ON d.id = sa.dancer_id AND sa.status = 'accepted'
          LEFT JOIN studios s ON sa.studio_id = s.id
          WHERE d.id = ${pid}
        `;
        
        if (dancers.length > 0) {
          const d = dancers[0];
          console.log(`   👤 ${i + 1}. ${d.name} (${d.eodsa_id})`);
          if (d.studio_name) {
            console.log(`      Studio: ${d.studio_name} (${d.studio_reg})`);
            studios.add(d.studio_name);
          } else {
            console.log(`      Studio: ⚠️  NOT LINKED TO ANY STUDIO`);
          }
        } else {
          console.log(`   ❌ ${i + 1}. Dancer ${pid} not found`);
        }
      }
      
      console.log('');
      if (studios.size > 0) {
        console.log(`   🏢 Studios: ${Array.from(studios).join(', ')}`);
        
        if (studios.size === 1) {
          const studioName = Array.from(studios)[0];
          console.log(`\n   ✅ FIX: All dancers are from "${studioName}"`);
          console.log(`   📝 The entry should show this studio name`);
        } else {
          console.log(`\n   ⚠️  Multiple studios: ${Array.from(studios).join(', ')}`);
        }
      } else {
        console.log(`   ⚠️  No studio links found - dancers are independent or not linked`);
      }
    }
    
    console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SUMMARY:');
    console.log('   The issue is that the code looks up contestant_id first,');
    console.log('   which is an old contestant record with no studio info.');
    console.log('');
    console.log('   The fix is to:');
    console.log('   1. Look up participants by their IDs in dancer table');
    console.log('   2. Join with studio_applications table (status=accepted)');
    console.log('   3. Display the studio name from there');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

findStudiosCorrect();

