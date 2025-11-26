import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';
import { emailService } from '@/lib/email';

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

    // Get certificate details with performance and event entry info
    const certResult = await sqlClient`
      SELECT 
        c.*,
        p.id as performance_id,
        p.title as performance_title,
        p.event_entry_id,
        ee.contestant_id,
        ee.eodsa_id
      FROM certificates c
      LEFT JOIN performances p ON p.id = c.performance_id
      LEFT JOIN event_entries ee ON ee.id = p.event_entry_id
      WHERE c.id = ${certificateId}
    ` as any[];

    if (certResult.length === 0) {
      return NextResponse.json(
        { error: 'Certificate not found' },
        { status: 404 }
      );
    }

    const certificate = certResult[0];

    // Send email notification using the notify route logic
    let emailSent = false;
    let emailError = null;

    if (certificate.performance_id && certificate.event_entry_id) {
      try {
        // Get dancer and studio emails
        const emailResult = await sqlClient`
          SELECT 
            d.email as dancer_email,
            d.name as dancer_name,
            d.guardian_email,
            c.email as studio_email,
            c.studio_name
          FROM event_entries ee
          LEFT JOIN dancers d ON ee.eodsa_id = d.eodsa_id
          LEFT JOIN contestants c ON ee.contestant_id = c.id
          WHERE ee.id = ${certificate.event_entry_id}
        ` as any[];

        if (emailResult.length > 0) {
          const emailData = emailResult[0];
          const certificateUrl = certificate.certificate_url || 
            `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/certificates/${certificate.performance_id}`;

          // Send to dancer email (or guardian email for minors)
          const recipientEmail = emailData.dancer_email || emailData.guardian_email;
          if (recipientEmail) {
            try {
              const emailResult = await emailService.sendCertificateAvailableEmail(
                emailData.dancer_name || certificate.dancer_name,
                recipientEmail,
                certificateUrl,
                certificate.performance_title || certificate.title || '',
                certificate.percentage || 0,
                certificate.medallion || ''
              );
              emailSent = emailResult.success;
              if (!emailResult.success) {
                emailError = emailResult.error;
              }
            } catch (error) {
              emailError = error instanceof Error ? error.message : 'Unknown error';
            }
          }

          // Also send to studio if available
          if (emailData.studio_email && emailData.studio_name) {
            try {
              await emailService.sendCertificateAvailableEmailToStudio(
                emailData.studio_name,
                emailData.studio_email,
                emailData.dancer_name || certificate.dancer_name,
                certificateUrl,
                certificate.performance_title || certificate.title || '',
                certificate.percentage || 0,
                certificate.medallion || ''
              );
            } catch (error) {
              console.error('Failed to send certificate email to studio:', error);
              // Don't fail the whole operation if studio email fails
            }
          }
        }
      } catch (error) {
        console.error('Error sending certificate email:', error);
        emailError = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    // Update certificate as sent (even if email failed, mark as attempted)
    await sqlClient`
      UPDATE certificates 
      SET sent_at = ${sentAt}, sent_by = ${sentBy || 'admin'}
      WHERE id = ${certificateId}
    `;

    if (emailSent) {
      return NextResponse.json({
        success: true,
        message: `Certificate sent successfully to ${certificate.email || certificate.dancer_name}`
      });
    } else if (emailError) {
      return NextResponse.json({
        success: false,
        message: `Certificate marked as sent but email failed: ${emailError}`,
        error: emailError
      }, { status: 500 });
    } else {
      return NextResponse.json({
        success: true,
        message: `Certificate marked as sent (no email address found)`
      });
    }

  } catch (error) {
    console.error('Error sending certificate:', error);
    return NextResponse.json(
      { error: 'Failed to send certificate', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

