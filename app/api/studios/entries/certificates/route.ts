import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';

/**
 * GET /api/studios/entries/certificates
 * Get certificate status for entries
 * Query params: entryIds - comma-separated list of entry IDs
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entryIdsParam = searchParams.get('entryIds');
    
    if (!entryIdsParam) {
      return NextResponse.json(
        { error: 'entryIds parameter is required' },
        { status: 400 }
      );
    }

    const entryIds = entryIdsParam.split(',').filter(id => id.trim());
    
    if (entryIds.length === 0) {
      return NextResponse.json([]);
    }

    const sqlClient = getSql();

    // Get performances for these entries
    const performances = await sqlClient`
      SELECT p.id as performance_id, p.event_entry_id, p.scores_published
      FROM performances p
      JOIN events e ON e.id = p.event_id
      WHERE p.event_entry_id = ANY(${entryIds})
        AND COALESCE(e.event_type, '') <> 'AUDITION_EVENT'
    ` as any[];

    if (performances.length === 0) {
      // Return empty status for all entry IDs
      return NextResponse.json(
        entryIds.map(entryId => ({
          entryId,
          hasCertificate: false,
          hasPerformance: false,
          performanceId: null,
          scoresPublished: false
        }))
      );
    }

    const performanceIds = performances.map(p => p.performance_id);

    // Check for certificates for these performances
    // Also check by event_entry_id directly in case certificate was created with entry ID
    const certificates = await sqlClient`
      SELECT DISTINCT performance_id, event_entry_id
      FROM certificates
      WHERE performance_id = ANY(${performanceIds})
         OR event_entry_id = ANY(${entryIds})
    ` as any[];

    // Create a map of entry ID to certificate status
    const certificateMap = new Map<string, boolean>();
    certificates.forEach(cert => {
      if (cert.event_entry_id) {
        certificateMap.set(cert.event_entry_id, true);
      }
      // Also map by performance_id to entry_id
      const perf = performances.find(p => p.performance_id === cert.performance_id);
      if (perf && perf.event_entry_id) {
        certificateMap.set(perf.event_entry_id, true);
      }
    });

    // Create a map of entry ID to performance info
    const performanceMap = new Map<string, { performanceId: string; scoresPublished: boolean }>();
    performances.forEach(perf => {
      if (perf.event_entry_id) {
        performanceMap.set(perf.event_entry_id, {
          performanceId: perf.performance_id,
          scoresPublished: perf.scores_published || false
        });
      }
    });

    // Build response for all entry IDs
    const result = entryIds.map(entryId => {
      const hasCertificate = certificateMap.has(entryId);
      const perfInfo = performanceMap.get(entryId);
      
      return {
        entryId,
        hasCertificate,
        hasPerformance: !!perfInfo,
        performanceId: perfInfo?.performanceId || null,
        scoresPublished: perfInfo?.scoresPublished || false
      };
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching certificate status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch certificate status' },
      { status: 500 }
    );
  }
}

