import { NextRequest, NextResponse } from 'next/server';
import { db, initializeDatabase, unifiedDb } from '@/lib/database';
import { emailService } from '@/lib/email';
import { getExistingSoloEntries, validateAndCorrectEntryFee } from '@/lib/pricing-utils';

// Helper function to check if a dancer's age matches the event's age category
function checkAgeEligibility(dancerAge: number, ageCategory: string): boolean {
  switch (ageCategory) {
    case 'All Ages':
    case 'All':
      return true; // All ages are welcome
    case '4 & Under':
      return dancerAge <= 4;
    case '6 & Under':
      return dancerAge <= 6;
    case '7-9':
      return dancerAge >= 7 && dancerAge <= 9;
    case '10-12':
      return dancerAge >= 10 && dancerAge <= 12;
    case '13-14':
      return dancerAge >= 13 && dancerAge <= 14;
    case '15-17':
      return dancerAge >= 15 && dancerAge <= 17;
    case '18-24':
      return dancerAge >= 18 && dancerAge <= 24;
    case '25-39':
      return dancerAge >= 25 && dancerAge <= 39;
    case '40+':
      return dancerAge >= 40 && dancerAge < 60;
    case '60+':
      return dancerAge >= 60;
    default:
      // If age category is not recognized, allow entry (backward compatibility)
      console.warn(`Unknown age category: ${ageCategory}`);
      return true;
  }
}

// Initialize database on first request
let dbInitialized = false;

async function ensureDbInitialized() {
  if (!dbInitialized) {
    // // // await initializeDatabase() // Commented out for performance - initialization happens once on server start; // Commented out for performance - initialization happens once on server start // Commented out for performance - initialization happens once on server start
    dbInitialized = true;
  }
}

