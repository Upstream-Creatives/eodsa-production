import { NextResponse } from 'next/server';
import { db, unifiedDb } from '@/lib/database';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Before doing anything, ensure the payment reference columns exist
    await unifiedDb.addPaymentReferenceColumns();
    
    const { id } = await params;
    const entryId = id;
    
    const body = await request.json();
    const { paymentStatus, paymentReference, paymentMethod, adminId } = body;
    
    // Verify admin authentication
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: 'Admin ID required' },
        { status: 400 }
      );
    }

    // Verify the user is actually an admin
    const admin = await db.getJudgeById(adminId);
    if (!admin || !admin.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }
    
    // Get the current entry to verify it exists
    const allEntries = await db.getAllEventEntries();
    const entry = allEntries.find(e => e.id === entryId);
    
    if (!entry) {
      return NextResponse.json(
        { success: false, error: 'Event entry not found' },
        { status: 404 }
      );
    }

    // Prepare the updates
    const updates: any = {};
    
    if (paymentStatus !== undefined) {
      updates.paymentStatus = paymentStatus;
      
      // If marking as paid, set payment date to now
      if (paymentStatus === 'paid') {
        updates.paymentDate = new Date().toISOString();
      }
    }
    
    if (paymentReference !== undefined) {
      updates.paymentReference = paymentReference;
    }
    
    if (paymentMethod !== undefined) {
      updates.paymentMethod = paymentMethod;
    }

    // Update the entry
    await db.updateEventEntry(entryId, updates);

    // Calculate outstanding balance
    const outstandingBalance = entry.paymentStatus === 'paid' ? 0 : entry.calculatedFee;

    return NextResponse.json({
      success: true,
      message: `Payment information updated successfully`,
      entry: {
        ...entry,
        ...updates
      },
      outstandingBalance
    });
    
  } catch (error) {
    console.error('Error updating payment information:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update payment information' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Ensure the payment reference columns exist
    await unifiedDb.addPaymentReferenceColumns();
    
    const { id } = await params;
    const entryId = id;
    
    // Get the entry
    const allEntries = await db.getAllEventEntries();
    const entry = allEntries.find(e => e.id === entryId);
    
    if (!entry) {
      return NextResponse.json(
        { success: false, error: 'Event entry not found' },
        { status: 404 }
      );
    }

    // Calculate outstanding balance
    const outstandingBalance = entry.paymentStatus === 'paid' ? 0 : entry.calculatedFee;

    return NextResponse.json({
      success: true,
      entry,
      paymentInfo: {
        status: entry.paymentStatus,
        method: entry.paymentMethod,
        reference: entry.paymentReference,
        date: entry.paymentDate,
        amount: entry.calculatedFee,
        outstandingBalance
      }
    });
    
  } catch (error) {
    console.error('Error getting payment information:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get payment information' },
      { status: 500 }
    );
  }
}