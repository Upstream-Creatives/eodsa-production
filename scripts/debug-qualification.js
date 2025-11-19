/**
 * Debug script to check why Bruno Fernandes (E585029) can enter nationals
 */

const { neon } = require('@neondatabase/serverless');

async function debugQualification() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  const eodsaId = 'E585029';
  
  console.log('🔍 Debugging qualification issue for Bruno Fernandes (E585029)\n');

  try {
    // 1. Find the dancer
    console.log('1️⃣ Finding dancer...');
    const dancer = await sql`
      SELECT id, name, eodsa_id FROM dancers WHERE eodsa_id = ${eodsaId}
    `;
    
    if (dancer.length === 0) {
      console.log('   ❌ Dancer not found');
      return;
    }
    
    const dancerId = dancer[0].id;
    console.log(`   ✅ Found: ${dancer[0].name} (ID: ${dancerId})`);

    // 2. Check all NATIONAL_EVENT events
    console.log('\n2️⃣ Checking NATIONAL_EVENT events...');
    const nationalEvents = await sql`
      SELECT 
        id,
        name,
        event_type,
        event_mode,
        qualification_required,
        qualification_source,
        minimum_qualification_score
      FROM events
      WHERE event_type = 'NATIONAL_EVENT'
      ORDER BY created_at DESC
      LIMIT 5
    `;
    
    console.log(`   Found ${nationalEvents.length} national events:`);
    nationalEvents.forEach(evt => {
      console.log(`   - ${evt.name}`);
      console.log(`     qualification_required: ${evt.qualification_required}`);
      console.log(`     qualification_source: ${evt.qualification_source}`);
      console.log(`     minimum_qualification_score: ${evt.minimum_qualification_score}`);
    });

    // 3. Check if dancer has any entries in national events
    console.log('\n3️⃣ Checking dancer entries in national events...');
    const nationalEntries = await sql`
      SELECT 
        ee.id,
        ee.event_id,
        e.name as event_name,
        e.event_type,
        e.qualification_required
      FROM event_entries ee
      JOIN events e ON e.id = ee.event_id
      WHERE e.event_type = 'NATIONAL_EVENT'
      AND (
        ee.eodsa_id = ${eodsaId}
        OR ee.participant_ids::text LIKE ${`%${dancerId}%`}
        OR ee.participant_ids::text LIKE ${`%${eodsaId}%`}
      )
    `;
    
    console.log(`   Found ${nationalEntries.length} entries in national events:`);
    nationalEntries.forEach(entry => {
      console.log(`   - Entry ${entry.id} in ${entry.event_name}`);
      console.log(`     Event qualification_required: ${entry.qualification_required}`);
    });

    // 4. Check if dancer has any regional performances
    console.log('\n4️⃣ Checking for regional performances...');
    const regionalPerfs = await sql`
      SELECT 
        p.id,
        p.event_id,
        e.name as event_name,
        e.event_type,
        p.scores_published,
        AVG(s.technical_score + s.musical_score + s.performance_score + 
            s.styling_score + s.overall_impression_score) as avg_score
      FROM performances p
      JOIN event_entries ee ON ee.id = p.event_entry_id
      JOIN events e ON e.id = p.event_id
      LEFT JOIN scores s ON s.performance_id = p.id
      WHERE (
        ee.eodsa_id = ${eodsaId}
        OR ee.participant_ids::text LIKE ${`%${dancerId}%`}
        OR ee.participant_ids::text LIKE ${`%${eodsaId}%`}
      )
      AND e.event_type = 'REGIONAL_EVENT'
      GROUP BY p.id, e.id
    `;
    
    console.log(`   Found ${regionalPerfs.length} regional performances:`);
    regionalPerfs.forEach(perf => {
      console.log(`   - Performance ${perf.id} in ${perf.event_name}`);
      console.log(`     Scores published: ${perf.scores_published}`);
      console.log(`     Average score: ${perf.avg_score || 'N/A'}`);
    });

    // 5. Check audit logs
    console.log('\n5️⃣ Checking qualification audit logs...');
    const auditLogs = await sql`
      SELECT 
        action_type,
        action_details,
        performed_at
      FROM qualification_audit_logs
      WHERE dancer_id = ${dancerId}
      ORDER BY performed_at DESC
      LIMIT 10
    `;
    
    console.log(`   Found ${auditLogs.length} audit log entries:`);
    auditLogs.forEach(log => {
      console.log(`   - ${log.action_type} at ${log.performed_at}`);
      if (log.action_details) {
        try {
          const details = typeof log.action_details === 'string' 
            ? JSON.parse(log.action_details) 
            : log.action_details;
          console.log(`     Details:`, JSON.stringify(details, null, 2));
        } catch (e) {
          console.log(`     Details: ${log.action_details}`);
        }
      }
    });

    // 6. Test the qualification check function logic
    console.log('\n6️⃣ Testing qualification check logic...');
    if (nationalEvents.length > 0) {
      const testEvent = nationalEvents[0];
      console.log(`   Testing against: ${testEvent.name}`);
      console.log(`   qualification_required: ${testEvent.qualification_required}`);
      console.log(`   qualification_source: ${testEvent.qualification_source}`);
      console.log(`   minimum_qualification_score: ${testEvent.minimum_qualification_score}`);
      
      if (!testEvent.qualification_required) {
        console.log('   ⚠️  ISSUE FOUND: qualification_required is FALSE!');
        console.log('   This means validation is being skipped!');
      } else if (testEvent.qualification_source !== 'REGIONAL') {
        console.log(`   ⚠️  ISSUE FOUND: qualification_source is "${testEvent.qualification_source}", not "REGIONAL"!`);
      } else {
        // Run the actual check
        const hasQual = await sql`
          SELECT DISTINCT p.id
          FROM performances p
          JOIN event_entries ee ON ee.id = p.event_entry_id
          JOIN events e ON e.id = p.event_id
          JOIN scores s ON s.performance_id = p.id
          WHERE (
            ee.eodsa_id = ${eodsaId}
            OR ee.participant_ids::text LIKE ${`%${dancerId}%`}
            OR ee.participant_ids::text LIKE ${`%${eodsaId}%`}
          )
          AND e.event_type = 'REGIONAL_EVENT'
          AND p.scores_published = true
          GROUP BY p.id
          HAVING AVG(
            s.technical_score + s.musical_score + s.performance_score + 
            s.styling_score + s.overall_impression_score
          ) >= ${testEvent.minimum_qualification_score || 75}
          LIMIT 1
        `;
        
        console.log(`   Qualification check result: ${hasQual.length > 0 ? '✅ QUALIFIED' : '❌ NOT QUALIFIED'}`);
        if (hasQual.length === 0) {
          console.log('   ⚠️  ISSUE: Dancer should be blocked but validation might not be running!');
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  }
}

debugQualification()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
