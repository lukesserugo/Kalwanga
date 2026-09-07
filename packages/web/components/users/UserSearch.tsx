// D:\Projects\Kalwanga\packages\web\components\users\UserSearch.tsx

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, Loader2, User as UserIcon, Mail, Users } from 'lucide-react';
import { userService } from '../../services/userService';
import type { User as UserType } from '../../types/user';
import { useDebounce } from '../../hooks/useDebounce';

interface UserSearchProps {
  onSelect?: (user: UserType) => void;
  placeholder?: string;
  className?: string;
  minChars?: number;
  maxResults?: number;
  autoFocus?: boolean;
  excludeIds?: string[];
}

export function UserSearch({
  onSelect,
  placeholder = 'Search users...',
  className = '',
  minChars = 2,
  maxResults = 10,
  autoFocus = false,
  excludeIds = [],
}: UserSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const debouncedQuery = useDebounce(query, 300);

  // Search users
  const searchUsers = useCallback(async () => {
    if (!debouncedQuery.trim() || debouncedQuery.length < minChars) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await userService.searchUsers(debouncedQuery, { 
        limit: maxResults,
        isActive: true,
      });
      
      let users = response.data || [];
      
      // Exclude specific users
      if (excludeIds.length > 0) {
        users = users.filter((user: UserType) => !excludeIds.includes(user.id));
      }
      
      setResults(users);
      setIsOpen(users.length > 0);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Failed to search users:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, minChars, maxResults, excludeIds]);

  // Trigger search on query change
  useEffect(() => {
    searchUsers();
  }, [searchUsers]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (user: UserType) => {
    if (onSelect) {
      onSelect(user);
    }
    setQuery('');
    setIsOpen(false);
    setResults([]);
  };

  const handleClear = () => {
    setQuery('');
    setIsOpen(false);
    setResults([]);
    inputRef.current?.focus();
  };

  const getFullName = (user: UserType) => {
    return `${user.firstName} ${user.lastName}`.trim() || user.email;
  };

  const getInitials = (user: UserType) => {
    return `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || '?';
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" />
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-80 overflow-y-auto">
          {results.map((user, index) => (
            <button
              key={user.id}
              onClick={() => handleSelect(user)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                selectedIndex === index ? 'bg-gray-50 dark:bg-gray-700' : ''
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-medium flex-shrink-0">
                {getInitials(user)}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">
                  {getFullName(user)}
                </p>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <Mail className="w-3 h-3" />
                  <span className="truncate">{user.email}</span>
                </div>
              </div>
              <div className="flex-shrink-0">
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                  {user.role?.replace('_', ' ')}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No Results */}
      {isOpen && query.length >= minChars && results.length === 0 && !loading && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
          <Users className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No users found</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Try adjusting your search
          </p>
        </div>
      )}
    </div>
  );
}

export default UserSearch;
