'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import { useBackstageSocket } from '@/hooks/useSocket';
import { useToast } from '@/components/ui/simple-toast';
import BackstageMusicPlayer from '@/components/BackstageMusicPlayer';

interface Performance {
  id: string;
  title: string;
  contestantName: string;
  participantNames: string[];
  duration: number;
  itemNumber?: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  entryType?: 'live' | 'virtual';
  musicFileUrl?: string;
  videoExternalUrl?: string;
}

interface Event {
  id: string;
  name: string;
  eventDate: string;
  venue: string;
  status: string;
}

// Sortable Item Component for @dnd-kit
function SortablePerformanceItem({ 
  performance, 
  updatePerformanceStatus, 
  onPlayMusic 
}: { 
  performance: Performance; 
  updatePerformanceStatus: (id: string, status: Performance['status']) => void;
  onPlayMusic: (performance: Performance) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: performance.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`p-4 rounded-lg border-2 transition-all duration-200 ${
        isDragging
          ? 'bg-purple-600 border-purple-400 shadow-2xl scale-105 rotate-2'
          : performance.status === 'completed'
          ? 'bg-green-700 border-green-500'
          : performance.status === 'in_progress'
          ? 'bg-blue-700 border-blue-500'
          : 'bg-gray-700 border-gray-600'
      }`}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          {/* Enhanced Item Number Display */}
          <div className={`relative ${isDragging ? 'animate-pulse' : ''}`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl border-4 transition-all duration-200 ${
              isDragging 
                ? 'bg-yellow-400 border-yellow-300 text-black scale-110' 
                : performance.status === 'completed'
                ? 'bg-green-500 border-green-400 text-white'
                : performance.status === 'in_progress'
                ? 'bg-blue-500 border-blue-400 text-white'
                : 'bg-purple-500 border-purple-400 text-white'
            }`}>
              {performance.itemNumber || '?'}
            </div>
            {isDragging && (
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-300 rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-black">📌</span>
              </div>
            )}
          </div>
          
          <div className={isDragging ? 'opacity-75' : ''}>
            <h3 className="font-semibold text-lg text-white">{performance.title}</h3>
            <p className={`text-sm ${isDragging ? 'text-gray-200' : 'text-gray-300'}`}>
              by {performance.contestantName} | {performance.duration}min | {performance.entryType?.toUpperCase()}
            </p>
            <p className={`text-xs ${isDragging ? 'text-gray-300' : 'text-gray-400'}`}>
              {performance.participantNames.join(', ')}
            </p>
          </div>
        </div>

        <div className={`flex items-center space-x-2 ${isDragging ? 'opacity-50' : ''}`}>
          {/* Music/Video Play Button */}
          {!isDragging && (
            <button
              onClick={() => onPlayMusic(performance)}
              className={`p-3 rounded-lg transition-all duration-200 border-2 ${
                performance.entryType === 'live' && performance.musicFileUrl
                  ? 'bg-green-600 hover:bg-green-700 border-green-400 text-white'
                  : performance.entryType === 'virtual' && performance.videoExternalUrl
                  ? 'bg-blue-600 hover:bg-blue-700 border-blue-400 text-white'
                  : 'bg-gray-600 border-gray-500 text-gray-300 opacity-50 cursor-not-allowed'
              }`}
              disabled={!performance.musicFileUrl && !performance.videoExternalUrl}
              title={
                performance.entryType === 'live' && performance.musicFileUrl
                  ? 'Play music'
                  : performance.entryType === 'virtual' && performance.videoExternalUrl
                  ? 'Open video'
                  : 'No media available'
              }
            >
              <span className="text-lg">
                {performance.entryType === 'live' ? '🎵' : performance.entryType === 'virtual' ? '📹' : '🚫'}
              </span>
            </button>
          )}

          {/* Status buttons with full lifecycle control */}
          {performance.status === 'scheduled' && !isDragging && (
            <button
              onClick={() => updatePerformanceStatus(performance.id, 'in_progress')}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded font-semibold transition-colors"
            >
              ▶️ Start
            </button>
          )}
          
          {performance.status === 'in_progress' && !isDragging && (
            <>
              <button
                onClick={() => updatePerformanceStatus(performance.id, 'completed')}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded font-semibold transition-colors"
              >
                ✅ Complete
              </button>
              <button
                onClick={() => updatePerformanceStatus(performance.id, 'scheduled')}
                className="px-2 py-1 bg-orange-600 hover:bg-orange-700 rounded text-xs font-semibold transition-colors"
                title="Reset to scheduled"
              >
                ↩️ Reset
              </button>
            </>
          )}

          {performance.status === 'completed' && !isDragging && (
            <>
              <button
                onClick={() => updatePerformanceStatus(performance.id, 'in_progress')}
                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-semibold transition-colors"
                title="Mark as in progress"
              >
                ◀️ In Progress
              </button>
              <button
                onClick={() => updatePerformanceStatus(performance.id, 'scheduled')}
                className="px-2 py-1 bg-orange-600 hover:bg-orange-700 rounded text-xs font-semibold transition-colors"
                title="Reset to scheduled"
              >
                ↩️ Reset
              </button>
            </>
          )}

          {/* Enhanced Status indicator */}
          <div className={`px-3 py-1 rounded-lg text-xs font-bold border-2 ${
            performance.status === 'completed' ? 'bg-green-600 border-green-400 text-white' :
            performance.status === 'in_progress' ? 'bg-blue-600 border-blue-400 text-white animate-pulse' :
            performance.status === 'cancelled' ? 'bg-red-600 border-red-400 text-white' :
            'bg-gray-600 border-gray-400 text-white'
          }`}>
            {performance.status.toUpperCase()}
          </div>

          {/* Enhanced Drag handle */}
          <div 
            {...listeners} 
            className={`text-gray-300 cursor-grab active:cursor-grabbing p-3 rounded-lg transition-all duration-200 ${
              isDragging 
                ? 'bg-yellow-400 text-black scale-110' 
                : 'hover:bg-gray-600 hover:text-white'
            }`}
            title="Drag to reorder"
          >
            <div className="text-lg">⋮⋮</div>
          </div>
        </div>
      </div>
      
      {/* Drag instruction overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-purple-500/20 rounded-lg flex items-center justify-center">
          <div className="bg-yellow-400 text-black px-4 py-2 rounded-lg font-bold text-sm">
            🎯 REORDERING ITEM #{performance.itemNumber}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BackstageDashboard() {
  const params = useParams();
  const router = useRouter();
  const { success, error } = useToast();
  const eventId = params?.id as string;
  
  const [event, setEvent] = useState<Event | null>(null);
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPerformance, setCurrentPerformance] = useState<Performance | null>(null);
  const [eventStatus, setEventStatus] = useState<'waiting' | 'active' | 'paused' | 'completed'>('waiting');
  
  // Music Player State
  const [musicPlayerOpen, setMusicPlayerOpen] = useState(false);
  const [selectedPerformance, setSelectedPerformance] = useState<Performance | null>(null);

  // Socket connection for real-time updates
  const socket = useBackstageSocket(eventId);

  // @dnd-kit sensors for drag interactions
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    // Check admin authentication
    const session = localStorage.getItem('adminSession');
    if (!session) {
      router.push('/portal/admin');
      return;
    }

    if (eventId) {
      loadEventData();
    }
  }, [eventId, router]);

  // Set up socket listeners
  useEffect(() => {
    if (!socket.connected) return;

    // Listen for real-time updates from other interfaces
    socket.on('performance:status', (data) => {
      setPerformances(prev => 
        prev.map(p => 
          p.id === data.performanceId 
            ? { ...p, status: data.status }
            : p
        )
      );
    });

    socket.on('entry:created', (data) => {
      if (data.eventId === eventId) {
        loadEventData(); // Refresh performances list
      }
    });

    socket.on('entry:updated', (data) => {
      if (data.eventId === eventId) {
        loadEventData(); // Refresh to show updates
      }
    });

    return () => {
      socket.off('performance:status');
      socket.off('entry:created');
      socket.off('entry:updated');
    };
  }, [socket.connected, eventId]);

  const loadEventData = async () => {
    setIsLoading(true);
    try {
      // Load event details
      const eventRes = await fetch(`/api/events/${eventId}`);
      const eventData = await eventRes.json();
      
      if (eventData.success) {
        setEvent(eventData.event);
      }

      // Load performances for this event
      const performancesRes = await fetch(`/api/events/${eventId}/performances`);
      const performancesData = await performancesRes.json();
      
      if (performancesData.success) {
        // Sort by item number, then by creation time
        const sortedPerformances = performancesData.performances.sort((a: Performance, b: Performance) => {
          if (a.itemNumber && b.itemNumber) {
            return a.itemNumber - b.itemNumber;
          } else if (a.itemNumber && !b.itemNumber) {
            return -1;
          } else if (!a.itemNumber && b.itemNumber) {
            return 1;
          }
          return a.title.localeCompare(b.title);
        });
        
        setPerformances(sortedPerformances);
      }
    } catch (error) {
      console.error('Error loading event data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;

    const oldIndex = performances.findIndex(p => p.id === active.id);
    const newIndex = performances.findIndex(p => p.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const draggedPerformance = performances[oldIndex];
    const targetPerformance = performances[newIndex];

    console.log(`🎭 REORDERING: Moving "${draggedPerformance.title}" from position ${oldIndex + 1} to ${newIndex + 1}`);

    // Reorder performances array
    const reorderedPerformances = arrayMove(performances, oldIndex, newIndex);
    
    // Update item numbers based on new order (THIS HAPPENS IMMEDIATELY)
    const updatedPerformances = reorderedPerformances.map((performance, index) => ({
      ...performance,
      itemNumber: index + 1  // Item numbers are 1-based
    }));

    // Update local state immediately for instant visual feedback
    setPerformances(updatedPerformances);

    // Show immediate feedback
    const oldItemNumber = draggedPerformance.itemNumber || oldIndex + 1;
    const newItemNumber = newIndex + 1;
    
    success(`🎯 Moved "${draggedPerformance.title}" from #${oldItemNumber} → #${newItemNumber}`);

    try {
      // Send reorder to server
      const response = await fetch('/api/admin/reorder-performances', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          performances: updatedPerformances.map(p => ({
            id: p.id,
            itemNumber: p.itemNumber,
            displayOrder: p.itemNumber
          }))
        })
      });

      if (response.ok) {
        // Broadcast reorder to all connected clients
        socket.emit('performance:reorder', {
          eventId,
          performances: updatedPerformances.map(p => ({
            id: p.id,
            itemNumber: p.itemNumber!,
            displayOrder: p.itemNumber!
          }))
        });

        console.log('🔄 Reorder synchronized to all clients');
        
        // Additional success message
        setTimeout(() => {
          success('✅ Order synchronized across all dashboards!');
        }, 1000);
      } else {
        // Revert on error
        loadEventData();
        error('❌ Failed to save new order - reverted to original');
      }
    } catch (err) {
      console.error('Error reordering performances:', err);
      loadEventData();
      error('❌ Network error - reverted to original order');
    }
  };

  const updatePerformanceStatus = async (performanceId: string, status: Performance['status']) => {
    try {
      const response = await fetch(`/api/performances/${performanceId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      if (response.ok) {
        // Update local state
        setPerformances(prev => 
          prev.map(p => 
            p.id === performanceId ? { ...p, status } : p
          )
        );

        // Broadcast status change
        socket.emit('performance:status', {
          performanceId,
          eventId,
          status,
          timestamp: new Date().toISOString()
        });

        // Update current performance if needed
        if (status === 'in_progress') {
          const performance = performances.find(p => p.id === performanceId);
          setCurrentPerformance(performance || null);
        }

        success(`Performance marked as ${status}`);
      } else {
        error('Failed to update performance status');
      }
    } catch (err) {
      console.error('Error updating performance status:', err);
      error('Failed to update performance status');
    }
  };

  const controlEvent = (action: 'start' | 'pause' | 'resume' | 'reset') => {
    socket.emit('event:control', {
      eventId,
      action,
      currentItem: currentPerformance?.itemNumber
    });

    // Update local event status
    switch (action) {
      case 'start':
      case 'resume':
        setEventStatus('active');
        break;
      case 'pause':
        setEventStatus('paused');
        break;
      case 'reset':
        setEventStatus('waiting');
        setCurrentPerformance(null);
        break;
    }

    success(`Event ${action}ed`);
  };

  const handlePlayMusic = (performance: Performance) => {
    setSelectedPerformance(performance);
    setMusicPlayerOpen(true);
    
    // Log the media access for debugging
    console.log('🎵 Opening music player for:', {
      title: performance.title,
      entryType: performance.entryType,
      hasMusic: !!performance.musicFileUrl,
      hasVideo: !!performance.videoExternalUrl
    });
  };

  const closeMusicPlayer = () => {
    setMusicPlayerOpen(false);
    setSelectedPerformance(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading backstage dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-purple-400">🎭 Backstage Control</h1>
            <p className="text-gray-300 mt-1">
              {event?.name} | {event?.eventDate} | {event?.venue}
            </p>
          </div>
          
          {/* Event Controls */}
          <div className="flex items-center space-x-4">
            <div className={`px-4 py-2 rounded-lg font-semibold ${
              eventStatus === 'active' ? 'bg-green-600' :
              eventStatus === 'paused' ? 'bg-yellow-600' :
              eventStatus === 'completed' ? 'bg-blue-600' :
              'bg-gray-600'
            }`}>
              {eventStatus.toUpperCase()}
            </div>
            
            <div className="flex space-x-2">
              {eventStatus === 'waiting' && (
                <button
                  onClick={() => controlEvent('start')}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold"
                >
                  ▶️ Start Event
                </button>
              )}
              
              {eventStatus === 'active' && (
                <button
                  onClick={() => controlEvent('pause')}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-semibold"
                >
                  ⏸️ Pause
                </button>
              )}
              
              {eventStatus === 'paused' && (
                <button
                  onClick={() => controlEvent('resume')}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold"
                >
                  ▶️ Resume
                </button>
              )}
              
              <button
                onClick={() => controlEvent('reset')}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold"
              >
                🔄 Reset
              </button>
            </div>
          </div>
        </div>

        {/* Current Performance */}
        {currentPerformance && (
          <div className="mt-4 p-4 bg-purple-600 rounded-lg">
            <h3 className="font-semibold">🎯 CURRENT PERFORMANCE</h3>
            <p className="text-lg">
              #{currentPerformance.itemNumber} - {currentPerformance.title} by {currentPerformance.contestantName}
            </p>
          </div>
        )}

        {/* Program Overview */}
        {performances.length > 0 && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-600/20 border border-blue-500 rounded-lg p-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">{performances.length}</div>
                <div className="text-xs text-blue-300">Total Items</div>
              </div>
            </div>
            <div className="bg-green-600/20 border border-green-500 rounded-lg p-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">
                  {performances.filter(p => p.status === 'completed').length}
                </div>
                <div className="text-xs text-green-300">Completed</div>
              </div>
            </div>
            <div className="bg-yellow-600/20 border border-yellow-500 rounded-lg p-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">
                  {performances.filter(p => p.status === 'in_progress').length}
                </div>
                <div className="text-xs text-yellow-300">In Progress</div>
              </div>
            </div>
            <div className="bg-gray-600/20 border border-gray-500 rounded-lg p-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-400">
                  #{performances[0]?.itemNumber || 1} - #{performances[performances.length - 1]?.itemNumber || performances.length}
                </div>
                <div className="text-xs text-gray-300">Item Range</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Performance List */}
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold">Performance Order</h2>
            <p className="text-sm text-gray-400 mt-1">
              Drag the <span className="text-yellow-400">⋮⋮ handle</span> to reorder performances. Item numbers update instantly!
            </p>
          </div>
          <div className="text-right">
            <div className="text-gray-400 text-sm">
              {performances.length} performances | Socket: {socket.connected ? '🟢 Connected' : '🔴 Disconnected'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Quick Test Instructions */}
        {performances.length === 0 && (
          <div className="bg-yellow-600/10 border border-yellow-600/50 rounded-lg p-6 mb-6">
            <h3 className="text-yellow-400 font-semibold mb-2">🧪 Testing Drag & Drop</h3>
            <p className="text-gray-300 text-sm">
              No performances found for this event. To test the drag-and-drop reordering:
            </p>
            <ol className="text-gray-300 text-sm mt-2 space-y-1">
              <li>1. Go to the admin dashboard and create some event entries</li>
              <li>2. Return here to see them listed with item numbers</li>
              <li>3. Drag the ⋮⋮ handle to reorder them</li>
              <li>4. Watch item numbers update in real-time!</li>
            </ol>
          </div>
        )}

        {performances.length > 0 && (
          <div className="bg-purple-600/10 border border-purple-600/50 rounded-lg p-4 mb-6">
            <p className="text-purple-300 text-sm">
              <span className="font-semibold">💡 How to test:</span> Grab any ⋮⋮ handle and drag up/down to reorder. 
              Item numbers will update instantly and sync across all connected dashboards!
            </p>
            <p className="text-purple-300 text-sm mt-2">
              <span className="font-semibold">🎵 Music Player:</span> Click the 🎵 button on live entries to play music, 
              or 📹 button on virtual entries to open video links. Full controls with play/pause/seek/volume!
            </p>
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={performances.map(p => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {performances.map((performance) => (
                <SortablePerformanceItem
                  key={performance.id}
                  performance={performance}
                  updatePerformanceStatus={updatePerformanceStatus}
                  onPlayMusic={handlePlayMusic}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Music Player Modal */}
      <BackstageMusicPlayer
        isOpen={musicPlayerOpen}
        onClose={closeMusicPlayer}
        performance={selectedPerformance}
      />
    </div>
  );
}
