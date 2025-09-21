'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/simple-toast';
import RealtimeUpdates from '@/components/RealtimeUpdates';
import { useEffect as ReactUseEffect } from 'react';

interface Performance {
  id: string;
  title: string;
  contestantName: string;
  participantNames: string[];
  duration: number;
  itemNumber?: number;
  status: 'scheduled' | 'ready' | 'hold' | 'in_progress' | 'completed' | 'cancelled';
  entryType?: 'live' | 'virtual';
  announced?: boolean;
  announcedAt?: string;
  mastery?: string;
  itemStyle?: string;
  choreographer?: string;
  ageCategory?: string;
  musicFileUrl?: string;
  musicFileName?: string;
  announcerNotes?: string | null;
  performedBy?: string;
  performedAt?: string;
}

interface Event {
  id: string;
  name: string;
  eventDate: string;
  venue: string;
  status: string;
}

export default function AnnouncerDashboard() {
  const router = useRouter();
  const { success, error } = useToast();
  const [user, setUser] = useState<any>(null);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [event, setEvent] = useState<Event | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('scheduled');
  const [presenceByPerformance, setPresenceByPerformance] = useState<Record<string, any>>({});
  const [notesByPerformance, setNotesByPerformance] = useState<Record<string, string>>({});
  const [activePrompt, setActivePrompt] = useState<Performance | null>(null);

  useEffect(() => {
    // Check authentication
    const session = localStorage.getItem('announcerSession');
    if (!session) {
      router.push('/portal/announcer');
      return;
    }

    try {
      const userData = JSON.parse(session);
      setUser(userData);
      fetchEvents();
    } catch (err) {
      router.push('/portal/announcer');
    }
  }, [router]);

  useEffect(() => {
    if (selectedEvent) {
      fetchEventData();
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
        // Sort by item number, then by creation time
        const sortedPerformances = performancesData.performances.sort((a: Performance, b: Performance) => {
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
        // Initialize notes map from server-persisted announcer notes so they appear after refresh
        const initialNotes: Record<string, string> = {};
        for (const p of sortedPerformances as any[]) {
          if (p.announcerNotes) initialNotes[p.id] = p.announcerNotes;
        }
        setNotesByPerformance(initialNotes);

        // Load presence for each performance (registration check-in)
        try {
          const presenceEntries: Record<string, any> = {};
          await Promise.all(sortedPerformances.map(async (p: any) => {
            const res = await fetch(`/api/presence?performanceId=${p.id}`);
            const data = await res.json();
            if (data.success) presenceEntries[p.id] = data.presence;
          }));
          setPresenceByPerformance(presenceEntries);
        } catch {}
      }
    } catch (error) {
      console.error('Error loading event data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveAnnouncementNote = async (performanceId: string, note: string) => {
    setNotesByPerformance(prev => ({ ...prev, [performanceId]: note }));
    try {
      const res = await fetch('/api/performances/announce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ performanceId, announcedBy: user?.id || 'announcer', note })
      });
      if (res.ok) {
        // Reflect saved note locally if the performance list carries it
        setPerformances(prev => prev.map(p => p.id === performanceId ? { ...p, announcerNotes: note, announced: true, announcedAt: new Date().toISOString() } as any : p));
        success('Announcement note saved');
      } else {
        const msg = await res.json().catch(() => ({} as any));
        error(msg?.error || 'Failed to save note');
      }
    } catch {}
  };

  const markAsPerformed = async (performanceId: string, title: string) => {
    try {
      const response = await fetch('/api/performances/announce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          performanceId,
          announcedBy: user.id,
          status: 'completed'
        })
      });

      if (response.ok) {
        // Persist status on the server as completed
        try {
          await fetch(`/api/performances/${performanceId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'completed' })
          });
        } catch {}

        // Update local state - mark as both announced and completed
        setPerformances(prev => 
          prev.map(p => 
            p.id === performanceId 
              ? { 
                  ...p, 
                  announced: true, 
                  announcedAt: new Date().toISOString(),
                  status: 'completed',
                  performedBy: user.name,
                  performedAt: new Date().toISOString()
                }
              : p
          )
        );

        // Broadcast status change to keep dashboards in sync
        try {
          const { socketClient } = await import('@/lib/socket-client');
          socketClient.emit('performance:status' as any, {
            performanceId,
            eventId: selectedEvent,
            status: 'completed',
            timestamp: new Date().toISOString()
          } as any);
        } catch {}

        success(`"${title}" marked as performed - stays green`);
      } else {
        error('Failed to mark performance as performed');
      }
    } catch (err) {
      console.error('Error marking performance as performed:', err);
      error('Failed to mark performance as performed');
    }
  };

  const handlePerformanceReorder = (reorderedPerformances: any[]) => {
    // Merge new itemNumbers into existing objects; don't replace objects (prevents undefined fields)
    setPerformances(prev => {
      const idToItemNumber = new Map(reorderedPerformances.map((r: any) => [r.id, r.itemNumber]));
      const merged = prev.map(p => idToItemNumber.has(p.id) ? { ...p, itemNumber: idToItemNumber.get(p.id)! } : p);
      // Keep list sorted by itemNumber, then title
      merged.sort((a, b) => {
        if (a.itemNumber && b.itemNumber) return a.itemNumber - b.itemNumber;
        if (a.itemNumber && !b.itemNumber) return -1;
        if (!a.itemNumber && b.itemNumber) return 1;
        return a.title.localeCompare(b.title);
      });
      return merged;
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
    // Auto-open announcer prompt when an item becomes READY
    if (data.status === 'ready') {
      const perf = performances.find(p => p.id === data.performanceId);
      if (perf) setActivePrompt(perf);
    }
  };

  // Always hide virtual entries for announcer
  const filteredPerformances = performances.filter(perf => {
    const isLive = (perf.entryType || 'live') === 'live';
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'scheduled' && !perf.announced && perf.status !== 'completed') ||
      (statusFilter === 'announced' && perf.announced) ||
      (statusFilter === 'completed' && perf.status === 'completed');
    
    const matchesSearch = searchTerm === '' || 
      perf.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      perf.contestantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      perf.participantNames.some(name => name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (perf.itemNumber && perf.itemNumber.toString().includes(searchTerm));
    
    return isLive && matchesStatus && matchesSearch;
  });

  const upcomingPerformances = filteredPerformances.filter(p => !p.announced && p.status !== 'completed');
  const currentPerformance = performances.find(p => p.status === 'in_progress');

  // When we receive initial data, auto-prompt the first READY item
  useEffect(() => {
    if (activePrompt) return;
    const firstReady = performances.find(p => p.status === 'ready');
    if (firstReady) setActivePrompt(firstReady);
  }, [performances, activePrompt]);

  const announceNow = async (perf: Performance) => {
    try {
      const res = await fetch(`/api/performances/${perf.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' })
      });
      if (res.ok) {
        setPerformances(prev => prev.map(p => p.id === perf.id ? { ...p, status: 'in_progress' } : p));
        try {
          const { socketClient } = await import('@/lib/socket-client');
          socketClient.emit('performance:status' as any, {
            performanceId: perf.id,
            eventId: selectedEvent,
            status: 'in_progress',
            timestamp: new Date().toISOString()
          } as any);
        } catch {}
        setActivePrompt(null);
        success('Announcing now');
      } else {
        const msg = await res.json().catch(() => ({} as any));
        error(msg?.error || 'Failed to set item in progress');
      }
    } catch (e) {
      error('Network error starting announcement');
    }
  };

  if (isLoading && !event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-black">Loading announcer dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <RealtimeUpdates
      eventId={selectedEvent}
      onPerformanceReorder={handlePerformanceReorder}
      onPerformanceStatus={handlePerformanceStatus}
      onPresenceUpdate={(data) => {
        setPresenceByPerformance(prev => ({ ...prev, [data.performanceId]: { present: data.present, checkedInAt: data.checkedInAt, checkedInBy: data.checkedInBy } }));
      }}
    >
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
                  <span className="text-white text-xl">📢</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-black">Announcer Dashboard</h1>
                  <p className="text-black">Welcome, {user?.name}</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <select
                  value={selectedEvent}
                  onChange={(e) => setSelectedEvent(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-black"
                >
                  {events.map(event => (
                    <option key={event.id} value={event.id}>{event.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    localStorage.removeItem('announcerSession');
                    router.push('/portal/announcer');
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
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
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-xl font-semibold text-black mb-2">{event.name}</h2>
              <p className="text-black">Date: {event.eventDate} | Venue: {event.venue}</p>
            </div>
          )}

          {/* Current Performance */}
          {currentPerformance && (
            <div className="bg-orange-100 border border-orange-400 rounded-lg p-6 mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-orange-800 flex items-center">
                    <span className="mr-2">🎯</span>
                    NOW PERFORMING
                  </h3>
                  <p className="text-lg font-medium text-orange-700">
                    #{currentPerformance.itemNumber} - {currentPerformance.title}
                  </p>
                  <p className="text-orange-600">
                    by {currentPerformance.choreographer} | {currentPerformance.participantNames.join(', ')}
                  </p>
                </div>
                <button
                  onClick={() => markAsPerformed(currentPerformance.id, currentPerformance.title)}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-colors"
                >
                  ✅ Mark as Performed
                </button>
              </div>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-blue-600">📝</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-black">Total Items</p>
                  <p className="text-2xl font-semibold text-black">{performances.length}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-green-600">✅</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-black">Announced</p>
                  <p className="text-2xl font-semibold text-black">
                    {performances.filter(p => p.announced).length}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-orange-600">⏳</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-black">Remaining</p>
                  <p className="text-2xl font-semibold text-black">{upcomingPerformances.length}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-purple-600">🎭</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-black">In Progress</p>
                  <p className="text-2xl font-semibold text-black">
                    {performances.filter(p => p.status === 'in_progress').length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-4 md:space-y-0">
              <div className="flex-1">
                <label className="block text-sm font-medium text-black mb-2">Search</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by item name, number, or participant..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-black"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-black mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-black"
                >
                  <option value="scheduled">Upcoming Items</option>
                  <option value="announced">Announced Items</option>
                  <option value="completed">Completed Items</option>
                  <option value="all">All Items</option>
                </select>
              </div>
            </div>
          </div>

          {/* Performance List */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-black flex items-center">
                <span className="mr-2">📋</span>
                Program ({filteredPerformances.length} items)
              </h2>
            </div>
            
            {filteredPerformances.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {filteredPerformances.map((performance) => (
                  <div key={performance.id} className={`p-6 ${performance.status === 'completed' ? 'bg-green-50' : performance.announced ? 'bg-gray-50' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg ${
                          performance.status === 'completed' ? 'bg-green-500 text-white' :
                          performance.status === 'in_progress' ? 'bg-orange-500 text-white' :
                          performance.announced ? 'bg-gray-400 text-white' :
                          'bg-blue-500 text-white'
                        }`}>
                          {performance.itemNumber || '?'}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className={`text-lg font-semibold ${performance.status === 'completed' ? 'text-green-800' : performance.announced ? 'text-gray-600' : 'text-black'}`}>
                            {performance.title}
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                            <div>
                              {performance.choreographer && (
                                <p className={`text-sm ${performance.status === 'completed' ? 'text-green-700' : performance.announced ? 'text-gray-500' : 'text-black'}`}>
                                  <strong>Choreographer:</strong> {performance.choreographer}
                                </p>
                              )}
                              <p className={`text-sm ${performance.status === 'completed' ? 'text-green-700' : performance.announced ? 'text-gray-500' : 'text-black'}`}>
                                <strong>Style:</strong> {performance.itemStyle} • <strong>Level:</strong> {performance.mastery}
                              </p>
                              {performance.ageCategory && (
                                <p className={`text-sm ${performance.status === 'completed' ? 'text-green-700' : performance.announced ? 'text-gray-500' : 'text-black'}`}>
                                  <strong>Age Category:</strong> {performance.ageCategory}
                                </p>
                              )}
                            </div>
                            <div>
                              {Array.isArray(performance.participantNames) && (
                                <>
                                  <p className={`text-sm ${performance.status === 'completed' ? 'text-green-700' : performance.announced ? 'text-gray-500' : 'text-black'}`}>
                                    <strong>Performer(s):</strong> {performance.participantNames.length === 1 ? performance.participantNames[0] : `${performance.participantNames.length} performers`}
                                  </p>
                                  {performance.participantNames.length > 1 && (
                                    <p className={`text-xs ${performance.status === 'completed' ? 'text-green-600' : performance.announced ? 'text-gray-400' : 'text-gray-600'}`}>
                                      {performance.participantNames.join(', ')}
                                    </p>
                                  )}
                                </>
                              )}
                              <p className={`text-xs ${performance.status === 'completed' ? 'text-green-600' : performance.announced ? 'text-gray-400' : 'text-gray-600'}`}>
                                {performance.entryType?.toUpperCase()}
                                <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  performance.musicFileUrl ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {performance.musicFileUrl ? 'Track uploaded' : 'Track missing'}
                                </span>
                                {presenceByPerformance[performance.id]?.present !== undefined && (
                                  <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    presenceByPerformance[performance.id]?.present ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                  }`}>
                                    {presenceByPerformance[performance.id]?.present ? 'Checked-in' : 'Not checked-in'}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          {performance.performedAt && (
                            <p className="text-xs text-green-600 mt-2">
                              ✅ Performed at {new Date(performance.performedAt).toLocaleTimeString()} by {performance.performedBy}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            performance.status === 'completed' ? 'bg-green-100 text-green-800' :
                            performance.status === 'in_progress' ? 'bg-orange-100 text-orange-800' :
                            performance.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {performance.status === 'completed' ? 'PERFORMED' : performance.status.toUpperCase()}
                          </span>
                          
                          {performance.announced && performance.status !== 'completed' && (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                              ANNOUNCED
                            </span>
                          )}

                          {presenceByPerformance[performance.id]?.present !== undefined && (
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              presenceByPerformance[performance.id]?.present
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {presenceByPerformance[performance.id]?.present ? 'CHECKED-IN' : 'NOT CHECKED-IN'}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {!performance.announced && performance.status === 'in_progress' && (
                        <button
                          onClick={() => markAsPerformed(performance.id, performance.title)}
                          className="ml-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-colors"
                        >
                          ✅ Mark as Performed
                        </button>
                      )}
                    </div>
                    {/* Announcement Notes */}
                    <div className="mt-3">
                      <textarea
                        value={
                          (notesByPerformance[performance.id] !== undefined
                            ? notesByPerformance[performance.id]
                            : (performance.announcerNotes || ''))
                        }
                        onChange={(e) => setNotesByPerformance(prev => ({ ...prev, [performance.id]: e.target.value }))}
                        placeholder="Announcement notes…"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black"
                        rows={2}
                      />
                      <div className="mt-2 flex justify-end">
                        <button
                          onClick={() => saveAnnouncementNote(performance.id, notesByPerformance[performance.id] || '')}
                          className="px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                        >
                          Save Note
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <span className="text-4xl mb-4 block">📢</span>
                <p className="text-black">No performances found for the selected filter</p>
              </div>
            )}
          </div>
          {/* Full-screen Announcer Prompt */}
          {activePrompt && (
            <div className="fixed inset-0 z-50 bg-white">
              <div className="max-w-6xl mx-auto px-8 py-10">
                <div className="flex items-start justify-between mb-10">
                  <div className="flex items-center space-x-6">
                    <div className="w-24 h-24 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-5xl font-extrabold">
                      {activePrompt.itemNumber || '?'}
                    </div>
                    <div>
                      <div className="text-2xl text-gray-600">Now Announcing</div>
                      <h2 className="text-6xl font-extrabold text-black leading-tight">{activePrompt.title}</h2>
                    </div>
                  </div>
                  <button
                    onClick={() => setActivePrompt(null)}
                    className="px-5 py-3 rounded-xl border border-gray-300 text-2xl text-gray-700 hover:bg-gray-100"
                  >
                    Close
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-12">
                  <div className="md:col-span-2">
                    <p className="text-3xl text-gray-900">
                      Performed by <span className="font-semibold">{activePrompt.participantNames.join(', ')}</span>
                    </p>
                    <p className="text-2xl text-gray-800 mt-2">
                      Choreographer: <span className="font-semibold">{activePrompt.choreographer}</span> • Style: <span className="font-semibold">{activePrompt.itemStyle}</span> • Level: <span className="font-semibold">{activePrompt.mastery}</span>
                    </p>
                    {/* Duration hidden by request */}
                    {presenceByPerformance[activePrompt.id]?.present !== undefined && (
                      <div className={`inline-block mt-5 px-5 py-2 text-xl font-bold rounded-full ${
                        presenceByPerformance[activePrompt.id]?.present ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {presenceByPerformance[activePrompt.id]?.present ? 'CHECKED-IN' : 'NOT CHECKED-IN'}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-2xl font-semibold text-black mb-3">Announcement notes</label>
                    <textarea
                      value={
                        (notesByPerformance[activePrompt.id] !== undefined
                          ? notesByPerformance[activePrompt.id]
                          : (activePrompt.announcerNotes || ''))
                      }
                      onChange={(e) => setNotesByPerformance(prev => ({ ...prev, [activePrompt!.id]: e.target.value }))}
                      placeholder="Script or notes the announcer reads…"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-2xl text-black"
                      rows={8}
                    />
                    <div className="flex justify-end mt-4 space-x-3">
                      <button
                        onClick={() => saveAnnouncementNote(activePrompt.id, notesByPerformance[activePrompt.id] || '')}
                        className="px-5 py-3 bg-gray-100 text-2xl text-gray-700 rounded-xl hover:bg-gray-200"
                      >
                        Save Note
                      </button>
                      <button
                        onClick={() => announceNow(activePrompt)}
                        className="px-6 py-3 bg-orange-600 text-white text-2xl rounded-xl hover:bg-orange-700 font-extrabold"
                      >
                        Announce Now
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-10">
                  <div className="text-xl text-gray-500 mb-4">Next up</div>
                  <div className="flex items-center space-x-4">
                    {performances.filter(p => !activePrompt || p.id !== activePrompt.id).filter(p => p.status !== 'completed').slice(0, 3).map(p => (
                      <div key={p.id} className="px-4 py-3 border border-gray-200 rounded-xl bg-white shadow-sm text-xl text-gray-800">
                        <span className="font-bold">#{p.itemNumber || '?'}</span> {p.title}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </RealtimeUpdates>
  );
}
