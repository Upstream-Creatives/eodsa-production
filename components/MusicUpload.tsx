'use client';

import React, { useState, useRef } from 'react';

interface MusicUploadProps {
  onUploadSuccess: (fileData: {
    publicId: string;
    url: string;
    originalFilename: string;
    fileSize: number;
    duration: number;
    format: string;
  }) => void;
  onUploadError: (error: string) => void;
  disabled?: boolean;
  currentFile?: {
    url: string;
    filename: string;
  } | null;
  variant?: 'light' | 'dark';
  compact?: boolean;
}

export default function MusicUpload({ 
  onUploadSuccess, 
  onUploadError, 
  disabled = false,
  currentFile = null,
  variant = 'dark',
  compact = false
}: MusicUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file) return;

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
      onUploadError('Invalid file type. Please upload audio files with extensions: MP3, WAV, AAC, M4A, FLAC, OGG, WMA, or WebM.');
      return;
    }

    // Validate file size (200MB)
    if (file.size > 200000000) {
      onUploadError('File too large. Maximum size is 200MB.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Get signature from our endpoint
      const signatureResponse = await fetch('/api/upload/music', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: file.name,
          fileSize: file.size
        }),
      });

      if (!signatureResponse.ok) {
        throw new Error(`Signature error: ${signatureResponse.status}`);
      }

      const signatureData = await signatureResponse.json();
      
      if (!signatureData.success) {
        throw new Error(signatureData.error || 'Failed to get upload signature');
      }

      console.log('📝 Signature data received:', signatureData.data);
      setUploadProgress(10);

      // Step 2: Upload directly to Cloudinary
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', signatureData.data.api_key);
      formData.append('timestamp', signatureData.data.timestamp.toString());
      formData.append('signature', signatureData.data.signature);
      formData.append('public_id', signatureData.data.public_id);

      const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${signatureData.data.cloud_name}/${signatureData.data.resource_type}/upload`;
      console.log('🌐 Uploading to:', cloudinaryUrl);
      console.log('📤 Form data keys:', Array.from(formData.keys()));

      // Create XMLHttpRequest for progress tracking
      const uploadPromise = new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = 10 + Math.round((e.loaded / e.total) * 80); // 10-90%
            setUploadProgress(progress);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            try {
              const result = JSON.parse(xhr.responseText);
              resolve(result);
            } catch (e) {
              reject(new Error('Invalid response from Cloudinary'));
            }
          } else {
            reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });

        xhr.open('POST', cloudinaryUrl);
        xhr.send(formData);
      });

      const cloudinaryResult = await uploadPromise as any;
      setUploadProgress(95);

      // Step 3: Format response to match expected structure
      const result = {
        publicId: cloudinaryResult.public_id,
        url: cloudinaryResult.secure_url,
        originalFilename: file.name,
        fileSize: file.size,
        duration: cloudinaryResult.duration, // Duration in seconds
        format: cloudinaryResult.format,
        resourceType: cloudinaryResult.resource_type,
        createdAt: cloudinaryResult.created_at
      };

      onUploadSuccess(result);
      setUploadProgress(100);

    } catch (error: any) {
      console.error('Upload error:', error);
      
      if (error.message?.includes('Network error')) {
        onUploadError('Network error. Please check your internet connection and try again.');
      } else if (error.message?.includes('Signature error')) {
        onUploadError('Upload validation failed. Please try again.');
      } else if (error.message?.includes('Upload failed')) {
        onUploadError(`Upload failed: ${error.message}`);
      } else {
        onUploadError('Upload failed. Please try again.');
      }
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 2000);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    if (disabled || isUploading) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !isUploading) {
      setDragActive(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Current File Display */}
      {currentFile && (
        <div className={`${variant === 'light' ? 'bg-green-50 border-green-200' : 'bg-green-900/30 border-green-500/40'} border rounded-xl p-4 sm:p-6 ${variant === 'light' ? '' : 'backdrop-blur-sm'}`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${variant === 'light' ? 'bg-green-100 border-green-200' : 'bg-green-500/20 border-green-500/30'}`}>
                <span className="text-2xl">🎵</span>
              </div>
              <div>
                <p className={`font-semibold text-base ${variant === 'light' ? 'text-green-700' : 'text-green-300'}`}>✅ Music File Uploaded</p>
                <p className={`text-sm break-all ${variant === 'light' ? 'text-green-700/80' : 'text-green-200'}`}>{currentFile.filename}</p>
              </div>
            </div>
            <div className="flex justify-center sm:justify-end">
              <audio 
                controls 
                className={`h-10 sm:h-8 rounded-lg ${variant === 'light' ? 'bg-white border border-gray-200' : 'bg-slate-800/60'}`}
                style={{ 
                  width: '100%', 
                  maxWidth: '280px',
                  minWidth: '200px'
                }}
                preload="metadata"
              >
                <source src={currentFile.url} type="audio/mpeg" />
                <source src={currentFile.url} type="audio/wav" />
                <source src={currentFile.url} type="audio/aac" />
                Your browser does not support the audio element.
              </audio>
            </div>
          </div>
        </div>
      )}

      {/* Upload Area */}
      <div
        className={`relative ${compact ? 'p-4 rounded-xl' : 'p-6 sm:p-8 rounded-2xl'} border ${compact ? 'border' : 'border-2'} border-dashed transition-all duration-300 shadow-sm ${
          dragActive
            ? variant === 'light' ? 'border-purple-400 bg-purple-50' : 'border-purple-400 bg-purple-500/10'
            : disabled
            ? variant === 'light' ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed' : 'border-slate-600 bg-slate-700/20 opacity-60 cursor-not-allowed'
            : isUploading
            ? variant === 'light' ? 'border-blue-300 bg-blue-50' : 'border-blue-400 bg-blue-500/10'
            : variant === 'light' ? 'border-gray-200 bg-white hover:border-purple-300' : 'border-slate-500 bg-slate-700/30 hover:border-purple-400 hover:bg-purple-500/10'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {isUploading ? (
          <div className="text-center py-4">
            <div className={`w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center border ${variant === 'light' ? 'bg-blue-50 border-blue-200' : 'bg-blue-500/20 border-blue-500/30'}`}>
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-400 border-t-transparent"></div>
            </div>
            <h4 className={`text-lg font-semibold mb-2 ${variant === 'light' ? 'text-blue-700' : 'text-blue-300'}`}>Uploading Music...</h4>
            <div className={`mt-4 w-full rounded-full h-3 border ${variant === 'light' ? 'bg-gray-100 border-gray-200' : 'bg-slate-600/50 border-slate-500/50'}`}>
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className={`text-sm mt-3 font-medium ${variant === 'light' ? 'text-blue-700' : 'text-blue-200'}`}>{uploadProgress}% complete</p>
          </div>
        ) : (
          <div className="text-center py-4">
            <div className={`mx-auto mb-4 ${compact ? 'w-12 h-12' : 'w-16 h-16'} rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
              dragActive
                ? variant === 'light' ? 'bg-purple-50 border-purple-300 scale-110' : 'bg-purple-500/20 border-purple-400 scale-110'
                : disabled
                ? variant === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-slate-600/20 border-slate-500'
                : variant === 'light' ? 'bg-gray-50 border-gray-200 hover:border-purple-300' : 'bg-slate-600/30 border-slate-500 hover:border-purple-400 hover:bg-purple-500/20'
            }`}>
              <span className={`${compact ? 'text-2xl' : 'text-3xl'}`}>{dragActive ? '🎯' : '🎵'}</span>
            </div>
            
            <h4 className={`${compact ? 'text-base' : 'text-lg'} font-semibold mb-1 ${
              disabled ? (variant === 'light' ? 'text-gray-400' : 'text-slate-400') : (variant === 'light' ? 'text-gray-800' : 'text-slate-200')
            }`}>
              {currentFile ? '🔄 Replace Music File' : '📤 Upload Music File'}
            </h4>
            
            <p className={`${compact ? 'text-xs' : 'text-sm'} mb-2 ${
              disabled ? (variant === 'light' ? 'text-gray-400' : 'text-slate-500') : (variant === 'light' ? 'text-gray-600' : 'text-slate-300')
            }`}>
              {dragActive 
                ? '🎯 Drop your music file here!' 
                : 'Drag and drop or click to select your music file'
              }
            </p>
            
            <div className={`text-xs ${compact ? 'mb-2' : 'mb-4'} space-y-1 ${
              disabled ? (variant === 'light' ? 'text-gray-400' : 'text-slate-500') : (variant === 'light' ? 'text-gray-500' : 'text-slate-400')
            }`}>
              <p>📀 <strong>Supports:</strong> MP3, WAV, AAC, M4A</p>
              <p>📏 <strong>Max size:</strong> 50MB</p>
              <p>⏱️ <strong>Recommended:</strong> 2-4 minute duration</p>
            </div>
            
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className={`${compact ? 'px-4 py-2' : 'px-6 py-3'} text-sm font-semibold rounded-xl transition-all duration-300 transform ${
                disabled
                  ? (variant === 'light' ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200' : 'bg-slate-600/50 text-slate-400 cursor-not-allowed border border-slate-500/50')
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 hover:scale-105 shadow-lg hover:shadow-purple-500/25 border border-purple-500/30'
              }`}
            >
              {currentFile ? '🔄 Choose New File' : '📁 Choose File'}
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.wav,.aac,.m4a,audio/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || isUploading}
        />
      </div>

      {/* Enhanced Help Text */}
      {!compact && (
      <div className={`${variant === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-slate-800/40 border-slate-600/50'} border rounded-lg p-4 space-y-2`}>
        <h5 className={`text-sm font-semibold mb-3 flex items-center ${variant === 'light' ? 'text-gray-700' : 'text-slate-300'}`}>
          <span className="mr-2">💡</span>
          Music Upload Guidelines
        </h5>
        <div className={`text-xs space-y-1.5 ${variant === 'light' ? 'text-gray-600' : 'text-slate-400'}`}>
          <p className="flex items-start">
            <span className="mr-2 text-green-400">✓</span>
            <span>Music file will be played during your live performance</span>
          </p>
          <p className="flex items-start">
            <span className="mr-2 text-blue-400">🎧</span>
            <span>Judges can preview and download your music during scoring</span>
          </p>
          <p className="flex items-start">
            <span className="mr-2 text-yellow-400">⚠️</span>
            <span>Ensure this is the <strong>exact version</strong> for your performance</span>
          </p>
          <p className="flex items-start">
            <span className="mr-2 text-purple-400">🔊</span>
            <span>High-quality audio files provide better playback experience</span>
          </p>
        </div>
      </div>
      )}
    </div>
  );
}
