import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';

/**
 * POST /api/certificates/regenerate
 * Manually regenerate certificates for performances with published scores
 * This is useful when:
 * - Template was uploaded after scores were published
 * - Certificate generation failed initially
 * - Need to update certificates with new template
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { performanceId, forceRegenerate } = body;

    if (!performanceId) {
      return NextResponse.json(
        { success: false, error: 'Performance ID is required' },
        { status: 400 }
      );
    }

    const sqlClient = getSql();

    // Get performance details
    const perfResult = await sqlClient`
      SELECT 
        p.*,
        e.event_date,
        e.name as event_name,
        e.certificate_template_url,
        ee.performance_type,
        ee.contestant_id,
        ee.id as event_entry_id,
        c.studio_name,
        c.name as contestant_name,
        c.type as contestant_type
      FROM performances p
      JOIN events e ON e.id = p.event_id
      LEFT JOIN event_entries ee ON ee.id = p.event_entry_id
      LEFT JOIN contestants c ON c.id = ee.contestant_id
      WHERE p.id = ${performanceId}
    ` as any[];

    if (perfResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Performance not found' },
        { status: 404 }
      );
    }

    const perf = perfResult[0];

    // Check if scores are published
    if (!perf.scores_published) {
      return NextResponse.json(
        { success: false, error: 'Scores not published for this performance' },
        { status: 400 }
      );
    }

    // Get scores - use the database method to ensure consistent format
    const { db } = await import('@/lib/database');
    const scores = await db.getScoresByPerformance(performanceId);

    if (!scores || scores.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No scores found for this performance' },
        { status: 400 }
      );
    }

    // Calculate average percentage
    const { getTotalJudgesForEvent } = await import('@/lib/database');
    const totalJudgesAssigned = await getTotalJudgesForEvent(perf.event_id, performanceId);
    
    const totalPercentage = scores.reduce((sum: number, score: any) => {
      // Use camelCase field names (from getScoresByPerformance)
      // Convert to numbers to ensure proper addition
      const technical = Number(score.technicalScore) || 0;
      const musical = Number(score.musicalScore) || 0;
      const performance = Number(score.performanceScore) || 0;
      const styling = Number(score.stylingScore) || 0;
      const overall = Number(score.overallImpressionScore) || 0;
      const scoreTotal = technical + musical + performance + styling + overall;
      return sum + scoreTotal;
    }, 0);
    
    const judgeCount = totalJudgesAssigned > 0 ? totalJudgesAssigned : scores.length;
    const averagePercentage = judgeCount > 0 ? Math.round(totalPercentage / judgeCount) : 0;

    console.log(`📊 Certificate regeneration - Score calculation:`, {
      totalPercentage,
      judgeCount,
      totalJudgesAssigned,
      scoresLength: scores.length,
      averagePercentage
    });

    // Validate percentage
    if (isNaN(averagePercentage) || averagePercentage < 0 || averagePercentage > 100) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid percentage calculated: ${averagePercentage}`,
          debug: {
            totalPercentage,
            judgeCount,
            averagePercentage,
            scoresCount: scores.length
          }
        },
        { status: 400 }
      );
    }

    // Get medallion
    const { getMedalFromPercentage } = await import('@/lib/certificate-generator');
    let medallion = getMedalFromPercentage(averagePercentage);
    
    // Ensure medallion is never empty (fallback to Bronze)
    if (!medallion || medallion.trim() === '') {
      console.warn(`⚠️ Medallion was empty for percentage ${averagePercentage}, defaulting to Bronze`);
      medallion = 'Bronze';
    }

    console.log(`🏅 Medallion calculated: ${medallion} for percentage ${averagePercentage}`);

    // Get participant names
    let participantNames: string[] = [];
    try {
      if (perf.participant_names) {
        if (typeof perf.participant_names === 'string') {
          try {
            participantNames = JSON.parse(perf.participant_names);
          } catch {
            participantNames = perf.participant_names.includes(',') 
              ? perf.participant_names.split(',').map((n: string) => n.trim())
              : [perf.participant_names];
          }
        } else if (Array.isArray(perf.participant_names)) {
          participantNames = perf.participant_names;
        }
      }
    } catch (error) {
      console.error('Error parsing participant_names:', error);
      participantNames = [];
    }

    // Determine display name
    const isGroupPerformance = perf.performance_type && ['Duet', 'Trio', 'Group'].includes(perf.performance_type);
    let displayName = isGroupPerformance && perf.studio_name 
      ? perf.studio_name 
      : participantNames.join(', ');

    // Fallback if display name is empty
    if (!displayName || displayName.trim() === '') {
      displayName = perf.contestant_name || perf.studio_name || 'Participant';
      console.warn(`⚠️ No participant names found, using fallback: ${displayName}`);
    }

    // Get contestant_id from event_entry if not in performance
    let contestantId = perf.contestant_id;
    if (!contestantId && perf.event_entry_id) {
      try {
        const entryResult = await sqlClient`
          SELECT contestant_id FROM event_entries WHERE id = ${perf.event_entry_id} LIMIT 1
        ` as any[];
        if (entryResult.length > 0) {
          contestantId = entryResult[0].contestant_id;
        }
      } catch (err) {
        console.warn('Could not fetch contestant_id from event_entry:', err);
      }
    }

    // Validate required fields before generating
    const dancerId = contestantId || performanceId; // Use performanceId as fallback if no contestant_id
    const style = perf.item_style || 'Unknown';
    const title = perf.title || 'Untitled Performance';
    const eventDate = perf.event_date || new Date().toISOString().split('T')[0];

    // Validate all required fields
    if (!dancerId) {
      return NextResponse.json(
        { success: false, error: 'Missing dancer/contestant ID' },
        { status: 400 }
      );
    }

    if (!displayName || displayName.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Missing dancer/studio name' },
        { status: 400 }
      );
    }

    if (!style || style.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Missing performance style' },
        { status: 400 }
      );
    }

    if (!title || title.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Missing performance title' },
        { status: 400 }
      );
    }

    if (!medallion || medallion.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Missing medallion' },
        { status: 400 }
      );
    }

    console.log(`🔄 Regenerating certificate for performance ${performanceId}:`);
    console.log(`   - Dancer ID: ${dancerId}`);
    console.log(`   - Display Name: ${displayName}`);
    console.log(`   - Style: ${style}`);
    console.log(`   - Title: ${title}`);
    console.log(`   - Percentage: ${averagePercentage}`);
    console.log(`   - Medallion: ${medallion}`);
    console.log(`   - Event Date: ${eventDate}`);

    // Check if certificate already exists
    const existingCert = await sqlClient`
      SELECT id FROM certificates WHERE performance_id = ${performanceId} LIMIT 1
    ` as any[];

    // Delete existing certificate if forceRegenerate is true
    if (forceRegenerate && existingCert.length > 0) {
      await sqlClient`
        DELETE FROM certificates WHERE performance_id = ${performanceId}
      `;
      console.log(`🗑️ Deleted existing certificate for performance ${performanceId} (force regenerate)`);
    }

    // Generate certificate via API
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    const certResponse = await fetch(`${baseUrl}/api/certificates/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dancerId: dancerId,
        dancerName: displayName,
        eodsaId: perf.eodsa_id || undefined,
        performanceId: performanceId,
        eventEntryId: perf.event_entry_id,
        eventId: perf.event_id,
        performanceType: perf.performance_type,
        studioName: perf.studio_name || undefined,
        percentage: averagePercentage,
        style: style,
        title: title,
        medallion: medallion,
        eventDate: eventDate,
        createdBy: 'system-regenerate'
      })
    });

    if (!certResponse.ok) {
      let errorText = '';
      let errorData = null;
      try {
        errorText = await certResponse.text();
        try {
          errorData = JSON.parse(errorText);
        } catch {
          // Not JSON, use as text
        }
      } catch {
        errorText = 'Unknown error';
      }

      console.error(`❌ Certificate generation failed:`, errorData || errorText);
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to generate certificate',
          details: errorData || errorText,
          debug: {
            performanceId,
            dancerId,
            dancerName: displayName,
            style,
            title,
            percentage: averagePercentage,
            medallion,
            eventDate
          }
        },
        { status: 500 }
      );
    }

    const certData = await certResponse.json();

    // Send email notifications if certificate was successfully generated
    if (certData.certificateId) {
      const certificateUrl = `${baseUrl}/certificates/${performanceId}`;
      
      // Trigger email notifications (fire and forget)
      fetch(`${baseUrl}/api/certificates/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          performanceId: performanceId,
          eventEntryId: perf.event_entry_id,
          certificateUrl: certificateUrl,
          dancerName: displayName,
          performanceTitle: perf.title || '',
          percentage: averagePercentage,
          medallion: medallion
        })
      }).catch((emailError) => {
        console.error('Error triggering certificate email notifications:', emailError);
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Certificate regenerated successfully',
      certificateId: certData.certificateId,
      performanceId: performanceId,
      dancerName: displayName,
      percentage: averagePercentage,
      medallion: medallion
    });

  } catch (error) {
    console.error('Error regenerating certificate:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to regenerate certificate',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/certificates/regenerate?eventId=XXX
 * List all performances with published scores that don't have certificates
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    const sqlClient = getSql();

    let query;
    if (eventId && eventId !== 'all') {
      query = sqlClient`
        SELECT 
          p.id as performance_id,
          p.title,
          p.item_number,
          p.scores_published,
          e.name as event_name,
          e.certificate_template_url,
          c.name as contestant_name,
          c.studio_name,
          COUNT(DISTINCT s.id) as score_count,
          CASE 
            WHEN cert.id IS NULL THEN false
            ELSE true
          END as has_certificate
        FROM performances p
        JOIN events e ON e.id = p.event_id
        LEFT JOIN event_entries ee ON ee.id = p.event_entry_id
        LEFT JOIN contestants c ON c.id = ee.contestant_id
        LEFT JOIN scores s ON s.performance_id = p.id
        LEFT JOIN certificates cert ON cert.performance_id = p.id
        WHERE p.scores_published = true
        AND p.event_id = ${eventId}
        GROUP BY p.id, p.title, p.item_number, p.scores_published, e.name, e.certificate_template_url, c.name, c.studio_name, cert.id
        HAVING COUNT(DISTINCT s.id) > 0
        ORDER BY p.item_number
      `;
    } else {
      query = sqlClient`
        SELECT 
          p.id as performance_id,
          p.title,
          p.item_number,
          p.scores_published,
          e.name as event_name,
          e.certificate_template_url,
          c.name as contestant_name,
          c.studio_name,
          COUNT(DISTINCT s.id) as score_count,
          CASE 
            WHEN cert.id IS NULL THEN false
            ELSE true
          END as has_certificate
        FROM performances p
        JOIN events e ON e.id = p.event_id
        LEFT JOIN event_entries ee ON ee.id = p.event_entry_id
        LEFT JOIN contestants c ON c.id = ee.contestant_id
        LEFT JOIN scores s ON s.performance_id = p.id
        LEFT JOIN certificates cert ON cert.performance_id = p.id
        WHERE p.scores_published = true
        GROUP BY p.id, p.title, p.item_number, p.scores_published, e.name, e.certificate_template_url, c.name, c.studio_name, cert.id
        HAVING COUNT(DISTINCT s.id) > 0
        ORDER BY e.name, p.item_number
      `;
    }

    const results = await query as any[];

    const performances = results.map((row: any) => ({
      performanceId: row.performance_id,
      title: row.title,
      itemNumber: row.item_number,
      eventName: row.event_name,
      contestantName: row.contestant_name,
      studioName: row.studio_name,
      scoreCount: parseInt(row.score_count) || 0,
      hasCertificate: row.has_certificate,
      hasTemplate: !!row.certificate_template_url
    }));

    return NextResponse.json({
      success: true,
      performances,
      summary: {
        total: performances.length,
        withCertificates: performances.filter(p => p.hasCertificate).length,
        withoutCertificates: performances.filter(p => !p.hasCertificate).length,
        withTemplates: performances.filter(p => p.hasTemplate).length
      }
    });

  } catch (error) {
    console.error('Error listing performances:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list performances',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

