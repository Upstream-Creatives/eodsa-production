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

    // Check if this dancer has custom position settings
    const sqlClient = getSql();
    const positionsResult = await sqlClient`
      SELECT * FROM certificate_positions WHERE dancer_id = ${dancerId}
    ` as any[];

    // Use custom positions if available, otherwise use defaults
    const hasCustom = positionsResult.length > 0;
    const pos = hasCustom ? positionsResult[0] : null;

    const nameTop = pos?.name_top || 48.5;
    const nameFontSize = pos?.name_font_size || 65;
    const percentageTop = pos?.percentage_top || 65.5;
    const percentageLeft = pos?.percentage_left || 15.5;
    const percentageFontSize = pos?.percentage_font_size || 76;
    const styleTop = pos?.style_top || 67;
    const styleLeft = pos?.style_left || 77.5;
    const styleFontSize = pos?.style_font_size || 33;
    const titleTop = pos?.title_top || 74;
    const titleLeft = pos?.title_left || 74;
    const titleFontSize = pos?.title_font_size || 29;
    const medallionTop = pos?.medallion_top || 80.5;
    const medallionLeft = pos?.medallion_left || 72;
    const medallionFontSize = pos?.medallion_font_size || 46;
    const dateTop = pos?.date_top || 90;
    const dateLeft = pos?.date_left || 66.5;
    const dateFontSize = pos?.date_font_size || 39;

    // Generate certificate using Cloudinary with custom or default positioning
    const certificateUrl = cloudinary.url('Template_syz7di', {
      transformation: [
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: nameFontSize,
            font_weight: 'bold',
            text: dancerName.toUpperCase(),
            letter_spacing: 2
          },
          color: 'white',
          gravity: 'north',
          y: Math.floor(nameTop * 13)
        },
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: percentageFontSize,
            font_weight: 'bold',
            text: percentage.toString()
          },
          color: 'white',
          gravity: 'north_west',
          x: Math.floor(percentageLeft * 9),
          y: Math.floor(percentageTop * 13)
        },
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: styleFontSize,
            font_weight: 'bold',
            text: style.toUpperCase()
          },
          color: 'white',
          gravity: 'north',
          x: Math.floor((styleLeft - 50) * 9),
          y: Math.floor(styleTop * 13)
        },
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: titleFontSize,
            font_weight: 'bold',
            text: title.toUpperCase()
          },
          color: 'white',
          gravity: 'north',
          x: Math.floor((titleLeft - 50) * 9),
          y: Math.floor(titleTop * 13)
        },
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: medallionFontSize,
            font_weight: 'bold',
            text: medallion.toUpperCase()
          },
          color: 'white',
          gravity: 'north',
          x: Math.floor((medallionLeft - 50) * 9),
          y: Math.floor(medallionTop * 13)
        },
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: dateFontSize,
            text: eventDate
          },
          color: 'white',
          gravity: 'north',
          x: Math.floor((dateLeft - 50) * 9),
          y: Math.floor(dateTop * 13)
        }
      ],
      format: 'jpg',
      quality: 95
    });

    // Generate unique certificate ID
    const certificateId = `cert_${Date.now()}${Math.random().toString(36).substring(2, 9)}`;
    const createdAt = new Date().toISOString();

    // Save certificate to database (sqlClient already declared above)
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
      // Try to find certificates by dancer_id, eodsa_id, or by looking up the dancer first
      let result = await sqlClient`
        SELECT * FROM certificates 
        WHERE dancer_id = ${dancerId}
        OR eodsa_id = ${dancerId}
        ORDER BY created_at DESC
      ` as any[];
      
      // If no results, try to get the EODSA ID from the dancers table
      if (result.length === 0) {
        const dancerInfo = await sqlClient`
          SELECT eodsa_id FROM dancers WHERE id = ${dancerId}
        ` as any[];
        
        if (dancerInfo.length > 0 && dancerInfo[0].eodsa_id) {
          result = await sqlClient`
            SELECT * FROM certificates 
            WHERE eodsa_id = ${dancerInfo[0].eodsa_id}
            ORDER BY created_at DESC
          ` as any[];
        }
      }

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
