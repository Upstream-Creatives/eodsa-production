import { NextRequest, NextResponse } from 'next/server';
import { studioDb } from '@/lib/database';
import { emailService } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find studio by email
    const studio = await studioDb.getStudioByEmail(email);

    if (!studio) {
      return NextResponse.json(
        { error: 'Email not found' },
        { status: 404 }
      );
    }

    // Send password directly via email
    const emailResult = await emailService.sendStudioPasswordEmail(
      studio.email,
      studio.name,
      studio.password
    );

    if (!emailResult.success) {
      console.error('Failed to send password email:', emailResult.error);
      return NextResponse.json(
        { error: 'Failed to send password email. Please try again later.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Your password has been sent to your email address'
    });

  } catch (error: any) {
    console.error('Studio password recovery error:', error);
    return NextResponse.json(
      { error: 'Failed to process password recovery request' },
      { status: 500 }
    );
  }
}
