'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/simple-toast';

interface ScoreApproval {
  id: string;
  performanceId: string;
  judgeId: string;
  judgeName: string;
  performanceTitle: string;
  scoreId: string;
  approvedBy?: string;
  approvedAt?: string;
  rejected?: boolean;
  rejectionReason?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  score: {
    technicalScore: number;
    musicalScore: number;
    performanceScore: number;
    stylingScore: number;
    overallImpressionScore: number;
    comments: string;
  };
}

export default function ScoringApprovalPage() {
  const router = useRouter();
  const { success, error } = useToast();
  const [user, setUser] = useState<any>(null);
  const [approvals, setApprovals] = useState<ScoreApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [processingApproval, setProcessingApproval] = useState<Set<string>>(new Set());
  const [selectedApproval, setSelectedApproval] = useState<ScoreApproval | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

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

  const approveScore = async (approvalId: string, performanceTitle: string) => {
    if (processingApproval.has(approvalId)) return;
    
    setProcessingApproval(prev => new Set(prev).add(approvalId));
    
    try {
      const response = await fetch('/api/scores/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalId,
          approvedBy: user.id,
          action: 'approve'
        })
      });

      if (response.ok) {
        // Update local state
        setApprovals(prev => 
          prev.map(approval => 
            approval.id === approvalId 
              ? { 
                  ...approval, 
                  status: 'approved', 
                  approvedBy: user.id, 
                  approvedAt: new Date().toISOString() 
                }
              : approval
          )
        );

        success(`Score for "${performanceTitle}" approved successfully`);
      } else {
        error('Failed to approve score');
      }
    } catch (err) {
      console.error('Error approving score:', err);
      error('Failed to approve score');
    } finally {
      setProcessingApproval(prev => {
        const newSet = new Set(prev);
        newSet.delete(approvalId);
        return newSet;
      });
    }
  };

  const rejectScore = async (approvalId: string, performanceTitle: string, reason: string) => {
    if (!reason.trim()) {
      error('Please provide a reason for rejection');
      return;
    }

    if (processingApproval.has(approvalId)) return;
    
    setProcessingApproval(prev => new Set(prev).add(approvalId));
    
    try {
      const response = await fetch('/api/scores/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalId,
          approvedBy: user.id,
          action: 'reject',
          rejectionReason: reason
        })
      });

      if (response.ok) {
        // Update local state
        setApprovals(prev => 
          prev.map(approval => 
            approval.id === approvalId 
              ? { 
                  ...approval, 
                  status: 'rejected', 
                  approvedBy: user.id, 
                  approvedAt: new Date().toISOString(),
                  rejected: true,
                  rejectionReason: reason
                }
              : approval
          )
        );

        success(`Score for "${performanceTitle}" rejected`);
        setRejectionReason('');
        setShowDetails(false);
      } else {
        error('Failed to reject score');
      }
    } catch (err) {
      console.error('Error rejecting score:', err);
      error('Failed to reject score');
    } finally {
      setProcessingApproval(prev => {
        const newSet = new Set(prev);
        newSet.delete(approvalId);
        return newSet;
      });
    }
  };

  const openDetails = (approval: ScoreApproval) => {
    setSelectedApproval(approval);
    setShowDetails(true);
    setRejectionReason('');
  };

  const filteredApprovals = approvals.filter(approval => {
    const matchesStatus = statusFilter === 'all' || approval.status === statusFilter;
    
    const matchesSearch = searchTerm === '' || 
      approval.performanceTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      approval.judgeName.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesStatus && matchesSearch;
  });

  const pendingCount = approvals.filter(a => a.status === 'pending').length;
  const approvedCount = approvals.filter(a => a.status === 'approved').length;
  const rejectedCount = approvals.filter(a => a.status === 'rejected').length;

  const calculateTotalScore = (score: ScoreApproval['score']) => {
    return score.technicalScore + score.musicalScore + score.performanceScore + 
           score.stylingScore + score.overallImpressionScore;
  };

  const calculatePercentage = (score: ScoreApproval['score']) => {
    const total = calculateTotalScore(score);
    return Math.round((total / 100) * 100);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-black">Loading scoring approvals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">⚖️</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-black">Score Approval System</h1>
                <p className="text-black">Review and approve judge scores before release</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/admin')}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                ← Back to Admin
              </button>
              <button
                onClick={fetchApprovals}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-blue-600">📋</span>
              </div>
              <div>
                <p className="text-sm font-medium text-black">Total Scores</p>
                <p className="text-2xl font-semibold text-black">{approvals.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-yellow-600">⏳</span>
              </div>
              <div>
                <p className="text-sm font-medium text-black">Pending Approval</p>
                <p className="text-2xl font-semibold text-black">{pendingCount}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-green-600">✅</span>
              </div>
              <div>
                <p className="text-sm font-medium text-black">Approved</p>
                <p className="text-2xl font-semibold text-black">{approvedCount}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-red-600">❌</span>
              </div>
              <div>
                <p className="text-sm font-medium text-black">Rejected</p>
                <p className="text-2xl font-semibold text-black">{rejectedCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-4 md:space-y-0">
            <div className="flex-1">
              <label className="block text-sm font-medium text-black mb-2">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by performance title or judge name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-black"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-black mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-black"
              >
                <option value="pending">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="all">All Scores</option>
              </select>
            </div>
          </div>
        </div>

        {/* Score Approvals List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-black flex items-center">
              <span className="mr-2">⚖️</span>
              Score Approvals ({filteredApprovals.length} scores)
            </h2>
          </div>
          
          {filteredApprovals.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {filteredApprovals.map((approval) => (
                <div key={approval.id} className={`p-6 ${
                  approval.status === 'approved' ? 'bg-green-50' : 
                  approval.status === 'rejected' ? 'bg-red-50' : ''
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-black">
                        {approval.performanceTitle}
                      </h3>
                      <p className="text-sm text-black">
                        <strong>Judge:</strong> {approval.judgeName}
                      </p>
                      <p className="text-sm text-black">
                        <strong>Total Score:</strong> {calculateTotalScore(approval.score)}/100 
                        ({calculatePercentage(approval.score)}%)
                      </p>
                      <p className="text-sm text-black">
                        <strong>Breakdown:</strong> Tech: {approval.score.technicalScore}, 
                        Music: {approval.score.musicalScore}, 
                        Performance: {approval.score.performanceScore}, 
                        Style: {approval.score.stylingScore}, 
                        Overall: {approval.score.overallImpressionScore}
                      </p>
                      <p className="text-xs text-gray-600">
                        Submitted: {new Date(approval.createdAt).toLocaleString()}
                      </p>
                      {approval.approvedAt && (
                        <p className="text-xs text-gray-600">
                          {approval.status === 'approved' ? 'Approved' : 'Rejected'}: {new Date(approval.approvedAt).toLocaleString()}
                        </p>
                      )}
                      {approval.rejectionReason && (
                        <p className="text-sm text-red-600 mt-2">
                          <strong>Rejection Reason:</strong> {approval.rejectionReason}
                        </p>
                      )}
                    </div>

                    <div className="ml-4 flex items-center space-x-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        approval.status === 'approved' ? 'bg-green-100 text-green-800' :
                        approval.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {approval.status.toUpperCase()}
                      </span>

                      <button
                        onClick={() => openDetails(approval)}
                        className="px-3 py-1 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm font-medium transition-colors"
                      >
                        📋 Details
                      </button>

                      {approval.status === 'pending' && (
                        <>
                          <button
                            onClick={() => approveScore(approval.id, approval.performanceTitle)}
                            disabled={processingApproval.has(approval.id)}
                            className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            {processingApproval.has(approval.id) ? '...' : '✅ Approve'}
                          </button>
                          <button
                            onClick={() => openDetails(approval)}
                            className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors"
                          >
                            ❌ Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <span className="text-4xl mb-4 block">⚖️</span>
              <p className="text-black">No scores found for the selected filter</p>
            </div>
          )}
        </div>
      </div>

      {/* Score Details Modal */}
      {showDetails && selectedApproval && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-black">
                Score Details - {selectedApproval.performanceTitle}
              </h3>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <h4 className="font-semibold text-black mb-2">Performance Information</h4>
                  <p className="text-sm"><strong>Title:</strong> {selectedApproval.performanceTitle}</p>
                  <p className="text-sm"><strong>Judge:</strong> {selectedApproval.judgeName}</p>
                  <p className="text-sm"><strong>Status:</strong> {selectedApproval.status.toUpperCase()}</p>
                  <p className="text-sm"><strong>Submitted:</strong> {new Date(selectedApproval.createdAt).toLocaleString()}</p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-black mb-2">Score Breakdown</h4>
                  <div className="space-y-1 text-sm">
                    <p><strong>Technical:</strong> {selectedApproval.score.technicalScore}/20</p>
                    <p><strong>Musicality:</strong> {selectedApproval.score.musicalScore}/20</p>
                    <p><strong>Performance:</strong> {selectedApproval.score.performanceScore}/20</p>
                    <p><strong>Styling:</strong> {selectedApproval.score.stylingScore}/20</p>
                    <p><strong>Overall Impression:</strong> {selectedApproval.score.overallImpressionScore}/20</p>
                    <p className="pt-2 border-t"><strong>Total:</strong> {calculateTotalScore(selectedApproval.score)}/100 ({calculatePercentage(selectedApproval.score)}%)</p>
                  </div>
                </div>
              </div>

              {selectedApproval.score.comments && (
                <div className="mb-6">
                  <h4 className="font-semibold text-black mb-2">Judge Comments</h4>
                  <p className="text-sm bg-gray-50 p-3 rounded-lg">{selectedApproval.score.comments}</p>
                </div>
              )}

              {selectedApproval.status === 'pending' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">
                      Rejection Reason (if rejecting)
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-black"
                      placeholder="Enter reason for rejection..."
                    />
                  </div>
                  
                  <div className="flex space-x-4">
                    <button
                      onClick={() => approveScore(selectedApproval.id, selectedApproval.performanceTitle)}
                      disabled={processingApproval.has(selectedApproval.id)}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-colors disabled:opacity-50"
                    >
                      {processingApproval.has(selectedApproval.id) ? 'Processing...' : '✅ Approve Score'}
                    </button>
                    <button
                      onClick={() => rejectScore(selectedApproval.id, selectedApproval.performanceTitle, rejectionReason)}
                      disabled={processingApproval.has(selectedApproval.id) || !rejectionReason.trim()}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold transition-colors disabled:opacity-50"
                    >
                      {processingApproval.has(selectedApproval.id) ? 'Processing...' : '❌ Reject Score'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

