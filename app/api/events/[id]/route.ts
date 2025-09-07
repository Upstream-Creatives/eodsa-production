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
      'maxParticipants', 'status'
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

    // Build update object for each field
    const updates: Record<string, any> = {};
    Object.entries(updateData).forEach(([key, value]) => {
      const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      updates[dbField] = value;
    });

    // Execute dynamic update using individual field updates
    let updatedEvent;
    if (updates.name !== undefined) {
      updatedEvent = await sql`
        UPDATE events 
        SET name = ${updates.name}, updated_at = NOW()
        WHERE id = ${eventId}
        RETURNING *
      `;
    }
    if (updates.event_date !== undefined) {
      updatedEvent = await sql`
        UPDATE events 
        SET event_date = ${updates.event_date}, updated_at = NOW()
        WHERE id = ${eventId}
        RETURNING *
      `;
    }
    if (updates.registration_deadline !== undefined) {
      updatedEvent = await sql`
        UPDATE events 
        SET registration_deadline = ${updates.registration_deadline}, updated_at = NOW()
        WHERE id = ${eventId}
        RETURNING *
      `;
    }
    if (updates.location !== undefined) {
      updatedEvent = await sql`
        UPDATE events 
        SET location = ${updates.location}, updated_at = NOW()
        WHERE id = ${eventId}
        RETURNING *
      `;
    }
    if (updates.region !== undefined) {
      updatedEvent = await sql`
        UPDATE events 
        SET region = ${updates.region}, updated_at = NOW()
        WHERE id = ${eventId}
        RETURNING *
      `;
    }

    if (!updatedEvent || updatedEvent.length === 0) {
      // Fallback: update all possible fields at once
      updatedEvent = await sql`
        UPDATE events 
        SET 
          name = COALESCE(${updates.name || null}, name),
          event_date = COALESCE(${updates.event_date || null}, event_date),
          registration_deadline = COALESCE(${updates.registration_deadline || null}, registration_deadline),
          location = COALESCE(${updates.location || null}, location),
          region = COALESCE(${updates.region || null}, region),
          updated_at = NOW()
        WHERE id = ${eventId}
        RETURNING *
      `;
    }

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