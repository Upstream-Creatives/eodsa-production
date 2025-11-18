import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';

/**
 * GET /api/certificates/debug-email?performanceId=XXX
 * Debug endpoint to check email addresses for a performance
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const performanceId = searchParams.get('performanceId');

    if (!performanceId) {
      return NextResponse.json(
        { success: false, error: 'performanceId is required' },
        { status: 400 }
      );
    }

    const sqlClient = getSql();

    // Get performance and event entry details
    const perfResult = await sqlClient`
      SELECT 
        p.id as performance_id,
        p.title,
        p.event_entry_id,
        ee.id as event_entry_id,
        ee.eodsa_id,
        ee.contestant_id,
        ee.participant_ids,
        d.id as dancer_id,
        d.name as dancer_name,
        d.email as dancer_email,
        d.eodsa_id as dancer_eodsa_id,
        c.id as contestant_id,
        c.studio_name,
        c.email as studio_email
      FROM performances p
      LEFT JOIN event_entries ee ON ee.id = p.event_entry_id
      LEFT JOIN dancers d ON ee.eodsa_id = d.eodsa_id
      LEFT JOIN contestants c ON ee.contestant_id = c.id
      WHERE p.id = ${performanceId}
    ` as any[];

    if (perfResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Performance not found' },
        { status: 404 }
      );
    }

    const perf = perfResult[0];

    return NextResponse.json({
      success: true,
      performance: {
        id: perf.performance_id,
        title: perf.title,
        eventEntryId: perf.event_entry_id
      },
      emailAddresses: {
        dancer: {
          name: perf.dancer_name || 'NOT FOUND',
          email: perf.dancer_email || 'NOT FOUND',
          eodsaId: perf.dancer_eodsa_id || perf.eodsa_id || 'NOT FOUND'
        },
        studio: {
          name: perf.studio_name || 'NOT FOUND',
          email: perf.studio_email || 'NOT FOUND',
          contestantId: perf.contestant_id || 'NOT FOUND'
        }
      },
      canSendEmails: {
        dancer: !!perf.dancer_email,
        studio: !!(perf.studio_email && perf.studio_name)
      }
    });

  } catch (error) {
    console.error('Error in email debug endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to debug email addresses',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

