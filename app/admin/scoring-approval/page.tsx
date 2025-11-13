'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/simple-toast';
import { ThemeProvider, useTheme, getThemeClasses } from '@/components/providers/ThemeProvider';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

interface JudgeScore {
  judgeId: string;
  judgeName: string;
  scoreId: string;
  technicalScore: number;
  musicalScore: number;
  performanceScore: number;
  stylingScore: number;
  overallImpressionScore: number;
  total: number;
  comments: string;
  submittedAt: string;
}

interface PerformanceApproval {
  performanceId: string;
  performanceTitle: string;
  eventId: string;
  totalJudges: number;
  scoredJudges: number;
  judgeScores: JudgeScore[];
  averageScore: number;
  percentage: number;
  medal: string | { type: string; label: string; color: string; bgColor: string; borderColor: string; emoji: string };
  status: 'pending' | 'published';
  scoresPublished: boolean;
}

function ScoringApprovalPageContent() {
  const router = useRouter();
  const { theme } = useTheme();
  const themeClasses = getThemeClasses(theme);
  const { success, error } = useToast();
  const [user, setUser] = useState<any>(null);
  const [approvals, setApprovals] = useState<PerformanceApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [processingPublish, setProcessingPublish] = useState<Set<string>>(new Set());
  const [selectedApproval, setSelectedApproval] = useState<PerformanceApproval | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [editingJudgeScore, setEditingJudgeScore] = useState<JudgeScore | null>(null);
  const [editedScoreValues, setEditedScoreValues] = useState<any>(null);
  const [editingTotal, setEditingTotal] = useState<number | null>(null);

  useEffect(() => {
    // Check admin authentication
    const session = localStorage.getItem('adminSession');
    if (!session) {
      router.push('/portal/admin');
      return;
    }

    try {
      const userData = JSON.parse(session);
      setUser(userData);
      if (!userData.isAdmin) {
        router.push('/portal/admin');
        return;
      }
      fetchApprovals();
    } catch (err) {
      router.push('/portal/admin');
    }
  }, [router]);

  const fetchApprovals = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/scores/approve');
      const data = await response.json();
      if (data.success) {
        setApprovals(data.approvals || []);
      }
    } catch (error) {
      console.error('Error fetching score approvals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const publishScores = async (performanceId: string, performanceTitle: string) => {
    if (processingPublish.has(performanceId)) return;

    setProcessingPublish(prev => new Set(prev).add(performanceId));

    try {
      const response = await fetch('/api/scores/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          performanceId,
          approvedBy: user.id,
          action: 'publish'
        })
      });

      if (response.ok) {
        success(`Scores for "${performanceTitle}" published successfully`);
        await fetchApprovals(); // Refresh the list
        setShowDetails(false);
      } else {
        error('Failed to publish scores');
      }
    } catch (err) {
      console.error('Error publishing scores:', err);
      error('Failed to publish scores');
    } finally {
      setProcessingPublish(prev => {
        const newSet = new Set(prev);
        newSet.delete(performanceId);
        return newSet;
      });
    }
  };

  const openDetails = (approval: PerformanceApproval) => {
    setSelectedApproval(approval);
    setShowDetails(true);
    setEditingJudgeScore(null);
    setEditingTotal(null);
  };

  const startEditingJudgeScore = (judgeScore: JudgeScore) => {
    setEditingJudgeScore(judgeScore);
    setEditingTotal(judgeScore.total);
  };

  const cancelEditing = () => {
    setEditingJudgeScore(null);
    setEditingTotal(null);
  };

  const saveEditedJudgeScore = async () => {
    if (!editingJudgeScore || editingTotal === null || !selectedApproval) return;

    // Validate total
    if (editingTotal < 0 || editingTotal > 100) {
      error('Total score must be between 0 and 100');
      return;
    }

    try {
      const response = await fetch('/api/scores/edit-total', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scoreId: editingJudgeScore.scoreId,
          performanceId: selectedApproval.performanceId,
          judgeId: editingJudgeScore.judgeId,
          newTotal: editingTotal,
          editedBy: user.id,
          editedByName: user.name
        })
      });

      if (response.ok) {
        success('Score total updated successfully');
        setEditingJudgeScore(null);
        setEditingTotal(null);
        await fetchApprovals(); // Refresh the list
        setShowDetails(false);
      } else {
        const result = await response.json();
        error(result.error || 'Failed to update score');
      }
    } catch (err) {
      console.error('Error updating score:', err);
      error('Failed to update score');
    }
  };

  const filteredApprovals = approvals.filter(approval => {
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'pending' && !approval.scoresPublished) ||
      (statusFilter === 'published' && approval.scoresPublished);

    const matchesSearch = searchTerm === '' ||
      approval.performanceTitle.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  const pendingCount = approvals.filter(a => !a.scoresPublished).length;
  const publishedCount = approvals.filter(a => a.scoresPublished).length;

  const getMedalColor = (medal: string) => {
    const colors: Record<string, string> = {
      'Elite': 'from-yellow-600 to-yellow-800',
      'Opus': 'from-yellow-500 to-yellow-700',
      'Legend': 'from-yellow-400 to-yellow-600',
      'Gold': 'from-yellow-300 to-yellow-500',
      'Silver+': 'from-slate-300 to-slate-500',
      'Silver': 'from-gray-400 to-gray-600',
      'Bronze': 'from-amber-500 to-amber-700',
    };
    return colors[medal] || 'from-gray-400 to-gray-600';
  };

  if (isLoading) {
    return (
      <div className={`min-h-screen ${themeClasses.loadingBg} flex items-center justify-center`}>
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${theme === 'dark' ? 'border-indigo-500' : 'border-indigo-600'} mx-auto`}></div>
          <p className={`mt-4 ${themeClasses.loadingText}`}>Loading scoring approvals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${themeClasses.mainBg}`}>
      {/* Header */}
      <div className={`${themeClasses.headerBg} shadow`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-4 sm:py-6 gap-4">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 ${themeClasses.iconContainer} ${themeClasses.cardRadius} flex items-center justify-center flex-shrink-0`}>
                <span className="text-white text-lg sm:text-xl">⚖️</span>
              </div>
              <div>
                <h1 className={`text-lg sm:text-2xl font-bold ${themeClasses.textPrimary}`}>Score Approval Dashboard</h1>
                <p className={`text-xs sm:text-sm ${themeClasses.textSecondary} hidden sm:block`}>Review & publish aggregated performance scores</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <ThemeToggle />
              <button
                onClick={() => router.push('/admin')}
                className={`flex-1 sm:flex-none px-3 py-2 sm:px-4 text-xs sm:text-sm ${themeClasses.buttonBase} ${themeClasses.buttonSecondary}`}
              >
                ← Back
              </button>
              <button
                onClick={fetchApprovals}
                className={`flex-1 sm:flex-none px-3 py-2 sm:px-4 text-xs sm:text-sm ${themeClasses.buttonBase} ${themeClasses.buttonPrimary}`}
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} ${themeClasses.cardShadow} p-3 sm:p-6 border ${themeClasses.metricCardBorder}`}>
            <div className="flex items-center">
              <div className={`w-8 h-8 ${themeClasses.badgeBlue} ${themeClasses.cardRadius} flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0`}>
                <span className={`text-sm sm:text-base ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>📋</span>
              </div>
              <div className="min-w-0">
                <p className={`text-xs sm:text-sm font-medium ${themeClasses.textSecondary} truncate`}>Total</p>
                <p className={`text-xl sm:text-2xl font-semibold ${themeClasses.textPrimary}`}>{approvals.length}</p>
              </div>
            </div>
          </div>

          <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} ${themeClasses.cardShadow} p-3 sm:p-6 border ${themeClasses.metricCardBorder}`}>
            <div className="flex items-center">
              <div className={`w-8 h-8 ${themeClasses.badgeYellow} ${themeClasses.cardRadius} flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0`}>
                <span className={`text-sm sm:text-base ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`}>⏳</span>
              </div>
              <div className="min-w-0">
                <p className={`text-xs sm:text-sm font-medium ${themeClasses.textSecondary} truncate`}>Pending</p>
                <p className={`text-xl sm:text-2xl font-semibold ${themeClasses.textPrimary}`}>{pendingCount}</p>
              </div>
            </div>
          </div>

          <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} ${themeClasses.cardShadow} p-3 sm:p-6 border ${themeClasses.metricCardBorder}`}>
            <div className="flex items-center">
              <div className={`w-8 h-8 ${themeClasses.badgeGreen} ${themeClasses.cardRadius} flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0`}>
                <span className={`text-sm sm:text-base ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>✅</span>
              </div>
              <div className="min-w-0">
                <p className={`text-xs sm:text-sm font-medium ${themeClasses.textSecondary} truncate`}>Published</p>
                <p className={`text-xl sm:text-2xl font-semibold ${themeClasses.textPrimary}`}>{publishedCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className={`${themeClasses.cardBg} ${themeClasses.cardRadius} ${themeClasses.cardShadow} p-4 sm:p-6 mb-6 sm:mb-8 border ${themeClasses.cardBorder}`}>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
            <div className="flex-1">
              <label className={`block text-xs sm:text-sm font-medium ${themeClasses.label} mb-2`}>Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search performance..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm sm:text-base text-black"
              />
            </div>

            <div className="w-full sm:w-auto">
              <label className="block text-xs sm:text-sm font-medium text-black mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm sm:text-base text-black"
              >
                <option value="pending">Pending</option>
                <option value="published">Published</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>
        </div>

        {/* Performance Approvals List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-black flex items-center">
              <span className="mr-2">🎭</span>
              Performance Scores ({filteredApprovals.length} performances)
            </h2>
          </div>

          {filteredApprovals.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {filteredApprovals.map((approval) => (
                <div key={approval.performanceId} className={`p-4 sm:p-6 ${
                  approval.scoresPublished ? 'bg-green-50' : ''
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg sm:text-xl font-bold text-black">
                          {approval.performanceTitle}
                        </h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          approval.scoresPublished ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {approval.scoresPublished ? 'PUBLISHED' : 'PENDING'}
                        </span>
                      </div>

                      {/* Average Score & Medal */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                        <div className={`bg-gradient-to-r ${getMedalColor(typeof approval.medal === 'string' ? approval.medal : approval.medal.label)} rounded-lg p-4 text-center`}>
                          <p className="text-xs font-semibold text-white mb-1">FINAL SCORE</p>
                          <p className="text-3xl sm:text-4xl font-bold text-white">
                            {approval.averageScore.toFixed(2)}
                            <span className="text-lg sm:text-xl">/100</span>
                          </p>
                          <p className="text-xs text-white mt-1">{approval.percentage.toFixed(1)}%</p>
                        </div>

                        <div className={`bg-gradient-to-r ${getMedalColor(typeof approval.medal === 'string' ? approval.medal : approval.medal.label)} rounded-lg p-4 text-center`}>
                          <p className="text-xs font-semibold text-white mb-1">MEDAL</p>
                          <p className="text-3xl sm:text-4xl font-bold text-white">
                            {typeof approval.medal === 'string' ? approval.medal : approval.medal.label}
                          </p>
                          <p className="text-xs text-white mt-1">{approval.totalJudges} judges scored</p>
                        </div>
                      </div>

                      {/* Judge Scores Summary */}
                      <div className="bg-gray-50 rounded-lg p-3 mb-2">
                        <p className="text-xs font-semibold text-gray-700 mb-2">Judge Scores:</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {approval.judgeScores.map((js) => (
                            <div key={js.judgeId} className="bg-white rounded p-2 text-center">
                              <div className="font-bold text-indigo-600 text-lg">{js.total}/100</div>
                              <div className="text-gray-600 text-xs truncate">{js.judgeName}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-row sm:flex-col items-center justify-between sm:justify-start gap-2 sm:ml-4">
                      <button
                        onClick={() => openDetails(approval)}
                        className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap"
                      >
                        📋 View Details
                      </button>

                      {!approval.scoresPublished && (
                        <button
                          onClick={() => publishScores(approval.performanceId, approval.performanceTitle)}
                          disabled={processingPublish.has(approval.performanceId)}
                          className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs sm:text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
                        >
                          {processingPublish.has(approval.performanceId) ? 'Publishing...' : '✅ Publish Scores'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <span className="text-4xl mb-4 block">🎭</span>
              <p className="text-black">No performances found for the selected filter</p>
              <p className="text-sm text-gray-600 mt-2">Performances appear here when all assigned judges have submitted their scores</p>
            </div>
          )}
        </div>
      </div>

      {/* Performance Details Modal */}
      {showDetails && selectedApproval && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-base sm:text-xl font-semibold text-black pr-4">
                {selectedApproval.performanceTitle}
              </h3>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl sm:text-xl flex-shrink-0 p-2"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6">
              {/* Final Score Display */}
              <div className={`bg-gradient-to-r ${getMedalColor(typeof selectedApproval.medal === 'string' ? selectedApproval.medal : selectedApproval.medal.label)} rounded-xl p-6 mb-6 text-center text-white`}>
                <p className="text-sm font-semibold mb-2">FINAL AVERAGE SCORE</p>
                <p className="text-5xl font-bold">
                  {selectedApproval.averageScore.toFixed(2)}
                  <span className="text-2xl">/100</span>
                </p>
                <p className="text-lg mt-2">{selectedApproval.percentage.toFixed(1)}% • {typeof selectedApproval.medal === 'string' ? selectedApproval.medal : selectedApproval.medal.label}</p>
                <p className="text-sm mt-1 opacity-90">Averaged from {selectedApproval.totalJudges} judges</p>
              </div>

              {/* Individual Judge Scores */}
              <div className="space-y-4">
                <h4 className="text-lg font-bold text-gray-900">Individual Judge Scores</h4>

                {selectedApproval.judgeScores.map((judgeScore) => (
                  <div key={judgeScore.judgeId} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <h5 className="font-bold text-base text-gray-900">{judgeScore.judgeName}</h5>
                        <p className="text-sm text-gray-600">Submitted: {new Date(judgeScore.submittedAt).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-indigo-900">{judgeScore.total}/100</p>
                        </div>
                        {!selectedApproval.scoresPublished && editingJudgeScore?.judgeId !== judgeScore.judgeId && (
                          <button
                            onClick={() => startEditingJudgeScore(judgeScore)}
                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            ✏️ Edit
                          </button>
                        )}
                      </div>
                    </div>

                    {editingJudgeScore?.judgeId === judgeScore.judgeId && editingTotal !== null ? (
                      <div className="space-y-3 bg-white p-4 rounded border border-blue-300">
                        <p className="text-sm font-semibold text-blue-900">Editing {judgeScore.judgeName}'s Total Score</p>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Total Score (0-100)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={editingTotal}
                            onChange={(e) => setEditingTotal(Number(e.target.value))}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg font-bold text-black text-center focus:border-blue-500 focus:outline-none"
                            autoFocus
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Original score: {judgeScore.total}/100 • Category scores will be adjusted proportionally
                          </p>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={saveEditedJudgeScore}
                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
                          >
                            💾 Save Total
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition-colors"
                          >
                            ✕ Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-5 gap-2 text-xs">
                        <div className="text-center bg-white rounded p-2">
                          <div className="font-bold text-blue-600">{judgeScore.technicalScore}/20</div>
                          <div className="text-gray-600">Tech</div>
                        </div>
                        <div className="text-center bg-white rounded p-2">
                          <div className="font-bold text-purple-600">{judgeScore.musicalScore}/20</div>
                          <div className="text-gray-600">Music</div>
                        </div>
                        <div className="text-center bg-white rounded p-2">
                          <div className="font-bold text-green-600">{judgeScore.performanceScore}/20</div>
                          <div className="text-gray-600">Perf</div>
                        </div>
                        <div className="text-center bg-white rounded p-2">
                          <div className="font-bold text-orange-600">{judgeScore.stylingScore}/20</div>
                          <div className="text-gray-600">Style</div>
                        </div>
                        <div className="text-center bg-white rounded p-2">
                          <div className="font-bold text-pink-600">{judgeScore.overallImpressionScore}/20</div>
                          <div className="text-gray-600">Overall</div>
                        </div>
                      </div>
                    )}

                    {judgeScore.comments && (
                      <div className="mt-2 bg-blue-50 border border-blue-200 rounded p-2">
                        <p className="text-xs font-semibold text-blue-900">Comments:</p>
                        <p className="text-xs text-blue-800 italic">{judgeScore.comments}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Publish Button */}
              {!selectedApproval.scoresPublished && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => publishScores(selectedApproval.performanceId, selectedApproval.performanceTitle)}
                    disabled={processingPublish.has(selectedApproval.performanceId)}
                    className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-colors disabled:opacity-50"
                  >
                    {processingPublish.has(selectedApproval.performanceId) ? 'Publishing...' : '✅ Publish Scores to Contestants & Teachers'}
                  </button>
                  <p className="text-xs text-gray-600 text-center mt-2">
                    Once published, scores will be visible to contestants and teachers. You can still edit individual judge scores after publishing.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScoringApprovalPage() {
  return (
    <ThemeProvider>
      <ScoringApprovalPageContent />
    </ThemeProvider>
  );
}
