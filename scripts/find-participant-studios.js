const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

async function findParticipantStudios() {
  console.log('🔍 Finding studios for legacy entry participants...\n');
  
  try {
    const sql = neon(process.env.DATABASE_URL);
    
    // Get the specific legacy entries from your screenshot
    const targetItems = [101, 29, 44, 63];
    
    console.log(`📋 Checking items: ${targetItems.join(', ')}\n`);
    
    for (const itemNum of targetItems) {
      const entries = await sql`
        SELECT 
          id,
          contestant_id,
          eodsa_id,
          participant_ids,
          studio_name,
          contestant_name,
          item_number,
          item_name,
          performance_type
        FROM event_entries
        WHERE item_number = ${itemNum}
        ORDER BY created_at DESC
        LIMIT 1
      `;
      
      if (entries.length === 0) {
        console.log(`❌ Item #${itemNum}: Not found\n`);
        continue;
      }
      
      const entry = entries[0];
      
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📝 Item #${itemNum}: ${entry.item_name || 'Unknown'}`);
      console.log(`   Type: ${entry.performance_type}`);
      console.log(`   Current Studio: ${entry.studio_name}`);
      console.log(`   Current Contestant: ${entry.contestant_name || 'Unknown'}`);
      console.log(`   Entry ID: ${entry.id}`);
      console.log(`   Contestant ID: ${entry.contestant_id}`);
      console.log(`   EODSA ID: ${entry.eodsa_id}`);
      console.log(`   Participant IDs: ${JSON.stringify(entry.participant_ids)}`);
      console.log('');
      
      // Try to find participants in dancers table
      if (entry.participant_ids && Array.isArray(entry.participant_ids)) {
        console.log(`   👥 Checking ${entry.participant_ids.length} participant(s):\n`);
        
        for (let i = 0; i < entry.participant_ids.length; i++) {
          const participantId = entry.participant_ids[i];
          console.log(`   Participant ${i + 1}: ${participantId}`);
          
          // Check dancers table
          const dancers = await sql`
            SELECT 
              d.id,
              d.name,
              d.eodsa_id,
              d.studio_id,
              s.name as studio_name,
              s.email as studio_email
            FROM dancers d
            LEFT JOIN studios s ON d.studio_id = s.id
            WHERE d.id = ${participantId}
          `;
          
          if (dancers.length > 0) {
            const dancer = dancers[0];
            console.log(`      ✅ Found in dancers table:`);
            console.log(`         Name: ${dancer.name}`);
            console.log(`         EODSA ID: ${dancer.eodsa_id}`);
            console.log(`         Studio ID: ${dancer.studio_id || 'NONE'}`);
            console.log(`         Studio Name: ${dancer.studio_name || 'NOT LINKED'}`);
            console.log(`         Studio Email: ${dancer.studio_email || 'N/A'}`);
          } else {
            // Try contestants table
            const contestants = await sql`
              SELECT 
                id,
                name,
                eodsa_id,
                type
              FROM contestants
              WHERE id = ${participantId}
            `;
            
            if (contestants.length > 0) {
              console.log(`      📦 Found in contestants table (OLD SYSTEM):`);
              console.log(`         Name: ${contestants[0].name}`);
              console.log(`         EODSA ID: ${contestants[0].eodsa_id}`);
              console.log(`         Type: ${contestants[0].type}`);
              
              // Check if this contestant has dancers (children)
              const contestantDancers = await sql`
                SELECT id, name, eodsa_id
                FROM dancers
                WHERE contestant_id = ${participantId}
              `;
              
              if (contestantDancers.length > 0) {
                console.log(`         Has ${contestantDancers.length} linked dancer(s):`);
                for (const cd of contestantDancers) {
                  console.log(`           - ${cd.name} (${cd.eodsa_id})`);
                  
                  // Check studio for each dancer
                  const dancerStudio = await sql`
                    SELECT 
                      d.studio_id,
                      s.name as studio_name
                    FROM dancers d
                    LEFT JOIN studios s ON d.studio_id = s.id
                    WHERE d.id = ${cd.id}
                  `;
                  
                  if (dancerStudio.length > 0 && dancerStudio[0].studio_name) {
                    console.log(`             Studio: ${dancerStudio[0].studio_name}`);
                  }
                }
              }
            } else {
              console.log(`      ❌ NOT FOUND in any table`);
            }
          }
          console.log('');
        }
      }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 NEXT STEPS:');
    console.log('   1. Review the studio information found above');
    console.log('   2. Update event_entries with correct studio names');
    console.log('   3. Link dancers to proper studios if needed');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

findParticipantStudios();

