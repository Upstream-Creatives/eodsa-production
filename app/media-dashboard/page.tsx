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
  mastery?: string;
  itemStyle?: string;
  ageCategory?: string;
  choreographer?: string;
  contestantId?: string;
  eodsaId?: string;
  contestantEmail?: string;
  contestantPhone?: string;
  musicFileUrl?: string;
  musicFileName?: string;
  videoExternalUrl?: string;
  videoExternalType?: string;
  studioInfo?: {
    name: string;
    address: string;
    contactPerson: string;
    email: string;
    phone: string;
    registrationNumber: string;
  };
}

interface Event {
  id: string;
  name: string;
  eventDate: string;
  venue: string;
  status: string;
}

interface Contestant {
  id: string;
  name: string;
  email: string;
  phone: string;
  eodsaId: string;
  type: 'studio' | 'private';
  dancers: Array<{
    id: string;
    name: string;
    age: number;
    eodsaId: string;
  }>;
}

export default function MediaDashboard() {
  const router = useRouter();
  const { success, error } = useToast();
  const [user, setUser] = useState<any>(null);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [event, setEvent] = useState<Event | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [entryTypeFilter, setEntryTypeFilter] = useState<string>('all');
  const [selectedPerformance, setSelectedPerformance] = useState<Performance | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedDancer, setSelectedDancer] = useState<any>(null);
  const [selectedStudio, setSelectedStudio] = useState<any>(null);
  const [showDancerModal, setShowDancerModal] = useState(false);
  const [showStudioModal, setShowStudioModal] = useState(false);
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
      });
    }
  }, [selectedEvent]);

  // Handle keyboard shortcuts for modal closing
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showDetails) {
          setShowDetails(false);
        } else if (showDancerModal) {
          setShowDancerModal(false);
        } else if (showStudioModal) {
          setShowStudioModal(false);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showDetails, showDancerModal, showStudioModal]);

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
        // Virtual program: sort by virtualItemNumber if entryType is virtual and virtualItemNumber exists
        const sortedPerformances = performancesData.performances.sort((a: any, b: any) => {
          const aIsVirtual = a.entryType === 'virtual';
          const bIsVirtual = b.entryType === 'virtual';
          const aNum = aIsVirtual && a.virtualItemNumber ? a.virtualItemNumber : a.itemNumber;
          const bNum = bIsVirtual && b.virtualItemNumber ? b.virtualItemNumber : b.itemNumber;
          if (aNum && bNum) return aNum - bNum;
          if (aNum && !bNum) return -1;
          if (!aNum && bNum) return 1;
          return a.title.localeCompare(b.title);
        });
        
        setPerformances(sortedPerformances);
      }

      // Load contestants for additional details
      const contestantsRes = await fetch('/api/contestants');
      const contestantsData = await contestantsRes.json();
      
      if (contestantsData.success) {
        setContestants(contestantsData.contestants || []);
      }
    } catch (error) {
      console.error('Error loading event data:', error);
    } finally {
      setIsLoading(false);
    }
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
    setLastSyncAt(new Date().toLocaleTimeString());
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
    setLastSyncAt(new Date().toLocaleTimeString());
  };

  const handlePerformanceAnnounced = (data: any) => {
    setPerformances(prev => 
      prev.map(p => 
        p.id === data.performanceId 
          ? { ...p, announced: true, announcedAt: data.announcedAt }
          : p
      )
    );
    setLastSyncAt(new Date().toLocaleTimeString());
  };

  // Ensure realtime reorder and status updates are wired via RealtimeUpdates wrapper
  // (already present above in JSX)

  const getContestantDetails = (contestantId: string) => {
    return contestants.find(c => c.id === contestantId);
  };

  const openPerformanceDetails = (performance: Performance) => {
    setSelectedPerformance(performance);
    setShowDetails(true);
  };

  const openDancerDetails = async (dancerId: string, dancerName: string) => {
    try {
      const response = await fetch(`/api/dancers/${dancerId}`);
      const data = await response.json();
      if (data.success) {
        setSelectedDancer(data.dancer);
        setShowDancerModal(true);
      }
    } catch (err) {
      console.error('Error fetching dancer details:', err);
      error(`Could not load details for ${dancerName}`);
    }
  };

  const openStudioDetails = async (studioId: string, studioName: string) => {
    try {
      const response = await fetch(`/api/studios/${studioId}`);
      const data = await response.json();
      if (data.success) {
        setSelectedStudio(data.studio);
        setShowStudioModal(true);
      }
    } catch (err) {
      console.error('Error fetching studio details:', err);
      error(`Could not load details for ${studioName}`);
    }
  };

  const filteredPerformances = performances.filter(perf => {
    const matchesEntryType = entryTypeFilter === 'all' || perf.entryType === entryTypeFilter;
    
    const matchesSearch = searchTerm === '' || 
      perf.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      perf.contestantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      perf.participantNames.some(name => name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (perf.itemNumber && perf.itemNumber.toString().includes(searchTerm)) ||
      (perf.eodsaId && perf.eodsaId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (perf.choreographer && perf.choreographer.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesEntryType && matchesSearch;
  });

  const livePerformances = filteredPerformances.filter(p => p.entryType === 'live');
  const virtualPerformances = filteredPerformances.filter(p => p.entryType === 'virtual');

  if (isLoading && !event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto"></div>
          <p className="mt-4 text-black">Loading media dashboard...</p>
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
      onMusicUpdated={(data) => {
        setPerformances(prev => prev.map(p => (
          (p as any).eventEntryId === data.entryId ? { ...p, musicFileUrl: data.musicFileUrl, musicFileName: data.musicFileName } : p
        )));
      }}
      onVideoUpdated={(data) => {
        setPerformances(prev => prev.map(p => (
          (p as any).eventEntryId === data.entryId ? { ...p, videoExternalUrl: data.videoExternalUrl } : p
        )));
      }}
    >
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <span className="text-white text-xl">📸</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-black">Media Dashboard</h1>
                  <p className="text-black">Welcome, {user?.name}</p>
                  {lastSyncAt && (
                    <p className="text-xs text-green-600">
                      🔄 Last sync: {lastSyncAt}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <select
                  value={selectedEvent}
                  onChange={(e) => setSelectedEvent(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-black"
                >
                  {events.map(event => (
                    <option key={event.id} value={event.id}>{event.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => window.open('https://eodsa.vercel.app/admin/rankings', '_blank')}
                  className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium"
                >
                  🏆 View Rankings
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem('mediaSession');
                    router.push('/portal/media');
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

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-blue-600">📋</span>
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
                  <span className="text-green-600">🎵</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-black">Live Performances</p>
                  <p className="text-2xl font-semibold text-black">{livePerformances.length}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-purple-600">📹</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-black">Virtual Performances</p>
                  <p className="text-2xl font-semibold text-black">{virtualPerformances.length}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-orange-600">👥</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-black">Contestants</p>
                  <p className="text-2xl font-semibold text-black">{contestants.length}</p>
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
                  placeholder="Search by item, performer, choreographer, or EODSA ID..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-black"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-black mb-2">Entry Type</label>
                <select
                  value={entryTypeFilter}
                  onChange={(e) => setEntryTypeFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-black"
                >
                  <option value="all">All Types</option>
                  <option value="live">Live Performances</option>
                  <option value="virtual">Virtual Performances</option>
                </select>
              </div>
            </div>
          </div>

          {/* Performance List */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-black flex items-center">
                <span className="mr-2">🎭</span>
                Performance Details ({filteredPerformances.length} items)
              </h2>
            </div>
            
            {filteredPerformances.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {filteredPerformances.map((performance) => {
                  const contestant = getContestantDetails(performance.contestantId || '');
                  return (
                    <div key={performance.id} className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-4 flex-1">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg ${
                            performance.entryType === 'live' ? 'bg-green-500 text-white' : 'bg-purple-500 text-white'
                          }`}>
                            {performance.itemNumber || '?'}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold text-black">
                              {performance.title}
                            </h3>
                            <p className="text-sm text-black">
                              <strong>Choreographer:</strong> {performance.choreographer} • 
                              <strong> Style:</strong> {performance.itemStyle} • 
                              <strong> Level:</strong> {performance.mastery}
                            </p>
                            <p className="text-sm text-black">
                              <strong>Performers:</strong> 
                              {performance.participantNames.map((name, index) => {
                                const contestant = getContestantDetails(performance.contestantId || '');
                                const dancer = contestant?.dancers.find(d => d.name === name);
                                return (
                                  <span key={index}>
                                    {index > 0 && ', '}
                                    {dancer ? (
                                      <button
                                        onClick={() => openDancerDetails(dancer.id, dancer.name)}
                                        className="text-blue-600 hover:text-blue-800 hover:underline"
                                      >
                                        {name}
                                      </button>
                                    ) : (
                                      <span>{name}</span>
                                    )}
                                  </span>
                                );
                              })}
                            </p>
                            <p className="text-sm text-black">
                              <strong>Studio/Contestant:</strong> 
                              <button
                                onClick={() => {
                                  const contestant = getContestantDetails(performance.contestantId || '');
                                  if (contestant && contestant.type === 'studio') {
                                    openStudioDetails(contestant.id, contestant.name);
                                  }
                                }}
                                className="ml-1 text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {performance.contestantName}
                              </button>
                            </p>
                            {performance.eodsaId && (
                              <p className="text-xs text-gray-600">
                                <strong>EODSA ID:</strong> {performance.eodsaId}
                              </p>
                            )}
                            {performance.contestantEmail && (
                              <p className="text-xs text-gray-600">
                                <strong>Email:</strong> {performance.contestantEmail} • 
                                <strong> Phone:</strong> {performance.contestantPhone}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              performance.entryType === 'live' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-purple-100 text-purple-800'
                            }`}>
                              {performance.entryType?.toUpperCase()}
                            </span>
                            
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              performance.status === 'in_progress' ? 'bg-orange-100 text-orange-800' :
                              performance.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                              performance.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {performance.status.toUpperCase()}
                            </span>
                            
                            {performance.announced && (
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                📢 ANNOUNCED
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="ml-4 flex flex-col space-y-2">
                          <button
                            onClick={() => openPerformanceDetails(performance)}
                            className="px-3 py-1 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium transition-colors"
                          >
                            📋 View Details
                          </button>
                          
                          {/* Media Dashboard is view-only - no download/play buttons */}
                        </div>
                      </div>
                      
                      {/* Media view-only section */}
                      {performance.entryType === 'live' && (
                        <div className="mt-4">
                          {performance.musicFileUrl ? (
                            <div className="p-3 border border-green-200 bg-green-50 text-green-800 rounded-md text-sm">
                              🎵 Music file available: {performance.musicFileName || `${performance.title}.mp3`}
                            </div>
                          ) : (
                            <div className="p-3 border border-yellow-200 bg-yellow-50 text-yellow-800 rounded-md text-sm">
                              🎵 Music file not uploaded yet
                            </div>
                          )}
                        </div>
                      )}
                      
                      {performance.entryType === 'virtual' && (
                        <div className="mt-4">
                          {performance.videoExternalUrl ? (
                            <div className="p-3 border border-purple-200 bg-purple-50 text-purple-800 rounded-md text-sm">
                              📹 Video link provided: {performance.videoExternalType?.toUpperCase()} format
                            </div>
                          ) : (
                            <div className="p-3 border border-yellow-200 bg-yellow-50 text-yellow-800 rounded-md text-sm">
                              📹 Video link not provided yet
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center">
                <span className="text-4xl mb-4 block">🎭</span>
                <p className="text-black">No performances found for the selected filter</p>
              </div>
            )}
          </div>
        </div>

        {/* Performance Details Modal */}
        {showDetails && selectedPerformance && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowDetails(false);
              }
            }}
          >
            <div className="bg-white rounded-lg sm:rounded-xl shadow-xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header - Fixed */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex justify-between items-center bg-white sticky top-0 z-10">
                <h3 className="text-lg sm:text-xl font-semibold text-black truncate pr-4">
                  Performance Details - #{selectedPerformance.itemNumber || 'N/A'}
                </h3>
                <button
                  onClick={() => setShowDetails(false)}
                  className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Close modal"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Content - Scrollable */}
              <div className="flex-1 overflow-y-auto">
              
              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <h4 className="font-semibold text-black mb-4">Performance Information</h4>
                    <div className="space-y-2 text-sm text-black">
                      <p><strong>Title:</strong> {selectedPerformance.title || 'N/A'}</p>
                      <p><strong>Choreographer:</strong> {selectedPerformance.choreographer || 'N/A'}</p>
                      <p><strong>Style:</strong> {selectedPerformance.itemStyle || 'N/A'}</p>
                      <p><strong>Mastery Level:</strong> {selectedPerformance.mastery || 'N/A'}</p>
                      {/* Duration hidden by request */}
                      <p><strong>Entry Type:</strong> {selectedPerformance.entryType?.toUpperCase() || 'N/A'}</p>
                      <p><strong>Status:</strong> {selectedPerformance.status?.toUpperCase() || 'SCHEDULED'}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-black mb-4">Performer Information</h4>
                    <div className="space-y-2 text-sm text-black">
                      <p><strong>Studio/Contestant:</strong> {selectedPerformance.contestantName || 'N/A'}</p>
                      <p><strong>Performers:</strong> {selectedPerformance.participantNames?.join(', ') || 'N/A'}</p>
                      {selectedPerformance.eodsaId && <p><strong>EODSA ID:</strong> {selectedPerformance.eodsaId}</p>}
                      {selectedPerformance.contestantEmail && (
                        <>
                          <p><strong>Email:</strong> {selectedPerformance.contestantEmail}</p>
                          <p><strong>Phone:</strong> {selectedPerformance.contestantPhone}</p>
                        </>
                      )}
                    </div>
                    
                    {(() => {
                      const contestant = getContestantDetails(selectedPerformance.contestantId || '');
                      if (contestant && contestant.dancers) {
                        return (
                          <div className="mt-4">
                            <h5 className="font-medium text-black mb-2">Dancer Details</h5>
                            <div className="space-y-1 text-sm text-black">
                              {contestant.dancers.map((dancer, index) => (
                                <p key={index}>
                                  <strong>{dancer.name}</strong> (Age: {dancer.age}, ID: {dancer.eodsaId})
                                </p>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
                
                {/* Media Section */}
                {(selectedPerformance.musicFileUrl || selectedPerformance.videoExternalUrl) && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="font-semibold text-black mb-4">Media Files</h4>
                    
                    {selectedPerformance.entryType === 'live' && selectedPerformance.musicFileUrl && (
                      <div className="mb-4">
                        <h5 className="font-medium text-black mb-2">Music File</h5>
                        <div className="p-4 bg-green-50 rounded-lg">
                          <p className="text-sm text-green-900 mb-2">
                            <strong>🎵 Music File Available</strong>
                          </p>
                          <p className="text-xs text-green-700 break-all">
                            {selectedPerformance.musicFileName || `${selectedPerformance.title}.mp3`}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {selectedPerformance.entryType === 'virtual' && selectedPerformance.videoExternalUrl && (
                      <div className="mb-4">
                        <h5 className="font-medium text-black mb-2">Video Link</h5>
                        <div className="p-4 bg-purple-50 rounded-lg">
                          <p className="text-sm text-purple-900 mb-2">
                            <strong>📹 {selectedPerformance.videoExternalType?.toUpperCase()} Video Available</strong>
                          </p>
                          <p className="text-xs text-purple-700 break-all">
                            Video link has been provided by the contestant
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              </div>
            </div>
          </div>
        )}

        {/* Dancer Details Modal */}
        {showDancerModal && selectedDancer && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowDancerModal(false);
              }
            }}
          >
            <div className="bg-white rounded-lg sm:rounded-xl shadow-xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header - Fixed */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex justify-between items-center bg-white sticky top-0 z-10">
                <h3 className="text-lg sm:text-xl font-semibold text-black truncate pr-4">
                  Dancer Details - {selectedDancer.name}
                </h3>
                <button
                  onClick={() => setShowDancerModal(false)}
                  className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Close modal"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Content - Scrollable */}
              <div className="flex-1 overflow-y-auto">
              
              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <h4 className="font-semibold text-black mb-4">Personal Information</h4>
                    <div className="space-y-2 text-sm text-black">
                      <p><strong>Full Name:</strong> {selectedDancer.name}</p>
                      <p><strong>EODSA ID:</strong> {selectedDancer.eodsaId}</p>
                      <p><strong>Age:</strong> {selectedDancer.age}</p>
                      <p><strong>Email:</strong> {selectedDancer.email || 'Not provided'}</p>
                      <p><strong>National ID:</strong> {selectedDancer.nationalId || 'Not provided'}</p>
                      <p><strong>Status:</strong> {selectedDancer.approved ? 'Approved' : 'Pending Approval'}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-black mb-4">Studio Affiliations</h4>
                    <div className="space-y-2 text-sm text-black">
                      {selectedDancer.studioAffiliations && selectedDancer.studioAffiliations.length > 0 ? (
                        selectedDancer.studioAffiliations.map((affiliation: any, index: number) => (
                          <div key={index} className="p-2 bg-gray-50 rounded">
                            <p><strong>Studio:</strong> {affiliation.studioName}</p>
                            <p><strong>Status:</strong> {affiliation.status}</p>
                            <p><strong>Applied:</strong> {new Date(affiliation.appliedAt).toLocaleDateString()}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-600">No studio affiliations</p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="font-semibold text-black mb-4">Competition Entries</h4>
                  {selectedDancer.entries && selectedDancer.entries.length > 0 ? (
                    <div className="space-y-2 text-sm text-black">
                      {selectedDancer.entries.map((entry: any, index: number) => (
                        <div key={index} className="p-3 bg-blue-50 rounded">
                          <p><strong>Item:</strong> {entry.itemName}</p>
                          <p><strong>Event:</strong> {entry.eventName}</p>
                          <p><strong>Style:</strong> {entry.itemStyle} • <strong>Level:</strong> {entry.mastery}</p>
                          <p><strong>Status:</strong> {entry.approved ? 'Approved' : 'Pending'}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-600">No competition entries</p>
                  )}
                </div>
              </div>
              </div>
            </div>
          </div>
        )}

        {/* Studio Details Modal */}
        {showStudioModal && selectedStudio && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowStudioModal(false);
              }
            }}
          >
            <div className="bg-white rounded-lg sm:rounded-xl shadow-xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header - Fixed */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex justify-between items-center bg-white sticky top-0 z-10">
                <h3 className="text-lg sm:text-xl font-semibold text-black truncate pr-4">
                  Studio Details - {selectedStudio.name}
                </h3>
                <button
                  onClick={() => setShowStudioModal(false)}
                  className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Close modal"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Content - Scrollable */}
              <div className="flex-1 overflow-y-auto">
              
              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
                  <div>
                    <h4 className="font-semibold text-black mb-4">Studio Information</h4>
                    <div className="space-y-2 text-sm text-black">
                      <p><strong>Studio Name:</strong> {selectedStudio.name}</p>
                      <p><strong>Registration Number:</strong> {selectedStudio.registrationNumber}</p>
                      <p><strong>Email:</strong> {selectedStudio.email}</p>
                      <p><strong>Phone:</strong> {selectedStudio.phone || 'Not provided'}</p>
                      <p><strong>Address:</strong> {selectedStudio.address || 'Not provided'}</p>
                      <p><strong>Contact Person:</strong> {selectedStudio.contactPerson || 'Not provided'}</p>
                      <p><strong>Status:</strong> {selectedStudio.approved ? 'Approved' : 'Pending Approval'}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-black mb-4">Statistics</h4>
                    <div className="space-y-2 text-sm text-black">
                      <p><strong>Total Dancers:</strong> {selectedStudio.dancerCount}</p>
                      <p><strong>Total Entries:</strong> {selectedStudio.entries ? selectedStudio.entries.length : 0}</p>
                      <p><strong>Registered:</strong> {selectedStudio.createdAt ? new Date(selectedStudio.createdAt).toLocaleDateString() : 'Unknown'}</p>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <h4 className="font-semibold text-black mb-4">Dancers ({selectedStudio.dancerCount})</h4>
                    {selectedStudio.dancers && selectedStudio.dancers.length > 0 ? (
                      <div className="space-y-2 text-sm text-black max-h-64 overflow-y-auto">
                        {selectedStudio.dancers.map((dancer: any, index: number) => (
                          <div key={index} className="p-2 bg-green-50 rounded">
                            <p><strong>{dancer.name}</strong></p>
                            <p>EODSA ID: {dancer.eodsaId} • Age: {dancer.age}</p>
                            <p>Status: {dancer.approved ? 'Approved' : 'Pending'}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-600">No dancers registered</p>
                    )}
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-black mb-4">Competition Entries</h4>
                    {selectedStudio.entries && selectedStudio.entries.length > 0 ? (
                      <div className="space-y-2 text-sm text-black max-h-64 overflow-y-auto">
                        {selectedStudio.entries.map((entry: any, index: number) => (
                          <div key={index} className="p-2 bg-blue-50 rounded">
                            <p><strong>{entry.itemName}</strong></p>
                            <p>Event: {entry.eventName}</p>
                            <p>Style: {entry.itemStyle} • Level: {entry.mastery}</p>
                            <p>Status: {entry.approved ? 'Approved' : 'Pending'}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-600">No competition entries</p>
                    )}
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </RealtimeUpdates>
  );
}
