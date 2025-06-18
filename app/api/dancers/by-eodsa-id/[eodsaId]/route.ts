import { NextRequest, NextResponse } from 'next/server';
import { unifiedDb, initializeDatabase } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eodsaId: string }> }
) {
  try {
    await initializeDatabase();
    
    const { eodsaId } = await params;

    if (!eodsaId) {
      return NextResponse.json(
        { error: 'EODSA ID is required' },
        { status: 400 }
      );
    }

    // Get dancer by EODSA ID
    const dancer = await unifiedDb.getDancerByEodsaId(eodsaId);

    if (!dancer) {
      return NextResponse.json(
        { error: 'Dancer not found with this EODSA ID' },
        { status: 404 }
      );
    }

    // Get dancer's studio applications to determine studio association
    const applications = await unifiedDb.getDancerApplications(dancer.id);
    const acceptedApplication = applications.find(app => app.status === 'accepted');

    // Enhance dancer data with studio information
    const enhancedDancer = {
      ...dancer,
      studioAssociation: acceptedApplication ? {
        studioId: acceptedApplication.studioId,
        studioName: acceptedApplication.studio.name,
        joinedAt: acceptedApplication.respondedAt
      } : null
    };

    return NextResponse.json({
      success: true,
      dancer: enhancedDancer
    });
  } catch (error) {
    console.error('Error getting dancer by EODSA ID:', error);
    return NextResponse.json(
      { error: 'Failed to get dancer data' },
      { status: 500 }
    );
  }
} 