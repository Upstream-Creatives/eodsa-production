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
    let title = searchParams.get('title') || 'RISING PHOENIX';
    const medallion = searchParams.get('medallion') || 'GOLD';
    const date = searchParams.get('date') || '4 October 2025';
    const eventId = searchParams.get('eventId'); // Optional: for custom template

    // Truncate title if too long (max 26 characters to fit on certificate)
    const MAX_TITLE_LENGTH = 26;
    if (title.length > MAX_TITLE_LENGTH) {
      title = title.substring(0, MAX_TITLE_LENGTH - 3) + '...';
    }

    // Determine which template to use
    let templatePublicId = 'Template_syz7di'; // Default template
    
    // If eventId provided, check for custom template
    if (eventId) {
      try {
        const { db } = await import('@/lib/database');
        const event = await db.getEventById(eventId);
        
        if (event?.certificateTemplateUrl) {
          // Extract public_id from Cloudinary URL
          try {
            const url = new URL(event.certificateTemplateUrl);
            const pathParts = url.pathname.split('/').filter(part => part.length > 0);
            const uploadIndex = pathParts.findIndex(part => part === 'upload');
            
            if (uploadIndex !== -1 && uploadIndex < pathParts.length - 1) {
              const afterUpload = pathParts.slice(uploadIndex + 1);
              const filtered = afterUpload.filter((part, idx) => {
                if (idx === 0 && /^v\d+$/.test(part)) return false; // Skip version
                return part.length > 0;
              });
              
              if (filtered.length > 0) {
                const lastPart = filtered[filtered.length - 1];
                filtered[filtered.length - 1] = lastPart.replace(/\.(pdf|png|jpg|jpeg)$/i, '');
                templatePublicId = filtered.join('/');
                console.log('✅ Using custom template:', templatePublicId);
              }
            }
          } catch (urlError) {
            console.warn('⚠️ Could not parse template URL, using default:', urlError);
          }
        }
      } catch (err) {
        console.warn('⚠️ Could not fetch event for custom template:', err);
      }
    }

    // Use Cloudinary's text overlay feature with Montserrat font
    // Positioning matches the original certificate generation exactly
    const certificateUrl = cloudinary.url(templatePublicId, {
      transformation: [
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: 65, // nameFontSize
            font_weight: 'bold',
            text: dancerName,
            letter_spacing: 2
          },
          color: 'white',
          gravity: 'north',
          y: Math.floor(48.5 * 13) // nameTop: 48.5
        },
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: 76, // percentageFontSize
            font_weight: 'bold',
            text: percentage.toString() // No % symbol, matches original
          },
          color: 'white',
          gravity: 'north_west',
          x: Math.floor(15.5 * 9), // percentageLeft: 15.5
          y: Math.floor(65.5 * 13) // percentageTop: 65.5
        },
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: 26, // styleFontSize (standardized)
            font_weight: 'bold',
            text: style.toUpperCase() // Just the value, no prefix
          },
          color: 'white',
          gravity: 'north',
          x: Math.floor((77.5 - 50) * 9), // styleLeft: 77.5 (matches original)
          y: Math.floor(67 * 13) // styleTop: 67 (matches original)
        },
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: 26, // titleFontSize (standardized)
            font_weight: 'bold',
            text: title.toUpperCase() // Just the value, no prefix
          },
          color: 'white',
          gravity: 'north',
          x: Math.floor((74 - 50) * 9), // titleLeft: 74 (matches original)
          y: Math.floor(74 * 13) // titleTop: 74 (matches original)
        },
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: 26, // medallionFontSize (standardized)
            font_weight: 'bold',
            text: medallion.toUpperCase() // Just the value, no prefix
          },
          color: 'white',
          gravity: 'north',
          x: Math.floor((72 - 50) * 9), // medallionLeft: 72 (matches original)
          y: Math.floor(80.5 * 13) // medallionTop: 80.5 (matches original)
        },
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: 39, // dateFontSize
            text: date
          },
          color: 'white',
          gravity: 'north',
          x: Math.floor((66.5 - 50) * 9), // dateLeft: 66.5 (matches original)
          y: Math.floor(88 * 13) // dateTop: 88 (moved up from 90, ~1.5 inches)
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
