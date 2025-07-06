import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    
    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    // Get all approved nationals event entries for this event
    const allEntries = await db.getAllNationalsEventEntries();
    const eventEntries = allEntries.filter(entry => 
      entry.nationalsEventId === eventId && entry.approved
    );

    // Convert entries to performances
    const performances = eventEntries.map(entry => ({
      id: `nationals-${entry.id}`,
      nationalsEventId: entry.nationalsEventId,
      entryId: entry.id,
      itemName: entry.itemName,
      contestantName: entry.contestantName,
      participantNames: entry.participantIds || [],
      choreographer: entry.choreographer,
      mastery: entry.mastery,
      itemStyle: entry.itemStyle,
      performanceType: entry.performanceType,
      ageCategory: entry.ageCategory,
      itemNumber: entry.itemNumber,
      duration: entry.estimatedDuration,
      soloCount: entry.soloCount || 1,
      status: 'ready'
    }));

    // Sort by item number
    performances.sort((a, b) => {
      if (a.itemNumber && b.itemNumber) {
        return a.itemNumber - b.itemNumber;
      } else if (a.itemNumber && !b.itemNumber) {
        return -1;
      } else if (!a.itemNumber && b.itemNumber) {
        return 1;
      } else {
        return a.itemName.localeCompare(b.itemName);
      }
    });

    return NextResponse.json({
      success: true,
      performances
    });

  } catch (error) {
    console.error('Error fetching nationals performances:', error);
    return NextResponse.json(
      { error: 'Failed to fetch nationals performances' },
      { status: 500 }
    );
  }
} 