import { NextResponse } from 'next/server';
import { studioDb } from '@/lib/database';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Studio ID is required' },
        { status: 400 }
      );
    }

    // Get studio details
    const studio = await studioDb.getStudioById(id);
    
    if (!studio) {
      return NextResponse.json(
        { success: false, error: 'Studio not found' },
        { status: 404 }
      );
    }

    // TODO: Implement getDancersByStudio and getEntriesByStudio methods
    // For now, return basic studio info
    const detailedStudio = {
      ...studio,
      dancers: [], // Placeholder - implement later
      entries: [], // Placeholder - implement later
      dancerCount: 0 // Placeholder - implement later
    };

    return NextResponse.json({
      success: true,
      studio: detailedStudio
    });
  } catch (error) {
    console.error('Error fetching studio details:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch studio details' },
      { status: 500 }
    );
  }
}

