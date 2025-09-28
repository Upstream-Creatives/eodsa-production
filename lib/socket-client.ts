import io from 'socket.io-client';
import { SocketEvents } from './socket-events';

class SocketClient {
  private socket: ReturnType<typeof io> | null = null;
  private eventListeners: Map<string, Function[]> = new Map();

  connect(url?: string) {
    if (this.socket?.connected) {
      return this.socket;
    }

    // Get WebSocket URL from environment or use provided URL
    const socketUrl = url || process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    
    console.log('🔌 Connecting to WebSocket server:', socketUrl);
    console.log('🔧 Environment SOCKET_URL:', process.env.NEXT_PUBLIC_SOCKET_URL);

    this.socket = io(socketUrl, {
      transports: ['polling', 'websocket'], // Polling first for Render.com
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 15, // More attempts for Render.com
      reconnectionDelay: 2000, // Longer delay
      reconnectionDelayMax: 10000, // Longer max delay
      timeout: 60000, // Much longer timeout for Render.com cold starts
      forceNew: false,
      // Render.com optimizations
      upgrade: true,
      rememberUpgrade: false // Don't remember upgrades on Render.com
    });

    this.socket.on('connect', () => {
      console.log('🔌 Connected to socket server');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from socket server');
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('🚫 Socket connection error:', error);
      
      // For Render.com, try to reconnect with polling only if websocket fails
      if (error.message.includes('timeout') || error.message.includes('websocket')) {
        console.log('🔄 Retrying with polling transport only...');
        setTimeout(() => {
          if (this.socket && !this.socket.connected) {
            this.socket.io.opts.transports = ['polling'];
            this.socket.connect();
          }
        }, 3000);
      }
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Force connection with polling only (fallback for Render.com issues)
  connectPollingOnly(url?: string) {
    if (this.socket?.connected) {
      return this.socket;
    }

    const socketUrl = url || process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    
    console.log('🔌 Connecting with polling only to:', socketUrl);

    this.socket = io(socketUrl, {
      transports: ['polling'], // Polling only
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 3000,
      reconnectionDelayMax: 15000,
      timeout: 120000, // Very long timeout
      forceNew: true // Force new connection
    });

    this.socket.on('connect', () => {
      console.log('🔌 Connected to socket server (polling only)');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from socket server');
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('🚫 Socket connection error (polling only):', error);
    });

    return this.socket;
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

  joinAsAnnouncer(eventId: string) {
    this.socket?.emit('join:announcer', eventId);
  }

  joinAsRegistration(eventId: string) {
    this.socket?.emit('join:registration', eventId);
  }

  joinAsMedia(eventId: string) {
    this.socket?.emit('join:media', eventId);
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
    this.socket?.on(event as any, callback as any);
  }

  // Remove event listeners
  off<T extends keyof SocketEvents>(
    event: T, 
    callback?: (data: SocketEvents[T]) => void
  ) {
    if (callback) {
      this.socket?.off(event as any, callback as any);
      
      const listeners = this.eventListeners.get(event) || [];
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    } else {
      this.socket?.off(event as any);
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
