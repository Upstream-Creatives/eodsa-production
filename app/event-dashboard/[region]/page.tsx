'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PERFORMANCE_TYPES, EODSA_FEES } from '@/lib/types';
import CountdownTimer from '@/app/components/CountdownTimer';

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

export default function NationalsEventsPage() {
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
      loadNationalsEvents();
    } else if (region && studioId) {
      setIsStudioMode(true);
      loadStudioData(studioId);
      loadNationalsEvents();
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

  const loadNationalsEvents = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/events');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
                // Filter events by nationals status (since we only have Nationals now)
      const nationalsEvents = data.events.filter((event: Event) =>
        event.region === 'Nationals' &&
        (event.status === 'registration_open' || event.status === 'upcoming')
      );
      setEvents(nationalsEvents);
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
    const typeInfo = PERFORMANCE_TYPES[performanceType as keyof typeof PERFORMANCE_TYPES];
    if (typeInfo) {
      return { description: typeInfo.description };
    }
    // Fallback for safety, though should not be reached with valid data
    switch (performanceType) {
      case 'Solo': return { description: 'Individual performance' };
      case 'Duet': return { description: 'Two dancers together' };
      case 'Trio': return { description: 'Three dancers together' };
      case 'Group': return { description: '4+ dancers together' };
      default: return { description: 'Performance' };
    }
  };

  const getStartingFee = (performanceType: string) => {
    // Use the new simplified fee structure
    if (performanceType === 'Solo') {
      return EODSA_FEES.PERFORMANCE.Solo;
    } else if (performanceType === 'Duet' || performanceType === 'Trio') {
      return EODSA_FEES.PERFORMANCE.Duet; // R280 per person
    } else if (performanceType === 'Group') {
      return EODSA_FEES.PERFORMANCE.SmallGroup; // R220 per person (default to small group)
    }
    return 0; // Default case
  };

  if (!region || (!eodsaId && !studioId)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-700/20 p-8 text-center">
          <div className="text-6xl mb-6">❌</div>
          <h2 className="text-2xl font-bold text-white mb-4">Missing Information</h2>
          <p className="text-gray-300 mb-6">Authentication not provided for Nationals dashboard.</p>
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
          <p className="text-gray-300">Loading nationals events...</p>
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
            <span>Back to Main Portal</span>
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            EODSA Nationals Events
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

        <div className="space-y-12">
          {Object.entries(groupedEvents).length > 0 ? (
            Object.entries(groupedEvents).map(([performanceType, eventsOfType]) => {
              const performanceInfo = PERFORMANCE_TYPES[performanceType as keyof typeof PERFORMANCE_TYPES];
              const { description } = getParticipantRequirements(performanceType);

              if (!performanceInfo) return null; // Skip if type is not in our definition

              return (
                <div key={performanceType} className="bg-gray-800/40 backdrop-blur-md rounded-2xl shadow-lg overflow-hidden border border-gray-700/50">
                  <div className="p-6 bg-gray-900/50 flex justify-between items-center">
                    <div>
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center">
                          <img src={performanceInfo.icon} alt={`${performanceInfo.name} icon`} className="w-8 h-8" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold text-white">{performanceInfo.name} Events</h2>
                          <p className="text-gray-400">{performanceInfo.description}</p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-400">Available Events</p>
                      <p className="text-2xl font-bold text-purple-400">{eventsOfType.length}</p>
                    </div>
                  </div>

                  <div className="p-4 space-y-4">
                    {eventsOfType.map(event => (
                      <div key={event.id} className="bg-gray-800 rounded-xl shadow-md overflow-hidden flex flex-col md:flex-row hover:bg-gray-700/80 transition-all duration-300 border border-gray-700/50">
                        <div className="p-6 md:w-2/3">
                          <h3 className="text-xl font-bold text-white mb-2">{event.name}</h3>
                          <p className="text-gray-400 text-sm mb-4">{event.description}</p>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-gray-500 uppercase font-semibold text-xs">Date</p>
                              <p className="text-gray-200">{new Date(event.eventDate).toLocaleDateString()}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 uppercase font-semibold text-xs">Venue</p>
                              <p className="text-gray-200">{event.venue}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 uppercase font-semibold text-xs">Age Category</p>
                              <p className="text-gray-200">{event.ageCategory}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 uppercase font-semibold text-xs">Entry Fee</p>
                              <p className="text-lg font-bold text-white">R{getStartingFee(event.performanceType)}</p>
                              <p className="text-xs text-gray-400">Starting from</p>
                            </div>
                          </div>
                          
                          <div className="mt-4 border-t border-gray-700 pt-4">
                            <div className="flex items-center text-green-400">
                              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                              <span className="text-sm">Registration Open</span>
                            </div>
                            <p className="text-sm text-gray-400 mt-1">
                              Deadline: {new Date(event.registrationDeadline).toLocaleDateString()}
                            </p>
                            <div className="mt-2">
                              <CountdownTimer deadline={event.registrationDeadline} />
                            </div>
                          </div>

                        </div>
                        <div className="md:w-1/3 bg-gray-800/50 p-6 flex flex-col justify-center items-center">
                           <button
                              onClick={() => router.push(`/event-dashboard/${region}/${performanceType.toLowerCase()}?${isStudioMode ? `studioId=${studioId}` : `eodsaId=${eodsaId}`}&eventId=${event.id}`)}
                              className="w-full px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all duration-300 font-semibold flex items-center justify-center space-x-2"
                           >
                             <span>Enter Competition</span>
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                             </svg>
                           </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          ) : (
            <div className="text-center py-16 bg-gray-800/50 rounded-2xl">
              <h3 className="text-xl font-semibold text-white">No Events Found</h3>
              <p className="text-gray-400 mt-2">There are currently no open events for the nationals competition.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
