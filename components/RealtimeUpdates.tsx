'use client';

import { useEffect, useState } from 'react';
import { useSocketEvent } from '@/hooks/useSocket';

interface RealtimeUpdatesProps {
  eventId: string;
  onPerformanceReorder?: (performances: any[]) => void;
  onPerformanceStatus?: (data: any) => void;
  onEventControl?: (data: any) => void;
  children?: React.ReactNode;
}

export default function RealtimeUpdates({
  eventId,
  onPerformanceReorder,
  onPerformanceStatus,
  onEventControl,
  children
}: RealtimeUpdatesProps) {
  const [notifications, setNotifications] = useState<string[]>([]);

  // Listen for performance reordering
  useSocketEvent('performance:reorder', (data) => {
    if (data.eventId === eventId && onPerformanceReorder) {
      onPerformanceReorder(data.performances);
      addNotification('🔄 Performance order updated');
    }
  }, [eventId, onPerformanceReorder]);

  // Listen for status updates
  useSocketEvent('performance:status', (data) => {
    if (data.eventId === eventId && onPerformanceStatus) {
      onPerformanceStatus(data);
      addNotification(`📊 Performance status: ${data.status}`);
    }
  }, [eventId, onPerformanceStatus]);

  // Listen for event control commands
  useSocketEvent('event:control', (data) => {
    if (data.eventId === eventId && onEventControl) {
      onEventControl(data);
      addNotification(`🎯 Event ${data.action}ed`);
    }
  }, [eventId, onEventControl]);

  // Listen for general notifications
  useSocketEvent('notification', (data) => {
    if (!data.eventId || data.eventId === eventId) {
      addNotification(data.message);
    }
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
