'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MusicPlayer from '@/components/MusicPlayer';
import MusicUpload from '@/components/MusicUpload';
import { useToast } from '@/components/ui/simple-toast';
import { ThemeProvider, useTheme, getThemeClasses } from '@/components/providers/ThemeProvider';
import RealtimeUpdates from '@/components/RealtimeUpdates';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

interface EventEntry {
  id: string;
  eventId: string;
  contestantId: string;
  eodsaId: string;
  participantIds: string[];
  calculatedFee: number;
  paymentStatus: string;
  paymentMethod?: string;
  submittedAt: string;
  approved: boolean;
  qualifiedForNationals: boolean;
  itemName: string;
  choreographer: string;
  mastery: string;
  itemStyle: string;
  estimatedDuration: number;
  itemNumber?: number;
  contestantName?: string;
  contestantEmail?: string;
  participantNames?: string[];
  // Phase 2: Live/Virtual Entry Support
  entryType: 'live' | 'virtual';
  musicFileUrl?: string;
  musicFileName?: string;
  videoExternalUrl?: string;
  videoExternalType?: string;
  eventName?: string;
  // From performances mapping when single event selected
  musicCue?: 'onstage' | 'offstage';
}

interface Event {
  id: string;
  name: string;
  eventDate: string;
  venue: string;
  status: string;
}

