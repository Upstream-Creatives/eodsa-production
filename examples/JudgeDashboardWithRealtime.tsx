// EXAMPLE: How to integrate real-time updates into Judge Dashboard
// This shows the modifications needed to add real-time sync

'use client';

import React, { useState, useEffect } from 'react';
import { useJudgeSocket } from '@/hooks/useSocket';
import RealtimeUpdates from '@/components/RealtimeUpdates';

// ... other imports and interfaces ...

export default function JudgeDashboardWithRealtime() {
  const [performances, setPerformances] = useState([]);
  const [currentEventId, setCurrentEventId] = useState('');
  const [judgeId, setJudgeId] = useState('');
  
  // Initialize socket connection for this judge
  const socket = useJudgeSocket(currentEventId, judgeId);

  // Handle real-time performance reordering
  const handlePerformanceReorder = (reorderedPerformances: any[]) => {
    setPerformances(prev => {
      // Update the order based on new item numbers
      const updated = [...prev];
      
      reorderedPerformances.forEach(reordered => {
        const index = updated.findIndex(p => p.id === reordered.id);
        if (index !== -1) {
          updated[index] = { ...updated[index], itemNumber: reordered.itemNumber };
        }
      });
      
      // Re-sort by item number
      return updated.sort((a, b) => {
        if (a.itemNumber && b.itemNumber) {
          return a.itemNumber - b.itemNumber;
        }
        return a.title.localeCompare(b.title);
      });
    });
  };

  // Handle real-time status updates
  const handlePerformanceStatus = (data: any) => {
    setPerformances(prev =>
      prev.map(p =>
        p.id === data.performanceId
          ? { ...p, status: data.status }
          : p
      )
    );
  };

  // Handle event control commands from backstage
  const handleEventControl = (data: any) => {
    switch (data.action) {
      case 'start':
      case 'resume':
        // Maybe highlight the current item being performed
        if (data.currentItem) {
          // Scroll to or highlight the current performance
          const element = document.getElementById(`performance-${data.currentItem}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
          }
        }
        break;
      case 'pause':
        // Maybe show a "paused" indicator
        break;
      case 'reset':
        // Reset any highlighting or special states
        break;
    }
  };

  // ... rest of component logic ...

  return (
    <RealtimeUpdates
      eventId={currentEventId}
      onPerformanceReorder={handlePerformanceReorder}
      onPerformanceStatus={handlePerformanceStatus}
      onEventControl={handleEventControl}
    >
      <div className="judge-dashboard">
        {/* Socket connection status indicator */}
        <div className="flex items-center space-x-2 mb-4">
          <div className={`w-3 h-3 rounded-full ${
            socket.connected ? 'bg-green-500' : 'bg-red-500'
          }`} />
          <span className="text-sm text-gray-600">
            {socket.connected ? 'Live updates active' : 'Connecting...'}
          </span>
        </div>

        {/* Performance list */}
        {performances.map(performance => (
          <div
            key={performance.id}
            id={`performance-${performance.itemNumber}`}
            className={`performance-card ${
              performance.status === 'in_progress' ? 'ring-2 ring-blue-500' : ''
            }`}
          >
            {/* Performance details */}
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold">#{performance.itemNumber}</span>
                <span className="ml-2">{performance.title}</span>
              </div>
              
              {/* Real-time status indicator */}
              <div className={`px-2 py-1 rounded text-sm ${
                performance.status === 'completed' ? 'bg-green-100 text-green-800' :
                performance.status === 'in_progress' ? 'bg-blue-100 text-blue-800 animate-pulse' :
                'bg-gray-100 text-gray-800'
              }`}>
                {performance.status}
              </div>
            </div>
            
            {/* Judge scoring interface */}
            {/* ... scoring form ... */}
          </div>
        ))}
      </div>
    </RealtimeUpdates>
  );
}

// Additional CSS for animations
const additionalStyles = `
  .performance-card {
    transition: all 0.3s ease;
  }
  
  .performance-card.ring-2 {
    transform: scale(1.02);
    box-shadow: 0 4px 20px rgba(59, 130, 246, 0.3);
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  
  .animate-pulse {
    animation: pulse 2s infinite;
  }
`;
