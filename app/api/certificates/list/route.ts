import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const sqlClient = getSql();
    const { searchParams } = new URL(request.url);
    const dancerId = searchParams.get('dancerId');
    const eodsaId = searchParams.get('eodsaId');

    // Build query with optional filtering by dancerId or eodsaId
    // Note: We check both c.eodsa_id directly AND via performance -> event_entry -> eodsa_id
    // because some certificates might not have eodsa_id set directly
    let query;
    if (dancerId) {
      query = sqlClient`
        SELECT 
          c.id,
          c.dancer_id,
          c.dancer_name,
          c.eodsa_id,
          c.email,
          c.performance_id,
          c.percentage,
          c.style,
          c.title,
          c.medallion,
          c.event_date,
          c.certificate_url,
          c.sent_at,
          c.sent_by,
          c.downloaded,
          c.downloaded_at,
          c.created_at,
          c.created_by,
          p.event_id,
          e.name as event_name
        FROM certificates c
        LEFT JOIN performances p ON p.id = c.performance_id
        LEFT JOIN events e ON e.id = p.event_id
        WHERE c.dancer_id = ${dancerId}
          AND COALESCE(e.event_type, '') <> 'AUDITION_EVENT'
        ORDER BY c.created_at DESC
      `;
    } else if (eodsaId) {
      query = sqlClient`
        SELECT 
          c.id,
          c.dancer_id,
          c.dancer_name,
          c.eodsa_id,
          c.email,
          c.performance_id,
          c.percentage,
          c.style,
          c.title,
          c.medallion,
          c.event_date,
          c.certificate_url,
          c.sent_at,
          c.sent_by,
          c.downloaded,
          c.downloaded_at,
          c.created_at,
          c.created_by,
          p.event_id,
          e.name as event_name
        FROM certificates c
        LEFT JOIN performances p ON p.id = c.performance_id
        LEFT JOIN event_entries ee ON ee.id = p.event_entry_id
        LEFT JOIN events e ON e.id = p.event_id
        WHERE COALESCE(e.event_type, '') <> 'AUDITION_EVENT'
          AND (
          c.eodsa_id = ${eodsaId}
           OR EXISTS (
             SELECT 1 FROM dancers d 
             WHERE d.eodsa_id = ${eodsaId} 
             AND (d.id = c.dancer_id OR d.name = c.dancer_name)
           )
           OR (c.performance_id IS NOT NULL AND (
             ee.eodsa_id = ${eodsaId}
             OR (ee.participant_ids IS NOT NULL 
                 AND (ee.participant_ids::jsonb ? ${eodsaId}
                      OR EXISTS (
                        SELECT 1 FROM jsonb_array_elements_text(ee.participant_ids::jsonb) AS pid 
                        WHERE pid::text = ${eodsaId}
                      )))
           ))
          )
        ORDER BY c.created_at DESC
      `;
    } else {
      // Get all certificates if no filter specified
      query = sqlClient`
        SELECT 
          c.id,
          c.dancer_id,
          c.dancer_name,
          c.eodsa_id,
          c.email,
          c.performance_id,
          c.percentage,
          c.style,
          c.title,
          c.medallion,
          c.event_date,
          c.certificate_url,
          c.sent_at,
          c.sent_by,
          c.downloaded,
          c.downloaded_at,
          c.created_at,
          c.created_by,
          p.event_id,
          e.name as event_name
        FROM certificates c
        LEFT JOIN performances p ON p.id = c.performance_id
        LEFT JOIN events e ON e.id = p.event_id
        WHERE COALESCE(e.event_type, '') <> 'AUDITION_EVENT'
        ORDER BY c.created_at DESC
      `;
    }

    const certificates = await query as any[];

    return NextResponse.json(certificates);

  } catch (error) {
    console.error('Error fetching certificates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch certificates' },
      { status: 500 }
    );
  }
}

