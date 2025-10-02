'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/simple-toast';
import RealtimeUpdates from '@/components/RealtimeUpdates';

interface Performance {
  id: string;
  title: string;
  contestantName: string;
  participantNames: string[];
  duration: number;
  itemNumber?: number;
  performanceOrder?: number;
  status: 'scheduled' | 'ready' | 'hold' | 'in_progress' | 'completed' | 'cancelled';
  entryType?: 'live' | 'virtual';
  announced?: boolean;
  announcedAt?: string;
  itemStyle?: string;
  ageCategory?: string;
  musicCue?: 'onstage' | 'offstage';
}

interface Event {
  id: string;
  name: string;
  eventDate: string;
  venue: string;
  status: string;
}

export default function MediaDashboard() {
  const router = useRouter();
  const { success } = useToast();
  const [user, setUser] = useState<any>(null);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [event, setEvent] = useState<Event | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [entryTypeFilter, setEntryTypeFilter] = useState<string>('all');
  const [lastSyncAt, setLastSyncAt] = useState<string>('');

  useEffect(() => {
    // Check authentication
    const session = localStorage.getItem('mediaSession');
    if (!session) {
      router.push('/portal/media');
      return;
    }

    try {
      const userData = JSON.parse(session);
      setUser(userData);
      fetchEvents();
    } catch (err) {
      router.push('/portal/media');
    }
  }, [router]);

  useEffect(() => {
    if (selectedEvent) {
      fetchEventData();
    }
  }, [selectedEvent]);

  // Join media room for real-time updates
  useEffect(() => {
    if (selectedEvent) {
      import('@/lib/socket-client').then(({ socketClient }) => {
        socketClient.joinAsMedia(selectedEvent);
        console.log(`📸 Joined media room for event: ${selectedEvent}`);
        setLastSyncAt(new Date().toLocaleTimeString());
      });
    }
  }, [selectedEvent]);

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/events');
      const data = await response.json();
      if (data.success) {
        setEvents(data.events || []);
        if (data.events && data.events.length > 0) {
          setSelectedEvent(data.events[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const fetchEventData = async () => {
    setIsLoading(true);
    try {
      // Load event details
      const eventRes = await fetch(`/api/events/${selectedEvent}`);
      const eventData = await eventRes.json();

      if (eventData.success) {
        setEvent(eventData.event);
      }

      // Load performances for this event
      const performancesRes = await fetch(`/api/events/${selectedEvent}/performances`);
      const performancesData = await performancesRes.json();

      if (performancesData.success) {
        // SYNC WITH BACKSTAGE: Sort by performanceOrder (backstage sequence), fallback to item number
        const sortedPerformances = performancesData.performances.sort((a: Performance, b: Performance) => {
          // Primary sort: performanceOrder (backstage sequence)
          if (a.performanceOrder && b.performanceOrder) {
            return a.performanceOrder - b.performanceOrder;
          }
          // Fallback to item number if performanceOrder missing
          if (a.itemNumber && b.itemNumber) {
            return a.itemNumber - b.itemNumber;
          } else if (a.itemNumber && !b.itemNumber) {
            return -1;
          } else if (!a.itemNumber && b.itemNumber) {
            return 1;
          }
          return a.title.localeCompare(b.title);
        });

        setPerformances(sortedPerformances);
      }
    } catch (error) {
      console.error('Error loading event data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePerformanceReorder = (reorderedPerformances: any[]) => {
    console.log('📸 Media: Received reorder from backstage', reorderedPerformances);

    // Merge both itemNumber (permanent) and performanceOrder (dynamic) from backstage
    setPerformances(prev => {
      const updateMap = new Map(reorderedPerformances.map((r: any) => [r.id, r]));
      const merged = prev.map(p => {
        if (updateMap.has(p.id)) {
          const update = updateMap.get(p.id)!;
          return {
            ...p,
            itemNumber: update.itemNumber || p.itemNumber, // Keep permanent item number
            performanceOrder: update.performanceOrder // Update performance order from backstage
          };
        }
        return p;
      });
      // Sort by performance order (backstage sequence) for live sync
      merged.sort((a, b) => {
        // Primary sort: performanceOrder (backstage sequence)
        if (a.performanceOrder && b.performanceOrder) return a.performanceOrder - b.performanceOrder;
        // Fallback to item number if performanceOrder missing
        if (a.itemNumber && b.itemNumber) return a.itemNumber - b.itemNumber;
        if (a.itemNumber && !b.itemNumber) return -1;
        if (!a.itemNumber && b.itemNumber) return 1;
        return a.title.localeCompare(b.title);
      });
      return merged;
    });
    setLastSyncAt(new Date().toLocaleTimeString());
    success('Synced with backstage order');
  };

  const handlePerformanceStatus = (data: any) => {
    console.log('📸 Media: Received status update from backstage', data);
    setPerformances(prev =>
      prev.map(p =>
        p.id === data.performanceId
          ? { ...p, status: data.status }
          : p
      )
    );
    setLastSyncAt(new Date().toLocaleTimeString());
  };

  const handlePerformanceAnnounced = (data: any) => {
    console.log('📸 Media: Performance announced', data);
    setPerformances(prev =>
      prev.map(p =>
        p.id === data.performanceId
          ? { ...p, announced: true, announcedAt: data.announcedAt }
          : p
      )
    );
    setLastSyncAt(new Date().toLocaleTimeString());
  };

  const filteredPerformances = performances.filter(perf => {
    const matchesEntryType = entryTypeFilter === 'all' || perf.entryType === entryTypeFilter;

    const matchesSearch = searchTerm === '' ||
      perf.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      perf.contestantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      perf.participantNames.some(name => name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (perf.itemNumber && perf.itemNumber.toString().includes(searchTerm));

    return matchesEntryType && matchesSearch;
  });

  const livePerformances = filteredPerformances.filter(p => p.entryType === 'live');
  const virtualPerformances = filteredPerformances.filter(p => p.entryType === 'virtual');

  if (isLoading && !event) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto"></div>
          <p className="mt-4 text-white">Loading media dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <RealtimeUpdates
      eventId={selectedEvent}
      role="media"
      strictEvent
      onPerformanceReorder={handlePerformanceReorder}
      onPerformanceStatus={handlePerformanceStatus}
      onPerformanceAnnounced={handlePerformanceAnnounced}
      onPerformanceMusicCue={(data) => {
        setPerformances(prev => prev.map(p => p.id === data.performanceId ? { ...p, musicCue: data.musicCue } : p));
      }}
    >
      <div className="min-h-screen bg-gray-900">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <span className="text-white text-xl">📸</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Media Dashboard</h1>
                  <p className="text-gray-300">Welcome, {user?.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Live Sync
                    </span>
                    {lastSyncAt && (
                      <span className="text-xs text-gray-400">
                        Last update: {lastSyncAt}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <select
                  value={selectedEvent}
                  onChange={(e) => setSelectedEvent(e.target.value)}
                  className="px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                >
                  {events.map(event => (
                    <option key={event.id} value={event.id}>{event.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => window.open('https://eodsa.vercel.app/admin/rankings', '_blank')}
                  className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium"
                >
                  View Rankings
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem('mediaSession');
                    router.push('/portal/media');
                  }}
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Event Info */}
          {event && (
            <div className="bg-gray-800 border border-gray-700 rounded-lg shadow p-6 mb-8">
              <h2 className="text-xl font-semibold text-white mb-2">{event.name}</h2>
              <p className="text-gray-300">Date: {event.eventDate} | Venue: {event.venue}</p>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-gray-800 border border-gray-700 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-900 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-blue-400">📋</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-300">Total Items</p>
                  <p className="text-2xl font-semibold text-white">{performances.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-green-900 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-green-400">🎵</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-300">Live Performances</p>
                  <p className="text-2xl font-semibold text-white">{livePerformances.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-purple-900 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-purple-400">📹</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-300">Virtual Performances</p>
                  <p className="text-2xl font-semibold text-white">{virtualPerformances.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-orange-900 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-orange-400">✓</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-300">Announced</p>
                  <p className="text-2xl font-semibold text-white">
                    {performances.filter(p => p.announced).length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg shadow p-6 mb-8">
            <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-4 md:space-y-0">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-300 mb-2">Search</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by item, performer, or studio..."
                  className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Entry Type</label>
                <select
                  value={entryTypeFilter}
                  onChange={(e) => setEntryTypeFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                >
                  <option value="all">All Types</option>
                  <option value="live">Live Performances</option>
                  <option value="virtual">Virtual Performances</option>
                </select>
              </div>
            </div>
          </div>

          {/* Performance List - SIMPLIFIED */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white flex items-center">
                <span className="mr-2">🎭</span>
                Performance Details ({filteredPerformances.length} items)
              </h2>
            </div>

            {filteredPerformances.length > 0 ? (
              <div className="divide-y divide-gray-700">
                {filteredPerformances.map((performance) => {
                  return (
                    <div key={performance.id} className="p-6 hover:bg-gray-750 transition-colors">
                      <div className="flex items-center space-x-4">
                        {/* Item Number Badge */}
                        <div className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center font-bold border-4 ${
                          performance.entryType === 'live'
                            ? 'bg-green-600 border-green-500 text-white'
                            : 'bg-purple-600 border-purple-500 text-white'
                        }`}>
                          <div className="text-base leading-none">#{performance.itemNumber || '?'}</div>
                          {performance.performanceOrder && (
                            <div className="text-[10px] opacity-75 leading-none mt-1">
                              Pos: {performance.performanceOrder}
                            </div>
                          )}
                        </div>

                        {/* Simplified Info - ONLY Required Fields */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xl font-bold text-white leading-tight">
                            {performance.title}
                          </h3>

                          {/* Item Name (title) - Already shown above */}

                          {/* Performer(s) */}
                          <p className="text-base text-gray-300 mt-1">
                            <strong>Performer(s):</strong> {performance.participantNames.join(', ')}
                          </p>

                          {/* Style */}
                          <p className="text-base text-gray-300">
                            <strong>Style:</strong> {performance.itemStyle || 'N/A'}
                          </p>

                          {/* Music On/Offstage */}
                          {performance.entryType === 'live' && performance.musicCue && (
                            <p className="text-base text-gray-300">
                              <strong>Music Cue:</strong> {performance.musicCue === 'onstage' ? 'On Stage' : 'Off Stage'}
                            </p>
                          )}

                          {/* Age Category */}
                          {performance.ageCategory && (
                            <p className="text-base text-gray-300">
                              <strong>Age Category:</strong> {performance.ageCategory}
                            </p>
                          )}
                        </div>

                        {/* Status Badges */}
                        <div className="flex flex-col items-end space-y-2">
                          <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                            performance.entryType === 'live'
                              ? 'bg-green-900 text-green-200 border border-green-700'
                              : 'bg-purple-900 text-purple-200 border border-purple-700'
                          }`}>
                            {performance.entryType?.toUpperCase()}
                          </span>

                          <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                            performance.status === 'in_progress' ? 'bg-orange-900 text-orange-200 border border-orange-700' :
                            performance.status === 'completed' ? 'bg-blue-900 text-blue-200 border border-blue-700' :
                            performance.status === 'cancelled' ? 'bg-red-900 text-red-200 border border-red-700' :
                            'bg-gray-700 text-gray-300 border border-gray-600'
                          }`}>
                            {performance.status.toUpperCase()}
                          </span>

                          {performance.announced && (
                            <span className="px-3 py-1 text-sm font-medium rounded-full bg-green-900 text-green-200 border border-green-700">
                              ANNOUNCED
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center">
                <span className="text-4xl mb-4 block">🎭</span>
                <p className="text-gray-300">No performances found for the selected filter</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </RealtimeUpdates>
  );
}
