# 🧪 Real-Time Testing Guide

Your real-time backstage system is now ready! Here's how to test it:

## 🚀 **STEP 1: Create Environment File**

Create `.env.local` in your project root:

```env
# Database Configuration
DATABASE_URL=postgres://neondb_owner:npg_Z0wdXg6knSvy@ep-blue-glitter-a4xc1mko-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require

# Socket.io Configuration for Real-time Features
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
SOCKET_PORT=3001

# Development Settings
NODE_ENV=development
```

## 🔌 **STEP 2: Start the Socket.io Server**

In **Terminal 1**, start the real-time server:

```bash
node server-realtime.js
```

You should see:
```
🚀 Socket.io Real-time Server Started!
📡 Listening on: http://localhost:3001
🎭 Ready for backstage control and live updates
```

## 💻 **STEP 3: Start Your Next.js App**

In **Terminal 2**, start your main application:

```bash
npm run dev
```

## 🎭 **STEP 4: Test the Backstage Dashboard**

1. **Login as admin**: Go to `http://localhost:3000/portal/admin`
   - Email: `admin@competition.com` 
   - Password: `admin123`

2. **Find an event ID**: In admin dashboard, look at existing events or create one
   - Note the event ID (usually visible in URLs or event listings)

3. **Open backstage**: Go to `http://localhost:3000/backstage/[EVENT_ID]`
   - Replace `[EVENT_ID]` with actual event ID from step 2
   - Example: `http://localhost:3000/backstage/event_123456`

4. **Check connection**: You should see "🟢 Connected" in the top-right corner

## 🧪 **STEP 5: Test Drag-and-Drop**

1. **View performances**: You should see a list of performances for the event
2. **Drag to reorder**: Click and drag the ⋮⋮ handle to reorder performances
3. **Check console**: Both terminals should show reorder messages
4. **Verify database**: Item numbers should update in the database

## 🔄 **STEP 6: Test Real-Time Updates**

### **Multi-Window Test:**

1. **Open multiple browser windows**:
   - Window 1: Backstage dashboard (`/backstage/[eventId]`)
   - Window 2: Judge dashboard (`/judge/dashboard`) 
   - Window 3: Sound tech dashboard (`/admin/sound-tech`)

2. **Test reordering**:
   - Drag performances in backstage (Window 1)
   - Check if order updates in other windows immediately

3. **Test status updates**:
   - Click "▶️ Start" on a performance in backstage
   - Check if status updates appear in other windows

### **Console Verification:**
Watch the Socket.io server terminal for real-time events:
```
🔄 Performance reorder broadcast for event event_123456
📊 Status update broadcast: perf_789 -> in_progress
🎯 Event control: start for event event_123456
```

## 🐛 **Troubleshooting**

### **Socket Connection Issues:**
- **"🔴 Disconnected"**: Check if Socket.io server is running on port 3001
- **CORS errors**: Verify `NEXT_PUBLIC_SOCKET_URL` matches the server URL
- **Port conflicts**: Change `SOCKET_PORT` in `.env.local` if 3001 is busy

### **Database Issues:**
- **"Performance not found"**: Ensure you have performances in the selected event
- **Missing columns**: Run the migration again: `$env:DATABASE_URL="..."; node scripts/add-realtime-columns.js`

### **Backstage Not Loading:**
- **404 errors**: Check the event ID in the URL is correct
- **No performances**: Create entries in the admin dashboard first

## 📊 **What You Should See Working**

✅ **Instant Reordering**: Drag in backstage → Updates everywhere immediately  
✅ **Status Tracking**: Mark as "in progress" → All interfaces show current status  
✅ **Event Control**: Start/pause events → Synchronized across all views  
✅ **Connection Status**: Green dots showing live connections  
✅ **Real-time Notifications**: Toasts appearing when changes happen  

## 🎯 **Next Steps After Testing**

Once everything works locally:

1. **Add to existing components**: 
   - Update Judge Dashboard with real-time hooks
   - Add real-time updates to Sound Tech dashboard
   - Integrate with Admin dashboard

2. **Deploy to production**:
   - Choose hosting with persistent servers (Railway, DigitalOcean)
   - Update environment variables for production URLs
   - Test with multiple users

3. **Enhance features**:
   - Add performance timing
   - Include more status updates
   - Add bulk operations

## 🎉 **Success Indicators**

You'll know it's working when:
- Multiple browser windows update simultaneously
- Drag-and-drop reordering syncs across all views
- Performance status changes appear in real-time
- Socket server shows connection and event logs
- No console errors in browser or server

The system is now live-event ready with professional drag-and-drop control and instant synchronization! 🚀
