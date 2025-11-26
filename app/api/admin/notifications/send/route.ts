import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';
import emailService from '@/lib/email';

// Ensure Node.js runtime so we can use the existing transporter in lib/email
export const runtime = 'nodejs';

type RecipientGroup =
  | 'dancers'
  | 'studios'
  | 'staff'
  | 'event_participants'
  | 'dancers_and_studios';

interface NotificationPayload {
  recipientGroup: RecipientGroup;
  province?: string | null;
  eventId?: string | null;
  subject: string;
  bodyHtml: string;
  sentBy?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as NotificationPayload;
    const {
      recipientGroup,
      province,
      eventId,
      subject,
      bodyHtml,
      sentBy
    } = body;

    if (!recipientGroup || !subject || !bodyHtml) {
      return NextResponse.json(
        {
          success: false,
          error: 'recipientGroup, subject and bodyHtml are required'
        },
        { status: 400 }
      );
    }

    const sqlClient = getSql();
    const normalizedProvince =
      province && province !== 'all' ? province.toLowerCase() : null;

    // Collect recipients
    type Recipient = { email: string; name: string | null };
    const recipients: Recipient[] = [];

    const includeDancers =
      recipientGroup === 'dancers' ||
      recipientGroup === 'event_participants' ||
      recipientGroup === 'dancers_and_studios';

    const includeStudios =
      recipientGroup === 'studios' ||
      recipientGroup === 'event_participants' ||
      recipientGroup === 'dancers_and_studios';

    if (includeDancers) {
      let rows: any[] = [];

      if (recipientGroup === 'event_participants' && eventId) {
        // Dancers who are participants in a specific event
        if (normalizedProvince) {
          rows = await sqlClient`
            SELECT DISTINCT d.email, d.guardian_email, d.name, d.province
            FROM dancers d
            JOIN event_entries ee ON ee.eodsa_id = d.eodsa_id
            WHERE ee.event_id = ${eventId} AND LOWER(d.province) = ${normalizedProvince}
          ` as any[];
        } else {
          rows = await sqlClient`
            SELECT DISTINCT d.email, d.guardian_email, d.name, d.province
            FROM dancers d
            JOIN event_entries ee ON ee.eodsa_id = d.eodsa_id
            WHERE ee.event_id = ${eventId}
          ` as any[];
        }
      } else {
        // All dancers (optionally filtered by province)
        if (normalizedProvince) {
          rows = await sqlClient`
            SELECT DISTINCT d.email, d.guardian_email, d.name, d.province
            FROM dancers d
            WHERE LOWER(d.province) = ${normalizedProvince}
          ` as any[];
        } else {
          rows = await sqlClient`
            SELECT DISTINCT d.email, d.guardian_email, d.name, d.province
            FROM dancers d
          ` as any[];
        }
      }

      for (const row of rows) {
        const primaryEmail = row.email || row.guardian_email;
        if (!primaryEmail) continue;

        recipients.push({
          email: primaryEmail,
          name: row.name || null
        });
      }
    }

    if (includeStudios) {
      // Studios: either all studios or event-specific contestants
      if (recipientGroup === 'studios' || recipientGroup === 'dancers_and_studios') {
        const rows = await sqlClient`
          SELECT DISTINCT s.email, s.name
          FROM studios s
        ` as any[];

        for (const row of rows) {
          if (!row.email) continue;
          recipients.push({
            email: row.email,
            name: row.name || null
          });
        }
      } else if (recipientGroup === 'event_participants' && eventId) {
        const rows = await sqlClient`
          SELECT DISTINCT c.email, c.studio_name
          FROM event_entries ee
          JOIN contestants c ON c.id = ee.contestant_id
          WHERE ee.event_id = ${eventId}
        ` as any[];

        for (const row of rows) {
          if (!row.email) continue;
          recipients.push({
            email: row.email,
            name: row.studio_name || null
          });
        }
      }
    }

    if (recipientGroup === 'staff') {
      // All internal staff/admin users:
      // 1) clients table (admin-created dashboard accounts)
      const clientRows = await sqlClient`
        SELECT DISTINCT email, name
        FROM clients
        WHERE email IS NOT NULL AND email <> '' AND is_active = TRUE
      ` as any[];

      for (const row of clientRows) {
        recipients.push({
          email: row.email,
          name: row.name || null
        });
      }

      // 2) judges table with non-judge user_type (staff/admin/superadmin)
      const judgeRows = await sqlClient`
        SELECT DISTINCT email, name
        FROM judges
        WHERE email IS NOT NULL 
          AND email <> '' 
          AND user_type IN ('staff', 'admin', 'superadmin')
      ` as any[];

      for (const row of judgeRows) {
        recipients.push({
          email: row.email,
          name: row.name || null
        });
      }
    }

    // De-duplicate recipients by email
    const uniqueMap = new Map<string, Recipient>();
    for (const r of recipients) {
      const key = r.email.toLowerCase().trim();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, r);
      }
    }
    const uniqueRecipients = Array.from(uniqueMap.values());

    if (uniqueRecipients.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No recipients found for the selected filters'
      });
    }

    // Send announcements in a simple loop using shared transporter in emailService
    const results: Array<{ email: string; success: boolean; error?: string }> = [];

    for (const recipient of uniqueRecipients) {
      try {
        const sendResult = await (emailService as any).sendAnnouncementEmail(
          recipient.email,
          subject,
          bodyHtml
        );

        if (sendResult && sendResult.success) {
          results.push({ email: recipient.email, success: true });
        } else {
          results.push({
            email: recipient.email,
            success: false,
            error: sendResult?.error || 'Unknown error'
          });
        }
      } catch (err: any) {
        console.error('Failed to send announcement to', recipient.email, err);
        results.push({
          email: recipient.email,
          success: false,
          error: err?.message || 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      message: `Announcement sent to ${successCount}/${uniqueRecipients.length} recipients`,
      totalRecipients: uniqueRecipients.length,
      successCount,
      failureCount: uniqueRecipients.length - successCount,
      results
    });
  } catch (error: any) {
    console.error('Error sending admin announcement:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to send announcements',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}


