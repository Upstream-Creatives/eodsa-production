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

    // Get certificate ID to track sent_at
    const certResult = await sqlClient`
      SELECT id FROM certificates WHERE performance_id = ${performanceId} LIMIT 1
    ` as any[];
    const certificateId = certResult.length > 0 ? certResult[0].id : null;

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

    // Send email to dancer if available (with retry logic)
    if (emailData.dancer_email) {
      let retryCount = 0;
      const maxRetries = 3;
      let dancerEmailResult = null;

      while (retryCount < maxRetries && (!dancerEmailResult || !dancerEmailResult.success)) {
        try {
          if (retryCount > 0) {
            console.log(`🔄 Retry ${retryCount} sending email to dancer: ${emailData.dancer_email}`);
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
          } else {
            console.log(`📤 Sending email to dancer: ${emailData.dancer_email}`);
          }

          dancerEmailResult = await emailService.sendCertificateAvailableEmail(
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
            
            // Update certificate sent_at if certificate exists
            if (certificateId) {
              await sqlClient`
                UPDATE certificates 
                SET sent_at = ${new Date().toISOString()}, sent_by = 'system'
                WHERE id = ${certificateId}
              `;
            }
            break;
          } else {
            retryCount++;
            if (retryCount >= maxRetries) {
              console.error(`❌ Failed to send email to dancer after ${maxRetries} attempts: ${dancerEmailResult.error}`);
              results.push({ type: 'dancer', email: emailData.dancer_email, success: false, error: dancerEmailResult.error });
            }
          }
        } catch (error) {
          retryCount++;
          if (retryCount >= maxRetries) {
            console.error('Error sending certificate email to dancer:', error);
            results.push({ type: 'dancer', email: emailData.dancer_email, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
          }
        }
      }
    }

    // Send email to studio if available (with retry logic)
    if (emailData.studio_email && emailData.studio_name) {
      let retryCount = 0;
      const maxRetries = 3;
      let studioEmailResult = null;

      while (retryCount < maxRetries && (!studioEmailResult || !studioEmailResult.success)) {
        try {
          if (retryCount > 0) {
            console.log(`🔄 Retry ${retryCount} sending email to studio: ${emailData.studio_email}`);
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
          } else {
            console.log(`📤 Sending email to studio: ${emailData.studio_email}`);
          }

          studioEmailResult = await emailService.sendCertificateAvailableEmailToStudio(
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
            break;
          } else {
            retryCount++;
            if (retryCount >= maxRetries) {
              console.error(`❌ Failed to send email to studio after ${maxRetries} attempts: ${studioEmailResult.error}`);
              results.push({ type: 'studio', email: emailData.studio_email, success: false, error: studioEmailResult.error });
            }
          }
        } catch (error) {
          retryCount++;
          if (retryCount >= maxRetries) {
            console.error('Error sending certificate email to studio:', error);
            results.push({ type: 'studio', email: emailData.studio_email, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
          }
        }
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

