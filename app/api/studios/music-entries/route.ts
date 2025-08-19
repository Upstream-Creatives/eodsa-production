import { NextRequest, NextResponse } from 'next/server';
import { unifiedDb } from '@/lib/database';

// Get all live entries for a studio's dancers that need music upload
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studioId = searchParams.get('studioId');

    if (!studioId) {
      return NextResponse.json(
        { success: false, error: 'Studio ID is required' },
        { status: 400 }
      );
    }

    // Get all entries for this studio
    const allEntries = await unifiedDb.getStudioEntries(studioId);
    
    // Filter for live entries that don't have music yet
    const entriesNeedingMusic = allEntries.filter(entry => 
      entry.entryType === 'live' && !entry.musicFileUrl
    );

    // Enhance entries with additional details
    const entriesWithDetails = entriesNeedingMusic.map(entry => ({
      ...entry,
      performanceType: getPerformanceType(entry.participantIds?.length || 1),
      isGroupEntry: entry.participantIds && entry.participantIds.length > 1
    }));

    return NextResponse.json({
      success: true,
      entries: entriesWithDetails,
      total: entriesWithDetails.length
    });

  } catch (error: any) {
    console.error('Error fetching studio music entries:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch entries needing music' },
      { status: 500 }
    );
  }
}

// Helper function to determine performance type from participant count
function getPerformanceType(participantCount: number): string {
  if (participantCount === 1) return 'Solo';
  if (participantCount === 2) return 'Duet';
  if (participantCount === 3) return 'Trio';
  return 'Group';
}
