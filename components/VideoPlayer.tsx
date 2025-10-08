'use client';

import React from 'react';

interface VideoPlayerProps {
  videoUrl: string;
  videoType: 'youtube' | 'vimeo' | 'other';
  title?: string;
  className?: string;
}

export default function VideoPlayer({ 
  videoUrl, 
  videoType, 
  title = "Performance Video",
  className = '' 
}: VideoPlayerProps) {
  
  // Extract video ID from URLs for embedding
  const getEmbedUrl = (url: string, type: string) => {
    try {
      if (type === 'youtube') {
        // Handle various YouTube URL formats
        const videoId = extractYouTubeId(url);
        return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
      } else if (type === 'vimeo') {
        // Handle Vimeo URLs
        const videoId = extractVimeoId(url);
        return videoId ? `https://player.vimeo.com/video/${videoId}` : null;
      }
      return null;
    } catch (error) {
      console.error('Error creating embed URL:', error);
      return null;
    }
  };

  const extractYouTubeId = (url: string) => {
    // Handle multiple YouTube URL formats
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/watch\?.*?v=([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  const extractVimeoId = (url: string) => {
    const regExp = /vimeo\.com\/(?:video\/)?(\d+)/;
    const match = url.match(regExp);
    return match ? match[1] : null;
  };

  const embedUrl = getEmbedUrl(videoUrl, videoType);

  if (!videoUrl) {
    return (
      <div className={`bg-gray-100 border border-gray-300 rounded-lg p-4 ${className}`}>
        <p className="text-gray-500 text-center">No video provided</p>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-black flex items-center">
          <span className="mr-2">📹</span>
          Performance Video ({videoType?.toUpperCase()})
        </h3>
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          Open in New Tab
        </a>
      </div>

      {embedUrl ? (
        <div className="relative w-full bg-black rounded-lg overflow-hidden" style={{ paddingBottom: '56.25%' /* 16:9 aspect ratio */ }}>
          <iframe
            src={embedUrl}
            title={title}
            className="absolute top-0 left-0 w-full h-full"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="eager"
          />
        </div>
      ) : (
        <div className="space-y-3">
          {/* Fallback when video can't be embedded */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 text-2xl">⚠️</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-900 mb-2">
                  Video cannot be embedded directly
                </p>
                <p className="text-xs text-yellow-700 mb-3">
                  {videoType === 'youtube' 
                    ? 'YouTube video ID could not be extracted. Please check the URL format.' 
                    : 'This video type requires opening in a new tab.'}
                </p>
                <div className="bg-white rounded border border-yellow-300 p-2 mb-3">
                  <p className="text-xs font-mono text-gray-700 break-all">
                    {videoUrl}
                  </p>
                </div>
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <span className="mr-2">🎬</span>
                  Watch Video in New Tab
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-700">
          <strong>Judge Instructions:</strong> Review the complete performance video before scoring. 
          You can pause, rewind, and rewatch as needed for accurate evaluation.
        </p>
      </div>
    </div>
  );
}
