'use client';

import { useState, useEffect } from 'react';
import { getMedalFromPercentage } from '@/lib/types';

interface RankingData {
  performanceId: string;
  eventId: string;
  eventName: string;
  ageCategory: string;
  performanceType: string;
  title: string;
  itemStyle: string;
  contestantName: string;
  dancerId: string;
  eodsaId?: string;
  email?: string;
  totalScore: number;
  averageScore: number;
  rank: number;
  percentage: number;
  rankingLevel: string;
  mastery?: string;
  entryType?: string;
  eventDate?: string;
}

interface Certificate {
  id: string;
  dancerName: string;
  percentage: number;
  style: string;
  title: string;
  medallion: string;
  eventDate: string;
  certificateUrl: string;
  sentAt?: string;
  createdAt: string;
}

export default function AdminCertificatesPage() {
  const [rankings, setRankings] = useState<RankingData[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedWinners, setSelectedWinners] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'rankings' | 'certificates'>('rankings');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadData();
  }, [viewMode]);

  const loadData = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      if (viewMode === 'rankings') {
        const response = await fetch('/api/admin/rankings?region=National');
        if (!response.ok) throw new Error('Failed to load rankings');
        const data = await response.json();
        setRankings(data);
      } else {
        const response = await fetch('/api/certificates/list');
        if (!response.ok) throw new Error('Failed to load certificates');
        const data = await response.json();
        setCertificates(data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleWinnerSelection = (performanceId: string) => {
    const newSelected = new Set(selectedWinners);
    if (newSelected.has(performanceId)) {
      newSelected.delete(performanceId);
    } else {
      newSelected.add(performanceId);
    }
    setSelectedWinners(newSelected);
  };

  const selectTopRanked = (limit: number) => {
    const topPerformances = rankings
      .sort((a, b) => a.rank - b.rank)
      .slice(0, limit)
      .map(r => r.performanceId);
    setSelectedWinners(new Set(topPerformances));
  };

  const previewCertificate = (ranking: RankingData) => {
    const url = `/api/certificates/test/image?` + new URLSearchParams({
      name: ranking.contestantName,
      percentage: ranking.percentage.toString(),
      style: ranking.itemStyle,
      title: ranking.title,
      medallion: getMedalFromPercentage(ranking.percentage),
      date: ranking.eventDate || new Date().toLocaleDateString()
    }).toString();
    
    setPreviewUrl(url);
  };

  const generateCertificates = async () => {
    if (selectedWinners.size === 0) {
      setError('Please select at least one winner');
      return;
    }

    setIsGenerating(true);
    setError('');
    setSuccess('');

    try {
      const winnersToGenerate = rankings.filter(r => selectedWinners.has(r.performanceId));
      let successCount = 0;
      let failCount = 0;

      for (const winner of winnersToGenerate) {
        try {
          const response = await fetch('/api/certificates/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dancerId: winner.dancerId,
              dancerName: winner.contestantName,
              eodsaId: winner.eodsaId,
              email: winner.email,
              performanceId: winner.performanceId,
              percentage: winner.percentage,
              style: winner.itemStyle,
              title: winner.title,
              medallion: getMedalFromPercentage(winner.percentage),
              eventDate: winner.eventDate || new Date().toLocaleDateString(),
              createdBy: 'admin'
            })
          });

          if (response.ok) {
            successCount++;
          } else {
            failCount++;
            console.error(`Failed to generate certificate for ${winner.contestantName}`);
          }
        } catch (err) {
          failCount++;
          console.error(`Error generating certificate for ${winner.contestantName}:`, err);
        }
      }

      setSuccess(`✓ Generated ${successCount} certificate(s)${failCount > 0 ? `, ${failCount} failed` : ''}`);
      setSelectedWinners(new Set());
      
      // Switch to certificates view to see results
      setTimeout(() => {
        setViewMode('certificates');
      }, 2000);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendCertificate = async (certificateId: string) => {
    try {
      const response = await fetch('/api/certificates/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          certificateId,
          sentBy: 'admin'
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message);
        // Reload certificates to update sent status
        loadData();
      } else {
        setError(data.error || 'Failed to send certificate');
      }
    } catch (err: any) {
      setError('Error sending certificate');
      console.error('Error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">📜 Certificate Manager</h1>
          <p className="text-gray-600">Generate and manage certificates for winners</p>
        </div>

        {/* View Toggle */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setViewMode('rankings')}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              viewMode === 'rankings'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            🏆 Select Winners
          </button>
          <button
            onClick={() => setViewMode('certificates')}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              viewMode === 'certificates'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            📋 View Certificates
          </button>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-300 text-green-800 px-4 py-3 rounded-lg mb-6">
            {success}
          </div>
        )}

        {/* Rankings View */}
        {viewMode === 'rankings' && (
          <>
            {/* Quick Select */}
            <div className="bg-white rounded-lg shadow-md p-4 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Quick Select:</h3>
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => selectTopRanked(3)}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  Top 3
                </button>
                <button
                  onClick={() => selectTopRanked(10)}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  Top 10
                </button>
                <button
                  onClick={() => setSelectedWinners(new Set())}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Clear Selection
                </button>
                <div className="ml-auto flex gap-3">
                  <span className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg">
                    Selected: {selectedWinners.size}
                  </span>
                  <button
                    onClick={generateCertificates}
                    disabled={isGenerating || selectedWinners.size === 0}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {isGenerating ? '⏳ Generating...' : '✓ Generate Certificates'}
                  </button>
                </div>
              </div>
            </div>

            {/* Rankings Table */}
            {isLoading ? (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading rankings...</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Select
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Rank
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Dancer
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Title
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Style
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Score
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Medal
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {rankings.map((ranking) => (
                        <tr key={ranking.performanceId} className={selectedWinners.has(ranking.performanceId) ? 'bg-blue-50' : ''}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedWinners.has(ranking.performanceId)}
                              onChange={() => toggleWinnerSelection(ranking.performanceId)}
                              className="h-5 w-5 text-blue-600 rounded cursor-pointer"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-lg font-bold text-gray-900">#{ranking.rank}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{ranking.contestantName}</div>
                            {ranking.eodsaId && <div className="text-xs text-gray-500">{ranking.eodsaId}</div>}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {ranking.title}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {ranking.itemStyle}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-lg font-semibold text-blue-600">{ranking.percentage}%</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              getMedalFromPercentage(ranking.percentage) === 'Gold' ? 'bg-yellow-100 text-yellow-800' :
                              getMedalFromPercentage(ranking.percentage) === 'Silver' ? 'bg-gray-100 text-gray-800' :
                              getMedalFromPercentage(ranking.percentage) === 'Bronze' ? 'bg-orange-100 text-orange-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {getMedalFromPercentage(ranking.percentage)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button
                              onClick={() => previewCertificate(ranking)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              👁️ Preview
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Certificates View */}
        {viewMode === 'certificates' && (
          <>
            {isLoading ? (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading certificates...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {certificates.map((cert) => (
                  <div key={cert.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                    <img
                      src={cert.certificateUrl}
                      alt={`Certificate for ${cert.dancerName}`}
                      className="w-full h-48 object-cover"
                    />
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 mb-2">{cert.dancerName}</h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>Score: {cert.percentage}%</p>
                        <p>Style: {cert.style}</p>
                        <p>Title: {cert.title}</p>
                        <p>Medal: {cert.medallion}</p>
                        {cert.sentAt && (
                          <p className="text-green-600">✓ Sent {new Date(cert.sentAt).toLocaleDateString()}</p>
                        )}
                      </div>
                      <div className="mt-4 flex gap-2">
                        <a
                          href={cert.certificateUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 px-4 py-2 bg-blue-100 text-blue-700 text-center rounded-lg hover:bg-blue-200 transition-colors text-sm"
                        >
                          📥 Download
                        </a>
                        <button
                          onClick={() => handleSendCertificate(cert.id)}
                          disabled={!!cert.sentAt}
                          className={`flex-1 px-4 py-2 rounded-lg transition-colors text-sm ${
                            cert.sentAt 
                              ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {cert.sentAt ? '✓ Sent' : '📧 Send'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Certificate Preview Modal */}
        {previewUrl && (
          <div
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
            onClick={() => setPreviewUrl(null)}
          >
            <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setPreviewUrl(null)}
                className="absolute -top-10 right-0 text-white text-2xl hover:text-gray-300"
              >
                ✕ Close
              </button>
              <img
                src={previewUrl}
                alt="Certificate Preview"
                className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

