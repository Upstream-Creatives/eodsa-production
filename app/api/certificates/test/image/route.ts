import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs/promises';
import path from 'path';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * GET /api/certificates/test/image
 * Generate certificate using Cloudinary transformations
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Get parameters
    const dancerName = searchParams.get('dancerName') || 'ANGELO SOLIS';
    const percentage = searchParams.get('percentage') || '92';
    const style = searchParams.get('style') || 'CONTEMPORARY';
    const title = searchParams.get('title') || 'RISING PHOENIX';
    const medallion = searchParams.get('medallion') || 'GOLD';
    const date = searchParams.get('date') || '4 October 2025';

    // Use Cloudinary's text overlay feature with Montserrat font
    const certificateUrl = cloudinary.url('Template_syz7di', {
      transformation: [
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: 50,
            font_weight: 'bold',
            text: dancerName,
            letter_spacing: 2
          },
          color: 'white',
          gravity: 'center',
          y: -170
        },
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: 60,
            font_weight: 'bold',
            text: percentage
          },
          color: 'white',
          gravity: 'west',
          x: 140,
          y: 190
        },
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: 24,
            font_weight: 'bold',
            text: style.toUpperCase()
          },
          color: 'white',
          gravity: 'center',
          x: 80,
          y: 230
        },
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: 22,
            font_weight: 'bold',
            text: title.toUpperCase()
          },
          color: 'white',
          gravity: 'center',
          x: 30,
          y: 310
        },
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: 32,
            font_weight: 'bold',
            text: medallion.toUpperCase()
          },
          color: 'white',
          gravity: 'center',
          x: 120,
          y: 390
        },
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: 28,
            text: date
          },
          color: 'white',
          gravity: 'south_east',
          x: 230,
          y: 100
        }
      ],
      format: 'jpg',
      quality: 95
    });

    // Fetch the generated image from Cloudinary
    const response = await fetch(certificateUrl);
    const imageBuffer = await response.arrayBuffer();

    // Return image
    return new NextResponse(Buffer.from(imageBuffer), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': 'inline; filename="test-certificate.jpg"',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('Error generating test certificate:', error);
    return NextResponse.json(
      { error: 'Failed to generate certificate', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
