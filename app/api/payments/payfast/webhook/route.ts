// PayFast Webhook Handler
// POST /api/payments/payfast/webhook
// Handles PayFast payment notifications (ITN - Instant Transaction Notification)

import { NextRequest, NextResponse } from 'next/server';
import { verifyPayFastSignature, validatePayFastHost, PayFastWebhookData } from '@/lib/payfast';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: NextRequest) {
  try {
    // Get client IP for validation
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';

    console.log(`🔔 PayFast webhook received from IP: ${clientIP}`);

    // Validate PayFast host (security check)
    if (!await validatePayFastHost(clientIP)) {
      console.warn(`⚠️ Invalid PayFast host: ${clientIP}`);
      return NextResponse.json({ error: 'Invalid host' }, { status: 403 });
    }

    // Parse form data from PayFast
    const formData = await request.formData();
    const webhookData: Partial<PayFastWebhookData> = {};
    
    formData.forEach((value, key) => {
      const stringValue = value.toString();
      
      // Type-safe assignment for webhook data
      switch (key) {
        case 'payment_status':
          if (['COMPLETE', 'FAILED', 'CANCELLED'].includes(stringValue)) {
            webhookData.payment_status = stringValue as 'COMPLETE' | 'FAILED' | 'CANCELLED';
          }
          break;
        case 'm_payment_id':
          webhookData.m_payment_id = stringValue;
          break;
        case 'pf_payment_id':
          webhookData.pf_payment_id = stringValue;
          break;
        case 'signature':
          webhookData.signature = stringValue;
          break;
        case 'item_name':
          webhookData.item_name = stringValue;
          break;
        case 'item_description':
          webhookData.item_description = stringValue;
          break;
        case 'amount_gross':
          webhookData.amount_gross = stringValue;
          break;
        case 'amount_fee':
          webhookData.amount_fee = stringValue;
          break;
        case 'amount_net':
          webhookData.amount_net = stringValue;
          break;
        case 'custom_str1':
          webhookData.custom_str1 = stringValue;
          break;
        case 'custom_str2':
          webhookData.custom_str2 = stringValue;
          break;
        case 'custom_str3':
          webhookData.custom_str3 = stringValue;
          break;
        case 'custom_int1':
          webhookData.custom_int1 = stringValue;
          break;
        case 'name_first':
          webhookData.name_first = stringValue;
          break;
        case 'name_last':
          webhookData.name_last = stringValue;
          break;
        case 'email_address':
          webhookData.email_address = stringValue;
          break;
        case 'merchant_id':
          webhookData.merchant_id = stringValue;
          break;
        default:
          // Ignore unknown fields
          break;
      }
    });

    console.log('📝 PayFast webhook data:', webhookData);

    // Validate required fields
    if (!webhookData.m_payment_id || !webhookData.payment_status || !webhookData.signature) {
      console.error('❌ Missing required webhook fields');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify PayFast signature
    if (!verifyPayFastSignature(webhookData as PayFastWebhookData)) {
      console.error('❌ Invalid PayFast signature');
      
      // Log failed verification attempt
      await sql`
        INSERT INTO payment_logs (payment_id, event_type, event_data, ip_address, user_agent)
        VALUES (
          ${webhookData.m_payment_id}, 'verification_failed',
          ${JSON.stringify({ error: 'Invalid signature', webhookData })},
          ${clientIP}, ${request.headers.get('user-agent') || 'unknown'}
        )
      `;
      
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // Find the payment record
    const [payment] = await sql`
      SELECT * FROM payments WHERE payment_id = ${webhookData.m_payment_id}
    `;

    if (!payment) {
      console.error(`❌ Payment not found: ${webhookData.m_payment_id}`);
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Log webhook received
    await sql`
      INSERT INTO payment_logs (payment_id, event_type, event_data, ip_address, user_agent)
      VALUES (
        ${webhookData.m_payment_id}, 'webhook_received',
        ${JSON.stringify(webhookData)},
        ${clientIP}, ${request.headers.get('user-agent') || 'unknown'}
      )
    `;

    // Update payment record with PayFast data
    const updatedStatus = webhookData.payment_status === 'COMPLETE' ? 'completed' : 
                         webhookData.payment_status === 'FAILED' ? 'failed' : 
                         webhookData.payment_status === 'CANCELLED' ? 'cancelled' : 'processing';

    await sql`
      UPDATE payments SET
        status = ${updatedStatus},
        payment_status = ${webhookData.payment_status},
        pf_payment_id = ${webhookData.pf_payment_id},
        amount_gross = ${parseFloat(webhookData.amount_gross || '0')},
        amount_fee = ${parseFloat(webhookData.amount_fee || '0')},
        amount_net = ${parseFloat(webhookData.amount_net || '0')},
        signature = ${webhookData.signature},
        raw_response = ${JSON.stringify(webhookData)},
        updated_at = CURRENT_TIMESTAMP,
        paid_at = ${updatedStatus === 'completed' ? 'CURRENT_TIMESTAMP' : null}
      WHERE payment_id = ${webhookData.m_payment_id}
    `;

    // Update entry payment status and auto-approve if payment is completed
    const entryPaymentStatus = updatedStatus === 'completed' ? 'paid' : 
                              updatedStatus === 'failed' ? 'failed' : 
                              updatedStatus === 'cancelled' ? 'cancelled' : 'pending';

    if (updatedStatus === 'completed') {
      // AUTO-APPROVE: When payment is completed, automatically approve the entries
      await sql`
        UPDATE event_entries SET
          payment_status = ${entryPaymentStatus},
          approved = true,
          approved_at = CURRENT_TIMESTAMP
        WHERE payment_id = ${webhookData.m_payment_id}
      `;
    } else {
      await sql`
        UPDATE event_entries SET
          payment_status = ${entryPaymentStatus}
        WHERE payment_id = ${webhookData.m_payment_id}
      `;
    }

    // Log payment status update
    await sql`
      INSERT INTO payment_logs (payment_id, event_type, event_data, ip_address, user_agent)
      VALUES (
        ${webhookData.m_payment_id}, 'status_updated',
        ${JSON.stringify({
          old_status: payment.status,
          new_status: updatedStatus,
          payment_status: webhookData.payment_status,
          entry_status: entryPaymentStatus
        })},
        ${clientIP}, ${request.headers.get('user-agent') || 'unknown'}
      )
    `;

    // Handle successful payment
    if (updatedStatus === 'completed') {
      console.log(`✅ Payment completed: ${webhookData.m_payment_id}`);
      console.log(`🎯 Auto-approving entries for payment: ${webhookData.m_payment_id}`);
      
      // You can add additional logic here:
      // - Send confirmation email
      // - Trigger entry confirmation
      // - Update contestant status
      // - Emit real-time updates via socket

      // Log successful completion
      await sql`
        INSERT INTO payment_logs (payment_id, event_type, event_data, ip_address, user_agent)
        VALUES (
          ${webhookData.m_payment_id}, 'completed',
          ${JSON.stringify({
            amount_paid: webhookData.amount_net,
            entry_id: payment.entry_id,
            event_id: payment.event_id
          })},
          ${clientIP}, ${request.headers.get('user-agent') || 'unknown'}
        )
      `;

    } else if (updatedStatus === 'failed' || updatedStatus === 'cancelled') {
      console.log(`❌ Payment ${updatedStatus}: ${webhookData.m_payment_id}`);
      
      // Log failure/cancellation
      await sql`
        INSERT INTO payment_logs (payment_id, event_type, event_data, ip_address, user_agent)
        VALUES (
          ${webhookData.m_payment_id}, ${updatedStatus},
          ${JSON.stringify({
            reason: webhookData.payment_status,
            entry_id: payment.entry_id,
            event_id: payment.event_id
          })},
          ${clientIP}, ${request.headers.get('user-agent') || 'unknown'}
        )
      `;
    }

    // Return success response to PayFast
    return NextResponse.json({ 
      success: true, 
      message: 'Webhook processed successfully',
      payment_id: webhookData.m_payment_id,
      status: updatedStatus
    });

  } catch (error) {
    console.error('💥 PayFast webhook error:', error);
    
    // Log error
    try {
      await sql`
        INSERT INTO payment_logs (payment_id, event_type, event_data, ip_address, user_agent)
        VALUES (
          'unknown', 'webhook_error',
          ${JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' })},
          ${request.headers.get('x-forwarded-for') || 'unknown'},
          ${request.headers.get('user-agent') || 'unknown'}
        )
      `;
    } catch (logError) {
      console.error('Failed to log webhook error:', logError);
    }

    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// PayFast also sends GET requests to validate the webhook URL
export async function GET(request: NextRequest) {
  console.log('🔍 PayFast webhook validation GET request received');
  
  // Return simple success response for validation
  return NextResponse.json({
    success: true,
    message: 'PayFast webhook endpoint is active',
    timestamp: new Date().toISOString()
  });
}
