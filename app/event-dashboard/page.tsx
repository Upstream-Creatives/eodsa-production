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

// Studio session interface
interface StudioSession {
  id: string;
  name: string;
  email: string;
  registrationNumber: string;
}

// Component that uses searchParams - wrapped in Suspense
function EventDashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [eodsaId, setEodsaId] = useState(searchParams?.get('eodsaId') || '');
  const [studioId, setStudioId] = useState(searchParams?.get('studioId') || '');
  const [contestant, setContestant] = useState<Contestant | null>(null);
  const [studioInfo, setStudioInfo] = useState<StudioSession | null>(null);
  const [availableDancers, setAvailableDancers] = useState<any[]>([]);
  const [isStudioMode, setIsStudioMode] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [dancers, setDancers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Since we only have Nationals now, redirect directly to the Nationals dashboard
    if (eodsaId) {
      router.push(`/event-dashboard/Nationals?eodsaId=${eodsaId}`);
    } else if (studioId) {
      router.push(`/event-dashboard/Nationals?studioId=${studioId}`);
    }
  }, [eodsaId, studioId, router]);

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

  const loadStudioData = async (id: string) => {
    setIsLoading(true);
    setError('');
    
    try {
      // Verify studio session
      const studioSession = localStorage.getItem('studioSession');
      if (!studioSession) {
        setError('Studio session expired. Please log in again.');
        router.push('/studio-login');
        return;
      }

      const parsedSession = JSON.parse(studioSession);
      
      // Verify the studio ID matches the session
      if (parsedSession.id !== id) {
        setError('Invalid studio session. Please log in again.');
        router.push('/studio-login');
        return;
      }

      // Load studio's dancers
      const response = await fetch(`/api/studios/dancers-new?studioId=${id}`);
      const data = await response.json();
      
      if (data.success) {
        setStudioInfo(parsedSession);
        setAvailableDancers(data.dancers);
        setDancers(data.dancers.map((dancer: any) => ({
          id: dancer.id,
          firstName: dancer.name.split(' ')[0] || dancer.name,
          lastName: dancer.name.split(' ').slice(1).join(' ') || '',
          age: dancer.age,
          style: 'Studio Dancer',
          nationalId: dancer.nationalId
        })));
      } else {
        setError(data.error || 'Failed to load studio dancers');
      }
    } catch (error) {
      console.error('Failed to load studio data:', error);
      setError('Failed to load studio data. Please try again.');
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

  if (!eodsaId && !studioId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-700/20 p-8 text-center">
          <div className="text-6xl mb-6">🔍</div>
          <h2 className="text-2xl font-bold text-white mb-4">Authentication Required</h2>
          <p className="text-gray-300 mb-6">Please log in to access the event dashboard.</p>
          <div className="space-y-3">
            <Link 
              href="/dancer-login"
              className="block w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-300 font-semibold"
            >
              Dancer Login
            </Link>
            <Link 
              href="/studio-login"
              className="block w-full px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-300 font-semibold"
            >
              Studio Login
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

  // Show loading state while redirecting to Nationals
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-400 rounded-full animate-spin mx-auto mb-4"></div>
        <h2 className="text-2xl font-bold text-white mb-2">Redirecting to Nationals Dashboard</h2>
        <p className="text-gray-300">Taking you to the EODSA Nationals Competition...</p>
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