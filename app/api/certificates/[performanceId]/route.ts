import { NextRequest, NextResponse } from 'next/server';
import { db, getSql } from '@/lib/database';
import { getMedalFromPercentage, formatCertificateDate } from '@/lib/certificate-generator';

/**
 * GET /api/certificates/[performanceId]
 * Get certificate data for a specific performance
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ performanceId: string }> }
) {
  try {
    const { performanceId } = await params;

    // Get performance details
    const allPerformances = await db.getAllPerformances();
    const performance = allPerformances.find(p => p.id === performanceId);

    if (!performance) {
      return NextResponse.json(
        { error: 'Performance not found' },
        { status: 404 }
      );
    }

    // Check if performance is completed
    if (performance.status !== 'completed') {
      return NextResponse.json(
        { error: 'Certificate not available - performance not completed' },
        { status: 400 }
      );
    }

    // Get scores for this performance
    const scores = await db.getScoresByPerformance(performanceId);

    if (!scores || scores.length === 0) {
      return NextResponse.json(
        { error: 'No scores found for this performance' },
        { status: 404 }
      );
    }

    // Calculate average percentage from all judge scores
    const totalPercentage = scores.reduce((sum, score) => {
      const scoreTotal = score.technicalScore + score.musicalScore + score.performanceScore + score.stylingScore + score.overallImpressionScore;
      return sum + scoreTotal;
    }, 0);
    const averagePercentage = Math.round(totalPercentage / scores.length);

    // Get medallion
    const medallion = getMedalFromPercentage(averagePercentage);

    // Get event details for date
    const allEvents = await db.getAllEvents();
    const event = allEvents.find(e => e.id === performance.eventId);

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Get performance type and studio name from event entry
    const sqlClient = getSql();
    let performanceType: string | null = null;
    let studioName: string | null = null;
    
    if (performance.eventEntryId) {
      try {
        const entryResult = await sqlClient`
          SELECT 
            COALESCE(ee.performance_type, e.performance_type) as performance_type,
            c.studio_name,
            c.type as contestant_type
          FROM event_entries ee
          LEFT JOIN events e ON ee.event_id = e.id
          LEFT JOIN contestants c ON ee.contestant_id = c.id
          WHERE ee.id = ${performance.eventEntryId}
        ` as any[];
        
        if (entryResult.length > 0) {
          performanceType = entryResult[0].performance_type;
          if (entryResult[0].contestant_type === 'studio' && entryResult[0].studio_name) {
            studioName = entryResult[0].studio_name;
          }
        }
      } catch (error) {
        console.warn('Error fetching event entry details:', error);
      }
    }

    // For groups, duos, and trios (non-solo performances), use studio name instead of dancer names
    const isGroupPerformance = performanceType && ['Duet', 'Trio', 'Group'].includes(performanceType);
    const displayName = isGroupPerformance && studioName 
      ? studioName 
      : performance.participantNames.join(', ');

    // Return certificate data
    return NextResponse.json({
      dancerName: displayName,
      percentage: averagePercentage,
      style: performance.itemStyle,
      title: performance.title,
      medallion: medallion,
      date: formatCertificateDate(event.eventDate)
    });

  } catch (error) {
    console.error('Error fetching certificate data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch certificate data' },
      { status: 500 }
    );
  }
}
