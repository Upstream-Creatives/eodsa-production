import { NextResponse } from 'next/server';
import { db, ensureAuditionSchema } from '@/lib/database';
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
    await ensureAuditionSchema(sql as any);

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
      SELECT id, name, event_type, venue, audition_payment_type, audition_flat_fee, event_date, registration_deadline
      FROM events WHERE id = ${eventId}
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
      'largeGroupFeePerDancer', 'currency', 'soloPrice', 'duetPrice', 'groupPrice',
      'discountEnabled', 'discountMinEntries', 'discountAmount', 'registrationFee',
      'participationMode', 'certificateTemplateUrl',
      'eventType', 'eventMode', 'qualificationRequired', 'qualificationSource', 'minimumQualificationScore', 'numberOfJudges',
      'auditionPaymentType', 'auditionFlatFee'
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
      'soloPrice': 'solo_price',
      'duetPrice': 'duet_price',
      'groupPrice': 'group_price',
      'discountEnabled': 'discount_enabled',
      'discountMinEntries': 'discount_min_entries',
      'discountAmount': 'discount_amount',
      'registrationFee': 'registration_fee',
      'participationMode': 'participation_mode',
      'certificateTemplateUrl': 'certificate_template_url',
      'eventType': 'event_type',
      'eventMode': 'event_mode',
      'qualificationRequired': 'qualification_required',
      'qualificationSource': 'qualification_source',
      'minimumQualificationScore': 'minimum_qualification_score',
      'numberOfJudges': 'number_of_judges',
      'auditionPaymentType': 'audition_payment_type',
      'auditionFlatFee': 'audition_flat_fee',
    };
    
    const nextEventType = updateData.eventType || existingEvent.event_type || existingEvent.eventType;
    if (nextEventType !== 'AUDITION_EVENT') {
      delete updateData.auditionPaymentType;
      delete updateData.auditionFlatFee;
    }

    if (nextEventType === 'AUDITION_EVENT') {
      updateData.eventType = 'AUDITION_EVENT';
      updateData.eventMode = 'VIRTUAL';
      updateData.participationMode = 'virtual';
      updateData.qualificationRequired = false;
      updateData.qualificationSource = null;
      updateData.minimumQualificationScore = null;
      updateData.venue = updateData.venue || existingEvent.venue || 'Virtual';
      updateData.discountEnabled = false;
      const paymentType = updateData.auditionPaymentType === 'paid' ? 'paid' : (updateData.auditionPaymentType === 'free' ? 'free' : (existingEvent.audition_payment_type || 'free'));
      updateData.auditionPaymentType = paymentType;
      const flatFee = paymentType === 'paid'
        ? Number(updateData.auditionFlatFee ?? existingEvent.audition_flat_fee ?? 0)
        : 0;
      if (paymentType === 'paid' && flatFee <= 0) {
        return NextResponse.json(
          { success: false, error: 'Paid auditions need a flat entry amount greater than zero' },
          { status: 400 }
        );
      }
      updateData.auditionFlatFee = flatFee;
    }

    Object.entries(updateData).forEach(([key, value]) => {
      // Use manual mapping if available, otherwise use regex conversion
      const dbField = fieldMapping[key] || key.replace(/([A-Z])/g, '_$1').toLowerCase();
      updates[dbField] = value;
    });

    console.log(' Update data received:', updateData);
    console.log('🔄 Converted to DB fields:', updates);
    console.log(' Fee fields specifically:');
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
        solo_price = COALESCE(${updates.solo_price !== undefined ? updates.solo_price : null}, solo_price),
        duet_price = COALESCE(${updates.duet_price !== undefined ? updates.duet_price : null}, duet_price),
        group_price = COALESCE(${updates.group_price !== undefined ? updates.group_price : null}, group_price),
        discount_enabled = COALESCE(${updates.discount_enabled !== undefined ? updates.discount_enabled : null}, discount_enabled),
        discount_min_entries = COALESCE(${updates.discount_min_entries !== undefined ? updates.discount_min_entries : null}, discount_min_entries),
        discount_amount = COALESCE(${updates.discount_amount !== undefined ? updates.discount_amount : null}, discount_amount),
        registration_fee = COALESCE(${updates.registration_fee !== undefined ? updates.registration_fee : null}, registration_fee),
        currency = COALESCE(${updates.currency !== undefined ? updates.currency : null}, currency),
        participation_mode = COALESCE(${updates.participation_mode !== undefined ? updates.participation_mode : null}, participation_mode),
        certificate_template_url = COALESCE(${updates.certificate_template_url !== undefined ? updates.certificate_template_url : null}, certificate_template_url),
        event_type = COALESCE(${updates.event_type !== undefined ? updates.event_type : null}, event_type),
        event_mode = COALESCE(${updates.event_mode !== undefined ? updates.event_mode : null}, event_mode),
        qualification_required = COALESCE(${updates.qualification_required !== undefined ? updates.qualification_required : null}, qualification_required),
        qualification_source = COALESCE(${updates.qualification_source !== undefined ? updates.qualification_source : null}, qualification_source),
        minimum_qualification_score = COALESCE(${updates.minimum_qualification_score !== undefined ? updates.minimum_qualification_score : null}, minimum_qualification_score),
        number_of_judges = COALESCE(${updates.number_of_judges !== undefined ? updates.number_of_judges : null}, number_of_judges),
        audition_payment_type = COALESCE(${updates.audition_payment_type !== undefined ? updates.audition_payment_type : null}, audition_payment_type),
        audition_flat_fee = COALESCE(${updates.audition_flat_fee !== undefined ? updates.audition_flat_fee : null}, audition_flat_fee)
      WHERE id = ${eventId}
      RETURNING *
    `;

    const eventRecord = updatedEvent[0];
    console.log(` Event updated: ${eventRecord.name} (ID: ${eventId})`);

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