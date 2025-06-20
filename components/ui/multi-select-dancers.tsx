'use client';

import React, { useState, useEffect, useRef } from 'react';

interface Dancer {
  id: string;
  name: string;
  age: number;
  eodsaId?: string;
  studioName?: string;
  nationalId?: string;
}

interface MultiSelectDancersProps {
  selectedDancers: Dancer[];
  onSelectionChange: (dancers: Dancer[]) => void;
  onSearch?: (query: string) => Promise<Dancer[]>;
  placeholder?: string;
  maxSelections?: number;
  minSelections?: number;
  className?: string;
  disabled?: boolean;
}

export function MultiSelectDancers({
  selectedDancers,
  onSelectionChange,
  onSearch,
  placeholder = "Search and select dancers...",
  maxSelections,
  minSelections = 0,
  className = "",
  disabled = false
}: MultiSelectDancersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Dancer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Perform search when query changes
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    if (onSearch) {
      performSearch(searchQuery);
    }
  }, [searchQuery, onSearch]);

  const performSearch = async (query: string) => {
    if (!onSearch) return;
    
    setIsSearching(true);
    try {
      const results = await onSearch(query);
      // Filter out already selected dancers
      const filtered = results.filter(dancer => 
        !selectedDancers.find(selected => selected.id === dancer.id)
      );
      setSearchResults(filtered);
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

  const handleAddDancer = (dancer: Dancer) => {
    if (maxSelections && selectedDancers.length >= maxSelections) {
      return; // Max selections reached
    }

    const newSelection = [...selectedDancers, dancer];
    onSelectionChange(newSelection);
    
    // Remove from search results
    setSearchResults(prev => prev.filter(d => d.id !== dancer.id));
    setSearchQuery('');
  };

  const handleRemoveDancer = (dancerId: string) => {
    const newSelection = selectedDancers.filter(dancer => dancer.id !== dancerId);
    onSelectionChange(newSelection);
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Selected Dancers Display */}
      {selectedDancers.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-white font-medium">Selected Dancers ({selectedDancers.length})</h4>
            <button
              onClick={clearAll}
              className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded"
            >
              Clear All
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedDancers.map((dancer) => (
              <div
                key={dancer.id}
                className="flex items-center space-x-2 bg-purple-600/80 text-white px-3 py-2 rounded-lg text-sm"
              >
                <div className="w-6 h-6 bg-purple-700 rounded-full flex items-center justify-center text-xs font-bold">
                  {dancer.name.charAt(0)}
                </div>
                <div>
                  <div className="font-medium">{dancer.name}</div>
                  <div className="text-xs text-purple-200">
                    Age {dancer.age} • {dancer.studioName || 'Private'}
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveDancer(dancer.id)}
                  className="text-purple-200 hover:text-white ml-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search Input */}
      <div
        className={`
          w-full border rounded-xl transition-all
          ${disabled 
            ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed' 
            : isOpen
              ? 'border-purple-500 bg-gray-700 text-white ring-2 ring-purple-500/20'
              : 'border-gray-600 bg-gray-700 text-white hover:border-purple-400'
          }
        `}
      >
        <div className="p-3">
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder={placeholder}
              disabled={disabled}
              className="w-full px-3 py-2 pl-10 bg-transparent border-0 text-white placeholder-gray-400 focus:outline-none"
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
          
          {/* Selection Info */}
          <div className="mt-2 flex justify-between items-center text-xs text-gray-400">
            <span>
              {selectedDancers.length} selected
              {maxSelections && ` / ${maxSelections}`}
            </span>
            {minSelections > 0 && selectedDancers.length < minSelections && (
              <span className="text-yellow-400">
                Need {minSelections - selectedDancers.length} more
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Search Results Dropdown */}
      {isOpen && !disabled && searchQuery.length >= 2 && (
        <div className="absolute z-50 w-full mt-2 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl max-h-60 overflow-hidden">
          <div className="max-h-60 overflow-y-auto">
            {searchResults.length === 0 && !isSearching ? (
              <div className="px-4 py-6 text-center text-gray-400">
                <svg className="w-8 h-8 mx-auto mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-sm">No dancers found matching "{searchQuery}"</p>
              </div>
            ) : (
              searchResults.map((dancer) => {
                const isMaxReached = maxSelections && selectedDancers.length >= maxSelections;
                
                return (
                  <div
                    key={dancer.id}
                    className={`
                      px-4 py-3 border-b border-gray-700/50 last:border-b-0 transition-colors
                      ${isMaxReached 
                        ? 'text-gray-500 cursor-not-allowed' 
                        : 'cursor-pointer hover:bg-gray-700/50 text-white'
                      }
                    `}
                    onClick={() => !isMaxReached && handleAddDancer(dancer)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          {dancer.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium">{dancer.name}</div>
                          <div className="text-sm text-gray-400">
                            {dancer.eodsaId && `${dancer.eodsaId} • `}
                            Age {dancer.age} • {dancer.studioName || 'Private'}
                          </div>
                        </div>
                      </div>
                      
                      {!isMaxReached && (
                        <button className="px-3 py-1 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors">
                          Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Search Instructions */}
      {searchQuery.length > 0 && searchQuery.length < 2 && (
        <div className="mt-2 text-xs text-gray-400">
          Type at least 2 characters to search...
        </div>
      )}
    </div>
  );
}
