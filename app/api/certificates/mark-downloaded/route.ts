import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { certificateId } = await request.json();

    if (!certificateId) {
      return NextResponse.json(
        { error: 'Certificate ID is required' },
        { status: 400 }
      );
    }

    const sqlClient = getSql();
    const downloadedAt = new Date().toISOString();

    await sqlClient`
      UPDATE certificates 
      SET downloaded = true, downloaded_at = ${downloadedAt}
      WHERE id = ${certificateId}
    `;

    return NextResponse.json({
      success: true,
      message: 'Certificate marked as downloaded'
    });

  } catch (error) {
    console.error('Error marking certificate as downloaded:', error);
    return NextResponse.json(
      { error: 'Failed to update certificate' },
      { status: 500 }
    );
  }
}

