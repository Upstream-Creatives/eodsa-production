'use client';

import React, { useState, useEffect } from 'react';
import RealtimeUpdates from '@/components/RealtimeUpdates';
import { useRouter } from 'next/navigation';
import MusicPlayer from '@/components/MusicPlayer';
import VideoPlayer from '@/components/VideoPlayer';
import Link from 'next/link';
import { useAlert } from '@/components/ui/custom-alert';

interface Assignment {
  id: string;
  judgeId: string;
  eventId: string;
  assignedBy: string;
  assignedAt: string;
  status: string;
  event: {
  id: string;
  name: string;
    description: string;
    eventDate: string;
    venue: string;
  };
}

interface Performance {
  id: string;
  eventId: string;
  title: string;
  contestantName: string;
  participantNames: string[];
  duration: number;
  status: string;
  scheduledTime?: string;
  choreographer?: string;
  itemStyle?: string;
  mastery?: string;
  ageCategory?: string;
  itemNumber?: number;
  performanceOrder?: number;
  // PHASE 2: Live vs Virtual Entry Support
  entryType?: 'live' | 'virtual';
  musicFileUrl?: string;
  musicFileName?: string;
  videoExternalUrl?: string;
  videoExternalType?: 'youtube' | 'vimeo' | 'other';
  performanceTypeLabel?: 'Solo' | 'Duet' | 'Trio' | 'Group';
}

interface Score {
  technique: number;
  musicality: number;
  performance: number;
  styling: number;
  overallImpression: number;
  comments: string;
}

interface PerformanceWithScore extends Performance {
  hasScore?: boolean;
  judgeScore?: any;
  isFullyScored?: boolean;
  scoringStatus?: any;
  withdrawnFromJudging?: boolean;
}

