import { NextResponse } from 'next/server';
import { unifiedDb } from '@/lib/database';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Dancer ID is required' },
        { status: 400 }
      );
    }

    // Get dancer details including studio affiliations and entries
    const dancer = await unifiedDb.getDancerById(id);
    
    if (!dancer) {
      return NextResponse.json(
        { success: false, error: 'Dancer not found' },
        { status: 404 }
      );
    }

    // TODO: Implement getStudioApplicationsByDancer and getEntriesByDancer methods
    // For now, return basic dancer info
    const detailedDancer = {
      ...dancer,
      studioAffiliations: [], // Placeholder - implement later
      entries: [] // Placeholder - implement later
    };

    return NextResponse.json({
      success: true,
      dancer: detailedDancer
    });
  } catch (error) {
    console.error('Error fetching dancer details:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dancer details' },
      { status: 500 }
    );
  }
}

