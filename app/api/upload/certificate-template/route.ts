import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const eventId = formData.get('eventId') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'Event ID is required' },
        { status: 400 }
      );
    }

    // Validate file type (only PNG/JPG images)
    const fileType = file.type;
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    const fileExtension = file.name.toLowerCase().split('.').pop();
    const allowedExtensions = ['png', 'jpg', 'jpeg'];
    
    if (!allowedTypes.includes(fileType) || !allowedExtensions.includes(fileExtension || '')) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only PNG or JPG files are allowed.' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Cloudinary
    // Note: public_id should not include the folder prefix when folder is specified
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'certificate-templates',
          public_id: `event-${eventId}-template`, // Don't include folder in public_id
          resource_type: 'image',
          overwrite: true,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    const result = uploadResult as any;

    return NextResponse.json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
    });
  } catch (error) {
    console.error('Error uploading certificate template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload certificate template' },
      { status: 500 }
    );
  }
}

