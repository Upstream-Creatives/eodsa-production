'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Event {
  id: string;
  name: string;
  eventDate: string;
  venue: string;
  status: string;
  performanceType: string;
  region: string;
  registrationDeadline: string;
  eventEndDate: string;
}

interface EventStats {
  totalEntries: number;
  liveEntries: number;
  virtualEntries: number;
  completedPerformances: number;
}

export default function BackstageEventSelector() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [eventStats, setEventStats] = useState<Record<string, EventStats>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);

  useEffect(() => {
    // Check admin authentication
    const session = localStorage.getItem('adminSession');
    if (!session) {
      router.push('/portal/admin');
      return;
    }

    loadEvents();
  }, [router]);

  const loadEvents = async () => {
    setIsLoading(true);
    try {
      // Load all events
      const eventsRes = await fetch('/api/events');
      const eventsData = await eventsRes.json();

      if (eventsData.success) {
        const allEvents = eventsData.events || [];
        setEvents(allEvents);

        // Load stats for each event
        const statsPromises = allEvents.map(async (event: Event) => {
          try {
            const entriesRes = await fetch(`/api/events/${event.id}/entries`);
            const entriesData = await entriesRes.json();
            
            if (entriesData.success) {
              const entries = entriesData.entries || [];
              const liveEntries = entries.filter((e: any) => e.entryType === 'live').length;
              const virtualEntries = entries.filter((e: any) => e.entryType === 'virtual').length;
              
              // Get performance stats
              const performancesRes = await fetch(`/api/events/${event.id}/performances`);
              const performancesData = await performancesRes.json();
              const completedPerformances = performancesData.success 
                ? (performancesData.performances || []).filter((p: any) => p.status === 'completed').length 
                : 0;

              return {
                eventId: event.id,
                stats: {
                  totalEntries: entries.length,
                  liveEntries,
                  virtualEntries,
                  completedPerformances
                }
              };
            }
          } catch (error) {
            console.error(`Error loading stats for event ${event.id}:`, error);
          }
          
          return {
            eventId: event.id,
            stats: {
              totalEntries: 0,
              liveEntries: 0,
              virtualEntries: 0,
              completedPerformances: 0
            }
          };
        });

        const statsResults = await Promise.all(statsPromises);
        const statsMap: Record<string, EventStats> = {};
        
        statsResults.forEach(result => {
          if (result) {
            statsMap[result.eventId] = result.stats;
          }
        });

        setEventStats(statsMap);
      }
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getEventStatusColor = (event: Event) => {
    const now = new Date();
    const eventDate = new Date(event.eventDate);
    const endDate = new Date(event.eventEndDate || event.eventDate);
    
    if (now < eventDate) {
      return 'bg-blue-600'; // Upcoming
    } else if (now >= eventDate && now <= endDate) {
      return 'bg-green-600'; // Live/Active
    } else {
      return 'bg-gray-600'; // Completed
    }
  };

  const getEventStatusText = (event: Event) => {
    const now = new Date();
    const eventDate = new Date(event.eventDate);
    const endDate = new Date(event.eventEndDate || event.eventDate);
    
    if (now < eventDate) {
      return 'Upcoming';
    } else if (now >= eventDate && now <= endDate) {
      return 'Live';
    } else {
      return 'Completed';
    }
  };

  const handleEventClick = (eventId: string) => {
    router.push(`/admin/backstage/${eventId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading events...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-purple-400">🎭 Backstage Control Center</h1>
            <p className="text-gray-300 mt-1">
              Select an event to manage live performances and program order
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <Link
              href="/admin"
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold transition-colors"
            >
              ← Back to Admin
            </Link>
          </div>
        </div>
      </div>

      {/* Events Grid */}
      <div className="p-6">
        {events.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-xl mb-4">No events found</div>
            <p className="text-gray-500">Create events in the admin dashboard to manage them here.</p>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Select Event to Manage</h2>
              <div className="text-gray-400">
                {events.length} event{events.length !== 1 ? 's' : ''} available
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => {
                const stats = eventStats[event.id] || {
                  totalEntries: 0,
                  liveEntries: 0,
                  virtualEntries: 0,
                  completedPerformances: 0
                };

                return (
                  <div
                    key={event.id}
                    onClick={() => handleEventClick(event.id)}
                    className={`
                      p-6 rounded-lg border-2 cursor-pointer transition-all duration-300 transform hover:scale-105
                      ${selectedEvent === event.id 
                        ? 'border-purple-400 bg-purple-600/20' 
                        : 'border-gray-600 bg-gray-700/50 hover:border-purple-400 hover:bg-purple-600/10'
                      }
                    `}
                    onMouseEnter={() => setSelectedEvent(event.id)}
                    onMouseLeave={() => setSelectedEvent(null)}
                  >
                    {/* Event Status Badge */}
                    <div className="flex justify-between items-start mb-4">
                      <div className={`px-3 py-1 rounded-full text-sm font-semibold ${getEventStatusColor(event)}`}>
                        {getEventStatusText(event)}
                      </div>
                      <div className="text-gray-400 text-sm">
                        {event.performanceType}
                      </div>
                    </div>

                    {/* Event Info */}
                    <h3 className="text-xl font-bold mb-2 text-white">{event.name}</h3>
                    <div className="space-y-2 text-sm text-gray-300 mb-4">
                      <div className="flex items-center">
                        <span className="w-16">📅 Date:</span>
                        <span>{new Date(event.eventDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="w-16">📍 Venue:</span>
                        <span className="truncate">{event.venue}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="w-16">🌍 Region:</span>
                        <span>{event.region}</span>
                      </div>
                    </div>

                    {/* Performance Stats */}
                    <div className="border-t border-gray-600 pt-4">
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-blue-400">{stats.totalEntries}</div>
                          <div className="text-xs text-gray-400">Total Entries</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-400">{stats.completedPerformances}</div>
                          <div className="text-xs text-gray-400">Completed</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-center mt-3">
                        <div>
                          <div className="text-lg font-semibold text-purple-400">{stats.liveEntries}</div>
                          <div className="text-xs text-gray-400">🎵 Live</div>
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-yellow-400">{stats.virtualEntries}</div>
                          <div className="text-xs text-gray-400">📹 Virtual</div>
                        </div>
                      </div>
                    </div>

                    {/* Action Indicator */}
                    <div className="mt-4 text-center">
                      <div className={`
                        inline-flex items-center px-4 py-2 rounded-lg font-semibold transition-all
                        ${selectedEvent === event.id 
                          ? 'bg-purple-600 text-white' 
                          : 'bg-gray-600 text-gray-200 group-hover:bg-purple-600 group-hover:text-white'
                        }
                      `}>
                        🎭 Open Backstage Control
                        <span className="ml-2">→</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Quick Stats Summary */}
        {events.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-800 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-400">{events.length}</div>
              <div className="text-gray-400">Total Events</div>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-400">
                {events.filter(e => getEventStatusText(e) === 'Live').length}
              </div>
              <div className="text-gray-400">Live Events</div>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-purple-400">
                {Object.values(eventStats).reduce((sum, stats) => sum + stats.totalEntries, 0)}
              </div>
              <div className="text-gray-400">Total Entries</div>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-yellow-400">
                {Object.values(eventStats).reduce((sum, stats) => sum + stats.completedPerformances, 0)}
              </div>
              <div className="text-gray-400">Completed</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
