// 🚨 URGENT: Recovery script for missing entries after successful payments
// This fixes entries that should have been created but weren't due to the payment bug

const { neon } = require('@neondatabase/serverless');

async function recoverMissingEntries() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const sql = neon(DATABASE_URL);

  try {
    console.log('🔍 Scanning for successful payments without entries...');

    // Find successful payments that don't have corresponding entries
    const orphanedPayments = await sql`
      SELECT 
        p.payment_id,
        p.event_id, 
        p.user_id,
        p.amount,
        p.description,
        p.paid_at,
        p.raw_response,
        COUNT(ee.id) as entry_count
      FROM payments p
      LEFT JOIN event_entries ee ON ee.payment_id = p.payment_id
      WHERE p.status = 'completed' 
        AND p.payment_status = 'COMPLETE'
        AND p.paid_at IS NOT NULL
      GROUP BY p.payment_id, p.event_id, p.user_id, p.amount, p.description, p.paid_at, p.raw_response
      HAVING COUNT(ee.id) = 0
      ORDER BY p.paid_at DESC
    `;

    if (orphanedPayments.length === 0) {
      console.log('✅ No missing entries found - all payments have corresponding entries!');
      return;
    }

    console.log(`🚨 Found ${orphanedPayments.length} successful payments WITHOUT entries!`);
    console.log('\n📋 AFFECTED PAYMENTS:');
    
    orphanedPayments.forEach((payment, index) => {
      console.log(`${index + 1}. Payment ID: ${payment.payment_id}`);
      console.log(`   Amount: R${payment.amount}`);
      console.log(`   Paid: ${payment.paid_at}`);
      console.log(`   Description: ${payment.description}`);
      console.log(`   User ID: ${payment.user_id}`);
      console.log('   ---');
    });

    // Check if we have pending entries data for any of these payments
    const paymentsWithData = await sql`
      SELECT payment_id, pending_entries_data 
      FROM payments 
      WHERE payment_id = ANY(${orphanedPayments.map(p => p.payment_id)})
        AND pending_entries_data IS NOT NULL
    `;

    console.log(`\n🔄 Found ${paymentsWithData.length} payments with recoverable entry data`);

    // Auto-recover entries where we have the data
    let recoveredCount = 0;
    const { db } = require('../lib/database.ts');

    for (const payment of paymentsWithData) {
      try {
        console.log(`\n🛠️  RECOVERING entries for payment: ${payment.payment_id}`);
        
        const entriesData = JSON.parse(payment.pending_entries_data);
        
        if (!Array.isArray(entriesData) || entriesData.length === 0) {
          console.log(`   ⚠️  No valid entries data found`);
          continue;
        }

        console.log(`   📝 Creating ${entriesData.length} missing entries...`);
        
        for (let i = 0; i < entriesData.length; i++) {
          const entry = entriesData[i];
          
          try {
            console.log(`      ➤ Creating entry ${i + 1}: ${entry.itemName}`);
            
            const eventEntry = await db.createEventEntry({
              eventId: entry.eventId,
              contestantId: entry.contestantId,
              eodsaId: entry.eodsaId,
              participantIds: entry.participantIds,
              calculatedFee: entry.calculatedFee,
              paymentStatus: 'paid',
              paymentMethod: 'payfast',
              approved: true,
              qualifiedForNationals: true,
              itemNumber: undefined,
              itemName: entry.itemName,
              choreographer: entry.choreographer,
              mastery: entry.mastery,
              itemStyle: entry.itemStyle,
              estimatedDuration: entry.estimatedDuration,
              entryType: entry.entryType || 'live',
              musicFileUrl: entry.musicFileUrl || undefined,
              musicFileName: entry.musicFileName || undefined,
              videoFileUrl: undefined,
              videoFileName: undefined,
              videoExternalUrl: entry.videoExternalUrl || undefined,
              videoExternalType: (entry.videoExternalType && ['youtube', 'vimeo', 'other'].includes(entry.videoExternalType)) 
                ? entry.videoExternalType 
                : undefined
            });

            // Link entry to payment
            await sql`
              UPDATE event_entries 
              SET payment_id = ${payment.payment_id}
              WHERE id = ${eventEntry.id}
            `;

            console.log(`      ✅ Created entry ${eventEntry.id}`);
            recoveredCount++;
            
          } catch (error) {
            console.error(`      ❌ Failed to create entry ${i + 1}:`, error.message);
          }
        }
        
        // Log the recovery
        await sql`
          INSERT INTO payment_logs (payment_id, event_type, event_data, ip_address, user_agent)
          VALUES (
            ${payment.payment_id}, 'entries_recovered',
            ${JSON.stringify({
              recovered_count: entriesData.length,
              recovery_time: new Date().toISOString(),
              source: 'recovery_script'
            })},
            'recovery_script', 'recovery_script'
          )
        `;
        
      } catch (error) {
        console.error(`❌ Failed to recover payment ${payment.payment_id}:`, error);
      }
    }

    // For payments without data, we need manual intervention
    const paymentsNeedingManualFix = orphanedPayments.filter(
      op => !paymentsWithData.find(pwd => pwd.payment_id === op.payment_id)
    );

    if (paymentsNeedingManualFix.length > 0) {
      console.log(`\n⚠️  ${paymentsNeedingManualFix.length} payments need MANUAL RECOVERY:`);
      console.log('These payments don\'t have stored entry data and need to be handled manually:');
      
      paymentsNeedingManualFix.forEach((payment, index) => {
        console.log(`\n${index + 1}. MANUAL FIX NEEDED:`);
        console.log(`   Payment ID: ${payment.payment_id}`);
        console.log(`   Amount: R${payment.amount}`);
        console.log(`   User ID: ${payment.user_id}`);
        console.log(`   Paid: ${payment.paid_at}`);
        console.log(`   → Contact this user to recreate their entries`);
        console.log(`   → Or create entries manually in admin panel`);
      });
    }

    console.log(`\n🎉 RECOVERY COMPLETE!`);
    console.log(`✅ Auto-recovered: ${recoveredCount} entries`);
    console.log(`⚠️  Need manual fix: ${paymentsNeedingManualFix.length} payments`);
    console.log(`\n💡 All new payments will now work correctly with the bug fix!`);

  } catch (error) {
    console.error('💥 Recovery script error:', error);
    process.exit(1);
  }
}

// Run the recovery
console.log('🚨 STARTING URGENT PAYMENT RECOVERY...');
recoverMissingEntries();
