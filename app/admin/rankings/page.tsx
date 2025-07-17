'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

export default function AdminRankingsPage() {
  const [rankings, setRankings] = useState<RankingData[]>([]);
  const [filteredRankings, setFilteredRankings] = useState<RankingData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Filters
  // Region filtering removed - Nationals only now
  const [selectedAgeCategory, setSelectedAgeCategory] = useState('');
  const [selectedPerformanceType, setSelectedPerformanceType] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'top3_age' | 'top3_style' | 'top3_duets' | 'top3_groups' | 'top3_trios' | 'top10_soloists'>('all');
  const [masteryFilter, setMasteryFilter] = useState<'all' | 'competitive' | 'advanced'>('all');

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
  }, [rankings, viewMode, masteryFilter]);

  // Trigger rankings reload when server-side filters change
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      loadRankings();
    }
  }, [selectedAgeCategory, selectedPerformanceType]);

  const loadInitialData = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // Load all rankings
      await loadRankings();
    } catch (error) {
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadRankings = async () => {
    if (!isAuthenticated) return;
    
    setIsRefreshing(true);
    setError('');
    
    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append('type', 'nationals'); // Only nationals now
      
      // No region filter needed - only Nationals now
      if (selectedAgeCategory) params.append('ageCategory', selectedAgeCategory);
      if (selectedPerformanceType) params.append('performanceType', selectedPerformanceType);
      
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
    
    // Apply mastery level filter first
    if (masteryFilter === 'competitive') {
      filtered = filtered.filter(ranking => ranking.mastery?.toLowerCase().includes('water') || ranking.mastery?.toLowerCase().includes('competition'));
    } else if (masteryFilter === 'advanced') {
      filtered = filtered.filter(ranking => ranking.mastery?.toLowerCase().includes('fire') || ranking.mastery?.toLowerCase().includes('advanced'));
    }
    
    // Apply view mode filters
    if (viewMode === 'top3_age') {
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
      // Filter for duets only and get top 3
      filtered = filtered
        .filter(ranking => ranking.performanceType === 'Duet')
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 3);
    } else if (viewMode === 'top3_groups') {
      // Filter for groups only and get top 3
      filtered = filtered
        .filter(ranking => ranking.performanceType === 'Group')
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 3);
    } else if (viewMode === 'top3_trios') {
      // Filter for trios only and get top 3
      filtered = filtered
        .filter(ranking => ranking.performanceType === 'Trio')
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 3);
    } else if (viewMode === 'top10_soloists') {
      // Filter for solos only and get top 10
      filtered = filtered
        .filter(ranking => ranking.performanceType === 'Solo')
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 10);
    }
    
    setFilteredRankings(filtered);
  };

  const clearFilters = () => {
    setSelectedAgeCategory('');
    setSelectedPerformanceType('');
    setViewMode('all');
    setMasteryFilter('all');
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
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
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
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading rankings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <p className="text-red-600 text-lg mb-4">{error}</p>
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xl">🏆</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Nationals Rankings</h1>
                <p className="text-sm text-gray-600">View and analyze nationals performance rankings</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => window.location.href = '/admin'}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
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
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-blue-100 hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {filteredRankings.length}
              </div>
              <div className="text-sm text-gray-700 font-medium">Total Performances</div>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-green-100 hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {new Set(filteredRankings.map(r => r.studioName)).size}
              </div>
              <div className="text-sm text-gray-700 font-medium">Studios</div>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-purple-100 hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {new Set(filteredRankings.map(r => r.ageCategory)).size}
              </div>
              <div className="text-sm text-gray-700 font-medium">Age Categories</div>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-teal-100 hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
            <div className="text-center">
              <div className="text-2xl font-bold text-teal-600">
                {new Set(filteredRankings.map(r => r.itemStyle)).size}
              </div>
              <div className="text-sm text-gray-700 font-medium">Dance Styles</div>
            </div>
          </div>
        </div>

        {/* Nationals Breakdown */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-indigo-100 mb-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm">🏫</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900">Performances per Studio</h3>
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
                    <p className="text-gray-500">No nationals data available</p>
                    <p className="text-gray-400 text-sm">Nationals breakdown will appear when rankings are loaded</p>
                  </div>
                );
              }

              return sortedStudios.map(([studio, count], index) => (
                <div
                  key={studio}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 hover:shadow-lg ${
                    index === 0 
                      ? 'border-emerald-500 bg-emerald-50' 
                      : index === 1 
                      ? 'border-blue-500 bg-blue-50'
                      : index === 2
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-gray-300 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-gray-900 text-sm">{studio}</div>
                      <div className="text-xs text-gray-600">
                        {((count / filteredRankings.length) * 100).toFixed(1)}% of total
                      </div>
                    </div>
                    <div className={`text-xl font-bold ${
                      index === 0 
                        ? 'text-emerald-600' 
                        : index === 1 
                        ? 'text-blue-600'
                        : index === 2
                        ? 'text-amber-600'
                        : 'text-gray-600'
                    }`}>
                      {count}
                    </div>
                  </div>
                  
                  {index < 3 && (
                    <div className="mt-2 flex items-center space-x-1">
                      <span className="text-xs">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                      </span>
                      <span className="text-xs text-gray-600 font-medium">
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
        <div className="bg-white/90 backdrop-blur-lg rounded-2xl shadow-xl p-8 mb-8 border border-indigo-100">
          {/* View Mode Tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setViewMode('all')}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                viewMode === 'all'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Rankings
            </button>
            <button
              onClick={() => setViewMode('top3_age')}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                viewMode === 'top3_age'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Top 3 by Age
            </button>
            <button
              onClick={() => setViewMode('top3_style')}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                viewMode === 'top3_style'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Top 3 by Style
            </button>
            <button
              onClick={() => setViewMode('top3_duets')}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                viewMode === 'top3_duets'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Top 3 Duets
            </button>
            <button
              onClick={() => setViewMode('top3_groups')}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                viewMode === 'top3_groups'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Top 3 Groups
            </button>
            <button
              onClick={() => setViewMode('top3_trios')}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                viewMode === 'top3_trios'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Top 3 Trios
            </button>
            <button
              onClick={() => setViewMode('top10_soloists')}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                viewMode === 'top10_soloists'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
            <h2 className="text-xl font-bold text-gray-900">Filter Avalon Rankings</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Competition</label>
              <div className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-900 font-medium">
                Avalon
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Age Category</label>
              <select
                value={selectedAgeCategory}
                onChange={(e) => setSelectedAgeCategory(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 font-medium text-gray-900"
              >
                <option value="">All Ages</option>
                {['Primary', 'Junior', 'Senior', 'Youth', 'Adult', 'Elite'].map(age => (
                  <option key={age} value={age}>{age}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Performance Type</label>
              <select
                value={selectedPerformanceType}
                onChange={(e) => setSelectedPerformanceType(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 font-medium text-gray-900"
              >
                <option value="">All Types</option>
                {['Solo', 'Duet', 'Trio', 'Group'].map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Mastery Level</label>
              <select
                value={masteryFilter}
                onChange={(e) => setMasteryFilter(e.target.value as 'all' | 'competitive' | 'advanced')}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 font-medium text-gray-900"
              >
                <option value="all">All Levels</option>
                <option value="competitive">Competitive (Water)</option>
                <option value="advanced">Advanced (Fire)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Actions</label>
              <div className="flex flex-col space-y-2">
                <button
                  onClick={clearFilters}
                  className="w-full px-4 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-200 font-semibold shadow-md"
                >
                  Clear Filters
                </button>
                <button
                  onClick={loadRankings}
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
        <div className="bg-white/90 backdrop-blur-lg rounded-2xl shadow-xl overflow-hidden border border-indigo-100">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Avalon Nationals Rankings</h2>
                <p className="text-indigo-100 mt-1">Performance results and awards</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-indigo-100">Total Results</div>
                <div className="text-2xl font-bold">{filteredRankings.length}</div>
              </div>
            </div>
          </div>
          
          <div className="p-8">
            {filteredRankings.length === 0 ? (
              <div className="text-center py-12 bg-white/80 rounded-2xl shadow-lg">
                <div className="text-6xl mb-4">📊</div>
                <p className="text-gray-500 text-lg">No rankings available</p>
                <p className="text-gray-400 text-sm mt-2">Rankings will appear here once competitions are completed and scored</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-4 px-6 font-bold text-gray-900">Rank</th>
                      <th className="text-left py-4 px-6 font-bold text-gray-900">Item #</th>
                      <th className="text-left py-4 px-6 font-bold text-gray-900">Performance</th>
                      <th className="text-left py-4 px-6 font-bold text-gray-900">Contestant</th>
                      
                      <th className="text-left py-4 px-6 font-bold text-gray-900">Score</th>
                      <th className="text-left py-4 px-6 font-bold text-gray-900">Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRankings.map((ranking, index) => {
                      const { percentage, rankingLevel, rankingColor, medalEmoji } = calculatePercentageAndRanking(ranking.totalScore, ranking.judgeCount);
                      return (
                        <tr key={ranking.performanceId} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                          <td className="py-4 px-6">
                            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border ${getRankBadgeColor(ranking.rank)}`}>
                              {getRankIcon(ranking.rank)}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-gradient-to-r from-blue-500 to-purple-600 text-white border border-blue-300 shadow-md">
                              {ranking.itemNumber ? `Item ${ranking.itemNumber}` : 'Unassigned'}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="font-semibold text-gray-900">{ranking.title}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-sm text-gray-600">{ranking.itemStyle}</span>
                              {ranking.mastery && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                  {ranking.mastery}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="font-medium text-gray-900">{ranking.contestantName}</div>
                            {ranking.studioName && (
                              <div className="text-xs text-gray-500 mt-1">{ranking.studioName}</div>
                            )}
                          </td>

                          <td className="py-4 px-6">
                            <div className="font-bold text-gray-900">{ranking.totalScore.toFixed(1)}</div>
                            <div className="text-sm text-gray-600">{percentage}% • {ranking.judgeCount} judges</div>
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