export default function JudgeDashboard() {
  // Optimized mobile styles and global black text
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      /* Global black text styling */
      * {
        color: black !important;
      }
      
      /* Professional styling for text inputs */
      .score-input {
        font-size: 18px !important;
        color: black !important;
        -webkit-text-fill-color: black !important;
        background: white !important;
        transition: all 0.2s ease;
      }
      
      .score-input:focus {
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
        border-color: #3b82f6 !important;
      }
      
      /* Mobile Phone optimizations */
      @media screen and (max-width: 640px) {
        /* Compact layout for phones */
        .mobile-header {
          padding: 8px 16px !important;
        }
        
        /* Hide Quick Actions on very small screens */
        .mobile-hide-quick-actions {
          display: none !important;
        }
        
        /* Compact performance cards */
        .mobile-performance-card {
          padding: 12px !important;
          margin-bottom: 8px !important;
        }
        
                 .mobile-performance-title {
           font-size: 16px !important;
           font-weight: 800 !important;
           line-height: 1.2 !important;
           letter-spacing: 0.025em !important;
         }
        
        .mobile-performance-details {
          font-size: 14px !important;
          font-weight: 500 !important;
          line-height: 1.2 !important;
        }
        
        /* Compact badges */
        .mobile-status-badge {
          padding: 4px 8px !important;
          font-size: 12px !important;
          font-weight: 600 !important;
        }
        
        /* Compact buttons */
        .mobile-score-button {
          padding: 8px 16px !important;
          font-size: 14px !important;
          font-weight: 600 !important;
          min-height: 44px !important;
        }
        
        /* Smaller item circles */
        .mobile-item-circle {
          width: 44px !important;
          height: 44px !important;
          font-size: 16px !important;
          font-weight: 700 !important;
        }
        
                 /* Prevent zoom on iOS */
         .score-input, input, select, textarea {
           font-size: 16px !important;
         }
         
         /* More compact spacing on phones */
         .mobile-spacing {
           margin-bottom: 8px !important;
         }
         
         /* Improve text readability on small screens */
         h1 {
           font-size: 18px !important;
         }
         
         h2 {
           font-size: 16px !important;
         }
         
         /* Stack buttons vertically on very small screens */
         @media (max-width: 380px) {
           .mobile-button-stack {
             flex-direction: column !important;
             gap: 8px !important;
           }
         }
       }
      
      /* Tablet optimizations */
      @media screen and (min-width: 641px) and (max-width: 768px) {
        .score-input {
          font-size: 16px !important;
        }
        
        /* Tablet-friendly styles for older judges */
        .mobile-performance-card {
          padding: 20px !important;
          margin-bottom: 16px !important;
        }
        
        .mobile-performance-title {
          font-size: 22px !important;
          font-weight: 800 !important;
          line-height: 1.3 !important;
          letter-spacing: 0.025em !important;
        }
        
        .mobile-performance-details {
          font-size: 18px !important;
          font-weight: 600 !important;
          line-height: 1.3 !important;
        }
        
        /* Larger badges for better visibility */
        .mobile-status-badge {
          padding: 8px 16px !important;
          font-size: 16px !important;
          font-weight: 600 !important;
        }
        
        /* Larger touch-friendly buttons */
        .mobile-score-button {
          padding: 16px 24px !important;
          font-size: 18px !important;
          font-weight: 700 !important;
          min-height: 56px !important;
        }
        
        /* Larger item number circles for better visibility */
        .mobile-item-circle {
          width: 64px !important;
          height: 64px !important;
          font-size: 24px !important;
          font-weight: 800 !important;
        }
        
        /* Larger scoring form inputs for tablet use */
        .score-input {
          padding: 16px 20px !important;
          font-size: 28px !important;
          font-weight: 800 !important;
          min-height: 80px !important;
          border-width: 3px !important;
        }
        
        /* Larger submit button for easier touch */
        button[type="submit"], .mobile-submit-button {
          padding: 20px 40px !important;
          font-size: 20px !important;
          font-weight: 700 !important;
          min-height: 64px !important;
          min-width: 280px !important;
        }
        
        /* Larger labels and text for better readability */
        label {
          font-size: 20px !important;
          font-weight: 700 !important;
        }
        
        /* Larger textarea for comments */
        textarea {
          padding: 16px 20px !important;
          font-size: 18px !important;
          min-height: 120px !important;
          border-width: 3px !important;
        }
      }
      
      /* Clean animations */
      .fade-in {
        animation: fadeIn 0.3s ease-in;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [performances, setPerformances] = useState<PerformanceWithScore[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedPerformance, setSelectedPerformance] = useState<PerformanceWithScore | null>(null);
  const [filteredPerformances, setFilteredPerformances] = useState<PerformanceWithScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [judgeName, setJudgeName] = useState('');
  const [judgeId, setJudgeId] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'scoring'>('list');
  const [currentScore, setCurrentScore] = useState<Score>({
    technique: 0,
    musicality: 0,
    performance: 0,
    styling: 0,
    overallImpression: 0,
    comments: ''
  });
  const [isSubmittingScore, setIsSubmittingScore] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'scored' | 'completed'>('all');
  const [entryTypeFilter, setEntryTypeFilter] = useState<'all' | 'live' | 'virtual'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [performancesPerPage] = useState(8);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemNumberSearch, setItemNumberSearch] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState('');
  const router = useRouter();
  const { showAlert } = useAlert();

  // Text input validation for numbers only
  const validateNumberInput = (value: string): number => {
    // Remove any non-digit characters except decimal point
    const cleaned = value.replace(/[^0-9.]/g, '');
    // Remove leading zeros
    const noLeadingZeros = cleaned.replace(/^0+(?=\d)/, '');
    // Parse and clamp between 0-20
    const parsed = parseFloat(noLeadingZeros) || 0;
    return Math.min(Math.max(parsed, 0), 20);
  };

  const formatScoreDisplay = (value: number): string => {
    // Return empty string for 0 values to show blank inputs initially
    if (value === 0) return '';
    return value % 1 === 0 ? value.toString() : value.toFixed(1);
  };

  useEffect(() => {
    const session = localStorage.getItem('judgeSession');
    if (!session) {
      router.push('/portal/judge');
      return;
    }
    
    const judgeData = JSON.parse(session);
    if (judgeData.isAdmin) {
      router.push('/admin');
      return;
    }
    
    setJudgeName(judgeData.name);
    setJudgeId(judgeData.id);
    loadJudgeData(judgeData.id);
  }, [router]);

  useEffect(() => {
    filterAndLoadPerformances();
  }, [performances, filterStatus, entryTypeFilter, searchTerm, itemNumberSearch]);

  useEffect(() => {
    const onFocus = () => {
      setLastSyncAt(new Date().toLocaleTimeString());
      // Reconnect sockets when window regains focus (laptop wake up)
      if (judgeId && assignments.length > 0) {
        import('@/lib/socket-client').then(({ socketClient }) => {
          assignments.forEach((assignment: any) => {
            socketClient.joinAsJudge(assignment.eventId, judgeId);
            console.log(`⚖️ Reconnected judge room for event: ${assignment.eventId}`);
          });
        });
      }
    };
    
    const hb = setInterval(() => {
      setLastSyncAt(new Date().toLocaleTimeString());
      // Periodic reconnection check
      if (judgeId && assignments.length > 0) {
        import('@/lib/socket-client').then(({ socketClient }) => {
          assignments.forEach((assignment: any) => {
            socketClient.joinAsJudge(assignment.eventId, judgeId);
          });
        });
      }
    }, 30000); // Every 30 seconds
    
    if (typeof window !== 'undefined') window.addEventListener('focus', onFocus);
    return () => { clearInterval(hb); if (typeof window !== 'undefined') window.removeEventListener('focus', onFocus); };
  }, [judgeId, assignments]);

  const loadJudgeData = async (judgeId: string) => {
    setIsLoading(true);
    try {
      // Load nationals judge assignments
      const assignmentsResponse = await fetch(`/api/judges/${judgeId}/assignments`);
      if (assignmentsResponse.ok) {
        const assignmentsData = await assignmentsResponse.json();
        setAssignments(assignmentsData.assignments || []);
        
        // Join judge rooms for all assigned events
        import('@/lib/socket-client').then(({ socketClient }) => {
          (assignmentsData.assignments || []).forEach((assignment: any) => {
            socketClient.joinAsJudge(assignment.eventId, judgeId);
            console.log(`⚖️ Joined judge room for event: ${assignment.eventId}`);
          });
        });
        
        // Load ALL performances for all assigned events (batched and parallelized)
        const allPerformances: PerformanceWithScore[] = [];
        await Promise.all((assignmentsData.assignments || []).map(async (assignment: any) => {
          const performancesResponse = await fetch(`/api/events/${assignment.eventId}/performances`);
          if (!performancesResponse.ok) return;
          const performancesData = await performancesResponse.json();
          const perfs: any[] = performancesData.performances || [];
          await Promise.all(perfs.map(async (performance: any) => {
            try {
              // Fetch judge's score and overall scoring status concurrently
              const [scoreRes, statusRes] = await Promise.all([
                fetch(`/api/scores/${performance.id}/${judgeId}`).catch(() => ({ ok: false, json: () => Promise.resolve({}) })),
                fetch(`/api/scores/performance/${performance.id}`).catch(() => ({ ok: false, json: () => Promise.resolve({}) }))
              ]);
              
              const scoreData = scoreRes.ok ? await scoreRes.json().catch(() => ({})) : {};
              const scoringStatusData = statusRes.ok ? await statusRes.json().catch(() => ({})) : {};
              
              allPerformances.push({
                ...performance,
                hasScore: scoreData.success && scoreData.score,
                judgeScore: scoreData.score,
                isFullyScored: scoringStatusData.success ? scoringStatusData.scoringStatus?.isFullyScored : false,
                scoringStatus: scoringStatusData.success ? scoringStatusData.scoringStatus : null
              });
            } catch (error) {
              console.warn(`Failed to load score data for performance ${performance.id}:`, error);
              // Add performance without score data
              allPerformances.push({
                ...performance,
                hasScore: false,
                judgeScore: null,
                isFullyScored: false,
                scoringStatus: null
              });
            }
          }));
        }));
        
        // Sort by performance order (backstage sequence), fallback to item number
        allPerformances.sort((a, b) => {
          // Primary sort: performanceOrder (backstage sequence)
          if (a.performanceOrder && b.performanceOrder) {
            return a.performanceOrder - b.performanceOrder;
          }
          // Fallback to item number if performanceOrder missing
          if (a.itemNumber && b.itemNumber) {
            return a.itemNumber - b.itemNumber;
          } else if (a.itemNumber && !b.itemNumber) {
            return -1;
          } else if (!a.itemNumber && b.itemNumber) {
            return 1;
          } else {
            return a.title.localeCompare(b.title);
          }
        });
        
        setPerformances(allPerformances);
        setFilteredPerformances(allPerformances);
      }
    } catch (error) {
      console.error('Error loading judge data:', error);
      setErrorMessage('Failed to load judge data. Please refresh the page.');
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndLoadPerformances = () => {
    let filtered = [...performances];
    
    // IMPORTANT: Always exclude withdrawn performances from judge view
    filtered = filtered.filter(p => !p.withdrawnFromJudging);
    
    // NEW: Filter by entry type (Live/Virtual)
    if (entryTypeFilter === 'live') {
      filtered = filtered.filter(p => p.entryType === 'live');
    } else if (entryTypeFilter === 'virtual') {
      filtered = filtered.filter(p => p.entryType === 'virtual');
    }
    
    // MAIN CHANGE: By default, hide performances this judge has already scored
    // This makes scored items disappear from the judge's view automatically
    if (filterStatus === 'all') {
      filtered = filtered.filter(p => !p.hasScore); // Only show unscored by this judge
    } else if (filterStatus === 'scored') {
      filtered = filtered.filter(p => p.hasScore); // Only show scored by this judge (for reference)
    } else if (filterStatus === 'completed') {
      filtered = filtered.filter(p => p.isFullyScored); // Only show fully completed by all judges
    }

    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(lowerSearchTerm) ||
        p.contestantName.toLowerCase().includes(lowerSearchTerm) ||
        (p.participantNames && p.participantNames.some(name => name.toLowerCase().includes(lowerSearchTerm)))
      );
    }

    if (itemNumberSearch) {
      const itemNum = parseInt(itemNumberSearch);
      if (!isNaN(itemNum)) {
        filtered = filtered.filter(p => p.itemNumber === itemNum);
      }
    }

    setFilteredPerformances(filtered);
    setCurrentPage(1);
  };

  const loadPerformanceByItemNumber = (itemNumber: number) => {
      const performance = performances.find(p => p.itemNumber === itemNumber);
      if (performance) {
        handleStartScoring(performance);
      } else {
      showAlert(`No performance found with item number ${itemNumber}`, 'warning');
    }
  };

  const handleItemNumberSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const itemNum = parseInt(itemNumberSearch);
      if (!isNaN(itemNum)) {
        loadPerformanceByItemNumber(itemNum);
      }
    }
  };

  const handleStartScoring = (performance: PerformanceWithScore) => {
    setSelectedPerformance(performance);
    setViewMode('scoring');
    
    if (performance.judgeScore) {
      setCurrentScore({
        technique: performance.judgeScore.technicalScore || 0,
        musicality: performance.judgeScore.musicalScore || 0,
        performance: performance.judgeScore.performanceScore || 0,
        styling: performance.judgeScore.stylingScore || 0,
        overallImpression: performance.judgeScore.overallImpressionScore || 0,
        comments: performance.judgeScore.comments || ''
      });
    } else {
      setCurrentScore({
        technique: 0,
        musicality: 0,
        performance: 0,
        styling: 0,
        overallImpression: 0,
        comments: ''
      });
    }
  };

  const handleScoreChange = (category: keyof Score, value: number | string) => {
    if (typeof value === 'number') {
      const cappedValue = Math.min(Math.max(value, 0), 20);
      setCurrentScore(prev => ({ ...prev, [category]: cappedValue }));
      
      // Clear error message when user enters valid scores
      if (cappedValue > 0 && errorMessage.includes('All score fields must have a value')) {
        setErrorMessage('');
      }
    } else {
      setCurrentScore(prev => ({ ...prev, [category]: value }));
    }
  };

  // Clean color theme based on mastery type
  const getMasteryColorTheme = (mastery: string | undefined) => {
    if (!mastery) return {
      primary: 'blue-600',
      secondary: 'blue-500', 
      light: 'blue-50',
      border: 'blue-200',
      text: 'blue-900'
    };

    if (mastery.includes('Water')) {
      return {
        primary: 'blue-600',
        secondary: 'cyan-500',
        light: 'blue-50',
        border: 'blue-200',
        text: 'blue-900'
      };
    } else if (mastery.includes('Fire')) {
      return {
        primary: 'red-600',
        secondary: 'orange-500',
        light: 'red-50',
        border: 'red-200',
        text: 'red-900'
      };
    }

    return {
      primary: 'blue-600',
      secondary: 'blue-500',
      light: 'blue-50', 
      border: 'blue-200',
      text: 'blue-900'
    };
  };

  const handleSubmitScore = async () => {
    if (!selectedPerformance) return;
    
    // Validation: All score fields must be greater than 0 (comments can be empty)
    if (currentScore.technique <= 0 || 
        currentScore.musicality <= 0 || 
        currentScore.performance <= 0 || 
        currentScore.styling <= 0 || 
        currentScore.overallImpression <= 0) {
      setErrorMessage('All score fields must have a value greater than 0. Only comments can be left empty.');
      return;
    }
    
    setIsSubmittingScore(true);
    setErrorMessage('');
    
    // Optimistic update
    const updatedPerformance = {
      ...selectedPerformance,
      hasScore: true,
      judgeScore: {
        technicalScore: currentScore.technique,
        musicalScore: currentScore.musicality,
        performanceScore: currentScore.performance,
        stylingScore: currentScore.styling,
        overallImpressionScore: currentScore.overallImpression,
        comments: currentScore.comments
      }
    };
    
    setPerformances(prev => prev.map(p => 
      p.id === selectedPerformance.id ? updatedPerformance : p
    ));
    
    setSuccessMessage(`Score ${selectedPerformance.hasScore ? 'updated' : 'submitted'} successfully! ✓`);
    setViewMode('list');
    setSelectedPerformance(null);
    
    try {
      const response = await fetch('/api/scores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          performanceId: selectedPerformance.id,
          judgeId: judgeId,
          technique: currentScore.technique,
          musicality: currentScore.musicality,
          performance: currentScore.performance,
          styling: currentScore.styling,
          overallImpression: currentScore.overallImpression,
          comments: currentScore.comments
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        setPerformances(prev => prev.map(p => 
          p.id === selectedPerformance.id ? selectedPerformance : p
        ));
        setErrorMessage(result.error || 'Failed to submit score. Please try again.');
        setSuccessMessage('');
      } else {
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error submitting score:', error);
      setPerformances(prev => prev.map(p => 
        p.id === selectedPerformance.id ? selectedPerformance : p
      ));
      setErrorMessage('Network error. Please check your connection and try again.');
      setSuccessMessage('');
    } finally {
      setIsSubmittingScore(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('judgeSession');
    router.push('/portal/judge');
  };

  // Pagination logic
  const indexOfLastPerformance = currentPage * performancesPerPage;
  const indexOfFirstPerformance = indexOfLastPerformance - performancesPerPage;
  const currentPerformances = filteredPerformances.slice(indexOfFirstPerformance, indexOfLastPerformance);
  const totalPages = Math.ceil(filteredPerformances.length / performancesPerPage);

  const getCompletionStats = () => {
      const scored = performances.filter(p => p.hasScore).length;
      const total = performances.length;
      return { scored, total, percentage: total > 0 ? Math.round((scored / total) * 100) : 0 };
  };

  if (isLoading) {
    return (
      <div className="bg-gray-50 flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-full mx-auto mb-4 flex items-center justify-center animate-pulse">
            <span className="text-white text-lg">⚖️</span>
          </div>
          <p className="text-gray-600 text-lg">Loading judge dashboard...</p>
        </div>
      </div>
    );
  }

  const handlePerformanceReorder = (reordered: any[]) => {
    setPerformances(prev => {
      const updateMap = new Map(reordered.map(r => [r.id, r]));
      const updated = prev.map(p => {
        if (updateMap.has(p.id)) {
          const update = updateMap.get(p.id)!;
          return { 
            ...p, 
            itemNumber: update.itemNumber || p.itemNumber, // Keep permanent item number (for scoring)
            performanceOrder: update.performanceOrder // Update performance order from backstage
          };
        }
        return p;
      });
      
      // Re-sort after updating performance orders
      updated.sort((a, b) => {
        // Primary sort: performanceOrder (backstage sequence)
        if (a.performanceOrder && b.performanceOrder) {
          return a.performanceOrder - b.performanceOrder;
        }
        // Fallback to item number if performanceOrder missing
        if (a.itemNumber && b.itemNumber) {
          return a.itemNumber - b.itemNumber;
        } else if (a.itemNumber && !b.itemNumber) {
          return -1;
        } else if (!a.itemNumber && b.itemNumber) {
          return 1;
        } else {
          return a.title.localeCompare(b.title);
        }
      });
      
      return updated;
    });
  };

  const handlePerformanceStatus = (data: any) => {
    setPerformances(prev => prev.map(p => p.id === data.performanceId ? { ...p, status: data.status } : p));
  };

  return (
    <>
      <RealtimeUpdates eventId="" strictEvent={false} onPerformanceReorder={handlePerformanceReorder} onPerformanceStatus={handlePerformanceStatus}>
      <div className="bg-gray-50">
      {/* Professional Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 mobile-header">
          <div className="flex justify-between items-center py-2 sm:py-3 md:py-4">
              <div className="flex items-center space-x-2 md:space-x-3">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm md:text-lg">⚖️</span>
              </div>
              <div>
                <h1 className="text-lg md:text-2xl font-bold text-black">Judge Dashboard</h1>
                <p className="text-xs md:text-sm text-black">Welcome, {judgeName}</p>
              </div>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-3 mobile-button-stack">
              <Link
                href="/portal/judge"
                className="px-2 py-1 md:px-4 md:py-2 text-black hover:text-gray-700 font-medium transition-colors text-xs sm:text-sm md:text-base"
              >
                Portal
              </Link>
                <button
                onClick={handleLogout}
                className="px-2 py-1 sm:px-3 sm:py-1 md:px-4 md:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs sm:text-sm md:text-base"
                >
                Logout
                </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Alert Messages */}
      {successMessage && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 fade-in">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-green-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-green-800 font-medium">{successMessage}</p>
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 fade-in">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-red-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-red-800 font-medium">{errorMessage}</p>
            </div>
          </div>
        </div>
      )}

              <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-3 sm:py-6">
        {/* Professional Scoring Interface */}
        {viewMode === 'scoring' && selectedPerformance && (
          (() => {
            const colorTheme = getMasteryColorTheme(selectedPerformance.mastery);
            return (
              <div className="bg-white rounded-lg shadow-sm p-6 mb-6 fade-in">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    Score Performance
                  </h2>
                  <button
                    onClick={() => {
                      setViewMode('list');
                      setSelectedPerformance(null);
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    ← Back to List
                  </button>
                </div>

                {/* Performance Details Card */}
                <div className={`bg-${colorTheme.light} border border-${colorTheme.border} rounded-lg p-6 mb-6`}>
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-16 h-16 rounded-lg bg-${colorTheme.primary} flex items-center justify-center text-white font-bold text-xl`}>
                      {selectedPerformance.itemNumber || '?'}
                    </div>
                    <div>
                      <h3 className={`text-xl font-bold text-${colorTheme.text}`}>
                        {selectedPerformance.title}
                      </h3>
                      <p className="text-gray-600">Item #{selectedPerformance.itemNumber || 'Unassigned'}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Contestant</p>
                      <p className="font-semibold text-gray-900">{selectedPerformance.contestantName}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Participants</p>
                      <p className="font-semibold text-gray-900">{selectedPerformance.participantNames.join(', ')}</p>
                    </div>
                    {selectedPerformance.mastery && (
                      <div>
                        <p className="text-gray-600">Mastery</p>
                        <p className={`font-semibold text-${colorTheme.text}`}>{selectedPerformance.mastery}</p>
                      </div>
                    )}
                    {selectedPerformance.ageCategory && (
                      <div>
                        <p className="text-gray-600">Age Category</p>
                        <p className="font-semibold text-gray-900">{selectedPerformance.ageCategory}</p>
                      </div>
                    )}
                    {/* Duration hidden by request */}
                    <div>
                      <p className="text-gray-600">Entry Type</p>
                      <p className="font-semibold text-gray-900 flex items-center">
                        {selectedPerformance.entryType === 'virtual' ? (
                          <>
                            <span className="mr-1">📹</span>
                            Virtual Performance
                          </>
                        ) : (
                          <>
                            <span className="mr-1">🎵</span>
                            Live Performance
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* PHASE 2: Media Display for Live/Virtual Entries */}
                  {selectedPerformance.entryType === 'virtual' && selectedPerformance.videoExternalUrl && (
                    <div className="mt-6">
                      <VideoPlayer
                        videoUrl={selectedPerformance.videoExternalUrl}
                        videoType={selectedPerformance.videoExternalType || 'other'}
                        title={selectedPerformance.title}
                        className="w-full"
                      />
                    </div>
                  )}

                  {selectedPerformance.entryType === 'live' && selectedPerformance.musicFileUrl && (
                    <div className="mt-6">
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-black flex items-center mb-3">
                          <span className="mr-2">🎵</span>
                          Performance Music
                        </h3>
                        <MusicPlayer
                          musicUrl={selectedPerformance.musicFileUrl}
                          filename={selectedPerformance.musicFileName || 'performance-music.mp3'}
                          className="w-full"
                          showDownload={true}
                        />
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-700">
                            <strong>Judge Instructions:</strong> Listen to the performance music to understand timing, rhythm, and musical interpretation for accurate scoring.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Scoring Form */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-6">
                    {/* Technical Execution */}
                    <div>
                      <label className="block text-lg font-semibold text-gray-900 mb-2">
                        Technical Execution *
                      </label>
                      <input
                        type="text"
                        value={formatScoreDisplay(currentScore.technique)}
                        onChange={(e) => {
                          const validated = validateNumberInput(e.target.value);
                          handleScoreChange('technique', validated);
                        }}
                        onBlur={(e) => {
                          const validated = validateNumberInput(e.target.value);
                          handleScoreChange('technique', validated);
                        }}
                        className="score-input w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none text-center text-xl font-semibold"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1 text-center">0-20 points (required)</p>
                    </div>

                    {/* Musical Interpretation */}
                    <div>
                      <label className="block text-lg font-semibold text-gray-900 mb-2">
                        Musical Interpretation *
                      </label>
                      <input
                        type="text"
                        value={formatScoreDisplay(currentScore.musicality)}
                        onChange={(e) => {
                          const validated = validateNumberInput(e.target.value);
                          handleScoreChange('musicality', validated);
                        }}
                        onBlur={(e) => {
                          const validated = validateNumberInput(e.target.value);
                          handleScoreChange('musicality', validated);
                        }}
                        className="score-input w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none text-center text-xl font-semibold"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1 text-center">0-20 points (required)</p>
                    </div>

                    {/* Performance Quality */}
                    <div>
                      <label className="block text-lg font-semibold text-gray-900 mb-2">
                        Performance Quality *
                      </label>
                      <input
                        type="text"
                        value={formatScoreDisplay(currentScore.performance)}
                        onChange={(e) => {
                          const validated = validateNumberInput(e.target.value);
                          handleScoreChange('performance', validated);
                        }}
                        onBlur={(e) => {
                          const validated = validateNumberInput(e.target.value);
                          handleScoreChange('performance', validated);
                        }}
                        className="score-input w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none text-center text-xl font-semibold"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1 text-center">0-20 points (required)</p>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
                    {/* Styling & Presentation */}
                    <div>
                      <label className="block text-lg font-semibold text-gray-900 mb-2">
                        Styling & Presentation *
                      </label>
                      <input
                        type="text"
                        value={formatScoreDisplay(currentScore.styling)}
                        onChange={(e) => {
                          const validated = validateNumberInput(e.target.value);
                          handleScoreChange('styling', validated);
                        }}
                        onBlur={(e) => {
                          const validated = validateNumberInput(e.target.value);
                          handleScoreChange('styling', validated);
                        }}
                        className="score-input w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none text-center text-xl font-semibold"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1 text-center">0-20 points (required)</p>
                    </div>

                    {/* Overall Impression */}
                    <div>
                      <label className="block text-lg font-semibold text-gray-900 mb-2">
                        Overall Impression *
                      </label>
                      <input
                        type="text"
                        value={formatScoreDisplay(currentScore.overallImpression)}
                        onChange={(e) => {
                          const validated = validateNumberInput(e.target.value);
                          handleScoreChange('overallImpression', validated);
                        }}
                        onBlur={(e) => {
                          const validated = validateNumberInput(e.target.value);
                          handleScoreChange('overallImpression', validated);
                        }}
                        className="score-input w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none text-center text-xl font-semibold"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1 text-center">0-20 points (required)</p>
                    </div>

                    {/* Comments */}
                    <div>
                      <label className="block text-lg font-semibold text-gray-900 mb-2">
                        Comments (Optional)
                      </label>
                      <textarea
                        value={currentScore.comments}
                        onChange={(e) => handleScoreChange('comments', e.target.value)}
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Additional feedback (not required)..."
                      />
                      <p className="text-xs text-gray-500 mt-1">Optional field - can be left empty</p>
                    </div>
                  </div>
                </div>

                {/* Total Score Display */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-gray-900">Total Score:</span>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-blue-600">
                        {(currentScore.technique + currentScore.musicality + currentScore.performance + currentScore.styling + currentScore.overallImpression).toFixed(1)}/100
                      </span>
                      <p className="text-sm text-gray-600">
                        {((currentScore.technique + currentScore.musicality + currentScore.performance + currentScore.styling + currentScore.overallImpression)).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={handleSubmitScore}
                    disabled={isSubmittingScore}
                    className={`mobile-submit-button px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors min-w-[200px] ${isSubmittingScore ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {isSubmittingScore ? 'Submitting...' : (selectedPerformance.hasScore ? 'Update Score' : 'Submit Score')}
                  </button>
                </div>
              </div>
            );
          })()
        )}

        {/* Main Dashboard */}
        {viewMode === 'list' && (
          <>
            {/* Assignment Overview */}
            <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 md:p-6 mb-3 sm:mb-4 md:mb-6">
              <div className="flex flex-col gap-3 mb-4 md:mb-6">
                <h2 className="text-lg md:text-xl font-bold text-black">Event Assignments</h2>
                <span className="text-xs text-gray-500">Live updating… Last sync {lastSyncAt || '—'}</span>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <span className="text-xs md:text-sm text-black font-medium">
                    {getCompletionStats().scored} of {getCompletionStats().total} scored ({getCompletionStats().percentage}%)
                  </span>
                  <div className="w-full sm:w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${getCompletionStats().percentage}%` }}
                    />
                  </div>
                </div>
              </div>

              {assignments.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {assignments.map((assignment) => (
                    <div key={assignment.eventId} className="bg-blue-50 border border-blue-200 rounded-lg p-3 md:p-4">
                      <div className="flex items-center justify-between mb-2 md:mb-3">
                        <h3 className="font-semibold text-black text-sm md:text-base">{assignment.event.name}</h3>
                        <span className="text-blue-600 text-sm md:text-base">🎭</span>
                      </div>
                      <div className="space-y-1 text-xs md:text-sm text-black">
                        <p>Date: {new Date(assignment.event.eventDate).toLocaleDateString()}</p>
                        <p>Venue: {assignment.event.venue}</p>
                        <p>Status: <span className="text-green-600 font-medium">Active</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 md:py-8">
                  <div className="text-3xl md:text-4xl mb-2 md:mb-3">📋</div>
                  <p className="text-black text-sm md:text-base">No assignments yet</p>
                  <p className="text-xs md:text-sm text-black mt-1">Assignments will appear here once events are assigned</p>
                </div>
              )}
            </div>
            
            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-4 md:mb-6 mobile-hide-quick-actions">
              <h3 className="text-base md:text-lg font-semibold text-black mb-3 md:mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <div className="flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-3">
                  <label className="text-xs md:text-sm font-medium text-black">Jump to Item:</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={itemNumberSearch}
                      onChange={(e) => setItemNumberSearch(e.target.value.replace(/[^0-9]/g, ''))}
                      onKeyPress={handleItemNumberSearchKeyPress}
                      placeholder="Item #"
                      className="px-2 py-1 md:px-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center w-16 md:w-20 text-sm"
                    />
                    <button
                      onClick={() => {
                        const itemNum = parseInt(itemNumberSearch);
                        if (!isNaN(itemNum)) {
                          loadPerformanceByItemNumber(itemNum);
                        }
                      }}
                      className="px-3 py-1 md:px-4 md:py-2 bg-blue-600 text-white text-xs md:text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Go
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-3">
                  <label className="text-xs md:text-sm font-medium text-black">Status:</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as 'all' | 'scored' | 'completed')}
                    className="px-2 py-1 md:px-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs md:text-sm"
                  >
                    <option value="all">To Score</option>
                    <option value="scored">My Scores</option>
                    <option value="completed">Fully Completed</option>
                  </select>
                </div>

                <div className="flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-3">
                  <label className="text-xs md:text-sm font-medium text-black">Type:</label>
                  <select
                    value={entryTypeFilter}
                    onChange={(e) => setEntryTypeFilter(e.target.value as 'all' | 'live' | 'virtual')}
                    className="px-2 py-1 md:px-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs md:text-sm"
                  >
                    <option value="all">All Entries</option>
                    <option value="live">Live Only</option>
                    <option value="virtual">Virtual Only</option>
                  </select>
                </div>
                
                <input 
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search performances..."
                  className="px-2 py-1 md:px-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs md:text-sm"
                />
              </div>
            </div>

            {/* Performances List */}
            <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 md:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 sm:mb-4 md:mb-6 gap-2">
                <h2 className="text-base sm:text-lg md:text-xl font-bold text-black">Performances to Score</h2>
                <span className="text-xs md:text-sm text-black font-medium">
                  {filteredPerformances.length} performance{filteredPerformances.length !== 1 ? 's' : ''}
                </span>
              </div>

              {filteredPerformances.length > 0 ? (
                <>
                  <div className="space-y-3">
                    {currentPerformances.map((performance) => {
                      const colorTheme = getMasteryColorTheme(performance.mastery);
                      
                      return (
                        <div 
                          key={performance.id} 
                          className={`border border-${colorTheme.border} rounded-lg p-4 md:p-4 mobile-performance-card hover:shadow-md transition-shadow bg-${colorTheme.light}/30`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center space-x-3">
                              <div className={`w-12 h-12 md:w-12 md:h-12 mobile-item-circle rounded-lg bg-${colorTheme.primary} flex items-center justify-center text-white font-bold`}>
                                {performance.itemNumber || '?'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-black text-lg md:text-lg mobile-performance-title truncate uppercase">
                                  #{performance.itemNumber || '?'} — {performance.title}
                                </h3>
                                <p className="text-black mobile-performance-details truncate text-xs sm:text-sm hidden sm:block">{performance.participantNames.join(', ')}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  {performance.mastery && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                      {performance.mastery}
                                    </span>
                                  )}
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    performance.entryType === 'virtual' 
                                      ? 'bg-purple-100 text-purple-800' 
                                      : 'bg-blue-100 text-blue-800'
                                  }`}>
                                    {performance.entryType === 'virtual' ? '📹 Virtual' : '🎭 Live'}
                                  </span>
                                  <button 
                                    className="sm:hidden text-xs text-blue-600 underline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Toggle participant names visibility on mobile
                                      const details = e.currentTarget.parentElement?.parentElement?.querySelector('.mobile-participants');
                                      if (details) {
                                        details.classList.toggle('hidden');
                                      }
                                    }}
                                  >
                                    Dancers
                                  </button>
                                </div>
                                <p className="mobile-participants hidden text-black text-xs mt-1 sm:hidden">{performance.participantNames.join(', ')}</p>
                              </div>
                            </div>
                            <div className="flex flex-col md:flex-row items-end md:items-center space-y-2 md:space-y-0 md:space-x-3 flex-shrink-0">
                              {performance.hasScore ? (
                                <div className="flex flex-col items-end">
                                  <span className="inline-flex items-center px-3 py-1 md:px-3 md:py-1 mobile-status-badge rounded-full text-xs md:text-sm font-medium bg-green-100 text-green-800">
                                    ✓ Scored
                                  </span>
                                  {performance.judgeScore && (
                                    <span className="text-xs text-gray-600 mt-1">
                                      Total: {(
                                        (performance.judgeScore.technicalScore || 0) +
                                        (performance.judgeScore.musicalScore || 0) +
                                        (performance.judgeScore.performanceScore || 0) +
                                        (performance.judgeScore.stylingScore || 0) +
                                        (performance.judgeScore.overallImpressionScore || 0)
                                      ).toFixed(1)}/100
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 md:px-3 md:py-1 mobile-status-badge rounded-full text-xs md:text-sm font-medium bg-yellow-100 text-yellow-800">
                                  Pending
                                </span>
                              )}
                              <button
                                onClick={() => handleStartScoring(performance)}
                                className={`px-3 py-2 md:px-4 md:py-2 mobile-score-button text-white font-medium rounded-lg transition-colors ${
                                  performance.hasScore 
                                    ? 'bg-blue-600 hover:bg-blue-700' // Allow viewing scores
                                    : `bg-${colorTheme.primary} hover:bg-${colorTheme.secondary}`
                                } whitespace-nowrap`}
                              >
                                {performance.hasScore ? 'View Score' : 'Score'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-4 md:mt-6 flex justify-center">
                      <nav className="flex items-center space-x-1 md:space-x-2">
                        <button
                          onClick={() => setCurrentPage(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="px-2 py-1 md:px-3 md:py-2 text-xs md:text-sm font-medium text-black bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        {[...Array(totalPages)].map((_, index) => (
                          <button
                            key={index}
                            onClick={() => setCurrentPage(index + 1)}
                            className={`px-2 py-1 md:px-3 md:py-2 text-xs md:text-sm font-medium rounded-lg ${
                              currentPage === index + 1
                                ? 'bg-blue-600 text-white'
                                : 'text-black bg-white border border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {index + 1}
                          </button>
                        ))}
                        <button
                          onClick={() => setCurrentPage(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="px-2 py-1 md:px-3 md:py-2 text-xs md:text-sm font-medium text-black bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                        >
                          Next
                        </button>
                      </nav>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 md:py-12">
                  <div className="text-3xl md:text-4xl mb-2 md:mb-3">🎯</div>
                  <p className="text-black text-sm md:text-base">No performances found</p>
                  <p className="text-xs md:text-sm text-black mt-1">
                    {filterStatus === 'all' ? 'All assigned performances have been scored!' : 'Performances will appear once events are created'}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </RealtimeUpdates>
    </>
  );
} 