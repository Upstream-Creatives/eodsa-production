import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';

// Consolidated dancer profile for Admin and Dashboard views
// Returns: dancer bio, linked studio, events, performances, scores, medals, certificates
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Dancer ID is required' }, { status: 400 });
    }

    const sql = getSql();

    // Basic dancer + studio info
    const bioRows = await sql`
      SELECT 
        d.id,
        d.eodsa_id,
        d.name,
        d.age,
        d.date_of_birth,
        d.approved,
        d.approved_by,
        d.approved_at,
        d.rejection_reason,
        c.name as contestant_name,
        c.email as contestant_email,
        c.phone as contestant_phone,
        c.type as contestant_type,
        c.studio_name,
        c.studio_registration_number,
        s.id as studio_id,
        s.name as studio_name_canonical,
        s.registration_number as studio_registration_number_canonical
      FROM dancers d
      LEFT JOIN contestants c ON c.eodsa_id = d.eodsa_id
      LEFT JOIN studios s ON (s.email = c.email OR s.name = c.studio_name)
      WHERE d.id = ${id}
      LIMIT 1
    ` as any[];

    const bio = bioRows[0];
    if (!bio) {
      return NextResponse.json({ success: false, error: 'Dancer not found' }, { status: 404 });
    }

    // Events + performances + results (published only for scores/medals)
    const performances = await sql`
      SELECT 
        p.id as performance_id,
        p.title,
        p.item_style,
        p.mastery,
        p.event_id,
        p.event_entry_id,
        p.item_number,
        p.performance_order,
        p.entry_type,
        e.name as event_name,
        e.region,
        e.age_category,
        e.event_date,
        e.event_end_date,
        ee.performance_type,
        -- score aggregation
        COALESCE(AVG(s.technical_score + s.musical_score + s.performance_score + s.styling_score + s.overall_impression_score), 0) as average_total,
        COUNT(s.id) as judge_count,
        -- published state for visibility
        p.scores_published as scores_published,
        p.scores_published_at,
        -- certificate lookup (if generated)
        cert.id as certificate_id,
        cert.certificate_url
      FROM performances p
      JOIN events e ON e.id = p.event_id
      LEFT JOIN event_entries ee ON ee.id = p.event_entry_id
      LEFT JOIN scores s ON s.performance_id = p.id
      LEFT JOIN certificates cert ON cert.performance_id = p.id
      WHERE (p.participant_names IS NOT NULL AND p.participant_names::text ILIKE '%' || ${bio.name} || '%')
         OR (ee.participant_ids IS NOT NULL AND ee.participant_ids::text ILIKE '%' || ${bio.id} || '%')
         OR (ee.participant_ids IS NOT NULL AND ee.participant_ids::text ILIKE '%' || ${bio.eodsa_id} || '%')
      GROUP BY 
        p.id, e.id, ee.id, cert.id
      ORDER BY e.event_date DESC NULLS LAST, p.item_number ASC NULLS LAST
    `;

    // Shape response
    const profile = {
      dancer: {
        id: bio.id,
        eodsaId: bio.eodsa_id,
        name: bio.name,
        age: bio.age,
        dateOfBirth: bio.date_of_birth,
        approved: bio.approved,
        approvedBy: bio.approved_by,
        approvedAt: bio.approved_at,
        rejectionReason: bio.rejection_reason
      },
      studio: bio.studio_id
        ? {
            id: bio.studio_id,
            name: bio.studio_name_canonical || bio.studio_name,
            registrationNumber:
              bio.studio_registration_number_canonical || bio.studio_registration_number
          }
        : bio.studio_name
        ? {
            id: null,
            name: bio.studio_name,
            registrationNumber: bio.studio_registration_number
          }
        : null,
      performances: (performances.rows || []).map((row: any) => {
        const maxPossible = Math.max(1, Number(row.judge_count)) * 100;
        const percentage =
          maxPossible > 0 ? Math.round((Number(row.average_total) / maxPossible) * 1000) / 10 : 0;
        return {
          performanceId: row.performance_id,
          title: row.title,
          itemStyle: row.item_style,
          mastery: row.mastery,
          entryType: row.entry_type,
          itemNumber: row.item_number,
          performanceOrder: row.performance_order,
          event: {
            id: row.event_id,
            name: row.event_name,
            region: row.region,
            ageCategory: row.age_category,
            date: row.event_date,
            endDate: row.event_end_date
          },
          performanceType: row.performance_type,
          judgeCount: Number(row.judge_count),
          percentage,
          scoresPublished: !!row.scores_published,
          certificate: row.certificate_id
            ? { id: row.certificate_id, url: row.certificate_url }
            : null
        };
      })
    };

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error('Error building dancer profile:', error);
    return NextResponse.json({ success: false, error: 'Failed to build profile' }, { status: 500 });
  }
}


