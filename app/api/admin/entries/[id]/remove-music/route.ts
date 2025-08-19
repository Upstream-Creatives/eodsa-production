import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entryId = id;
    
    const body = await request.json();
    const { adminId } = body;
    
    // Verify admin authentication
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: 'Admin ID required' },
        { status: 400 }
      );
    }

    // Verify the user is actually an admin
    const admin = await db.getJudgeById(adminId);
    if (!admin || !admin.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }
    
    // Get the current entry to verify it exists
    const allEntries = await db.getAllEventEntries();
    const entry = allEntries.find(e => e.id === entryId);
    
    if (!entry) {
      return NextResponse.json(
        { success: false, error: 'Event entry not found' },
        { status: 404 }
      );
    }

    // Remove music file information from the entry
    await db.updateEventEntry(entryId, {
      musicFileUrl: null,
      musicFileName: null
    });
    
    return NextResponse.json({
      success: true,
      message: 'Music removed successfully. Entry will now appear in contestant\'s upload dashboard.',
      entry: {
        ...entry,
        musicFileUrl: null,
        musicFileName: null
      }
    });
    
  } catch (error: any) {
    console.error('Error removing music from entry:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove music' },
      { status: 500 }
    );
  }
}
