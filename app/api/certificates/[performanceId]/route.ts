import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
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

    // Return certificate data
    return NextResponse.json({
      dancerName: performance.participantNames.join(', '),
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
