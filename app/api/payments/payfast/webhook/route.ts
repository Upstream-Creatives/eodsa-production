// PayFast Webhook Handler
// POST /api/payments/payfast/webhook
// Handles PayFast payment notifications (ITN - Instant Transaction Notification)

import { NextRequest, NextResponse } from 'next/server';
import { validatePayFastHost, PayFastWebhookData, PAYFAST_CONFIG } from '@/lib/payfast';
import crypto from 'crypto';
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

    // Compute signature from RAW body to preserve exact param order and encoding
    const rawClone = request.clone();
    const rawBody = await rawClone.text();

    // Extract received signature and rebuild the parameter string WITHOUT the signature
    const receivedSignature = (new URLSearchParams(rawBody)).get('signature') || '';
    const pfParamString = rawBody
      .split('&')
      .filter(pair => !pair.toLowerCase().startsWith('signature='))
      .join('&');

    // Append passphrase if configured
    const stringToHash = PAYFAST_CONFIG.passphrase
      ? `${pfParamString}&passphrase=${encodeURIComponent(PAYFAST_CONFIG.passphrase.trim()).replace(/%20/g, '+')}`
      : pfParamString;
    const calculatedSignature = crypto.createHash('md5').update(stringToHash).digest('hex');

    // Early reject if signature doesn't match
    if (calculatedSignature !== receivedSignature) {
      console.error('❌ Invalid PayFast signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
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

    // Signature already validated using raw body above

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
        paid_at = ${updatedStatus === 'completed' ? new Date() : null}
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
          approved = true
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
      
      // Check if this is a batch payment with pending entries that need to be created
      const pendingEntries = await sql`
        SELECT pending_entries_data FROM payments 
        WHERE payment_id = ${webhookData.m_payment_id} 
        AND pending_entries_data IS NOT NULL
      `;

      if (pendingEntries.length > 0 && pendingEntries[0].pending_entries_data) {
        console.log(`🔄 Creating entries automatically for batch payment: ${webhookData.m_payment_id}`);
        
        try {
          const rawPending = pendingEntries[0].pending_entries_data as any;
          const entriesData = typeof rawPending === 'string' ? JSON.parse(rawPending) : rawPending;
          if (!Array.isArray(entriesData)) {
            throw new Error('pending_entries_data is not an array');
          }
          
          // Import the database module to create entries
          const { db } = await import('@/lib/database');
          
          const createdEntries = [];
          
          // Create each entry
          for (let i = 0; i < entriesData.length; i++) {
            const entry = entriesData[i];
            
            try {
              console.log(`📝 Auto-creating entry ${i + 1}/${entriesData.length}: ${entry.itemName}`);
              
              // Create event entry with payment reference
              const eventEntry = await db.createEventEntry({
                eventId: entry.eventId,
                contestantId: entry.contestantId,
                eodsaId: entry.eodsaId,
                participantIds: entry.participantIds,
                calculatedFee: entry.calculatedFee,
                paymentStatus: 'paid', // Mark as paid since payment was successful
                paymentMethod: 'payfast',
                approved: true, // AUTO-APPROVE: Entries are automatically approved after successful payment
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
                  ? entry.videoExternalType as 'youtube' | 'vimeo' | 'other' 
                  : undefined
              });

              // Update the entry with payment ID
              await sql`
                UPDATE event_entries 
                SET payment_id = ${webhookData.m_payment_id}
                WHERE id = ${eventEntry.id}
              `;

              createdEntries.push({
                entryId: eventEntry.id,
                itemName: entry.itemName,
                performanceType: entry.performanceType,
                fee: entry.calculatedFee
              });
              
              console.log(`✅ Auto-created entry ${eventEntry.id} successfully`);
              
            } catch (error: any) {
              console.error(`❌ Error auto-creating entry ${i + 1}:`, error);
            }
          }
          
          // Log the automatic entry creation
          await sql`
            INSERT INTO payment_logs (payment_id, event_type, event_data, ip_address, user_agent)
            VALUES (
              ${webhookData.m_payment_id}, 'auto_entries_created',
              ${JSON.stringify({
                created_count: createdEntries.length,
                entries: createdEntries,
                source: 'webhook_auto_creation'
              })},
              ${clientIP}, ${request.headers.get('user-agent') || 'webhook'}
            )
          `;
          
          console.log(`🎉 Successfully auto-created ${createdEntries.length} entries for payment ${webhookData.m_payment_id}`);
          
        } catch (error) {
          console.error(`💥 Failed to auto-create entries for payment ${webhookData.m_payment_id}:`, error);
          
          // Log the error
          await sql`
            INSERT INTO payment_logs (payment_id, event_type, event_data, ip_address, user_agent)
            VALUES (
              ${webhookData.m_payment_id}, 'auto_creation_failed',
              ${JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' })},
              ${clientIP}, ${request.headers.get('user-agent') || 'webhook'}
            )
          `;
        }
      }
      
      // Additional logic:
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
