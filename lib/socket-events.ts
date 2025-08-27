// Socket.io event types for real-time updates

export interface SocketEvents {
  // Performance order changes
  'performance:reorder': {
    eventId: string;
    performances: Array<{
      id: string;
      itemNumber: number;
      displayOrder: number;
    }>;
  };

  // Performance status updates
  'performance:status': {
    performanceId: string;
    eventId: string;
    status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
    timestamp: string;
  };

  // New entry added
  'entry:created': {
    eventId: string;
    entry: any; // EventEntry type
  };

  // Entry updated (music uploaded, etc.)
  'entry:updated': {
    eventId: string;
    entryId: string;
    updates: any;
  };

  // Event control commands from backstage
  'event:control': {
    eventId: string;
    action: 'start' | 'pause' | 'resume' | 'reset';
    currentItem?: number;
  };

  // General notifications
  'notification': {
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    eventId?: string;
  };
}

export type SocketEventKey = keyof SocketEvents;
export type SocketEventData<T extends SocketEventKey> = SocketEvents[T];

// Event room patterns
export const getEventRoom = (eventId: string) => `event:${eventId}`;
export const getJudgeRoom = (eventId: string) => `judges:${eventId}`;
export const getSoundRoom = (eventId: string) => `sound:${eventId}`;
export const getBackstageRoom = (eventId: string) => `backstage:${eventId}`;
