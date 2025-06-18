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

export default function JudgeDashboard() {
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
  const [filterStatus, setFilterStatus] = useState<'all' | 'not_scored' | 'scored'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [performancesPerPage] = useState(6);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemNumberSearch, setItemNumberSearch] = useState('');
  const router = useRouter();
  const { showAlert } = useAlert();

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
    if (selectedEventId) {
      filterAndLoadPerformances();
    } else {
      setFilteredPerformances([]);
    }
  }, [selectedEventId, performances, filterStatus, searchTerm, itemNumberSearch]);

  const loadJudgeData = async (judgeId: string) => {
    setIsLoading(true);
    try {
      // Load judge assignments
      const assignmentsResponse = await fetch(`/api/judges/${judgeId}/assignments`);
      if (assignmentsResponse.ok) {
        const assignmentsData = await assignmentsResponse.json();
        setAssignments(assignmentsData.assignments || []);
        
        // Load performances for all assigned events with score status
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
        setPerformances(allPerformances);
      }
    } catch (error) {
      console.error('Error loading judge data:', error);
      setErrorMessage('Failed to load judge data. Please refresh the page.');
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndLoadPerformances = () => {
    let filtered = performances.filter(p => p.eventId === selectedEventId);
    
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

    // Sort by item number ascending (putting performances without item numbers at the end)
    filtered.sort((a, b) => {
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
    
    setFilteredPerformances(filtered);
    setCurrentPage(1); // Reset to first page when filtering
  };

  const loadPerformanceByItemNumber = (itemNumber: number) => {
    const performance = performances.find(p => 
      p.eventId === selectedEventId && p.itemNumber === itemNumber
    );
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
    if (!selectedPerformance) return;
    
    setIsSubmittingScore(true);
    setErrorMessage('');
    
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
      
      if (response.ok) {
        setSuccessMessage(`Score ${selectedPerformance.hasScore ? 'updated' : 'submitted'} successfully for "${selectedPerformance.title}"`);
        setViewMode('list');
        setSelectedPerformance(null);
        
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
    const eventPerformances = performances.filter(p => p.eventId === selectedEventId);
    const scored = eventPerformances.filter(p => p.hasScore).length;
    const total = eventPerformances.length;
    return { scored, total, percentage: total > 0 ? Math.round((scored / total) * 100) : 0 };
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

  if (viewMode === 'scoring' && selectedPerformance) {
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
                    {selectedPerformance.hasScore ? 'Update Score' : 'Score Performance'}
                  </h1>
                  <p className="text-gray-700 font-medium">{selectedPerformance.title}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-700 font-medium">Judge: {judgeName}</p>
                <p className="text-sm text-gray-700 font-medium">Duration: {selectedPerformance.duration} min</p>
                {selectedPerformance.hasScore && (
                  <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full mt-1">
                    Previously Scored
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
                    <p className="font-bold text-gray-900">{selectedPerformance.contestantName || 'Loading...'}</p>
                  </div>
                  <div>
                    <span className="text-gray-700 font-medium">Participants:</span>
                    <p className="font-bold text-gray-900">{selectedPerformance.participantNames?.join(', ') || 'Loading...'}</p>
                  </div>
                  <div>
                    <span className="text-gray-700 font-medium">Style:</span>
                    <p className="font-bold text-gray-900">{selectedPerformance.itemStyle || 'Not specified'}</p>
                  </div>
                  <div>
                    <span className="text-gray-700 font-medium">Mastery:</span>
                    <p className="font-bold text-gray-900">{selectedPerformance.mastery || 'Not specified'}</p>
                  </div>
                  <div>
                    <span className="text-gray-700 font-medium">Duration:</span>
                    <p className="font-bold text-gray-900">{selectedPerformance.duration} minutes</p>
                  </div>
                  <div>
                    <span className="text-gray-700 font-medium">Choreographer:</span>
                    <p className="font-bold text-gray-900">{selectedPerformance.choreographer || 'Not specified'}</p>
                  </div>
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
                        <span>{selectedPerformance.hasScore ? 'Updating Score...' : 'Submitting Score...'}</span>
                      </div>
                    ) : (
                      selectedPerformance.hasScore ? 'Update Score' : 'Submit Score'
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

        {/* Event Selection */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-8 border border-purple-100">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white">🎯</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Select Event to Judge</h2>
          </div>

              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full bg-white px-4 py-3 border-2 border-gray-400 hover:border-purple-400 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-lg font-semibold text-gray-900 shadow-sm"
              >
                <option value="">Choose an event to judge...</option>
                {assignments.map((assignment) => (
                  <option key={assignment.eventId} value={assignment.eventId}>
                {assignment.event.name} - {new Date(assignment.event.eventDate).toLocaleDateString()} - {assignment.event.venue}
                  </option>
                ))}
              </select>
              
              {assignments.length === 0 && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-amber-800 font-medium">No events assigned yet.</p>
              <p className="text-amber-700 text-sm">Please contact an administrator to get assigned to events.</p>
            </div>
              )}
            </div>
            
        {/* Performances to Judge */}
        {selectedEventId && (
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden border border-purple-100">
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 px-6 py-4 border-b border-purple-100">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                    <span className="text-white">🎭</span>
                  </div>
                            <div>
                    <h2 className="text-xl font-bold text-gray-900">Performances Ready for Judging</h2>
                    {(() => {
                      const stats = getCompletionStats();
                      return (
                        <p className="text-sm text-gray-700 font-medium">
                          Progress: {stats.scored}/{stats.total} completed ({stats.percentage}%)
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
                    Not Scored ({performances.filter(p => p.eventId === selectedEventId && !p.hasScore).length})
                  </button>
                  <button
                    onClick={() => setFilterStatus('scored')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      filterStatus === 'scored' 
                        ? 'bg-green-600 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Fully Scored ({performances.filter(p => p.eventId === selectedEventId && p.isFullyScored).length})
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
      </div>
    </div>
  );
} 