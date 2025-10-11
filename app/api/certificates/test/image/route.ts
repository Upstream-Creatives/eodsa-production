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

    // Upload template to Cloudinary if not already there (one-time)
    // For now, let's assume it's uploaded as "certificate-template"
    
    // Use Cloudinary's text overlay feature to add text
    const certificateUrl = cloudinary.url('certificate-template', {
      transformation: [
        {
          overlay: {
            font_family: 'Arial',
            font_size: 65,
            font_weight: 'bold',
            text: dancerName
          },
          color: 'white',
          gravity: 'north',
          y: 440
        },
        {
          overlay: {
            font_family: 'Arial',
            font_size: 76,
            font_weight: 'bold',
            text: percentage
          },
          color: 'white',
          gravity: 'north_west',
          x: 140,
          y: 840
        },
        {
          overlay: {
            font_family: 'Arial',
            font_size: 33,
            font_weight: 'bold',
            text: style.toUpperCase()
          },
          color: 'white',
          gravity: 'north',
          x: 100,
          y: 865
        },
        {
          overlay: {
            font_family: 'Arial',
            font_size: 29,
            font_weight: 'bold',
            text: title.toUpperCase()
          },
          color: 'white',
          gravity: 'north',
          x: 50,
          y: 948
        },
        {
          overlay: {
            font_family: 'Arial',
            font_size: 46,
            font_weight: 'bold',
            text: medallion.toUpperCase()
          },
          color: 'white',
          gravity: 'north',
          x: 150,
          y: 1030
        },
        {
          overlay: {
            font_family: 'Arial',
            font_size: 39,
            text: date
          },
          color: 'white',
          gravity: 'north',
          x: 20,
          y: 1160
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
