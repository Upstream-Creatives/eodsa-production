import { NextRequest, NextResponse } from 'next/server';
import { unifiedDb, db } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.nationalsEventId || !body.contestantId || !body.eodsaId || !body.participantIds || !Array.isArray(body.participantIds) || body.participantIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: nationalsEventId, contestantId, eodsaId, participantIds' },
        { status: 400 }
      );
    }

    // For solo performances, validate solo details
    if (body.performanceType === 'Solo' && body.soloCount > 1 && (!body.soloDetails || !Array.isArray(body.soloDetails))) {
      return NextResponse.json(
        { error: 'Solo details are required for multiple solo entries' },
        { status: 400 }
      );
    }

    // Create nationals event entry
    const nationalsEntry = await unifiedDb.createNationalsEventEntry({
      nationalsEventId: body.nationalsEventId,
      contestantId: body.contestantId,
      eodsaId: body.eodsaId,
      participantIds: body.participantIds,
      calculatedFee: body.calculatedFee,
      paymentStatus: body.paymentStatus || 'pending',
      paymentMethod: body.paymentMethod,
      approved: body.approved || false,
      qualifiedForNationals: body.qualifiedForNationals || true,
      itemNumber: body.itemNumber || null,
      itemName: body.itemName,
      choreographer: body.choreographer,
      mastery: body.mastery,
      itemStyle: body.itemStyle,
      estimatedDuration: body.estimatedDuration,
      performanceType: body.performanceType,
      ageCategory: body.ageCategory,
      soloCount: body.soloCount || 1,
      soloDetails: body.soloDetails || null,
      additionalNotes: body.additionalNotes || null
    });

    // Create performance records for judges to score
    const performances = [];
    
    if (body.performanceType === 'Solo' && body.soloCount > 1 && body.soloDetails) {
      // Create separate performance for each solo
      for (let i = 0; i < body.soloDetails.length; i++) {
        const solo = body.soloDetails[i];
        
        // Get participant names
        let participantNames = [];
        try {
          const contestant = await db.getContestantById(body.contestantId);
          if (contestant?.dancers) {
            participantNames = body.participantIds.map((id: string) => {
              const dancer = contestant.dancers.find(d => d.id === id);
              return dancer?.name || 'Unknown Dancer';
            });
          }
        } catch (error) {
          console.warn('Could not fetch participant names:', error);
          participantNames = ['Unknown Dancer'];
        }

        const performance = await db.createPerformance({
          eventId: body.nationalsEventId,
          eventEntryId: nationalsEntry.id,
          contestantId: body.contestantId,
          title: `${solo.itemName} (Solo ${solo.soloNumber})`,
          participantNames,
          duration: solo.estimatedDuration || 0,
          choreographer: solo.choreographer,
          mastery: solo.mastery,
          itemStyle: solo.itemStyle,
          status: 'scheduled',
          itemNumber: undefined // Will be assigned by admin later
        });
        
        performances.push(performance);
      }
    } else {
      // Create single performance for non-multiple solos
      let participantNames = [];
      try {
        const contestant = await db.getContestantById(body.contestantId);
        if (contestant?.dancers) {
          participantNames = body.participantIds.map((id: string) => {
            const dancer = contestant.dancers.find(d => d.id === id);
            return dancer?.name || 'Unknown Dancer';
          });
        }
      } catch (error) {
        console.warn('Could not fetch participant names:', error);
        participantNames = ['Unknown Dancer'];
      }

      const performance = await db.createPerformance({
        eventId: body.nationalsEventId,
        eventEntryId: nationalsEntry.id,
        contestantId: body.contestantId,
        title: body.itemName,
        participantNames,
        duration: body.estimatedDuration || 0,
        choreographer: body.choreographer,
        mastery: body.mastery,
        itemStyle: body.itemStyle,
        status: 'scheduled',
        itemNumber: undefined // Will be assigned by admin later
      });
      
      performances.push(performance);
    }

    console.log(`✅ Nationals entry created successfully for ${body.performanceType} with ${body.soloCount || 1} solo(s) and ${performances.length} performance record(s)`);

    return NextResponse.json({
      ...nationalsEntry,
      performances: performances.map(p => ({
        id: p.id,
        title: p.title,
        status: p.status
      }))
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating nationals entry:', error);
    
    // Handle specific database errors
    if (error.message?.includes('FOREIGN KEY constraint failed')) {
      return NextResponse.json(
        { error: 'Invalid nationals event ID, contestant ID, or participant IDs' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create nationals entry' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Get all nationals event entries for debugging
    const entries = await unifiedDb.getAllNationalsEventEntries();
    
    return NextResponse.json({ 
      success: true,
      entries: entries,
      count: entries.length,
      message: `Found ${entries.length} nationals event entries`
    });
  } catch (error) {
    console.error('Error fetching nationals entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch nationals entries' },
      { status: 500 }
    );
  }
} 