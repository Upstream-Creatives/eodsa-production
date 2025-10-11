import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { certificateId, sentBy } = await request.json();

    if (!certificateId) {
      return NextResponse.json(
        { error: 'Certificate ID is required' },
        { status: 400 }
      );
    }

    const sqlClient = getSql();
    const sentAt = new Date().toISOString();

    // Get certificate details
    const certResult = await sqlClient`
      SELECT * FROM certificates WHERE id = ${certificateId}
    ` as any[];

    if (certResult.length === 0) {
      return NextResponse.json(
        { error: 'Certificate not found' },
        { status: 404 }
      );
    }

    const certificate = certResult[0];

    // In a real implementation, you would send an email here
    // For now, we'll just mark it as sent
    
    // TODO: Implement email sending with Resend or similar service
    // Example:
    // await resend.emails.send({
    //   from: 'certificates@avalondance.co.za',
    //   to: certificate.email,
    //   subject: 'Your EODSA Certificate',
    //   html: `...certificate email template...`,
    //   attachments: [{ filename: 'certificate.jpg', path: certificate.certificate_url }]
    // });

    // Update certificate as sent
    await sqlClient`
      UPDATE certificates 
      SET sent_at = ${sentAt}, sent_by = ${sentBy || 'admin'}
      WHERE id = ${certificateId}
    `;

    return NextResponse.json({
      success: true,
      message: `Certificate sent to ${certificate.email || certificate.dancer_name}`
    });

  } catch (error) {
    console.error('Error sending certificate:', error);
    return NextResponse.json(
      { error: 'Failed to send certificate' },
      { status: 500 }
    );
  }
}

