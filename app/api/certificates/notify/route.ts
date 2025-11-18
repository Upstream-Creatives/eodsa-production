import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';
import { emailService } from '@/lib/email';

/**
 * POST /api/certificates/notify
 * Send email notifications when a certificate is generated
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      performanceId,
      eventEntryId,
      certificateUrl,
      dancerName,
      performanceTitle,
      percentage,
      medallion
    } = body;

    if (!performanceId || !eventEntryId || !certificateUrl) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const sqlClient = getSql();

    // Get dancer and studio emails
    const emailResult = await sqlClient`
      SELECT 
        d.email as dancer_email,
        d.name as dancer_name,
        c.email as studio_email,
        c.studio_name,
        ee.participant_ids
      FROM event_entries ee
      LEFT JOIN dancers d ON ee.eodsa_id = d.eodsa_id
      LEFT JOIN contestants c ON ee.contestant_id = c.id
      WHERE ee.id = ${eventEntryId}
    ` as any[];

    if (emailResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Event entry not found' },
        { status: 404 }
      );
    }

    const emailData = emailResult[0];
    const results = [];

    console.log(`📧 Certificate notification request for performance ${performanceId}:`);
    console.log(`   - Event Entry ID: ${eventEntryId}`);
    console.log(`   - Dancer Email: ${emailData.dancer_email || 'NOT FOUND'}`);
    console.log(`   - Studio Email: ${emailData.studio_email || 'NOT FOUND'}`);
    console.log(`   - Studio Name: ${emailData.studio_name || 'NOT FOUND'}`);

    // Send email to dancer if available
    if (emailData.dancer_email) {
      try {
        console.log(`📤 Sending email to dancer: ${emailData.dancer_email}`);
        const dancerEmailResult = await emailService.sendCertificateAvailableEmail(
          emailData.dancer_name || dancerName,
          emailData.dancer_email,
          certificateUrl,
          performanceTitle || '',
          percentage,
          medallion
        );
        if (dancerEmailResult.success) {
          console.log(`✅ Email sent successfully to dancer: ${emailData.dancer_email}`);
          results.push({ type: 'dancer', email: emailData.dancer_email, success: true });
        } else {
          console.error(`❌ Failed to send email to dancer: ${dancerEmailResult.error}`);
          results.push({ type: 'dancer', email: emailData.dancer_email, success: false, error: dancerEmailResult.error });
        }
      } catch (error) {
        console.error('Error sending certificate email to dancer:', error);
        results.push({ type: 'dancer', email: emailData.dancer_email, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    // Send email to studio if available
    if (emailData.studio_email && emailData.studio_name) {
      try {
        console.log(`📤 Sending email to studio: ${emailData.studio_email}`);
        const studioEmailResult = await emailService.sendCertificateAvailableEmailToStudio(
          emailData.studio_name,
          emailData.studio_email,
          dancerName,
          certificateUrl,
          performanceTitle || '',
          percentage,
          medallion
        );
        if (studioEmailResult.success) {
          console.log(`✅ Email sent successfully to studio: ${emailData.studio_email}`);
          results.push({ type: 'studio', email: emailData.studio_email, success: true });
        } else {
          console.error(`❌ Failed to send email to studio: ${studioEmailResult.error}`);
          results.push({ type: 'studio', email: emailData.studio_email, success: false, error: studioEmailResult.error });
        }
      } catch (error) {
        console.error('Error sending certificate email to studio:', error);
        results.push({ type: 'studio', email: emailData.studio_email, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    const allSuccessful = results.every(r => r.success);
    const hasEmails = results.length > 0;
    
    if (!hasEmails) {
      console.log(`⚠️ No email addresses found for event entry ${eventEntryId}`);
      return NextResponse.json({
        success: false,
        message: 'No email addresses found for this event entry',
        results: []
      });
    }

    console.log(`📧 Email notification summary: ${results.filter(r => r.success).length}/${results.length} sent successfully`);
    
    return NextResponse.json({
      success: allSuccessful,
      message: hasEmails ? `Email notifications sent: ${results.filter(r => r.success).length}/${results.length} successful` : 'No email addresses found',
      results
    });

  } catch (error) {
    console.error('Error in certificate notification API:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to send certificate notifications',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

