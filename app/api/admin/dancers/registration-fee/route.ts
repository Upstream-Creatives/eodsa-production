import { NextRequest, NextResponse } from 'next/server';
import { unifiedDb, db } from '@/lib/database';

// Handle registration fee management for dancers
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dancerId, action, masteryLevel, adminId } = body;

    if (!dancerId || !action || !adminId) {
      return NextResponse.json(
        { error: 'Dancer ID, action, and admin ID are required' },
        { status: 400 }
      );
    }

    // Verify admin authentication - use db.getJudgeById since it's in the main db object
    const admin = await db.getJudgeById(adminId);
    if (!admin || !admin.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }

    if (action === 'mark_paid') {
      if (!masteryLevel) {
        return NextResponse.json(
          { error: 'Mastery level is required when marking registration fee as paid' },
          { status: 400 }
        );
      }

      // Mark registration fee as paid
      const result = await unifiedDb.markRegistrationFeePaid(dancerId, masteryLevel);
      
      return NextResponse.json({
        success: true,
        message: `Registration fee marked as paid for ${masteryLevel} level`
      });
      
    } else if (action === 'mark_unpaid') {
      // Mark registration fee as unpaid (reset to default state)
      await unifiedDb.markRegistrationFeeUnpaid(dancerId);
      
      return NextResponse.json({
        success: true,
        message: 'Registration fee marked as unpaid'
      });
      
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "mark_paid" or "mark_unpaid"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Registration fee management error:', error);
    return NextResponse.json(
      { error: 'Failed to update registration fee status' },
      { status: 500 }
    );
  }
}