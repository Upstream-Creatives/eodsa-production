'use client';

import { useEffect, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';

interface RealtimeUpdatesProps {
  eventId: string;
  role?: 'judge' | 'sound' | 'backstage' | 'announcer' | 'registration' | 'media' | 'general';
  strictEvent?: boolean; // if true, ignore events from other eventIds even during initial load
  onPerformanceReorder?: (performances: any[]) => void;
  onPerformanceStatus?: (data: any) => void;
  onPerformanceAnnounced?: (data: any) => void;
  onPerformanceMusicCue?: (data: { performanceId: string; musicCue: 'onstage' | 'offstage'; eventId?: string }) => void;
  onEventControl?: (data: any) => void;
  onPresenceUpdate?: (data: any) => void;
  onMusicUpdated?: (data: { entryId: string; musicFileUrl?: string; musicFileName?: string; eventId?: string }) => void;
  onVideoUpdated?: (data: { entryId: string; videoExternalUrl?: string; eventId?: string }) => void;
  children?: React.ReactNode;
}

export default function RealtimeUpdates({
  eventId,
  role = 'general',
  strictEvent = false,
  onPerformanceReorder,
  onPerformanceStatus,
  onPerformanceAnnounced,
  onPerformanceMusicCue,
  onEventControl,
  onPresenceUpdate,
  onMusicUpdated,
  onVideoUpdated,
  children
}: RealtimeUpdatesProps) {
  const [notifications, setNotifications] = useState<string[]>([]);

  // Join event room and wire listeners using the unified socket hook
  const socket = useSocket({ eventId, role });

  useEffect(() => {
    if (!socket.connected) return;

    // If strictEvent is true but eventId is empty (e.g., "All"), treat as wildcard
    const withinScope = (data: any) => (!strictEvent || !eventId) || (data?.eventId === eventId);

    const handleReorder = (data: any) => {
      if (withinScope(data) && onPerformanceReorder) {
        onPerformanceReorder(data.performances);
        addNotification('🔄 Performance order updated');
      }
    };

    const handleStatus = (data: any) => {
      if (withinScope(data) && onPerformanceStatus) {
        onPerformanceStatus(data);
        addNotification(`📊 Performance status: ${data.status}`);
      }
    };

    const handleAnnounced = (data: any) => {
      if (withinScope(data) && onPerformanceAnnounced) {
        onPerformanceAnnounced(data);
        addNotification(`📢 Performance announced`);
      }
    };

    const handleMusicCue = (data: any) => {
      if (withinScope(data) && onPerformanceMusicCue) {
        onPerformanceMusicCue(data);
        addNotification(`🎵 Music cue: ${data.musicCue}`);
      }
    };

    const handleEventControl = (data: any) => {
      if ((!eventId || data.eventId === eventId) && onEventControl) {
        onEventControl(data);
        addNotification(`🎯 Event ${data.action}ed`);
      }
    };

    const handleNotification = (data: any) => {
      if (!strictEvent && (!data.eventId || !eventId || data.eventId === eventId)) {
        addNotification(data.message);
      }
    };

    const handlePresence = (data: any) => {
      if (withinScope(data) && onPresenceUpdate) {
        onPresenceUpdate(data);
        addNotification(`👥 Presence: ${data.present ? 'Present' : 'Absent'}`);
      }
    };

    const handleMusicUpdated = (data: any) => {
      if ((!eventId || data.eventId === eventId) && onMusicUpdated) {
        onMusicUpdated(data);
        addNotification('🎵 Music file updated');
      }
    };

    const handleVideoUpdated = (data: any) => {
      if ((!eventId || data.eventId === eventId) && onVideoUpdated) {
        onVideoUpdated(data);
        addNotification('📹 Video link updated');
      }
    };

    socket.on('performance:reorder' as any, handleReorder as any);
    socket.on('performance:status' as any, handleStatus as any);
    socket.on('performance:announced' as any, handleAnnounced as any);
    socket.on('performance:music_cue' as any, handleMusicCue as any);
    socket.on('event:control' as any, handleEventControl as any);
    socket.on('notification' as any, handleNotification as any);
    socket.on('presence:update' as any, handlePresence as any);
    socket.on('entry:music_updated' as any, handleMusicUpdated as any);
    socket.on('entry:video_updated' as any, handleVideoUpdated as any);

    return () => {
      socket.off('performance:reorder' as any, handleReorder as any);
      socket.off('performance:status' as any, handleStatus as any);
      socket.off('performance:announced' as any, handleAnnounced as any);
      socket.off('performance:music_cue' as any, handleMusicCue as any);
      socket.off('event:control' as any, handleEventControl as any);
      socket.off('notification' as any, handleNotification as any);
      socket.off('presence:update' as any, handlePresence as any);
      socket.off('entry:music_updated' as any, handleMusicUpdated as any);
      socket.off('entry:video_updated' as any, handleVideoUpdated as any);
    };
  }, [socket.connected, eventId, onPerformanceReorder, onPerformanceStatus, onPerformanceAnnounced, onEventControl, onPresenceUpdate]);

  // Heartbeat quick sync: every 15s and on window focus, trigger a lightweight refresh via custom event
  useEffect(() => {
    const heartbeat = setInterval(() => {
      try {
        const { socketClient } = require('@/lib/socket-client');
        socketClient.emit('notification' as any, { type: 'info', message: 'heartbeat', eventId });
      } catch {}
    }, 15000);

    const onFocus = () => {
      try {
        const { socketClient } = require('@/lib/socket-client');
        socketClient.emit('notification' as any, { type: 'info', message: 'focus-refresh', eventId });
      } catch {}
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus);
    }
    return () => {
      clearInterval(heartbeat);
      if (typeof window !== 'undefined') window.removeEventListener('focus', onFocus);
    };
  }, [eventId]);

  const addNotification = (message: string) => {
    setNotifications(prev => [...prev.slice(-4), message]); // Keep last 5
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.slice(1));
    }, 5000);
  };

  return (
    <>
      {children}
      
      {/* Notification Toast */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {notifications.map((notification, index) => (
            <div
              key={index}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in"
            >
              {notification}
            </div>
          ))}
        </div>
      )}
      
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
