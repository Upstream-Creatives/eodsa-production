/**
 * Simple Socket.io server for testing real-time functionality
 * Run this with: node server-realtime.js
 */

const { createServer } = require('http');
const { Server } = require('socket.io');

const server = createServer();
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling']
});

// Socket.io event handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Join event-specific rooms
  socket.on('join:event', (eventId) => {
    socket.join(`event:${eventId}`);
    console.log(`📡 Socket ${socket.id} joined event room: ${eventId}`);
  });

  socket.on('join:judge', ({ eventId, judgeId }) => {
    socket.join(`judges:${eventId}`);
    socket.data.judgeId = judgeId;
    socket.data.eventId = eventId;
    console.log(`⚖️ Judge ${judgeId} joined event ${eventId}`);
  });

  socket.on('join:sound', (eventId) => {
    socket.join(`sound:${eventId}`);
    socket.data.role = 'sound';
    socket.data.eventId = eventId;
    console.log(`🎵 Sound tech joined event ${eventId}`);
  });

  socket.on('join:backstage', (eventId) => {
    socket.join(`backstage:${eventId}`);
    socket.data.role = 'backstage';
    socket.data.eventId = eventId;
    console.log(`🎭 Backstage joined event ${eventId}`);
  });

  // Handle performance reordering from backstage
  socket.on('performance:reorder', (data) => {
    console.log(`🔄 Performance reorder broadcast for event ${data.eventId}`);
    
    // Broadcast to all rooms for this event
    io.to(`event:${data.eventId}`).emit('performance:reorder', data);
    io.to(`judges:${data.eventId}`).emit('performance:reorder', data);
    io.to(`sound:${data.eventId}`).emit('performance:reorder', data);
  });

  // Handle status updates
  socket.on('performance:status', (data) => {
    console.log(`📊 Status update broadcast: ${data.performanceId} -> ${data.status}`);
    
    // Broadcast to all relevant rooms
    io.to(`event:${data.eventId}`).emit('performance:status', data);
    io.to(`judges:${data.eventId}`).emit('performance:status', data);
    io.to(`sound:${data.eventId}`).emit('performance:status', data);
    io.to(`backstage:${data.eventId}`).emit('performance:status', data);
  });

  // Handle event control commands
  socket.on('event:control', (data) => {
    console.log(`🎯 Event control: ${data.action} for event ${data.eventId}`);
    
    // Broadcast to all rooms
    io.to(`event:${data.eventId}`).emit('event:control', data);
    io.to(`judges:${data.eventId}`).emit('event:control', data);
    io.to(`sound:${data.eventId}`).emit('event:control', data);
  });

  // Send a test notification
  socket.on('test:notification', (data) => {
    console.log('📢 Sending test notification:', data);
    io.to(`event:${data.eventId}`).emit('notification', {
      type: 'info',
      message: 'Test notification from backstage!',
      eventId: data.eventId
    });
  });

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.SOCKET_PORT || 3001;

server.listen(PORT, () => {
  console.log(`\n🚀 Socket.io Real-time Server Started!`);
  console.log(`📡 Listening on: http://localhost:${PORT}`);
  console.log(`🎭 Ready for backstage control and live updates`);
  console.log(`\n🔗 Connect your Next.js app by setting:`);
  console.log(`   NEXT_PUBLIC_SOCKET_URL=http://localhost:${PORT}`);
  console.log(`\n✨ Test connections by opening backstage dashboard\n`);
});
