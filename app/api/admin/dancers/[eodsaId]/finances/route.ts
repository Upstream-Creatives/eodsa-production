import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { EODSA_FEES } from '@/lib/types';

// Get comprehensive financial information for a dancer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eodsaId: string }> }
) {
  try {
    const { eodsaId } = await params;
    
    // Get all event entries for this dancer (by EODSA ID)
    const allEntries = await db.getAllEventEntries();
    const dancerEntries = allEntries.filter(entry => entry.eodsaId === eodsaId);
    
    // Calculate total outstanding balance
    let totalOutstanding = 0;
    const eventEntries = [];
    
    for (const entry of dancerEntries) {
      const outstandingAmount = entry.paymentStatus === 'paid' ? 0 : entry.calculatedFee;
      totalOutstanding += outstandingAmount;
      
      // Get event details for context
      const events = await db.getAllEvents();
      const event = events.find(e => e.id === entry.eventId);
      
      eventEntries.push({
        id: entry.id,
        itemName: entry.itemName,
        eventName: event?.name || 'Unknown Event',
        calculatedFee: entry.calculatedFee,
        paymentStatus: entry.paymentStatus,
        paymentReference: entry.paymentReference,
        paymentDate: entry.paymentDate,
        outstandingAmount
      });
    }
    
    // Nationals registration fee amount
    const registrationFeeAmount = EODSA_FEES.REGISTRATION.Nationals;
    
    return NextResponse.json({
      success: true,
      eodsaId,
      eventEntries,
      totalOutstanding,
      registrationFeeAmount,
      summary: {
        totalEventEntries: dancerEntries.length,
        paidEntries: dancerEntries.filter(e => e.paymentStatus === 'paid').length,
        unpaidEntries: dancerEntries.filter(e => e.paymentStatus !== 'paid').length,
        totalEventAmount: dancerEntries.reduce((sum, e) => sum + e.calculatedFee, 0),
        totalOutstanding
      }
    });
    
  } catch (error) {
    console.error('Error fetching dancer finances:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch financial information' },
      { status: 500 }
    );
  }
}