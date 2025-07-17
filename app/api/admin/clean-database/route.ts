import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function POST(request: Request) {
  try {
    // Verify this is an admin request
    const body = await request.json();
    const { adminId } = body;

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

    // Clean the database - remove all data except admin users
    await db.cleanDatabase();

    return NextResponse.json({
      success: true,
      message: 'Database cleaned successfully. All data removed. New admin: mains@elementscentral.com / 624355Mage55!'
    });
  } catch (error) {
    console.error('Error cleaning database:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to clean database' },
      { status: 500 }
    );
  }
} 