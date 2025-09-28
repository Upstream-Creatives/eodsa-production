// Process Entries After Payment API
// POST /api/payments/process-entries
// Creates entries after successful payment verification

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { autoMarkRegistrationForParticipants } from '@/lib/registration-fee-tracker';
import { db, unifiedDb } from '@/lib/database';

const sql = neon(process.env.DATABASE_URL!);

interface EntryData {
  eventId: string;
  contestantId: string;
  eodsaId: string;
  participantIds: string[];
  calculatedFee: number;
  itemName: string;
  choreographer: string;
  mastery: string;
  itemStyle: string;
  estimatedDuration: number;
  entryType?: 'live' | 'virtual';
  musicFileUrl?: string;
  musicFileName?: string;
  videoExternalUrl?: string;
  videoExternalType?: string;
  performanceType: string;
}

export async function POST(request: NextRequest) {
  try {
    const { payment_id, entries }: { payment_id: string; entries: EntryData[] } = await request.json();

    if (!payment_id || !entries || !Array.isArray(entries)) {
      return NextResponse.json({
        success: false,
        error: 'Payment ID and entries array are required'
      }, { status: 400 });
    }

    // Verify payment was successful
    const [payment] = await sql`
      SELECT * FROM payments 
      WHERE payment_id = ${payment_id} AND status = 'completed'
    `;

    if (!payment) {
      return NextResponse.json({
        success: false,
        error: 'Payment not found or not completed'
      }, { status: 404 });
    }

    // Check if entries were already created for this payment
    const existingEntries = await sql`
      SELECT id FROM event_entries WHERE payment_id = ${payment_id}
    `;

    if (existingEntries.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Entries already created for this payment',
        entryIds: existingEntries.map(e => e.id)
      }, { status: 400 });
    }

    const createdEntries = [];
    const errors = [];

    // Create each entry
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      
      try {
        console.log(`📝 Creating entry ${i + 1}/${entries.length}:`, {
          itemName: entry.itemName,
          performanceType: entry.performanceType,
          fee: entry.calculatedFee
        });

        // Create event entry with payment reference
        const eventEntry = await db.createEventEntry({
          eventId: entry.eventId,
          contestantId: entry.contestantId,
          eodsaId: entry.eodsaId,
          participantIds: entry.participantIds,
          calculatedFee: entry.calculatedFee,
          paymentStatus: 'paid', // Mark as paid since payment was successful
          paymentMethod: 'payfast',
          approved: true, // AUTO-APPROVE: Entries are automatically approved after successful payment
          qualifiedForNationals: true,
          itemNumber: undefined,
          itemName: entry.itemName,
          choreographer: entry.choreographer,
          mastery: entry.mastery,
          itemStyle: entry.itemStyle,
          estimatedDuration: entry.estimatedDuration,
          entryType: entry.entryType || 'live',
          musicFileUrl: entry.musicFileUrl || undefined,
          musicFileName: entry.musicFileName || undefined,
          videoFileUrl: undefined,
          videoFileName: undefined,
          videoExternalUrl: entry.videoExternalUrl || undefined,
          videoExternalType: (entry.videoExternalType && ['youtube', 'vimeo', 'other'].includes(entry.videoExternalType)) 
            ? entry.videoExternalType as 'youtube' | 'vimeo' | 'other' 
            : undefined
        });

        // Update the entry with payment ID
        await sql`
          UPDATE event_entries 
          SET payment_id = ${payment_id}
          WHERE id = ${eventEntry.id}
        `;

        // Auto-create performance for this approved entry (idempotent)
        try {
          const existingPerformances = await db.getAllPerformances();
          const alreadyExists = existingPerformances.some(p => p.eventEntryId === eventEntry.id);
          if (!alreadyExists) {
            // Build participant names using unified dancers when available
            const participantNames: string[] = [];
            try {
              for (let i = 0; i < entry.participantIds.length; i++) {
                const pid = entry.participantIds[i];
                try {
                  const dancer = await unifiedDb.getDancerById(pid);
                  if (dancer?.name) {
                    participantNames.push(dancer.name);
                    continue;
                  }
                } catch {}
                participantNames.push(`Participant ${i + 1}`);
              }
            } catch {
              // Fallback
              entry.participantIds.forEach((_, i) => participantNames.push(`Participant ${i + 1}`));
            }

            await db.createPerformance({
              eventId: entry.eventId,
              eventEntryId: eventEntry.id,
              contestantId: entry.contestantId,
              title: entry.itemName,
              participantNames,
              duration: entry.estimatedDuration || 0,
              choreographer: entry.choreographer,
              mastery: entry.mastery,
              itemStyle: entry.itemStyle,
              status: 'scheduled',
              itemNumber: undefined
            });
          }
        } catch (perfErr) {
          console.warn('⚠️ Failed to auto-create performance for entry', eventEntry.id, perfErr);
        }

        // Auto-mark registration fees as paid for all participants since entry is paid
        if (entry.participantIds && entry.participantIds.length > 0 && entry.mastery) {
          try {
            const registrationResults = await autoMarkRegistrationForParticipants(entry.participantIds, entry.mastery);
            console.log(`Registration fee auto-marking results for entry ${eventEntry.id}:`, registrationResults);
          } catch (error) {
            console.error('Failed to auto-mark registration fees on payment processing:', error);
          }
        }

        createdEntries.push({
          entryId: eventEntry.id,
          itemName: entry.itemName,
          performanceType: entry.performanceType,
          fee: entry.calculatedFee
        });

        console.log(`✅ Entry ${eventEntry.id} created successfully`);

      } catch (error: any) {
        console.error(`❌ Error creating entry ${i + 1}:`, error);
        errors.push({
          entryIndex: i,
          itemName: entry.itemName,
          error: error.message || 'Unknown error'
        });
      }
    }

    // Log the entry creation in payment logs
    await sql`
      INSERT INTO payment_logs (payment_id, event_type, event_data, ip_address, user_agent)
      VALUES (
        ${payment_id}, 'entries_created',
        ${JSON.stringify({
          created_count: createdEntries.length,
          error_count: errors.length,
          entries: createdEntries,
          errors: errors.length > 0 ? errors : undefined
        })},
        ${request.headers.get('x-forwarded-for') || 'unknown'},
        ${request.headers.get('user-agent') || 'unknown'}
      )
    `;

    // Return results
    if (createdEntries.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Failed to create any entries',
        errors
      }, { status: 500 });
    }

    if (errors.length > 0) {
      return NextResponse.json({
        success: true,
        warning: `Created ${createdEntries.length} entries with ${errors.length} errors`,
        entries: createdEntries,
        errors
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully created ${createdEntries.length} entries`,
      entries: createdEntries,
      payment_id
    });

  } catch (error) {
    console.error('💥 Process entries error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// Handle GET requests to check if entries were processed
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const paymentId = searchParams.get('payment_id');

    if (!paymentId) {
      return NextResponse.json({
        success: false,
        error: 'Payment ID is required'
      }, { status: 400 });
    }

    // Check if entries exist for this payment
    const entries = await sql`
      SELECT 
        ee.id,
        ee.item_name,
        ee.calculated_fee,
        ee.payment_status,
        ee.created_at,
        e.name as event_name
      FROM event_entries ee
      JOIN events e ON ee.event_id = e.id
      WHERE ee.payment_id = ${paymentId}
      ORDER BY ee.created_at
    `;

    return NextResponse.json({
      success: true,
      entries: entries.map(e => ({
        id: e.id,
        itemName: e.item_name,
        fee: parseFloat(e.calculated_fee),
        paymentStatus: e.payment_status,
        eventName: e.event_name,
        createdAt: e.created_at
      })),
      count: entries.length
    });

  } catch (error) {
    console.error('💥 Check entries error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
