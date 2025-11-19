import { NextRequest, NextResponse } from 'next/server';
import { db, initializeDatabase, unifiedDb } from '@/lib/database';
import { emailService } from '@/lib/email';
import { getExistingSoloEntries, validateAndCorrectEntryFee } from '@/lib/pricing-utils';
import { getAgeCategoryFromAge, calculateAgeOnDate } from '@/lib/types';

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
    
    // Get all event entries
    const entries = await db.getAllEventEntries();
    
    // Enhance entries with contestant names from participantIds
    const { getSql } = await import('@/lib/database');
    const sqlClient = getSql();
    
    const enhancedEntries = await Promise.all(
      entries.map(async (entry) => {
        let contestantName = 'Unknown Contestant';
        
        try {
          if (entry.participantIds && Array.isArray(entry.participantIds) && entry.participantIds.length > 0) {
            console.log(`🔍 DEBUG: Entry ${entry.id} participantIds:`, entry.participantIds);
            
            // Try as dancer IDs first
            const dancerResults = await sqlClient`
              SELECT id, name FROM dancers WHERE id = ANY(${entry.participantIds})
            ` as any[];
            
            console.log(`🔍 DEBUG: Found ${dancerResults.length} dancers by ID`);
            
            if (dancerResults.length > 0) {
              const names = dancerResults.map(d => d.name);
              contestantName = names.join(', ');
              console.log(`✅ Found dancer names: ${contestantName}`);
            } else {
              // Try as EODSA IDs
              console.log(`🔍 DEBUG: Trying as EODSA IDs...`);
              const eodsaResults = await sqlClient`
                SELECT id, name, eodsa_id FROM dancers WHERE eodsa_id = ANY(${entry.participantIds})
              ` as any[];
              
              console.log(`🔍 DEBUG: Found ${eodsaResults.length} dancers by EODSA ID`);
              
              if (eodsaResults.length > 0) {
                const names = eodsaResults.map(d => d.name);
                contestantName = names.join(', ');
                console.log(`✅ Found dancer names by EODSA ID: ${contestantName}`);
              } else {
                console.warn(`❌ No dancers found with IDs or EODSA IDs: ${entry.participantIds.join(', ')}`);
              }
            }
          } else {
            console.warn(`❌ No valid participantIds for entry ${entry.id}`);
          }
        } catch (error) {
          console.error(`❌ Error fetching dancers for entry ${entry.id}:`, error);
        }
        
        return {
          ...entry,
          contestantName
        };
      })
    );
    
    return NextResponse.json({ 
      success: true,
      entries: enhancedEntries,
      count: enhancedEntries.length,
      message: `Found ${enhancedEntries.length} event entries`
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
    
    console.log(`[Qualification] Event retrieved: ${event.id} - ${event.name}`);
    console.log(`[Qualification] Event raw data:`, JSON.stringify({
      eventType: (event as any).eventType,
      eventMode: (event as any).eventMode,
      qualificationRequired: (event as any).qualificationRequired,
      qualificationSource: (event as any).qualificationSource,
      minimumQualificationScore: (event as any).minimumQualificationScore
    }, null, 2));

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

    // Validate event mode vs entry type
    const entryType = body.entryType || 'live';
    const eventMode = (event as any).eventMode || 'HYBRID';
    
    if (eventMode === 'VIRTUAL' && entryType === 'live') {
      return NextResponse.json(
        { error: 'This event only accepts virtual entries. Live entries are not allowed.' },
        { status: 400 }
      );
    }
    
    if (eventMode === 'LIVE' && entryType === 'virtual') {
      return NextResponse.json(
        { error: 'This event only accepts live entries. Virtual entries are not allowed.' },
        { status: 400 }
      );
    }

    // QUALIFICATION VALIDATION - Check if dancer meets qualification requirements
    // Safety check: If event is NATIONAL_EVENT, automatically require qualification
    let eventType = (event as any).eventType || 'REGIONAL_EVENT';
    
    console.log(`[Qualification] Event configuration check for event ${event.id} (${event.name}):`);
    console.log(`  - eventType from DB: ${(event as any).eventType || 'NULL'}`);
    console.log(`  - qualificationRequired from DB: ${(event as any).qualificationRequired}`);
    console.log(`  - qualificationSource from DB: ${(event as any).qualificationSource || 'NULL'}`);
    console.log(`  - minimumQualificationScore from DB: ${(event as any).minimumQualificationScore || 'NULL'}`);
    
    // Additional safety: If event name contains "national" but event_type is not set, treat as NATIONAL_EVENT
    if (!(event as any).eventType && event.name && event.name.toLowerCase().includes('national')) {
      console.warn(`⚠️ [Qualification] Event "${event.name}" (${event.id}) has "national" in name but event_type not set. Treating as NATIONAL_EVENT.`);
      eventType = 'NATIONAL_EVENT';
    }
    
    let qualificationRequired = (event as any).qualificationRequired ?? false;
    
    // Auto-enforce qualification for NATIONAL_EVENT if not explicitly set
    if (eventType === 'NATIONAL_EVENT' && !qualificationRequired) {
      console.warn(`⚠️ [Qualification] NATIONAL_EVENT "${event.name}" (${event.id}) has qualificationRequired=false. Auto-enforcing qualification.`);
      qualificationRequired = true;
      // Also ensure qualification_source is set
      if (!(event as any).qualificationSource) {
        (event as any).qualificationSource = 'REGIONAL';
      }
      if (!(event as any).minimumQualificationScore) {
        (event as any).minimumQualificationScore = 75;
      }
    }
    
    console.log(`[Qualification] Final validation state:`);
    console.log(`  - eventType: ${eventType}`);
    console.log(`  - qualificationRequired: ${qualificationRequired}`);
    
    if (qualificationRequired) {
      const qualificationSource = (event as any).qualificationSource || null;
      const minimumQualificationScore = (event as any).minimumQualificationScore || null;
      
      console.log(`[Qualification] ✅ Qualification REQUIRED - source: ${qualificationSource}, minScore: ${minimumQualificationScore}`);
      
      // Get the first participant (primary dancer) for qualification check
      const primaryDancerId = body.participantIds[0];
      
      // Log qualification check attempt
      const { getSql } = await import('@/lib/database');
      const sqlClient = getSql();
      const auditId = `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      try {
        await sqlClient`
          INSERT INTO qualification_audit_logs (id, event_id, dancer_id, action_type, action_details, performed_by, performed_at)
          VALUES (
            ${auditId},
            ${body.eventId},
            ${primaryDancerId},
            'ENTRY_ATTEMPT',
            ${JSON.stringify({ 
              eventId: body.eventId, 
              dancerId: primaryDancerId,
              qualificationSource,
              minimumQualificationScore,
              entryType
            })},
            ${body.eodsaId || 'system'},
            now()
          )
        `;
      } catch (auditError) {
        console.warn('Failed to log qualification audit:', auditError);
      }
      
      if (qualificationSource === 'REGIONAL') {
        if (minimumQualificationScore === null || minimumQualificationScore === undefined) {
          console.error(`[Qualification] REGIONAL qualification required but minimumQualificationScore is null/undefined for event ${body.eventId}`);
          return NextResponse.json(
            { error: 'This event requires qualification from a Regional Event, but no minimum score is set. Please contact support.' },
            { status: 400 }
          );
        }
        
        console.log(`[Qualification] Checking REGIONAL qualification for dancer ${primaryDancerId} (EODSA: ${body.eodsaId}) with minimum score ${minimumQualificationScore}`);
        const hasQualification = await db.checkRegionalQualification(primaryDancerId, minimumQualificationScore);
        console.log(`[Qualification] Qualification check result: ${hasQualification}`);
        
        if (!hasQualification) {
          console.log(`[Qualification] ❌ BLOCKING entry - dancer ${primaryDancerId} does not have qualifying regional performance`);
          // Log blocked entry
          try {
            await sqlClient`
              INSERT INTO qualification_audit_logs (id, event_id, dancer_id, action_type, action_details, performed_by, performed_at)
              VALUES (
                ${`audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`},
                ${body.eventId},
                ${primaryDancerId},
                'ENTRY_BLOCKED',
                ${JSON.stringify({ 
                  reason: 'REGIONAL_QUALIFICATION_FAILED',
                  requiredScore: minimumQualificationScore,
                  eventId: body.eventId
                })},
                ${body.eodsaId || 'system'},
                now()
              )
            `;
          } catch (auditError) {
            console.warn('Failed to log blocked entry audit:', auditError);
          }
          
          return NextResponse.json(
            { 
              error: `You must qualify from a Regional Event with a minimum score of ${minimumQualificationScore}% to enter this event. Please participate in a Regional Event first.`,
              qualificationBlocked: true,
              requiredScore: minimumQualificationScore,
              qualificationSource: 'REGIONAL'
            },
            { status: 400 }
          );
        }
      } else if (qualificationSource === 'ANY_NATIONAL_LEVEL') {
        const hasQualification = await db.checkNationalLevelQualification(
          primaryDancerId, 
          minimumQualificationScore || undefined
        );
        
        if (!hasQualification) {
          // Log blocked entry
          try {
            await sqlClient`
              INSERT INTO qualification_audit_logs (id, event_id, dancer_id, action_type, action_details, performed_by, performed_at)
              VALUES (
                ${`audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`},
                ${body.eventId},
                ${primaryDancerId},
                'ENTRY_BLOCKED',
                ${JSON.stringify({ 
                  reason: 'NATIONAL_LEVEL_QUALIFICATION_FAILED',
                  requiredScore: minimumQualificationScore,
                  eventId: body.eventId
                })},
                ${body.eodsaId || 'system'},
                now()
              )
            `;
          } catch (auditError) {
            console.warn('Failed to log blocked entry audit:', auditError);
          }
          
          const scoreText = minimumQualificationScore 
            ? ` with a minimum score of ${minimumQualificationScore}%`
            : '';
          
          return NextResponse.json(
            { 
              error: `You must have participated in a National or Qualifier Event${scoreText} to enter this event.`,
              qualificationBlocked: true,
              requiredScore: minimumQualificationScore,
              qualificationSource: 'ANY_NATIONAL_LEVEL'
            },
            { status: 400 }
          );
        }
      } else if (qualificationSource === 'MANUAL') {
        const hasQualification = await db.checkManualQualification(body.eventId, primaryDancerId);
        
        if (!hasQualification) {
          // Log blocked entry
          try {
            await sqlClient`
              INSERT INTO qualification_audit_logs (id, event_id, dancer_id, action_type, action_details, performed_by, performed_at)
              VALUES (
                ${`audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`},
                ${body.eventId},
                ${primaryDancerId},
                'ENTRY_BLOCKED',
                ${JSON.stringify({ 
                  reason: 'MANUAL_QUALIFICATION_REQUIRED',
                  eventId: body.eventId
                })},
                ${body.eodsaId || 'system'},
                now()
              )
            `;
          } catch (auditError) {
            console.warn('Failed to log blocked entry audit:', auditError);
          }
          
          return NextResponse.json(
            { 
              error: 'You must be manually qualified by an administrator to enter this event. Please contact support.',
              qualificationBlocked: true,
              qualificationSource: 'MANUAL'
            },
            { status: 400 }
          );
        }
      } else if (qualificationSource === 'CUSTOM') {
        // Log blocked entry - custom rules not implemented yet
        try {
          await sqlClient`
            INSERT INTO qualification_audit_logs (id, event_id, dancer_id, action_type, action_details, performed_by, performed_at)
            VALUES (
              ${`audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`},
              ${body.eventId},
              ${primaryDancerId},
              'ENTRY_BLOCKED',
              ${JSON.stringify({ 
                reason: 'CUSTOM_QUALIFICATION_REQUIRED',
                eventId: body.eventId
              })},
              ${body.eodsaId || 'system'},
              now()
            )
          `;
        } catch (auditError) {
          console.warn('Failed to log blocked entry audit:', auditError);
        }
        
        return NextResponse.json(
          { 
            error: 'This event has custom qualification requirements. Please contact the administrator for more information.',
            qualificationBlocked: true,
            qualificationSource: 'CUSTOM'
          },
          { status: 400 }
        );
      }
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
      
      // For studio entries, we need to count solos for the individual dancer, not the studio
      let targetEodsaId = body.eodsaId;
      if (body.participantIds && body.participantIds.length === 1) {
        // This is a solo entry - use the participant's EODSA ID for counting
        targetEodsaId = body.participantIds[0];
      }
      
      const existingSoloEntries = getExistingSoloEntries(
        allEntries,
        body.eventId,
        targetEodsaId, // Use the individual dancer's EODSA ID
        finalContestantId,
        firstParticipant?.id
      );
      
      // Get event config for event-specific fees (event already fetched above)
      const eventConfig = event ? {
        registrationFeePerDancer: event.registrationFeePerDancer,
        solo1Fee: event.solo1Fee,
        solo2Fee: event.solo2Fee,
        solo3Fee: event.solo3Fee,
        soloAdditionalFee: event.soloAdditionalFee,
        duoTrioFeePerDancer: event.duoTrioFeePerDancer,
        groupFeePerDancer: event.groupFeePerDancer,
        largeGroupFeePerDancer: event.largeGroupFeePerDancer,
        currency: event.currency
      } : undefined;
      
      // Validate and correct the fee using the utility function
      const feeValidation = validateAndCorrectEntryFee(
        performanceType,
        participantCount,
        body.calculatedFee,
        existingSoloEntries.length,
        eventConfig
      );
      
      validatedFee = feeValidation.validatedFee;
      
      // Log for debugging and monitoring
      console.log(`Solo pricing calculation for dancer ${targetEodsaId} (submitted by ${body.eodsaId}):`);
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
      // Get event config for event-specific fees (event already fetched above)
      const eventConfig = event ? {
        registrationFeePerDancer: event.registrationFeePerDancer,
        solo1Fee: event.solo1Fee,
        solo2Fee: event.solo2Fee,
        solo3Fee: event.solo3Fee,
        soloAdditionalFee: event.soloAdditionalFee,
        duoTrioFeePerDancer: event.duoTrioFeePerDancer,
        groupFeePerDancer: event.groupFeePerDancer,
        largeGroupFeePerDancer: event.largeGroupFeePerDancer,
        currency: event.currency
      } : undefined;
      
      // For non-solo entries, validate using the utility function
      const feeValidation = validateAndCorrectEntryFee(
        performanceType,
        participantCount,
        body.calculatedFee,
        0, // existingSoloCount not applicable for non-solo
        eventConfig
      );
      
      if (!feeValidation.wasCorrect) {
        console.warn(`⚠️ ${performanceType} fee validation: submitted R${body.calculatedFee}, expected R${feeValidation.validatedFee}`);
        console.warn(`⚠️ Using submitted fee but flagging for review`);
        // For non-solo, we log but don't auto-correct (in case there are special pricing rules)
      }
    }

    // Calculate age category from average dancer ages
    let calculatedAgeCategory = event.ageCategory; // Default to event's age category

    try {
      const { getSql } = await import('@/lib/database');
      const sqlClient = getSql();

      // Get ages of all participants
      const participantAges = await Promise.all(
        body.participantIds.map(async (participantId: string) => {
          try {
            // Try unified system first
            const dancer = await unifiedDb.getDancerById(participantId);
            if (dancer) {
              return dancer.age;
            }

            // Try old system
            const result = await sqlClient`
              SELECT age, date_of_birth FROM dancers WHERE id = ${participantId} OR eodsa_id = ${participantId}
            ` as any[];

            if (result.length > 0) {
              if (result[0].age) {
                return result[0].age;
              }
              if (result[0].date_of_birth) {
                return calculateAgeOnDate(result[0].date_of_birth, new Date(event.eventDate));
              }
            }
            return null;
          } catch (error) {
            console.warn(`Could not get age for participant ${participantId}:`, error);
            return null;
          }
        })
      );

      // Filter out null values and calculate average age
      const validAges = participantAges.filter(age => age !== null) as number[];
      if (validAges.length > 0) {
        const averageAge = Math.round(validAges.reduce((sum, age) => sum + age, 0) / validAges.length);
        calculatedAgeCategory = getAgeCategoryFromAge(averageAge);
        console.log(`✅ Calculated age category for entry: ${calculatedAgeCategory} (average age: ${averageAge} from ${validAges.length} dancers)`);
      } else {
        console.warn(`⚠️ Could not calculate age category for entry, using event default: ${event.ageCategory}`);
      }
    } catch (error) {
      console.error('Error calculating age category:', error);
      // Fall back to event age category
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
      performanceType: performanceType,
      ageCategory: calculatedAgeCategory, // Add calculated age category
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