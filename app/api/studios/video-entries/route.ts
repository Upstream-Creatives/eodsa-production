import { NextRequest, NextResponse } from 'next/server';
import { unifiedDb } from '@/lib/database';

// Get all virtual entries for a studio's dancers that need video upload
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
    
    // Filter for virtual entries that don't have video yet
    const entriesNeedingVideo = allEntries.filter(entry =>
      entry.entryType === 'virtual' &&
      entry.eventType !== 'AUDITION_EVENT' &&
      !entry.videoFileUrl &&
      !entry.videoExternalUrl
    );

    // Enhance entries with additional details
    const entriesWithDetails = entriesNeedingVideo.map(entry => ({
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
    console.error('Error fetching studio video entries:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch entries needing video' },
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
