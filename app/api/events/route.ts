import { NextResponse } from 'next/server';
import { db as database, initializeDatabase } from '@/lib/database';

export async function GET() {
  try {
    const events = await database.getAllEvents();
    return NextResponse.json({
      success: true,
      events
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const requiredFields = [
      'name', 'description', 'region', 'ageCategory', 'performanceType',
      'eventDate', 'registrationDeadline', 'venue', 'entryFee', 'createdBy'
    ];
    
    for (const field of requiredFields) {
      if (!body[field] && body[field] !== 0) {
        return NextResponse.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate date fields
    const eventDate = new Date(body.eventDate);
    const registrationDeadline = new Date(body.registrationDeadline);
    
    if (registrationDeadline >= eventDate) {
      return NextResponse.json(
        { success: false, error: 'Registration deadline must be before event date' },
        { status: 400 }
      );
    }

    const event = await database.createEvent({
      name: body.name,
      description: body.description,
      region: body.region,
      ageCategory: body.ageCategory,
      performanceType: body.performanceType,
      eventDate: body.eventDate,
      registrationDeadline: body.registrationDeadline,
      venue: body.venue,
      status: body.status || 'upcoming',
      maxParticipants: body.maxParticipants,
      entryFee: body.entryFee,
      createdBy: body.createdBy
    });

    return NextResponse.json({
      success: true,
      event
    });
  } catch (error: any) {
    console.error('Error creating event:', error);
    
    // Handle specific database errors with user-friendly messages
    if (error.message) {
      if (error.message.includes('region')) {
        return NextResponse.json(
          { success: false, error: 'Invalid region selected. Please choose a valid South African province.' },
          { status: 400 }
        );
      }
      if (error.message.includes('FOREIGN KEY')) {
        return NextResponse.json(
          { success: false, error: 'Invalid creator ID. Please ensure you are logged in as an admin.' },
          { status: 400 }
        );
      }
      if (error.message.includes('CHECK constraint')) {
        return NextResponse.json(
          { success: false, error: 'Invalid data provided. Please check all fields and try again.' },
          { status: 400 }
        );
      }
      
      // Return the specific error message from the database layer
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to create event' },
      { status: 500 }
    );
  }
} 