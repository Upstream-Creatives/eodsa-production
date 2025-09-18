'use client';

import React from 'react';
import { useTheme } from '@/components/providers/ThemeProvider';

interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`inline-flex items-center space-x-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg sm:rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 shadow-lg text-sm sm:text-base font-medium ${className}`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <span className="text-sm sm:text-base">
        {theme === 'dark' ? '☀️' : '🌙'}
      </span>
      <span className="hidden sm:inline">
        {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
      </span>
      <span className="sm:hidden">
        {theme === 'dark' ? 'Light' : 'Dark'}
      </span>
    </button>
  );
};
