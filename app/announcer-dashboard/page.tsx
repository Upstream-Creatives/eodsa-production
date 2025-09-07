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
  status: 'scheduled' | 'ready' | 'hold' | 'in_progress' | 'completed' | 'cancelled';
  entryType?: 'live' | 'virtual';
  announced?: boolean;
  announcedAt?: string;
  mastery?: string;
  itemStyle?: string;
  choreographer?: string;
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
      }
    } catch (error) {
      console.error('Error loading event data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsAnnounced = async (performanceId: string, title: string) => {
    try {
      const response = await fetch('/api/performances/announce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          performanceId,
          announcedBy: user.id
        })
      });

      if (response.ok) {
        // Update local state
        setPerformances(prev => 
          prev.map(p => 
            p.id === performanceId 
              ? { ...p, announced: true, announcedAt: new Date().toISOString() }
              : p
          )
        );

        success(`"${title}" marked as announced and removed from queue`);
      } else {
        error('Failed to mark performance as announced');
      }
    } catch (err) {
      console.error('Error marking performance as announced:', err);
      error('Failed to mark performance as announced');
    }
  };

  const handlePerformanceReorder = (reorderedPerformances: any) => {
    setPerformances(reorderedPerformances);
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

  const filteredPerformances = performances.filter(perf => {
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'scheduled' && !perf.announced && perf.status !== 'completed') ||
      (statusFilter === 'announced' && perf.announced) ||
      (statusFilter === 'completed' && perf.status === 'completed');
    
    const matchesSearch = searchTerm === '' || 
      perf.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      perf.contestantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      perf.participantNames.some(name => name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (perf.itemNumber && perf.itemNumber.toString().includes(searchTerm));
    
    return matchesStatus && matchesSearch;
  });

  const upcomingPerformances = filteredPerformances.filter(p => !p.announced && p.status !== 'completed');
  const currentPerformance = performances.find(p => p.status === 'in_progress');

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
                  onClick={() => markAsAnnounced(currentPerformance.id, currentPerformance.title)}
                  className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold transition-colors"
                >
                  ✅ Mark as Announced
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
                  <div key={performance.id} className={`p-6 ${performance.announced ? 'bg-gray-50' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg ${
                          performance.status === 'in_progress' ? 'bg-orange-500 text-white' :
                          performance.announced ? 'bg-gray-400 text-white' :
                          performance.status === 'completed' ? 'bg-green-500 text-white' :
                          'bg-blue-500 text-white'
                        }`}>
                          {performance.itemNumber || '?'}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className={`text-lg font-semibold ${performance.announced ? 'text-gray-600 line-through' : 'text-black'}`}>
                            {performance.title}
                          </h3>
                          <p className={`text-sm ${performance.announced ? 'text-gray-500' : 'text-black'}`}>
                            by {performance.choreographer} • {performance.mastery} • {performance.itemStyle}
                          </p>
                          <p className={`text-sm ${performance.announced ? 'text-gray-500' : 'text-black'}`}>
                            Performers: {performance.participantNames.join(', ')}
                          </p>
                          <p className={`text-xs ${performance.announced ? 'text-gray-400' : 'text-gray-600'}`}>
                            Duration: {performance.duration}min • {performance.entryType?.toUpperCase()}
                          </p>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            performance.status === 'in_progress' ? 'bg-orange-100 text-orange-800' :
                            performance.status === 'completed' ? 'bg-green-100 text-green-800' :
                            performance.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {performance.status.toUpperCase()}
                          </span>
                          
                          {performance.announced && (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                              ANNOUNCED
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {!performance.announced && performance.status === 'in_progress' && (
                        <button
                          onClick={() => markAsAnnounced(performance.id, performance.title)}
                          className="ml-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold transition-colors"
                        >
                          ✅ Mark as Announced
                        </button>
                      )}
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
        </div>
      </div>
    </RealtimeUpdates>
  );
}
