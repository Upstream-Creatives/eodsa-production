import { NextResponse } from 'next/server';
import { db, unifiedDb } from '@/lib/database';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entryId = id;
    
    // Get the event entry
    const allEntries = await db.getAllEventEntries();
    const entry = allEntries.find(e => e.id === entryId);
    
    if (!entry) {
      return NextResponse.json(
        { success: false, error: 'Event entry not found' },
        { status: 404 }
      );
    }

    if (!entry.approved) {
      return NextResponse.json(
        { success: false, error: 'Entry must be approved first' },
        { status: 400 }
      );
    }

    // Build participant names from unified dancers first, then legacy contestant, then fallback
    const contestant = await db.getContestantById(entry.contestantId).catch(() => null as any);
    const participantNames: string[] = [];
    for (let i = 0; i < entry.participantIds.length; i++) {
      const pid = entry.participantIds[i];
      try {
        const dancer = await unifiedDb.getDancerById(pid);
        if (dancer?.name) {
          participantNames.push(dancer.name);
          continue;
        }
      } catch {}
      const legacyName = contestant?.dancers?.find((d: any) => d.id === pid)?.name;
      participantNames.push(legacyName || `Participant ${i + 1}`);
    }

    // Check if performance already exists for this entry using direct SQL query
    const { getSql } = await import('@/lib/database');
    const sqlClient = getSql();
    
    const existingPerformanceCheck = await sqlClient`
      SELECT id FROM performances WHERE event_entry_id = ${entryId} LIMIT 1
    ` as any[];
    
    if (existingPerformanceCheck.length > 0) {
      const existingPerformance = await db.getPerformanceById(existingPerformanceCheck[0].id);
      return NextResponse.json({
        success: true,
        message: 'Performance already exists for this entry',
        performance: existingPerformance
      });
    }

    // CRITICAL FIX: Validate contestant_id exists before creating performance
    let validContestantId = entry.contestantId;
    try {
      // Check if contestant exists
      const contestantCheck = await sqlClient`
        SELECT id FROM contestants WHERE id = ${entry.contestantId}
      ` as any[];
      
      if (contestantCheck.length === 0) {
        console.warn(`⚠️  Contestant ${entry.contestantId} doesn't exist, using first participant as contestant`);
        
        // Try to use first participant as contestant
        if (entry.participantIds && entry.participantIds.length > 0) {
          const firstParticipant = entry.participantIds[0];
          
          // Check if participant is a dancer
          const dancerCheck = await sqlClient`
            SELECT id FROM dancers WHERE id = ${firstParticipant} OR eodsa_id = ${firstParticipant}
          ` as any[];
          
          if (dancerCheck.length > 0) {
            validContestantId = dancerCheck[0].id;
            console.log(`✅ Using dancer ID as contestant: ${validContestantId}`);
          } else {
            console.error(`❌ Cannot find valid contestant for entry ${entryId}`);
          }
        }
      }
    } catch (checkErr) {
      console.error('Error checking contestant:', checkErr);
    }

    // Create the performance
    const performance = await db.createPerformance({
      eventId: entry.eventId,
      eventEntryId: entry.id,
      contestantId: validContestantId,
      title: entry.itemName,
      participantNames,
      duration: entry.estimatedDuration || 0,
      itemNumber: entry.itemNumber, // Copy item number from entry
      choreographer: entry.choreographer,
      mastery: entry.mastery,
      itemStyle: entry.itemStyle,
      status: 'scheduled',
      entryType: entry.entryType || 'live',
      videoExternalUrl: entry.videoExternalUrl,
      videoExternalType: entry.videoExternalType,
      musicFileUrl: entry.musicFileUrl,
      musicFileName: entry.musicFileName
    });
    
    // Verify the performance was actually created
    const verifyPerformance = await sqlClient`
      SELECT id FROM performances WHERE event_entry_id = ${entryId} LIMIT 1
    ` as any[];
    
    if (verifyPerformance.length === 0) {
      throw new Error('Performance creation reported success but performance not found in database');
    }

    return NextResponse.json({
      success: true,
      message: 'Performance created successfully',
      performance
    });
  } catch (error) {
    console.error('Error creating performance from entry:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create performance' },
      { status: 500 }
    );
  }
} 