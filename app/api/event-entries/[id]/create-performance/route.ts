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

    // Check if performance already exists for this entry
    const existingPerformances = await db.getAllPerformances();
    const existingPerformance = existingPerformances.find(p => p.eventEntryId === entryId);
    
    if (existingPerformance) {
      return NextResponse.json({
        success: true,
        message: 'Performance already exists for this entry',
        performance: existingPerformance
      });
    }

    // Create the performance
    const performance = await db.createPerformance({
      eventId: entry.eventId,
      eventEntryId: entry.id,
      contestantId: entry.contestantId,
      title: entry.itemName,
      participantNames,
      duration: entry.estimatedDuration,
      itemNumber: entry.itemNumber, // Copy item number from entry
      choreographer: entry.choreographer,
      mastery: entry.mastery,
      itemStyle: entry.itemStyle,
      status: 'scheduled'
    });

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