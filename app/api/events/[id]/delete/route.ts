// Delete Event API
// DELETE /api/events/[id]/delete

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;

    if (!eventId) {
      return NextResponse.json({
        success: false,
        error: 'Event ID is required'
      }, { status: 400 });
    }

    // First, check if the event exists and get its details
    const [event] = await sql`
      SELECT id, name, status, created_at 
      FROM events 
      WHERE id = ${eventId}
    `;

    if (!event) {
      return NextResponse.json({
        success: false,
        error: 'Event not found'
      }, { status: 404 });
    }

    // Check if event has any entries
    const [entryCount] = await sql`
      SELECT COUNT(*) as count 
      FROM event_entries 
      WHERE event_id = ${eventId}
    `;

    const hasEntries = parseInt(entryCount.count) > 0;

    // Check if event has any payments
    const [paymentCount] = await sql`
      SELECT COUNT(*) as count 
      FROM payments 
      WHERE event_id = ${eventId}
    `;

    const hasPayments = parseInt(paymentCount.count) > 0;

    // Get confirmation from request body
    const body = await request.json().catch(() => ({}));
    const { confirmed, force } = body;

    // If event has entries or payments, require confirmation
    if ((hasEntries || hasPayments) && !confirmed && !force) {
      return NextResponse.json({
        success: false,
        error: 'Event has entries or payments and requires confirmation',
        details: {
          eventName: event.name,
          entryCount: parseInt(entryCount.count),
          paymentCount: parseInt(paymentCount.count),
          requiresConfirmation: true
        }
      }, { status: 400 });
    }

    console.log(`🗑️ Deleting event: ${event.name} (ID: ${eventId})`);
    console.log(`   - Entries: ${entryCount.count}`);
    console.log(`   - Payments: ${paymentCount.count}`);

    // Start transaction - delete in correct order to respect foreign keys
    
    // 1. Delete payment logs first
    if (hasPayments) {
      await sql`
        DELETE FROM payment_logs 
        WHERE payment_id IN (
          SELECT payment_id FROM payments WHERE event_id = ${eventId}
        )
      `;
      console.log('✅ Deleted payment logs');
    }

    // 2. Delete payments
    if (hasPayments) {
      await sql`DELETE FROM payments WHERE event_id = ${eventId}`;
      console.log('✅ Deleted payments');
    }

    // 3. Delete performances (if any)
    await sql`DELETE FROM performances WHERE event_id = ${eventId}`;
    console.log('✅ Deleted performances');

    // 4. Delete event entries
    if (hasEntries) {
      await sql`DELETE FROM event_entries WHERE event_id = ${eventId}`;
      console.log('✅ Deleted event entries');
    }

    // 5. Delete event judges (if table exists)
    try {
      await sql`DELETE FROM event_judges WHERE event_id = ${eventId}`;
      console.log('✅ Deleted event judges');
    } catch (judgeError: any) {
      if (judgeError.code === '42P01') {
        console.log('ℹ️ event_judges table does not exist - skipping');
      } else {
        throw judgeError;
      }
    }

    // 6. Finally, delete the event itself
    await sql`DELETE FROM events WHERE id = ${eventId}`;
    console.log('✅ Deleted event');

    // Log the deletion
    console.log(`🗑️ Event "${event.name}" (${eventId}) deleted successfully`);

    return NextResponse.json({
      success: true,
      message: `Event "${event.name}" deleted successfully`,
      details: {
        eventId,
        eventName: event.name,
        entriesDeleted: parseInt(entryCount.count),
        paymentsDeleted: parseInt(paymentCount.count)
      }
    });

  } catch (error: any) {
    console.error('💥 Error deleting event:', error);
    
    // Check if it's a foreign key constraint error
    if (error.message?.includes('foreign key constraint')) {
      return NextResponse.json({
        success: false,
        error: 'Cannot delete event due to database constraints. Please contact support.',
        details: error.message
      }, { status: 409 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to delete event',
      details: error.message
    }, { status: 500 });
  }
}

// Also handle POST for compatibility
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return DELETE(request, { params });
}
