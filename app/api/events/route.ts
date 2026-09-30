import { NextResponse } from 'next/server';
import { db as database, initializeDatabase } from '@/lib/database';
import { isPhase2Enabled, getFeatureUnavailableMessage } from '@/lib/feature-flags';

// Initialize database on first request
let dbInitialized = false;

async function ensureDbInitialized() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = (searchParams.get('scope') || 'active').toLowerCase();

    // History/archived reads must stay fast — skip heavy schema migration + status rollover
    if (scope === 'archived') {
      const events = await database.getAllEvents({ archivedOnly: true });
      return NextResponse.json({
        success: true,
        events,
        scope: 'archived'
      });
    }

    await ensureDbInitialized();

    // Status rollover only matters for live/active dashboards
    if (scope !== 'all') {
      await database.updateEventStatuses();
    }

    let events;
    if (scope === 'all') {
      events = await database.getAllEvents({ includeArchived: true });
    } else {
      events = await database.getAllEvents();
    }

    return NextResponse.json({
      success: true,
      events,
      scope: scope === 'all' ? 'all' : 'active'
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
  // Check Phase 2 feature flag - block Create Event
  if (!isPhase2Enabled()) {
    return NextResponse.json(
      { success: false, error: getFeatureUnavailableMessage() },
      { status: 403 }
    );
  }

  try {
    // Ensure database is initialized with latest schema
    await ensureDbInitialized();
    
    const body = await request.json();
    
    // Log incoming request for debugging
    console.log(' [Event Creation] Incoming request body:', {
      name: body.name,
      numberOfJudges: body.numberOfJudges,
      participationMode: body.participationMode,
      hasNumberOfJudges: 'numberOfJudges' in body
    });
    
    // Validate required fields
    const isAudition = body.eventType === 'AUDITION_EVENT';
    if (isAudition) {
      body.venue = body.venue || 'Virtual';
      body.eventMode = 'VIRTUAL';
      body.participationMode = 'virtual';
      body.qualificationRequired = false;
      body.qualificationSource = null;
      body.minimumQualificationScore = null;
      body.discountEnabled = false;
      body.discountAmount = 0;
      body.discountMinEntries = 0;
      body.soloPrice = 0;
      body.duetPrice = 0;
      body.groupPrice = 0;
      body.registrationFee = 0;
      body.auditionPaymentType = body.auditionPaymentType === 'paid' ? 'paid' : 'free';
      body.auditionFlatFee = body.auditionPaymentType === 'paid' ? Number(body.auditionFlatFee) || 0 : 0;
      if (body.auditionPaymentType === 'paid' && body.auditionFlatFee <= 0) {
        return NextResponse.json(
          { success: false, error: 'Paid auditions need a flat entry amount greater than zero' },
          { status: 400 }
        );
      }
    }

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
      soloPrice: body.soloPrice,
      duetPrice: body.duetPrice,
      groupPrice: body.groupPrice,
      discountEnabled: body.discountEnabled ?? false,
      discountMinEntries: body.discountMinEntries ?? 0,
      discountAmount: body.discountAmount ?? 0,
      registrationFee: body.registrationFee ?? 0,
      currency: body.currency || 'ZAR',
      participationMode: body.participationMode || 'hybrid',
      certificateTemplateUrl: body.certificateTemplateUrl || undefined,
      numberOfJudges: body.numberOfJudges !== undefined ? body.numberOfJudges : 4,
      eventType: body.eventType || 'REGIONAL_EVENT',
      eventMode: body.eventMode || 'HYBRID',
      qualificationRequired: body.qualificationRequired ?? false,
      qualificationSource: body.qualificationSource || null,
      minimumQualificationScore: body.minimumQualificationScore || null,
      auditionPaymentType: body.auditionPaymentType || null,
      auditionFlatFee: body.auditionFlatFee ?? 0
    } as any);

    // Log the event object returned from DB
    console.log(' [Event Creation] Event created:', {
      id: event.id,
      name: event.name,
      numberOfJudges: (event as any).numberOfJudges,
      participationMode: (event as any).participationMode
    });

    // Auto-assignment removed - judges must be manually assigned after event creation

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