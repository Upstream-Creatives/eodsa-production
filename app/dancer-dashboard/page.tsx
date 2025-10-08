'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MusicUpload from '@/components/MusicUpload';
import VideoUpload from '@/components/VideoUpload';

interface DancerSession {
  id: string;
  name: string;
  eodsaId: string;
  approved: boolean;
  email?: string;
}

interface StudioApplication {
  id: string;
  studioName: string;
  contactPerson: string;
  status: 'pending' | 'accepted' | 'rejected';
  appliedAt: string;
  respondedAt?: string;
  rejectionReason?: string;
}

// Music Upload Section Component
function MusicUploadSection({ dancerSession }: { dancerSession: DancerSession }) {
  const [musicEntries, setMusicEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadingEntryId, setUploadingEntryId] = useState<string | null>(null);

  useEffect(() => {
    loadMusicEntries();
  }, [dancerSession.eodsaId]);

  const loadMusicEntries = async () => {
    try {
      const response = await fetch(`/api/contestants/music-entries?eodsaId=${dancerSession.eodsaId}`);
      const data = await response.json();
      
      if (data.success) {
        setMusicEntries(data.entries);
      } else {
        setError(data.error || 'Failed to load entries');
      }
    } catch (error) {
      console.error('Error loading music entries:', error);
      setError('Failed to load entries');
    } finally {
      setLoading(false);
    }
  };

  const handleMusicUpload = async (entryId: string, fileData: any) => {
    try {
      setUploadingEntryId(entryId);
      
      const response = await fetch('/api/contestants/upload-music', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entryId,
          musicFileUrl: fileData.url,
          musicFileName: fileData.originalFilename,
          eodsaId: dancerSession.eodsaId
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        // Refresh the entries list
        await loadMusicEntries();
      } else {
        setError(result.error || 'Failed to upload music');
      }
    } catch (error) {
      console.error('Error uploading music:', error);
      setError('Failed to upload music');
    } finally {
      setUploadingEntryId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800/80 rounded-2xl border border-gray-700/20 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          <span className="ml-3 text-gray-300">Loading music upload requirements...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/80 rounded-2xl border border-gray-700/20 overflow-hidden">
      <div className="p-6 border-b border-gray-700">
        <h3 className="text-xl font-bold text-white">🎵 Music Uploads Required</h3>
        <p className="text-gray-400 text-sm mt-1">Upload music files for your live performance entries</p>
      </div>

      {error && (
        <div className="p-4 bg-red-500/20 border-b border-red-500/30 text-red-200">
          {error}
        </div>
      )}

      {musicEntries.length === 0 ? (
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🎵</span>
          </div>
          <p className="text-gray-400 mb-2">No music uploads required</p>
          <p className="text-gray-500 text-sm">
            All your live entries already have music files uploaded, or you don't have any live entries yet.
          </p>
        </div>
      ) : (
        <div className="p-6">
          <div className="space-y-6">
            {musicEntries.map((entry) => {
              const isGroupEntry = entry.participantIds && entry.participantIds.length > 1;
              const isOwner = entry.eodsaId === dancerSession.eodsaId;
              const performanceType = isGroupEntry 
                ? entry.participantIds.length === 2 ? 'Duet'
                : entry.participantIds.length === 3 ? 'Trio' 
                : 'Group'
                : 'Solo';
              
              return (
                <div key={entry.id} className="bg-gray-700/50 rounded-xl p-4 sm:p-6 border border-gray-600 hover:border-purple-500 transition-all duration-300">
                  <div className="mb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3">
                      <h4 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-0">{entry.itemName}</h4>
                      
                      {/* Performance Type Badge */}
                      <div className="flex items-center space-x-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          isGroupEntry 
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}>
                          {isGroupEntry ? `👥 ${performanceType}` : '🕺 Solo'}
                        </span>
                        
                        {/* Access Type Badge */}
                        {isGroupEntry && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            isOwner 
                              ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                              : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                          }`}>
                            {isOwner ? '👑 Owner' : '🤝 Participant'}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <p className="text-gray-300">Event: <span className="text-white font-medium">{entry.eventName}</span></p>
                      <p className="text-gray-300">Style: <span className="text-white font-medium">{entry.itemStyle}</span></p>
                      <p className="text-gray-300">Mastery: <span className="text-white font-medium">{entry.mastery}</span></p>
                      {/* Duration hidden by request */}
                    </div>
                    
                    {/* Group Info */}
                    {isGroupEntry && (
                      <div className="mt-3 p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                        <p className="text-purple-300 text-sm font-medium mb-1">
                          🎭 Group Performance ({entry.participantIds.length} dancers)
                        </p>
                        <p className="text-purple-200 text-xs">
                          {isOwner 
                            ? 'You registered this group entry. Any group member can upload music.'
                            : 'You\'re a participant in this group. You can upload music for the entire group.'
                          }
                        </p>
                      </div>
                    )}
                    
                    <div className="border-t border-gray-600 pt-4 mt-4">
                      <p className="text-sm text-gray-400 mb-3">Upload music file for this live performance:</p>
                      <MusicUpload
                        onUploadSuccess={(fileData) => handleMusicUpload(entry.id, fileData)}
                        onUploadError={(error) => setError(error)}
                        disabled={uploadingEntryId === entry.id}
                      />
                      {uploadingEntryId === entry.id && (
                        <div className="mt-2 text-sm text-blue-400 flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400 mr-2"></div>
                          Saving music file...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Video Upload Section Component
function VideoUploadSection({ dancerSession }: { dancerSession: DancerSession }) {
  const [videoEntries, setVideoEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadingEntryId, setUploadingEntryId] = useState<string | null>(null);

  useEffect(() => {
    loadVideoEntries();
  }, [dancerSession.eodsaId]);

  const loadVideoEntries = async () => {
    try {
      const response = await fetch(`/api/contestants/video-entries?eodsaId=${dancerSession.eodsaId}`);
      const data = await response.json();
      
      if (data.success) {
        setVideoEntries(data.entries);
      } else {
        setError(data.error || 'Failed to load entries');
      }
    } catch (error) {
      console.error('Error loading video entries:', error);
      setError('Failed to load entries');
    } finally {
      setLoading(false);
    }
  };

  const handleVideoUpload = async (entryId: string, fileData: any) => {
    try {
      setUploadingEntryId(entryId);
      
      const response = await fetch('/api/contestants/upload-video', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entryId,
          videoFileUrl: fileData.url,
          videoFileName: fileData.originalFilename,
          eodsaId: dancerSession.eodsaId
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        // Refresh the entries list
        await loadVideoEntries();
      } else {
        setError(result.error || 'Failed to upload video');
      }
    } catch (error) {
      console.error('Error uploading video:', error);
      setError('Failed to upload video');
    } finally {
      setUploadingEntryId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800/80 rounded-2xl border border-gray-700/20 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          <span className="ml-3 text-gray-300">Loading video upload requirements...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/80 rounded-2xl border border-gray-700/20 overflow-hidden">
      <div className="p-6 border-b border-gray-700">
        <h3 className="text-xl font-bold text-white">📹 Video Uploads Required</h3>
        <p className="text-gray-400 text-sm mt-1">Upload video files for your virtual performance entries</p>
      </div>

      {error && (
        <div className="p-4 bg-red-500/20 border-b border-red-500/30 text-red-200">
          {error}
        </div>
      )}

      {videoEntries.length === 0 ? (
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📹</span>
          </div>
          <p className="text-gray-400 mb-2">No video uploads required</p>
          <p className="text-gray-500 text-sm">
            All your virtual entries already have videos uploaded, or you don't have any virtual entries yet.
          </p>
        </div>
      ) : (
        <div className="p-6">
          <div className="space-y-6">
            {videoEntries.map((entry) => {
              const isGroupEntry = entry.participantIds && entry.participantIds.length > 1;
              const isOwner = entry.eodsaId === dancerSession.eodsaId;
              const performanceType = isGroupEntry 
                ? entry.participantIds.length === 2 ? 'Duet'
                : entry.participantIds.length === 3 ? 'Trio' 
                : 'Group'
                : 'Solo';
              
              return (
                <div key={entry.id} className="bg-gray-700/50 rounded-xl p-4 sm:p-6 border border-gray-600 hover:border-purple-500 transition-all duration-300">
                  <div className="mb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3">
                      <h4 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-0">{entry.itemName}</h4>
                      
                      {/* Performance Type Badge */}
                      <div className="flex items-center space-x-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          isGroupEntry 
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}>
                          {isGroupEntry ? `👥 ${performanceType}` : '🕺 Solo'}
                        </span>
                        
                        {/* Virtual Badge */}
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          📹 Virtual
                        </span>
                        
                        {/* Access Type Badge */}
                        {isGroupEntry && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            isOwner 
                              ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                              : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                          }`}>
                            {isOwner ? '👑 Owner' : '🤝 Participant'}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <p className="text-gray-300">Event: <span className="text-white font-medium">{entry.eventName}</span></p>
                      <p className="text-gray-300">Style: <span className="text-white font-medium">{entry.itemStyle}</span></p>
                      <p className="text-gray-300">Mastery: <span className="text-white font-medium">{entry.mastery}</span></p>
                      {/* Duration hidden by request */}
                    </div>
                    
                    {/* Group Info */}
                    {isGroupEntry && (
                      <div className="mt-3 p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                        <p className="text-purple-300 text-sm font-medium mb-1">
                          🎭 Group Performance ({entry.participantIds.length} dancers)
                        </p>
                        <p className="text-purple-200 text-xs">
                          {isOwner 
                            ? 'You registered this group entry. Any group member can upload video.'
                            : 'You\'re a participant in this group. You can upload video for the entire group.'
                          }
                        </p>
                      </div>
                    )}
                    
                    <div className="border-t border-gray-600 pt-4 mt-4">
                      <p className="text-sm text-gray-400 mb-3">Upload video file for this virtual performance:</p>
                      <VideoUpload
                        onUploadSuccess={(fileData) => handleVideoUpload(entry.id, fileData)}
                        onUploadError={(error) => setError(error)}
                        disabled={uploadingEntryId === entry.id}
                      />
                      {uploadingEntryId === entry.id && (
                        <div className="mt-2 text-sm text-blue-400 flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400 mr-2"></div>
                          Saving video file...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Scores & Feedback Section Component
function ScoresFeedbackSection({ dancerSession }: { dancerSession: DancerSession }) {
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedScore, setSelectedScore] = useState<any | null>(null);
  const [showScoreDetails, setShowScoreDetails] = useState(false);

  useEffect(() => {
    loadScores();
  }, [dancerSession.eodsaId]);

  const loadScores = async () => {
    try {
      const response = await fetch(`/api/dancers/scores?eodsaId=${dancerSession.eodsaId}`);
      const data = await response.json();

      if (data.success) {
        setScores(data.scores);
      } else {
        setError(data.error || 'Failed to load scores');
      }
    } catch (error) {
      console.error('Error loading scores:', error);
      setError('Failed to load scores');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalScore = (score: any) => {
    return Number(score.technicalScore) + Number(score.musicalScore) +
           Number(score.performanceScore) + Number(score.stylingScore) +
           Number(score.overallImpressionScore);
  };

  const getMedalColor = (total: number) => {
    if (total >= 90) return 'text-yellow-400'; // Gold
    if (total >= 80) return 'text-gray-300'; // Silver
    if (total >= 70) return 'text-orange-400'; // Bronze
    return 'text-blue-400'; // Participation
  };

  const getMedalName = (total: number) => {
    if (total >= 90) return 'Gold';
    if (total >= 80) return 'Silver';
    if (total >= 70) return 'Bronze';
    return 'Participation';
  };

  if (loading) {
    return (
      <div className="bg-gray-800/80 rounded-2xl border border-gray-700/20 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          <span className="ml-3 text-gray-300">Loading scores...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-gray-800/80 rounded-2xl border border-gray-700/20 overflow-hidden">
        <div className="p-6 border-b border-gray-700">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-white">
                🏅 My Scores & Feedback
                {!loading && (
                  <span className="text-sm font-normal text-gray-400 ml-2">
                    ({scores.length})
                  </span>
                )}
              </h3>
              <p className="text-gray-400 text-sm mt-1">View your performance scores and judge feedback</p>
            </div>
            <button
              onClick={loadScores}
              disabled={loading}
              className="px-3 py-1 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {loading ? '🔄' : '↻'} Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/20 border-b border-red-500/30 text-red-200">
            {error}
          </div>
        )}

        {scores.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🏅</span>
            </div>
            <p className="text-gray-400 mb-2">No scores available yet</p>
            <p className="text-gray-500 text-sm">
              Scores will appear here after judges have scored your performances and they've been approved.
            </p>
          </div>
        ) : (
          <div className="p-6">
            <div className="space-y-4">
              {scores.map((score) => {
                const totalScore = calculateTotalScore(score);
                return (
                  <div
                    key={score.id}
                    className="bg-gray-700/50 rounded-xl p-4 border border-gray-600 hover:border-purple-500 transition-all duration-300 cursor-pointer"
                    onClick={() => {
                      setSelectedScore(score);
                      setShowScoreDetails(true);
                    }}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h4 className="text-lg font-bold text-white mb-1">{score.performanceTitle}</h4>
                        <p className="text-sm text-gray-400">Judge: {score.judgeName}</p>
                        <p className="text-xs text-gray-500">{new Date(score.scoredAt).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <div className={`text-3xl font-bold ${getMedalColor(totalScore)}`}>
                          {totalScore}<span className="text-lg text-gray-400">/100</span>
                        </div>
                        <div className={`text-xs font-semibold ${getMedalColor(totalScore)}`}>
                          {getMedalName(totalScore)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-5 gap-2">
                      <div className="text-center">
                        <div className="text-sm font-bold text-blue-400">{score.technicalScore}</div>
                        <div className="text-[10px] text-gray-500">Technical</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold text-purple-400">{score.musicalScore}</div>
                        <div className="text-[10px] text-gray-500">Musical</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold text-green-400">{score.performanceScore}</div>
                        <div className="text-[10px] text-gray-500">Performance</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold text-orange-400">{score.stylingScore}</div>
                        <div className="text-[10px] text-gray-500">Styling</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold text-pink-400">{score.overallImpressionScore}</div>
                        <div className="text-[10px] text-gray-500">Overall</div>
                      </div>
                    </div>

                    {score.comments && (
                      <div className="mt-3 p-2 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                        <p className="text-xs text-blue-300 italic line-clamp-2">{score.comments}</p>
                      </div>
                    )}

                    <div className="mt-2 text-xs text-purple-400 text-right">
                      Click to view full details →
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Score Details Modal */}
      {showScoreDetails && selectedScore && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50" onClick={() => setShowScoreDetails(false)}>
          <div className="bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center sticky top-0 bg-gray-800 z-10">
              <h3 className="text-xl font-semibold text-white">{selectedScore.performanceTitle}</h3>
              <button
                onClick={() => setShowScoreDetails(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 border border-purple-500/30 rounded-xl p-6 mb-6 text-center">
                <p className="text-sm font-semibold text-purple-300 mb-2">TOTAL SCORE</p>
                <p className={`text-5xl font-bold ${getMedalColor(calculateTotalScore(selectedScore))}`}>
                  {calculateTotalScore(selectedScore)}
                  <span className="text-3xl text-gray-400">/100</span>
                </p>
                <p className={`text-sm font-semibold mt-2 ${getMedalColor(calculateTotalScore(selectedScore))}`}>
                  🏅 {getMedalName(calculateTotalScore(selectedScore))}
                </p>
              </div>

              <div className="space-y-4 mb-6">
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <h4 className="font-bold text-white mb-3 flex items-center">
                    <span className="mr-2">📊</span>
                    Score Breakdown
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-300">Technical Execution</span>
                      <span className="font-bold text-blue-400">{selectedScore.technicalScore}/20</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-300">Musical Interpretation</span>
                      <span className="font-bold text-purple-400">{selectedScore.musicalScore}/20</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-300">Performance Quality</span>
                      <span className="font-bold text-green-400">{selectedScore.performanceScore}/20</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-300">Styling & Presentation</span>
                      <span className="font-bold text-orange-400">{selectedScore.stylingScore}/20</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-300">Overall Impression</span>
                      <span className="font-bold text-pink-400">{selectedScore.overallImpressionScore}/20</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-700/50 rounded-lg p-4">
                  <h4 className="font-bold text-white mb-2 flex items-center">
                    <span className="mr-2">ℹ️</span>
                    Performance Info
                  </h4>
                  <div className="space-y-1 text-sm">
                    <p className="text-gray-300">Judge: <span className="text-white">{selectedScore.judgeName}</span></p>
                    <p className="text-gray-300">Scored: <span className="text-white">{new Date(selectedScore.scoredAt).toLocaleString()}</span></p>
                  </div>
                </div>
              </div>

              {selectedScore.comments && (
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                  <h4 className="font-bold text-blue-300 mb-2 flex items-center">
                    <span className="mr-2">💬</span>
                    Judge Comments
                  </h4>
                  <p className="text-sm text-blue-200 italic leading-relaxed">{selectedScore.comments}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Competition Entries Section Component
function CompetitionEntriesSection({ dancerSession }: { dancerSession: DancerSession }) {
  const [competitionEntries, setCompetitionEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCompetitionEntries();
  }, [dancerSession.eodsaId]);

  const loadCompetitionEntries = async () => {
    try {
      // Add debug parameter if needed
      const debugMode = process.env.NODE_ENV === 'development';
      const response = await fetch(`/api/contestants/entries?eodsaId=${dancerSession.eodsaId}${debugMode ? '&debug=true' : ''}`);
      const data = await response.json();
      
      if (data.success) {
        setCompetitionEntries(data.entries);
        console.log(`Loaded ${data.entries.length} competition entries for dancer ${dancerSession.eodsaId}`);
        if (data.debug) {
          console.log('Debug info:', data.debug);
        }
      } else {
        setError(data.error || 'Failed to load entries');
        console.error('Failed to load entries:', data.error);
      }
    } catch (error) {
      console.error('Error loading competition entries:', error);
      setError('Failed to load entries');
    } finally {
      setLoading(false);
    }
  };

  const getEntryTypeBadge = (entryType: string) => {
    return entryType === 'live' 
      ? 'bg-green-500/20 text-green-300 border border-green-500/30'
      : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30';
  };

  const getStatusBadge = (approved: boolean, paid: boolean) => {
    if (!paid) return 'bg-red-500/20 text-red-300 border border-red-500/30';
    if (!approved) return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30';
    return 'bg-green-500/20 text-green-300 border border-green-500/30';
  };

  const getStatusText = (approved: boolean, paid: boolean) => {
    if (!paid) return '💳 Payment Required';
    if (!approved) return '⏳ Pending Approval';
    return '✅ Approved';
  };

  if (loading) {
    return (
      <div className="bg-gray-800/80 rounded-2xl border border-gray-700/20 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          <span className="ml-3 text-gray-300">Loading competition entries...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/80 rounded-2xl border border-gray-700/20 overflow-hidden">
      <div className="p-6 border-b border-gray-700">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-white">
              🏆 My Competition Entries 
              {!loading && (
                <span className="text-sm font-normal text-gray-400 ml-2">
                  ({competitionEntries.length})
                </span>
              )}
            </h3>
            <p className="text-gray-400 text-sm mt-1">All your competition entries across different events</p>
          </div>
          <button
            onClick={loadCompetitionEntries}
            disabled={loading}
            className="px-3 py-1 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {loading ? '🔄' : '↻'} Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/20 border-b border-red-500/30 text-red-200">
          {error}
        </div>
      )}

      {competitionEntries.length === 0 ? (
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🏆</span>
          </div>
          <p className="text-gray-400 mb-2">No competition entries found</p>
          <p className="text-gray-500 text-sm mb-4">
            You haven't entered any competitions yet, or entries may still be processing.
          </p>
          <div className="space-y-2 text-xs text-gray-600">
            <p>📋 Entries are typically created by your studio or coach</p>
            <p>🔍 EODSA ID being searched: <span className="font-mono text-gray-400">{dancerSession.eodsaId}</span></p>
            <p>📞 Contact your studio if you expect to see entries here</p>
          </div>
          <button
            onClick={loadCompetitionEntries}
            className="mt-4 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            🔄 Check Again
          </button>
        </div>
      ) : (
        <div className="p-6">
          <div className="space-y-6">
            {competitionEntries.map((entry) => {
              const isGroupEntry = entry.participantIds && entry.participantIds.length > 1;
              const isOwner = entry.eodsaId === dancerSession.eodsaId;
              const performanceType = isGroupEntry 
                ? entry.participantIds.length === 2 ? 'Duet'
                : entry.participantIds.length === 3 ? 'Trio' 
                : 'Group'
                : 'Solo';
              
              return (
                <div key={entry.id} className="bg-gray-700/50 rounded-xl p-4 sm:p-6 border border-gray-600 hover:border-purple-500 transition-all duration-300">
                  <div className="mb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3">
                      <h4 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-0">{entry.itemName}</h4>
                      
                      {/* Badges Row */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Performance Type Badge */}
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          isGroupEntry 
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}>
                          {isGroupEntry ? `👥 ${performanceType}` : '🕺 Solo'}
                        </span>
                        
                        {/* Entry Type Badge */}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEntryTypeBadge(entry.entryType)}`}>
                          {entry.entryType === 'live' ? '🎤 Live' : '📹 Virtual'}
                        </span>
                        
                        {/* Status Badge */}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(entry.approved, entry.paid)}`}>
                          {getStatusText(entry.approved, entry.paid)}
                        </span>
                        
                        {/* Access Type Badge for Groups */}
                        {isGroupEntry && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            isOwner 
                              ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                              : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                          }`}>
                            {isOwner ? '👑 Owner' : '🤝 Participant'}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                      <p className="text-gray-300">Event: <span className="text-white font-medium">{entry.eventName}</span></p>
                      <p className="text-gray-300">Style: <span className="text-white font-medium">{entry.itemStyle}</span></p>
                      <p className="text-gray-300">Mastery: <span className="text-white font-medium">{entry.mastery}</span></p>
                      {/* Duration hidden by request */}
                      {entry.region && (
                        <p className="text-gray-300">Region: <span className="text-white font-medium">{entry.region}</span></p>
                      )}
                      {entry.venue && entry.venue !== 'TBD' && (
                        <p className="text-gray-300">Venue: <span className="text-white font-medium">{entry.venue}</span></p>
                      )}
                    </div>

                    {/* Event Date */}
                    {entry.eventDate && (
                      <div className="mt-3 p-2 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                        <p className="text-blue-300 text-sm">
                          📅 Event Date: <span className="font-medium">{new Date(entry.eventDate).toLocaleDateString()}</span>
                        </p>
                      </div>
                    )}
                    
                    {/* Group Info */}
                    {isGroupEntry && (
                      <div className="mt-3 p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                        <p className="text-purple-300 text-sm font-medium mb-1">
                          🎭 Group Performance ({entry.participantIds.length} dancers)
                        </p>
                        <p className="text-purple-200 text-xs">
                          {isOwner 
                            ? 'You registered this group entry and can manage it.'
                            : 'You\'re a participant in this group entry.'
                          }
                        </p>
                      </div>
                    )}

                    {/* Entry Fee Information */}
                    <div className="mt-3 p-3 bg-gray-800/50 border border-gray-600 rounded-lg">
                      <div className="flex justify-between items-center">
                        <p className="text-gray-300 text-sm">Entry Fee:</p>
                        <p className="text-white font-semibold">R{entry.entryFee || 0}</p>
                      </div>
                      {!entry.paid && (
                        <p className="text-red-400 text-xs mt-1">⚠️ Payment required to complete registration</p>
                      )}
                    </div>

                    {/* File Upload Status */}
                    {entry.entryType === 'live' && (
                      <div className="mt-3 p-2 bg-green-900/20 border border-green-500/30 rounded-lg">
                        <p className="text-green-300 text-sm">
                          🎵 Music File: {entry.musicFileUrl ? 
                            <span className="text-green-400 font-medium">✅ Uploaded</span> : 
                            <span className="text-yellow-400 font-medium">📤 Upload Required</span>
                          }
                        </p>
                      </div>
                    )}

                    {entry.entryType === 'virtual' && (
                      <div className="mt-3 p-2 bg-indigo-900/20 border border-indigo-500/30 rounded-lg">
                        <p className="text-indigo-300 text-sm">
                          📹 Video File: {(entry.videoFileUrl || entry.videoExternalUrl) ? 
                            <span className="text-green-400 font-medium">✅ Uploaded</span> : 
                            <span className="text-yellow-400 font-medium">📤 Upload Required</span>
                          }
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DancerDashboardPage() {
  const [dancerSession, setDancerSession] = useState<DancerSession | null>(null);
  const [applications, setApplications] = useState<StudioApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const session = localStorage.getItem('dancerSession');
    if (!session) {
      router.push('/dancer-login');
      return;
    }

    try {
      const parsedSession = JSON.parse(session);
      setDancerSession(parsedSession);
      loadDancerData(parsedSession.id);
    } catch {
      router.push('/dancer-login');
    }
  }, [router]);

  const loadDancerData = async (dancerId: string) => {
    try {
      const appsResponse = await fetch(`/api/dancers/applications?dancerId=${dancerId}`);
      const appsData = await appsResponse.json();

      if (appsData.success) {
        setApplications(appsData.applications);
      }
    } catch (error) {
      console.error('Error loading dancer data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('dancerSession');
    router.push('/dancer-login');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500';
      case 'accepted':
        return 'bg-green-500';
      case 'rejected':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading dancer dashboard...</p>
        </div>
      </div>
    );
  }

  if (!dancerSession) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 pb-safe-bottom">
      {/* Add mobile-specific bottom padding to prevent iPhone search bar from covering buttons */}
      <style jsx global>{`
        @supports(padding: max(0px)) {
          .pb-safe-bottom {
            padding-bottom: max(env(safe-area-inset-bottom, 0px), 100px);
          }
        }
        
        /* Fallback for older browsers */
        .pb-safe-bottom {
          padding-bottom: 100px;
        }
        
        /* Specific adjustments for iPhone sizes */
        @media screen and (max-width: 414px) and (min-height: 800px) {
          .pb-safe-bottom {
            padding-bottom: 140px;
          }
        }
      `}</style>

      {/* Header */}
      <div className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                {dancerSession.name}
              </h1>
              <p className="text-gray-300 text-sm">
                EODSA ID: {dancerSession.eodsaId} | Email: {dancerSession.email || 'Not provided'}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="px-4 py-2 border border-gray-600 text-gray-200 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Home
              </Link>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-4 space-y-6">
        {/* Scores & Feedback Section */}
        <ScoresFeedbackSection dancerSession={dancerSession} />

        {/* Competition Entries Section */}
        <CompetitionEntriesSection dancerSession={dancerSession} />

        {/* Studio Applications Section */}
        <div className="bg-gray-800/80 rounded-2xl border border-gray-700/20 overflow-hidden">
          <div className="p-6 border-b border-gray-700">
            <h3 className="text-xl font-bold text-white">Studio Applications</h3>
            <p className="text-gray-400 text-sm mt-1">Manage your studio membership applications</p>
          </div>

          {applications.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🏢</span>
              </div>
              <p className="text-gray-400 mb-2">No studio applications</p>
              <p className="text-gray-500 text-sm">
                You haven't applied to any studios yet, or your applications are still being processed.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {applications.map((app) => (
                <div key={app.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-semibold text-white">{app.studioName}</h4>
                      <p className="text-gray-400 text-sm">Contact: {app.contactPerson}</p>
                      <p className="text-gray-500 text-xs">Applied: {new Date(app.appliedAt).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block w-3 h-3 rounded-full ${getStatusBadge(app.status)} mr-2`}></span>
                      <span className="text-sm font-medium text-white capitalize">{app.status}</span>
                      {app.respondedAt && (
                        <p className="text-xs text-gray-500 mt-1">
                          Responded: {new Date(app.respondedAt).toLocaleDateString()}
                        </p>
                      )}
                      {app.rejectionReason && (
                        <p className="text-xs text-red-400 mt-1 max-w-xs">
                          {app.rejectionReason}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Music Upload Section */}
        <MusicUploadSection dancerSession={dancerSession} />

        {/* Video Upload Section */}
        <VideoUploadSection dancerSession={dancerSession} />

      </div>
    </div>
  );
}
