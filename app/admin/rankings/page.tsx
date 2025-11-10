'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getMedalFromPercentage } from '@/lib/types';
import { ThemeProvider, useTheme, getThemeClasses } from '@/components/providers/ThemeProvider';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

interface RankingData {
  performanceId: string;
  eventId: string;
  eventName: string;
  region: string;
  ageCategory: string;
  performanceType: string;
  title: string;
  itemStyle: string;
  contestantName: string; // Now displays participant names instead of contestant name
  participantNames?: string[]; // Original participant names for reference
  studioName?: string; // Studio information for display
  totalScore: number;
  averageScore: number;
  rank: number;
  judgeCount: number;
  percentage: number;
  rankingLevel: string;
  itemNumber?: number; // Item number for program order
  mastery?: string; // Mastery level
  entryType?: string; // Entry type (live/virtual)
}

interface EventWithScores {
  id: string;
  name: string;
  region: string;
  ageCategory: string;
  performanceType: string;
  eventDate: string;
  venue: string;
  performanceCount: number;
  scoreCount: number;
}

function AdminRankingsPage() {
  const { theme } = useTheme();
  const themeClasses = getThemeClasses(theme);
  const [rankings, setRankings] = useState<RankingData[]>([]);
  const [filteredRankings, setFilteredRankings] = useState<RankingData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Filters
  // Region filtering removed - Nationals only now
  const [events, setEvents] = useState<Array<{id: string; name: string}>>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('all');
  const [selectedAgeCategory, setSelectedAgeCategory] = useState('');
  const [selectedPerformanceType, setSelectedPerformanceType] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'top3_age' | 'top3_style' | 'top3_duets' | 'top3_groups' | 'top3_trios' | 'top10_soloists'>('all');
  const [masteryFilter, setMasteryFilter] = useState<'all' | 'competitive' | 'advanced'>('all');
  const [entryTypeFilter, setEntryTypeFilter] = useState<'all' | 'live' | 'virtual'>('all');

  useEffect(() => {
    // Check admin authentication
    const adminSession = localStorage.getItem('adminSession');
    if (adminSession) {
      try {
        const session = JSON.parse(adminSession);
        if (session.isAdmin) {
          setIsAuthenticated(true);
          loadInitialData();
        } else {
          setError('Admin access required to view rankings');
          setIsLoading(false);
        }
      } catch {
        setError('Invalid session. Please login as admin.');
        setIsLoading(false);
      }
    } else {
      setError('Admin authentication required. Please login.');
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    applyFilters();
  }, [rankings, viewMode, masteryFilter, entryTypeFilter, selectedAgeCategory, selectedPerformanceType, selectedStyle, selectedEventId]);

  // Load rankings only once on authentication (all filters are client-side for Nationals)
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      loadRankings();
    }
  }, [isAuthenticated]);

  const loadInitialData = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // Load events list for filter
      const eventsRes = await fetch('/api/events');
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        if (eventsData.success) {
          setEvents(eventsData.events.map((e: any) => ({ id: e.id, name: e.name })));
        }
      }
      
      // Load all rankings (force load since this is initial data load)
      await loadRankings(true);
    } catch (error) {
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadRankings = async (forceLoad = false) => {
    if (!isAuthenticated && !forceLoad) return;
    
    setIsRefreshing(true);
    setError('');
    
    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append('type', 'nationals'); // Only nationals now
      
      // All filters are client-side for Nationals (due to dynamic age calculation)
      // Load all data and filter on client
      
      const url = `/api/rankings?${params.toString()}`;
      console.log('Loading rankings from:', url);
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        console.log('Rankings data received:', data);
        setRankings(data);
      } else {
        console.error('Failed to load rankings, status:', response.status);
        setError('Failed to load rankings');
      }
    } catch (error) {
      setError('Failed to load rankings');
    } finally {
      setIsRefreshing(false);
    }
  };

  const applyFilters = () => {
    let filtered = rankings;
    
    // Apply event filter
    if (selectedEventId && selectedEventId !== 'all') {
      filtered = filtered.filter(ranking => ranking.eventId === selectedEventId);
    }
    
    // Apply age category filter (client-side for Nationals due to dynamic age calculation)
    if (selectedAgeCategory) {
      filtered = filtered.filter(ranking => ranking.ageCategory === selectedAgeCategory);
    }
    
    // Apply performance type filter (client-side for Nationals)
    if (selectedPerformanceType) {
      filtered = filtered.filter(ranking => ranking.performanceType === selectedPerformanceType);
    }
    
    // Apply style filter
    if (selectedStyle) {
      filtered = filtered.filter(ranking => ranking.itemStyle === selectedStyle);
    }
    
    // Apply entry type filter
    if (entryTypeFilter !== 'all') {
      filtered = filtered.filter(ranking => (ranking.entryType || 'live') === entryTypeFilter);
    }
    
    // Apply mastery level filter
    if (masteryFilter === 'competitive') {
      filtered = filtered.filter(ranking => ranking.mastery?.toLowerCase().includes('water') || ranking.mastery?.toLowerCase().includes('competition'));
    } else if (masteryFilter === 'advanced') {
      filtered = filtered.filter(ranking => ranking.mastery?.toLowerCase().includes('fire') || ranking.mastery?.toLowerCase().includes('advanced'));
    }
    
    // Apply view mode filters with deduplication
    // When using "Top X" view modes, deduplicate by contestant name (keep only best performance per person)
    if (viewMode === 'top3_age') {
      // Deduplicate first: keep only best performance per contestant
      const bestPerformanceByContestant = new Map<string, RankingData>();
      filtered.forEach(ranking => {
        const existing = bestPerformanceByContestant.get(ranking.contestantName);
        if (!existing || ranking.totalScore > existing.totalScore) {
          bestPerformanceByContestant.set(ranking.contestantName, ranking);
        }
      });
      filtered = Array.from(bestPerformanceByContestant.values());
      
      // Group by age category and get top 3 from each
      const groupedByAge = filtered.reduce((groups, ranking) => {
        if (!groups[ranking.ageCategory]) {
          groups[ranking.ageCategory] = [];
        }
        groups[ranking.ageCategory].push(ranking);
        return groups;
      }, {} as Record<string, RankingData[]>);

      filtered = Object.values(groupedByAge).flatMap(group => 
        group.sort((a, b) => b.totalScore - a.totalScore).slice(0, 3)
      );
    } else if (viewMode === 'top3_style') {
      // Deduplicate first: keep only best performance per contestant
      const bestPerformanceByContestant = new Map<string, RankingData>();
      filtered.forEach(ranking => {
        const existing = bestPerformanceByContestant.get(ranking.contestantName);
        if (!existing || ranking.totalScore > existing.totalScore) {
          bestPerformanceByContestant.set(ranking.contestantName, ranking);
        }
      });
      filtered = Array.from(bestPerformanceByContestant.values());
      
      // Group by style and get top 3 from each
      const groupedByStyle = filtered.reduce((groups, ranking) => {
        if (!groups[ranking.itemStyle]) {
          groups[ranking.itemStyle] = [];
        }
        groups[ranking.itemStyle].push(ranking);
        return groups;
      }, {} as Record<string, RankingData[]>);

      filtered = Object.values(groupedByStyle).flatMap(group => 
        group.sort((a, b) => b.totalScore - a.totalScore).slice(0, 3)
      );
    } else if (viewMode === 'top3_duets') {
      // Deduplicate first: keep only best performance per contestant
      const bestPerformanceByContestant = new Map<string, RankingData>();
      filtered
        .filter(ranking => ranking.performanceType === 'Duet')
        .forEach(ranking => {
          const existing = bestPerformanceByContestant.get(ranking.contestantName);
          if (!existing || ranking.totalScore > existing.totalScore) {
            bestPerformanceByContestant.set(ranking.contestantName, ranking);
          }
        });
      
      // Filter for duets only and get top 3
      filtered = Array.from(bestPerformanceByContestant.values())
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 3);
    } else if (viewMode === 'top3_groups') {
      // Deduplicate first: keep only best performance per contestant
      const bestPerformanceByContestant = new Map<string, RankingData>();
      filtered
        .filter(ranking => ranking.performanceType === 'Group')
        .forEach(ranking => {
          const existing = bestPerformanceByContestant.get(ranking.contestantName);
          if (!existing || ranking.totalScore > existing.totalScore) {
            bestPerformanceByContestant.set(ranking.contestantName, ranking);
          }
        });
      
      // Filter for groups only and get top 3
      filtered = Array.from(bestPerformanceByContestant.values())
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 3);
    } else if (viewMode === 'top3_trios') {
      // Deduplicate first: keep only best performance per contestant
      const bestPerformanceByContestant = new Map<string, RankingData>();
      filtered
        .filter(ranking => ranking.performanceType === 'Trio')
        .forEach(ranking => {
          const existing = bestPerformanceByContestant.get(ranking.contestantName);
          if (!existing || ranking.totalScore > existing.totalScore) {
            bestPerformanceByContestant.set(ranking.contestantName, ranking);
          }
        });
      
      // Filter for trios only and get top 3
      filtered = Array.from(bestPerformanceByContestant.values())
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 3);
    } else if (viewMode === 'top10_soloists') {
      // Deduplicate first: keep only best performance per contestant
      const bestPerformanceByContestant = new Map<string, RankingData>();
      filtered
        .filter(ranking => ranking.performanceType === 'Solo')
        .forEach(ranking => {
          const existing = bestPerformanceByContestant.get(ranking.contestantName);
          if (!existing || ranking.totalScore > existing.totalScore) {
            bestPerformanceByContestant.set(ranking.contestantName, ranking);
          }
        });
      
      // Filter for solos only and get top 10
      filtered = Array.from(bestPerformanceByContestant.values())
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 10);
    }
    
    // Sort filtered results by total score (descending) and recalculate ranks
    filtered.sort((a, b) => b.totalScore - a.totalScore);
    
    // Recalculate ranks for filtered results
    const rankedFiltered = filtered.map((ranking, index) => ({
      ...ranking,
      rank: index + 1 // Assign new rank based on position in filtered list
    }));
    
    setFilteredRankings(rankedFiltered);
  };

  const clearFilters = () => {
    setSelectedEventId('all');
    setSelectedAgeCategory('');
    setSelectedPerformanceType('');
    setSelectedStyle('');
    setViewMode('all');
    setMasteryFilter('all');
    setEntryTypeFilter('all');
  };

  const exportToCSV = () => {
    if (filteredRankings.length === 0) {
      alert('No data to export');
      return;
    }

    // Define CSV headers
    const headers = [
      'Rank',
      'Item Number',
      'Performance Title',
      'Contestant Name',
      'Studio',
      'Performance Type',
      'Age Category',
      'Style',
      'Mastery Level',
      'Entry Type',
      'Total Score',
      'Average Score',
      'Percentage',
      'Medal/Level',
      'Judge Count',
      'Event Name',
      'Region'
    ];

    // Convert data to CSV rows
    const rows = filteredRankings.map((ranking, index) => {
      const { percentage, rankingLevel } = calculatePercentageAndRanking(ranking.totalScore, ranking.judgeCount);
      
      return [
        index + 1, // Rank
        ranking.itemNumber || 'N/A',
        `"${ranking.title.replace(/"/g, '""')}"`, // Escape quotes in title
        `"${ranking.contestantName.replace(/"/g, '""')}"`,
        `"${(ranking.studioName || '').replace(/"/g, '""')}"`,
        ranking.performanceType,
        ranking.ageCategory,
        `"${ranking.itemStyle.replace(/"/g, '""')}"`,
        ranking.mastery || 'N/A',
        ranking.entryType || 'live',
        ranking.totalScore.toFixed(2),
        ranking.averageScore.toFixed(2),
        percentage.toFixed(2),
        rankingLevel,
        ranking.judgeCount,
        `"${ranking.eventName.replace(/"/g, '""')}"`,
        ranking.region
      ];
    });

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    // Generate filename with timestamp and current view mode
    const timestamp = new Date().toISOString().split('T')[0];
    const viewModeLabel = viewMode === 'all' ? 'All' : 
                          viewMode === 'top3_age' ? 'Top3ByAge' :
                          viewMode === 'top3_style' ? 'Top3ByStyle' :
                          viewMode === 'top3_duets' ? 'Top3Duets' :
                          viewMode === 'top3_groups' ? 'Top3Groups' :
                          viewMode === 'top3_trios' ? 'Top3Trios' :
                          viewMode === 'top10_soloists' ? 'Top10Soloists' : 'Rankings';
    
    const filename = `Nationals_Rankings_${viewModeLabel}_${timestamp}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white border-yellow-300 shadow-lg';
      case 2: return 'bg-gradient-to-r from-gray-300 to-gray-500 text-white border-gray-400 shadow-lg';
      case 3: return 'bg-gradient-to-r from-orange-400 to-orange-600 text-white border-orange-300 shadow-lg';
      default: return 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-indigo-300 shadow-md';
    }
  };

  const getRankIcon = (rank: number) => {
    return `#${rank}`;
  };

  const calculatePercentageAndRanking = (totalScore: number, judgeCount: number) => {
    // Calculate percentage: (totalScore / (judgeCount * 100)) * 100
    const maxPossibleScore = judgeCount * 100; // Each judge can give max 100 points (5 criteria × 20 each)
    const percentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
    
    const medalInfo = getMedalFromPercentage(percentage);
    let rankingColor = '';
    
    // Use gradient colors for better visual appeal while keeping the new medal structure
    switch (medalInfo.type) {
      case 'elite':
        rankingColor = 'bg-gradient-to-r from-yellow-600 to-yellow-800 text-white';
        break;
      case 'opus':
        rankingColor = 'bg-gradient-to-r from-yellow-500 to-yellow-700 text-white';
        break;
      case 'legend':
      rankingColor = 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white';
        break;
      case 'gold':
        rankingColor = 'bg-gradient-to-r from-yellow-300 to-yellow-500 text-white';
        break;
      case 'silver_plus':
        rankingColor = 'bg-gradient-to-r from-slate-300 to-slate-500 text-white';
        break;
      case 'silver':
      rankingColor = 'bg-gradient-to-r from-gray-400 to-gray-600 text-white';
        break;
      case 'bronze':
      default:
        rankingColor = 'bg-gradient-to-r from-amber-500 to-amber-700 text-white';
        break;
    }
    
    return { 
      percentage: Math.round(percentage * 10) / 10, 
      rankingLevel: medalInfo.label, 
      rankingColor, 
      medalEmoji: medalInfo.emoji 
    };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading rankings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <p className="text-red-400 text-lg mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${themeClasses.mainBg}`}>
      {/* Header */}
      <header className={`${themeClasses.headerBg} shadow-sm border-b ${themeClasses.headerBorder}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xl">🏆</span>
              </div>
              <div>
                <h1 className={`text-2xl font-bold ${themeClasses.textPrimary}`}>Nationals Rankings</h1>
                <p className={`text-sm ${themeClasses.textSecondary}`}>View and analyze nationals performance rankings</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={exportToCSV}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
              >
                <span>📊</span>
                <span>Export CSV</span>
              </button>
              <button
                onClick={() => window.location.href = '/admin'}
                className="px-4 py-2 text-gray-400 hover:text-white font-medium"
              >
                Back to Admin
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-blue-100 hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {filteredRankings.length}
              </div>
              <div className="text-sm text-gray-300 font-medium">Total Performances</div>
            </div>
          </div>
          <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-green-100 hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {new Set(filteredRankings.map(r => r.studioName)).size}
              </div>
              <div className="text-sm text-gray-300 font-medium">Studios</div>
            </div>
          </div>
          <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-purple-100 hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {new Set(filteredRankings.map(r => r.ageCategory)).size}
              </div>
              <div className="text-sm text-gray-300 font-medium">Age Categories</div>
            </div>
          </div>
          <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-teal-100 hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
            <div className="text-center">
              <div className="text-2xl font-bold text-teal-600">
                {new Set(filteredRankings.map(r => r.itemStyle)).size}
              </div>
              <div className="text-sm text-gray-300 font-medium">Dance Styles</div>
            </div>
          </div>
        </div>

        {/* Nationals Breakdown */}
        <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-indigo-100 mb-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm">🏫</span>
            </div>
            <h3 className="text-xl font-bold text-white">Performances per Studio</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(() => {
              // Calculate performances per studio
              const studioCounts = filteredRankings.reduce((acc, ranking) => {
                const studio = ranking.studioName || 'Unknown Studio';
                acc[studio] = (acc[studio] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);

              // Sort studios by count (descending) then alphabetically
              const sortedStudios = Object.entries(studioCounts)
                .sort(([a, countA], [b, countB]) => {
                  if (countB !== countA) return countB - countA;
                  return a.localeCompare(b);
                });

              if (sortedStudios.length === 0) {
                return (
                  <div className="col-span-full text-center py-8">
                    <div className="text-gray-400 text-4xl mb-2">🏫</div>
                    <p className="text-gray-400">No nationals data available</p>
                    <p className="text-gray-400 text-sm">Nationals breakdown will appear when rankings are loaded</p>
                  </div>
                );
              }

              return sortedStudios.map(([studio, count], index) => (
                <div
                  key={studio}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 hover:shadow-lg ${
                    index === 0
                      ? 'border-emerald-500 bg-gray-700'
                      : index === 1
                      ? 'border-blue-500 bg-gray-700'
                      : index === 2
                      ? 'border-amber-500 bg-gray-700'
                      : 'border-gray-600 bg-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-sm">{studio}</div>
                      <div className="text-xs text-gray-400">
                        {((count / filteredRankings.length) * 100).toFixed(1)}% of total
                      </div>
                    </div>
                    <div className={`text-xl font-bold ${
                      index === 0
                        ? 'text-emerald-400'
                        : index === 1
                        ? 'text-blue-400'
                        : index === 2
                        ? 'text-amber-400'
                        : 'text-gray-300'
                    }`}>
                      {count}
                    </div>
                  </div>

                  {index < 3 && (
                    <div className="mt-2 flex items-center space-x-1">
                      <span className="text-xs">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                      </span>
                      <span className="text-xs text-gray-400 font-medium">
                        {index === 0 ? 'Most items' : index === 1 ? '2nd most' : '3rd most'}
                      </span>
                    </div>
                  )}
                </div>
              ));
            })()}
          </div>
          
        </div>

        {/* Enhanced Filters with View Mode Tabs */}
        <div className="bg-gray-800/90 backdrop-blur-lg rounded-2xl shadow-xl p-8 mb-8 border border-indigo-100">
          {/* View Mode Tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setViewMode('all')}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                viewMode === 'all'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                  : 'bg-gray-700 text-white hover:bg-gray-600'
              }`}
            >
              All Rankings
            </button>
            <button
              onClick={() => setViewMode('top3_age')}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                viewMode === 'top3_age'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                  : 'bg-gray-700 text-white hover:bg-gray-600'
              }`}
            >
              Top 3 by Age
            </button>
            <button
              onClick={() => setViewMode('top3_style')}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                viewMode === 'top3_style'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                  : 'bg-gray-700 text-white hover:bg-gray-600'
              }`}
            >
              Top 3 by Style
            </button>
            <button
              onClick={() => setViewMode('top3_duets')}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                viewMode === 'top3_duets'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                  : 'bg-gray-700 text-white hover:bg-gray-600'
              }`}
            >
              Top 3 Duets
            </button>
            <button
              onClick={() => setViewMode('top3_groups')}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                viewMode === 'top3_groups'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                  : 'bg-gray-700 text-white hover:bg-gray-600'
              }`}
            >
              Top 3 Groups
            </button>
            <button
              onClick={() => setViewMode('top3_trios')}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                viewMode === 'top3_trios'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                  : 'bg-gray-700 text-white hover:bg-gray-600'
              }`}
            >
              Top 3 Trios
            </button>
            <button
              onClick={() => setViewMode('top10_soloists')}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                viewMode === 'top10_soloists'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                  : 'bg-gray-700 text-white hover:bg-gray-600'
              }`}
            >
              Top 10 Soloists
            </button>
          </div>

          {/* Nationals Filters */}
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm">🔍</span>
            </div>
            <h2 className="text-xl font-bold text-white">Filter Rankings</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-sm font-semibold text-gray-300 mb-3">Event</label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 font-medium bg-gray-700 text-white"
              >
                <option value="all">All Events</option>
                {events.map(event => (
                  <option key={event.id} value={event.id}>{event.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-3">Age Category</label>
              <select
                value={selectedAgeCategory}
                onChange={(e) => setSelectedAgeCategory(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 font-medium bg-gray-700 text-white"
              >
                <option value="">All Ages</option>
                {['4 & Under', '6 & Under', '7-9', '10-12', '13-14', '15-17', '18-24', '25-39', '40+', '60+'].map(age => (
                  <option key={age} value={age}>{age}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-3">Performance Type</label>
              <select
                value={selectedPerformanceType}
                onChange={(e) => setSelectedPerformanceType(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 font-medium bg-gray-700 text-white"
              >
                <option value="">All Types</option>
                {['Solo', 'Duet', 'Trio', 'Group'].map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-3">Style</label>
              <select
                value={selectedStyle}
                onChange={(e) => setSelectedStyle(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 font-medium bg-gray-700 text-white"
              >
                <option value="">All Styles</option>
                {Array.from(new Set(rankings.map(r => r.itemStyle).filter(s => s))).sort().map(style => (
                  <option key={style} value={style}>{style}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-3">Mastery Level</label>
              <select
                value={masteryFilter}
                onChange={(e) => setMasteryFilter(e.target.value as 'all' | 'competitive' | 'advanced')}
                className="w-full px-4 py-3 border-2 border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 font-medium bg-gray-700 text-white"
              >
                <option value="all">All Levels</option>
                <option value="competitive">Competitive (Water)</option>
                <option value="advanced">Advanced (Fire)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-3">Entry Type</label>
              <select
                value={entryTypeFilter}
                onChange={(e) => setEntryTypeFilter(e.target.value as 'all' | 'live' | 'virtual')}
                className="w-full px-4 py-3 border-2 border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 font-medium bg-gray-700 text-white"
              >
                <option value="all">All Entries</option>
                <option value="live">Live Only</option>
                <option value="virtual">Virtual Only</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-3">Actions</label>
              <div className="flex flex-col space-y-2">
                <button
                  onClick={exportToCSV}
                  className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-200 font-semibold shadow-md flex items-center justify-center space-x-2"
                >
                  <span>📊</span>
                  <span>Export to CSV</span>
                </button>
                <button
                  onClick={clearFilters}
                  className="w-full px-4 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-200 font-semibold shadow-md"
                >
                  Clear Filters
                </button>
                <button
                  onClick={() => loadRankings()}
                  disabled={isRefreshing}
                  className="w-full px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 transition-all duration-200 font-semibold shadow-md"
                >
                  {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Rankings Table */}
        <div className="bg-gray-800/90 backdrop-blur-lg rounded-2xl shadow-xl overflow-hidden border border-indigo-100">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Rankings</h2>
                <p className="text-indigo-100 mt-1">Performance results and awards - Filter by event to view specific competition results</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-indigo-100">Total Results</div>
                <div className="text-2xl font-bold">{filteredRankings.length}</div>
              </div>
            </div>
          </div>
          
          <div className="p-8">
            {filteredRankings.length === 0 ? (
              <div className="text-center py-12 bg-gray-800/80 rounded-2xl shadow-lg">
                <div className="text-6xl mb-4">📊</div>
                <p className="text-gray-400 text-lg">No rankings available</p>
                <p className="text-gray-400 text-sm mt-2">Rankings will appear here once competitions are completed and scored</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-600">
                      <th className="text-left py-4 px-6 font-bold text-white">Rank</th>
                      <th className="text-left py-4 px-6 font-bold text-white">Item #</th>
                      <th className="text-left py-4 px-6 font-bold text-white">Performance</th>
                      <th className="text-left py-4 px-6 font-bold text-white">Contestant</th>
                      <th className="text-left py-4 px-6 font-bold text-white">Type</th>
                      <th className="text-left py-4 px-6 font-bold text-white">Age</th>
                      <th className="text-left py-4 px-6 font-bold text-white">Score</th>
                      <th className="text-left py-4 px-6 font-bold text-white">Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRankings.map((ranking, index) => {
                      const { percentage, rankingLevel, rankingColor, medalEmoji } = calculatePercentageAndRanking(ranking.totalScore, ranking.judgeCount);

                      // Use the recalculated rank from applyFilters
                      // The rank is already correctly calculated in applyFilters()
                      // No need for special handling - just use ranking.rank directly
                      const displayRank = ranking.rank;
                      
                      return (
                        <tr key={ranking.performanceId} className="border-b border-gray-700 hover:bg-gray-700/50 transition-colors">
                          <td className="py-4 px-6">
                            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border ${getRankBadgeColor(displayRank)}`}>
                              {getRankIcon(displayRank)}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            {ranking.itemNumber ? (
                              <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-gradient-to-r from-blue-500 to-purple-600 text-white border border-blue-300 shadow-md">
                                Item {ranking.itemNumber}
                              </div>
                            ) : (
                              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border shadow-md ${
                                (ranking.entryType || 'live') === 'virtual'
                                  ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white border-purple-300'
                                  : 'bg-gradient-to-r from-orange-500 to-red-600 text-white border-orange-300'
                              }`}>
                                {(ranking.entryType || 'live') === 'virtual' ? '📹 Virtual' : '⚠️ Unassigned'}
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <div className="font-semibold text-white">{ranking.title}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-sm text-gray-400">{ranking.itemStyle}</span>
                              {ranking.mastery && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-700 text-emerald-200">
                                  {ranking.mastery}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="font-medium text-white">{ranking.contestantName}</div>
                            {ranking.studioName && (
                              <div className="text-xs text-gray-400 mt-1">{ranking.studioName}</div>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-700 text-blue-200 border border-blue-500">
                              {ranking.performanceType}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-700 text-indigo-200 border border-indigo-500">
                              {ranking.ageCategory}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="font-bold text-white">{ranking.totalScore.toFixed(1)}</div>
                            <div className="text-sm text-gray-400">{percentage}% • {ranking.judgeCount} judges</div>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${rankingColor}`}>
                              <span className="mr-1">{medalEmoji}</span>
                              {rankingLevel}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Wrap with ThemeProvider
export default function AdminRankingsPageWrapper() {
  return (
    <ThemeProvider>
      <AdminRankingsPage />
    </ThemeProvider>
  );
} 