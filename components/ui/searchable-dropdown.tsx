'use client';

import { useState, useEffect, useRef } from 'react';

interface Option {
  id: string;
  label: string;
  value: string;
  subtitle?: string;
  metadata?: Record<string, any>;
}

interface SearchableDropdownProps {
  options: Option[];
  value?: string;
  placeholder?: string;
  onSelect: (option: Option) => void;
  onClear?: () => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
  maxHeight?: string;
  showSearch?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function SearchableDropdown({
  options,
  value,
  placeholder = "Select an option...",
  onSelect,
  onClear,
  searchPlaceholder = "Search...",
  emptyMessage = "No options found",
  maxHeight = "max-h-60",
  showSearch = true,
  disabled = false,
  className = ""
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredOptions, setFilteredOptions] = useState<Option[]>(options);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter options based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredOptions(options);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = options.filter(option => 
        option.label.toLowerCase().includes(query) ||
        option.subtitle?.toLowerCase().includes(query) ||
        option.value.toLowerCase().includes(query)
      );
      setFilteredOptions(filtered);
    }
    setHighlightedIndex(-1);
  }, [searchQuery, options]);

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
    if (isOpen && showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, showSearch]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        setIsOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;
    }
  };

  const handleSelect = (option: Option) => {
    onSelect(option);
    setIsOpen(false);
    setSearchQuery('');
    setHighlightedIndex(-1);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClear) {
      onClear();
    }
    setSearchQuery('');
  };

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Dropdown Trigger */}
      <div
        className={`
          w-full px-4 py-3 border rounded-xl cursor-pointer transition-all
          ${disabled 
            ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed' 
            : isOpen
              ? 'border-purple-500 bg-gray-700 text-white ring-2 ring-purple-500/20'
              : 'border-gray-600 bg-gray-700 text-white hover:border-purple-400'
          }
        `}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            {selectedOption ? (
              <div>
                <div className="font-medium text-white truncate">
                  {selectedOption.label}
                </div>
                {selectedOption.subtitle && (
                  <div className="text-sm text-gray-400 truncate">
                    {selectedOption.subtitle}
                  </div>
                )}
              </div>
            ) : (
              <span className="text-gray-400">{placeholder}</span>
            )}
          </div>
          
          <div className="flex items-center space-x-2 ml-3">
            {selectedOption && onClear && !disabled && (
              <button
                onClick={handleClear}
                className="p-1 text-gray-400 hover:text-white rounded-full hover:bg-gray-600 transition-colors"
                tabIndex={-1}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            
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
        <div className={`
          absolute z-50 w-full mt-2 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl
          ${maxHeight} overflow-hidden
        `}>
          {/* Search Input */}
          {showSearch && (
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
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-400">
                <svg className="w-8 h-8 mx-auto mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-sm">{emptyMessage}</p>
              </div>
            ) : (
              filteredOptions.map((option, index) => (
                <div
                  key={option.id}
                  className={`
                    px-4 py-3 cursor-pointer transition-colors border-b border-gray-700/50 last:border-b-0
                    ${highlightedIndex === index 
                      ? 'bg-purple-600/20 text-purple-300' 
                      : 'text-white hover:bg-gray-700/50'
                    }
                    ${selectedOption?.id === option.id ? 'bg-purple-900/30' : ''}
                  `}
                  onClick={() => handleSelect(option)}
                  role="option"
                  aria-selected={selectedOption?.id === option.id}
                >
                  <div className="font-medium">{option.label}</div>
                  {option.subtitle && (
                    <div className="text-sm text-gray-400 mt-1">{option.subtitle}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
} 