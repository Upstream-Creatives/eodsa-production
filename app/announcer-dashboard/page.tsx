'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/simple-toast';
import RealtimeUpdates from '@/components/RealtimeUpdates';
import { useEffect as ReactUseEffect } from 'react';
// import InlineMusicControls from '@/components/InlineMusicControls';

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
  mastery?: string;
  itemStyle?: string;
  ageCategory?: string;
  musicFileUrl?: string;
  musicFileName?: string;
  announcerNotes?: string | null;
  musicCue?: 'onstage' | 'offstage';
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
  const [performanceTypeFilter, setPerformanceTypeFilter] = useState<string>('all');
  const [presenceFilter, setPresenceFilter] = useState<string>('all');
  const [styleFilter, setStyleFilter] = useState<string>('all');
  const [ageCategoryFilter, setAgeCategoryFilter] = useState<string>('all');
  const [presenceByPerformance, setPresenceByPerformance] = useState<Record<string, any>>({});
  const [notesByPerformance, setNotesByPerformance] = useState<Record<string, string>>({});
  const [activePrompt, setActivePrompt] = useState<Performance | null>(null);
  const [generalNotes, setGeneralNotes] = useState<string>('');
  const [lastSyncAt, setLastSyncAt] = useState<string>('');
  const saveGeneralNotes = () => {
    if (!selectedEvent) return;
    try {
      localStorage.setItem(`announcer:generalNotes:${selectedEvent}`, generalNotes || '');
      success('Notes saved');
    } catch (e) {
      error('Failed to save notes');
    }
  };

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

  // Load/save announcer general notes locally per event (announcer-only)
  useEffect(() => {
    if (!selectedEvent) return;
    const key = `announcer:generalNotes:${selectedEvent}`;
    try {
      const saved = localStorage.getItem(key);
      setGeneralNotes(saved || '');
    } catch {}
  }, [selectedEvent]);

  useEffect(() => {
    if (!selectedEvent) return;
    const key = `announcer:generalNotes:${selectedEvent}`;
    const handle = setTimeout(() => {
      try { localStorage.setItem(key, generalNotes || ''); } catch {}
    }, 2000);
    return () => clearTimeout(handle);
  }, [generalNotes, selectedEvent]);

  // Update last sync time on focus/heartbeat
  useEffect(() => {
    const onFocus = () => setLastSyncAt(new Date().toLocaleTimeString());
    const hb = setInterval(() => setLastSyncAt(new Date().toLocaleTimeString()), 15000);
    if (typeof window !== 'undefined') window.addEventListener('focus', onFocus);
    return () => { clearInterval(hb); if (typeof window !== 'undefined') window.removeEventListener('focus', onFocus); };
  }, []);

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

  // Per-item performed toggle
  const togglePerformed = async (perf: Performance) => {
    const newStatus = perf.status === 'completed' ? 'scheduled' : 'completed';
    try {
      const res = await fetch(`/api/performances/${perf.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setPerformances(prev => prev.map(p => p.id === perf.id ? { ...p, status: newStatus } : p));
        try {
          const { socketClient } = await import('@/lib/socket-client');
          socketClient.emit('performance:status' as any, {
            performanceId: perf.id,
            eventId: selectedEvent,
            status: newStatus,
            timestamp: new Date().toISOString()
          } as any);
        } catch {}
      }
    } catch {}
  };

  const handlePerformanceReorder = (reorderedPerformances: any[]) => {
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
    success('Performance order updated by backstage (showing by item number for judging)');
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
    
    // Performance type filter (based on participant count)
    const participantCount = perf.participantNames.length;
    const performanceType = participantCount === 1 ? 'Solo' : 
                           participantCount === 2 ? 'Duet' : 
                           participantCount === 3 ? 'Trio' : 'Group';
    const matchesPerformanceType = performanceTypeFilter === 'all' || performanceType === performanceTypeFilter;
    
    // Presence filter
    const presence = presenceByPerformance[perf.id];
    const matchesPresence = presenceFilter === 'all' || 
      (presenceFilter === 'present' && presence?.present) ||
      (presenceFilter === 'absent' && !presence?.present);
    
    // Style filter
    const matchesStyle = styleFilter === 'all' || 
      (perf.itemStyle && perf.itemStyle.toLowerCase().includes(styleFilter.toLowerCase()));
    
    // Age category filter
    const matchesAgeCategory = ageCategoryFilter === 'all' || 
      (perf.ageCategory && perf.ageCategory === ageCategoryFilter);
    
    return isLive && matchesStatus && matchesSearch && matchesPerformanceType && matchesPresence && matchesStyle && matchesAgeCategory;
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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-white">Loading announcer dashboard...</p>
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
      onPerformanceMusicCue={(data) => {
        setPerformances(prev => prev.map(p => p.id === data.performanceId ? { ...p, musicCue: data.musicCue } : p));
      }}
      onPresenceUpdate={(data) => {
        setPresenceByPerformance(prev => ({ ...prev, [data.performanceId]: { present: data.present, checkedInAt: data.checkedInAt, checkedInBy: data.checkedInBy } }));
      }}
      onMusicUpdated={(data) => {
        setPerformances(prev => prev.map(p => (
          (p as any).eventEntryId === data.entryId ? { ...p, musicFileUrl: data.musicFileUrl, musicFileName: data.musicFileName } : p
        )));
      }}
    >
      <div className="min-h-screen bg-gray-900 text-white">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
                  <span className="text-white text-xl">📢</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Announcer Dashboard</h1>
                  <p className="text-gray-300">Welcome, {user?.name}</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <select
                  value={selectedEvent}
                  onChange={(e) => setSelectedEvent(e.target.value)}
                  className="px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  {events.map(event => (
                    <option key={event.id} value={event.id}>{event.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const rows = [['Item #','Item Name','Contestant','Participants','Style','Level','Age Category','Status','Announced','Music Cue','Entry Type','Music File','Presence']];
                    for (const p of filteredPerformances) {
                      const presence = presenceByPerformance[p.id];
                      rows.push([
                        String(p.itemNumber || ''),
                        p.title || '',
                        p.contestantName || '',
                        Array.isArray(p.participantNames) ? p.participantNames.join('; ') : '',
                        p.itemStyle || '',
                        p.mastery || '',
                        p.ageCategory || '',
                        p.status || '',
                        p.announced ? 'Yes' : 'No',
                        p.musicCue || '',
                        p.entryType || 'live',
                        p.musicFileName || (p.musicFileUrl ? 'Yes' : 'No'),
                        presence?.present ? 'Present' : 'Not Present'
                      ]);
                    }
                    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = `announcer-program-${event?.name || 'event'}.csv`; a.click(); URL.revokeObjectURL(url);
                  }}
                  className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  Export CSV
                </button>
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
          {/* Announcer General Notes */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg shadow p-4 sm:p-6 mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl sm:text-2xl font-bold text-white">Announcer Notes</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">Autosaves</span>
                <button
                  onClick={saveGeneralNotes}
                  className="px-3 py-1.5 bg-orange-600 text-white rounded-md text-xs font-semibold hover:bg-orange-700"
                >
                  Save Notes
                </button>
              </div>
            </div>
            <textarea
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              onBlur={() => {
                try { localStorage.setItem(`announcer:generalNotes:${selectedEvent}`, generalNotes || ''); } catch {}
              }}
              className="w-full min-h-[120px] sm:min-h-[160px] px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg"
              placeholder="Script, announcements, reminders…"
            />
          </div>
          {/* Event Info */}
          {event && (
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-xl font-semibold text-black mb-2">{event.name}</h2>
            <p className="text-black">Date: {event.eventDate} | Venue: {event.venue}</p>
            <p className="text-xs text-gray-500 mt-1">Live updating… Last sync {lastSyncAt || '—'}</p>
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
                    {currentPerformance.participantNames.join(', ')}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-2">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-black"
                >
                  <option value="scheduled">Upcoming Items</option>
                  <option value="announced">Announced Items</option>
                  <option value="completed">Completed Items</option>
                  <option value="all">All Items</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-2">Type</label>
                <select
                  value={performanceTypeFilter}
                  onChange={(e) => setPerformanceTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-black"
                >
                  <option value="all">All Types</option>
                  <option value="Solo">Solo</option>
                  <option value="Duet">Duet</option>
                  <option value="Trio">Trio</option>
                  <option value="Group">Group</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-2">Age Category</label>
                <select
                  value={ageCategoryFilter}
                  onChange={(e) => setAgeCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-black"
                >
                  <option value="all">All Ages</option>
                  {/* Get unique age categories from performances */}
                  {Array.from(new Set(performances.map(p => p.ageCategory).filter(Boolean))).sort().map(ageCategory => (
                    <option key={ageCategory} value={ageCategory}>{ageCategory}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Secondary filter row for additional filters */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-black mb-2">Style Filter</label>
                  <select
                    value={styleFilter}
                    onChange={(e) => setStyleFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-black"
                  >
                    <option value="all">All Styles</option>
                    {/* Get unique styles from performances */}
                    {Array.from(new Set(performances.map(p => p.itemStyle).filter(Boolean))).sort().map(style => (
                      <option key={style} value={style}>{style}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-black mb-2">Presence Status</label>
                  <select
                    value={presenceFilter}
                    onChange={(e) => setPresenceFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-black"
                  >
                    <option value="all">All Performers</option>
                    <option value="present">Present</option>
                    <option value="absent">Not Checked In</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('scheduled');
                      setPerformanceTypeFilter('all');
                      setPresenceFilter('all');
                      setStyleFilter('all');
                      setAgeCategoryFilter('all');
                    }}
                    className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Clear All Filters
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Performance List */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-black flex items-center">
                  <span className="mr-2">📋</span>
                  Program ({filteredPerformances.length} of {performances.length} items)
                </h2>
                
                {/* Active filters indicator */}
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  {statusFilter !== 'scheduled' && (
                    <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-md">
                      Status: {statusFilter}
                    </span>
                  )}
                  {performanceTypeFilter !== 'all' && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md">
                      Type: {performanceTypeFilter}
                    </span>
                  )}
                  {presenceFilter !== 'all' && (
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-md">
                      Presence: {presenceFilter}
                    </span>
                  )}
                  {styleFilter !== 'all' && (
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-md">
                      Style: {styleFilter}
                    </span>
                  )}
                  {ageCategoryFilter !== 'all' && (
                    <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-md">
                      Age: {ageCategoryFilter}
                    </span>
                  )}
                  {searchTerm && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-md">
                      Search: "{searchTerm}"
                    </span>
                  )}
                </div>
              </div>
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
                          <h3 className={`text-3xl font-extrabold ${performance.status === 'completed' ? 'text-green-800' : performance.announced ? 'text-gray-600' : 'text-purple-900'}`}>
                            {performance.title}
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                            <div>
                              <p className={`text-xl font-semibold ${performance.status === 'completed' ? 'text-green-700' : performance.announced ? 'text-gray-500' : 'text-black'}`}>
                                <strong>Style:</strong> {performance.itemStyle} • <strong>Level:</strong> {performance.mastery}
                              </p>
                              {performance.musicCue && (
                                <p className={`text-base ${performance.status === 'completed' ? 'text-green-700' : performance.announced ? 'text-gray-500' : 'text-black'}`}>
                                  <strong>Music cue:</strong> {performance.musicCue === 'onstage' ? 'Onstage (start when in position)' : 'Offstage (start while walking on)'}
                                </p>
                              )}
                              {performance.ageCategory && (
                                <p className={`text-base ${performance.status === 'completed' ? 'text-green-700' : performance.announced ? 'text-gray-500' : 'text-black'}`}>
                                  <strong>Age Category:</strong> {performance.ageCategory}
                                </p>
                              )}
                            </div>
                            <div>
                              {Array.isArray(performance.participantNames) && (
                                <>
                                  <p className={`text-xl font-semibold ${performance.status === 'completed' ? 'text-green-700' : performance.announced ? 'text-gray-500' : 'text-black'}`}>
                                    <strong>Performer(s):</strong> {performance.participantNames.length === 1 ? performance.participantNames[0] : `${performance.participantNames.length} performers`}
                                  </p>
                                  {performance.participantNames.length > 1 && (
                                    <p className={`text-sm ${performance.status === 'completed' ? 'text-green-600' : performance.announced ? 'text-gray-400' : 'text-gray-600'}`}>
                                      {performance.participantNames.join(', ')}
                                    </p>
                                  )}
                                </>
                              )}
                              
                              {/* Music Controls - temporarily disabled */}
                              
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

                          {/* Toggle Performed */}
                          <button
                            onClick={() => togglePerformed(performance)}
                            className={`${performance.status === 'completed' ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-200 hover:bg-gray-300'} text-white px-3 py-1 rounded-md text-xs font-semibold`}
                            title={performance.status === 'completed' ? 'Mark as not performed' : 'Mark as performed'}
                          >
                            {performance.status === 'completed' ? 'Performed ✓' : 'Mark Performed'}
                          </button>

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
                    {/* Per-item announcer notes removed per client request */}
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
                      <h2 className="text-6xl font-extrabold text-indigo-900 leading-tight">{activePrompt.title}</h2>
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
                      Performers: <span className="font-semibold">{activePrompt.participantNames.join(', ')}</span>
                    </p>
                    <p className="text-2xl text-gray-800 mt-2">
                      Style: <span className="font-semibold">{activePrompt.itemStyle}</span> • Level: <span className="font-semibold">{activePrompt.mastery}</span>
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
                  <div className="hidden md:block" />
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
