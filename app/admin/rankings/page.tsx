'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { REGIONS, AGE_CATEGORIES, PERFORMANCE_TYPES, ITEM_STYLES } from '@/lib/types';

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
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedAgeCategory, setSelectedAgeCategory] = useState('');
  const [selectedPerformanceType, setSelectedPerformanceType] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'top5_age' | 'top5_style'>('all');

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
  }, [rankings, viewMode]);

  // Trigger rankings reload when server-side filters change
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      loadRankings();
    }
  }, [selectedRegion, selectedAgeCategory, selectedPerformanceType]);

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
      if (selectedRegion) params.append('region', selectedRegion);
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
    
    // Only apply client-side filters that weren't applied server-side
    // Region, age category, performance type, and event selection are handled server-side
    
    // Apply view mode filters
    if (viewMode === 'top5_age') {
      // Group by age category and get top 5 from each
      const groupedByAge = filtered.reduce((groups, ranking) => {
        if (!groups[ranking.ageCategory]) {
          groups[ranking.ageCategory] = [];
        }
        groups[ranking.ageCategory].push(ranking);
        return groups;
      }, {} as Record<string, RankingData[]>);

      filtered = Object.values(groupedByAge).flatMap(group => 
        group.sort((a, b) => b.totalScore - a.totalScore).slice(0, 5)
      );
    } else if (viewMode === 'top5_style') {
      // Group by style and get top 5 from each
      const groupedByStyle = filtered.reduce((groups, ranking) => {
        if (!groups[ranking.itemStyle]) {
          groups[ranking.itemStyle] = [];
        }
        groups[ranking.itemStyle].push(ranking);
        return groups;
      }, {} as Record<string, RankingData[]>);

      filtered = Object.values(groupedByStyle).flatMap(group => 
        group.sort((a, b) => b.totalScore - a.totalScore).slice(0, 5)
      );
    }
    
    setFilteredRankings(filtered);
  };

  const clearFilters = () => {
    setSelectedRegion('');
    setSelectedAgeCategory('');
    setSelectedPerformanceType('');
    setViewMode('all');
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
    
    let rankingLevel = '';
    let rankingColor = '';
    
    if (percentage >= 90) {
      rankingLevel = 'Pro Gold';
      rankingColor = 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white';
    } else if (percentage >= 80) {
      rankingLevel = 'Gold';
      rankingColor = 'bg-gradient-to-r from-yellow-500 to-yellow-700 text-white';
    } else if (percentage >= 75) {
      rankingLevel = 'Silver Plus';
      rankingColor = 'bg-gradient-to-r from-gray-300 to-gray-500 text-white';
    } else if (percentage >= 70) {
      rankingLevel = 'Silver';
      rankingColor = 'bg-gradient-to-r from-gray-400 to-gray-600 text-white';
    } else {
      rankingLevel = 'Bronze';
      rankingColor = 'bg-gradient-to-r from-orange-400 to-orange-600 text-white';
    }
    
    return { percentage: Math.round(percentage * 10) / 10, rankingLevel, rankingColor };
  };

  // Enhanced grouping logic for better display
  const groupedRankings = filteredRankings.reduce((groups, ranking) => {
    let key;
    if (viewMode === 'top5_age') {
      key = `${ranking.ageCategory}`;
    } else if (viewMode === 'top5_style') {
      key = `${ranking.itemStyle}`;
    } else {
      key = `${ranking.region}-${ranking.ageCategory}-${ranking.performanceType}`;
    }
    
    if (!groups[key]) {
      groups[key] = {
        region: ranking.region,
        ageCategory: ranking.ageCategory,
        performanceType: ranking.performanceType,
        itemStyle: ranking.itemStyle,
        rankings: []
      };
    }
    groups[key].rankings.push(ranking);
    return groups;
  }, {} as Record<string, {
    region: string;
    ageCategory: string;
    performanceType: string;
    itemStyle: string;
    rankings: RankingData[];
  }>);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-8">
            {/* Modern Spinner */}
            <div className="w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-100"></div>
            </div>
            {/* Floating Dots */}
            <div className="absolute -top-6 -left-6 w-3 h-3 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
            <div className="absolute -top-6 -right-6 w-3 h-3 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            <div className="absolute -bottom-6 -left-6 w-3 h-3 bg-pink-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
            <div className="absolute -bottom-6 -right-6 w-3 h-3 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '0.6s'}}></div>
          </div>
          
          {/* Loading Text */}
          <div className="space-y-3">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Loading Rankings
            </h2>
            <p className="text-gray-700 font-medium animate-pulse">Calculating results...</p>
            
            {/* Progress Dots */}
            <div className="flex justify-center space-x-2 mt-6">
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" style={{animationDelay: '0s'}}></div>
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{animationDelay: '0.3s'}}></div>
              <div className="w-2 h-2 bg-pink-400 rounded-full animate-pulse" style={{animationDelay: '0.6s'}}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Enhanced Header */}
      <header className="bg-white/90 backdrop-blur-lg shadow-xl border-b border-indigo-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-8 gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">📊</span>
              </div>
              <div>
                <h1 className="text-3xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Competition Rankings
                </h1>
                <p className="text-gray-700 font-medium">Live scoring and leaderboards</p>
                <p className="text-xs text-gray-600 mt-1">
                  <strong>Ranking System:</strong> Bronze (≤69%) • Silver (70-74%) • Silver Plus (75-79%) • Gold (80-89%) • Pro Gold (90%+)
                </p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={loadRankings}
                disabled={isRefreshing}
                className="inline-flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 transition-all duration-200 transform hover:scale-105 shadow-lg font-medium disabled:opacity-50 disabled:transform-none"
              >
                <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span>
                <span>{isRefreshing ? 'Refreshing...' : 'Refresh Rankings'}</span>
              </button>
              <Link
                href="/admin"
                className="inline-flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-gray-500 to-gray-700 text-white rounded-xl hover:from-gray-600 hover:to-gray-800 transition-all duration-200 transform hover:scale-105 shadow-lg font-medium text-center"
              >
                <span>←</span>
                <span>Back to Admin</span>
              </Link>
            </div>
          </div>
          
          {error && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
              <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl font-medium animate-slideIn">
                <div className="flex items-center space-x-2">
                  <span>❌</span>
                  <span>{error}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Enhanced Statistics Overview */}
        {filteredRankings.length > 0 && (
          <div className="space-y-8 mb-8">
            {/* Main Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-indigo-100 hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600">{filteredRankings.length}</div>
                  <div className="text-sm text-gray-700 font-medium">Performances</div>
                </div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-purple-100 hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {new Set(filteredRankings.map(r => r.region)).size}
                  </div>
                  <div className="text-sm text-gray-700 font-medium">Regions</div>
                </div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-pink-100 hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                <div className="text-center">
                  <div className="text-2xl font-bold text-pink-600">
                    {new Set(filteredRankings.map(r => r.ageCategory)).size}
                  </div>
                  <div className="text-sm text-gray-700 font-medium">Categories</div>
                </div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-teal-100 hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                <div className="text-center">
                  <div className="text-2xl font-bold text-teal-600">
                    {new Set(filteredRankings.map(r => r.performanceType)).size}
                  </div>
                  <div className="text-sm text-gray-700 font-medium">Types</div>
                </div>
              </div>
            </div>

            {/* Regional Breakdown */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-indigo-100">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm">📍</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900">Total Items per Region</h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {(() => {
                  // Calculate items per region
                  const regionCounts = filteredRankings.reduce((acc, ranking) => {
                    acc[ranking.region] = (acc[ranking.region] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>);

                  // Sort regions by count (descending) then alphabetically
                  const sortedRegions = Object.entries(regionCounts)
                    .sort(([a, countA], [b, countB]) => {
                      if (countB !== countA) return countB - countA;
                      return a.localeCompare(b);
                    });

                  return sortedRegions.map(([region, count], index) => (
                    <div
                      key={region}
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
                          <div className="font-bold text-gray-900 text-sm">{region}</div>
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
              
              {Object.keys(filteredRankings.reduce((acc, ranking) => {
                acc[ranking.region] = true;
                return acc;
              }, {} as Record<string, boolean>)).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-4">📍</div>
                  <p className="text-lg font-medium">No regional data available</p>
                  <p className="text-sm">Regional breakdown will appear when rankings are loaded</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Enhanced Filters with View Mode Tabs */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-8 border border-indigo-100">
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
              onClick={() => setViewMode('top5_age')}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                viewMode === 'top5_age'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🥇 Top 5 by Age Category
            </button>
            <button
              onClick={() => setViewMode('top5_style')}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                viewMode === 'top5_style'
                  ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🎭 Top 5 by Style
            </button>
          </div>

          <div className="flex items-center space-x-3 mb-6">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm">🔍</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Filter Rankings</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Region</label>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 font-medium text-gray-900"
              >
                <option value="">All Regions</option>
                {REGIONS.map(region => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Age Category</label>
              <select
                value={selectedAgeCategory}
                onChange={(e) => setSelectedAgeCategory(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 font-medium text-gray-900"
              >
                <option value="">All Ages</option>
                {AGE_CATEGORIES.map(category => (
                  <option key={category} value={category}>{category}</option>
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
                {PERFORMANCE_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="w-full px-4 py-3 bg-gradient-to-r from-gray-500 to-gray-700 text-white rounded-xl hover:from-gray-600 hover:to-gray-800 transition-all duration-200 transform hover:scale-105 shadow-lg font-medium"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced Rankings Display */}
        {Object.keys(groupedRankings).length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 text-center border border-indigo-100">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center">
              <span className="text-3xl">🏆</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">No Rankings Available</h3>
            <p className="text-gray-700 max-w-md mx-auto">
              Rankings will appear here once performances have been scored by judges.
              Make sure you have assigned judges to events and they have submitted scores.
            </p>
          </div>
        ) : (
          <div className="space-y-8 animate-fadeIn">
            {Object.entries(groupedRankings).map(([key, group], index) => (
              <div key={index} className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden border border-indigo-100">
                {/* Enhanced Category Header */}
                <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 px-6 py-4 border-b border-indigo-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-gray-900">
                      {viewMode === 'top5_age' ? `Top 5 - ${group.ageCategory}` :
                       viewMode === 'top5_style' ? `Top 5 - ${group.itemStyle}` :
                       `${group.region} - ${group.ageCategory} - ${group.performanceType}`}
                    </h3>
                    <div className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium">
                      {group.rankings.length} performance{group.rankings.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                
                {/* Enhanced Rankings Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50/80">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Position
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Contestant
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider hidden sm:table-cell">
                          Performance
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider hidden md:table-cell">
                          Event
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider hidden lg:table-cell">
                          Style
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Score & %
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Ranking
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider hidden lg:table-cell">
                          Judges
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white/50 divide-y divide-gray-200">
                      {group.rankings.map((ranking) => {
                        const { percentage, rankingLevel, rankingColor } = calculatePercentageAndRanking(ranking.totalScore, ranking.judgeCount);
                        return (
                          <tr key={ranking.performanceId} className="hover:bg-indigo-50/50 transition-colors duration-200">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-3 py-2 rounded-xl text-sm font-bold border-2 ${getRankBadgeColor(ranking.rank)}`}>
                                {getRankIcon(ranking.rank)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div>
                                <div className="text-sm font-bold text-gray-900">
                                  {ranking.contestantName}
                                </div>
                                {ranking.studioName && (
                                  <div className="text-xs text-blue-600 font-medium">
                                    {ranking.studioName}
                                  </div>
                                )}
                                <div className="text-xs text-gray-500 sm:hidden">
                                  {ranking.title}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                              <div className="text-sm font-medium text-gray-900">{ranking.title}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                              <div className="text-sm text-gray-700">{ranking.eventName}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                              <div className="text-sm text-gray-700">{ranking.itemStyle}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-bold text-gray-900">
                                {ranking.totalScore.toFixed(1)} / {ranking.judgeCount * 100}
                              </div>
                              <div className="text-xs text-purple-600 font-bold">
                                {percentage.toFixed(1)}%
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${rankingColor}`}>
                                {rankingLevel}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                              <div className="text-sm text-gray-700 font-medium">
                                {ranking.judgeCount} judge{ranking.judgeCount !== 1 ? 's' : ''}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Custom CSS for animations */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
        
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
} 