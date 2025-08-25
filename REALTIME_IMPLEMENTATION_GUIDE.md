# 🚀 Real-Time Implementation Guide

This guide shows how to implement the high-priority features for live event management.

## 📦 **STEP 1: Install Dependencies**

```bash
# Real-time communication
npm install socket.io socket.io-client
npm install @types/socket.io @types/socket.io-client

# Drag and drop functionality  
npm install react-beautiful-dnd
npm install @types/react-beautiful-dnd
```

## 🔧 **STEP 2: Environment Setup**

Add to your `.env` file:

```env
# Socket.io Configuration
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
SOCKET_PORT=3001

# Optional: For production
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

## 🖥️ **STEP 3: Server Setup (Critical)**

**⚠️ IMPORTANT**: Socket.io requires a persistent server, not just serverless functions.

### **Option A: Custom Node.js Server (Recommended)**

Create `server.js` in your project root:

```javascript
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { initializeSocket } = require('./lib/socket-server');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;
const socketPort = process.env.SOCKET_PORT || 3001;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Main Next.js server
  const server = createServer(async (req, res) => {
    const parsedUrl = parse(req.url, true);
    await handle(req, res, parsedUrl);
  });

  // Socket.io server on different port
  const socketServer = createServer();
  initializeSocket(socketServer);

  server.listen(port, () => {
    console.log(`🚀 Next.js server running on http://${hostname}:${port}`);
  });

  socketServer.listen(socketPort, () => {
    console.log(`🔌 Socket.io server running on http://${hostname}:${socketPort}`);
  });
});
```

Update `package.json`:

```json
{
  "scripts": {
    "dev": "node server.js",
    "build": "next build",
    "start": "NODE_ENV=production node server.js"
  }
}
```

### **Option B: Managed Service (Easier)**

Use a managed service like **Pusher** or **Ably**:

```bash
npm install pusher pusher-js
```

Modify the socket files to use Pusher instead of Socket.io.

## 🗄️ **STEP 4: Database Updates**

Run these SQL commands on your database:

```sql
-- Add performance status tracking
ALTER TABLE performances 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'scheduled' 
CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled'));

-- Add display order for more flexible ordering
ALTER TABLE event_entries 
ADD COLUMN IF NOT EXISTS display_order INTEGER;

ALTER TABLE performances 
ADD COLUMN IF NOT EXISTS display_order INTEGER;

-- Add updated_at timestamp for change tracking
ALTER TABLE performances 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
```

## 📁 **STEP 5: Update Database Functions**

Add this method to `lib/database.ts`:

```typescript
async updatePerformanceStatus(performanceId: string, status: string) {
  const sqlClient = getSql();
  await sqlClient`
    UPDATE performances 
    SET status = ${status}, 
        updated_at = NOW()
    WHERE id = ${performanceId}
  `;
},

async updatePerformanceDisplayOrder(performanceId: string, displayOrder: number) {
  const sqlClient = getSql();
  await sqlClient`
    UPDATE performances 
    SET display_order = ${displayOrder}
    WHERE id = ${performanceId}
  `;
},
```

## 🔗 **STEP 6: Update Existing Components**

### **Judge Dashboard Integration**

Add to `app/judge/dashboard/page.tsx`:

```typescript
import { useJudgeSocket } from '@/hooks/useSocket';
import RealtimeUpdates from '@/components/RealtimeUpdates';

// In the component:
const socket = useJudgeSocket(currentEventId, judgeId);

// Wrap the return JSX:
return (
  <RealtimeUpdates
    eventId={currentEventId}
    onPerformanceReorder={handlePerformanceReorder}
    onPerformanceStatus={handlePerformanceStatus}
  >
    {/* existing JSX */}
  </RealtimeUpdates>
);
```

### **Sound Tech Dashboard Integration**

Add to `app/admin/sound-tech/page.tsx`:

```typescript
import { useSoundSocket } from '@/hooks/useSocket';

const socket = useSoundSocket(selectedEvent);

// Add real-time entry updates
useEffect(() => {
  socket.on('entry:updated', (data) => {
    fetchData(); // Refresh music entries
  });
}, [socket.connected]);
```

### **Admin Dashboard Integration**

Add real-time notifications to admin when entries are created/updated.

## 🎭 **STEP 7: Access the Backstage Dashboard**

1. **Login as admin**: Go to `/portal/admin`
2. **Navigate to backstage**: Go to `/backstage/[eventId]`
3. **Replace [eventId]** with actual event ID from your database

## 🧪 **STEP 8: Testing the System**

### **Test Real-Time Updates:**

1. **Open multiple browser windows:**
   - Window 1: Backstage dashboard (`/backstage/[eventId]`)
   - Window 2: Judge dashboard (`/judge/dashboard`)
   - Window 3: Sound tech dashboard (`/admin/sound-tech`)

2. **Test drag-and-drop reordering:**
   - Drag performances in backstage dashboard
   - Verify order updates in judge dashboard immediately

3. **Test status updates:**
   - Mark performance as "in progress" in backstage
   - Check if judge dashboard highlights the current performance

4. **Test new entries:**
   - Create new entry in competition form
   - Verify it appears in all dashboards

## 🚀 **STEP 9: Production Deployment**

### **Hosting Requirements:**
- **Socket.io**: Needs persistent server (not serverless)
- **Options**: VPS, DigitalOcean, AWS EC2, Railway, Render

### **Recommended: Railway Deployment**

1. **Connect to Railway**: Link your GitHub repo
2. **Add environment variables**: Copy your `.env` variables
3. **Deploy**: Railway will automatically build and deploy

### **Alternative: Vercel + Pusher**

1. **Deploy to Vercel**: Keep existing serverless setup
2. **Use Pusher**: Replace Socket.io with Pusher for real-time
3. **Simpler setup**: No custom server needed

## 🔧 **STEP 10: What You Need to Provide**

### **Immediate:**
1. **Run the database updates** (SQL commands above)
2. **Install the npm packages** (commands above)
3. **Choose deployment strategy** (Custom server vs Pusher)

### **Configuration:**
1. **Set environment variables** for Socket.io URLs
2. **Update CORS origins** for production domains
3. **Test on your local environment** first

### **Optional Enhancements:**
1. **Add authentication** to backstage access
2. **Add role-based permissions** (who can drag/drop)
3. **Add performance timing** (automatic status updates)

## 📞 **Need Help?**

The foundation is now in place! The key files created are:

- ✅ **Socket infrastructure**: `lib/socket-events.ts`, `lib/socket-server.ts`, `lib/socket-client.ts`
- ✅ **React hooks**: `hooks/useSocket.ts`
- ✅ **Backstage dashboard**: `app/backstage/[eventId]/page.tsx`
- ✅ **API endpoints**: Performance reordering and status updates
- ✅ **Real-time component**: `components/RealtimeUpdates.tsx`

Next steps:
1. Install dependencies
2. Set up the server (Option A or B)
3. Update database
4. Test locally
5. Deploy to production

The system will then provide the real-time synchronization and backstage control you need for live events!
