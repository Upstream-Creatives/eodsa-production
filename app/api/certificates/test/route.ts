import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/email';
import { getMedalFromPercentage, formatCertificateDate } from '@/lib/certificate-generator';

/**
 * POST /api/certificates/test
 * Test certificate generation and email sending
 */
export async function POST(request: NextRequest) {
  try {
    const { email, dancerName, percentage, style, title } = await request.json();

    // Use provided data or defaults
    const testData = {
      dancerName: dancerName || 'Test Dancer',
      percentage: percentage || 87,
      style: style || 'Contemporary',
      title: title || 'Rising Phoenix',
      email: email || 'solisangelo882@gmail.com'
    };

    // Calculate medallion
    const medallion = getMedalFromPercentage(testData.percentage);

    // Create certificate URL (test)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const certificateUrl = `${appUrl}/certificates/test`;

    console.log('🧪 Testing certificate email with data:', {
      ...testData,
      medallion,
      certificateUrl
    });

    // Send test certificate email
    const emailResult = await emailService.sendCertificateEmail(
      testData.dancerName,
      testData.email,
      testData.percentage,
      medallion,
      certificateUrl
    );

    if (!emailResult.success) {
      return NextResponse.json(
        {
          error: 'Failed to send test certificate email',
          details: emailResult.error
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Test certificate sent successfully!',
      data: {
        recipient: testData.email,
        dancerName: testData.dancerName,
        percentage: testData.percentage,
        medallion,
        style: testData.style,
        title: testData.title,
        certificateUrl
      }
    });

  } catch (error) {
    console.error('Error sending test certificate:', error);
    return NextResponse.json(
      {
        error: 'Failed to send test certificate',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