export async function GET() {
  try {
    await ensureDbInitialized();
    
    // Get all event entries for debugging
    const entries = await db.getAllEventEntries();
    
    return NextResponse.json({ 
      success: true,
      entries: entries,
      count: entries.length,
      message: `Found ${entries.length} event entries`
    });
  } catch (error) {
    console.error('Error fetching event entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event entries' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // // // await initializeDatabase() // Commented out for performance - initialization happens once on server start; // Commented out for performance - initialization happens once on server start // Commented out for performance - initialization happens once on server start
    const body = await request.json();
    
    // Validate required fields
    if (!body.eventId || !body.contestantId || !body.eodsaId || !body.participantIds || !Array.isArray(body.participantIds) || body.participantIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: eventId, contestantId, eodsaId, participantIds' },
        { status: 400 }
      );
    }

    // Get event details
    const event = await db.getEventById(body.eventId);
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Check if event is still accepting registrations
    const now = new Date();
    const registrationDeadline = new Date(event.registrationDeadline);
    const eventDate = new Date(event.eventDate);
    
    if (now > eventDate) {
      return NextResponse.json(
        { error: 'This event has already completed. Registration is no longer possible.' },
        { status: 400 }
      );
    }
    
    if (now > registrationDeadline) {
      return NextResponse.json(
        { error: 'Registration deadline has passed for this event' },
        { status: 400 }
      );
    }

    // UNIFIED SYSTEM VALIDATION: Check dancer eligibility
    // Validate each participant has proper approvals and age requirements
    for (const participantId of body.participantIds) {
      // Check if this is a unified system dancer
      const dancer = await unifiedDb.getDancerById(participantId);
      
      if (dancer) {
        // Check if dancer account is disabled (rejected)
        if (dancer.rejectionReason) {
          return NextResponse.json(
            { 
              error: `Dancer ${dancer.name} (${dancer.eodsaId}) account has been disabled. Please contact support.`,
              accountDisabled: true,
              dancerId: participantId
            },
            { status: 403 }
          );
        }

        // NEW: Check age eligibility for the event
        const dancerAge = dancer.age;
        const eventAgeCategory = event.ageCategory;
        
        if (!checkAgeEligibility(dancerAge, eventAgeCategory)) {
          return NextResponse.json(
            { 
              error: `Dancer ${dancer.name} (age ${dancerAge}) is not eligible for the "${eventAgeCategory}" age category. Please select an appropriate event for this dancer's age.`,
              ageIneligible: true,
              dancerId: participantId,
              dancerName: dancer.name,
              dancerAge: dancerAge,
              eventAgeCategory: eventAgeCategory
            },
            { status: 400 }
          );
        }

        // All active dancers can participate - both independent and studio dancers allowed
        const studioApplications = await unifiedDb.getDancerApplications(participantId);
        const acceptedApplications = studioApplications.filter(app => app.status === 'accepted');
        
        if (acceptedApplications.length === 0) {
          // Independent dancer - allowed
          console.log(`Independent dancer ${dancer.name} entering competition`);
        } else {
          // Studio-affiliated dancer - also allowed
          console.log(`Studio-affiliated dancer ${dancer.name} entering competition`);
        }
      } else {
        // Check if this is an old system participant (fallback compatibility)
        const contestant = await db.getContestantById(body.contestantId);
        if (!contestant) {
          return NextResponse.json(
            { error: 'Invalid contestant or participant data' },
            { status: 400 }
          );
        }
        
        // For old system - validate participant exists in contestant's dancers
        const participantExists = contestant.dancers?.some((d: any) => d.id === participantId);
        if (!participantExists) {
          return NextResponse.json(
            { error: `Participant ${participantId} not found in contestant record` },
            { status: 400 }
          );
        }

        // NEW: Check age eligibility for old system dancers
        const participant = contestant.dancers?.find((d: any) => d.id === participantId);
        if (participant) {
          const participantAge = participant.age;
          const eventAgeCategory = event.ageCategory;
          
          if (!checkAgeEligibility(participantAge, eventAgeCategory)) {
            return NextResponse.json(
              { 
                error: `Dancer ${participant.name} (age ${participantAge}) is not eligible for the "${eventAgeCategory}" age category. Please select an appropriate event for this dancer's age.`,
                ageIneligible: true,
                dancerId: participantId,
                dancerName: participant.name,
                dancerAge: participantAge,
                eventAgeCategory: eventAgeCategory
              },
              { status: 400 }
            );
          }
        }
      }
    }

    // Validate performance type participant limits and time limits
    const participantCount = body.participantIds.length;
    // Determine performance type from participant count (since events now have performanceType: 'All')
    let performanceType: string;
    if (participantCount === 1) {
      performanceType = 'Solo';
    } else if (participantCount === 2) {
      performanceType = 'Duet';
    } else if (participantCount === 3) {
      performanceType = 'Trio';
    } else if (participantCount >= 4) {
      performanceType = 'Group';
    } else {
      return NextResponse.json(
        { error: 'Invalid participant count: must be at least 1 participant' },
        { status: 400 }
      );
    }
    
    const estimatedDurationMinutes = body.estimatedDuration;
    
    const limits = {
      'Solo': { min: 1, max: 1, maxTimeMinutes: 2 },
      'Duet': { min: 2, max: 2, maxTimeMinutes: 3 },
      'Trio': { min: 3, max: 3, maxTimeMinutes: 3 },
      'Group': { min: 4, max: 30, maxTimeMinutes: 3.5 }
    };
    
    const limit = limits[performanceType as keyof typeof limits];
    
    // Validate participant count
    if (participantCount < limit.min || participantCount > limit.max) {
      return NextResponse.json(
        { error: `${performanceType} requires ${limit.min === limit.max ? limit.min : `${limit.min}-${limit.max}`} participant(s)` },
        { status: 400 }
      );
    }
    
    // Validate time limit (minimum and maximum)
    if (estimatedDurationMinutes > 0 && estimatedDurationMinutes < 0.5) {
      return NextResponse.json(
        { error: `Performance duration cannot be less than 30 seconds (0.5 minutes). Your estimated duration is ${estimatedDurationMinutes} minutes.` },
        { status: 400 }
      );
    }
    
    if (estimatedDurationMinutes > limit.maxTimeMinutes) {
      const maxTimeDisplay = limit.maxTimeMinutes === 3.5 ? '3:30' : `${limit.maxTimeMinutes}:00`;
      return NextResponse.json(
        { error: `${performanceType} performances cannot exceed ${maxTimeDisplay} minutes. Your estimated duration is ${estimatedDurationMinutes} minutes.` },
        { status: 400 }
      );
    }

    // UNIFIED SYSTEM: For unified system dancers, use a special contestant ID format
    let finalContestantId = body.contestantId;
    
    // Check if this is a unified system dancer
    const firstParticipant = await unifiedDb.getDancerById(body.participantIds[0]);
    if (firstParticipant) {
      // Use the dancer's ID as the contestant ID for unified system
      finalContestantId = firstParticipant.id;
      console.log(`Using unified dancer ID ${finalContestantId} as contestant ID for ${firstParticipant.name}`);
    }

    // CRITICAL: Calculate correct fee based on existing entries (fix for solo pricing bug)
    let validatedFee = body.calculatedFee;
    
    if (performanceType === 'Solo') {
      // Get existing solo entries for this dancer/contestant and event
      const allEntries = await db.getAllEventEntries();
      const existingSoloEntries = getExistingSoloEntries(
        allEntries,
        body.eventId,
        body.eodsaId,
        finalContestantId,
        firstParticipant?.id
      );
      
      // Validate and correct the fee using the utility function
      const feeValidation = validateAndCorrectEntryFee(
        performanceType,
        participantCount,
        body.calculatedFee,
        existingSoloEntries.length
      );
      
      validatedFee = feeValidation.validatedFee;
      
      // Log for debugging and monitoring
      console.log(`Solo pricing calculation for ${body.eodsaId}:`);
      console.log(`- Event: ${body.eventId}`);
      console.log(`- Existing solo entries: ${existingSoloEntries.length}`);
      console.log(`- This will be solo #${existingSoloEntries.length + 1}`);
      console.log(`- ${feeValidation.explanation}`);
      console.log(`- Submitted fee: R${body.calculatedFee}`);
      console.log(`- Validated fee: R${validatedFee}`);
      
      if (!feeValidation.wasCorrect) {
        console.warn(`⚠️ Fee correction applied: submitted R${body.calculatedFee}, corrected to R${validatedFee}`);
      }
    } else {
      // For non-solo entries, validate using the utility function
      const feeValidation = validateAndCorrectEntryFee(
        performanceType,
        participantCount,
        body.calculatedFee
      );
      
      if (!feeValidation.wasCorrect) {
        console.warn(`⚠️ ${performanceType} fee validation: submitted R${body.calculatedFee}, expected R${feeValidation.validatedFee}`);
        console.warn(`⚠️ Using submitted fee but flagging for review`);
        // For non-solo, we log but don't auto-correct (in case there are special pricing rules)
      }
    }

    // Create event entry
    const eventEntry = await db.createEventEntry({
      eventId: body.eventId,
      contestantId: finalContestantId,
      eodsaId: body.eodsaId,
      participantIds: body.participantIds,
      calculatedFee: validatedFee, // Use the server-validated fee
      paymentStatus: body.paymentStatus || 'pending',
      paymentMethod: body.paymentMethod,
      approved: body.approved || false,
      qualifiedForNationals: body.qualifiedForNationals || false,
      itemNumber: body.itemNumber || null, // Allow admin to set this, but not required from contestants
      itemName: body.itemName,
      choreographer: body.choreographer,
      mastery: body.mastery,
      itemStyle: body.itemStyle,
      estimatedDuration: body.estimatedDuration,
      // PHASE 2: Live vs Virtual Entry Support
      entryType: body.entryType || 'live',
      musicFileUrl: body.musicFileUrl || null,
      musicFileName: body.musicFileName || null,
      videoFileUrl: body.videoFileUrl || null,
      videoFileName: body.videoFileName || null,
      videoExternalUrl: body.videoExternalUrl || null,
      videoExternalType: body.videoExternalType || null
    });

    // Email system disabled for Phase 1
    // try {
    //   // Get contestant details for email
    //   const contestant = await db.getContestantById(body.contestantId);
    //   if (contestant && contestant.email) {
    //     await emailService.sendCompetitionEntryEmail(
    //       contestant.name,
    //       contestant.email,
    //       event.name,
    //       body.itemName,
    //       event.performanceType,
    //       body.calculatedFee
    //     );
    //     console.log('Competition entry email sent successfully to:', contestant.email);
    //   }
    // } catch (emailError) {
    //   console.error('Failed to send competition entry email:', emailError);
    //   // Don't fail the entry if email fails
    // }

    return NextResponse.json(eventEntry, { status: 201 });
  } catch (error: any) {
    console.error('Error creating event entry:', error);
    
    // Handle specific database errors
    if (error.message?.includes('FOREIGN KEY constraint failed')) {
      return NextResponse.json(
        { error: 'Invalid contestant ID or participant IDs' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create event entry' },
      { status: 500 }
    );
  }
} 