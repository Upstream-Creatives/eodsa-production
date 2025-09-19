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

// Theme class utilities
export const getThemeClasses = (theme: Theme) => {
  return {
    // Main backgrounds
    mainBg: theme === 'dark' 
      ? 'bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800' 
      : 'bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50',
    
    // Loading background
    loadingBg: theme === 'dark'
      ? 'bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800'
      : 'bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50',
    
    // Headers
    headerBg: theme === 'dark' 
      ? 'bg-gray-800/90' 
      : 'bg-white/90',
    headerBorder: theme === 'dark' 
      ? 'border-gray-700' 
      : 'border-indigo-100',
    
    // Cards and containers
    cardBg: theme === 'dark' 
      ? 'bg-gray-800/90' 
      : 'bg-white/95',
    cardBorder: theme === 'dark' 
      ? 'border-gray-600' 
      : 'border-gray-300',
    
    // Navigation
    navBg: theme === 'dark' 
      ? 'bg-gray-800/70' 
      : 'bg-white/70',
    navBorder: theme === 'dark' 
      ? 'border-gray-700/50' 
      : 'border-white/50',
    
    // Text colors
    textPrimary: theme === 'dark' ? 'text-white' : 'text-gray-900',
    textSecondary: theme === 'dark' ? 'text-gray-300' : 'text-gray-700',
    textMuted: theme === 'dark' ? 'text-gray-400' : 'text-gray-500',
    
    // Tables
    tableHeader: theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50',
    tableHeaderText: theme === 'dark' ? 'text-gray-100' : 'text-gray-900',
    tableRow: theme === 'dark' ? 'bg-gray-800' : 'bg-white',
    tableRowHover: theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50',
    tableBorder: theme === 'dark' ? 'divide-gray-600' : 'divide-gray-300',
    
    // Modals
    modalBg: theme === 'dark' ? 'bg-gray-800' : 'bg-white',
    modalBorder: theme === 'dark' ? 'border-gray-700' : 'border-gray-200',
    
    // Status indicators
    systemOnlineBg: theme === 'dark' ? 'bg-gray-700' : 'bg-indigo-50',
    
    // Status badges
    statusBlue: theme === 'dark' 
      ? 'bg-blue-900/80 text-blue-200 border-blue-700' 
      : 'bg-blue-50 text-blue-700 border-blue-200',
    statusGreen: theme === 'dark' 
      ? 'bg-green-900/80 text-green-200 border-green-700' 
      : 'bg-green-50 text-green-700 border-green-200',
    statusYellow: theme === 'dark' 
      ? 'bg-yellow-900/80 text-yellow-200 border-yellow-700' 
      : 'bg-yellow-50 text-yellow-700 border-yellow-200',
    statusRed: theme === 'dark' 
      ? 'bg-red-900/80 text-red-200 border-red-700' 
      : 'bg-red-50 text-red-700 border-red-200',
    statusGray: theme === 'dark' 
      ? 'bg-gray-700/80 text-gray-200 border-gray-600' 
      : 'bg-gray-50 text-gray-700 border-gray-200',
    
    // Loading states
    loadingText: theme === 'dark' ? 'text-gray-300' : 'text-gray-700',
    loadingSpinner: theme === 'dark' ? 'border-gray-600' : 'border-indigo-100',
    
    // Empty states
    emptyStateBg: theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100',
    
    // Accent colors for gradients remain the same for consistency
    accentGradient: 'bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400',
    
    // Error/success messages
    errorBg: theme === 'dark' ? 'bg-red-900/80' : 'bg-red-50',
    errorText: theme === 'dark' ? 'text-red-200' : 'text-red-700',
    errorBorder: theme === 'dark' ? 'border-red-700' : 'border-red-200',
    
    successBg: theme === 'dark' ? 'bg-green-900/80' : 'bg-green-50',
    successText: theme === 'dark' ? 'text-green-200' : 'text-green-700',
    successBorder: theme === 'dark' ? 'border-green-700' : 'border-green-200',
  };
};
