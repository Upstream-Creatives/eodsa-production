'use client';

import React, { useState, useRef, useEffect } from 'react';

interface BackstageMusicPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  performance: {
    id: string;
    title: string;
    contestantName: string;
    itemNumber?: number;
    entryType?: 'live' | 'virtual';
    musicFileUrl?: string;
    musicFileName?: string;
    videoExternalUrl?: string;
    duration: number;
  } | null;
}

export default function BackstageMusicPlayer({ 
  isOpen, 
  onClose, 
  performance 
}: BackstageMusicPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoop, setIsLoop] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !performance?.musicFileUrl) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => {
      if (!isLoop) {
        setIsPlaying(false);
        setCurrentTime(0);
      }
    };
    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('durationchange', updateDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('durationchange', updateDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [performance?.musicFileUrl, isLoop]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = volume;
      audio.loop = isLoop;
    }
  }, [volume, isLoop]);

  // Auto-pause when modal closes
  useEffect(() => {
    if (!isOpen && isPlaying) {
      pauseAudio();
    }
  }, [isOpen]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio || !performance?.musicFileUrl) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(error => {
          console.error('Error playing audio:', error);
          setIsPlaying(false);
        });
    }
  };

  const pauseAudio = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const stopAudio = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  const seekTo = (seekTime: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const skipForward = () => {
    const audio = audioRef.current;
    if (audio) {
      const newTime = Math.min(audio.currentTime + 10, duration);
      seekTo(newTime);
    }
  };

  const skipBackward = () => {
    const audio = audioRef.current;
    if (audio) {
      const newTime = Math.max(audio.currentTime - 10, 0);
      seekTo(newTime);
    }
  };

  if (!isOpen || !performance) return null;

  const hasMusic = performance.entryType === 'live' && performance.musicFileUrl;
  const hasVideo = performance.entryType === 'virtual' && performance.videoExternalUrl;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full border border-gray-600">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-600">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center font-bold text-lg text-white">
              {performance.itemNumber || '?'}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{performance.title}</h3>
              <p className="text-gray-300">by {performance.contestantName}</p>
              <p className="text-sm text-gray-400">
                {performance.entryType?.toUpperCase()} • {performance.duration}min
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <span className="text-2xl">×</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {hasMusic ? (
            <div className="space-y-6">
              {/* Audio Element */}
              <audio
                ref={audioRef}
                src={performance.musicFileUrl}
                preload="metadata"
                className="hidden"
              />

              {/* Now Playing Info */}
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <div>
                    <p className="text-white font-semibold">🎵 {performance.musicFileName || 'Music File'}</p>
                    <p className="text-gray-400 text-sm">Ready for backstage playback</p>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-400">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
                <div className="relative">
                  <div className="w-full h-2 bg-gray-600 rounded-full">
                    <div 
                      className="h-2 bg-purple-500 rounded-full transition-all duration-100"
                      style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
                    ></div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={(e) => seekTo(Number(e.target.value))}
                    className="absolute inset-0 w-full h-2 opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              {/* Main Controls */}
              <div className="flex items-center justify-center space-x-4">
                <button
                  onClick={skipBackward}
                  className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors"
                  title="Skip back 10s"
                >
                  <span className="text-white text-lg">⏪</span>
                </button>
                
                <button
                  onClick={togglePlayPause}
                  disabled={isLoading}
                  className={`p-4 rounded-full transition-all duration-200 ${
                    isLoading 
                      ? 'bg-gray-600 cursor-not-allowed' 
                      : isPlaying 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {isLoading ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <span className="text-white text-xl">
                      {isPlaying ? '⏸️' : '▶️'}
                    </span>
                  )}
                </button>

                <button
                  onClick={stopAudio}
                  className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors"
                  title="Stop"
                >
                  <span className="text-white text-lg">⏹️</span>
                </button>

                <button
                  onClick={skipForward}
                  className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors"
                  title="Skip forward 10s"
                >
                  <span className="text-white text-lg">⏩</span>
                </button>
              </div>

              {/* Secondary Controls */}
              <div className="flex items-center justify-between">
                {/* Volume Control */}
                <div className="flex items-center space-x-3">
                  <span className="text-gray-400 text-sm">🔊</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-24 h-2 bg-gray-600 rounded-full appearance-none cursor-pointer"
                  />
                  <span className="text-gray-400 text-sm w-8">{Math.round(volume * 100)}%</span>
                </div>

                {/* Loop Toggle */}
                <button
                  onClick={() => setIsLoop(!isLoop)}
                  className={`px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${
                    isLoop 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  🔁 Loop
                </button>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => seekTo(0)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition-colors"
                >
                  ⏮️ Restart
                </button>
                <button
                  onClick={() => {
                    if (duration) seekTo(duration - 10);
                  }}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-white font-semibold transition-colors"
                >
                  ⏭️ Near End
                </button>
              </div>
            </div>
          ) : hasVideo ? (
            <div className="space-y-4">
              <div className="bg-yellow-600/20 border border-yellow-600/50 rounded-lg p-4">
                <h4 className="text-yellow-400 font-semibold mb-2">📹 Virtual Performance</h4>
                <p className="text-gray-300 text-sm mb-3">
                  This is a virtual entry with a video link. Click below to open the video:
                </p>
                <a
                  href={performance.videoExternalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition-colors"
                >
                  <span>🎬</span>
                  <span>Open Video Link</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-6 text-center">
              <p className="text-gray-400 text-lg mb-2">🎵 No Music Available</p>
              <p className="text-gray-500 text-sm">
                This performance doesn't have any music file or video link attached.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
