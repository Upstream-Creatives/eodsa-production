import { NextRequest, NextResponse } from 'next/server';
import { cloudinary, MUSIC_UPLOAD_PRESET } from '@/lib/cloudinary';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type - check both MIME type and file extension for better browser compatibility
    const allowedTypes = [
      'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav', 'audio/aac', 'audio/mp4', 
      'audio/flac', 'audio/ogg', 'audio/x-ms-wma', 'audio/webm', 'audio/vnd.wav',
      'audio/x-aac', 'audio/x-m4a', 'audio/x-flac', 'audio/mpeg3', 'audio/mp4a-latm',
      'audio/x-audio', 'audio/basic', '' // Some browsers don't provide MIME type
    ];
    
    const fileExtension = file.name.toLowerCase().split('.').pop();
    const allowedExtensions = ['mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg', 'wma', 'webm'];
    
    const isValidType = allowedTypes.includes(file.type) || allowedExtensions.includes(fileExtension || '');
    
    if (!isValidType) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Please upload audio files with extensions: MP3, WAV, AAC, M4A, FLAC, OGG, WMA, or WebM.' },
        { status: 400 }
      );
    }

    // Validate file size (200MB limit)
    if (file.size > 200000000) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 200MB.' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    const timestamp = Date.now();
    const originalName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
    const publicId = `eodsa/music/${timestamp}_${originalName}`;

    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          ...MUSIC_UPLOAD_PRESET,
          public_id: publicId,
        },
        (error: any, result: any) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(buffer);
    }) as any;

    return NextResponse.json({
      success: true,
      data: {
        publicId: uploadResult.public_id,
        url: uploadResult.secure_url,
        originalFilename: file.name,
        fileSize: file.size,
        duration: uploadResult.duration, // Duration in seconds
        format: uploadResult.format,
        resourceType: uploadResult.resource_type,
        createdAt: uploadResult.created_at
      }
    });

  } catch (error: any) {
    console.error('Music upload error:', error);
    
    // Handle specific Cloudinary errors
    if (error.http_code === 400) {
      return NextResponse.json(
        { success: false, error: 'Invalid file format or corrupted file' },
        { status: 400 }
      );
    }
    
    if (error.http_code === 413) {
      return NextResponse.json(
        { success: false, error: 'File too large for upload' },
        { status: 413 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Upload failed. Please try again.' },
      { status: 500 }
    );
  }
}
