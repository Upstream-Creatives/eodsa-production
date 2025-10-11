import { NextRequest, NextResponse } from 'next/server';
import { unifiedDb, initializeDatabase } from '@/lib/database';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    // // // await initializeDatabase() // Commented out for performance - initialization happens once on server start; // Commented out for performance - initialization happens once on server start // Commented out for performance - initialization happens once on server start
    
    const { token, newPassword } = await request.json();

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: 'Token and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Validate the reset token
    const tokenData = await unifiedDb.validatePasswordResetToken(token);
    
    if (!tokenData) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Hash the new password before storing
    const hashed = await bcrypt.hash(newPassword, 12);
    await unifiedDb.updatePassword(
      tokenData.userType, 
      tokenData.userId, 
      hashed
    );

    // Mark the token as used
    await unifiedDb.markPasswordResetTokenAsUsed(tokenData.id);

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully'
    });

  } catch (error: any) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
} 