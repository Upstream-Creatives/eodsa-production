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
  mastery?: string;
  itemStyle?: string;
  choreographer?: string;
  contestantId?: string;
  eodsaId?: string;
  ageCategory?: string;
  musicFileUrl?: string;
  musicFileName?: string;
  presence?: {
    present: boolean;
    checkedInBy?: string;
    checkedInAt?: string;
  };
}

interface Event {
  id: string;
  name: string;
  eventDate: string;
  venue: string;
  status: string;
}

export default function RegistrationDashboard() {
  const router = useRouter();
  const { success, error } = useToast();
  const [user, setUser] = useState<any>(null);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [event, setEvent] = useState<Event | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [presenceFilter, setPresenceFilter] = useState<string>('all');
  const [checkingIn, setCheckingIn] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Check authentication
    const session = localStorage.getItem('registrationSession');
    if (!session) {
      router.push('/portal/registration');
      return;
    }

    try {
      const userData = JSON.parse(session);
      setUser(userData);
      fetchEvents();
    } catch (err) {
      router.push('/portal/registration');
    }
  }, [router]);

  useEffect(() => {
    if (selectedEvent) {
      fetchEventData();
    }
  }, [selectedEvent]);

  // Debounce search for smoother typing - prevent black screen issues
  useEffect(() => {
    const h = setTimeout(() => {
      try {
        setDebouncedSearch(searchTerm);
      } catch (error) {
        console.error('Search error:', error);
        setDebouncedSearch(''); // Reset on error
      }
    }, 300);
    return () => clearTimeout(h);
  }, [searchTerm]);

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
        // Sort by performance order (backstage sequence), fallback to item number
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
        
        // Fetch presence data for each performance
        const performancesWithPresence = await Promise.all(
          sortedPerformances.map(async (perf: Performance) => {
            try {
              const presenceRes = await fetch(`/api/presence?performanceId=${perf.id}`);
              const presenceData = await presenceRes.json();
              return {
                ...perf,
                presence: presenceData.success ? presenceData.presence : null
              };
            } catch (err) {
              return { ...perf, presence: null };
            }
          })
        );
        
        setPerformances(performancesWithPresence);
      }
    } catch (error) {
      console.error('Error loading event data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePresence = async (performanceId: string, currentlyPresent: boolean, title: string) => {
    if (checkingIn.has(performanceId)) return;
    
    setCheckingIn(prev => new Set(prev).add(performanceId));
    
    try {
      const response = await fetch('/api/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          performanceId,
          eventId: selectedEvent,
          present: !currentlyPresent,
          checkedInBy: user.id
        })
      });

      if (response.ok) {
        // Update local state
        setPerformances(prev => 
          prev.map(p => 
            p.id === performanceId 
              ? { 
                  ...p, 
                  presence: { 
                    present: !currentlyPresent, 
                    checkedInBy: user.id, 
                    checkedInAt: new Date().toISOString() 
                  } 
                }
              : p
          )
        );

        // Broadcast presence update for realtime dashboards
        try {
          const { socketClient } = await import('@/lib/socket-client');
          socketClient.emit('presence:update' as any, {
            performanceId,
            eventId: selectedEvent,
            present: !currentlyPresent,
            checkedInBy: user.id,
            checkedInAt: new Date().toISOString()
          } as any);
        } catch {}

        const action = !currentlyPresent ? 'checked in' : 'marked absent';
        success(`"${title}" ${action} successfully`);
      } else {
        error('Failed to update presence status');
      }
    } catch (err) {
      console.error('Error updating presence:', err);
      error('Failed to update presence status');
    } finally {
      setCheckingIn(prev => {
        const newSet = new Set(prev);
        newSet.delete(performanceId);
        return newSet;
      });
    }
  };

  const handlePerformanceReorder = (reorderedPerformances: any) => {
    setPerformances(prev => {
      const reorderedWithPresence = reorderedPerformances.map((reordered: any) => {
        const existing = prev.find(p => p.id === reordered.id);
        return existing ? { 
          ...existing, 
          itemNumber: reordered.itemNumber || existing.itemNumber, // Keep permanent item number
          performanceOrder: reordered.performanceOrder // Update performance order
        } : reordered;
      });
      return reorderedWithPresence;
    });
    success('Performance order updated by backstage');
  };

  const handlePerformanceStatus = (data: any) => {
    setPerformances(prev => 
      prev.map(p => 
        p.id === data.performanceId 
          ? { ...p, status: data.status }
          : p
      )
    );
  };

  // Show all live entries (solos, duets, trios, groups) - hide only virtual entries
  const filteredPerformances = performances.filter(perf => {
    const isLive = (perf.entryType || 'live') === 'live';
    const matchesPresence = presenceFilter === 'all' || 
      (presenceFilter === 'present' && perf.presence?.present) ||
      (presenceFilter === 'absent' && !perf.presence?.present);
    
    const q = (debouncedSearch || '').toLowerCase();
    const matchesSearch = !debouncedSearch || debouncedSearch === '' || (() => {
      try {
        return (
          (perf.title || '').toLowerCase().includes(q) ||
          (perf.contestantName || '').toLowerCase().includes(q) ||
          (Array.isArray(perf.participantNames) && perf.participantNames.some(name => (name || '').toLowerCase().includes(q))) ||
          (perf.itemNumber && perf.itemNumber.toString().includes(debouncedSearch)) ||
          (perf.eodsaId && perf.eodsaId.toLowerCase().includes(q))
        );
      } catch (error) {
        console.error('Search matching error:', error);
        return true; // Show item if search fails
      }
    })();
    
    // Debug: All live entries should be included regardless of participant count
    return isLive && matchesPresence && matchesSearch;
  });

  const presentCount = performances.filter(p => p.presence?.present).length;
  const absentCount = performances.filter(p => !p.presence?.present).length;

  if (isLoading && !event) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-white">Loading registration dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <RealtimeUpdates
      eventId={selectedEvent}
      strictEvent
      onPerformanceReorder={handlePerformanceReorder}
      onPerformanceStatus={handlePerformanceStatus}
      onMusicUpdated={(data) => {
        setPerformances(prev => prev.map(p => (
          (p as any).eventEntryId === data.entryId ? { ...p, musicFileUrl: data.musicFileUrl, musicFileName: data.musicFileName } : p
        )));
      }}
    >
      <div className="min-h-screen bg-gray-900">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-600 rounded-xl flex items-center justify-center">
                  <span className="text-white text-xl">✅</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Registration Dashboard</h1>
                  <p className="text-gray-300">Welcome, {user?.name}</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <select
                  value={selectedEvent}
                  onChange={(e) => setSelectedEvent(e.target.value)}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-white"
                >
                  {events.map(event => (
                    <option key={event.id} value={event.id}>{event.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const rows = [['Item #','Item Name','Contestant','Participants','Present','CheckedInBy','CheckedInAt']];
                    for (const p of performances) {
                      rows.push([
                        String(p.itemNumber || ''),
                        p.title || '',
                        p.contestantName || '',
                        Array.isArray(p.participantNames) ? p.participantNames.join('; ') : '',
                        p.presence?.present ? 'Yes' : 'No',
                        p.presence?.checkedInBy || '',
                        p.presence?.checkedInAt ? new Date(p.presence.checkedInAt).toLocaleString() : ''
                      ]);
                    }
                    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = 'presence.csv'; a.click(); URL.revokeObjectURL(url);
                  }}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Export Presence CSV
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem('registrationSession');
                    router.push('/portal/registration');
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
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
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-white">📋</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-400">Total Performers</p>
                  <p className="text-2xl font-semibold text-white">{performances.length}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-800 border border-gray-700 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-white">✅</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-400">Present</p>
                  <p className="text-2xl font-semibold text-white">{presentCount}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-800 border border-gray-700 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-white">❌</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-400">Absent</p>
                  <p className="text-2xl font-semibold text-white">{absentCount}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-800 border border-gray-700 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-white">📊</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-400">Attendance Rate</p>
                  <p className="text-2xl font-semibold text-white">
                    {performances.length > 0 ? Math.round((presentCount / performances.length) * 100) : 0}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg shadow p-6 mb-8">
            <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-4 md:space-y-0">
              <div className="flex-1">
                <label className="block text-sm font-medium text-white mb-2">Search</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, item number, or EODSA ID..."
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-white placeholder-gray-400"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white mb-2">Presence Status</label>
                <select
                  value={presenceFilter}
                  onChange={(e) => setPresenceFilter(e.target.value)}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-white"
                >
                  <option value="all">All Performers</option>
                  <option value="present">Present Only</option>
                  <option value="absent">Absent Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Performer List */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white flex items-center">
                <span className="mr-2">👥</span>
                Performers ({filteredPerformances.length} total)
              </h2>
            </div>
            
            {filteredPerformances.length > 0 ? (
              <div className="divide-y divide-gray-700">
                {filteredPerformances.map((performance) => (
                  <div key={performance.id} className={`p-6 ${performance.presence?.present ? 'bg-green-900/20' : 'bg-gray-800'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg ${
                          performance.presence?.present ? 'bg-green-500 text-white' :
                          'bg-gray-600 text-white'
                        }`}>
                          {performance.itemNumber || '?'}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-white">
                            {performance.title}
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                            <div>
                              <p className="text-sm text-gray-300">
                                <strong className="text-white">Entry Name:</strong> {performance.title}
                              </p>
                              <p className="text-sm text-gray-300">
                                <strong className="text-white">Choreographer:</strong> {performance.choreographer}
                              </p>
                              <p className="text-sm text-gray-300">
                                <strong className="text-white">Style:</strong> {performance.itemStyle} • <strong className="text-white">Level:</strong> {performance.mastery}
                              </p>
                              {performance.ageCategory && (
                                <p className="text-sm text-gray-300">
                                  <strong className="text-white">Age Category:</strong> {performance.ageCategory}
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-sm text-gray-300">
                                <strong className="text-white">Studio Name:</strong> {performance.contestantName}
                              </p>
                              <p className="text-sm text-gray-300">
                                <strong className="text-white">Contestant(s):</strong> {performance.participantNames.join(', ')}
                              </p>
                              {performance.eodsaId && (
                                <p className="text-xs text-gray-400">
                                  <strong className="text-gray-300">EODSA ID:</strong> {performance.eodsaId}
                                </p>
                              )}
                              {/* Music Status for Live Performances */}
                              {performance.entryType === 'live' && (
                                <p className="text-xs">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    performance.musicFileUrl ? 'bg-green-600 text-white' : 'bg-yellow-600 text-white'
                                  }`}>
                                    {performance.musicFileUrl ? 'Music uploaded' : 'Music missing'}
                                  </span>
                                </p>
                              )}
                            </div>
                          </div>
                          {performance.presence?.checkedInAt && (
                            <p className="text-xs text-green-400 mt-2">
                              Last updated: {new Date(performance.presence.checkedInAt).toLocaleString()}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            performance.status === 'in_progress' ? 'bg-orange-600 text-white' :
                            performance.status === 'completed' ? 'bg-blue-600 text-white' :
                            performance.status === 'cancelled' ? 'bg-red-600 text-white' :
                            'bg-gray-600 text-white'
                          }`}>
                            {performance.status.toUpperCase()}
                          </span>
                          
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            performance.presence?.present 
                              ? 'bg-green-600 text-white' 
                              : 'bg-red-600 text-white'
                          }`}>
                            {performance.presence?.present ? 'PRESENT' : 'ABSENT'}
                          </span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => togglePresence(
                          performance.id, 
                          performance.presence?.present || false, 
                          performance.title
                        )}
                        disabled={checkingIn.has(performance.id)}
                        className={`ml-4 px-4 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          performance.presence?.present
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                      >
                        {checkingIn.has(performance.id) ? (
                          <div className="flex items-center">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            Updating...
                          </div>
                        ) : (
                          <>
                            {performance.presence?.present ? '❌ Mark Absent' : '✅ Check In'}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <span className="text-4xl mb-4 block">👥</span>
                <p className="text-gray-400">No performers found for the selected filter</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </RealtimeUpdates>
  );
}
