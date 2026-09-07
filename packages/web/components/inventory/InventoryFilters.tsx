'use client';

import React from 'react';
import { Search, Filter, X } from 'lucide-react';

interface InventoryFiltersProps {
  filters: {
    search: string;
    category: string;
    location: string;
    status: string;
    lowStock: boolean;
  };
  onFilterChange: (key: string, value: any) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
}

export function InventoryFilters({
  filters,
  onFilterChange,
  showFilters,
  onToggleFilters,
}: InventoryFiltersProps) {
  const hasActiveFilters = Boolean(
    filters.search ||
    filters.category ||
    filters.location ||
    filters.status !== 'all' ||
    filters.lowStock
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search inventory..."
              value={filters.search}
              onChange={(e) => onFilterChange('search', e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Filter Toggle */}
        <button
          onClick={onToggleFilters}
          className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors ${
            showFilters || hasActiveFilters
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
          {hasActiveFilters && (
            <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">
              {Object.values(filters).filter(v => v && v !== 'all').length}
            </span>
          )}
        </button>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={() => {
              onFilterChange('search', '');
              onFilterChange('category', '');
              onFilterChange('location', '');
              onFilterChange('status', 'all');
              onFilterChange('lowStock', false);
            }}
            className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category
            </label>
            <input
              type="text"
              value={filters.category}
              onChange={(e) => onFilterChange('category', e.target.value)}
              placeholder="Filter by category"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Location
            </label>
            <input
              type="text"
              value={filters.location}
              onChange={(e) => onFilterChange('location', e.target.value)}
              placeholder="Filter by location"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => onFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.lowStock}
                onChange={(e) => onFilterChange('lowStock', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Low Stock Only</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
