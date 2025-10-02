'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
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

interface Performance {
  id: string;
  title: string;
  contestantName: string;
  participantNames: string[];
  duration: number;
  itemNumber?: number; // Permanent item number (locked after assignment)
  performanceOrder?: number; // Current position in backstage sequence
  status: 'scheduled' | 'ready' | 'hold' | 'in_progress' | 'completed' | 'cancelled';
  entryType?: 'live' | 'virtual';
  musicFileUrl?: string;
  videoExternalUrl?: string;
  musicCue?: 'onstage' | 'offstage';
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
  onUpdateMusicCue,
  selectedForMove,
  movePerformanceUp,
  movePerformanceDown,
  setSelectedForMove,
  performances
}: { 
  performance: Performance; 
  updatePerformanceStatus: (id: string, status: Performance['status']) => void;
  onUpdateMusicCue: (id: string, cue: 'onstage' | 'offstage') => void;
  selectedForMove: string | null;
  movePerformanceUp: (id: string) => void;
  movePerformanceDown: (id: string) => void;
  setSelectedForMove: (id: string | null) => void;
  performances: Performance[];
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
      {...listeners}
      className={`relative rounded-xl border-2 transition-all duration-150 select-none cursor-grab active:cursor-grabbing
        ${isDragging ? 'z-50 shadow-2xl scale-105' : ''}
        ${performance.status === 'completed' ? 'bg-green-700 border-green-500' 
        : performance.status === 'in_progress' ? 'bg-blue-700 border-blue-500'
        : 'bg-gray-700 border-gray-600'}
        ${selectedForMove === performance.id ? 'ring-4 ring-yellow-400' : ''}
      `}
    >
      
      {/* Mobile/Desktop responsive content */}
      <div className="p-3 md:p-4">
        {/* Mobile Layout */}
        <div className="md:hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              {/* Compact item number */}
              <div className={`w-16 h-16 rounded-lg flex flex-col items-center justify-center font-bold border-2 ${
                performance.status === 'completed' ? 'bg-green-500 border-green-400 text-white'
                : performance.status === 'in_progress' ? 'bg-blue-500 border-blue-400 text-white'
                : 'bg-purple-500 border-purple-400 text-white'
              }`}>
                <div className="text-sm leading-none">#{performance.itemNumber || '?'}</div>
                <div className="text-xs opacity-75 leading-none">P{performance.performanceOrder || '?'}</div>
              </div>
              
              {/* Mobile select button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedForMove(selectedForMove === performance.id ? null : performance.id);
                }}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  selectedForMove === performance.id 
                    ? 'bg-yellow-400 text-white' 
                    : 'bg-gray-600 text-white hover:bg-gray-9000'
                }`}
              >
                {selectedForMove === performance.id ? 'Selected' : 'Select'}
              </button>
            </div>

            {/* Mobile reorder buttons */}
            {selectedForMove === performance.id && (
              <div className="flex space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    movePerformanceUp(performance.id);
                  }}
                  disabled={performances.findIndex(p => p.id === performance.id) === 0}
                  className="w-10 h-10 rounded-lg bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  ↑
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    movePerformanceDown(performance.id);
                  }}
                  disabled={performances.findIndex(p => p.id === performance.id) === performances.length - 1}
                  className="w-10 h-10 rounded-lg bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  ↓
                </button>
              </div>
            )}
          </div>

          {/* Mobile title and info */}
          <div className="mb-3">
            <h3 className="font-semibold text-lg text-white leading-tight truncate">{performance.title}</h3>
            <p className="text-sm text-gray-300 truncate">by {performance.contestantName}</p>
            <p className="text-xs text-gray-400 truncate">{performance.participantNames.join(', ')}</p>
          </div>

          {/* Mobile action buttons */}
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onUpdateMusicCue(performance.id, performance.musicCue === 'onstage' ? 'offstage' : 'onstage');
              }}
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                performance.musicCue === 'onstage' ? 'bg-green-600 text-white' : 'bg-gray-600 text-white'
              }`}
            >
              {performance.musicCue === 'onstage' ? 'Onstage' : 'Offstage'}
            </button>

            {/* Mobile Status Controls */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                updatePerformanceStatus(performance.id, 'in_progress');
              }}
              disabled={performance.status === 'in_progress'}
              className={`px-2 py-1 rounded text-sm font-bold ${
                performance.status === 'in_progress' 
                  ? 'bg-blue-600 text-white cursor-not-allowed' 
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
              title="Start"
            >
              ▶️
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                updatePerformanceStatus(performance.id, 'hold');
              }}
              disabled={performance.status !== 'in_progress'}
              className={`px-2 py-1 rounded text-sm font-bold ${
                performance.status !== 'in_progress'
                  ? 'bg-gray-600 text-gray-600 cursor-not-allowed'
                  : 'bg-yellow-500 hover:bg-yellow-600 text-white'
              }`}
              title="Pause"
            >
              ⏸️
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                updatePerformanceStatus(performance.id, 'completed');
              }}
              disabled={performance.status === 'completed'}
              className={`px-2 py-1 rounded text-sm font-bold ${
                performance.status === 'completed'
                  ? 'bg-green-600 text-white cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
              title="Complete"
            >
              ✅
            </button>

            <span className={`px-3 py-1 rounded-lg text-sm ${
              performance.status === 'completed' ? 'bg-green-600 text-white'
              : performance.status === 'in_progress' ? 'bg-blue-600 text-white'
              : performance.status === 'hold' ? 'bg-yellow-600 text-white'
              : 'bg-gray-600 text-white'
            }`}>
              {performance.status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:flex justify-between items-center">
          <div className="flex items-center space-x-4">
            {/* Desktop drag handle */}
            <button
              aria-label="Drag to reorder"
              {...listeners}
              className="hidden md:flex w-10 h-20 rounded-lg bg-gray-600 text-white flex-col items-center justify-center active:cursor-grabbing cursor-grab select-none"
            >
              <span className="text-lg leading-none">⋮</span>
              <span className="text-lg leading-none -mt-1">⋮</span>
            </button>
            {/* Item Number + Performance Order Display */}
            <div className={`relative ${isDragging ? 'animate-pulse' : ''}`}>
              <div className={`w-20 h-20 rounded-xl flex flex-col items-center justify-center font-bold border-4 transition-all duration-150 ${
                isDragging 
                  ? 'bg-yellow-400 border-yellow-300 text-white scale-110' 
                  : performance.status === 'completed'
                  ? 'bg-green-500 border-green-400 text-white'
                  : performance.status === 'in_progress'
                  ? 'bg-blue-500 border-blue-400 text-white'
                  : 'bg-purple-500 border-purple-400 text-white'
              }`}>
                <div className="text-lg leading-none">#{performance.itemNumber || '?'}</div>
                <div className="text-xs opacity-75 leading-none mt-1">
                  Pos: {performance.performanceOrder || '?'}
                </div>
              </div>
              {isDragging && (
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-300 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-white">📌</span>
                </div>
              )}
            </div>
            
            <div className={isDragging ? 'opacity-75' : ''}>
              <h3 className="font-semibold text-lg text-white leading-tight">{performance.title}</h3>
              <p className={`text-sm ${isDragging ? 'text-gray-200' : 'text-gray-300'} mt-1`}>
                by {performance.contestantName} | {performance.entryType?.toUpperCase()}
              </p>
              <p className={`text-xs ${isDragging ? 'text-gray-300' : 'text-gray-400'}`}>
                {performance.participantNames.join(', ')}
              </p>
            </div>
          </div>

          {/* Desktop controls */}
          <div className="flex items-center space-x-2">
            {/* Desktop select + arrow controls (unified with mobile) */}
            <button
              onClick={() => setSelectedForMove(selectedForMove === performance.id ? null : performance.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedForMove === performance.id 
                  ? 'bg-yellow-400 text-white' 
                  : 'bg-gray-600 text-white hover:bg-gray-9000'
              }`}
            >
              {selectedForMove === performance.id ? 'Selected' : 'Select'}
            </button>
            {selectedForMove === performance.id && (
              <div className="flex space-x-2">
                <button
                  onClick={() => movePerformanceUp(performance.id)}
                  disabled={performances.findIndex(p => p.id === performance.id) === 0}
                  className="w-10 h-10 rounded-lg bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  ↑
                </button>
                <button
                  onClick={() => movePerformanceDown(performance.id)}
                  disabled={performances.findIndex(p => p.id === performance.id) === performances.length - 1}
                  className="w-10 h-10 rounded-lg bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  ↓
                </button>
              </div>
            )}

            {/* On-stage/Off-stage Toggle - Desktop */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onUpdateMusicCue(performance.id, performance.musicCue === 'onstage' ? 'offstage' : 'onstage');
              }}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                performance.musicCue === 'onstage' 
                  ? 'bg-green-600 text-white border-2 border-green-400' 
                  : 'bg-gray-600 text-white border-2 border-gray-500 hover:bg-gray-9000'
              }`}
              title={`Currently ${performance.musicCue || 'offstage'} - Click to toggle`}
            >
              {performance.musicCue === 'onstage' ? '🎭 Onstage' : '📴 Offstage'}
            </button>

            {/* Performance Status Controls */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => updatePerformanceStatus(performance.id, 'in_progress')}
                disabled={performance.status === 'in_progress'}
                className={`px-2 py-1 rounded text-xs font-bold ${
                  performance.status === 'in_progress' 
                    ? 'bg-blue-600 text-white cursor-not-allowed' 
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
                title="Start Performance"
              >
                ▶️
              </button>
              <button
                onClick={() => updatePerformanceStatus(performance.id, 'hold')}
                disabled={performance.status !== 'in_progress'}
                className={`px-2 py-1 rounded text-xs font-bold ${
                  performance.status !== 'in_progress'
                    ? 'bg-gray-600 text-gray-600 cursor-not-allowed'
                    : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                }`}
                title="Pause Performance"
              >
                ⏸️
              </button>
              <button
                onClick={() => updatePerformanceStatus(performance.id, 'completed')}
                disabled={performance.status === 'completed'}
                className={`px-2 py-1 rounded text-xs font-bold ${
                  performance.status === 'completed'
                    ? 'bg-green-600 text-white cursor-not-allowed'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
                title="Complete Performance"
              >
                ✅
              </button>
            </div>

            {/* Status indicator */}
            <div className={`px-3 py-1 rounded-lg text-xs font-bold border-2 ${
              performance.status === 'completed' ? 'bg-green-600 border-green-400 text-white' :
              performance.status === 'in_progress' ? 'bg-blue-600 border-blue-400 text-white animate-pulse' :
              performance.status === 'hold' ? 'bg-yellow-600 border-yellow-400 text-white' :
              'bg-gray-600 border-gray-400 text-white'
            }`}>
              {performance.status.toUpperCase()}
            </div>

            {/* No drag indicator; selection + arrows used on all devices */}
          </div>
        </div>
      </div>
      
      {/* Drag instruction overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-purple-500/20 rounded-lg flex items-center justify-center">
          <div className="bg-yellow-400 text-white px-4 py-2 rounded-lg font-bold text-sm">
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
  
  // No music player needed on Backstage - that's for Sound Tech dashboard
  // Mobile Reordering State
  const [selectedForMove, setSelectedForMove] = useState<string | null>(null);

  // Socket connection for real-time updates
  const socket = useBackstageSocket(eventId);

  // @dnd-kit sensors for drag interactions - iPad-optimized touch handling
  const sensors = useSensors(
    // Mouse/Desktop sensor with minimal activation distance
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Slightly higher to prevent accidental drags on iPad
      },
    }),
    // Touch sensor specifically tuned for iPad drag & drop
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100, // iPad needs slightly more delay to distinguish tap vs drag
        tolerance: 15, // Higher tolerance for finger size on iPad
      },
    }),
    // Keyboard accessibility
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

  const [searchTerm, setSearchTerm] = useState('');

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
        // Filter live only for backstage
        const liveOnly = performancesData.performances.filter((p: Performance) => (p.entryType || 'live') === 'live');
        // Sort by performanceOrder first, then by item number for initial display
        const sortedPerformances = liveOnly.sort((a: Performance, b: Performance) => {
          // If both have performanceOrder, use that
          if (a.performanceOrder && b.performanceOrder) {
            return a.performanceOrder - b.performanceOrder;
          }
          // Fall back to item number ordering
          if (a.itemNumber && b.itemNumber) {
            return a.itemNumber - b.itemNumber;
          } else if (a.itemNumber && !b.itemNumber) {
            return -1;
          } else if (!a.itemNumber && b.itemNumber) {
            return 1;
          }
          return a.title.localeCompare(b.title);
        });
        
        // Set initial performanceOrder if not already set
        const performancesWithOrder = sortedPerformances.map((performance: Performance, index: number) => ({
          ...performance,
          performanceOrder: performance.performanceOrder || (index + 1)
        }));
        
        setPerformances(performancesWithOrder);
      }
    } catch (error) {
      console.error('Error loading event data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateMusicCue = async (performanceId: string, cue: 'onstage' | 'offstage') => {
    try {
      const res = await fetch(`/api/performances/${performanceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ musicCue: cue })
      });
      if (res.ok) {
        setPerformances(prev => prev.map(p => p.id === performanceId ? { ...p, musicCue: cue } : p));
        // Broadcast to other dashboards
        socket.emit('performance:music_cue', {
          eventId,
          performanceId,
          musicCue: cue,
          timestamp: new Date().toISOString()
        });
        success(`Music cue set to ${cue}`);
      } else {
        error('Failed to update music cue');
      }
    } catch (e) {
      console.error('Error updating music cue:', e);
      error('Failed to update music cue');
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
    
    // GABRIEL'S REQUIREMENT: Lock item numbers, only update performance order
    const updatedPerformances = reorderedPerformances.map((performance, index) => ({
      ...performance,
      // itemNumber stays UNCHANGED - locked for judges
      performanceOrder: index + 1  // Only update the performance sequence
    }));

    // Update local state immediately for instant visual feedback
    setPerformances(updatedPerformances);

    // Show immediate feedback - Gabriel's requirement
    const oldOrder = oldIndex + 1;
    const newOrder = newIndex + 1;
    
    success(`🎯 Moved Item #${draggedPerformance.itemNumber} from position ${oldOrder} → position ${newOrder}`);

    try {
      // Send reorder to server
      const response = await fetch('/api/admin/reorder-performances', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          performances: updatedPerformances.map(p => ({
            id: p.id,
            itemNumber: p.itemNumber, // Keep original item number (locked)
            performanceOrder: p.performanceOrder // Send new performance order
          }))
        })
      });

      if (response.ok) {
        // Broadcast reorder to all connected clients
        socket.emit('performance:reorder', {
          eventId,
          performances: updatedPerformances.map(p => ({
            id: p.id,
            itemNumber: p.itemNumber!, // Keep permanent item number (locked)
            performanceOrder: p.performanceOrder!, // Send new performance order
            displayOrder: p.performanceOrder! // For backward compatibility with existing handlers
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

  const visiblePerformances = performances.filter(p => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.contestantName.toLowerCase().includes(q) ||
      p.participantNames.some(name => name.toLowerCase().includes(q)) ||
      (p.itemNumber && p.itemNumber.toString().includes(searchTerm))
    );
  });

  const updatePerformanceStatus = async (performanceId: string, status: Performance['status']) => {
    // Backstage "Complete" is local only - doesn't update server or broadcast
    if (status === 'completed') {
      // Update local state only for backstage view
      setPerformances(prev => 
        prev.map(p => 
          p.id === performanceId ? { ...p, status } : p
        )
      );
      success('Performance marked as complete (backstage view only)');
      return;
    }

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

  // Music player functions removed - Backstage doesn't need to play music/videos

  // Mobile reordering functions
  const movePerformanceUp = async (performanceId: string) => {
    const currentIndex = performances.findIndex(p => p.id === performanceId);
    if (currentIndex <= 0) return;
    
    const newPerformances = [...performances];
    [newPerformances[currentIndex - 1], newPerformances[currentIndex]] = 
    [newPerformances[currentIndex], newPerformances[currentIndex - 1]];
    
    await updatePerformanceOrder(newPerformances);
  };

  const movePerformanceDown = async (performanceId: string) => {
    const currentIndex = performances.findIndex(p => p.id === performanceId);
    if (currentIndex >= performances.length - 1) return;
    
    const newPerformances = [...performances];
    [newPerformances[currentIndex], newPerformances[currentIndex + 1]] = 
    [newPerformances[currentIndex + 1], newPerformances[currentIndex]];
    
    await updatePerformanceOrder(newPerformances);
  };

  const updatePerformanceOrder = async (reorderedPerformances: Performance[]) => {
    // Update performance order only (Gabriel's requirement)
    const updatedPerformances = reorderedPerformances.map((performance, index) => ({
      ...performance,
      performanceOrder: index + 1
    }));

    setPerformances(updatedPerformances);

    try {
      const response = await fetch('/api/admin/reorder-performances', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          performances: updatedPerformances.map(p => ({
            id: p.id,
            itemNumber: p.itemNumber,
            performanceOrder: p.performanceOrder
          }))
        })
      });

      if (response.ok) {
        socket.emit('performance:reorder', {
          eventId,
          performances: updatedPerformances.map(p => ({
            id: p.id,
            itemNumber: p.itemNumber!,
            performanceOrder: p.performanceOrder!,
            displayOrder: p.performanceOrder!
          }))
        });
        success('Order updated');
      }
    } catch (err) {
      console.error('Error updating order:', err);
      error('Failed to update order');
    }
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
              <span className="md:hidden">Drag anywhere on a card to reorder, or use Select + ↑↓ buttons</span><span className="hidden md:inline">Drag anywhere on a card to reorder</span>. Item numbers stay locked, only performance order changes!
            </p>
          </div>
          <div className="text-right">
            <div className="text-gray-400 text-sm">
              {performances.length} performances | Socket: {socket.connected ? '🟢 Connected' : '🔴 Disconnected'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
            <div className="mt-3">
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by title, studio, dancer, or item #"
                className="px-3 py-2 rounded bg-gray-700 border border-gray-600 placeholder-gray-400 text-white w-72"
              />
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
              <li>3. Drag anywhere on a card to reorder them</li>
              <li>4. Watch performance order update in real-time (item numbers stay locked)!</li>
            </ol>
          </div>
        )}

        {performances.length > 0 && (
          <div className="bg-purple-600/10 border border-purple-600/50 rounded-lg p-4 mb-6">
            <p className="text-purple-300 text-sm">
              <span className="font-semibold">💡 How to use:</span> Drag anywhere on a performance card to reorder (works on iPad, mouse, touch). Select + ↑↓ buttons also available. 
              Item numbers stay locked (for judges), only the performance order changes and syncs across dashboards!
            </p>
            <p className="text-purple-300 text-sm mt-2">
              <span className="font-semibold">🎭 Backstage Control:</span> Use On-stage/Off-stage toggles and status buttons (▶️ Start, ⏸️ Pause, ✅ Complete) to manage performances.
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
              {visiblePerformances.map((performance) => (
                <SortablePerformanceItem
                  key={performance.id}
                  performance={performance}
                  updatePerformanceStatus={updatePerformanceStatus}
                  onUpdateMusicCue={updateMusicCue}
                  selectedForMove={selectedForMove}
                  movePerformanceUp={movePerformanceUp}
                  movePerformanceDown={movePerformanceDown}
                  setSelectedForMove={setSelectedForMove}
                  performances={performances}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Music player removed - not needed on Backstage dashboard */}
    </div>
  );
}
