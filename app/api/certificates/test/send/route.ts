import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/email';

/**
 * POST /api/certificates/test/send
 * Send test certificate email
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dancerName, email, percentage, medallion } = body;

    // Validate required fields
    if (!dancerName || !email || !percentage || !medallion) {
      return NextResponse.json(
        { error: 'Missing required fields: dancerName, email, percentage, medallion' },
        { status: 400 }
      );
    }

    // Build certificate URL with custom data
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const params = new URLSearchParams({
      dancerName: body.dancerName,
      percentage: body.percentage.toString(),
      style: body.style || 'CONTEMPORARY',
      title: body.title || 'RISING PHOENIX',
      medallion: body.medallion,
      date: body.date || '4 October 2025'
    });
    const certificateUrl = `${appUrl}/api/certificates/test/image?${params.toString()}`;

    // Send certificate email
    const result = await emailService.sendCertificateEmail(
      dancerName,
      email,
      percentage,
      medallion,
      certificateUrl
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Certificate sent successfully to ${email}`,
        email
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error sending test certificate email:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to send test certificate email',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
