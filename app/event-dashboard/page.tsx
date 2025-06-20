'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { REGIONS } from '@/lib/types';

interface Contestant {
  id: string;
  eodsaId: string;
  contactName: string;
  email: string;
  phone: string;
  type: 'studio' | 'private';
  studioName?: string;
  dancers: {
    id: string;
    firstName: string;
    lastName: string;
    age: number;
    style: string;
    nationalId: string;
  }[];
}

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

// Component that uses searchParams - wrapped in Suspense
function EventDashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [eodsaId, setEodsaId] = useState(searchParams?.get('eodsaId') || '');
  const [contestant, setContestant] = useState<Contestant | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [dancers, setDancers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (eodsaId) {
      loadContestantData(eodsaId);
      loadEvents();
    }
  }, [eodsaId]);

  const loadContestantData = async (id: string) => {
    setIsLoading(true);
    setError('');
    
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
            contactName: dancer.name,
            email: dancer.email || '',
            phone: dancer.phone || '',
            type: isStudioLinked ? ('studio' as const) : ('private' as const),
            studioName: dancer.studioAssociation?.studioName,
            dancers: [{
              id: dancer.id,
              firstName: dancer.name.split(' ')[0] || dancer.name,
              lastName: dancer.name.split(' ').slice(1).join(' ') || '',
              age: dancer.age,
              style: '',
              nationalId: dancer.nationalId
            }]
          });
          setDancers([{
            id: dancer.id,
            firstName: dancer.name.split(' ')[0] || dancer.name,
            lastName: dancer.name.split(' ').slice(1).join(' ') || '',
            age: dancer.age,
            style: '',
            nationalId: dancer.nationalId
          }]);
          return;
        }
      }
      
      // Fallback to legacy system (contestants)
      const legacyResponse = await fetch(`/api/contestants/by-eodsa-id/${id}`);
      if (legacyResponse.ok) {
        const legacyData = await legacyResponse.json();
        setContestant(legacyData);
        setDancers(legacyData.dancers || []);
      } else {
        setError('EODSA ID not found. Please check your ID or register first.');
      }
    } catch (error) {
      setError('Failed to load contestant data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      const response = await fetch('/api/events');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const openEvents = data.events.filter((event: Event) => 
            event.status === 'registration_open' || event.status === 'upcoming'
          );
          setEvents(openEvents);
        }
      }
    } catch (error) {
      console.error('Failed to load events:', error);
    }
  };

  const getRegionStats = (region: string) => {
    const regionEvents = events.filter(event => event.region === region);
    const types = new Set(regionEvents.map(event => event.performanceType)).size;
    return {
      events: regionEvents.length,
      types: types
    };
  };

  if (!eodsaId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-700/20 p-8 text-center">
          <div className="text-6xl mb-6">🔍</div>
          <h2 className="text-2xl font-bold text-white mb-4">EODSA ID Required</h2>
          <p className="text-gray-300 mb-6">Please enter your EODSA ID to access the event dashboard.</p>
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
          <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-400 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-300">Loading your data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-700/20 p-8 text-center">
          <div className="text-6xl mb-6">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-4">Error</h2>
          <p className="text-gray-300 mb-6">{error}</p>
          <div className="space-y-3">
            <Link 
              href="/register"
              className="block w-full px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 transition-all duration-300 font-semibold"
            >
              Register New Account
            </Link>
            <Link 
              href="/"
              className="block w-full px-6 py-3 border-2 border-gray-600 text-gray-300 rounded-xl hover:bg-gray-700 hover:border-gray-500 transition-all duration-300 font-semibold"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      {/* Enhanced Header */}
      <header className="bg-gray-800/90 backdrop-blur-lg shadow-xl border-b border-gray-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-8">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">🎭</span>
              </div>
              <div>
                <h1 className="text-3xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-purple-500 bg-clip-text text-transparent">
                  Event Dashboard
                </h1>
                <p className="text-gray-300 mt-1 font-medium">Competition Entry Portal</p>
              </div>
            </div>
            <Link
              href="/"
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-xl hover:from-gray-700 hover:to-gray-800 transition-all duration-200 transform hover:scale-105 shadow-lg font-medium"
            >
              <span>←</span>
              <span>Home</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Navigation */}
        <div className="mb-6">
          <Link 
            href="/"
            className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-700/50 text-gray-300 rounded-xl hover:bg-gray-700 transition-all duration-300 group"
          >
            <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Main Portal</span>
          </Link>
        </div>

        {/* Main Dashboard Content */}
        {contestant && (
          <div className="space-y-8">
            {/* Welcome Section */}
            <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-gray-700/50">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white text-xl">🎪</span>
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">Welcome, {contestant.contactName}!</h2>
                <p className="text-xl text-gray-300">Welcome to your competition entry portal</p>
                <div className="mt-4 p-4 bg-purple-900/30 rounded-xl border border-purple-500/50">
                  <p className="text-purple-300 font-bold text-lg">EODSA ID: {eodsaId}</p>
                  <p className="text-gray-300">{contestant.type === 'studio' ? `${contestant.studioName} (Studio-Linked)` : 'Private Dancer'}</p>
                  
                  <div className="mt-3">
                    <p className="text-sm text-gray-300">Registered Dancers</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {dancers.map((dancer, index) => (
                        <span key={index} className="px-3 py-1 bg-purple-500/30 border border-purple-400 text-purple-200 rounded-full text-sm font-medium">
                          {dancer.firstName} {dancer.lastName}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Region Selection */}
            <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-purple-700">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">Select Your Region</h3>
                <p className="text-gray-300">Choose your regional competition to view available events</p>
              </div>
              
              <div className="grid md:grid-cols-3 gap-6">
                {REGIONS.map((region) => {
                  const regionStats = getRegionStats(region);
                  return (
                    <Link
                      key={region}
                      href={`/event-dashboard/${region}?eodsaId=${eodsaId}`}
                      className="group bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl p-6 border-2 border-purple-700 hover:border-purple-900 transition-all duration-300 transform hover:scale-105 hover:shadow-xl"
                    >
                      <div className="text-center">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                          <span className="text-white text-xl">🏛️</span>
                        </div>
                        <h4 className="text-xl font-bold text-white mb-2">{region}</h4>
                        <p className="text-gray-300 mb-4">
                          Regional Competition Events Available
                        </p>
                        <div className="text-sm text-purple-300 font-medium">
                          View Events →
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Loading fallback component
function EventDashboardLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-400 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-300">Loading dashboard...</p>
      </div>
    </div>
  );
}

// Main exported component with Suspense wrapper
export default function EventDashboardPage() {
  return (
    <Suspense fallback={<EventDashboardLoading />}>
      <EventDashboardContent />
    </Suspense>
  );
} 