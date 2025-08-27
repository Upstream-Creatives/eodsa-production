// Server-side Cloudinary config (only import when on server)
let cloudinary: any = null;

if (typeof window === 'undefined') {
  // Only import and configure on server-side
  const { v2 } = require('cloudinary');
  cloudinary = v2;
  
  cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export { cloudinary };

// Client-safe helper functions that work in browser
export function getOptimizedAudioUrl(publicId: string, options: any = {}) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloudName) return '';
  
  // Build URL manually for client-side
  const baseUrl = `https://res.cloudinary.com/${cloudName}/video/upload`;
  const transformations = [];
  
  if (options.quality) transformations.push(`q_${options.quality}`);
  if (options.fetch_format) transformations.push(`f_${options.fetch_format}`);
  
  const transformString = transformations.length > 0 ? transformations.join(',') + '/' : '';
  return `${baseUrl}/${transformString}${publicId}`;
}

// Client-safe download URL helper
export function getDownloadUrl(publicId: string, filename?: string) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloudName) return '';
  
  const baseUrl = `https://res.cloudinary.com/${cloudName}/video/upload`;
  const flags = ['fl_attachment'];
  if (filename) flags.push(`fl_attachment:${filename}`);
  
  return `${baseUrl}/${flags.join(',')}/${publicId}`;
}

// Upload preset configuration for music files
export const MUSIC_UPLOAD_PRESET = {
  resource_type: 'video' as const, // Audio files use video resource type
  max_file_size: 50000000, // 50MB limit
  folder: 'eodsa/music',
  use_filename: true,
  unique_filename: true,
  overwrite: false,
  quality: 'auto',
  eager: [
    { format: 'mp3', quality: 'auto' }, // Convert to MP3 for consistency
  ]
};

// Video upload preset configuration  
export const VIDEO_UPLOAD_PRESET = {
  resource_type: 'video' as const,
  allowed_formats: ['mp4', 'mov', 'avi', 'wmv', 'flv', 'webm'],
  max_file_size: 52428800, // 50MB limit
  folder: 'eodsa/videos',
  use_filename: true,
  unique_filename: true,
  overwrite: false,
  quality: 'auto',
  eager: [
    { width: 1280, height: 720, crop: 'limit', quality: 'auto', format: 'mp4' },
    { width: 640, height: 360, crop: 'limit', quality: 'auto', format: 'mp4' }
  ]
};
