import { NextRequest, NextResponse } from 'next/server';
import { generateCertificateImage } from '@/lib/certificate-image-generator';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Get positioning parameters from query string
    const nameTop = parseFloat(searchParams.get('nameTop') || '47.5');
    const nameLeft = parseFloat(searchParams.get('nameLeft') || '50');
    const nameFontSize = parseInt(searchParams.get('nameFontSize') || '42');

    const percentageTop = parseFloat(searchParams.get('percentageTop') || '64.5');
    const percentageLeft = parseFloat(searchParams.get('percentageLeft') || '14');
    const percentageFontSize = parseInt(searchParams.get('percentageFontSize') || '47');

    const styleTop = parseFloat(searchParams.get('styleTop') || '67.5');
    const styleLeft = parseFloat(searchParams.get('styleLeft') || '61');
    const styleFontSize = parseInt(searchParams.get('styleFontSize') || '20');

    const titleTop = parseFloat(searchParams.get('titleTop') || '73.5');
    const titleLeft = parseFloat(searchParams.get('titleLeft') || '57.5');
    const titleFontSize = parseInt(searchParams.get('titleFontSize') || '21');

    const medallionTop = parseFloat(searchParams.get('medallionTop') || '79.5');
    const medallionLeft = parseFloat(searchParams.get('medallionLeft') || '65');
    const medallionFontSize = parseInt(searchParams.get('medallionFontSize') || '32');

    const dateTop = parseFloat(searchParams.get('dateTop') || '89.5');
    const dateLeft = parseFloat(searchParams.get('dateLeft') || '67.5');
    const dateFontSize = parseInt(searchParams.get('dateFontSize') || '24');

    const certificateData = {
      dancerName: 'ANGELO SOLIS',
      percentage: 92,
      style: 'CONTEMPORARY',
      title: 'RISING PHOENIX',
      medallion: 'Gold' as const,
      date: '4 October 2025',
      positions: {
        nameTop,
        nameLeft,
        nameFontSize,
        percentageTop,
        percentageLeft,
        percentageFontSize,
        styleTop,
        styleLeft,
        styleFontSize,
        titleTop,
        titleLeft,
        titleFontSize,
        medallionTop,
        medallionLeft,
        medallionFontSize,
        dateTop,
        dateLeft,
        dateFontSize
      }
    };

    const certificateBuffer = await generateCertificateImage(certificateData);

    return new NextResponse(certificateBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Error generating certificate:', error);
    return NextResponse.json(
      { error: 'Failed to generate certificate' },
      { status: 500 }
    );
  }
}
