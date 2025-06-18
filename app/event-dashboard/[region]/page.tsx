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

export default function RegionalEventsPage() {
  const searchParams = useSearchParams();
  const params = useParams();
  const router = useRouter();
  const region = params?.region as string;
  const eodsaId = searchParams?.get('eodsaId') || '';
  
  const [contestant, setContestant] = useState<Contestant | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedPerformanceType, setSelectedPerformanceType] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [autoRedirecting, setAutoRedirecting] = useState(false);

  useEffect(() => {
    if (region && eodsaId) {
      loadContestant(eodsaId);
      loadRegionalEvents();
    }
  }, [region, eodsaId]);

  // New effect for auto-assignment logic
  useEffect(() => {
    if (events.length > 0 && !autoRedirecting) {
      checkForAutoAssignment();
    }
  }, [events, autoRedirecting]);

  const checkForAutoAssignment = () => {
    // If there's only one event total in this region, auto-redirect to it
    if (events.length === 1) {
      const singleEvent = events[0];
      setAutoRedirecting(true);
      router.push(`/event-dashboard/${region}/${singleEvent.performanceType.toLowerCase()}?eodsaId=${eodsaId}&autoAssigned=true`);
      return;
    }

    // Check if there's only one performance type with events
    const performanceTypesWithEvents = PERFORMANCE_TYPES.filter(type => 
      events.some(event => event.performanceType === type)
    );

    if (performanceTypesWithEvents.length === 1) {
      const singlePerformanceType = performanceTypesWithEvents[0];
      const eventsForType = events.filter(event => event.performanceType === singlePerformanceType);
      
      // If there's only one event for this performance type, auto-redirect
      if (eventsForType.length === 1) {
        setAutoRedirecting(true);
        router.push(`/event-dashboard/${region}/${singlePerformanceType.toLowerCase()}?eodsaId=${eodsaId}&autoAssigned=true`);
        return;
      }
    }
  };

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

  const selectPerformanceType = (performanceType: string) => {
    setSelectedPerformanceType(performanceType);
    // Find events that match this performance type
    const matchingEvents = events.filter(event => event.performanceType === performanceType);
    
    if (matchingEvents.length === 1) {
      // Auto-redirect if only one event for this performance type
      router.push(`/event-dashboard/${region}/${performanceType.toLowerCase()}?eodsaId=${eodsaId}&autoAssigned=true`);
    } else if (matchingEvents.length > 1) {
      // Multiple events - show selection page
      router.push(`/event-dashboard/${region}/${performanceType.toLowerCase()}?eodsaId=${eodsaId}`);
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

  if (!region || !eodsaId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-700/20 p-8 text-center">
          <div className="text-6xl mb-6">❌</div>
          <h2 className="text-2xl font-bold text-white mb-4">Missing Information</h2>
          <p className="text-gray-300 mb-6">Region or EODSA ID not provided.</p>
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

  // Show auto-redirecting state
  if (autoRedirecting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-700/20 p-8 text-center">
          <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-400 rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-white mb-4">Auto-Assigning Event</h2>
          <p className="text-gray-300 mb-2">We found the perfect event for you!</p>
          <p className="text-sm text-purple-400">Redirecting to event registration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Link 
            href={`/event-dashboard?eodsaId=${eodsaId}`} 
            className="inline-flex items-center text-purple-400 hover:text-purple-300 mb-4 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
            {region?.charAt(0).toUpperCase() + region?.slice(1)} Events
          </h1>
          <p className="text-xl text-gray-300">Select your performance type to continue</p>
        </div>

        {/* User Info */}
        {contestant && (
          <div className="max-w-4xl mx-auto mb-8">
            <div className="bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-700/20 p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-lg font-bold">{contestant.name.charAt(0)}</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{contestant.name}</h3>
                  <p className="text-sm text-purple-400 font-mono">EODSA ID: {contestant.eodsaId}</p>
                </div>
                <div className="ml-auto">
                  <span className="px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-full text-sm font-medium">
                    {region} Region
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Performance Type Selection - Enhanced with Auto-Assignment Logic */}
        <div className="max-w-6xl mx-auto">
          <div className="bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-700/20 p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-4">Select Performance Type</h2>
              <p className="text-gray-300">Choose the type of performance you want to register for</p>
              {events.length > 0 && (
                <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                  <p className="text-blue-300 text-sm">
                    💡 <strong>Smart Selection:</strong> If there's only one event available, we'll automatically take you there!
                  </p>
                </div>
              )}
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-400 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-300">Loading events...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-6">📅</div>
                <h3 className="text-2xl font-bold text-white mb-4">No Events Available</h3>
                <p className="text-gray-300 mb-6">There are currently no open events in the {region} region.</p>
                <Link 
                  href={`/event-dashboard?eodsaId=${eodsaId}`}
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all duration-300 font-semibold"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Dashboard
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {PERFORMANCE_TYPES.map((performanceType) => {
                  const requirements = getParticipantRequirements(performanceType);
                  const availableEvents = getEventsByPerformanceType(performanceType);
                  const hasEvents = availableEvents.length > 0;
                  const eventCount = availableEvents.length;
                  
                  return (
                    <div
                      key={performanceType}
                      onClick={hasEvents ? () => selectPerformanceType(performanceType) : undefined}
                      className={`border-2 rounded-2xl p-6 transition-all duration-300 ${
                        hasEvents 
                          ? 'border-gray-600 hover:border-purple-400 hover:scale-105 cursor-pointer bg-gradient-to-br from-gray-700/50 to-gray-800/50 hover:shadow-lg hover:shadow-purple-500/20' 
                          : 'border-gray-700 bg-gray-800/30 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="text-center">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                          hasEvents 
                            ? 'bg-gradient-to-br from-purple-500 to-pink-600' 
                            : 'bg-gray-600'
                        }`}>
                          <span className="text-white text-2xl">
                            {performanceType === 'Solo' ? '🕺' : 
                             performanceType === 'Duet' ? '👫' : 
                             performanceType === 'Trio' ? '👥' : '🎭'}
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">{performanceType}</h3>
                        <p className="text-gray-300 mb-4 text-sm">{requirements.description}</p>
                        
                        <div className="space-y-2">
                          <div className={`rounded-lg p-3 ${hasEvents ? 'bg-purple-900/30' : 'bg-gray-700/50'}`}>
                            <p className={`text-sm font-semibold ${hasEvents ? 'text-purple-300' : 'text-gray-400'}`}>
                              Participants: {requirements.min === requirements.max ? requirements.min : `${requirements.min}-${requirements.max}`}
                            </p>
                          </div>
                          
                          {hasEvents && (
                            <div className="rounded-lg p-3 bg-emerald-900/30">
                              <p className="text-sm font-semibold text-emerald-300">
                                {eventCount === 1 ? '🚀 Auto-redirect to event' : `📋 ${eventCount} events available`}
                              </p>
                            </div>
                          )}
                          
                          {!hasEvents && (
                            <div className="rounded-lg p-3 bg-red-900/30">
                              <p className="text-sm font-semibold text-red-300">
                                No events available
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 