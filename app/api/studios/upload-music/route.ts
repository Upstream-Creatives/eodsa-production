import { NextRequest, NextResponse } from 'next/server';
import { unifiedDb } from '@/lib/database';

// Allow studios to upload music for their dancers' entries
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { studioId, entryId, musicFileUrl, musicFileName } = body;

    if (!studioId || !entryId || !musicFileUrl || !musicFileName) {
      return NextResponse.json(
        { success: false, error: 'Studio ID, entry ID, music file URL, and filename are required' },
        { status: 400 }
      );
    }

    // Verify that this entry belongs to this studio
    const studioEntries = await unifiedDb.getStudioEntries(studioId);
    const entry = studioEntries.find(e => e.id === entryId);

    if (!entry) {
      return NextResponse.json(
        { success: false, error: 'Entry not found or does not belong to this studio' },
        { status: 404 }
      );
    }

    // Verify this is a live entry that can have music
    if (entry.entryType !== 'live') {
      return NextResponse.json(
        { success: false, error: 'Only live entries can have music uploaded' },
        { status: 400 }
      );
    }

    // Update the entry with music information using the existing studio entry update method
    const updatedEntry = await unifiedDb.updateStudioEntry(studioId, entryId, {
      musicFileUrl,
      musicFileName
    });

    return NextResponse.json({
      success: true,
      message: 'Music uploaded successfully by studio',
      entry: {
        ...updatedEntry,
        musicFileUrl,
        musicFileName
      }
    });

  } catch (error: any) {
    console.error('Error uploading music for studio entry:', error);
    
    if (error.message.includes('not found') || error.message.includes('not owned')) {
      return NextResponse.json(
        { success: false, error: 'Entry not found or access denied' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to upload music' },
      { status: 500 }
    );
  }
}
