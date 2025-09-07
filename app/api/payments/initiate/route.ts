// PayFast Payment Initiation API
// POST /api/payments/initiate

import { NextRequest, NextResponse } from 'next/server';
import { createPaymentData, createPayFastForm, calculateEntryFees, generatePaymentReference } from '@/lib/payfast';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

interface PaymentRequest {
  entryId: string;
  eventId: string;
  userId: string;
  userFirstName: string;
  userLastName: string;
  userEmail: string;
  amount?: number; // Optional, will use event default if not provided
  itemName?: string;
  itemDescription?: string;
  isBatchPayment?: boolean; // Flag for batch payments where entries don't exist yet
  pendingEntries?: any[]; // For batch payments, store the pending entries data
}

export async function POST(request: NextRequest) {
  try {
    const body: PaymentRequest = await request.json();
    const { entryId, eventId, userId, userFirstName, userLastName, userEmail, amount, itemName, itemDescription, isBatchPayment, pendingEntries } = body;

    // Validate required fields
    if (!entryId || !eventId || !userId || !userFirstName || !userLastName || !userEmail) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 });
    }

    // Get event details to determine payment amount
    const [event] = await sql`
      SELECT id, name, entry_fee, payment_required 
      FROM events 
      WHERE id = ${eventId}
    `;

    if (!event) {
      return NextResponse.json({
        success: false,
        error: 'Event not found'
      }, { status: 404 });
    }

    // Check if payment is required for this event
    if (!event.payment_required) {
      return NextResponse.json({
        success: false,
        error: 'Payment not required for this event'
      }, { status: 400 });
    }

    let entry = null;

    // For batch payments, skip entry lookup since entries don't exist yet
    if (!isBatchPayment) {
      // Get entry details for single entry payments
      const [entryResult] = await sql`
        SELECT id, item_name, payment_status 
        FROM event_entries 
        WHERE id = ${entryId} AND event_id = ${eventId}
      `;

      if (!entryResult) {
        return NextResponse.json({
          success: false,
          error: 'Entry not found'
        }, { status: 404 });
      }

      entry = entryResult;

      // Check if entry is already paid
      if (entry.payment_status === 'paid') {
        return NextResponse.json({
          success: false,
          error: 'Entry already paid'
        }, { status: 400 });
      }
    } else {
      // For batch payments, create a mock entry object
      entry = {
        id: entryId,
        item_name: itemName || 'Competition Entries',
        payment_status: 'unpaid'
      };
    }

    // Calculate payment amount
    const baseAmount = amount || event.entry_fee || 25.00;
    const fees = calculateEntryFees(baseAmount);

    // Build PayFast payment payload FIRST so we use the SAME payment_id everywhere
    const paymentData = createPaymentData({
      entryId,
      eventId,
      userId,
      amount: fees.total,
      userFirstName,
      userLastName,
      userEmail,
      itemName: itemName || `Competition Entry: ${entry.item_name}`,
      itemDescription: itemDescription || `Competition entry for ${event.name} - ${entry.item_name}`,
    });
    const paymentId = paymentData.m_payment_id; // This is what PayFast will post back as m_payment_id

    // Create payment record - exclude entry_id for batch payments to avoid foreign key constraint
    if (isBatchPayment) {
      // For batch payments, store pending entries data in the database for webhook access
      const pendingEntriesJson = pendingEntries ? JSON.stringify(pendingEntries) : null;
      
      await sql`
        INSERT INTO payments (
          payment_id, event_id, user_id, amount, currency,
          description, status, ip_address, user_agent, pending_entries_data
        )
        VALUES (
          ${paymentId}, ${eventId}, ${userId || 'unknown'}, 
          ${fees.total}, 'ZAR',
          ${`Payment for ${paymentData.item_name} - ${event.name}`}, 'pending',
          ${request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'},
          ${request.headers.get('user-agent') || 'unknown'}, ${pendingEntriesJson}
        )
      `;
    } else {
      // For single payments, include entry_id
      await sql`
        INSERT INTO payments (
          payment_id, entry_id, event_id, user_id, amount, currency,
          description, status, ip_address, user_agent
        )
        VALUES (
          ${paymentId}, ${entryId}, ${eventId}, ${userId || 'unknown'}, 
          ${fees.total}, 'ZAR',
          ${`Payment for ${paymentData.item_name} - ${event.name}`}, 'pending',
          ${request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'},
          ${request.headers.get('user-agent') || 'unknown'}
        )
      `;
    }

    // Log payment initiation
    await sql`
      INSERT INTO payment_logs (payment_id, event_type, event_data, ip_address, user_agent)
      VALUES (
        ${paymentId}, 'initiated',
        ${JSON.stringify({
          entryId,
          eventId,
          userId,
          amount: fees.total,
          fees
        })},
        ${request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'},
        ${request.headers.get('user-agent') || 'unknown'}
      )
    `;

    // Update entry with payment reference (skip for batch payments)
    if (!isBatchPayment) {
      await sql`
        UPDATE event_entries 
        SET payment_id = ${paymentId}, payment_status = 'pending'
        WHERE id = ${entryId}
      `;
    }

    // Log redirect to PayFast
    await sql`
      INSERT INTO payment_logs (payment_id, event_type, event_data, ip_address, user_agent)
      VALUES (
        ${paymentId}, 'redirect_sent',
        ${JSON.stringify(paymentData)},
        ${request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'},
        ${request.headers.get('user-agent') || 'unknown'}
      )
    `;

    // Return PayFast form HTML for redirect
    const formHtml = createPayFastForm(paymentData);

    return new NextResponse(formHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
      },
    });

  } catch (error) {
    console.error('Payment initiation error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// Also handle GET requests for direct payment links
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const entryId = searchParams.get('entryId');
  const eventId = searchParams.get('eventId');

  if (!entryId || !eventId) {
    return NextResponse.json({
      success: false,
      error: 'Missing entryId or eventId parameters'
    }, { status: 400 });
  }

  // Get entry and event details from database
  try {
    const [entryData] = await sql`
      SELECT 
        ee.id as entry_id,
        ee.item_name,
        ee.payment_status,
        e.id as event_id,
        e.name as event_name,
        e.entry_fee,
        e.payment_required
      FROM event_entries ee
      JOIN events e ON ee.event_id = e.id
      WHERE ee.id = ${entryId} AND e.id = ${eventId}
    `;

    if (!entryData) {
      return NextResponse.json({
        success: false,
        error: 'Entry not found'
      }, { status: 404 });
    }

    if (!entryData.payment_required) {
      return NextResponse.json({
        success: false,
        error: 'Payment not required for this event'
      }, { status: 400 });
    }

    if (entryData.payment_status === 'paid') {
      return NextResponse.json({
        success: false,
        error: 'Entry already paid'
      }, { status: 400 });
    }

    // Forward to POST with entry data (use defaults for user info)
    return POST(new NextRequest(request.url, {
      method: 'POST',
      body: JSON.stringify({
        entryId: entryData.entry_id,
        eventId: entryData.event_id,
        userId: 'unknown',
        userFirstName: 'Contestant',
        userLastName: 'User',
        userEmail: 'contestant@example.com',
      }),
      headers: request.headers,
    }));

  } catch (error) {
    console.error('Payment GET error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}