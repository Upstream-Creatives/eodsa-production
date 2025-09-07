import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { approvalId, approvedBy, action, rejectionReason } = body;

    if (!approvalId || !approvedBy || !action) {
      return NextResponse.json(
        { success: false, error: 'Approval ID, approver ID, and action are required' },
        { status: 400 }
      );
    }

    let result;
    if (action === 'approve') {
      result = await db.approveScore(approvalId, approvedBy);
    } else if (action === 'reject') {
      if (!rejectionReason) {
        return NextResponse.json(
          { success: false, error: 'Rejection reason is required when rejecting' },
          { status: 400 }
        );
      }
      result = await db.rejectScore(approvalId, approvedBy, rejectionReason);
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Use "approve" or "reject"' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Score ${action}d successfully`,
      result
    });
  } catch (error) {
    console.error('Error processing score approval:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process score approval' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const performanceId = searchParams.get('performanceId');

    const approvals = await db.getScoreApprovals(performanceId || undefined);

    return NextResponse.json({
      success: true,
      approvals
    });
  } catch (error) {
    console.error('Error fetching score approvals:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch score approvals' },
      { status: 500 }
    );
  }
}

