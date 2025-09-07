'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/simple-toast';

export default function BackstageDashboard() {
  const router = useRouter();
  const { success, error } = useToast();
  const [user, setUser] = useState<any>(null);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check authentication
    const session = localStorage.getItem('backstageSession');
    if (!session) {
      router.push('/portal/backstage');
      return;
    }

    try {
      const userData = JSON.parse(session);
      setUser(userData);
      fetchEvents();
    } catch (err) {
      router.push('/portal/backstage');
    }
  }, [router]);

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
    } finally {
      setIsLoading(false);
    }
  };

  const goToBackstageControl = () => {
    if (selectedEvent) {
      router.push(`/admin/backstage/${selectedEvent}`);
    } else {
      error('Please select an event first');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-black">Loading backstage dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">🎭</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-black">Backstage Manager Dashboard</h1>
                <p className="text-black">Welcome, {user?.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  localStorage.removeItem('backstageSession');
                  router.push('/portal/backstage');
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
        {/* Welcome Section */}
        <div className="bg-white rounded-lg shadow p-8 mb-8">
          <h2 className="text-2xl font-semibold text-black mb-4">Backstage Control Center</h2>
          <p className="text-black mb-6">
            As a Backstage Manager, you have full control over the performance order and live event flow. 
            You can drag and drop to reorder performances, control performance status, and manage the 
            running order in real-time.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="font-semibold text-purple-800 mb-2">🎯 Drag & Drop Reordering</h3>
              <p className="text-sm text-purple-700">
                Instantly reorder performances by dragging item numbers. Changes sync across all dashboards.
              </p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-2">📊 Status Control</h3>
              <p className="text-sm text-blue-700">
                Mark performances as "Ready", "In Progress", or "Complete" to keep everyone informed.
              </p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-800 mb-2">🔄 Real-time Sync</h3>
              <p className="text-sm text-green-700">
                All changes update instantly across judge, announcer, registration, and admin views.
              </p>
            </div>
          </div>
        </div>

        {/* Event Selection */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-semibold text-black mb-4">Select Event to Manage</h3>
          
          {events.length > 0 ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-black mb-2">Choose Event</label>
                <select
                  value={selectedEvent}
                  onChange={(e) => setSelectedEvent(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-black"
                >
                  <option value="">Select an event...</option>
                  {events.map(event => (
                    <option key={event.id} value={event.id}>
                      {event.name} - {event.eventDate} ({event.venue})
                    </option>
                  ))}
                </select>
              </div>
              
              {selectedEvent && (
                <div className="pt-4">
                  <button
                    onClick={goToBackstageControl}
                    className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 font-semibold transition-all duration-200 flex items-center justify-center"
                  >
                    <span className="mr-2">🎭</span>
                    Enter Backstage Control
                  </button>
                  <p className="text-sm text-gray-600 mt-2">
                    This will take you to the full backstage control interface with drag & drop functionality.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <span className="text-4xl mb-4 block">📅</span>
              <p className="text-black">No events found</p>
              <p className="text-sm text-gray-600 mt-2">
                Contact an administrator to create events before managing backstage operations.
              </p>
            </div>
          )}
        </div>

        {/* Quick Access Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-purple-600">🎯</span>
              </div>
              <h3 className="font-semibold text-black">Performance Order</h3>
            </div>
            <p className="text-sm text-gray-600">
              Drag and drop to reorder performances in real-time. Item numbers update automatically.
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-blue-600">📊</span>
              </div>
              <h3 className="font-semibold text-black">Status Control</h3>
            </div>
            <p className="text-sm text-gray-600">
              Control the flow with "Ready", "In Progress", and "Complete" status updates.
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-green-600">🎵</span>
              </div>
              <h3 className="font-semibold text-black">Music Player</h3>
            </div>
            <p className="text-sm text-gray-600">
              Preview music files and video links directly from the backstage interface.
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-orange-600">🔄</span>
              </div>
              <h3 className="font-semibold text-black">Live Updates</h3>
            </div>
            <p className="text-sm text-gray-600">
              All changes sync instantly to judges, announcers, registration, and admin dashboards.
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 mt-8">
          <h3 className="text-lg font-semibold text-purple-800 mb-4">Quick Instructions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-purple-700 mb-2">Getting Started:</h4>
              <ol className="text-sm text-purple-600 space-y-1">
                <li>1. Select an event from the dropdown above</li>
                <li>2. Click "Enter Backstage Control" to access the full interface</li>
                <li>3. Use the drag handles (⋮⋮) to reorder performances</li>
                <li>4. Click status buttons to update performance states</li>
              </ol>
            </div>
            <div>
              <h4 className="font-medium text-purple-700 mb-2">Key Features:</h4>
              <ul className="text-sm text-purple-600 space-y-1">
                <li>• Real-time drag & drop reordering</li>
                <li>• Instant status updates across all dashboards</li>
                <li>• Built-in music and video preview</li>
                <li>• Live event flow control</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

