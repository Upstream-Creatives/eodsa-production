'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PERFORMANCE_TYPES } from '@/lib/types';

interface Event {
  id: string;
  name: string;
  description: string;
  region: string;
  ageCategory: string;
  performanceType: string;
  eventDate: string;
  registrationDeadline: string;
  venue: string;
  status: string;
  maxParticipants?: number;
  entryFee: number;
}

interface Contestant {
  id: string;
  eodsaId: string;
  name: string;
  email: string;
  phone: string;
  type: 'studio' | 'private';
  studioName?: string;
  dancers: {
    id: string;
    name: string;
    age: number;
    style: string;
    nationalId: string;
  }[];
}

interface StudioSession {
  id: string;
  name: string;
  email: string;
  registrationNumber: string;
}

export default function RegionalEventsPage() {
  const searchParams = useSearchParams();
  const params = useParams();
  const router = useRouter();
  const region = decodeURIComponent(params?.region as string || '');
  const eodsaId = searchParams?.get('eodsaId') || '';
  const studioId = searchParams?.get('studioId') || '';
  
  const [contestant, setContestant] = useState<Contestant | null>(null);
  const [studioInfo, setStudioInfo] = useState<StudioSession | null>(null);
  const [availableDancers, setAvailableDancers] = useState<any[]>([]);
  const [isStudioMode, setIsStudioMode] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [groupedEvents, setGroupedEvents] = useState<{[key: string]: Event[]}>({});

  useEffect(() => {
    if (region && eodsaId) {
      setIsStudioMode(false);
      loadContestant(eodsaId);
      loadRegionalEvents();
    } else if (region && studioId) {
      setIsStudioMode(true);
      loadStudioData(studioId);
      loadRegionalEvents();
    }
  }, [region, eodsaId, studioId]);

  // Group events by performance type after loading
  useEffect(() => {
    if (events.length > 0) {
      const grouped = events.reduce((acc, event) => {
        const type = event.performanceType;
        if (!acc[type]) acc[type] = [];
        acc[type].push(event);
        return acc;
      }, {} as {[key: string]: Event[]});
      setGroupedEvents(grouped);
    }
  }, [events]);

  const loadContestant = async (id: string) => {
    try {
      // Try unified system first (new dancers)
      const unifiedResponse = await fetch(`/api/dancers/by-eodsa-id/${id}`);
      if (unifiedResponse.ok) {
        const unifiedData = await unifiedResponse.json();
        if (unifiedData.success && unifiedData.dancer) {
          const dancer = unifiedData.dancer;
          // Transform single dancer to contestant format
          // Correctly label based on studio association
          const isStudioLinked = dancer.studioAssociation !== null;
          setContestant({
            id: dancer.id,
            eodsaId: dancer.eodsaId,
            name: dancer.name,
            email: dancer.email || '',
            phone: dancer.phone || '',
            type: isStudioLinked ? ('studio' as const) : ('private' as const),
            studioName: dancer.studioAssociation?.studioName,
            dancers: [{
              id: dancer.id,
              name: dancer.name,
              age: dancer.age,
              style: '',
              nationalId: dancer.nationalId
            }]
          });
          return;
        }
      }
      
      // Fallback to legacy system (contestants)
      const legacyResponse = await fetch(`/api/contestants/by-eodsa-id/${id}`);
      if (legacyResponse.ok) {
        const legacyData = await legacyResponse.json();
        setContestant(legacyData);
      }
    } catch (error) {
      console.error('Failed to load contestant:', error);
    }
  };

  const loadStudioData = async (id: string) => {
    try {
      // Verify studio session
      const studioSession = localStorage.getItem('studioSession');
      if (!studioSession) {
        router.push('/studio-login');
        return;
      }

      const parsedSession = JSON.parse(studioSession);
      
      // Verify the studio ID matches the session
      if (parsedSession.id !== id) {
        router.push('/studio-login');
        return;
      }

      // Load studio's dancers
      const response = await fetch(`/api/studios/dancers-new?studioId=${id}`);
      const data = await response.json();
      
      if (data.success) {
        setStudioInfo(parsedSession);
        setAvailableDancers(data.dancers);
      }
    } catch (error) {
      console.error('Failed to load studio data:', error);
    }
  };

  const loadRegionalEvents = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/events');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Filter events by region and open status
          const regionEvents = data.events.filter((event: Event) => 
            event.region.toLowerCase() === region?.toLowerCase() &&
            (event.status === 'registration_open' || event.status === 'upcoming')
          );
          setEvents(regionEvents);
        }
      }
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getEventsByPerformanceType = (performanceType: string) => {
    return events.filter(event => event.performanceType === performanceType);
  };

  const getParticipantRequirements = (performanceType: string) => {
    switch (performanceType) {
      case 'Solo': return { min: 1, max: 1, description: 'Individual performance' };
      case 'Duet': return { min: 2, max: 2, description: 'Two dancers together' };
      case 'Trio': return { min: 3, max: 3, description: 'Three dancers together' };
      case 'Group': return { min: 4, max: 30, description: '4+ dancers together' };
      default: return { min: 1, max: 1, description: 'Performance' };
    }
  };

  if (!region || (!eodsaId && !studioId)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-700/20 p-8 text-center">
          <div className="text-6xl mb-6">❌</div>
          <h2 className="text-2xl font-bold text-white mb-4">Missing Information</h2>
          <p className="text-gray-300 mb-6">Region or authentication not provided.</p>
          <Link 
            href="/"
            className="block w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all duration-300 font-semibold"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-300">Loading events for {region}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Back Navigation */}
        <div className="mb-6">
          <Link 
            href={`/event-dashboard?${isStudioMode ? `studioId=${studioId}` : `eodsaId=${eodsaId}`}`}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-700/50 text-gray-300 rounded-xl hover:bg-gray-700 transition-all duration-300 group"
          >
            <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Region Selection</span>
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            {region} Events
          </h1>
          {(contestant || studioInfo) && (
            <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-4 inline-block">
              {isStudioMode ? (
                <>
                  <p className="text-gray-300">
                    Studio: <span className="text-green-400 font-semibold">{studioInfo?.name}</span>
                  </p>
                  <p className="text-sm text-gray-400">
                    Registration #: {studioInfo?.registrationNumber} • {availableDancers.length} dancers available
                  </p>
                </>
              ) : (
                <>
                  <p className="text-gray-300">
                    Welcome, <span className="text-purple-400 font-semibold">{contestant?.name}</span>
                  </p>
                  <p className="text-sm text-gray-400">
                    EODSA ID: {contestant?.eodsaId} • 
                    {contestant?.type === 'studio' && contestant.studioName && 
                      ` Studio: ${contestant.studioName}`
                    }
                    {contestant?.type === 'private' && ' Independent Dancer'}
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {events.length === 0 ? (
          <div className="bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-700/20 p-12 text-center">
            <div className="text-6xl mb-6">🏆</div>
            <h2 className="text-2xl font-bold text-white mb-4">No Events Available</h2>
            <p className="text-gray-300 mb-6">
              There are currently no open events in {region}. Please check back later.
            </p>
            <Link 
              href={`/event-dashboard?${isStudioMode ? `studioId=${studioId}` : `eodsaId=${eodsaId}`}`}
              className="inline-block px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all duration-300 font-semibold"
            >
              Browse Other Regions
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Events grouped by performance type */}
            {Object.entries(groupedEvents).map(([performanceType, typeEvents]) => (
              <div key={performanceType} className="bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-700/20 overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 p-6 border-b border-gray-700/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="text-3xl">
                        {performanceType === 'Solo' && '🎭'}
                        {performanceType === 'Duet' && '👥'}
                        {performanceType === 'Trio' && '👥👤'}
                        {performanceType === 'Group' && '👥👥'}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-white">{performanceType} Events</h2>
                        <p className="text-gray-300">
                          {getParticipantRequirements(performanceType).description}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-400">Available Events</div>
                      <div className="text-2xl font-bold text-purple-400">{typeEvents.length}</div>
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="grid gap-4">
                    {typeEvents.map((event) => (
                      <div 
                        key={event.id}
                        className="bg-gray-700/50 rounded-2xl p-6 border border-gray-600/30 hover:border-purple-500/50 transition-all duration-300 hover:bg-gray-700/70"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-xl font-bold text-white mb-2">{event.name}</h3>
                            <p className="text-gray-300 mb-4">{event.description}</p>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                              <div>
                                <div className="text-xs text-gray-400 uppercase tracking-wide">Date</div>
                                <div className="text-sm text-white font-medium">
                                  {new Date(event.eventDate).toLocaleDateString()}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-400 uppercase tracking-wide">Venue</div>
                                <div className="text-sm text-white font-medium">{event.venue}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-400 uppercase tracking-wide">Age Category</div>
                                <div className="text-sm text-white font-medium">{event.ageCategory}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-400 uppercase tracking-wide">Entry Fee</div>
                                <div className="text-sm text-purple-400 font-bold">R{event.entryFee}</div>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-4 mb-4">
                              <div className="flex items-center space-x-2">
                                <div className={`w-3 h-3 rounded-full ${
                                  event.status === 'registration_open' ? 'bg-green-500' :
                                  event.status === 'upcoming' ? 'bg-yellow-500' : 'bg-gray-500'
                                }`}></div>
                                <span className="text-sm text-gray-300 capitalize">
                                  {event.status.replace('_', ' ')}
                                </span>
                              </div>
                              <div className="text-sm text-gray-400">
                                Deadline: {new Date(event.registrationDeadline).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          
                          <div className="ml-6">
                            <button
                              onClick={() => router.push(`/event-dashboard/${region}/${performanceType.toLowerCase()}?${isStudioMode ? `studioId=${studioId}` : `eodsaId=${eodsaId}`}&eventId=${event.id}`)}
                              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all duration-300 font-semibold flex items-center space-x-2"
                            >
                              <span>Enter Competition</span>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
} 