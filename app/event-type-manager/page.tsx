'use client';

import { useState, useEffect } from 'react';

interface EventEntry {
  id: string;
  eventId: string;
  eventName: string;
  eventDate: string;
  contestantName: string;
  itemName: string;
  entryType: 'live' | 'virtual';
  mastery: string;
  itemStyle: string;
  participantIds: string[];
  participantNames?: string[];
  eodsaId: string;
  musicFileUrl?: string;
  videoFileUrl?: string;
  videoExternalUrl?: string;
}

export default function EventTypeManagerPage() {
  const [entries, setEntries] = useState<EventEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<EventEntry[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('all');
  const [selectedEntryType, setSelectedEntryType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [entries, selectedEventId, selectedEntryType, searchQuery]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Load all event entries
      const entriesResponse = await fetch('/api/event-entries');
      const entriesData = await entriesResponse.json();
      
      // Load all events
      const eventsResponse = await fetch('/api/events');
      const eventsData = await eventsResponse.json();
      
      setEntries(entriesData);
      setEvents(eventsData.events || []);
    } catch (error) {
      console.error('Error loading data:', error);
      setErrorMessage('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...entries];

    // Filter by event
    if (selectedEventId !== 'all') {
      filtered = filtered.filter(e => e.eventId === selectedEventId);
    }

    // Filter by entry type
    if (selectedEntryType !== 'all') {
      filtered = filtered.filter(e => e.entryType === selectedEntryType);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.contestantName?.toLowerCase().includes(query) ||
        e.itemName?.toLowerCase().includes(query) ||
        e.eodsaId?.toLowerCase().includes(query)
      );
    }

    setFilteredEntries(filtered);
  };

  const handleUpdateEntryType = async (entryId: string, newType: 'live' | 'virtual') => {
    try {
      setUpdatingIds(prev => new Set(prev).add(entryId));
      setErrorMessage('');
      setSuccessMessage('');

      const response = await fetch(`/api/event-entries/${entryId}/update-type`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entryType: newType
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage(`✅ Entry updated to ${newType.toUpperCase()} successfully!`);
        
        // Update local state
        setEntries(prev => prev.map(e => 
          e.id === entryId ? { ...e, entryType: newType } : e
        ));
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrorMessage(data.error || 'Failed to update entry type');
      }
    } catch (error) {
      console.error('Error updating entry type:', error);
      setErrorMessage('Failed to update entry type');
    } finally {
      setUpdatingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(entryId);
        return newSet;
      });
    }
  };

  const getPerformanceType = (participantIds: string[]) => {
    const count = participantIds?.length || 0;
    if (count === 1) return 'Solo';
    if (count === 2) return 'Duet';
    if (count === 3) return 'Trio';
    if (count >= 4) return 'Group';
    return 'Unknown';
  };

  const stats = {
    total: entries.length,
    live: entries.filter(e => e.entryType === 'live').length,
    virtual: entries.filter(e => e.entryType === 'virtual').length,
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading entries...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Header */}
      <div className="bg-gray-800/80 backdrop-blur-sm border-b border-purple-500/30">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                🎭 Event Type Manager
              </h1>
              <p className="text-gray-300 text-sm mt-1">Karabo's Dashboard - Switch entries between Live and Virtual</p>
            </div>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Success/Error Messages */}
        {successMessage && (
          <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4">
            <p className="text-green-300">{successMessage}</p>
          </div>
        )}
        {errorMessage && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
            <p className="text-red-300">{errorMessage}</p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800/80 rounded-xl border border-purple-500/30 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Entries</p>
                <p className="text-3xl font-bold text-white">{stats.total}</p>
              </div>
              <div className="text-4xl">📋</div>
            </div>
          </div>
          
          <div className="bg-gray-800/80 rounded-xl border border-green-500/30 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Live Entries</p>
                <p className="text-3xl font-bold text-green-400">{stats.live}</p>
              </div>
              <div className="text-4xl">🎤</div>
            </div>
          </div>
          
          <div className="bg-gray-800/80 rounded-xl border border-blue-500/30 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Virtual Entries</p>
                <p className="text-3xl font-bold text-blue-400">{stats.virtual}</p>
              </div>
              <div className="text-4xl">📹</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-800/80 rounded-xl border border-purple-500/30 p-6">
          <h2 className="text-xl font-bold text-white mb-4">🔍 Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Search</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, item, or EODSA ID..."
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Event</label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Events</option>
                {events.map(event => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Entry Type</label>
              <select
                value={selectedEntryType}
                onChange={(e) => setSelectedEntryType(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Types</option>
                <option value="live">Live Only</option>
                <option value="virtual">Virtual Only</option>
              </select>
            </div>
          </div>
          
          <div className="mt-4 text-sm text-gray-400">
            Showing {filteredEntries.length} of {entries.length} entries
          </div>
        </div>

        {/* Entries List */}
        <div className="bg-gray-800/80 rounded-xl border border-purple-500/30 overflow-hidden">
          <div className="p-6 border-b border-purple-500/30">
            <h2 className="text-xl font-bold text-white">📝 Event Entries</h2>
          </div>

          {filteredEntries.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">🔍</div>
              <p className="text-gray-400 text-lg">No entries found</p>
              <p className="text-gray-500 text-sm mt-2">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="divide-y divide-purple-500/20">
              {filteredEntries.map((entry) => {
                const isUpdating = updatingIds.has(entry.id);
                const performanceType = getPerformanceType(entry.participantIds);
                
                return (
                  <div key={entry.id} className="p-6 hover:bg-purple-500/5 transition-colors">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Entry Info */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-lg font-bold text-white">{entry.itemName}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            performanceType === 'Solo' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                            performanceType === 'Duet' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                            performanceType === 'Trio' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                            'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                          }`}>
                            {performanceType}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            entry.entryType === 'live'
                              ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}>
                            {entry.entryType === 'live' ? '🎤 LIVE' : '📹 VIRTUAL'}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          <p className="text-gray-300">
                            Dancer: <span className="text-white font-medium">{entry.contestantName}</span>
                          </p>
                          <p className="text-gray-300">
                            EODSA ID: <span className="text-white font-medium">{entry.eodsaId}</span>
                          </p>
                          <p className="text-gray-300">
                            Event: <span className="text-white font-medium">{entry.eventName}</span>
                          </p>
                          <p className="text-gray-300">
                            Style: <span className="text-white font-medium">{entry.itemStyle}</span>
                          </p>
                          <p className="text-gray-300">
                            Mastery: <span className="text-white font-medium">{entry.mastery}</span>
                          </p>
                          <p className="text-gray-300">
                            Date: <span className="text-white font-medium">{new Date(entry.eventDate).toLocaleDateString()}</span>
                          </p>
                        </div>

                        {/* File Status */}
                        <div className="flex gap-3 text-xs">
                          {entry.entryType === 'live' && (
                            <span className={`px-2 py-1 rounded ${
                              entry.musicFileUrl
                                ? 'bg-green-900/30 text-green-300'
                                : 'bg-yellow-900/30 text-yellow-300'
                            }`}>
                              🎵 Music: {entry.musicFileUrl ? 'Uploaded' : 'Pending'}
                            </span>
                          )}
                          {entry.entryType === 'virtual' && (
                            <span className={`px-2 py-1 rounded ${
                              entry.videoFileUrl || entry.videoExternalUrl
                                ? 'bg-green-900/30 text-green-300'
                                : 'bg-yellow-900/30 text-yellow-300'
                            }`}>
                              📹 Video: {(entry.videoFileUrl || entry.videoExternalUrl) ? 'Uploaded' : 'Pending'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleUpdateEntryType(entry.id, 'live')}
                          disabled={isUpdating || entry.entryType === 'live'}
                          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                            entry.entryType === 'live'
                              ? 'bg-green-600 text-white cursor-not-allowed opacity-50'
                              : 'bg-green-600 text-white hover:bg-green-700'
                          } ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
                        >
                          {isUpdating ? '⏳' : '🎤'} Make Live
                        </button>
                        
                        <button
                          onClick={() => handleUpdateEntryType(entry.id, 'virtual')}
                          disabled={isUpdating || entry.entryType === 'virtual'}
                          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                            entry.entryType === 'virtual'
                              ? 'bg-blue-600 text-white cursor-not-allowed opacity-50'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          } ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
                        >
                          {isUpdating ? '⏳' : '📹'} Make Virtual
                        </button>
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
  );
}

