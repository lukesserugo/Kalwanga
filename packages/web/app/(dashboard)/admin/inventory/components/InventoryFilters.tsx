// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\inventory\components\InventoryFilters.tsx
'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Filter, X, ChevronDown, ChevronUp,
  Tag, MapPin, Package, AlertTriangle
} from 'lucide-react';

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

const categories = ['All', 'Electronics', 'Clothing', 'Food', 'Books', 'Home', 'Sports', 'Other'];
const locations = ['All', 'Warehouse', 'Store A', 'Store B', 'Online', 'Distribution Center'];
const statuses = ['All', 'Active', 'Low Stock', 'Out of Stock', 'Inactive'];

export function InventoryFilters({
  filters,
  onFilterChange,
  showFilters,
  onToggleFilters,
}: InventoryFiltersProps) {
  // Fix: Properly count active filters with type-safe checking
  const activeFilterCount = [
    filters.search && filters.search.trim() !== '',
    filters.category && filters.category !== '',
    filters.location && filters.location !== '',
    filters.status && filters.status !== 'all',
    filters.lowStock === true
  ].filter(Boolean).length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, SKU, or barcode..."
            value={filters.search}
            onChange={(e) => onFilterChange('search', e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Quick Filters */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleFilters}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                {activeFilterCount}
              </span>
            )}
            {showFilters ? (
              <ChevronUp className="w-4 h-4 ml-1" />
            ) : (
              <ChevronDown className="w-4 h-4 ml-1" />
            )}
          </button>

          <label className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={filters.lowStock}
              onChange={(e) => onFilterChange('lowStock', e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <AlertTriangle className="w-4 h-4" />
            <span className="hidden sm:inline">Low Stock</span>
          </label>
        </div>

        {/* Clear Filters */}
        {activeFilterCount > 0 && (
          <button
            onClick={() => {
              onFilterChange('search', '');
              onFilterChange('category', '');
              onFilterChange('location', '');
              onFilterChange('status', 'all');
              onFilterChange('lowStock', false);
            }}
            className="px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 inline mr-1" />
            Clear all
          </button>
        )}
      </div>

      {/* Expanded Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Tag className="w-4 h-4 inline mr-1" />
                  Category
                </label>
                <select
                  value={filters.category}
                  onChange={(e) => onFilterChange('category', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat === 'All' ? '' : cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Location
                </label>
                <select
                  value={filters.location}
                  onChange={(e) => onFilterChange('location', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {locations.map((loc) => (
                    <option key={loc} value={loc === 'All' ? '' : loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Package className="w-4 h-4 inline mr-1" />
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => onFilterChange('status', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {statuses.map((status) => (
                    <option key={status} value={status === 'All' ? 'all' : status.toLowerCase().replace(' ', '_')}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
