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
}

export default function MusicUpload({ 
  onUploadSuccess, 
  onUploadError, 
  disabled = false,
  currentFile = null 
}: MusicUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav', 'audio/aac', 'audio/mp4'];
    if (!allowedTypes.includes(file.type)) {
      onUploadError('Invalid file type. Please upload MP3, WAV, AAC, or M4A files only.');
      return;
    }

    // Validate file size (50MB)
    if (file.size > 50000000) {
      onUploadError('File too large. Maximum size is 50MB.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload/music', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        onUploadSuccess(result.data);
        setUploadProgress(100);
      } else {
        onUploadError(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      onUploadError('Upload failed. Please check your connection and try again.');
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
        <div className="bg-green-900/30 border border-green-500/40 rounded-xl p-4 sm:p-6 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center border border-green-500/30">
                <span className="text-2xl">🎵</span>
              </div>
              <div>
                <p className="font-semibold text-green-300 text-base">✅ Music File Uploaded</p>
                <p className="text-sm text-green-200 break-all">{currentFile.filename}</p>
              </div>
            </div>
            <div className="flex justify-center sm:justify-end">
              <audio 
                controls 
                className="h-10 sm:h-8 rounded-lg bg-slate-800/60"
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
        className={`relative border-2 border-dashed rounded-xl p-6 sm:p-8 transition-all duration-300 transform hover:scale-[1.01] ${
          dragActive
            ? 'border-purple-400 bg-purple-500/10 scale-[1.02]'
            : disabled
            ? 'border-slate-600 bg-slate-700/20 opacity-60 cursor-not-allowed'
            : isUploading
            ? 'border-blue-400 bg-blue-500/10'
            : 'border-slate-500 bg-slate-700/30 hover:border-purple-400 hover:bg-purple-500/10'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {isUploading ? (
          <div className="text-center py-4">
            <div className="w-16 h-16 mx-auto mb-6 bg-blue-500/20 rounded-full flex items-center justify-center border border-blue-500/30">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-400 border-t-transparent"></div>
            </div>
            <h4 className="text-lg font-semibold text-blue-300 mb-2">Uploading Music...</h4>
            <div className="mt-4 w-full bg-slate-600/50 rounded-full h-3 border border-slate-500/50">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-sm text-blue-200 mt-3 font-medium">{uploadProgress}% complete</p>
          </div>
        ) : (
          <div className="text-center py-4">
            <div className={`w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
              dragActive 
                ? 'bg-purple-500/20 border-purple-400 scale-110' 
                : disabled
                ? 'bg-slate-600/20 border-slate-500'
                : 'bg-slate-600/30 border-slate-500 hover:border-purple-400 hover:bg-purple-500/20'
            }`}>
              <span className="text-3xl">{dragActive ? '🎯' : '🎵'}</span>
            </div>
            
            <h4 className={`text-lg font-semibold mb-2 ${
              disabled ? 'text-slate-400' : 'text-slate-200'
            }`}>
              {currentFile ? '🔄 Replace Music File' : '📤 Upload Music File'}
            </h4>
            
            <p className={`text-sm mb-2 ${
              disabled ? 'text-slate-500' : 'text-slate-300'
            }`}>
              {dragActive 
                ? '🎯 Drop your music file here!' 
                : 'Drag and drop or click to select your music file'
              }
            </p>
            
            <div className={`text-xs mb-4 space-y-1 ${
              disabled ? 'text-slate-500' : 'text-slate-400'
            }`}>
              <p>📀 <strong>Supports:</strong> MP3, WAV, AAC, M4A</p>
              <p>📏 <strong>Max size:</strong> 50MB</p>
              <p>⏱️ <strong>Recommended:</strong> 2-4 minute duration</p>
            </div>
            
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className={`px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-300 transform ${
                disabled
                  ? 'bg-slate-600/50 text-slate-400 cursor-not-allowed border border-slate-500/50'
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
      <div className="bg-slate-800/40 border border-slate-600/50 rounded-lg p-4 space-y-2">
        <h5 className="text-sm font-semibold text-slate-300 mb-3 flex items-center">
          <span className="mr-2">💡</span>
          Music Upload Guidelines
        </h5>
        <div className="text-xs text-slate-400 space-y-1.5">
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
    </div>
  );
}
