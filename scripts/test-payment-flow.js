// Test script to verify payment system is working correctly
const { neon } = require('@neondatabase/serverless');

async function testPaymentFlow() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const sql = neon(DATABASE_URL);

  try {
    console.log('🧪 PAYMENT SYSTEM TEST REPORT\n');

    // 1. Check if pending_entries_data column exists
    console.log('1️⃣ Checking database schema...');
    const columnCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'payments' AND column_name = 'pending_entries_data'
    `;
    
    if (columnCheck.length > 0) {
      console.log('   ✅ pending_entries_data column exists');
    } else {
      console.log('   ❌ pending_entries_data column MISSING!');
      console.log('   📋 Run: node scripts/add-pending-entries-column.js');
    }

    // 2. Check recent payment activity
    console.log('\n2️⃣ Checking recent payment activity...');
    const recentPayments = await sql`
      SELECT 
        payment_id, 
        status, 
        payment_status, 
        amount,
        CASE WHEN pending_entries_data IS NOT NULL THEN 'YES' ELSE 'NO' END as has_entry_data,
        created_at::date as date
      FROM payments 
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY created_at DESC
      LIMIT 10
    `;

    if (recentPayments.length === 0) {
      console.log('   ℹ️ No recent payments found (last 7 days)');
    } else {
      console.log(`   📊 Found ${recentPayments.length} recent payments:`);
      recentPayments.forEach(p => {
        console.log(`      ${p.payment_id}: ${p.status}/${p.payment_status} - R${p.amount} - Data: ${p.has_entry_data}`);
      });
    }

    // 3. Check entries created by webhook
    console.log('\n3️⃣ Checking webhook-created entries...');
    const webhookEntries = await sql`
      SELECT COUNT(*) as count
      FROM payment_logs 
      WHERE event_type = 'auto_entries_created'
        AND created_at >= CURRENT_DATE - INTERVAL '7 days'
    `;

    console.log(`   🤖 Webhook auto-created entries: ${webhookEntries[0].count}`);

    // 4. Check successful payments vs entries
    console.log('\n4️⃣ Checking payment-entry consistency...');
    const paymentEntryCheck = await sql`
      SELECT 
        COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as completed_payments,
        COUNT(CASE WHEN p.status = 'completed' AND ee.id IS NOT NULL THEN 1 END) as payments_with_entries,
        COUNT(CASE WHEN p.status = 'completed' AND ee.id IS NULL THEN 1 END) as orphaned_payments
      FROM payments p
      LEFT JOIN event_entries ee ON ee.payment_id = p.payment_id
      WHERE p.created_at >= CURRENT_DATE - INTERVAL '7 days'
    `;

    const stats = paymentEntryCheck[0];
    console.log(`   💰 Completed payments: ${stats.completed_payments}`);
    console.log(`   ✅ Payments with entries: ${stats.payments_with_entries}`);
    console.log(`   🚨 Orphaned payments: ${stats.orphaned_payments}`);

    if (stats.orphaned_payments > 0) {
      console.log('   ⚠️ WARNING: Some successful payments have no entries!');
      console.log('   📋 Run recovery script: node scripts/recover-missing-entries.js');
    }

    // 5. PayFast configuration check
    console.log('\n5️⃣ Checking PayFast configuration...');
    const isSandbox = process.env.PAYFAST_SANDBOX === 'true';
    const merchantId = process.env.PAYFAST_MERCHANT_ID || '10000100';
    
    console.log(`   🎯 Mode: ${isSandbox ? 'SANDBOX' : 'PRODUCTION'}`);
    console.log(`   🏪 Merchant ID: ${merchantId}`);
    console.log(`   🔗 Webhook URL: ${process.env.PAYFAST_NOTIFY_URL || 'Not set'}`);

    // 6. System health summary
    console.log('\n🎉 SYSTEM HEALTH SUMMARY:');
    
    const isHealthy = 
      columnCheck.length > 0 && 
      stats.orphaned_payments === 0;

    if (isHealthy) {
      console.log('   ✅ Payment system is HEALTHY');
      console.log('   ✅ Bug fix is ACTIVE');
      console.log('   ✅ Ready for testing');
    } else {
      console.log('   ❌ Payment system needs attention');
      if (columnCheck.length === 0) {
        console.log('   📋 TODO: Add pending_entries_data column');
      }
      if (stats.orphaned_payments > 0) {
        console.log('   📋 TODO: Run recovery script for orphaned payments');
      }
    }

    console.log('\n🧪 TEST INSTRUCTIONS:');
    console.log('1. Set PAYFAST_SANDBOX=true in .env.local');
    console.log('2. Create competition entries');
    console.log('3. Pay via PayFast sandbox');
    console.log('4. Close browser WITHOUT visiting success page');
    console.log('5. Check admin panel - entries should exist!');

  } catch (error) {
    console.error('💥 Test script error:', error);
    process.exit(1);
  }
}

testPaymentFlow();
