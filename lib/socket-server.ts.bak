import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { 
  SocketEvents, 
  getEventRoom, 
  getJudgeRoom, 
  getSoundRoom, 
  getBackstageRoom 
} from './socket-events';

let io: SocketIOServer | undefined;

export function initializeSocket(server: HTTPServer): SocketIOServer {
  if (io) {
    return io;
  }

  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? process.env.ALLOWED_ORIGINS?.split(',') || []
        : ["http://localhost:3000"],
      methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Join event-specific rooms
    socket.on('join:event', (eventId: string) => {
      socket.join(getEventRoom(eventId));
      console.log(`📡 Socket ${socket.id} joined event room: ${eventId}`);
    });

    socket.on('join:judge', ({ eventId, judgeId }: { eventId: string; judgeId: string }) => {
      socket.join(getJudgeRoom(eventId));
      socket.data.judgeId = judgeId;
      socket.data.eventId = eventId;
      console.log(`⚖️ Judge ${judgeId} joined event ${eventId}`);
    });

    socket.on('join:sound', (eventId: string) => {
      socket.join(getSoundRoom(eventId));
      socket.data.role = 'sound';
      socket.data.eventId = eventId;
      console.log(`🎵 Sound tech joined event ${eventId}`);
    });

    socket.on('join:backstage', (eventId: string) => {
      socket.join(getBackstageRoom(eventId));
      socket.data.role = 'backstage';
      socket.data.eventId = eventId;
      console.log(`🎭 Backstage joined event ${eventId}`);
    });

    // Handle performance reordering from backstage
    socket.on('performance:reorder', (data: SocketEvents['performance:reorder']) => {
      // Verify this socket is in backstage room
      const backstageRoom = getBackstageRoom(data.eventId);
      if (!socket.rooms.has(backstageRoom)) {
        socket.emit('error', { message: 'Unauthorized: Not in backstage room' });
        return;
      }

      // Broadcast to all rooms for this event
      io?.to(getEventRoom(data.eventId)).emit('performance:reorder', data);
      io?.to(getJudgeRoom(data.eventId)).emit('performance:reorder', data);
      io?.to(getSoundRoom(data.eventId)).emit('performance:reorder', data);
      
      console.log(`🔄 Performance reorder broadcast for event ${data.eventId}`);
    });

    // Handle status updates
    socket.on('performance:status', (data: SocketEvents['performance:status']) => {
      // Broadcast to all relevant rooms
      io?.to(getEventRoom(data.eventId)).emit('performance:status', data);
      io?.to(getJudgeRoom(data.eventId)).emit('performance:status', data);
      io?.to(getSoundRoom(data.eventId)).emit('performance:status', data);
      io?.to(getBackstageRoom(data.eventId)).emit('performance:status', data);
      
      console.log(`📊 Status update broadcast: ${data.performanceId} -> ${data.status}`);
    });

    // Handle event control commands
    socket.on('event:control', (data: SocketEvents['event:control']) => {
      // Only backstage can send control commands
      const backstageRoom = getBackstageRoom(data.eventId);
      if (!socket.rooms.has(backstageRoom)) {
        socket.emit('error', { message: 'Unauthorized: Only backstage can control events' });
        return;
      }

      // Broadcast to all rooms
      io?.to(getEventRoom(data.eventId)).emit('event:control', data);
      io?.to(getJudgeRoom(data.eventId)).emit('event:control', data);
      io?.to(getSoundRoom(data.eventId)).emit('event:control', data);
      
      console.log(`🎯 Event control: ${data.action} for event ${data.eventId}`);
    });

    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getSocket(): SocketIOServer | undefined {
  return io;
}

// Utility functions for broadcasting from API routes
export function broadcastToEvent(eventId: string, event: keyof SocketEvents, data: any) {
  if (!io) {
    console.warn('⚠️ Socket.io not initialized');
    return;
  }
  
  io.to(getEventRoom(eventId)).emit(event, data);
}

export function broadcastToJudges(eventId: string, event: keyof SocketEvents, data: any) {
  if (!io) return;
  io.to(getJudgeRoom(eventId)).emit(event, data);
}

export function broadcastToSound(eventId: string, event: keyof SocketEvents, data: any) {
  if (!io) return;
  io.to(getSoundRoom(eventId)).emit(event, data);
}

export function broadcastToBackstage(eventId: string, event: keyof SocketEvents, data: any) {
  if (!io) return;
  io.to(getBackstageRoom(eventId)).emit(event, data);
}
