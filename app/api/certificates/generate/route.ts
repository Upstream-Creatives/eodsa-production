import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { getSql } from '@/lib/database';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

interface CertificateData {
  dancerId: string;
  dancerName: string;
  eodsaId?: string;
  email?: string;
  performanceId?: string;
  eventEntryId?: string;
  percentage: number;
  style: string;
  title: string;
  medallion: string;
  eventDate: string;
  createdBy?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CertificateData = await request.json();
    const {
      dancerId,
      dancerName,
      eodsaId,
      email,
      performanceId,
      eventEntryId,
      percentage,
      style,
      title,
      medallion,
      eventDate,
      createdBy
    } = body;

    // Validate required fields
    if (!dancerId || !dancerName || !percentage || !style || !title || !medallion || !eventDate) {
      return NextResponse.json(
        { error: 'Missing required certificate data' },
        { status: 400 }
      );
    }

    // Generate certificate using Cloudinary with exact positioning
    const certificateUrl = cloudinary.url('Template_syz7di', {
      transformation: [
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: 65,
            font_weight: 'bold',
            text: dancerName.toUpperCase(),
            letter_spacing: 2
          },
          color: 'white',
          gravity: 'north',
          y: Math.floor(48.5 * 13)
        },
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: 76,
            font_weight: 'bold',
            text: percentage.toString()
          },
          color: 'white',
          gravity: 'north_west',
          x: Math.floor(15.5 * 9),
          y: Math.floor(65.5 * 13)
        },
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: 33,
            font_weight: 'bold',
            text: style.toUpperCase()
          },
          color: 'white',
          gravity: 'north',
          x: Math.floor((77.5 - 50) * 9),
          y: Math.floor(67 * 13)
        },
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: 29,
            font_weight: 'bold',
            text: title.toUpperCase()
          },
          color: 'white',
          gravity: 'north',
          x: Math.floor((74 - 50) * 9),
          y: Math.floor(74 * 13)
        },
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: 46,
            font_weight: 'bold',
            text: medallion.toUpperCase()
          },
          color: 'white',
          gravity: 'north',
          x: Math.floor((72 - 50) * 9),
          y: Math.floor(80.5 * 13)
        },
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: 39,
            text: eventDate
          },
          color: 'white',
          gravity: 'north',
          x: Math.floor((66.5 - 50) * 9),
          y: Math.floor(90 * 13)
        }
      ],
      format: 'jpg',
      quality: 95
    });

    // Generate unique certificate ID
    const certificateId = `cert_${Date.now()}${Math.random().toString(36).substring(2, 9)}`;
    const createdAt = new Date().toISOString();

    // Save certificate to database
    const sqlClient = getSql();
    await sqlClient`
      INSERT INTO certificates (
        id, dancer_id, dancer_name, eodsa_id, email,
        performance_id, event_entry_id, percentage, style, title,
        medallion, event_date, certificate_url, created_at, created_by
      ) VALUES (
        ${certificateId}, ${dancerId}, ${dancerName}, ${eodsaId || null}, ${email || null},
        ${performanceId || null}, ${eventEntryId || null}, ${percentage}, ${style}, ${title},
        ${medallion}, ${eventDate}, ${certificateUrl}, ${createdAt}, ${createdBy || null}
      )
    `;

    return NextResponse.json({
      success: true,
      certificateId,
      certificateUrl,
      message: 'Certificate generated successfully'
    });

  } catch (error) {
    console.error('Error generating certificate:', error);
    return NextResponse.json(
      { error: 'Failed to generate certificate' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve certificate by ID
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const certificateId = searchParams.get('id');
    const dancerId = searchParams.get('dancerId');

    const sqlClient = getSql();

    if (certificateId) {
      const result = await sqlClient`
        SELECT * FROM certificates WHERE id = ${certificateId}
      ` as any[];

      if (result.length === 0) {
        return NextResponse.json(
          { error: 'Certificate not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(result[0]);
    }

    if (dancerId) {
      const result = await sqlClient`
        SELECT * FROM certificates 
        WHERE dancer_id = ${dancerId}
        ORDER BY created_at DESC
      ` as any[];

      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: 'Missing certificateId or dancerId parameter' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error fetching certificate:', error);
    return NextResponse.json(
      { error: 'Failed to fetch certificate' },
      { status: 500 }
    );
  }
}
