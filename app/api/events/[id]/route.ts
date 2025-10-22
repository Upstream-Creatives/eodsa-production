import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const eventId = id;
    const event = await db.getEventById(eventId);
    
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      event
    });
  } catch (error) {
    console.error('Error fetching event:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch event' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const eventId = id;
    const body = await request.json();

    // Admin authentication check
    const authHeader = request.headers.get('authorization');
    if (!authHeader && !body.adminSession) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // If adminSession is provided in body (for client-side requests)
    if (body.adminSession) {
      try {
        const adminData = typeof body.adminSession === 'string' ? 
          JSON.parse(body.adminSession) : body.adminSession;
        
        if (!adminData.isAdmin) {
          return NextResponse.json(
            { success: false, error: 'Admin privileges required' },
            { status: 403 }
          );
        }
      } catch (sessionError) {
        return NextResponse.json(
          { success: false, error: 'Invalid admin session' },
          { status: 401 }
        );
      }
    }

    // First check if event exists
    const [existingEvent] = await sql`
      SELECT id, name FROM events WHERE id = ${eventId}
    `;

    if (!existingEvent) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Validate required fields for update
    const allowedFields = [
      'name', 'description', 'region', 'ageCategory', 'performanceType',
      'eventDate', 'eventEndDate', 'registrationDeadline', 'venue', 'entryFee', 
      'maxParticipants', 'status', 'registrationFeePerDancer', 'solo1Fee', 'solo2Fee',
      'solo3Fee', 'soloAdditionalFee', 'duoTrioFeePerDancer', 'groupFeePerDancer',
      'largeGroupFeePerDancer', 'currency'
    ];

    // Filter only allowed fields from the request body
    const updateData: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // If no valid fields provided
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields provided for update' },
        { status: 400 }
      );
    }

    // Validate date logic if dates are being updated
    if (updateData.eventDate || updateData.registrationDeadline) {
      const eventDate = new Date(updateData.eventDate || existingEvent.event_date);
      const registrationDeadline = new Date(updateData.registrationDeadline || existingEvent.registration_deadline);
      
      if (registrationDeadline >= eventDate) {
        return NextResponse.json(
          { success: false, error: 'Registration deadline must be before event date' },
          { status: 400 }
        );
      }
    }

    // Build update object for each field with proper camelCase to snake_case conversion
    const updates: Record<string, any> = {};
    
    // Manual mapping for fee fields to ensure correct snake_case conversion
    const fieldMapping: Record<string, string> = {
      'registrationFeePerDancer': 'registration_fee_per_dancer',
      'solo1Fee': 'solo_1_fee',
      'solo2Fee': 'solo_2_fee',
      'solo3Fee': 'solo_3_fee',
      'soloAdditionalFee': 'solo_additional_fee',
      'duoTrioFeePerDancer': 'duo_trio_fee_per_dancer',
      'groupFeePerDancer': 'group_fee_per_dancer',
      'largeGroupFeePerDancer': 'large_group_fee_per_dancer',
    };
    
    Object.entries(updateData).forEach(([key, value]) => {
      // Use manual mapping if available, otherwise use regex conversion
      const dbField = fieldMapping[key] || key.replace(/([A-Z])/g, '_$1').toLowerCase();
      updates[dbField] = value;
    });

    console.log('📝 Update data received:', updateData);
    console.log('🔄 Converted to DB fields:', updates);
    console.log('🔍 Fee fields specifically:');
    console.log('  - solo1Fee (received):', updateData.solo1Fee, 'type:', typeof updateData.solo1Fee);
    console.log('  - solo_1_fee (converted):', updates.solo_1_fee, 'type:', typeof updates.solo_1_fee);

    // Execute single update query with all fields that match database schema
    // Use !== undefined to allow 0 values
    const updatedEvent = await sql`
      UPDATE events 
      SET 
        name = COALESCE(${updates.name !== undefined ? updates.name : null}, name),
        description = COALESCE(${updates.description !== undefined ? updates.description : null}, description),
        region = COALESCE(${updates.region !== undefined ? updates.region : null}, region),
        age_category = COALESCE(${updates.age_category !== undefined ? updates.age_category : null}, age_category),
        performance_type = COALESCE(${updates.performance_type !== undefined ? updates.performance_type : null}, performance_type),
        event_date = COALESCE(${updates.event_date !== undefined ? updates.event_date : null}, event_date),
        event_end_date = COALESCE(${updates.event_end_date !== undefined ? updates.event_end_date : null}, event_end_date),
        registration_deadline = COALESCE(${updates.registration_deadline !== undefined ? updates.registration_deadline : null}, registration_deadline),
        venue = COALESCE(${updates.venue !== undefined ? updates.venue : null}, venue),
        status = COALESCE(${updates.status !== undefined ? updates.status : null}, status),
        max_participants = COALESCE(${updates.max_participants !== undefined ? updates.max_participants : null}, max_participants),
        entry_fee = COALESCE(${updates.entry_fee !== undefined ? updates.entry_fee : null}, entry_fee),
        payment_required = COALESCE(${updates.payment_required !== undefined ? updates.payment_required : null}, payment_required),
        registration_fee_per_dancer = COALESCE(${updates.registration_fee_per_dancer !== undefined ? updates.registration_fee_per_dancer : null}, registration_fee_per_dancer),
        solo_1_fee = COALESCE(${updates.solo_1_fee !== undefined ? updates.solo_1_fee : null}, solo_1_fee),
        solo_2_fee = COALESCE(${updates.solo_2_fee !== undefined ? updates.solo_2_fee : null}, solo_2_fee),
        solo_3_fee = COALESCE(${updates.solo_3_fee !== undefined ? updates.solo_3_fee : null}, solo_3_fee),
        solo_additional_fee = COALESCE(${updates.solo_additional_fee !== undefined ? updates.solo_additional_fee : null}, solo_additional_fee),
        duo_trio_fee_per_dancer = COALESCE(${updates.duo_trio_fee_per_dancer !== undefined ? updates.duo_trio_fee_per_dancer : null}, duo_trio_fee_per_dancer),
        group_fee_per_dancer = COALESCE(${updates.group_fee_per_dancer !== undefined ? updates.group_fee_per_dancer : null}, group_fee_per_dancer),
        large_group_fee_per_dancer = COALESCE(${updates.large_group_fee_per_dancer !== undefined ? updates.large_group_fee_per_dancer : null}, large_group_fee_per_dancer),
        currency = COALESCE(${updates.currency !== undefined ? updates.currency : null}, currency)
      WHERE id = ${eventId}
      RETURNING *
    `;

    const eventRecord = updatedEvent[0];
    console.log(`✅ Event updated: ${eventRecord.name} (ID: ${eventId})`);

    return NextResponse.json({
      success: true,
      message: 'Event updated successfully',
      event: eventRecord
    });

  } catch (error: any) {
    console.error('Error updating event:', error);
    
    if (error.message?.includes('foreign key constraint')) {
      return NextResponse.json(
        { success: false, error: 'Invalid reference data provided' },
        { status: 400 }
      );
    }
    
    if (error.message?.includes('CHECK constraint')) {
      return NextResponse.json(
        { success: false, error: 'Invalid data format provided' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to update event' },
      { status: 500 }
    );
  }
} 