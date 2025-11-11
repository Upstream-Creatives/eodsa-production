import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studioId: string }> }
) {
  // Destructure and define studioId from params at the very beginning
  const resolvedParams = await params;
  const { studioId } = resolvedParams;
  
  if (!studioId) {
    return NextResponse.json({ success: false, error: 'studioId is required' }, { status: 400 });
  }

  try {

    const sql = getSql();

    // 1) Fetch Studio Overview
    let studio: any = null;
    try {
      const studioRows = (await sql`
        SELECT 
          s.id, s.name, s.email, s.contact_person, s.phone, s.address,
          s.registration_number, s.approved_by, s.approved_at,
          s.rejection_reason, s.created_at
        FROM studios s
        WHERE s.id = ${studioId}
        LIMIT 1
      `) as unknown as any[];

      if (studioRows.length === 0) {
        return NextResponse.json({ success: false, error: 'Studio not found' }, { status: 404 });
      }
      studio = studioRows[0];
      // Compute approved status from approved_at IS NOT NULL
      studio.approved = studio.approved_at !== null && studio.approved_at !== undefined;
    } catch (studioError: any) {
      console.error('Error fetching studio:', studioError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to fetch studio information: ' + (studioError?.message || 'Unknown error'),
          details: process.env.NODE_ENV === 'development' ? studioError?.stack : undefined
        },
        { status: 500 }
      );
    }

    if (!studio) {
      return NextResponse.json({ success: false, error: 'Studio not found' }, { status: 404 });
    }

    // 2) Fetch Registered Dancers (all children)
    // Find dancers linked to this studio via studio_applications (primary) or contestants table (legacy)
    let dancers: any[] = [];
    
    try {
      // Try modern method first: via studio_applications
      const dancerRows = (await sql`
        SELECT DISTINCT
          d.id, d.eodsa_id, d.name, d.age, d.date_of_birth,
          d.approved, d.registration_fee_mastery_level
        FROM dancers d
        WHERE d.approved = true
          AND EXISTS (
            SELECT 1 FROM studio_applications sa 
            WHERE sa.dancer_id = d.id 
              AND sa.studio_id = ${studioId} 
              AND sa.status = 'accepted'
          )
        ORDER BY d.name ASC
      `) as unknown as any[];

      dancers = dancerRows.map((d) => ({
        id: d.id,
        eodsaId: d.eodsa_id,
        name: d.name,
        age: d.age,
        dateOfBirth: d.date_of_birth,
        masteryLevel: d.registration_fee_mastery_level || null,
        approved: d.approved,
      }));
    } catch (dancerError: any) {
      console.error('Error fetching dancers:', dancerError);
      console.error('Dancer query error details:', {
        message: dancerError?.message,
        stack: dancerError?.stack,
        studioId: studioId
      });
      // Continue with empty dancers array - don't crash the API
      dancers = [];
    }

    // Get all dancer IDs and EODSA IDs for financial/performance queries
    const dancerIds = dancers.map(d => d.id);
    const eodsaIds = dancers.map(d => d.eodsaId);

    // 3) Financial Summary
    let financialSummary = {
      totalEntries: 0,
      totalFeesInvoiced: 0,
      totalPaid: 0,
      totalOutstanding: 0,
    };

    try {
      if (dancerIds.length > 0 || eodsaIds.length > 0) {
        // Build conditions based on what we have
        let entryRows: any[] = [];
        
        // Query by eodsa_id if we have eodsaIds
        if (eodsaIds.length > 0) {
          const rowsByEodsa = (await sql`
            SELECT DISTINCT
              ee.id, ee.calculated_fee, ee.payment_status, ee.payment_reference
            FROM event_entries ee
            WHERE ee.eodsa_id = ANY(${eodsaIds})
          `) as unknown as any[];
          entryRows.push(...rowsByEodsa);
        }
        
        // Query by contestant_id if we have dancerIds
        if (dancerIds.length > 0) {
          const rowsByContestant = (await sql`
            SELECT DISTINCT
              ee.id, ee.calculated_fee, ee.payment_status, ee.payment_reference
            FROM event_entries ee
            WHERE ee.contestant_id = ANY(${dancerIds})
          `) as unknown as any[];
          entryRows.push(...rowsByContestant);
        }
        
        // Query by participant_ids (dancer IDs)
        if (dancerIds.length > 0) {
          const rowsByParticipantIds = (await sql`
            SELECT DISTINCT
              ee.id, ee.calculated_fee, ee.payment_status, ee.payment_reference
            FROM event_entries ee
            WHERE ee.participant_ids IS NOT NULL 
              AND EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(ee.participant_ids) AS pid 
                WHERE pid = ANY(${dancerIds})
              )
          `) as unknown as any[];
          entryRows.push(...rowsByParticipantIds);
        }
        
        // Query by participant_ids (eodsa IDs)
        if (eodsaIds.length > 0) {
          const rowsByParticipantEodsa = (await sql`
            SELECT DISTINCT
              ee.id, ee.calculated_fee, ee.payment_status, ee.payment_reference
            FROM event_entries ee
            WHERE ee.participant_ids IS NOT NULL 
              AND EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(ee.participant_ids) AS pid 
                WHERE pid = ANY(${eodsaIds})
              )
          `) as unknown as any[];
          entryRows.push(...rowsByParticipantEodsa);
        }
        
        // Remove duplicates by id
        const uniqueEntries = Array.from(new Map(entryRows.map(e => [e.id, e])).values());

        financialSummary.totalEntries = uniqueEntries.length;
        financialSummary.totalFeesInvoiced = uniqueEntries.reduce((sum, e) => sum + (Number(e.calculated_fee) || 0), 0);
        financialSummary.totalPaid = uniqueEntries
          .filter(e => e.payment_status === 'paid')
          .reduce((sum, e) => sum + (Number(e.calculated_fee) || 0), 0);
        financialSummary.totalOutstanding = financialSummary.totalFeesInvoiced - financialSummary.totalPaid;
      }
    } catch (error: any) {
      console.error('Error calculating financial summary:', error);
      // Continue with default values
    }

    // 4) Performance Analytics
    let performanceAnalytics = {
      totalSolos: 0,
      totalGroupEntries: 0,
      averageScore: 0,
      medalBreakdown: {
        gold: 0,
        silver: 0,
        bronze: 0,
        other: 0,
      },
    };

    try {
      if (dancerIds.length > 0 || eodsaIds.length > 0) {
        // Get performances for these dancers - filter by participant_ids array in event_entries
        let allPerformanceRows: any[] = [];
        
        // Query performances matching via event_entries participant_ids using dancer IDs
        if (dancerIds.length > 0) {
          const perfRows1 = (await sql`
            SELECT DISTINCT
              p.id, p.performance_type, p.participant_names,
              ee.performance_type as entry_performance_type,
              COALESCE(AVG(s.technical_score + s.musical_score + s.performance_score + s.styling_score + s.overall_impression_score), 0) as average_total,
              COUNT(s.id) as judge_count
            FROM performances p
            LEFT JOIN event_entries ee ON ee.id = p.event_entry_id
            LEFT JOIN scores s ON s.performance_id = p.id
            WHERE p.scores_published = true
              AND ee.participant_ids IS NOT NULL 
              AND EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(ee.participant_ids) AS pid 
                WHERE pid = ANY(${dancerIds})
              )
            GROUP BY p.id, p.performance_type, p.participant_names, ee.performance_type
          `) as unknown as any[];
          allPerformanceRows.push(...perfRows1);
        }
        
        // Query performances matching via eodsaIds in participant_ids or participant_names
        if (eodsaIds.length > 0) {
          for (const eodsaId of eodsaIds) {
            const perfRows2 = (await sql`
              SELECT DISTINCT
                p.id, p.performance_type, p.participant_names,
                ee.performance_type as entry_performance_type,
                COALESCE(AVG(s.technical_score + s.musical_score + s.performance_score + s.styling_score + s.overall_impression_score), 0) as average_total,
                COUNT(s.id) as judge_count
              FROM performances p
              LEFT JOIN event_entries ee ON ee.id = p.event_entry_id
              LEFT JOIN scores s ON s.performance_id = p.id
              WHERE p.scores_published = true
                AND (
                  (ee.participant_ids IS NOT NULL AND EXISTS (
                    SELECT 1 FROM jsonb_array_elements_text(ee.participant_ids) AS pid 
                    WHERE pid = ${eodsaId}
                  ))
                  OR p.participant_names::text LIKE ${'%' + eodsaId + '%'}
                )
              GROUP BY p.id, p.performance_type, p.participant_names, ee.performance_type
            `) as unknown as any[];
            allPerformanceRows.push(...perfRows2);
          }
        }
        
        // Remove duplicates by id
        const performanceRows = Array.from(new Map(allPerformanceRows.map(p => [p.id, p])).values());

        // Count solos vs groups
        performanceAnalytics.totalSolos = performanceRows.filter(
          (p) => (p.entry_performance_type || p.performance_type) === 'Solo'
        ).length;
        performanceAnalytics.totalGroupEntries = performanceRows.filter(
          (p) => ['Duet', 'Trio', 'Group'].includes(p.entry_performance_type || p.performance_type)
        ).length;

        // Calculate average score and medal breakdown
        let totalScore = 0;
        let scoredCount = 0;

        for (const perf of performanceRows) {
          const judgeCount = Number(perf.judge_count) || 1;
          const maxPossible = judgeCount * 100;
          const percentage = maxPossible > 0 ? (Number(perf.average_total) / maxPossible) * 100 : 0;

          if (percentage > 0) {
            totalScore += percentage;
            scoredCount++;

            // Medal breakdown
            if (percentage >= 80) {
              performanceAnalytics.medalBreakdown.gold++;
            } else if (percentage >= 70) {
              performanceAnalytics.medalBreakdown.silver++;
            } else if (percentage >= 0) {
              performanceAnalytics.medalBreakdown.bronze++;
            } else {
              performanceAnalytics.medalBreakdown.other++;
            }
          }
        }

        performanceAnalytics.averageScore = scoredCount > 0 ? Math.round((totalScore / scoredCount) * 10) / 10 : 0;
      }
    } catch (error: any) {
      console.error('Error calculating performance analytics:', error);
      // Continue with default values
    }

    // Structure the Response
    try {
      const response = {
        studio: {
          id: studio?.id || null,
          name: studio?.name || null,
          email: studio?.email || null,
          contactPerson: studio?.contact_person || null,
          phone: studio?.phone || null,
          address: studio?.address || null,
          registrationNumber: studio?.registration_number || null,
          approved: studio?.approved !== undefined ? studio.approved : (studio?.approved_at !== null && studio?.approved_at !== undefined),
          approvedBy: studio?.approved_by || null,
          approvedAt: studio?.approved_at || null,
          rejectionReason: studio?.rejection_reason || null,
          createdAt: studio?.created_at || null,
        },
        dancers: dancers || [],
        financial: financialSummary || {
          totalEntries: 0,
          totalFeesInvoiced: 0,
          totalPaid: 0,
          totalOutstanding: 0,
        },
        performance: performanceAnalytics || {
          totalSolos: 0,
          totalGroupEntries: 0,
          averageScore: 0,
          medalBreakdown: {
            gold: 0,
            silver: 0,
            bronze: 0,
            other: 0,
          },
        },
      };

      return NextResponse.json({ success: true, profile: response });
    } catch (responseError: any) {
      console.error('Error structuring response:', responseError);
      return NextResponse.json(
        {
          success: false,
          error: 'Error formatting response: ' + (responseError?.message || 'Unknown error'),
          details: process.env.NODE_ENV === 'development' ? responseError?.stack : undefined,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Studio profile aggregation error:', error);
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
      studioId: studioId,
    });
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      },
      { status: 500 }
    );
  }
}

