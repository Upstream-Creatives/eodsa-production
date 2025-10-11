import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const sqlClient = getSql();

    // Get all certificates ordered by creation date
    const certificates = await sqlClient`
      SELECT 
        id,
        dancer_id,
        dancer_name,
        eodsa_id,
        email,
        performance_id,
        percentage,
        style,
        title,
        medallion,
        event_date,
        certificate_url,
        sent_at,
        sent_by,
        downloaded,
        downloaded_at,
        created_at,
        created_by
      FROM certificates
      ORDER BY created_at DESC
    ` as any[];

    return NextResponse.json(certificates);

  } catch (error) {
    console.error('Error fetching certificates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch certificates' },
      { status: 500 }
    );
  }
}

