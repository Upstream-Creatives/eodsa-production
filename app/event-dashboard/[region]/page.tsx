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

  // No longer need to group events by performance type since we have unified events
  useEffect(() => {
    if (events.length > 0) {
      // For unified events, we don't need to group by performance type
      setGroupedEvents({}); // Clear grouped events since we'll show unified events directly
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
          // Filter to only show UNIFIED events (performanceType === 'All')
          // This excludes old separate events like "National Test - Solo", "National Test - Duet"
      const nationalsEvents = data.events.filter((event: Event) =>
        event.region === 'Nationals' &&
            event.performanceType === 'All' &&
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
    // Use the Nationals fee structure
    if (performanceType === 'Solo') {
      return 400; // R400 for 1 solo (plus R300 registration)
    } else if (performanceType === 'Duet' || performanceType === 'Trio') {
      return 280; // R280 per person (plus R300 registration each)
    } else if (performanceType === 'Group') {
      return 220; // R220 per person for small groups (plus R300 registration each)
    }
    return 0; // Default case
  };

  const getFeeExplanation = (performanceType: string) => {
    if (performanceType === 'Solo') {
      return 'Solo packages: 1 solo R400, 2 solos R750, 3 solos R1000, 4 solos R1200, 5th FREE. Plus R300 registration.';
    } else if (performanceType === 'Duet' || performanceType === 'Trio') {
      return 'R280 per person + R300 registration each';
    } else if (performanceType === 'Group') {
      return 'Small groups (4-9): R220pp, Large groups (10+): R190pp. Plus R300 registration each.';
    }
    return 'Per person + R300 registration each';
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          {/* Modern Loading Animation */}
          <div className="relative w-20 h-20 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full border-4 border-purple-500/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin"></div>
            <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-pink-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl">🎭</span>
            </div>
          </div>
          
          {/* Loading Text */}
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white">Loading Nationals Events</h3>
            <p className="text-slate-400 text-sm">Preparing your competition dashboard...</p>
          </div>
          
          {/* Loading Steps Animation */}
          <div className="mt-6 flex justify-center space-x-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.2}s` }}
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      {/* Mobile-optimized header with better spacing */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-lg border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Back Navigation */}
          <div className="mb-4">
            <Link 
              href={isStudioMode ? `/studio-dashboard?studioId=${studioId}` : `/`}
              className="inline-flex items-center space-x-2 px-3 py-2 bg-slate-800/80 text-slate-300 rounded-lg hover:bg-slate-700 transition-all duration-300 group text-sm"
            >
              <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="hidden sm:inline">{isStudioMode ? 'Back to Studio Dashboard' : 'Back to Main Portal'}</span>
              <span className="sm:hidden">Back</span>
            </Link>
          </div>

          {/* Header */}
          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                EODSA Nationals
              </span>
            </h1>
            <p className="text-slate-400 text-sm sm:text-base mb-4">Choose your performance category and register</p>
            
            {/* User Info Card - Mobile Optimized */}
            {(contestant || studioInfo) && (
              <div className="bg-slate-800/60 backdrop-blur rounded-xl p-3 sm:p-4 inline-block max-w-full">
                {isStudioMode ? (
                  <div className="text-center sm:text-left">
                    <p className="text-slate-300 text-sm sm:text-base">
                      <span className="text-emerald-400 font-semibold">{studioInfo?.name}</span>
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400">
                      Reg: {studioInfo?.registrationNumber} • {availableDancers.length} dancers
                    </p>
                  </div>
                ) : (
                  <div className="text-center sm:text-left">
                    <p className="text-slate-300 text-sm sm:text-base">
                      Welcome, <span className="text-purple-400 font-semibold">{contestant?.name}</span>
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400">
                      ID: {contestant?.eodsaId}
                      {contestant?.type === 'studio' && contestant.studioName && 
                        ` • ${contestant.studioName}`
                      }
                      {contestant?.type === 'private' && ' • Independent'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {events.length > 0 ? (
          <div className="space-y-8 sm:space-y-12">
            {events.map((event) => (
              <div key={event.id} className="group">
                {/* Event Header */}
                  <div className="relative mb-6 sm:mb-8">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-purple-500/10 rounded-2xl blur-xl"></div>
                    <div className="relative bg-slate-800/70 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-slate-700/50 hover:border-purple-500/30 transition-all duration-500">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center space-x-3 sm:space-x-4">
                          <div className="relative">
                            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
                            <div className="text-2xl sm:text-3xl">🏆</div>
                            </div>
                            <div className="absolute -inset-1 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl sm:rounded-2xl blur opacity-30 group-hover:opacity-50 transition-opacity"></div>
                          </div>
                          
                          <div>
                            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">
                            {event.name}
                            </h2>
                          <p className="text-slate-400 text-sm sm:text-base">{event.description}</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <span className="inline-flex items-center px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg text-xs font-medium">
                              <div className="w-2 h-2 bg-emerald-400 rounded-full mr-1 animate-pulse"></div>
                              Open for Registration
                            </span>
                              <span className="inline-flex items-center px-2 py-1 bg-purple-500/20 text-purple-300 rounded-lg text-xs font-medium">
                              All Performance Types
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="hidden sm:flex items-center space-x-6">
                          <div className="text-center">
                          <p className="text-xl lg:text-2xl font-bold text-purple-400">{new Date(event.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                          <p className="text-xs lg:text-sm text-slate-400 uppercase tracking-wide">Event Date</p>
                          </div>
                          <div className="text-center">
                          <p className="text-xl lg:text-2xl font-bold text-emerald-400">{event.venue}</p>
                          <p className="text-xs lg:text-sm text-slate-400 uppercase tracking-wide">Venue</p>
                        </div>
                      </div>
                    </div>
                  </div>
                              </div>
                              
                                {/* Event Details Card */}
                <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 sm:p-8">
                  {/* Event Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-4">
                      <div>
                        <p className="text-slate-500 text-sm uppercase tracking-wide font-semibold mb-2">Event Date</p>
                        <p className="text-slate-200 text-lg font-medium">
                          {new Date(event.eventDate).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-sm uppercase tracking-wide font-semibold mb-2">Age Categories</p>
                        <p className="text-slate-200 text-lg font-medium">{event.ageCategory}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <p className="text-slate-500 text-sm uppercase tracking-wide font-semibold mb-2">Venue</p>
                        <p className="text-slate-200 text-lg font-medium">{event.venue}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-sm uppercase tracking-wide font-semibold mb-2">Performance Types</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex items-center px-3 py-1 bg-purple-500/20 text-purple-300 rounded-lg text-sm font-medium">💃 Solo</span>
                          <span className="inline-flex items-center px-3 py-1 bg-purple-500/20 text-purple-300 rounded-lg text-sm font-medium">👯 Duet</span>
                          <span className="inline-flex items-center px-3 py-1 bg-purple-500/20 text-purple-300 rounded-lg text-sm font-medium">👥 Trio</span>
                          <span className="inline-flex items-center px-3 py-1 bg-purple-500/20 text-purple-300 rounded-lg text-sm font-medium">🎭 Group</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Registration Deadline */}
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-6">
                    <div className="flex items-center space-x-2 mb-2">
                      <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"></path>
                      </svg>
                      <span className="text-amber-300 font-medium">Registration Deadline</span>
                    </div>
                    <p className="text-amber-200 mb-2">
                      {new Date(event.registrationDeadline).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                    <CountdownTimer deadline={event.registrationDeadline} />
                  </div>

                  {/* Enter Competition Button */}
                  <button
                    onClick={() => router.push(`/event-dashboard/${region}/competition?${isStudioMode ? `studioId=${studioId}` : `eodsaId=${eodsaId}`}&eventId=${event.id}`)}
                    className="w-full group/btn relative overflow-hidden px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl hover:shadow-purple-500/25"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700"></div>
                    <div className="relative flex items-center justify-center space-x-2">
                      <span className="text-lg">Enter Competition</span>
                      <svg className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </div>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 sm:py-24">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-purple-500/10 rounded-3xl blur-2xl"></div>
              <div className="relative bg-slate-800/60 backdrop-blur-xl rounded-3xl p-8 sm:p-12 border border-slate-700/50">
                <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center">
                  <span className="text-3xl sm:text-4xl">🎭</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-4">No Events Available</h3>
                <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
                  There are currently no open events for nationals competition. Check back soon or contact support for more information.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
