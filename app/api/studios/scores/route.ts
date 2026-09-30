import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';

// Get all scores for a studio's dancers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studioId = searchParams.get('studioId');

    if (!studioId) {
      return NextResponse.json(
        { success: false, error: 'Studio ID is required' },
        { status: 400 }
      );
    }

    const sqlClient = getSql();

    // Get all dancers belonging to the studio
    const studioDancers = await sqlClient`
      SELECT d.id, d.eodsa_id, d.name
      FROM dancers d
      JOIN studio_applications sa ON d.id = sa.dancer_id
      WHERE sa.studio_id = ${studioId}
      AND sa.status = 'accepted'
    ` as any[];

    if (studioDancers.length === 0) {
      return NextResponse.json({
        success: true,
        scores: []
      });
    }

    const dancerEodsaIds = studioDancers.map(d => d.eodsa_id);
    const dancerIds = studioDancers.map(d => d.id);

    // Get all published scores for performances where studio dancers participated
    const result = await sqlClient`
      SELECT
        s.*,
        j.name as judge_name,
        p.id as performance_id,
        p.title as performance_title,
        p.event_id,
        p.scores_published,
        p.scores_published_at,
        e.event_type,
        e.region,
        ee.item_name as entry_title,
        ee.eodsa_id,
        ee.participant_ids,
        COALESCE(d.name, c.name, 'Unknown') as dancer_name
      FROM event_entries ee
      JOIN performances p ON p.event_entry_id = ee.id
      JOIN scores s ON s.performance_id = p.id
      JOIN judges j ON j.id = s.judge_id
      LEFT JOIN events e ON e.id = p.event_id
      LEFT JOIN dancers d ON ee.eodsa_id = d.eodsa_id
      LEFT JOIN contestants c ON ee.contestant_id = c.id
      WHERE (
        ee.eodsa_id = ANY(${dancerEodsaIds})
        OR ee.contestant_id = ANY(${dancerIds})
        OR ee.participant_ids::text LIKE ANY(${dancerIds.map(id => `%"${id}"%`)})
      )
      AND p.scores_published = true
      AND COALESCE(e.event_type, '') <> 'AUDITION_EVENT'
      ORDER BY s.submitted_at DESC
    ` as any[];

    const scores = result.map((row: any) => ({
      id: row.id,
      judgeId: row.judge_id,
      judgeName: row.judge_name,
      performanceId: row.performance_id,
      performanceTitle: row.performance_title || row.entry_title,
      eventId: row.event_id,
      eventType: row.event_type || 'REGIONAL_EVENT',
      region: row.region || null,
      dancerName: row.dancer_name,
      eodsaId: row.eodsa_id,
      technicalScore: parseFloat(row.technical_score),
      musicalScore: parseFloat(row.musical_score || 0),
      performanceScore: parseFloat(row.performance_score || 0),
      stylingScore: parseFloat(row.styling_score || 0),
      overallImpressionScore: parseFloat(row.overall_impression_score || 0),
      comments: row.comments,
      submittedAt: row.submitted_at,
      scoredAt: row.submitted_at
    }));

    return NextResponse.json({
      success: true,
      scores
    });
  } catch (error) {
    console.error('Error fetching studio scores:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch scores' },
      { status: 500 }
    );
  }
}

