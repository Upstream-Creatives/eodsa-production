// Quick script to check current payment status and identify issues
const { neon } = require('@neondatabase/serverless');

async function checkPaymentStatus() {
  const sql = neon(process.env.DATABASE_URL);

  console.log('📊 PAYMENT SYSTEM STATUS CHECK\n');

  // 1. Recent successful payments
  const recentPayments = await sql`
    SELECT 
      payment_id, 
      amount, 
      status, 
      payment_status, 
      paid_at,
      description
    FROM payments 
    WHERE created_at >= NOW() - INTERVAL '24 hours'
    ORDER BY created_at DESC
    LIMIT 10
  `;

  console.log(`💰 Last 24 hours: ${recentPayments.length} payments`);
  recentPayments.forEach(p => {
    console.log(`   ${p.payment_id}: R${p.amount} - ${p.status}/${p.payment_status}`);
  });

  // 2. Successful payments without entries
  const orphanedPayments = await sql`
    SELECT COUNT(*) as count
    FROM payments p
    LEFT JOIN event_entries ee ON ee.payment_id = p.payment_id
    WHERE p.status = 'completed' 
      AND p.payment_status = 'COMPLETE'
      AND ee.id IS NULL
  `;

  console.log(`\n🚨 Successful payments WITHOUT entries: ${orphanedPayments[0].count}`);

  // 3. Recent entries
  const recentEntries = await sql`
    SELECT COUNT(*) as count
    FROM event_entries 
    WHERE submitted_at >= NOW() - INTERVAL '24 hours'
  `;

  console.log(`📝 Entries created last 24h: ${recentEntries[0].count}`);

  // 4. Payment status breakdown
  const statusBreakdown = await sql`
    SELECT status, payment_status, COUNT(*) as count
    FROM payments
    WHERE created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY status, payment_status
    ORDER BY count DESC
  `;

  console.log('\n📈 Payment Status Breakdown (24h):');
  statusBreakdown.forEach(s => {
    console.log(`   ${s.status}/${s.payment_status}: ${s.count}`);
  });
}

checkPaymentStatus().catch(console.error);
