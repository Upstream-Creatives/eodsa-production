import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { emailService } from '@/lib/email';
import { generateCertificateHTML, getMedalFromPercentage, formatCertificateDate } from '@/lib/certificate-generator';
import { getMedalFromPercentage as getTypeMedal } from '@/lib/types';

/**
 * POST /api/certificates/generate
 * Generate and email a certificate for a completed performance
 */
export async function POST(request: NextRequest) {
  try {
    const { performanceId } = await request.json();

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
        { error: 'Performance must be completed before generating certificate' },
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

    // Get dancer information
    const allDancers = await db.getAllDancers();
    const dancer = allDancers.find(d => performance.participantNames.includes(d.name));

    if (!dancer) {
      return NextResponse.json(
        { error: 'Dancer not found' },
        { status: 404 }
      );
    }

    // Get contestant to get email
    const allContestants = await db.getAllContestants();
    const contestant = allContestants.find(c => c.dancers.some(d => d.id === dancer.id));

    if (!contestant || !contestant.email) {
      return NextResponse.json(
        { error: 'Contestant email not found' },
        { status: 404 }
      );
    }

    // Get event details for date
    const allEvents = await db.getAllEvents();
    const event = allEvents.find(e => e.id === performance.eventId);

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Generate certificate HTML
    const certificateHTML = generateCertificateHTML({
      dancerName: performance.participantNames.join(', '),
      percentage: averagePercentage,
      style: performance.itemStyle,
      title: performance.title,
      medallion: medallion,
      date: formatCertificateDate(event.eventDate)
    });

    // For now, we'll create a simple URL to view the certificate
    // In production, you might want to save this to a file storage service
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const certificateUrl = `${appUrl}/certificates/${performanceId}`;

    // Save certificate HTML to database or file system
    // For this implementation, we'll store it as a reference
    // You could extend this to save to Cloudinary or another storage service

    // Send email with certificate
    const emailResult = await emailService.sendCertificateEmail(
      performance.participantNames.join(', '),
      contestant.email,
      averagePercentage,
      medallion,
      certificateUrl
    );

    if (!emailResult.success) {
      return NextResponse.json(
        { error: 'Failed to send certificate email', details: emailResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Certificate generated and emailed successfully',
      data: {
        performanceId,
        dancerName: performance.participantNames.join(', '),
        percentage: averagePercentage,
        medallion,
        certificateUrl,
        emailSent: true,
        recipientEmail: contestant.email
      }
    });

  } catch (error) {
    console.error('Error generating certificate:', error);
    return NextResponse.json(
      { error: 'Failed to generate certificate' },
      { status: 500 }
    );
  }
}
