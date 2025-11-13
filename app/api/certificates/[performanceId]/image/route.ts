import { NextRequest, NextResponse } from 'next/server';
import { db, getSql } from '@/lib/database';
import { getMedalFromPercentage, formatCertificateDate } from '@/lib/certificate-generator';
import { generateCertificateImage } from '@/lib/certificate-image-generator';

/**
 * GET /api/certificates/[performanceId]/image
 * Generate and return certificate image
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ performanceId: string }> }
) {
  let performanceId: string | undefined;
  try {
    const resolvedParams = await params;
    performanceId = resolvedParams.performanceId;

    if (!performanceId) {
      return NextResponse.json(
        { error: 'Performance ID is required' },
        { status: 400 }
      );
    }

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

    // Calculate average percentage using total judges assigned to event (not just scores submitted)
    const { getTotalJudgesForEvent } = await import('@/lib/database');
    const totalJudgesAssigned = await getTotalJudgesForEvent(performance.eventId, performanceId);
    
    const totalPercentage = scores.reduce((sum, score) => {
      const scoreTotal = score.technicalScore + score.musicalScore + score.performanceScore + score.stylingScore + score.overallImpressionScore;
      return sum + scoreTotal;
    }, 0);
    // Use total judges assigned, with fallback to scores.length if judges not assigned yet
    const averagePercentage = Math.round(totalPercentage / (totalJudgesAssigned > 0 ? totalJudgesAssigned : scores.length));

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
      ? studioName.toUpperCase() 
      : performance.participantNames.join(', ').toUpperCase();

    // Generate certificate image
    const certificateBuffer = await generateCertificateImage({
      dancerName: displayName,
      percentage: averagePercentage,
      style: performance.itemStyle.toUpperCase(),
      title: performance.title.toUpperCase(),
      medallion: medallion,
      date: formatCertificateDate(event.eventDate)
    });

    // Return image - convert Buffer to Uint8Array for NextResponse
    return new NextResponse(Uint8Array.from(certificateBuffer), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `inline; filename="certificate-${performanceId}.jpg"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });

  } catch (error) {
    console.error('Error generating certificate image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('Certificate generation error details:', {
      performanceId,
      error: errorMessage,
      stack: errorStack
    });
    return NextResponse.json(
      { 
        error: 'Failed to generate certificate image',
        details: errorMessage,
        performanceId 
      },
      { status: 500 }
    );
  }
}
