'use client';

import React, { useState, useEffect, useRef } from 'react';

interface Option {
  id: string;
  label: string;
  subtitle?: string;
  metadata?: any;
}

interface SearchableMultiSelectProps {
  options: Option[];
  selectedIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  onSearch?: (query: string) => Promise<Option[]>;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  maxSelections?: number;
  minSelections?: number;
  className?: string;
  disabled?: boolean;
  showSelectedCount?: boolean;
  allowCustomSearch?: boolean;
}

export function SearchableMultiSelect({
  options,
  selectedIds,
  onSelectionChange,
  onSearch,
  placeholder = "Select items...",
  searchPlaceholder = "Search...",
  emptyMessage = "No items found",
  maxSelections,
  minSelections = 0,
  className = "",
  disabled = false,
  showSelectedCount = true,
  allowCustomSearch = false
}: SearchableMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Option[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState<Option[]>(options);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter local options based on search
  useEffect(() => {
    if (!searchQuery) {
      setFilteredOptions(options);
      setSearchResults([]);
      return;
    }

    const filtered = options.filter(option =>
      option.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      option.subtitle?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredOptions(filtered);

    // If custom search is enabled and we have a search function, also search externally
    if (allowCustomSearch && onSearch && searchQuery.length >= 2) {
      performCustomSearch(searchQuery);
    }
  }, [searchQuery, options, allowCustomSearch, onSearch]);

  const performCustomSearch = async (query: string) => {
    if (!onSearch) return;
    
    setIsSearching(true);
    try {
      const results = await onSearch(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleToggleOption = (optionId: string) => {
    const isSelected = selectedIds.includes(optionId);
    let newSelection: string[];

    if (isSelected) {
      // Remove from selection
      newSelection = selectedIds.filter(id => id !== optionId);
    } else {
      // Add to selection if under max limit
      if (maxSelections && selectedIds.length >= maxSelections) {
        return; // Max selections reached
      }
      newSelection = [...selectedIds, optionId];
    }

    onSelectionChange(newSelection);
  };

  const removeSelection = (optionId: string) => {
    const newSelection = selectedIds.filter(id => id !== optionId);
    onSelectionChange(newSelection);
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  const getSelectedOptions = () => {
    return options.filter(option => selectedIds.includes(option.id));
  };

  const getAllOptions = () => {
    // Combine local filtered options with search results, removing duplicates
    const combined = [...filteredOptions];
    searchResults.forEach(result => {
      if (!combined.find(opt => opt.id === result.id)) {
        combined.push(result);
      }
    });
    return combined;
  };

  const selectedOptions = getSelectedOptions();
  const allOptions = getAllOptions();

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Main Display */}
      <div
        className={`
          w-full border rounded-xl cursor-pointer transition-all min-h-[3rem]
          ${disabled 
            ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed' 
            : isOpen
              ? 'border-purple-500 bg-gray-700 text-white ring-2 ring-purple-500/20'
              : 'border-gray-600 bg-gray-700 text-white hover:border-purple-400'
          }
        `}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="p-3">
          {/* Selected Items */}
          {selectedOptions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedOptions.map((option) => (
                <div
                  key={option.id}
                  className="flex items-center space-x-2 bg-purple-600/80 text-white px-3 py-1 rounded-lg text-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="font-medium">{option.label}</span>
                  {option.subtitle && (
                    <span className="text-purple-200 text-xs">({option.subtitle})</span>
                  )}
                  <button
                    onClick={() => removeSelection(option.id)}
                    className="text-purple-200 hover:text-white ml-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              {showSelectedCount && (
                <div className="flex items-center text-gray-400 text-sm px-2">
                  {selectedOptions.length} selected
                  {maxSelections && ` / ${maxSelections}`}
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-400 py-1">{placeholder}</div>
          )}
          
          {/* Actions */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center space-x-2">
              {selectedOptions.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearAll();
                  }}
                  className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded"
                >
                  Clear All
                </button>
              )}
            </div>
            
            <svg 
              className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-2 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl max-h-80 overflow-hidden">
          {/* Search Input */}
          <div className="p-3 border-b border-gray-600">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full px-3 py-2 pl-10 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-48 overflow-y-auto">
            {allOptions.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-400">
                <svg className="w-8 h-8 mx-auto mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-sm">{emptyMessage}</p>
              </div>
            ) : (
              allOptions.map((option) => {
                const isSelected = selectedIds.includes(option.id);
                const isMaxReached = maxSelections && selectedIds.length >= maxSelections && !isSelected;
                
                return (
                  <div
                    key={option.id}
                    className={`
                      px-4 py-3 border-b border-gray-700/50 last:border-b-0 transition-colors
                      ${isMaxReached 
                        ? 'text-gray-500 cursor-not-allowed' 
                        : 'cursor-pointer hover:bg-gray-700/50'
                      }
                      ${isSelected ? 'bg-purple-900/30 border-l-4 border-l-purple-500' : ''}
                    `}
                    onClick={() => !isMaxReached && handleToggleOption(option.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className={`font-medium ${isSelected ? 'text-purple-300' : 'text-white'}`}>
                          {option.label}
                        </div>
                        {option.subtitle && (
                          <div className="text-sm text-gray-400 mt-1">{option.subtitle}</div>
                        )}
                      </div>
                      
                      <div className="ml-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          isSelected 
                            ? 'bg-purple-600 border-purple-600' 
                            : 'border-gray-400'
                        }`}>
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          {/* Selection Info */}
          {(maxSelections || minSelections > 0) && (
            <div className="px-4 py-2 border-t border-gray-600 bg-gray-700/50">
              <div className="text-xs text-gray-400 flex justify-between">
                <span>
                  Selected: {selectedIds.length}
                  {maxSelections && ` / ${maxSelections}`}
                </span>
                {minSelections > 0 && selectedIds.length < minSelections && (
                  <span className="text-yellow-400">
                    Need {minSelections - selectedIds.length} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 