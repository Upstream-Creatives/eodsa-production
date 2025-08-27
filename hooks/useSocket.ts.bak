'use client';

import { useEffect, useRef, useState } from 'react';
import { socketClient } from '@/lib/socket-client';
import { SocketEvents } from '@/lib/socket-events';

interface UseSocketOptions {
  eventId?: string;
  role?: 'judge' | 'sound' | 'backstage' | 'general';
  judgeId?: string;
  autoConnect?: boolean;
}

export function useSocket(options: UseSocketOptions = {}) {
  const { eventId, role, judgeId, autoConnect = true } = options;
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const listenersRef = useRef<Map<string, Function>>(new Map());

  useEffect(() => {
    if (!autoConnect) return;

    // Connect to socket
    socketClient.connect();

    // Set up connection status listeners
    const handleConnect = () => {
      setConnected(true);
      setConnectionError(null);
      
      // Join appropriate rooms based on role
      if (eventId) {
        socketClient.joinEvent(eventId);
        
        switch (role) {
          case 'judge':
            if (judgeId) {
              socketClient.joinAsJudge(eventId, judgeId);
            }
            break;
          case 'sound':
            socketClient.joinAsSound(eventId);
            break;
          case 'backstage':
            socketClient.joinAsBackstage(eventId);
            break;
        }
      }
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    const handleError = (error: any) => {
      setConnectionError(error.message || 'Connection error');
    };

    // Listen for connection events
    socketClient.on('connect' as any, handleConnect);
    socketClient.on('disconnect' as any, handleDisconnect);
    socketClient.on('connect_error' as any, handleError);

    // Set initial connection state
    setConnected(socketClient.connected);

    // Cleanup on unmount
    return () => {
      socketClient.off('connect' as any, handleConnect);
      socketClient.off('disconnect' as any, handleDisconnect);
      socketClient.off('connect_error' as any, handleError);
      
      // Remove all listeners added by this hook
      listenersRef.current.forEach((listener, event) => {
        socketClient.off(event as any, listener as any);
      });
      listenersRef.current.clear();
    };
  }, [eventId, role, judgeId, autoConnect]);

  // Function to listen for events
  const on = <T extends keyof SocketEvents>(
    event: T,
    callback: (data: SocketEvents[T]) => void
  ) => {
    socketClient.on(event, callback);
    listenersRef.current.set(event, callback);
  };

  // Function to emit events
  const emit = <T extends keyof SocketEvents>(
    event: T,
    data: SocketEvents[T]
  ) => {
    socketClient.emit(event, data);
  };

  // Function to remove listeners
  const off = <T extends keyof SocketEvents>(
    event: T,
    callback?: (data: SocketEvents[T]) => void
  ) => {
    socketClient.off(event, callback);
    if (!callback) {
      listenersRef.current.delete(event);
    }
  };

  return {
    connected,
    connectionError,
    on,
    emit,
    off,
    socketId: socketClient.id,
  };
}

// Specialized hooks for different roles
export function useJudgeSocket(eventId: string, judgeId: string) {
  return useSocket({ eventId, role: 'judge', judgeId });
}

export function useSoundSocket(eventId: string) {
  return useSocket({ eventId, role: 'sound' });
}

export function useBackstageSocket(eventId: string) {
  return useSocket({ eventId, role: 'backstage' });
}

// Hook for listening to specific events with easy cleanup
export function useSocketEvent<T extends keyof SocketEvents>(
  event: T,
  callback: (data: SocketEvents[T]) => void,
  deps: React.DependencyList = []
) {
  const socket = useSocket({ autoConnect: true });

  useEffect(() => {
    if (!socket.connected) return;

    socket.on(event, callback);

    return () => {
      socket.off(event, callback);
    };
  }, [socket.connected, event, ...deps]);

  return socket;
}
