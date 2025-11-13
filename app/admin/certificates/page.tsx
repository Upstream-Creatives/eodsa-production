'use client';

import { useState, useEffect } from 'react';
import { getMedalFromPercentage } from '@/lib/types';

interface RankingData {
  performanceId: string;
  eventId: string;
  eventName: string;
  region: string;
  ageCategory: string;
  performanceType: string;
  title: string;
  itemStyle: string;
  contestantName: string;
  participantNames?: string[];
  studioName?: string;
  totalScore: number;
  averageScore: number;
  rank: number;
  judgeCount: number;
  rankingLevel: string;
  itemNumber?: number;
  mastery?: string;
  entryType?: string;
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
  const [filteredRankings, setFilteredRankings] = useState<RankingData[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedWinners, setSelectedWinners] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'rankings' | 'certificates'>('rankings');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewRanking, setPreviewRanking] = useState<RankingData | null>(null);
  const [showConfirmGenerate, setShowConfirmGenerate] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Position adjustments for preview
  const [nameTop, setNameTop] = useState(48.5);
  const [nameFontSize, setNameFontSize] = useState(65);
  const [percentageTop, setPercentageTop] = useState(65.5);
  const [percentageLeft, setPercentageLeft] = useState(15.5);
  const [percentageFontSize, setPercentageFontSize] = useState(76);
  // Standardized font sizes (26px) for style, title, and medallion to ensure text always fits
  const [styleTop, setStyleTop] = useState(67);
  const [styleLeft, setStyleLeft] = useState(77.5);
  const [styleFontSize, setStyleFontSize] = useState(26); // Standardized to 26px
  const [titleTop, setTitleTop] = useState(74);
  const [titleLeft, setTitleLeft] = useState(74);
  const [titleFontSize, setTitleFontSize] = useState(26); // Standardized to 26px
  const [medallionTop, setMedallionTop] = useState(80.5);
  const [medallionLeft, setMedallionLeft] = useState(72);
  const [medallionFontSize, setMedallionFontSize] = useState(26); // Standardized to 26px
  const [dateTop, setDateTop] = useState(90);
  const [dateLeft, setDateLeft] = useState(66.5);
  const [dateFontSize, setDateFontSize] = useState(39);
  
  // Filters
  const [selectedAgeCategory, setSelectedAgeCategory] = useState('');
  const [selectedPerformanceType, setSelectedPerformanceType] = useState('Solo'); // Default to Solo
  const [selectedStyle, setSelectedStyle] = useState('');
  const [masteryFilter, setMasteryFilter] = useState<'all' | 'competitive' | 'advanced'>('all');

  useEffect(() => {
    loadData();
  }, [viewMode]);

  useEffect(() => {
    applyFilters();
  }, [rankings, selectedAgeCategory, selectedPerformanceType, selectedStyle, masteryFilter]);

  useEffect(() => {
    if (previewRanking) {
      updatePreviewUrl();
    }
  }, [nameTop, nameFontSize, percentageTop, percentageLeft, percentageFontSize, 
      styleTop, styleLeft, styleFontSize, titleTop, titleLeft, titleFontSize,
      medallionTop, medallionLeft, medallionFontSize, dateTop, dateLeft, dateFontSize]);

  const loadData = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      if (viewMode === 'rankings') {
        const response = await fetch('/api/rankings?type=nationals');
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

  const applyFilters = () => {
    let filtered = rankings;
    
    if (selectedAgeCategory) {
      filtered = filtered.filter(r => r.ageCategory === selectedAgeCategory);
    }
    
    if (selectedPerformanceType) {
      filtered = filtered.filter(r => r.performanceType === selectedPerformanceType);
    }
    
    if (selectedStyle) {
      filtered = filtered.filter(r => r.itemStyle === selectedStyle);
    }
    
    if (masteryFilter !== 'all') {
      filtered = filtered.filter(r => r.mastery?.toLowerCase() === masteryFilter);
    }
    
    setFilteredRankings(filtered);
  };

  const selectTopRanked = (limit: number) => {
    const topPerformances = filteredRankings
      .sort((a, b) => a.rank - b.rank)
      .slice(0, limit)
      .map(r => r.performanceId);
    setSelectedWinners(new Set(topPerformances));
  };

  const selectTop3ByStyle = () => {
    const top3ByStyle: Set<string> = new Set();
    const styles = Array.from(new Set(filteredRankings.map(r => r.itemStyle)));
    
    styles.forEach(style => {
      const styleRankings = filteredRankings
        .filter(r => r.itemStyle === style)
        .sort((a, b) => a.rank - b.rank)
        .slice(0, 3);
      
      styleRankings.forEach(r => top3ByStyle.add(r.performanceId));
    });
    
    setSelectedWinners(top3ByStyle);
  };

  const previewCertificate = (ranking: RankingData) => {
    if (!ranking || !ranking.averageScore) {
      setError('Invalid ranking data');
      return;
    }
    
    setPreviewRanking(ranking);
    updatePreviewUrl(ranking);
  };

  const updatePreviewUrl = (ranking: RankingData | null = previewRanking) => {
    if (!ranking) return;
    
    const percentage = Math.round(ranking.averageScore);
    // Hard-coded event date for Nationals 2025
    const eventDate = 'October 11, 2025';
    
    // For groups, duos, and trios, use studio name instead of dancer names
    const isGroupPerformance = ranking.performanceType && ['Duet', 'Trio', 'Group'].includes(ranking.performanceType);
    const displayName = isGroupPerformance && ranking.studioName 
      ? ranking.studioName 
      : (ranking.contestantName || 'Unknown');
    
    const baseUrl = `/api/certificates/adjust/image?`;
    const params = new URLSearchParams({
      name: displayName,
      percentage: percentage.toString(),
      style: ranking.itemStyle || 'Contemporary',
      title: ranking.title || 'Performance',
      medallion: getMedalFromPercentage(percentage).label,
      date: eventDate,
      nameTop: nameTop.toString(),
      nameFontSize: nameFontSize.toString(),
      percentageTop: percentageTop.toString(),
      percentageLeft: percentageLeft.toString(),
      percentageFontSize: percentageFontSize.toString(),
      styleTop: styleTop.toString(),
      styleLeft: styleLeft.toString(),
      styleFontSize: styleFontSize.toString(),
      titleTop: titleTop.toString(),
      titleLeft: titleLeft.toString(),
      titleFontSize: titleFontSize.toString(),
      medallionTop: medallionTop.toString(),
      medallionLeft: medallionLeft.toString(),
      medallionFontSize: medallionFontSize.toString(),
      dateTop: dateTop.toString(),
      dateLeft: dateLeft.toString(),
      dateFontSize: dateFontSize.toString()
    });
    
    setPreviewUrl(baseUrl + params.toString());
  };

  const savePositionsForDancer = async () => {
    if (!previewRanking) return;
    
    try {
      const response = await fetch('/api/certificates/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dancerId: previewRanking.performanceId,
          dancerName: previewRanking.contestantName,
          nameTop,
          nameFontSize,
          percentageTop,
          percentageLeft,
          percentageFontSize,
          styleTop,
          styleLeft,
          styleFontSize,
          titleTop,
          titleLeft,
          titleFontSize,
          medallionTop,
          medallionLeft,
          medallionFontSize,
          dateTop,
          dateLeft,
          dateFontSize
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setSuccess(`✓ Position settings saved for ${previewRanking.contestantName}`);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Failed to save positions');
      }
    } catch (err: any) {
      setError('Error saving positions');
      console.error('Error:', err);
    }
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
      const winnersToGenerate = filteredRankings.filter(r => selectedWinners.has(r.performanceId));
      let successCount = 0;
      let failCount = 0;

      for (const winner of winnersToGenerate) {
        try {
          const percentage = Math.round(winner.averageScore);
          // Hard-coded event date for Nationals 2025
          const eventDate = 'October 11, 2025';
          
          // Fetch the performance to get the actual dancer ID and EODSA ID
          let dancerId = winner.performanceId; // fallback to performanceId
          let eodsaId = null;
          let email = null;
          
          try {
            const perfResponse = await fetch(`/api/performances/${winner.performanceId}`);
            if (perfResponse.ok) {
              const perfData = await perfResponse.json();
              if (perfData.performance?.contestantId) {
                dancerId = perfData.performance.contestantId;
                eodsaId = perfData.performance.eodsaId;
              }
              
              // Try to get email from contestant/dancer
              if (dancerId) {
                try {
                  const dancerResponse = await fetch(`/api/dancers/${dancerId}`);
                  if (dancerResponse.ok) {
                    const dancerData = await dancerResponse.json();
                    if (dancerData.dancer) {
                      eodsaId = eodsaId || dancerData.dancer.eodsaId;
                      email = dancerData.dancer.email || dancerData.dancer.guardianEmail;
                    }
                  }
                } catch (err) {
                  console.warn('Could not fetch dancer details');
                }
              }
            }
          } catch (err) {
            console.warn('Could not fetch performance details, using performanceId as dancerId');
          }
          
          const response = await fetch('/api/certificates/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dancerId: dancerId, // Use actual dancer/contestant ID
              dancerName: winner.contestantName,
              eodsaId: eodsaId, // Include EODSA ID for lookup
              email: email, // Include email for sending
              performanceId: winner.performanceId,
              performanceType: winner.performanceType, // Include performance type for group/duo/trio detection
              studioName: winner.studioName || null, // Include studio name for group performances
              percentage: percentage,
              style: winner.itemStyle,
              title: winner.title,
              medallion: getMedalFromPercentage(percentage).label,
              eventDate: eventDate,
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
            {/* Filters */}
            <div className="bg-white rounded-lg shadow-md p-4 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Filters:</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Age Category</label>
                  <select
                    value={selectedAgeCategory}
                    onChange={(e) => setSelectedAgeCategory(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Ages</option>
                    {Array.from(new Set(rankings.map(r => r.ageCategory))).sort().map(age => (
                      <option key={age} value={age}>{age}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Performance Type</label>
                  <select
                    value={selectedPerformanceType}
                    onChange={(e) => setSelectedPerformanceType(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Types</option>
                    {Array.from(new Set(rankings.map(r => r.performanceType))).sort().map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Style</label>
                  <select
                    value={selectedStyle}
                    onChange={(e) => setSelectedStyle(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Styles</option>
                    {Array.from(new Set(rankings.map(r => r.itemStyle))).sort().map(style => (
                      <option key={style} value={style}>{style}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mastery Level</label>
                  <select
                    value={masteryFilter}
                    onChange={(e) => setMasteryFilter(e.target.value as 'all' | 'competitive' | 'advanced')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Levels</option>
                    <option value="competitive">Competitive</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>
              <div className="mt-3 text-sm text-gray-600">
                Showing {filteredRankings.length} of {rankings.length} rankings
              </div>
            </div>

            {/* Quick Select */}
            <div className="bg-white rounded-lg shadow-md p-4 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Quick Select:</h3>
              <div className="flex gap-3 flex-wrap items-center">
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
                  onClick={selectTop3ByStyle}
                  className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors font-medium"
                >
                  🎨 Top 3 by Style
                </button>
                <button
                  onClick={() => setSelectedWinners(new Set())}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Clear Selection
                </button>
                <div className="ml-auto flex gap-3 items-center">
                  <span className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold">
                    Selected: {selectedWinners.size}
                  </span>
                  {selectedWinners.size > 0 && (
                    <button
                      onClick={() => {
                        const firstSelected = filteredRankings.find(r => selectedWinners.has(r.performanceId));
                        if (firstSelected) previewCertificate(firstSelected);
                      }}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      👁️ Preview First
                    </button>
                  )}
                  <button
                    onClick={() => setShowConfirmGenerate(true)}
                    disabled={isGenerating || selectedWinners.size === 0}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
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
                          Studio Name
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
                      {filteredRankings.map((ranking, index) => (
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
                            <span className="text-lg font-bold text-gray-900">#{index + 1}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{ranking.contestantName}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {ranking.studioName || (ranking.performanceType === 'Solo' ? 'Independent' : 'N/A')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {ranking.title}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {ranking.itemStyle}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-lg font-semibold text-blue-600">{Math.round(ranking.averageScore)}%</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              getMedalFromPercentage(ranking.averageScore).label === 'Elite' ? 'bg-yellow-100 text-yellow-900' :
                              getMedalFromPercentage(ranking.averageScore).label === 'Opus' ? 'bg-yellow-100 text-yellow-800' :
                              getMedalFromPercentage(ranking.averageScore).label === 'Legend' ? 'bg-yellow-50 text-yellow-700' :
                              getMedalFromPercentage(ranking.averageScore).label === 'Gold' ? 'bg-yellow-100 text-yellow-800' :
                              getMedalFromPercentage(ranking.averageScore).label === 'Silver+' ? 'bg-slate-100 text-slate-800' :
                              getMedalFromPercentage(ranking.averageScore).label === 'Silver' ? 'bg-gray-100 text-gray-800' :
                              getMedalFromPercentage(ranking.averageScore).label === 'Bronze' ? 'bg-orange-100 text-orange-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {getMedalFromPercentage(ranking.averageScore).label}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button
                              onClick={() => previewCertificate(ranking)}
                              className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium"
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

        {/* Confirm Generate Modal */}
        {showConfirmGenerate && (
          <div
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
            onClick={() => setShowConfirmGenerate(false)}
          >
            <div className="relative bg-white rounded-xl p-8 max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Confirm Certificate Generation
              </h3>
              <p className="text-gray-600 mb-6">
                You are about to generate <span className="font-bold text-blue-600">{selectedWinners.size} certificate(s)</span>.
              </p>
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-700 mb-2">
                  <strong>Preview:</strong> Click "👁️ Preview First" button to see how certificates will look
                </p>
                <p className="text-sm text-gray-700">
                  <strong>Note:</strong> This will create certificates for all selected winners
                </p>
              </div>
              <div className="flex gap-4 justify-end">
                <button
                  onClick={() => setShowConfirmGenerate(false)}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowConfirmGenerate(false);
                    generateCertificates();
                  }}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                >
                  ✓ Yes, Generate Certificates
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Certificate Preview Modal with Adjustments */}
        {previewUrl && (
          <div
            className="fixed inset-0 bg-black bg-opacity-90 z-50 overflow-auto"
            onClick={() => { setPreviewUrl(null); setPreviewRanking(null); }}
          >
            <div className="max-w-7xl mx-auto p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">
                  {previewRanking?.contestantName} - Adjust Certificate
                </h2>
                <div className="flex gap-3">
                  <button
                    onClick={savePositionsForDancer}
                    className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors font-semibold"
                  >
                    💾 Save Positions for This Dancer
                  </button>
                  <button
                    onClick={() => { setPreviewUrl(null); setPreviewRanking(null); }}
                    className="text-white hover:text-gray-300 bg-gray-800 px-4 py-2 rounded-lg"
                  >
                    ✕ Close
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Controls */}
                <div className="bg-white rounded-lg p-4 max-h-[85vh] overflow-y-auto">
                  <h3 className="font-bold text-gray-900 mb-4">Position Adjustments</h3>
                  
                  {/* Name */}
                  <div className="mb-4 pb-4 border-b">
                    <h4 className="font-semibold text-sm text-gray-700 mb-2">Name</h4>
                    <label className="text-xs text-gray-600">Top: {nameTop}%</label>
                    <input type="range" min="0" max="100" step="0.5" value={nameTop} 
                           onChange={(e) => setNameTop(parseFloat(e.target.value))}
                           className="w-full" />
                    <label className="text-xs text-gray-600">Font Size: {nameFontSize}px</label>
                    <input type="range" min="20" max="100" value={nameFontSize}
                           onChange={(e) => setNameFontSize(parseInt(e.target.value))}
                           className="w-full" />
                  </div>
                  
                  {/* Percentage */}
                  <div className="mb-4 pb-4 border-b">
                    <h4 className="font-semibold text-sm text-gray-700 mb-2">Percentage</h4>
                    <label className="text-xs text-gray-600">Top: {percentageTop}%</label>
                    <input type="range" min="0" max="100" step="0.5" value={percentageTop}
                           onChange={(e) => setPercentageTop(parseFloat(e.target.value))}
                           className="w-full" />
                    <label className="text-xs text-gray-600">Left: {percentageLeft}%</label>
                    <input type="range" min="0" max="100" step="0.5" value={percentageLeft}
                           onChange={(e) => setPercentageLeft(parseFloat(e.target.value))}
                           className="w-full" />
                    <label className="text-xs text-gray-600">Font Size: {percentageFontSize}px</label>
                    <input type="range" min="20" max="120" value={percentageFontSize}
                           onChange={(e) => setPercentageFontSize(parseInt(e.target.value))}
                           className="w-full" />
                  </div>
                  
                  {/* Style */}
                  <div className="mb-4 pb-4 border-b">
                    <h4 className="font-semibold text-sm text-gray-700 mb-2">Style</h4>
                    <label className="text-xs text-gray-600">Top: {styleTop}%</label>
                    <input type="range" min="0" max="100" step="0.5" value={styleTop}
                           onChange={(e) => setStyleTop(parseFloat(e.target.value))}
                           className="w-full" />
                    <label className="text-xs text-gray-600">Left: {styleLeft}%</label>
                    <input type="range" min="0" max="100" step="0.5" value={styleLeft}
                           onChange={(e) => setStyleLeft(parseFloat(e.target.value))}
                           className="w-full" />
                    <label className="text-xs text-gray-600">Font Size: {styleFontSize}px</label>
                    <input type="range" min="10" max="60" value={styleFontSize}
                           onChange={(e) => setStyleFontSize(parseInt(e.target.value))}
                           className="w-full" />
                  </div>
                  
                  {/* Title */}
                  <div className="mb-4 pb-4 border-b">
                    <h4 className="font-semibold text-sm text-gray-700 mb-2">Title</h4>
                    <label className="text-xs text-gray-600">Top: {titleTop}%</label>
                    <input type="range" min="0" max="100" step="0.5" value={titleTop}
                           onChange={(e) => setTitleTop(parseFloat(e.target.value))}
                           className="w-full" />
                    <label className="text-xs text-gray-600">Left: {titleLeft}%</label>
                    <input type="range" min="0" max="100" step="0.5" value={titleLeft}
                           onChange={(e) => setTitleLeft(parseFloat(e.target.value))}
                           className="w-full" />
                    <label className="text-xs text-gray-600">Font Size: {titleFontSize}px</label>
                    <input type="range" min="10" max="60" value={titleFontSize}
                           onChange={(e) => setTitleFontSize(parseInt(e.target.value))}
                           className="w-full" />
                  </div>
                  
                  {/* Medallion */}
                  <div className="mb-4 pb-4 border-b">
                    <h4 className="font-semibold text-sm text-gray-700 mb-2">Medallion</h4>
                    <label className="text-xs text-gray-600">Top: {medallionTop}%</label>
                    <input type="range" min="0" max="100" step="0.5" value={medallionTop}
                           onChange={(e) => setMedallionTop(parseFloat(e.target.value))}
                           className="w-full" />
                    <label className="text-xs text-gray-600">Left: {medallionLeft}%</label>
                    <input type="range" min="0" max="100" step="0.5" value={medallionLeft}
                           onChange={(e) => setMedallionLeft(parseFloat(e.target.value))}
                           className="w-full" />
                    <label className="text-xs text-gray-600">Font Size: {medallionFontSize}px</label>
                    <input type="range" min="20" max="80" value={medallionFontSize}
                           onChange={(e) => setMedallionFontSize(parseInt(e.target.value))}
                           className="w-full" />
                  </div>
                  
                  {/* Date */}
                  <div className="mb-4">
                    <h4 className="font-semibold text-sm text-gray-700 mb-2">Date</h4>
                    <label className="text-xs text-gray-600">Top: {dateTop}%</label>
                    <input type="range" min="0" max="100" step="0.5" value={dateTop}
                           onChange={(e) => setDateTop(parseFloat(e.target.value))}
                           className="w-full" />
                    <label className="text-xs text-gray-600">Left: {dateLeft}%</label>
                    <input type="range" min="0" max="100" step="0.5" value={dateLeft}
                           onChange={(e) => setDateLeft(parseFloat(e.target.value))}
                           className="w-full" />
                    <label className="text-xs text-gray-600">Font Size: {dateFontSize}px</label>
                    <input type="range" min="15" max="60" value={dateFontSize}
                           onChange={(e) => setDateFontSize(parseInt(e.target.value))}
                           className="w-full" />
                  </div>
                </div>
                
                {/* Preview */}
                <div className="lg:col-span-3 flex items-center justify-center">
                  <img
                    key={previewUrl}
                    src={previewUrl}
                    alt="Certificate Preview"
                    className="max-w-full rounded-lg shadow-2xl"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

