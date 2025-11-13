import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { emailService } from '@/lib/email';
import { getMedalFromPercentage, formatCertificateDate } from '@/lib/certificate-generator';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const performanceId = id;
    const { status } = await request.json();

    // Validate status
    const validStatuses = ['scheduled', 'ready', 'hold', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be one of: ' + validStatuses.join(', ') },
        { status: 400 }
      );
    }

    // Check if performance exists
    const allPerformances = await db.getAllPerformances();
    const performance = allPerformances.find(p => p.id === performanceId);

    if (!performance) {
      return NextResponse.json(
        { error: 'Performance not found' },
        { status: 404 }
      );
    }

    // Store previous status to check if transitioning to completed
    const previousStatus = performance.status;

    // Update performance status
    await db.updatePerformanceStatus(performanceId, status);

    // If status changed to 'completed', automatically generate and send certificate
    let certificateResult = null;
    if (status === 'completed' && previousStatus !== 'completed') {
      try {
        console.log(`Performance ${performanceId} completed - generating certificate...`);

        // Get scores for this performance
        const scores = await db.getScoresByPerformance(performanceId);

        if (scores && scores.length > 0) {
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

          // Get dancer information
          const allDancers = await db.getAllDancers();
          const dancer = allDancers.find(d => performance.participantNames.includes(d.name));

          if (dancer) {
            // Get contestant to get email
            const allContestants = await db.getAllContestants();
            const contestant = allContestants.find(c => c.dancers.some(d => d.id === dancer.id));

            if (contestant && contestant.email) {
              // Get event details for date
              const allEvents = await db.getAllEvents();
              const event = allEvents.find(e => e.id === performance.eventId);

              if (event) {
                const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
                const certificateUrl = `${appUrl}/certificates/${performanceId}`;

                // Send certificate email
                const emailResult = await emailService.sendCertificateEmail(
                  performance.participantNames.join(', '),
                  contestant.email,
                  averagePercentage,
                  medallion,
                  certificateUrl
                );

                if (emailResult.success) {
                  certificateResult = {
                    sent: true,
                    email: contestant.email,
                    percentage: averagePercentage,
                    medallion
                  };
                  console.log(`✅ Certificate sent to ${contestant.email}`);
                } else {
                  console.error(`❌ Failed to send certificate: ${emailResult.error}`);
                  certificateResult = {
                    sent: false,
                    error: emailResult.error
                  };
                }
              }
            }
          }
        } else {
          console.warn(`No scores found for performance ${performanceId} - certificate not sent`);
        }
      } catch (certError) {
        console.error('Error generating/sending certificate:', certError);
        certificateResult = {
          sent: false,
          error: certError instanceof Error ? certError.message : 'Unknown error'
        };
      }
    }

    return NextResponse.json({
      success: true,
      message: `Performance status updated to ${status}`,
      performance: {
        ...performance,
        status
      },
      certificate: certificateResult
    });

  } catch (error) {
    console.error('Error updating performance status:', error);
    return NextResponse.json(
      { error: 'Failed to update performance status' },
      { status: 500 }
    );
  }
}


