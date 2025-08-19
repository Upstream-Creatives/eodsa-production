import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { entryId, musicFileUrl, musicFileName, eodsaId } = body;
    
    if (!entryId || !musicFileUrl || !musicFileName || !eodsaId) {
      return NextResponse.json(
        { success: false, error: 'Entry ID, music file URL, filename, and EODSA ID are required' },
        { status: 400 }
      );
    }

    // Verify the entry exists and user has access (owner OR group participant)
    const allEntries = await db.getAllEventEntries();
    const entry = allEntries.find(e => {
      if (e.id !== entryId) return false;
      
      // Allow if user is the entry owner
      if (e.eodsaId === eodsaId) return true;
      
      // Allow if user is a participant in the group entry
      if (e.participantIds && Array.isArray(e.participantIds)) {
        return e.participantIds.includes(eodsaId);
      }
      
      return false;
    });
    
    if (!entry) {
      return NextResponse.json(
        { success: false, error: 'Entry not found or access denied. You must be the entry owner or a group participant to upload music.' },
        { status: 404 }
      );
    }
    
    // Verify this is a live entry that needs music
    if (entry.entryType !== 'live') {
      return NextResponse.json(
        { success: false, error: 'Only live entries can have music uploaded' },
        { status: 400 }
      );
    }

    // Update the entry with music information
    await db.updateEventEntry(entryId, {
      musicFileUrl,
      musicFileName
    });
    
    return NextResponse.json({
      success: true,
      message: 'Music uploaded successfully',
      entry: {
        ...entry,
        musicFileUrl,
        musicFileName
      }
    });
    
  } catch (error: any) {
    console.error('Error uploading music for entry:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload music' },
      { status: 500 }
    );
  }
}
