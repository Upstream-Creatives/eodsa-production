import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { entryType } = body;

    // Validate entry type
    if (!entryType || !['live', 'virtual'].includes(entryType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid entry type. Must be "live" or "virtual"' },
        { status: 400 }
      );
    }

    const sqlClient = getSql();

    // Update the entry type
    await sqlClient`
      UPDATE event_entries
      SET entry_type = ${entryType}
      WHERE id = ${id}
    `;

    return NextResponse.json({
      success: true,
      message: `Entry updated to ${entryType} successfully`,
      entryType
    });
  } catch (error) {
    console.error('Error updating entry type:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update entry type' },
      { status: 500 }
    );
  }
}

