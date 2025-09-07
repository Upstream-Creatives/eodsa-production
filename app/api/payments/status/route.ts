// Payment Status API
// GET /api/payments/status?payment_id=xxx

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const paymentId = searchParams.get('payment_id');

    if (!paymentId) {
      return NextResponse.json({
        success: false,
        error: 'Payment ID is required'
      }, { status: 400 });
    }

    // Get payment details with entry and event information (aligning with current schema)
    const [paymentData] = await sql`
      SELECT 
        p.payment_id,
        p.entry_id,
        p.event_id,
        p.amount,
        p.currency,
        p.status,
        p.payment_status,
        p.created_at,
        p.paid_at,
        p.updated_at,
        
        -- Entry details (aligned to schema)
        ee.item_name as entry_title,
        ee.entry_type as performance_type,
        ee.payment_status as entry_payment_status,
        
        -- Event details (safe subset)
        e.name as event_name,
        e.entry_fee,
        
        -- PayFast details
        p.pf_payment_id,
        p.amount_gross,
        p.amount_fee,
        p.amount_net
        
      FROM payments p
      LEFT JOIN event_entries ee ON p.entry_id = ee.id
      LEFT JOIN events e ON p.event_id = e.id
      WHERE p.payment_id = ${paymentId}
    `;

    if (!paymentData) {
      return NextResponse.json({
        success: false,
        error: 'Payment not found'
      }, { status: 404 });
    }

    // Get payment logs for this payment
    const paymentLogs = await sql`
      SELECT event_type, event_data, created_at
      FROM payment_logs
      WHERE payment_id = ${paymentId}
      ORDER BY created_at DESC
      LIMIT 10
    `;

    // Calculate payment timeline
    const timeline = paymentLogs.map(log => ({
      event: log.event_type,
      timestamp: log.created_at,
      data: log.event_data
    }));

    return NextResponse.json({
      success: true,
      payment: {
        payment_id: paymentData.payment_id,
        entry_id: paymentData.entry_id,
        event_id: paymentData.event_id,
        amount: parseFloat(paymentData.amount),
        currency: paymentData.currency,
        status: paymentData.status,
        payment_status: paymentData.payment_status,
        
        // Entry information
        entry_title: paymentData.entry_title,
        performance_type: paymentData.performance_type,
        entry_payment_status: paymentData.entry_payment_status,
        
        // Event information
        event_name: paymentData.event_name,
        
        // Timestamps
        created_at: paymentData.created_at,
        paid_at: paymentData.paid_at,
        updated_at: paymentData.updated_at,
        
        // PayFast details (if available)
        pf_payment_id: paymentData.pf_payment_id,
        amount_gross: paymentData.amount_gross ? parseFloat(paymentData.amount_gross) : null,
        amount_fee: paymentData.amount_fee ? parseFloat(paymentData.amount_fee) : null,
        amount_net: paymentData.amount_net ? parseFloat(paymentData.amount_net) : null,
        
        // Payment timeline
        timeline
      }
    });

  } catch (error) {
    console.error('Payment status error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// Also handle POST for batch status checks
export async function POST(request: NextRequest) {
  try {
    const { payment_ids } = await request.json();

    if (!payment_ids || !Array.isArray(payment_ids)) {
      return NextResponse.json({
        success: false,
        error: 'payment_ids array is required'
      }, { status: 400 });
    }

    // Get multiple payment statuses
    const payments = await sql`
      SELECT 
        p.payment_id,
        p.status,
        p.payment_status,
        p.amount,
        p.created_at,
        p.paid_at,
        ee.title as entry_title,
        e.name as event_name
      FROM payments p
      LEFT JOIN event_entries ee ON p.entry_id = ee.id
      LEFT JOIN events e ON p.event_id = e.id
      WHERE p.payment_id = ANY(${payment_ids})
    `;

    const paymentMap = Object.fromEntries(
      payments.map(p => [
        p.payment_id,
        {
          payment_id: p.payment_id,
          status: p.status,
          payment_status: p.payment_status,
          amount: parseFloat(p.amount),
          entry_title: p.entry_title,
          event_name: p.event_name,
          created_at: p.created_at,
          paid_at: p.paid_at,
        }
      ])
    );

    return NextResponse.json({
      success: true,
      payments: paymentMap
    });

  } catch (error) {
    console.error('Batch payment status error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
