import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';

/**
 * GET /api/studios/certificates
 * Get certificates for a studio's entries
 * Query params: studioId - Studio ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studioId = searchParams.get('studioId');
    
    if (!studioId) {
      return NextResponse.json(
        { error: 'studioId parameter is required' },
        { status: 400 }
      );
    }

    const sqlClient = getSql();

    // First, get all dancers belonging to the studio (same pattern as getStudioEntries)
    const studioDancers = await sqlClient`
      SELECT d.id, d.eodsa_id
      FROM dancers d
      JOIN studio_applications sa ON d.id = sa.dancer_id
      WHERE sa.studio_id = ${studioId}
      AND sa.status = 'accepted'
    ` as any[];

    const dancerEodsaIds = studioDancers.map(d => d.eodsa_id).filter(Boolean);
    const dancerIds = studioDancers.map(d => d.id).filter(Boolean);

    // Also check for legacy contestants associated with studio
    const studio = await sqlClient`
      SELECT email, name FROM studios WHERE id = ${studioId} LIMIT 1
    ` as any[];

    // Get all entries for this studio (using same pattern as getStudioEntries)
    let entries: any[] = [];
    
    // Build query conditions similar to getStudioEntries
    if (studio.length > 0) {
      // Query with studio and dancer conditions
      entries = await sqlClient`
        SELECT DISTINCT ee.id as entry_id, ee.event_id
        FROM event_entries ee
        LEFT JOIN contestants c ON ee.contestant_id = c.id
        WHERE 
          ee.eodsa_id = ${studioId}
          OR (${dancerEodsaIds.length > 0} AND ee.eodsa_id = ANY(${dancerEodsaIds}))
          OR (${dancerIds.length > 0} AND ee.contestant_id = ANY(${dancerIds}))
          OR (${dancerIds.length > 0} AND ee.participant_ids::text LIKE ANY(${dancerIds.map(id => `%"${id}"%`)}))
          OR (${dancerEodsaIds.length > 0} AND ee.participant_ids::text LIKE ANY(${dancerEodsaIds.map(id => `%"${id}"%`)}))
          OR (c.type = 'studio' AND (c.email = ${studio[0].email} OR c.studio_name = ${studio[0].name}))
      ` as any[];
    } else if (dancerEodsaIds.length > 0 || dancerIds.length > 0) {
      // Query with only dancer conditions
      entries = await sqlClient`
        SELECT DISTINCT ee.id as entry_id, ee.event_id
        FROM event_entries ee
        WHERE 
          (${dancerEodsaIds.length > 0} AND ee.eodsa_id = ANY(${dancerEodsaIds}))
          OR (${dancerIds.length > 0} AND ee.contestant_id = ANY(${dancerIds}))
          OR (${dancerIds.length > 0} AND ee.participant_ids::text LIKE ANY(${dancerIds.map(id => `%"${id}"%`)}))
          OR (${dancerEodsaIds.length > 0} AND ee.participant_ids::text LIKE ANY(${dancerEodsaIds.map(id => `%"${id}"%`)}))
      ` as any[];
    }

    if (entries.length === 0) {
      return NextResponse.json([]);
    }

    const entryIds = entries.map(e => e.entry_id);

    // Get performances for these entries
    const performances = await sqlClient`
      SELECT p.id as performance_id, p.event_entry_id, p.title, p.item_style, p.event_id
      FROM performances p
      JOIN events e ON e.id = p.event_id
      WHERE p.event_entry_id = ANY(${entryIds})
        AND COALESCE(e.event_type, '') <> 'AUDITION_EVENT'
    ` as any[];

    if (performances.length === 0) {
      return NextResponse.json([]);
    }

    const performanceIds = performances.map(p => p.performance_id);

    // Get certificates for these performances
    const certificates = await sqlClient`
      SELECT 
        c.id,
        c.dancer_id,
        c.dancer_name,
        c.eodsa_id,
        c.email,
        c.performance_id,
        c.event_entry_id,
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
        p.title as performance_title,
        p.item_style as performance_style,
        e.name as event_name
      FROM certificates c
      LEFT JOIN performances p ON c.performance_id = p.id
      LEFT JOIN events e ON p.event_id = e.id
      WHERE c.performance_id = ANY(${performanceIds})
         OR c.event_entry_id = ANY(${entryIds})
      ORDER BY c.created_at DESC
    ` as any[];

    // Map database fields to frontend format
    const mappedCertificates = certificates.map((cert: any) => ({
      id: cert.id,
      dancerName: cert.dancer_name,
      eodsaId: cert.eodsa_id,
      email: cert.email,
      performanceId: cert.performance_id,
      eventEntryId: cert.event_entry_id,
      percentage: parseFloat(cert.percentage) || 0,
      style: cert.style || cert.performance_style,
      title: cert.title || cert.performance_title,
      medallion: cert.medallion,
      eventDate: cert.event_date,
      eventName: cert.event_name,
      certificateUrl: cert.certificate_url,
      sentAt: cert.sent_at,
      sentBy: cert.sent_by,
      downloaded: cert.downloaded || false,
      downloadedAt: cert.downloaded_at,
      createdAt: cert.created_at,
      createdBy: cert.created_by
    }));

    return NextResponse.json(mappedCertificates);

  } catch (error) {
    console.error('Error fetching studio certificates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch certificates' },
      { status: 500 }
    );
  }
}

