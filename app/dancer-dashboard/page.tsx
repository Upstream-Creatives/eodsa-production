'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MusicUpload from '@/components/MusicUpload';

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
                      <p className="text-gray-300">Duration: <span className="text-white font-medium">{entry.estimatedDuration} min</span></p>
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

      </div>
    </div>
  );
}
