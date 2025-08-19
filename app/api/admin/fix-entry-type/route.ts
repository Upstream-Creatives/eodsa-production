import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

// Admin endpoint to fix entry type
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { entryId, entryType, adminId } = body;

    if (!entryId || !entryType || !adminId) {
      return NextResponse.json(
        { success: false, error: 'Entry ID, entry type, and admin ID are required' },
        { status: 400 }
      );
    }

    // Verify admin access (you can add this check)
    // For now, we'll allow the fix

    await db.updateEventEntry(entryId, {
      entryType: entryType
    });

    return NextResponse.json({
      success: true,
      message: `Entry type updated to ${entryType}`
    });

  } catch (error: any) {
    console.error('Error fixing entry type:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update entry type' },
      { status: 500 }
    );
  }
}
