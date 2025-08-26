// Temporary stub for useSocket to avoid build errors
// Real-time functionality will be implemented later

interface UseSocketOptions {
  eventId?: string;
  judgeId?: string;
  autoConnect?: boolean;
}

export function useSocket(options: UseSocketOptions = {}) {
  return {
    socket: null,
    isConnected: false,
    connect: () => {},
    disconnect: () => {},
    joinEvent: () => {},
    joinJudge: () => {},
    joinSound: () => {},
    joinBackstage: () => {},
    emit: () => {},
    on: () => {},
    off: () => {}
  };
}

export function useSocketEvent(eventName: string, handler: Function, deps?: any[]) {
  // Stub function - does nothing in production build
}

export function useBackstageSocket(eventId: string) {
  return {
    connected: false,
    on: (event: string, handler: Function) => {},
    off: (event: string, handler?: Function) => {},
    emit: (event: string, ...args: any[]) => {},
    isConnected: false,
    reorderPerformances: () => {},
    updatePerformanceStatus: () => {},
    sendEventControl: () => {},
    sendTestNotification: () => {}
  };
}
