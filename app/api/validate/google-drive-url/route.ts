import { NextRequest, NextResponse } from 'next/server';

/**
 * Validates if a Google Drive URL is publicly accessible
 * POST /api/validate/google-drive-url
 * Body: { url: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    if (!url.includes('drive.google.com')) {
      return NextResponse.json({
        success: true,
        isValid: true,
        message: 'Not a Google Drive URL'
      });
    }

    // Convert to preview format
    let previewUrl = url;
    const fileIdPattern = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
    const match = url.match(fileIdPattern);
    
    if (match && match[1]) {
      previewUrl = `https://drive.google.com/file/d/${match[1]}/preview`;
    } else {
      const openPattern = /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/;
      const openMatch = url.match(openPattern);
      if (openMatch && openMatch[1]) {
        previewUrl = `https://drive.google.com/file/d/${openMatch[1]}/preview`;
      }
    }

    // Try to fetch the preview URL to check accessibility
    try {
      const response = await fetch(previewUrl, {
        method: 'HEAD',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      // Check if we got a successful response (200-299) or redirect (300-399)
      const status = response.status;
      
      if (status >= 200 && status < 400) {
        return NextResponse.json({
          success: true,
          isValid: true,
          previewUrl,
          message: 'Google Drive file is accessible'
        });
      } else if (status === 403 || status === 404) {
        return NextResponse.json({
          success: true,
          isValid: false,
          previewUrl,
          error: 'This Drive link is private. Please set it to "Anyone with the link" before saving.'
        });
      } else {
        // Other status codes - allow but warn
        return NextResponse.json({
          success: true,
          isValid: true,
          previewUrl,
          message: 'Could not verify access, but URL format is correct'
        });
      }
    } catch (fetchError: any) {
      // If fetch fails, it might be CORS or network issue
      // We'll allow it but show a warning
      console.warn('Error validating Google Drive URL:', fetchError);
      return NextResponse.json({
        success: true,
        isValid: true,
        previewUrl,
        message: 'Could not verify access due to network restrictions. Please ensure the file is shared with "Anyone with the link".'
      });
    }
  } catch (error: any) {
    console.error('Error in Google Drive URL validation:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to validate URL',
        details: error.message 
      },
      { status: 500 }
    );
  }
}


