import { NextRequest, NextResponse } from 'next/server';
import { unifiedDb } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!query || query.length < 2) {
      return NextResponse.json({
        success: true,
        dancers: [],
        message: 'Please enter at least 2 characters to search'
      });
    }

    // Search for dancers by name, EODSA ID, or national ID
    const dancers = await unifiedDb.searchDancers(query, limit);

    // Transform dancers for participant selection
    const searchResults = dancers.map((dancer: any) => ({
      id: dancer.id,
      name: dancer.name,
      eodsaId: dancer.eodsaId,
      age: dancer.age,
      nationalId: dancer.nationalId,
      email: dancer.email,
      phone: dancer.phone,
      studioName: dancer.studioAssociation?.studioName || null,
      type: dancer.studioAssociation ? 'studio' : 'private',
      isActive: !dancer.rejectionReason, // Check if account is active
      rejectionReason: dancer.rejectionReason
    }));

    // Filter out rejected/disabled accounts
    const activeResults = searchResults.filter((dancer: any) => dancer.isActive);

    return NextResponse.json({
      success: true,
      dancers: activeResults,
      total: activeResults.length
    });

  } catch (error) {
    console.error('Error searching dancers:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to search dancers',
        dancers: []
      },
      { status: 500 }
    );
  }
} 