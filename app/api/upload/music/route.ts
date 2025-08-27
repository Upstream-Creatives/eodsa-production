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

    // Validate file type - accept any audio format
    if (!file.type.startsWith('audio/')) {
      return NextResponse.json(
        { success: false, error: 'Please upload an audio file.' },
        { status: 400 }
      );
    }

    // Validate file size (50MB limit)
    if (file.size > 50000000) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 50MB.' },
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
