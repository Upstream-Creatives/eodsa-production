import { io } from 'socket.io-client';
import { SocketEvents } from './socket-events';

class SocketClient {
  private socket: ReturnType<typeof io> | null = null;
  private eventListeners: Map<string, Function[]> = new Map();

  connect(url?: string) {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(url || process.env.NEXT_PUBLIC_SOCKET_URL || '', {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('🔌 Connected to socket server');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from socket server');
    });

    this.socket.on('connect_error', (error) => {
      console.error('🚫 Socket connection error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Join specific event rooms
  joinEvent(eventId: string) {
    this.socket?.emit('join:event', eventId);
  }

  joinAsJudge(eventId: string, judgeId: string) {
    this.socket?.emit('join:judge', { eventId, judgeId });
  }

  joinAsSound(eventId: string) {
    this.socket?.emit('join:sound', eventId);
  }

  joinAsBackstage(eventId: string) {
    this.socket?.emit('join:backstage', eventId);
  }

  // Emit events
  emit<T extends keyof SocketEvents>(event: T, data: SocketEvents[T]) {
    this.socket?.emit(event, data);
  }

  // Listen for events
  on<T extends keyof SocketEvents>(
    event: T, 
    callback: (data: SocketEvents[T]) => void
  ) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    
    this.eventListeners.get(event)!.push(callback);
    this.socket?.on(event, callback);
  }

  // Remove event listeners
  off<T extends keyof SocketEvents>(
    event: T, 
    callback?: (data: SocketEvents[T]) => void
  ) {
    if (callback) {
      this.socket?.off(event, callback);
      
      const listeners = this.eventListeners.get(event) || [];
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    } else {
      this.socket?.off(event);
      this.eventListeners.delete(event);
    }
  }

  // Get connection status
  get connected() {
    return this.socket?.connected || false;
  }

  get id() {
    return this.socket?.id;
  }
}

// Singleton instance
export const socketClient = new SocketClient();

// Auto-connect on import (optional)
if (typeof window !== 'undefined') {
  socketClient.connect();
}
