'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('admin-theme') as Theme;
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      setThemeState(savedTheme);
    } else {
      // Default to light theme
      setThemeState('light');
    }
    setMounted(true);
  }, []);

  // Save theme to localStorage when it changes
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('admin-theme', theme);
    }
  }, [theme, mounted]);

  // Reflect theme on the document for global CSS variables
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme, mounted]);

  const toggleTheme = () => {
    setThemeState(prev => prev === 'light' ? 'dark' : 'light');
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  // Prevent hydration mismatch by showing loading state until mounted
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-700">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Theme class utilities - Standardized with dark mode as primary
export const getThemeClasses = (theme: Theme) => {
  const isDark = theme === 'dark';
  
  return {
    // Main backgrounds - Dark mode primary
    mainBg: isDark 
      ? 'bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800' 
      : 'bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100',
    
    loadingBg: isDark
      ? 'bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800'
      : 'bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100',
    
    // Headers - Consistent styling
    headerBg: isDark 
      ? 'bg-gray-800/95 backdrop-blur-lg' 
      : 'bg-white/95 backdrop-blur-lg',
    headerBorder: isDark 
      ? 'border-gray-700' 
      : 'border-gray-200',
    
    // Cards and containers - Standardized
    cardBg: isDark 
      ? 'bg-gray-800/95 backdrop-blur-sm' 
      : 'bg-white/95 backdrop-blur-sm',
    cardBorder: isDark 
      ? 'border-gray-700' 
      : 'border-gray-200',
    cardShadow: 'shadow-xl',
    cardRadius: 'rounded-2xl',
    cardPadding: 'p-6',
    
    // Section headers - Consistent
    sectionHeaderBg: isDark
      ? 'bg-gray-700/80'
      : 'bg-gray-100/80',
    sectionHeaderBorder: isDark
      ? 'border-gray-600'
      : 'border-gray-200',
    
    // Text colors - High contrast
    textPrimary: isDark ? 'text-white' : 'text-gray-900',
    textSecondary: isDark ? 'text-gray-300' : 'text-gray-700',
    textMuted: isDark ? 'text-gray-400' : 'text-gray-600',
    textInverse: isDark ? 'text-gray-900' : 'text-white',
    
    // Typography - Standardized
    heading1: isDark ? 'text-3xl font-black text-white' : 'text-3xl font-black text-gray-900',
    heading2: isDark ? 'text-2xl font-bold text-white' : 'text-2xl font-bold text-gray-900',
    heading3: isDark ? 'text-xl font-semibold text-white' : 'text-xl font-semibold text-gray-900',
    body: isDark ? 'text-sm text-gray-300' : 'text-sm text-gray-700',
    label: isDark ? 'text-xs font-semibold uppercase tracking-wider text-gray-400' : 'text-xs font-semibold uppercase tracking-wider text-gray-600',
    
    // Tables - Consistent
    tableHeader: isDark ? 'bg-gray-700/80' : 'bg-gray-100',
    tableHeaderText: isDark ? 'text-gray-200 font-bold' : 'text-gray-900 font-bold',
    tableRow: isDark ? 'bg-gray-800/50' : 'bg-white',
    tableRowHover: isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50',
    tableBorder: isDark ? 'divide-gray-700' : 'divide-gray-200',
    tableCellPadding: 'px-6 py-4',
    
    // Buttons - Standardized
    buttonPrimary: isDark
      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700'
      : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700',
    buttonSecondary: isDark
      ? 'bg-gray-700 text-white hover:bg-gray-600'
      : 'bg-gray-200 text-gray-900 hover:bg-gray-300',
    buttonSuccess: isDark
      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700'
      : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700',
    buttonDanger: isDark
      ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white hover:from-red-700 hover:to-rose-700'
      : 'bg-gradient-to-r from-red-600 to-rose-600 text-white hover:from-red-700 hover:to-rose-700',
    buttonBase: 'px-5 py-2.5 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 shadow-lg',
    buttonDisabled: 'opacity-50 cursor-not-allowed',
    
    // Badges/Pills - Consistent
    badgeBase: 'px-3 py-1 rounded-full text-xs font-medium',
    badgeBlue: isDark
      ? 'bg-blue-900/60 text-blue-200 border border-blue-700/50'
      : 'bg-blue-100 text-blue-800 border border-blue-300',
    badgeGreen: isDark
      ? 'bg-green-900/60 text-green-200 border border-green-700/50'
      : 'bg-green-100 text-green-800 border border-green-300',
    badgeYellow: isDark
      ? 'bg-yellow-900/60 text-yellow-200 border border-yellow-700/50'
      : 'bg-yellow-100 text-yellow-800 border border-yellow-300',
    badgeRed: isDark
      ? 'bg-red-900/60 text-red-200 border border-red-700/50'
      : 'bg-red-100 text-red-800 border border-red-300',
    badgePurple: isDark
      ? 'bg-purple-900/60 text-purple-200 border border-purple-700/50'
      : 'bg-purple-100 text-purple-800 border border-purple-300',
    badgeOrange: isDark
      ? 'bg-orange-900/60 text-orange-200 border border-orange-700/50'
      : 'bg-orange-100 text-orange-800 border border-orange-300',
    badgeGray: isDark
      ? 'bg-gray-700/60 text-gray-200 border border-gray-600/50'
      : 'bg-gray-200 text-gray-800 border border-gray-300',
    
    // Status badges - High contrast
    statusBlue: isDark 
      ? 'bg-blue-900/70 text-blue-200 border-blue-700' 
      : 'bg-blue-100 text-blue-800 border-blue-300',
    statusGreen: isDark 
      ? 'bg-green-900/70 text-green-200 border-green-700' 
      : 'bg-green-100 text-green-800 border-green-300',
    statusYellow: isDark 
      ? 'bg-yellow-900/70 text-yellow-200 border-yellow-700' 
      : 'bg-yellow-100 text-yellow-800 border-yellow-300',
    statusRed: isDark 
      ? 'bg-red-900/70 text-red-200 border-red-700' 
      : 'bg-red-100 text-red-800 border-red-300',
    statusGray: isDark 
      ? 'bg-gray-700/70 text-gray-200 border-gray-600' 
      : 'bg-gray-200 text-gray-800 border-gray-300',
    
    // Modals - Consistent
    modalBg: isDark ? 'bg-gray-800' : 'bg-white',
    modalBorder: isDark ? 'border-gray-700' : 'border-gray-200',
    modalOverlay: isDark ? 'bg-black/60 backdrop-blur-sm' : 'bg-black/40 backdrop-blur-sm',
    
    // Inputs - Standardized
    inputBg: isDark ? 'bg-gray-700/50' : 'bg-white',
    inputBorder: isDark ? 'border-gray-600' : 'border-gray-300',
    inputFocus: isDark ? 'focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500' : 'focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500',
    
    // Metric cards - Consistent
    metricCardBg: isDark
      ? 'bg-gray-700/50'
      : 'bg-gray-50',
    metricCardBorder: isDark
      ? 'border-gray-600'
      : 'border-gray-200',
    
    // Navigation
    navBg: isDark 
      ? 'bg-gray-800/80' 
      : 'bg-white/80',
    navBorder: isDark 
      ? 'border-gray-700' 
      : 'border-gray-200',
    
    // Loading states
    loadingText: isDark ? 'text-gray-300' : 'text-gray-700',
    loadingSpinner: isDark ? 'border-gray-600' : 'border-gray-300',
    
    // Empty states
    emptyStateBg: isDark ? 'bg-gray-700/30' : 'bg-gray-100',
    emptyStateText: isDark ? 'text-gray-400' : 'text-gray-500',
    
    // Accent gradients - Same in both modes for brand consistency
    accentGradient: 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600',
    accentGradientText: 'bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent',
    
    // Error/success messages - High contrast
    errorBg: isDark ? 'bg-red-900/80' : 'bg-red-50',
    errorText: isDark ? 'text-red-200' : 'text-red-800',
    errorBorder: isDark ? 'border-red-700' : 'border-red-300',
    
    successBg: isDark ? 'bg-green-900/80' : 'bg-green-50',
    successText: isDark ? 'text-green-200' : 'text-green-800',
    successBorder: isDark ? 'border-green-700' : 'border-green-300',
    
    // Filter buttons - Consistent
    filterButtonActive: isDark
      ? 'bg-indigo-600 text-white shadow-lg'
      : 'bg-indigo-600 text-white shadow-lg',
    filterButtonInactive: isDark
      ? 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
      : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    
    // Icon containers
    iconContainer: isDark
      ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
      : 'bg-gradient-to-br from-indigo-500 to-purple-600',
    iconContainerSecondary: isDark
      ? 'bg-gradient-to-br from-green-500 to-emerald-600'
      : 'bg-gradient-to-br from-green-500 to-emerald-600',
  };
};
