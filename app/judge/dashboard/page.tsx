'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

interface NationalsAssignment {
  id: string;
  judgeId: string;
  nationalsEventId: string;
  assignedBy: string;
  assignedAt: string;
  judgeName: string;
  judgeEmail: string;
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
  itemNumber?: number;
}

interface NationalsPerformance {
  id: string;
  nationalsEventId: string;
  entryId: string;
  itemName: string;
  contestantName: string;
  participantNames: string[];
  choreographer: string;
  mastery: string;
  itemStyle: string;
  performanceType: string;
  ageCategory: string;
  itemNumber?: number;
  duration: number;
  soloCount?: number;
  status: string;
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
}

interface NationalsPerformanceWithScore extends NationalsPerformance {
  hasScore?: boolean;
  judgeScore?: any;
  isFullyScored?: boolean;
  scoringStatus?: any;
}

export default function JudgeDashboard() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [nationalsAssignments, setNationalsAssignments] = useState<NationalsAssignment[]>([]);
  const [performances, setPerformances] = useState<PerformanceWithScore[]>([]);
  const [nationalsPerformances, setNationalsPerformances] = useState<NationalsPerformanceWithScore[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedPerformance, setSelectedPerformance] = useState<PerformanceWithScore | null>(null);
  const [selectedNationalsPerformance, setSelectedNationalsPerformance] = useState<NationalsPerformanceWithScore | null>(null);
  const [filteredPerformances, setFilteredPerformances] = useState<PerformanceWithScore[]>([]);
  const [filteredNationalsPerformances, setFilteredNationalsPerformances] = useState<NationalsPerformanceWithScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [judgeName, setJudgeName] = useState('');
  const [judgeId, setJudgeId] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'scoring'>('list');
  const [activeTab, setActiveTab] = useState<'regional' | 'nationals'>('regional');
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
  const [filterStatus, setFilterStatus] = useState<'all' | 'not_scored' | 'scored'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [performancesPerPage] = useState(6);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemNumberSearch, setItemNumberSearch] = useState('');
  const router = useRouter();
  const { showAlert } = useAlert();

  const filterAndLoadNationalsPerformances = () => {
    // Start with ALL nationals performances
    let filtered = [...nationalsPerformances];
    
    // Apply status filter
    if (filterStatus === 'scored') {
      filtered = filtered.filter(p => p.isFullyScored); // Only show fully scored performances
    } else if (filterStatus === 'not_scored') {
      filtered = filtered.filter(p => !p.hasScore); // Show performances this judge hasn't scored
    }

    // Apply search term filter (name, title)
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.itemName.toLowerCase().includes(lowerSearchTerm) ||
        p.contestantName.toLowerCase().includes(lowerSearchTerm) ||
        (p.participantNames && p.participantNames.some(name => name.toLowerCase().includes(lowerSearchTerm)))
      );
    }

    // Apply item number search
    if (itemNumberSearch) {
      const itemNum = parseInt(itemNumberSearch);
      if (!isNaN(itemNum)) {
        filtered = filtered.filter(p => p.itemNumber === itemNum);
      }
    }

    // Already sorted by item number in loadJudgeData - maintain program order
    setFilteredNationalsPerformances(filtered);
    setCurrentPage(1); // Reset to first page when filtering
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
    // Filter performances when any filter changes
    filterAndLoadPerformances();
    filterAndLoadNationalsPerformances();
  }, [performances, nationalsPerformances, filterStatus, searchTerm, itemNumberSearch]);

  const loadJudgeData = async (judgeId: string) => {
    setIsLoading(true);
    try {
      // Load regional judge assignments
      const assignmentsResponse = await fetch(`/api/judges/${judgeId}/assignments`);
      if (assignmentsResponse.ok) {
        const assignmentsData = await assignmentsResponse.json();
        setAssignments(assignmentsData.assignments || []);
        
        // Load ALL performances for all assigned regional events
        const allPerformances: PerformanceWithScore[] = [];
        for (const assignment of assignmentsData.assignments || []) {
          const performancesResponse = await fetch(`/api/events/${assignment.eventId}/performances`);
          if (performancesResponse.ok) {
            const performancesData = await performancesResponse.json();
            
            // Check score status for each performance
            for (const performance of performancesData.performances || []) {
              // Check if this judge has scored this performance
              const scoreResponse = await fetch(`/api/scores/${performance.id}/${judgeId}`);
              const scoreData = await scoreResponse.json();
              
              // Check the complete scoring status (all judges)
              const scoringStatusResponse = await fetch(`/api/scores/performance/${performance.id}`);
              const scoringStatusData = await scoringStatusResponse.json();
              
              allPerformances.push({
                ...performance,
                hasScore: scoreData.success && scoreData.score, // Judge's individual score status
                judgeScore: scoreData.score,
                isFullyScored: scoringStatusData.success ? scoringStatusData.scoringStatus.isFullyScored : false, // All judges scored
                scoringStatus: scoringStatusData.success ? scoringStatusData.scoringStatus : null
              });
            }
          }
        }
        
        // Sort by item number for program order
        allPerformances.sort((a, b) => {
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

      // Load nationals judge assignments
      const nationalsAssignmentsResponse = await fetch(`/api/nationals/judges/${judgeId}/assignments`);
      if (nationalsAssignmentsResponse.ok) {
        const nationalsAssignmentsData = await nationalsAssignmentsResponse.json();
        setNationalsAssignments(nationalsAssignmentsData.assignments || []);
        
        // Load ALL nationals performances for all assigned nationals events
        const allNationalsPerformances: NationalsPerformanceWithScore[] = [];
        for (const assignment of nationalsAssignmentsData.assignments || []) {
          const performancesResponse = await fetch(`/api/nationals/performances?eventId=${assignment.nationalsEventId}`);
          if (performancesResponse.ok) {
            const performancesData = await performancesResponse.json();
            
            // Check score status for each nationals performance
            for (const performance of performancesData.performances || []) {
              // Check if this judge has scored this performance
              const scoreResponse = await fetch(`/api/nationals/scores/${performance.id}/${judgeId}`);
              const scoreData = await scoreResponse.json();
              
              allNationalsPerformances.push({
                ...performance,
                hasScore: scoreData.success && scoreData.score, // Judge's individual score status
                judgeScore: scoreData.score,
                isFullyScored: false, // TODO: Implement full scoring status for nationals
                scoringStatus: null
              });
            }
          }
        }
        
        // Sort by item number for program order
        allNationalsPerformances.sort((a, b) => {
          if (a.itemNumber && b.itemNumber) {
            return a.itemNumber - b.itemNumber;
          } else if (a.itemNumber && !b.itemNumber) {
            return -1;
          } else if (!a.itemNumber && b.itemNumber) {
            return 1;
          } else {
            return a.itemName.localeCompare(b.itemName);
          }
        });
        
        setNationalsPerformances(allNationalsPerformances);
        setFilteredNationalsPerformances(allNationalsPerformances);
      }
    } catch (error) {
      console.error('Error loading judge data:', error);
      setErrorMessage('Failed to load judge data. Please refresh the page.');
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndLoadPerformances = () => {
    // Start with ALL performances (merged list)
    let filtered = [...performances];
    
    // Apply status filter
    if (filterStatus === 'scored') {
      filtered = filtered.filter(p => p.isFullyScored); // Only show fully scored performances
    } else if (filterStatus === 'not_scored') {
      filtered = filtered.filter(p => !p.hasScore); // Show performances this judge hasn't scored
    }

    // Apply search term filter (name, title)
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(lowerSearchTerm) ||
        p.contestantName.toLowerCase().includes(lowerSearchTerm) ||
        (p.participantNames && p.participantNames.some(name => name.toLowerCase().includes(lowerSearchTerm)))
      );
    }

    // Apply item number search
    if (itemNumberSearch) {
      const itemNum = parseInt(itemNumberSearch);
      if (!isNaN(itemNum)) {
        filtered = filtered.filter(p => p.itemNumber === itemNum);
      }
    }

    // Already sorted by item number in loadJudgeData - maintain program order
    setFilteredPerformances(filtered);
    setCurrentPage(1); // Reset to first page when filtering
  };

  const loadPerformanceByItemNumber = (itemNumber: number) => {
    if (activeTab === 'nationals') {
      const performance = nationalsPerformances.find(p => p.itemNumber === itemNumber);
      if (performance) {
        handleStartNationalsScoring(performance);
      } else {
        showAlert(`No nationals performance found with item number ${itemNumber}`, 'warning');
      }
    } else {
      const performance = performances.find(p => p.itemNumber === itemNumber);
      if (performance) {
        handleStartScoring(performance);
      } else {
        showAlert(`No regional performance found with item number ${itemNumber}`, 'warning');
      }
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
    setSelectedNationalsPerformance(null);
    setViewMode('scoring');
    
    // Pre-populate with existing score if available
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

  const handleStartNationalsScoring = (performance: NationalsPerformanceWithScore) => {
    setSelectedNationalsPerformance(performance);
    setSelectedPerformance(null);
    setViewMode('scoring');
    
    // Pre-populate with existing score if available
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
    setCurrentScore(prev => ({ ...prev, [category]: value }));
  };

  const handleSubmitScore = async () => {
    if (!selectedPerformance && !selectedNationalsPerformance) return;
    
    setIsSubmittingScore(true);
    setErrorMessage('');
    
    try {
      const isNationals = !!selectedNationalsPerformance;
      const performance = isNationals ? selectedNationalsPerformance! : selectedPerformance!;
      const apiEndpoint = isNationals ? '/api/nationals/scores' : '/api/scores';
      const performanceTitle = isNationals ? 
        (selectedNationalsPerformance as NationalsPerformanceWithScore).itemName : 
        (selectedPerformance as PerformanceWithScore).title;
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          performanceId: performance.id,
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
      
      if (response.ok) {
        setSuccessMessage(`${isNationals ? 'Nationals' : 'Regional'} score ${performance.hasScore ? 'updated' : 'submitted'} successfully for "${performanceTitle}"`);
        setViewMode('list');
        setSelectedPerformance(null);
        setSelectedNationalsPerformance(null);
        
        // Refresh performances to update score status
        await loadJudgeData(judgeId);
        
        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(''), 5000);
      } else {
        setErrorMessage(result.error || 'Failed to submit score. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting score:', error);
      setErrorMessage('Network error. Please check your connection and try again.');
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
    if (activeTab === 'nationals') {
      const scored = nationalsPerformances.filter(p => p.hasScore).length;
      const total = nationalsPerformances.length;
      return { scored, total, percentage: total > 0 ? Math.round((scored / total) * 100) : 0 };
    } else {
      const scored = performances.filter(p => p.hasScore).length;
      const total = performances.length;
      return { scored, total, percentage: total > 0 ? Math.round((scored / total) * 100) : 0 };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full mx-auto mb-6 flex items-center justify-center animate-pulse">
            <span className="text-white text-2xl">⚖️</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Loading Judge Dashboard</h2>
          <p className="text-gray-600">Preparing your judging assignments...</p>
        </div>
      </div>
    );
  }

  if (viewMode === 'scoring' && (selectedPerformance || selectedNationalsPerformance)) {
    const isNationals = !!selectedNationalsPerformance;
    const currentPerformanceData = isNationals ? selectedNationalsPerformance! : selectedPerformance!;
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        {/* Scoring Header */}
        <header className="bg-white/95 backdrop-blur-lg shadow-lg border-b border-purple-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setViewMode('list')}
                  className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  <span className="text-xl">←</span>
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {currentPerformanceData.hasScore ? 'Update Score' : 'Score Performance'}
                  </h1>
                  <p className="text-gray-700 font-medium">
                    {isNationals ? 
                      (currentPerformanceData as NationalsPerformanceWithScore).itemName :
                      (currentPerformanceData as PerformanceWithScore).title}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-700 font-medium">Judge: {judgeName}</p>
                <p className="text-sm text-gray-700 font-medium">Duration: {currentPerformanceData.duration} min</p>
                {currentPerformanceData.hasScore && (
                  <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full mt-1">
                    Previously Scored
                  </span>
                )}
                {isNationals && (
                  <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full mt-1">
                    🏆 NATIONALS
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-8">
            {/* Performance Details Section */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500 to-pink-600 px-6 py-4">
                <h3 className="text-white font-bold text-lg">Performance Information</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-700 font-medium">Contestant:</span>
                    <p className="font-bold text-gray-900">{currentPerformanceData.contestantName || 'Loading...'}</p>
                  </div>
                  <div>
                    <span className="text-gray-700 font-medium">Participants:</span>
                    <p className="font-bold text-gray-900">{currentPerformanceData.participantNames?.join(', ') || 'Loading...'}</p>
                  </div>
                  <div>
                    <span className="text-gray-700 font-medium">Style:</span>
                    <p className="font-bold text-gray-900">{currentPerformanceData.itemStyle || 'Not specified'}</p>
                  </div>
                  <div>
                    <span className="text-gray-700 font-medium">Mastery:</span>
                    <p className="font-bold text-gray-900">{currentPerformanceData.mastery || 'Not specified'}</p>
                  </div>
                  <div>
                    <span className="text-gray-700 font-medium">Duration:</span>
                    <p className="font-bold text-gray-900">{currentPerformanceData.duration} minutes</p>
                  </div>
                  <div>
                    <span className="text-gray-700 font-medium">Choreographer:</span>
                    <p className="font-bold text-gray-900">
                      {isNationals ? 
                        (currentPerformanceData as NationalsPerformanceWithScore).choreographer :
                        (currentPerformanceData as PerformanceWithScore).choreographer || 'Not specified'}
                    </p>
                  </div>
                  {isNationals && (
                    <>
                      <div>
                        <span className="text-gray-700 font-medium">Performance Type:</span>
                        <p className="font-bold text-gray-900">{(currentPerformanceData as NationalsPerformanceWithScore).performanceType}</p>
                      </div>
                      <div>
                        <span className="text-gray-700 font-medium">Age Category:</span>
                        <p className="font-bold text-gray-900">{(currentPerformanceData as NationalsPerformanceWithScore).ageCategory}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Scoring Section */}
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4">
                  <h3 className="text-white font-bold text-lg">Score Performance</h3>
                </div>
                <div className="p-6 space-y-6">
                  {/* Scoring Categories */}
                  {[
                    { key: 'technique', label: 'Technique', description: 'Execution, precision, skill level' },
                    { key: 'musicality', label: 'Musicality', description: 'Rhythm, harmony, expression' },
                    { key: 'performance', label: 'Performance', description: 'Stage presence, costume, confidence' },
                    { key: 'styling', label: 'Styling', description: 'Costume, makeup, overall appearance' },
                    { key: 'overallImpression', label: 'Overall Impression', description: 'First impression, lasting impact' }
                  ].map(({ key, label, description }) => (
                    <div key={key} className="space-y-3">
                                            <div>
                        <label className="block text-sm font-bold text-gray-900 mb-1">
                          {label}
                        </label>
                        <p className="text-xs text-gray-700">{description}</p>
                      </div>
                      
                      {/* Score Input */}
                       <div className="flex items-center space-x-4">
                         <input
                           type="number"
                           min="0"
                           max="20"
                           value={currentScore[key as keyof Score] || ''}
                           onChange={(e) => {
                             const value = Math.min(20, Math.max(0, parseInt(e.target.value) || 0));
                             handleScoreChange(key as keyof Score, value);
                           }}
                           className="w-20 px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-center font-bold text-xl text-gray-900 bg-white shadow-sm"
                           placeholder="0"
                           style={{ color: '#111827' }}
                         />
                         <span className="text-sm text-gray-800 font-medium">/ 20 points</span>
                         <div className="flex-1 bg-gray-200 rounded-full h-2">
                           <div 
                             className="bg-gradient-to-r from-purple-500 to-pink-600 h-2 rounded-full transition-all duration-300"
                             style={{ width: `${((currentScore[key as keyof Score] as number || 0) / 20) * 100}%` }}
                           ></div>
                         </div>
                       </div>
                       <div className="text-right">
                         <span className="text-sm text-gray-800 font-medium">
                           Score: <span className="font-bold text-purple-700">{currentScore[key as keyof Score] as number || 0} / 20</span>
                         </span>
                       </div>
                    </div>
                  ))}

                  {/* Overall Score Display */}
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-900 mb-2">Judge Score</label>
                        <div className="text-3xl font-bold text-purple-600">
                          {(currentScore.technique + currentScore.musicality + currentScore.performance + currentScore.styling + currentScore.overallImpression).toFixed(0)} / 100
                        </div>
                        <p className="text-xs text-gray-700 mt-1 font-medium">Sum of all criteria (5 × 20 = 100 max)</p>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-900 mb-2">Percentage & Ranking</label>
                        <div className="text-2xl font-bold text-indigo-700">
                          {((currentScore.technique + currentScore.musicality + currentScore.performance + currentScore.styling + currentScore.overallImpression)).toFixed(0)}%
                        </div>
                        <div className="mt-2">
                          {(() => {
                            const percentage = currentScore.technique + currentScore.musicality + currentScore.performance + currentScore.styling + currentScore.overallImpression;
                            let rank = '';
                            let color = '';
                            if (percentage >= 90) {
                              rank = 'Pro Gold';
                              color = 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white';
                            } else if (percentage >= 80) {
                              rank = 'Gold';
                              color = 'bg-gradient-to-r from-yellow-500 to-yellow-700 text-white';
                            } else if (percentage >= 75) {
                              rank = 'Silver Plus';
                              color = 'bg-gradient-to-r from-gray-300 to-gray-500 text-white';
                            } else if (percentage >= 70) {
                              rank = 'Silver';
                              color = 'bg-gradient-to-r from-gray-400 to-gray-600 text-white';
                            } else if (percentage > 0) {
                              rank = 'Bronze';
                              color = 'bg-gradient-to-r from-orange-400 to-orange-600 text-white';
                            }
                            
                            return rank ? (
                              <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${color}`}>
                                {rank}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 text-xs text-gray-700 font-medium">
                      <p><strong>Ranking System:</strong> Bronze (≤69) • Silver (70-74) • Silver Plus (75-79) • Gold (80-89) • Pro Gold (90+)</p>
                      <p><strong>Final Score:</strong> 3 judges × 100 points = 300 max → converted to percentage</p>
                    </div>
                  </div>

                  {/* Comments */}
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      Comments (Optional)
                    </label>
                    <textarea
                      value={currentScore.comments}
                      onChange={(e) => handleScoreChange('comments', e.target.value)}
                      className="w-full h-24 px-3 py-2 border-2 border-gray-400 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none text-gray-900 bg-white shadow-sm font-medium"
                      placeholder="Add constructive feedback for the participant..."
                      style={{ color: '#111827' }}
                    />
                  </div>
          
                  {/* Error Message */}
                  {errorMessage && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                      <p className="text-red-800 text-sm">{errorMessage}</p>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    onClick={handleSubmitScore}
                    disabled={isSubmittingScore || currentScore.technique === 0 || currentScore.musicality === 0 || currentScore.performance === 0 || currentScore.styling === 0 || currentScore.overallImpression === 0}
                    className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 shadow-lg"
                  >
                    {isSubmittingScore ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>{currentPerformanceData.hasScore ? 'Updating Score...' : 'Submitting Score...'}</span>
                      </div>
                    ) : (
                      currentPerformanceData.hasScore ? 'Update Score' : 'Submit Score'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        {/* Header */}
      <header className="bg-white/95 backdrop-blur-lg shadow-lg border-b border-purple-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white text-2xl">⚖️</span>
              </div>
            <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Judge Dashboard
                </h1>
                <p className="text-gray-700 font-semibold">Welcome, {judgeName}</p>
              </div>
            </div>
              <button
                onClick={handleLogout}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl hover:from-red-600 hover:to-pink-700 transition-all transform hover:scale-105 shadow-lg font-medium"
              >
              <span>🚪</span>
              <span>Logout</span>
              </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-center">
              <span className="text-green-600 mr-2">✅</span>
              <p className="text-green-800 font-medium">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl mb-8 border border-purple-100">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('regional')}
              className={`flex-1 px-6 py-4 text-center font-semibold rounded-tl-2xl transition-all ${
                activeTab === 'regional'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white'
                  : 'text-gray-700 hover:bg-purple-50'
              }`}
            >
              🏆 Regional Events ({assignments.length})
            </button>
            <button
              onClick={() => setActiveTab('nationals')}
              className={`flex-1 px-6 py-4 text-center font-semibold rounded-tr-2xl transition-all ${
                activeTab === 'nationals'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white'
                  : 'text-gray-700 hover:bg-purple-50'
              }`}
            >
              🏅 Nationals Events ({nationalsAssignments.length})
            </button>
          </div>
        </div>

        {/* Regional Tab Content */}
        {activeTab === 'regional' && (
          <>
            {/* Regional Assignment Overview */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-8 border border-purple-100">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white">🏆</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Your Regional Assignment</h2>
          </div>

          {assignments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {assignments.map((assignment) => (
                <div key={assignment.eventId} className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4">
                  <h3 className="font-bold text-gray-900 mb-2">{assignment.event.name}</h3>
                  <p className="text-sm text-gray-700 mb-1">📅 {new Date(assignment.event.eventDate).toLocaleDateString()}</p>
                  <p className="text-sm text-gray-700">📍 {assignment.event.venue}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-amber-800 font-medium">No regional assignments yet.</p>
              <p className="text-amber-700 text-sm">Please contact an administrator to get assigned to a region.</p>
            </div>
          )}
        </div>
            
        {/* Performances to Judge */}
        {assignments.length > 0 && (
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden border border-purple-100">
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 px-6 py-4 border-b border-purple-100">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                    <span className="text-white">🎭</span>
                  </div>
                            <div>
                    <h2 className="text-xl font-bold text-gray-900">Competition Program - All Performances</h2>
                    {(() => {
                      const stats = getCompletionStats();
                      return (
                        <p className="text-sm text-gray-700 font-medium">
                          Progress: {stats.scored}/{stats.total} completed ({stats.percentage}%) • Mixed list in program order
                        </p>
                      );
                    })()}
                  </div>
                </div>
                
                {/* Progress Bar */}
                {(() => {
                  const stats = getCompletionStats();
                  return (
                    <div className="w-32">
                      <div className="bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-green-500 to-emerald-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${stats.percentage}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-700 font-medium mt-1 text-center">{stats.percentage}%</p>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="p-6">
              {/* Filter Controls and Search */}
              <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                {/* Filter Buttons */}
                <div className="flex space-x-2 flex-wrap justify-center">
                  <button
                    onClick={() => setFilterStatus('all')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      filterStatus === 'all' 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    All ({filteredPerformances.length})
                  </button>
                  <button
                    onClick={() => setFilterStatus('not_scored')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      filterStatus === 'not_scored' 
                        ? 'bg-orange-600 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Not Scored ({performances.filter(p => !p.hasScore).length})
                  </button>
                  <button
                    onClick={() => setFilterStatus('scored')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      filterStatus === 'scored' 
                        ? 'bg-green-600 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Fully Scored ({performances.filter(p => p.isFullyScored).length})
                  </button>
                </div>

                {/* Search Inputs */}
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                  <div className="flex-1 md:w-48">
                    <input 
                      type="text"
                      placeholder="Search by name, title..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-sm font-medium text-gray-900 bg-white"
                    />
                  </div>
                  <div className="flex-1 md:w-32">
                    <input 
                      type="number"
                      placeholder="Item #"
                      value={itemNumberSearch}
                      onChange={(e) => setItemNumberSearch(e.target.value)}
                      onKeyPress={handleItemNumberSearchKeyPress}
                      className="w-full px-4 py-2 border-2 border-purple-400 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-sm font-bold text-gray-900 bg-white"
                    />
                  </div>
                  <button
                    onClick={() => {
                      const itemNum = parseInt(itemNumberSearch);
                      if (!isNaN(itemNum)) {
                        loadPerformanceByItemNumber(itemNum);
                      }
                    }}
                    disabled={!itemNumberSearch || isNaN(parseInt(itemNumberSearch))}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
                  >
                    Load
                  </button>
                </div>
              </div>

              {/* Pagination Info (moved slightly for better layout with search) */}
              {totalPages > 1 && (
                  <div className="text-sm text-gray-700 font-medium mb-4 text-center md:text-right">
                    Page {currentPage} of {totalPages}
                  </div>
              )}

              {currentPerformances.length > 0 ? (
                <>
                  <div className="grid gap-4 mb-6">
                    {currentPerformances.map((performance) => (
                      <div key={performance.id} className={`bg-gradient-to-r rounded-xl p-6 border-2 hover:shadow-lg transition-all ${
                        performance.hasScore 
                          ? 'from-green-50 to-emerald-50 border-green-200' 
                          : 'from-white to-purple-50 border-purple-200'
                      }`}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-3">
                              {performance.itemNumber && (
                                <span className="px-3 py-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-bold rounded-full">
                                  #{performance.itemNumber}
                                </span>
                              )}
                              <h3 className="text-lg font-bold text-gray-900">{performance.title}</h3>
                              <div className="flex space-x-2">
                                <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                                  performance.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                                  performance.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                                  performance.status === 'completed' ? 'bg-green-100 text-green-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {performance.status.replace('_', ' ').toUpperCase()}
                                </span>
                                {performance.isFullyScored && (
                                  <span className="px-3 py-1 text-xs font-bold rounded-full bg-green-100 text-green-800">
                                    SCORED
                                  </span>
                                )}
                                {performance.hasScore && !performance.isFullyScored && (
                                  <span className="px-3 py-1 text-xs font-bold rounded-full bg-yellow-100 text-yellow-800">
                                    PARTIAL
                                  </span>
                                )}
                                {performance.scoringStatus && (
                                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-700">
                                    {performance.scoringStatus.scoredJudges}/{performance.scoringStatus.totalJudges} judges
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600 mb-4">
                              <div><strong>Contestant:</strong> {performance.contestantName || 'Loading...'}</div>
                              <div><strong>Duration:</strong> {performance.duration} minutes</div>
                              <div><strong>Style:</strong> {performance.itemStyle || 'Not specified'}</div>
                              <div><strong>Mastery:</strong> {performance.mastery || 'Not specified'}</div>
                            </div>
                            <div className="mb-3">
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
                                🎪 {assignments.find(a => a.eventId === performance.eventId)?.event.name || 'Event'}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600">
                              <strong>Participants:</strong> {performance.participantNames?.join(', ') || 'Loading...'}
                            </div>
                          </div>
                          <div className="ml-6">
                            <button
                              onClick={() => handleStartScoring(performance)}
                              className={`px-6 py-3 rounded-xl font-bold transition-all transform hover:scale-105 ${
                                performance.hasScore
                                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700'
                                  : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700'
                              }`}
                            >
                              {performance.hasScore ? 'Update Score' : 'Start Scoring'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex justify-center space-x-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                        Previous
                      </button>
                      
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-4 py-2 rounded-lg font-medium ${
                            currentPage === page
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                      
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                </div>
                  )}
                </>
              ) : (
                <div className="text-center py-16">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-3xl">🎭</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {filterStatus === 'all' && !searchTerm ? 'No Performances Yet' : 
                     filterStatus === 'scored' && !searchTerm ? 'No Scored Performances' :
                     filterStatus === 'not_scored' && !searchTerm ? 'All Performances Scored!' :
                     'No performances match your criteria'}
                  </h3>
                  <p className="text-gray-600">
                    {filterStatus === 'all' && !searchTerm ? 'Performances will appear here once entries are approved and ready for judging.' :
                     filterStatus === 'scored' && !searchTerm ? 'Scored performances will appear here.' :
                     filterStatus === 'not_scored' && !searchTerm ? 'Great job! You have scored all available performances.' :
                     'Try adjusting your search or filter.'}
                  </p>
                </div>
            )}
          </div>
        </div>
        )}
          </>
        )}

        {/* Nationals Tab Content */}
        {activeTab === 'nationals' && (
          <>
            {/* Nationals Assignment Overview */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-8 border border-purple-100">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg flex items-center justify-center">
                  <span className="text-white">🏅</span>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Your Nationals Assignments</h2>
              </div>

              {nationalsAssignments.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {nationalsAssignments.map((assignment) => (
                    <div key={assignment.nationalsEventId} className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-4">
                      <h3 className="font-bold text-gray-900 mb-2">{assignment.event.name}</h3>
                      <p className="text-sm text-gray-700 mb-1">📅 {new Date(assignment.event.eventDate).toLocaleDateString()}</p>
                      <p className="text-sm text-gray-700">📍 {assignment.event.venue}</p>
                      <div className="mt-2">
                        <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                          🏆 NATIONALS
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-amber-800 font-medium">No nationals assignments yet.</p>
                  <p className="text-amber-700 text-sm">Please contact an administrator to get assigned to nationals events.</p>
                </div>
              )}
            </div>

            {/* Nationals Performances to Judge */}
            {nationalsAssignments.length > 0 && (
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden border border-purple-100">
                <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 px-6 py-4 border-b border-yellow-100">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg flex items-center justify-center">
                        <span className="text-white">🏅</span>
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">Nationals Competition Program</h2>
                        <p className="text-sm text-gray-700 font-medium">
                          Progress: {filteredNationalsPerformances.filter(p => p.hasScore).length}/{filteredNationalsPerformances.length} completed • Item-ordered program
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  {/* Filter and Search Controls for Nationals */}
                  <div className="flex flex-col lg:flex-row gap-4 mb-6">
                    {/* Filter Options */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setFilterStatus('all')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          filterStatus === 'all' 
                            ? 'bg-purple-600 text-white' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        All ({filteredNationalsPerformances.length})
                      </button>
                      <button
                        onClick={() => setFilterStatus('not_scored')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          filterStatus === 'not_scored' 
                            ? 'bg-orange-600 text-white' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Not Scored ({filteredNationalsPerformances.filter(p => !p.hasScore).length})
                      </button>
                      <button
                        onClick={() => setFilterStatus('scored')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          filterStatus === 'scored' 
                            ? 'bg-green-600 text-white' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Scored ({filteredNationalsPerformances.filter(p => p.hasScore).length})
                      </button>
                    </div>

                    {/* Search Inputs */}
                    <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                      <div className="flex-1 md:w-48">
                        <input 
                          type="text"
                          placeholder="Search by name, item..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all text-sm font-medium text-gray-900 bg-white"
                        />
                      </div>
                      <div className="flex-1 md:w-32">
                        <input 
                          type="number"
                          placeholder="Item #"
                          value={itemNumberSearch}
                          onChange={(e) => setItemNumberSearch(e.target.value)}
                          onKeyPress={handleItemNumberSearchKeyPress}
                          className="w-full px-4 py-2 border-2 border-yellow-400 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all text-sm font-bold text-gray-900 bg-white"
                        />
                      </div>
                      <button
                        onClick={() => {
                          const itemNum = parseInt(itemNumberSearch);
                          if (!isNaN(itemNum)) {
                            loadPerformanceByItemNumber(itemNum);
                          }
                        }}
                        disabled={!itemNumberSearch || isNaN(parseInt(itemNumberSearch))}
                        className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-600 text-white rounded-lg hover:from-yellow-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
                      >
                        Load
                      </button>
                    </div>
                  </div>

                  {filteredNationalsPerformances.length > 0 ? (
                    <div className="grid gap-4 mb-6">
                      {filteredNationalsPerformances.map((performance) => (
                        <div key={performance.id} className={`bg-gradient-to-r rounded-xl p-6 border-2 hover:shadow-lg transition-all ${
                          performance.hasScore 
                            ? 'from-green-50 to-emerald-50 border-green-200' 
                            : 'from-white to-yellow-50 border-yellow-200'
                        }`}>
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-3">
                                {performance.itemNumber && (
                                  <span className="px-3 py-1 bg-gradient-to-r from-yellow-500 to-orange-600 text-white text-sm font-bold rounded-full">
                                    #{performance.itemNumber}
                                  </span>
                                )}
                                <h3 className="text-lg font-bold text-gray-900">{performance.itemName}</h3>
                                <div className="flex space-x-2">
                                  <span className="px-3 py-1 text-xs font-bold rounded-full bg-yellow-100 text-yellow-800">
                                    🏆 NATIONALS
                                  </span>
                                  {performance.hasScore && (
                                    <span className="px-3 py-1 text-xs font-bold rounded-full bg-green-100 text-green-800">
                                      SCORED
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600 mb-4">
                                <div><strong>Contestant:</strong> {performance.contestantName}</div>
                                <div><strong>Duration:</strong> {performance.duration} minutes</div>
                                <div><strong>Style:</strong> {performance.itemStyle}</div>
                                <div><strong>Mastery:</strong> {performance.mastery}</div>
                                <div><strong>Performance Type:</strong> {performance.performanceType}</div>
                                <div><strong>Age Category:</strong> {performance.ageCategory}</div>
                              </div>
                              <div className="mb-3">
                                <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full font-medium">
                                  🏅 {nationalsAssignments.find(a => a.nationalsEventId === performance.nationalsEventId)?.event.name || 'Nationals Event'}
                                </span>
                              </div>
                              <div className="text-sm text-gray-600">
                                <strong>Choreographer:</strong> {performance.choreographer}
                              </div>
                            </div>
                            <div className="ml-6">
                              <button
                                onClick={() => handleStartNationalsScoring(performance)}
                                className={`px-6 py-3 rounded-xl font-bold transition-all transform hover:scale-105 ${
                                  performance.hasScore
                                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700'
                                    : 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white hover:from-yellow-600 hover:to-orange-700'
                                }`}
                              >
                                {performance.hasScore ? 'Update Score' : 'Start Scoring'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16">
                      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="text-3xl">🏅</span>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">No Nationals Performances Yet</h3>
                      <p className="text-gray-600">Nationals performances will appear here once entries are approved and ready for judging.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 