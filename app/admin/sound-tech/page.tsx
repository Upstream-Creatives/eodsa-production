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
  performanceOrder?: number;
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
  // Local completion state - not broadcasted to other dashboards
  const [localCompletedItems, setLocalCompletedItems] = useState<Set<string>>(new Set());
  // Track currently playing item for mini player
  const [currentlyPlaying, setCurrentlyPlaying] = useState<{
    entryId: string;
    itemName: string;
    isPlaying: boolean;
  } | null>(null);

  useEffect(() => {
    // Check admin authentication
    const session = localStorage.getItem('adminSession');
    if (!session) {
      router.push('/portal/admin');
      return;
    }

    // Load local completion state from localStorage
    const savedCompletions = localStorage.getItem('soundDeskCompletions');
    if (savedCompletions) {
      try {
        const parsed = JSON.parse(savedCompletions);
        setLocalCompletedItems(new Set(parsed));
      } catch (e) {
        console.error('Failed to load completion state:', e);
      }
    }

    fetchData();
  }, [router]);

  // Save completion state to localStorage whenever it changes
  useEffect(() => {
    if (localCompletedItems.size > 0) {
      localStorage.setItem('soundDeskCompletions', JSON.stringify(Array.from(localCompletedItems)));
    }
  }, [localCompletedItems]);

  // Join sound room for real-time updates
  useEffect(() => {
    if (selectedEvent && selectedEvent !== 'all') {
      import('@/lib/socket-client').then(({ socketClient }) => {
        socketClient.joinAsSound(selectedEvent);
        console.log(`🎵 Joined sound room for event: ${selectedEvent}`);
      });
    }
  }, [selectedEvent]);

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
              const orderMap = new Map<string, number>();
              for (const p of perfData.performances) {
                if (p.eventEntryId && p.itemNumber) {
                  numMap.set(p.eventEntryId, p.itemNumber);
                }
                if (p.eventEntryId && p.musicCue) cueMap.set(p.eventEntryId, p.musicCue);
                if (p.eventEntryId && p.performanceOrder) orderMap.set(p.eventEntryId, p.performanceOrder);
              }
              baseEntries = baseEntries.map((e: any) => (
                e.eventId === selectedEvent
                  ? {
                      ...e,
                      itemNumber: numMap.get(e.id) ?? e.itemNumber,
                      musicCue: cueMap.get(e.id) ?? e.musicCue,
                      performanceOrder: orderMap.get(e.id) ?? e.performanceOrder
                    }
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
  // Sort consistently by performance order (from backstage), fallback to item number then name
  const sortedFilteredEntries = [...filteredEntries].sort((a, b) => {
    // Primary: Use performance order from backstage if available
    if (a.performanceOrder && b.performanceOrder) return a.performanceOrder - b.performanceOrder;
    // Fallback: Use item number if performance order not available  
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

  const toggleCompletion = (entryId: string) => {
    setLocalCompletedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
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
      <div className={`min-h-screen ${themeClasses.loadingBg} flex items-center justify-center`}>
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${theme === 'dark' ? 'border-indigo-500' : 'border-indigo-600'} mx-auto`}></div>
          <p className={`mt-4 ${themeClasses.loadingText}`}>Loading sound tech dashboard...</p>
        </div>
      </div>
    );
  }

  const handleRealtimeReorder = async () => {
    // Update item numbers and performance order from the latest performances without disrupting filters
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
        const orderMap = new Map<string, number>();
        for (const p of perfData.performances) {
          if (p.eventEntryId && p.itemNumber) numMap.set(p.eventEntryId, p.itemNumber);
          if (p.eventEntryId && p.musicCue) cueMap.set(p.eventEntryId, p.musicCue);
          if (p.eventEntryId && p.performanceOrder) orderMap.set(p.eventEntryId, p.performanceOrder);
        }
        setEntries(prev => {
          const updated = prev.map((e: any) => (
            e.eventId === selectedEvent 
              ? { 
                  ...e, 
                  itemNumber: numMap.get(e.id) ?? e.itemNumber, 
                  musicCue: cueMap.get(e.id) ?? e.musicCue,
                  performanceOrder: orderMap.get(e.id) ?? e.performanceOrder
                } 
              : e
          ));
          // Re-sort by performance order if available, fallback to item number
          return updated.sort((a, b) => {
            if (a.performanceOrder && b.performanceOrder) {
              return a.performanceOrder - b.performanceOrder;
            }
            if (a.itemNumber && b.itemNumber) {
              return a.itemNumber - b.itemNumber;
            }
            return a.itemName.localeCompare(b.itemName);
          });
        });
      }
    } catch {
      await fetchData();
    }
  };

  return (
    <RealtimeUpdates
      eventId={selectedEvent !== 'all' ? selectedEvent : ''}
      strictEvent
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
    <div className={`min-h-screen ${themeClasses.mainBg}`}>
      {/* Header */}
      <div className={`${themeClasses.headerBg} shadow border-b ${themeClasses.headerBorder}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className={`w-12 h-12 ${themeClasses.iconContainer} ${themeClasses.cardRadius} flex items-center justify-center`}>
                <span className="text-white text-xl">🎵</span>
              </div>
              <div>
                <h1 className={`${themeClasses.heading2}`}>Sound Tech Dashboard</h1>
                <p className={themeClasses.textSecondary}>Manage music files for live performances</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <button
                onClick={() => router.push('/admin')}
                className={`px-4 py-2 ${themeClasses.buttonBase} ${themeClasses.buttonSecondary}`}
              >
                ← Back to Admin
              </button>
              {liveEntries.length > 0 && (
                <button
                  onClick={downloadAllMusic}
                  className={`px-4 py-2 ${themeClasses.buttonBase} ${themeClasses.buttonPrimary} flex items-center space-x-2`}
                >
                  <span>⬇️</span>
                  <span>Download All Music ({liveEntries.length})</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mini Player - Fixed at top */}
      {currentlyPlaying && (
        <div className="bg-purple-600 border-b border-purple-700 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-xl">🎵</span>
                </div>
                <div>
                  <p className="text-sm text-purple-200">Now Playing</p>
                  <p className="text-lg font-semibold text-white">{currentlyPlaying.itemName}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  currentlyPlaying.isPlaying
                    ? 'bg-green-500 text-white animate-pulse'
                    : 'bg-gray-500 text-white'
                }`}>
                  {currentlyPlaying.isPlaying ? '▶️ Playing' : '⏸️ Paused'}
                </span>
                <button
                  onClick={() => setCurrentlyPlaying(null)}
                  className="px-3 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-sm"
                >
                  ✕ Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
        <div className={`${themeClasses.cardBg} border ${themeClasses.cardBorder} ${themeClasses.cardRadius} ${themeClasses.cardShadow} mb-8`}>
          <div className={`px-6 py-4 border-b ${themeClasses.cardBorder}`}>
            <h2 className={`${themeClasses.heading3} flex items-center`}>
                <span className="mr-2">🎵</span>
                Live Performances - Music Files ({liveEntries.length})
              </h2>
            </div>
            
            {liveEntries.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {liveEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`p-6 ${
                      localCompletedItems.has(entry.id)
                        ? 'bg-green-50 border-l-4 border-l-green-500'
                        : ''
                    }`}
                  >
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
                              <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                entry.musicCue === 'onstage'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {entry.musicCue === 'onstage' ? '🎭 On Stage' : '📴 Off Stage'}
                              </span>
                            </p>
                            {/* Nicely formatted contestant/dancer names */}
                            <div className="mb-2">
                              {entry.contestantName && entry.contestantName !== 'Unknown Contestant' ? (
                                <div>
                                  <p className="text-lg font-bold text-black mb-1">
                                    {entry.contestantName.includes(', ') ? (
                                      <span className="text-indigo-600">Group Performance</span>
                                    ) : (
                                      <span className="text-green-600">Solo Performance</span>
                                    )}
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {entry.contestantName.split(', ').map((name, index) => (
                                      <span 
                                        key={index}
                                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                                      >
                                        {name.trim()}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-lg font-bold text-red-500">
                                  Unknown Contestant
                                </p>
                              )}
                            </div>
                            {selectedEvent === 'all' && (
                              <p className="text-xs text-gray-600">
                                Event: {getEventName(entry.eventId)}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {entry.musicFileUrl && (
                          <div className="mt-4">
                            <MusicPlayer
                              musicUrl={entry.musicFileUrl}
                              filename={entry.musicFileName || entry.itemName}
                              className="max-w-2xl"
                              showDownload={true}
                              onPlayingChange={(isPlaying) => {
                                if (isPlaying) {
                                  setCurrentlyPlaying({
                                    entryId: entry.id,
                                    itemName: entry.itemName,
                                    isPlaying: true
                                  });
                                } else if (currentlyPlaying?.entryId === entry.id) {
                                  setCurrentlyPlaying({
                                    ...currentlyPlaying,
                                    isPlaying: false
                                  });
                                }
                              }}
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

                        {/* Completion Toggle - Local Only */}
                        <button
                          onClick={() => toggleCompletion(entry.id)}
                          className={`px-3 py-1 text-xs font-medium rounded-md border transition-colors ${
                            localCompletedItems.has(entry.id)
                              ? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
                              : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                          }`}
                          title="Mark as complete (local view only - doesn't affect other dashboards)"
                        >
                          {localCompletedItems.has(entry.id) ? '✅ Completed' : '◻️ Mark Complete'}
                        </button>

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

                        {/* Hide filename to avoid confusion */}
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
