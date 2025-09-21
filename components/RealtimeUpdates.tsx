'use client';

import { useEffect, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';

interface RealtimeUpdatesProps {
  eventId: string;
  onPerformanceReorder?: (performances: any[]) => void;
  onPerformanceStatus?: (data: any) => void;
  onEventControl?: (data: any) => void;
  onPresenceUpdate?: (data: any) => void;
  children?: React.ReactNode;
}

export default function RealtimeUpdates({
  eventId,
  onPerformanceReorder,
  onPerformanceStatus,
  onEventControl,
  onPresenceUpdate,
  children
}: RealtimeUpdatesProps) {
  const [notifications, setNotifications] = useState<string[]>([]);

  // Join event room and wire listeners using the unified socket hook
  const socket = useSocket({ eventId, role: 'general' });

  useEffect(() => {
    if (!socket.connected) return;

    const handleReorder = (data: any) => {
      if (data.eventId === eventId && onPerformanceReorder) {
        onPerformanceReorder(data.performances);
        addNotification('🔄 Performance order updated');
      }
    };

    const handleStatus = (data: any) => {
      if (data.eventId === eventId && onPerformanceStatus) {
        onPerformanceStatus(data);
        addNotification(`📊 Performance status: ${data.status}`);
      }
    };

    const handleEventControl = (data: any) => {
      if (data.eventId === eventId && onEventControl) {
        onEventControl(data);
        addNotification(`🎯 Event ${data.action}ed`);
      }
    };

    const handleNotification = (data: any) => {
      if (!data.eventId || data.eventId === eventId) {
        addNotification(data.message);
      }
    };

    const handlePresence = (data: any) => {
      if (data.eventId === eventId && onPresenceUpdate) {
        onPresenceUpdate(data);
        addNotification(`👥 Presence: ${data.present ? 'Present' : 'Absent'}`);
      }
    };

    socket.on('performance:reorder' as any, handleReorder as any);
    socket.on('performance:status' as any, handleStatus as any);
    socket.on('event:control' as any, handleEventControl as any);
    socket.on('notification' as any, handleNotification as any);
    socket.on('presence:update' as any, handlePresence as any);

    return () => {
      socket.off('performance:reorder' as any, handleReorder as any);
      socket.off('performance:status' as any, handleStatus as any);
      socket.off('event:control' as any, handleEventControl as any);
      socket.off('notification' as any, handleNotification as any);
      socket.off('presence:update' as any, handlePresence as any);
    };
  }, [socket.connected, eventId, onPerformanceReorder, onPerformanceStatus, onEventControl, onPresenceUpdate]);

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
