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
    // Positioning calibrated from adjust tool
    const certificateUrl = cloudinary.url('Template_syz7di', {
      transformation: [
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: 65,
            font_weight: 'bold',
            text: dancerName,
            letter_spacing: 2
          },
          color: 'white',
          gravity: 'north',
          y: Math.floor(48.5 * 13) // 48.5% from top
        },
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: 76,
            font_weight: 'bold',
            text: percentage
          },
          color: 'white',
          gravity: 'north_west',
          x: Math.floor(15.5 * 9), // 15.5% from left
          y: Math.floor(65.5 * 13) // 65.5% from top
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
          x: Math.floor((77.5 - 50) * 9), // 77.5% from left
          y: Math.floor(67 * 13) // 67% from top
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
          x: Math.floor((74 - 50) * 9), // 74% from left
          y: Math.floor(74 * 13) // 74% from top
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
          x: Math.floor((72 - 50) * 9), // 72% from left
          y: Math.floor(80.5 * 13) // 80.5% from top
        },
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: 39,
            text: date
          },
          color: 'white',
          gravity: 'north',
          x: Math.floor((66.5 - 50) * 9), // 66.5% from left
          y: Math.floor(90 * 13) // 90% from top
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
