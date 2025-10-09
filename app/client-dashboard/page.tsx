'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ClientSession {
  id: string;
  name: string;
  email: string;
  phone?: string;
  allowedDashboards: string[];
  canViewAllEvents: boolean;
  allowedEventIds: string[];
  userType: 'client';
}

interface DashboardConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  path: string;
  color: string;
}

const AVAILABLE_DASHBOARDS: DashboardConfig[] = [
  {
    id: 'admin',
    name: 'Admin Dashboard',
    description: 'Full system administration',
    icon: '👑',
    path: '/admin',
    color: 'from-red-500 to-red-600'
  },
  {
    id: 'judge-dashboard',
    name: 'Judge Dashboard',
    description: 'Performance scoring interface',
    icon: '⚖️',
    path: '/judge/dashboard',
    color: 'from-blue-500 to-blue-600'
  },
  {
    id: 'announcer-dashboard',
    name: 'Announcer Dashboard',
    description: 'Event announcements and performance control',
    icon: '📢',
    path: '/announcer-dashboard',
    color: 'from-green-500 to-green-600'
  },
  {
    id: 'backstage-dashboard',
    name: 'Backstage Dashboard',
    description: 'Performance management and scheduling',
    icon: '🎭',
    path: '/backstage-dashboard',
    color: 'from-purple-500 to-purple-600'
  },
  {
    id: 'media-dashboard',
    name: 'Media Dashboard',
    description: 'Media access and content management',
    icon: '📸',
    path: '/media-dashboard',
    color: 'from-pink-500 to-pink-600'
  },
  {
    id: 'registration-dashboard',
    name: 'Registration Dashboard',
    description: 'Registration management and check-in',
    icon: '📝',
    path: '/registration-dashboard',
    color: 'from-yellow-500 to-yellow-600'
  },
  {
    id: 'event-dashboard',
    name: 'Event Dashboard',
    description: 'Event viewing and monitoring',
    icon: '🏆',
    path: '/event-dashboard',
    color: 'from-indigo-500 to-indigo-600'
  }
];

export default function ClientDashboard() {
  const [clientSession, setClientSession] = useState<ClientSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const session = localStorage.getItem('clientSession');
    if (!session) {
      router.push('/portal/client');
      return;
    }

    try {
      const parsedSession = JSON.parse(session);
      if (parsedSession.userType !== 'client') {
        router.push('/portal/client');
        return;
      }
      setClientSession(parsedSession);
    } catch {
      router.push('/portal/client');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('clientSession');
    router.push('/portal/client');
  };

  const getAccessibleDashboards = () => {
    if (!clientSession) return [];
    
    return AVAILABLE_DASHBOARDS.filter(dashboard => 
      clientSession.allowedDashboards.includes(dashboard.id)
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading client dashboard...</p>
        </div>
      </div>
    );
  }

  if (!clientSession) {
    return null;
  }

  const accessibleDashboards = getAccessibleDashboards();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800">
      {/* Header */}
      <div className="bg-gray-800/80 backdrop-blur-sm border-b border-gray-700/20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <span className="text-xl font-bold text-white">👤</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Staff Dashboard</h1>
                <p className="text-gray-400 text-sm">
                  Welcome, {clientSession.name}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Account Info */}
        <div className="bg-gray-800/80 rounded-2xl border border-gray-700/20 p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Account Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Name:</span>
              <span className="text-white ml-2">{clientSession.name}</span>
            </div>
            <div>
              <span className="text-gray-400">Email:</span>
              <span className="text-white ml-2">{clientSession.email}</span>
            </div>
            {clientSession.phone && (
              <div>
                <span className="text-gray-400">Phone:</span>
                <span className="text-white ml-2">{clientSession.phone}</span>
              </div>
            )}
            <div>
              <span className="text-gray-400">Access Level:</span>
              <span className="text-white ml-2">
                {clientSession.canViewAllEvents ? 'All Events' : 'Restricted Events'}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Dashboards:</span>
              <span className="text-white ml-2">{accessibleDashboards.length} authorized</span>
            </div>
          </div>
        </div>

        {/* Available Dashboards */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-6">Your Authorized Dashboards</h2>
          
          {accessibleDashboards.length === 0 ? (
            <div className="bg-gray-800/80 rounded-2xl border border-gray-700/20 p-8 text-center">
              <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🚫</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No Dashboard Access</h3>
              <p className="text-gray-400">
                You don't have access to any dashboards yet. Please contact the administrator.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {accessibleDashboards.map((dashboard) => (
                <Link
                  key={dashboard.id}
                  href={dashboard.path}
                  className="group bg-gray-800/80 rounded-2xl border border-gray-700/20 p-6 hover:border-gray-600/40 transition-all duration-200 hover:scale-105"
                >
                  <div className="flex items-center space-x-4 mb-4">
                    <div className={`w-12 h-12 bg-gradient-to-r ${dashboard.color} rounded-full flex items-center justify-center`}>
                      <span className="text-xl">{dashboard.icon}</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors">
                        {dashboard.name}
                      </h3>
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {dashboard.description}
                  </p>
                  <div className="mt-4 flex items-center text-purple-400 text-sm">
                    <span>Access Dashboard</span>
                    <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Access Restrictions */}
        {!clientSession.canViewAllEvents && clientSession.allowedEventIds.length > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-yellow-300 mb-2">Access Restrictions</h3>
            <p className="text-yellow-200 text-sm">
              Your access is limited to specific events. You can view {clientSession.allowedEventIds.length} authorized event(s).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
