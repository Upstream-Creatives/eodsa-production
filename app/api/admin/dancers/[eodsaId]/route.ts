import { NextRequest, NextResponse } from 'next/server';
import { unifiedDb, db } from '@/lib/database';

// Update dancer information (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { updates, adminId } = body;

    if (!adminId) {
      return NextResponse.json(
        { error: 'Admin ID is required' },
        { status: 400 }
      );
    }

    // Verify admin authentication
    const admin = await db.getJudgeById(adminId);
    if (!admin || !admin.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }

    if (!updates || Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No updates provided' },
        { status: 400 }
      );
    }

    // Calculate age if dateOfBirth is being updated
    if (updates.dateOfBirth) {
      const birthDate = new Date(updates.dateOfBirth);
      const today = new Date();
      let calculatedAge = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        calculatedAge--;
      }
      updates.age = calculatedAge;
    }

    // Update dancer information
    await unifiedDb.updateDancer(id, updates);

    return NextResponse.json({
      success: true,
      message: 'Dancer updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating dancer:', error);
    
    if (error.message) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update dancer' },
      { status: 500 }
    );
  }
}

