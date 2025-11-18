import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { entryId, videoFileUrl, videoFileName, videoExternalUrl, videoExternalType, eodsaId } = body;
    
    if (!entryId || !eodsaId) {
      return NextResponse.json(
        { success: false, error: 'Entry ID and EODSA ID are required' },
        { status: 400 }
      );
    }

    // Must provide either videoExternalUrl (preferred) or videoFileUrl (legacy)
    if (!videoExternalUrl && !videoFileUrl) {
      return NextResponse.json(
        { success: false, error: 'Video URL or video file URL is required' },
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
        { success: false, error: 'Entry not found or access denied. You must be the entry owner or a group participant to upload video.' },
        { status: 404 }
      );
    }
    
    // Verify this is a virtual entry that can have video
    if (entry.entryType !== 'virtual') {
      return NextResponse.json(
        { success: false, error: 'Only virtual entries can have video uploaded' },
        { status: 400 }
      );
    }

    // Update the entry with video information
    // Prefer videoExternalUrl (link) over videoFileUrl (file upload)
    const updates: any = {};
    if (videoExternalUrl) {
      updates.videoExternalUrl = videoExternalUrl;
      if (videoExternalType) {
        updates.videoExternalType = videoExternalType;
      }
    } else if (videoFileUrl) {
      // Legacy support for file uploads
      updates.videoFileUrl = videoFileUrl;
      if (videoFileName) {
        updates.videoFileName = videoFileName;
      }
    }
    
    await db.updateEventEntry(entryId, updates);
    
    return NextResponse.json({
      success: true,
      message: videoExternalUrl ? 'Video link saved successfully' : 'Video uploaded successfully',
      entry: {
        ...entry,
        ...updates
      }
    });
    
  } catch (error: any) {
    console.error('Error uploading video for contestant entry:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
