import { NextResponse } from 'next/server';
import { db as database, initializeDatabase } from '@/lib/database';

// Initialize database on first request
let dbInitialized = false;

async function ensureDbInitialized() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
}

export async function GET() {
  try {
    // Ensure database is initialized (adds missing columns like number_of_judges)
    await ensureDbInitialized();
    
    // Update event statuses based on current date/time before fetching
    await database.updateEventStatuses();
    
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
    // Ensure database is initialized with latest schema
    await ensureDbInitialized();
    
    const body = await request.json();
    
    // Log incoming request for debugging
    console.log('🔍 [Event Creation] Incoming request body:', {
      name: body.name,
      numberOfJudges: body.numberOfJudges,
      participationMode: body.participationMode,
      hasNumberOfJudges: 'numberOfJudges' in body
    });
    
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
    const now = new Date();
    
    if (registrationDeadline >= eventDate) {
      return NextResponse.json(
        { success: false, error: 'Registration deadline must be before event date' },
        { status: 400 }
      );
    }

    // Automatically set the correct initial status based on dates
    let initialStatus: 'upcoming' | 'registration_open' | 'registration_closed' | 'in_progress' | 'completed' = 'upcoming';
    if (now < registrationDeadline) {
      initialStatus = 'registration_open';
    } else if (now >= registrationDeadline && now < eventDate) {
      initialStatus = 'registration_closed';
    } else if (now >= eventDate) {
      initialStatus = 'completed';
    }

    const event = await database.createEvent({
      name: body.name,
      description: body.description,
      region: body.region,
      ageCategory: body.ageCategory,
      performanceType: body.performanceType,
      eventDate: body.eventDate,
      eventEndDate: body.eventEndDate,
      registrationDeadline: body.registrationDeadline,
      venue: body.venue,
      status: initialStatus,
      maxParticipants: body.maxParticipants,
      entryFee: 0, // Deprecated - use detailed fee structure instead
      createdBy: body.createdBy,
      registrationFeePerDancer: body.registrationFeePerDancer,
      solo1Fee: body.solo1Fee,
      solo2Fee: body.solo2Fee,
      solo3Fee: body.solo3Fee,
      soloAdditionalFee: body.soloAdditionalFee,
      duoTrioFeePerDancer: body.duoTrioFeePerDancer,
      groupFeePerDancer: body.groupFeePerDancer,
      largeGroupFeePerDancer: body.largeGroupFeePerDancer,
      currency: body.currency || 'ZAR',
      participationMode: body.participationMode || 'hybrid',
      certificateTemplateUrl: body.certificateTemplateUrl || undefined,
      numberOfJudges: body.numberOfJudges !== undefined ? body.numberOfJudges : 4
    });
    
    // Log the event object returned from DB
    console.log('✅ [Event Creation] Event created:', {
      id: event.id,
      name: event.name,
      numberOfJudges: (event as any).numberOfJudges,
      participationMode: (event as any).participationMode
    });

    // 🚀 AUTO-ASSIGN: Automatically assign judges who are already assigned to this region
    try {
      const existingAssignments = await database.getAllJudgeAssignments();
      const nationalsJudges = existingAssignments
        .filter(assignment => assignment.region === body.region)
        .reduce((unique, assignment) => {
          if (!unique.find(j => j.judgeId === assignment.judgeId)) {
            unique.push({ judgeId: assignment.judgeId, assignedBy: assignment.assignedBy });
          }
          return unique;
        }, [] as { judgeId: string; assignedBy: string }[]);

          // Auto-assign each nationals judge to the new event
    for (const judge of nationalsJudges) {
        await database.createJudgeEventAssignment({
          judgeId: judge.judgeId,
          eventId: event.id,
          assignedBy: judge.assignedBy // Use original admin who assigned them to region
        });
      }

          if (nationalsJudges.length > 0) {
      console.log(`✅ Auto-assigned ${nationalsJudges.length} judges to new event: ${event.name}`);
      }
    } catch (assignmentError) {
      console.error('Auto-assignment failed (non-critical):', assignmentError);
      // Don't fail event creation if auto-assignment fails
    }

    return NextResponse.json({
      success: true,
      event
    });
  } catch (error) {
    console.error('Error creating event:', error);
    
    if (error instanceof Error && error.message) {
      if (error.message.includes('region')) {
        return NextResponse.json(
          { success: false, error: 'Invalid region specified' },
          { status: 400 }
        );
      }
      if (error.message.includes('FOREIGN KEY')) {
        return NextResponse.json(
          { success: false, error: 'Invalid reference data provided' },
          { status: 400 }
        );
      }
      if (error.message.includes('CHECK constraint')) {
        return NextResponse.json(
          { success: false, error: 'Invalid data format provided' },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create event' },
      { status: 500 }
    );
  }
} 