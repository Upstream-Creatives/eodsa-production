import { NextRequest, NextResponse } from 'next/server';
import { generateCertificateImage } from '@/lib/certificate-image-generator';

/**
 * GET /api/certificates/test/image
 * Generate and return test certificate image
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Get parameters from query string or use defaults
    const testData = {
      dancerName: searchParams.get('dancerName') || 'ANGELO SOLIS',
      percentage: parseInt(searchParams.get('percentage') || '92'),
      style: searchParams.get('style') || 'CONTEMPORARY',
      title: searchParams.get('title') || 'RISING PHOENIX',
      medallion: (searchParams.get('medallion') || 'Gold') as 'Gold' | 'Silver' | 'Bronze',
      date: searchParams.get('date') || '4 October 2025'
    };

    // Generate certificate image
    const certificateBuffer = await generateCertificateImage(testData);

    // Return image
    return new NextResponse(certificateBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': 'inline; filename="test-certificate.jpg"',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('Error generating test certificate image:', error);
    return NextResponse.json(
      { error: 'Failed to generate test certificate image', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