function SoundTechPage() {
  const { theme } = useTheme();
  const themeClasses = getThemeClasses(theme);
  const router = useRouter();
  const { success, error } = useToast();
  const [entries, setEntries] = useState<EventEntry[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<string>('all');
  const [entryTypeFilter, setEntryTypeFilter] = useState<string>('live');
  const [searchTerm, setSearchTerm] = useState('');
  const [removingMusic, setRemovingMusic] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Check admin authentication
    const session = localStorage.getItem('adminSession');
    if (!session) {
      router.push('/portal/admin');
      return;
    }

    fetchData();
  }, [router]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [entriesRes, eventsRes] = await Promise.all([
        fetch('/api/event-entries'),
        fetch('/api/events')
      ]);

      const entriesData = await entriesRes.json();
      const eventsData = await eventsRes.json();

      if (entriesData.success) {
        console.log('📊 Sound Tech: Fetched entries:', entriesData.entries);
        console.log('📊 Live entries with music:', entriesData.entries?.filter((e: any) => e.entryType === 'live' && e.musicFileUrl));
        let baseEntries = entriesData.entries || [];
        // If a specific event is selected, map in the latest item numbers from performances
        if (selectedEvent && selectedEvent !== 'all') {
          try {
            const perfRes = await fetch(`/api/events/${selectedEvent}/performances`);
            const perfData = await perfRes.json();
            if (perfData.success) {
              const numMap = new Map<string, number>();
              const cueMap = new Map<string, 'onstage' | 'offstage'>();
              for (const p of perfData.performances) {
                if (p.eventEntryId && p.itemNumber) {
                  numMap.set(p.eventEntryId, p.itemNumber);
                }
                if (p.eventEntryId && p.musicCue) cueMap.set(p.eventEntryId, p.musicCue);
              }
              baseEntries = baseEntries.map((e: any) => (
                e.eventId === selectedEvent
                  ? { ...e, itemNumber: numMap.get(e.id) ?? e.itemNumber, musicCue: cueMap.get(e.id) }
                  : e
              ));
            }
          } catch {}
        }
        setEntries(baseEntries);
      }
      if (eventsData.success) {
        const ev = eventsData.events || [];
        setEvents(ev);
        // Default to first event for realtime join if currently "all"
        if ((selectedEvent === 'all' || !selectedEvent) && ev.length > 0) {
          setSelectedEvent(ev[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getEventName = (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    return event?.name || 'Unknown Event';
  };

  const getPerformanceType = (participantIds: string[]) => {
    const count = participantIds.length;
    if (count === 1) return 'Solo';
    if (count === 2) return 'Duet';
    if (count === 3) return 'Trio';
    if (count >= 4) return 'Group';
    return 'Unknown';
  };

  const filteredEntries = entries.filter(entry => {
    const matchesEvent = selectedEvent === 'all' || entry.eventId === selectedEvent;
    const matchesEntryType = entryTypeFilter === 'all' || entry.entryType === entryTypeFilter;
    const matchesSearch = searchTerm === '' || 
      entry.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.choreographer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.contestantName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.participantNames?.some(name => name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesEvent && matchesEntryType && matchesSearch;
  });
  // Sort consistently by program order then name
  const sortedFilteredEntries = [...filteredEntries].sort((a, b) => {
    if (a.itemNumber && b.itemNumber) return a.itemNumber - b.itemNumber;
    if (a.itemNumber && !b.itemNumber) return -1;
    if (!a.itemNumber && b.itemNumber) return 1;
    return a.itemName.localeCompare(b.itemName);
  });
  // Sound desk must see ALL live entries, even without music
  const liveEntries = sortedFilteredEntries.filter(entry => entry.entryType === 'live');
  const virtualEntries = sortedFilteredEntries.filter(entry => entry.entryType === 'virtual' && entry.videoExternalUrl);

  const downloadAllMusic = () => {
    liveEntries.forEach(entry => {
      if (entry.musicFileUrl) {
        const link = document.createElement('a');
        link.href = entry.musicFileUrl;
        link.download = entry.musicFileName || `${entry.itemName}.mp3`;
        link.click();
      }
    });
    success(`Started download of ${liveEntries.length} music files`);
  };

  const removeMusic = async (entryId: string, itemName: string) => {
    if (removingMusic.has(entryId)) return;
    
    if (!confirm(`Remove music from "${itemName}"?\n\nThis will make the entry available for re-upload in the contestant's dashboard.`)) {
      return;
    }
    
    setRemovingMusic(prev => new Set(prev).add(entryId));
    
    try {
      const session = localStorage.getItem('adminSession');
      if (!session) {
        error('Session expired. Please log in again.');
        return;
      }
      
      const adminData = JSON.parse(session);
      
      const response = await fetch(`/api/admin/entries/${entryId}/remove-music`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminId: adminData.id
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        success(result.message);
        
        // Refresh the data to show updated state
        await fetchData();
      } else {
        const errorResponse = await response.json();
        error(`Failed to remove music: ${errorResponse.error}`);
      }
    } catch (err) {
      console.error('Error removing music:', err);
      error('Failed to remove music. Please try again.');
    } finally {
      setRemovingMusic(prev => {
        const newSet = new Set(prev);
        newSet.delete(entryId);
        return newSet;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-black">Loading sound tech dashboard...</p>
        </div>
      </div>
    );
  }

  const handleRealtimeReorder = async () => {
    // Update item numbers from the latest performances without disrupting filters
    if (!selectedEvent || selectedEvent === 'all') {
      await fetchData();
      return;
    }
    try {
      const perfRes = await fetch(`/api/events/${selectedEvent}/performances`);
      const perfData = await perfRes.json();
      if (perfData.success) {
        const numMap = new Map<string, number>();
        const cueMap = new Map<string, 'onstage' | 'offstage'>();
        for (const p of perfData.performances) {
          if (p.eventEntryId && p.itemNumber) numMap.set(p.eventEntryId, p.itemNumber);
          if (p.eventEntryId && p.musicCue) cueMap.set(p.eventEntryId, p.musicCue);
        }
        setEntries(prev => prev.map((e: any) => (
          e.eventId === selectedEvent ? { ...e, itemNumber: numMap.get(e.id) ?? e.itemNumber, musicCue: cueMap.get(e.id) ?? e.musicCue } : e
        )));
      }
    } catch {
      await fetchData();
    }
  };

  return (
    <RealtimeUpdates
      eventId={selectedEvent !== 'all' ? selectedEvent : ''}
      onPerformanceReorder={handleRealtimeReorder}
      onPerformanceMusicCue={async (data) => {
        // Update in place for specific event; if in All, fetch the single performance to map
        if (selectedEvent && selectedEvent !== 'all') {
          setEntries(prev => prev.map((e: any) => (
            e.eventId === selectedEvent && e.id === data.performanceId ? e : e
          )));
          // We map by eventEntry; refresh mapping quickly
          await handleRealtimeReorder();
        } else {
          try {
            const perfRes = await fetch(`/api/performances/${data.performanceId}`);
            const perfData = await perfRes.json();
            if (perfData.success) {
              setEntries(prev => prev.map((e: any) => (
                e.id === perfData.performance.eventEntryId ? { ...e, musicCue: perfData.performance.musicCue } : e
              )));
            }
          } catch {}
        }
      }}
    >
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white shadow border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">🎵</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-black">Sound Tech Dashboard</h1>
                <p className="text-gray-600">Manage music files for live performances</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/admin')}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                ← Back to Admin
              </button>
              {liveEntries.length > 0 && (
                <button
                  onClick={downloadAllMusic}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
                >
                  <span>⬇️</span>
                  <span>Download All Music ({liveEntries.length})</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-green-600">🎵</span>
              </div>
              <div>
                <p className="text-sm font-medium text-black">Live Entries</p>
                <p className="text-2xl font-semibold text-black">{liveEntries.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-blue-600">📹</span>
              </div>
              <div>
                <p className="text-sm font-medium text-black">Virtual Entries</p>
                <p className="text-2xl font-semibold text-black">{virtualEntries.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-purple-600">🎭</span>
              </div>
              <div>
                <p className="text-sm font-medium text-black">Total Entries</p>
                <p className="text-2xl font-semibold text-black">{filteredEntries.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-orange-600">🏆</span>
              </div>
              <div>
                <p className="text-sm font-medium text-black">Events</p>
                <p className="text-2xl font-semibold text-black">{events.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-lg shadow p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-4 md:space-y-0">
            <div className="flex-1">
              <label className="block text-sm font-medium text-black mb-2">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by item name, choreographer, or participant..."
                className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-black placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-black mb-2">Event</label>
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-black focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">All Events</option>
                {events.map(event => (
                  <option key={event.id} value={event.id}>{event.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-black mb-2">Entry Type</label>
              <select
                value={entryTypeFilter}
                onChange={(e) => setEntryTypeFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-black focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">All Types</option>
                <option value="live">Live Performances</option>
                <option value="virtual">Virtual Performances</option>
              </select>
            </div>
          </div>
        </div>

        {/* Music Files List */}
        {entryTypeFilter === 'live' || entryTypeFilter === 'all' ? (
          <div className="bg-white border border-gray-200 rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-black flex items-center">
                <span className="mr-2">🎵</span>
                Live Performances - Music Files ({liveEntries.length})
              </h2>
            </div>
            
            {liveEntries.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {liveEntries.map((entry) => (
                  <div key={entry.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <span className="text-purple-600 font-semibold">
                              {entry.itemNumber || '#'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold text-black truncate">
                              {entry.itemName}
                            </h3>
                            <p className="text-sm text-black">
                              {getPerformanceType(entry.participantIds)} • Style: {entry.itemStyle}
                              {entry.musicCue && (
                                <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-800">
                                  {entry.musicCue === 'onstage' ? 'Music: Onstage' : 'Music: Offstage'}
                                </span>
                              )}
                            </p>
                            {/* Age category not stored on entry; omit to avoid type errors */}
                            <p className="text-xs text-gray-600">
                              Studio: {entry.contestantName || 'Unknown'} • {getEventName(entry.eventId)} • {entry.participantNames?.join(', ')}
                              {Array.isArray(entry.participantIds) && entry.participantIds.length > 1 ? ` (${entry.participantIds.length} contestants)` : ''}
                            </p>
                          </div>
                        </div>
                        
                        {entry.musicFileUrl && (
                          <div className="mt-4">
                            <MusicPlayer
                              musicUrl={entry.musicFileUrl}
                              filename={entry.musicFileName || `${entry.itemName}.mp3`}
                              className="max-w-2xl"
                              showDownload={true}
                            />
                          </div>
                        )}
                        {!entry.musicFileUrl && (
                          <div className="mt-4">
                            <div className="mb-2 p-3 border border-yellow-200 bg-yellow-50 text-yellow-800 rounded-md text-sm">
                              Upload outstanding — no track uploaded yet.
                            </div>
                            <MusicUpload
                              currentFile={null}
                              variant="light"
                              compact
                              onUploadSuccess={async (file) => {
                                // Persist music info to entry and refetch
                                try {
                                  await fetch(`/api/admin/entries/${entry.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      musicFileUrl: file.url,
                                      musicFileName: file.originalFilename
                                    })
                                  });
                                  success('Music uploaded and saved');
                                  await fetchData();
                                } catch (e) {
                                  error('Failed to save uploaded music');
                                }
                              }}
                              onUploadError={(err) => error(err)}
                            />
                          </div>
                        )}
                      </div>
                      
                      <div className="ml-4 flex flex-col items-end space-y-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          entry.approved 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {entry.approved ? 'Approved' : 'Pending'}
                        </span>

                        {/* Remove Music Button */}
                        <button
                          onClick={() => removeMusic(entry.id, entry.itemName)}
                          disabled={removingMusic.has(entry.id)}
                          className="px-3 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 hover:text-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Remove music file - contestant will be able to re-upload"
                        >
                          {removingMusic.has(entry.id) ? (
                            <span className="flex items-center space-x-1">
                              <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin"></div>
                              <span>Removing...</span>
                            </span>
                          ) : (
                            '🗑️ Remove Music'
                          )}
                        </button>
                        
                        <div className="text-right text-xs text-gray-600">
                          <div>Track: <span className={`${entry.musicFileUrl ? 'text-green-700' : 'text-red-700'}`}>{entry.musicFileUrl ? 'Uploaded' : 'Upload outstanding'}</span></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <span className="text-4xl mb-4 block">🎵</span>
                <p className="text-gray-700">No live performances with music files found</p>
              </div>
            )}
          </div>
        ) : null}

        {/* Virtual Entries List */}
        {entryTypeFilter === 'virtual' || entryTypeFilter === 'all' ? (
          <div className="bg-white border border-gray-200 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-black flex items-center">
                <span className="mr-2">📹</span>
                Virtual Performances - Video Links ({virtualEntries.length})
              </h2>
            </div>
            
            {virtualEntries.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {virtualEntries.map((entry) => (
                  <div key={entry.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <span className="text-blue-600 font-semibold">
                              {entry.itemNumber || '#'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold text-black truncate">
                              {entry.itemName}
                            </h3>
                            <p className="text-sm text-black">
                              by {entry.choreographer} • {getPerformanceType(entry.participantIds)}
                            </p>
                            <p className="text-xs text-gray-600">
                              {getEventName(entry.eventId)} • {entry.participantNames?.join(', ')}
                            </p>
                          </div>
                        </div>
                        
                        {entry.videoExternalUrl && (
                          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-blue-900">
                                  {entry.videoExternalType?.toUpperCase()} Video
                                </p>
                                <p className="text-xs text-blue-700 truncate max-w-md">
                                  {entry.videoExternalUrl}
                                </p>
                              </div>
                              <a
                                href={entry.videoExternalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                              >
                                Watch Video
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="ml-4 flex flex-col items-end space-y-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          entry.approved 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {entry.approved ? 'Approved' : 'Pending'}
                        </span>
                        
                        <div className="text-right text-xs text-gray-600">
                          <div>Mastery: {entry.mastery}</div>
                          <div>Style: {entry.itemStyle}</div>
                          {/* Duration hidden by request */}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <span className="text-4xl mb-4 block">📹</span>
                <p className="text-gray-700">No virtual performances found</p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
    </RealtimeUpdates>
  );
}

// Wrap with ThemeProvider
export default function SoundTechPageWrapper() {
  return (
    <ThemeProvider>
      <SoundTechPage />
    </ThemeProvider>
  );
}
