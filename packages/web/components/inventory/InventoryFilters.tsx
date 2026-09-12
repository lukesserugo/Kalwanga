// D:\Projects\Kalwanga\packages\web\components\inventory\InventoryFilters.tsx

'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Filter, X, ChevronDown, ChevronUp,
  Tag, MapPin, AlertTriangle, CheckCircle,
  Barcode, Globe, Star, Archive, DollarSign,
  RefreshCw, Calendar, Hash, Weight, Percent,
  Building, Users, Package
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

// ============================================
// TYPES
// ============================================

export interface InventoryFiltersData {
  search: string;
  category: string;
  categoryId?: string;
  location: string;
  status: string;
  lowStock: boolean;
  hasBarcode: 'all' | 'yes' | 'no';
  hasImages: 'all' | 'yes' | 'no';
  isActive: 'all' | 'yes' | 'no';
  isDigital: 'all' | 'yes' | 'no';
  featured: 'all' | 'yes' | 'no';
  minPrice?: number;
  maxPrice?: number;
  supplier?: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  businessUnitId?: string;
}

export interface InventoryFiltersProps {
  filters: InventoryFiltersData;
  onFilterChange: (key: string, value: any) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  categories?: Array<{ id: string; name: string }>;
  locations?: string[];
  suppliers?: Array<{ id: string; name: string }>;
  loading?: boolean;
  className?: string;
}

// ============================================
// CONSTANTS
// ============================================

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'low_stock', label: 'Low Stock' },
  { value: 'out_of_stock', label: 'Out of Stock' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'discontinued', label: 'Discontinued' },
];

const BARCODE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'yes', label: 'Has Barcode' },
  { value: 'no', label: 'No Barcode' },
];

const BOOLEAN_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'sku', label: 'SKU' },
  { value: 'stock', label: 'Stock' },
  { value: 'price', label: 'Price' },
  { value: 'value', label: 'Total Value' },
  { value: 'createdAt', label: 'Created Date' },
  { value: 'updatedAt', label: 'Last Updated' },
];

const DEFAULT_LOCATIONS = [
  'Warehouse',
  'Storefront',
  'Backroom',
  'Supplier',
  'In Transit',
  'Distribution Center',
  'Store A',
  'Store B',
  'Online Store',
];

// ============================================
// SUB-COMPONENTS
// ============================================

const FilterSection: React.FC<{
  label: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}> = ({ label, icon: Icon, children }) => {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400">
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {label}
        </label>
      )}
      {children}
    </div>
  );
};

const FilterBadge: React.FC<{ label: string; onRemove?: () => void }> = ({ label, onRemove }) => {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full">
      {label}
      {onRemove && (
        <button onClick={onRemove} className="hover:text-blue-900 dark:hover:text-blue-100">
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export function InventoryFilters({
  filters,
  onFilterChange,
  showFilters,
  onToggleFilters,
  categories = [],
  locations = [],
  suppliers = [],
  loading = false,
  className = '',
}: InventoryFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.search);

  const allLocations = locations.length > 0 ? locations : DEFAULT_LOCATIONS;
  const allCategories = categories.length > 0 ? categories : [];

  // Count active filters
  const activeFilterCount = [
    filters.search ? 1 : 0,
    filters.category ? 1 : 0,
    filters.categoryId ? 1 : 0,
    filters.location ? 1 : 0,
    filters.status !== 'all' ? 1 : 0,
    filters.lowStock ? 1 : 0,
    filters.hasBarcode !== 'all' ? 1 : 0,
    filters.hasImages !== 'all' ? 1 : 0,
    filters.isActive !== 'all' ? 1 : 0,
    filters.isDigital !== 'all' ? 1 : 0,
    filters.featured !== 'all' ? 1 : 0,
    filters.minPrice ? 1 : 0,
    filters.maxPrice ? 1 : 0,
    filters.supplier ? 1 : 0,
    filters.sortBy !== 'name' ? 1 : 0,
    filters.sortOrder !== 'asc' ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange('search', searchInput);
  };

  const handleSearchClear = () => {
    setSearchInput('');
    onFilterChange('search', '');
  };

  const handleClearFilters = useCallback(() => {
    onFilterChange('search', '');
    onFilterChange('category', '');
    onFilterChange('categoryId', '');
    onFilterChange('location', '');
    onFilterChange('status', 'all');
    onFilterChange('lowStock', false);
    onFilterChange('hasBarcode', 'all');
    onFilterChange('hasImages', 'all');
    onFilterChange('isActive', 'all');
    onFilterChange('isDigital', 'all');
    onFilterChange('featured', 'all');
    onFilterChange('minPrice', undefined);
    onFilterChange('maxPrice', undefined);
    onFilterChange('supplier', '');
    onFilterChange('sortBy', 'name');
    onFilterChange('sortOrder', 'asc');
    setSearchInput('');
  }, [onFilterChange]);

  // Get active filter labels for display
  const getActiveFilterLabels = useCallback(() => {
    const labels: Array<{ key: string; label: string; onRemove: () => void }> = [];

    if (filters.search) {
      labels.push({
        key: 'search',
        label: `Search: "${filters.search}"`,
        onRemove: () => {
          setSearchInput('');
          onFilterChange('search', '');
        },
      });
    }

    if (filters.category) {
      labels.push({
        key: 'category',
        label: `Category: ${filters.category}`,
        onRemove: () => {
          onFilterChange('category', '');
          onFilterChange('categoryId', '');
        },
      });
    }

    if (filters.categoryId) {
      const cat = allCategories.find(c => c.id === filters.categoryId);
      if (cat) {
        labels.push({
          key: 'categoryId',
          label: `Category: ${cat.name}`,
          onRemove: () => {
            onFilterChange('categoryId', '');
            onFilterChange('category', '');
          },
        });
      }
    }

    if (filters.location) {
      labels.push({
        key: 'location',
        label: `Location: ${filters.location}`,
        onRemove: () => onFilterChange('location', ''),
      });
    }

    if (filters.status !== 'all') {
      const status = STATUS_OPTIONS.find(s => s.value === filters.status);
      if (status) {
        labels.push({
          key: 'status',
          label: `Status: ${status.label}`,
          onRemove: () => onFilterChange('status', 'all'),
        });
      }
    }

    if (filters.hasBarcode !== 'all') {
      const barcode = BARCODE_OPTIONS.find(b => b.value === filters.hasBarcode);
      if (barcode) {
        labels.push({
          key: 'hasBarcode',
          label: `Barcode: ${barcode.label}`,
          onRemove: () => onFilterChange('hasBarcode', 'all'),
        });
      }
    }

    if (filters.isDigital !== 'all') {
      labels.push({
        key: 'isDigital',
        label: `Digital: ${filters.isDigital === 'yes' ? 'Yes' : 'No'}`,
        onRemove: () => onFilterChange('isDigital', 'all'),
      });
    }

    if (filters.featured !== 'all') {
      labels.push({
        key: 'featured',
        label: `Featured: ${filters.featured === 'yes' ? 'Yes' : 'No'}`,
        onRemove: () => onFilterChange('featured', 'all'),
      });
    }

    if (filters.isActive !== 'all') {
      labels.push({
        key: 'isActive',
        label: `Active: ${filters.isActive === 'yes' ? 'Yes' : 'No'}`,
        onRemove: () => onFilterChange('isActive', 'all'),
      });
    }

    if (filters.lowStock) {
      labels.push({
        key: 'lowStock',
        label: 'Low Stock Only',
        onRemove: () => onFilterChange('lowStock', false),
      });
    }

    if (filters.minPrice !== undefined) {
      labels.push({
        key: 'minPrice',
        label: `Min Price: ${formatCurrency(filters.minPrice)}`,
        onRemove: () => onFilterChange('minPrice', undefined),
      });
    }

    if (filters.maxPrice !== undefined) {
      labels.push({
        key: 'maxPrice',
        label: `Max Price: ${formatCurrency(filters.maxPrice)}`,
        onRemove: () => onFilterChange('maxPrice', undefined),
      });
    }

    if (filters.supplier) {
      labels.push({
        key: 'supplier',
        label: `Supplier: ${filters.supplier}`,
        onRemove: () => onFilterChange('supplier', ''),
      });
    }

    return labels;
  }, [filters, allCategories, onFilterChange]);

  const activeFilterLabels = getActiveFilterLabels();

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Main Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[180px] relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, SKU, or barcode..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onBlur={() => {
              if (searchInput !== filters.search) {
                onFilterChange('search', searchInput);
              }
            }}
            disabled={loading}
            className="w-full pl-9 pr-8 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
          />
          {searchInput && (
            <button
              type="button"
              onClick={handleSearchClear}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>

        {/* Filter Toggle Button */}
        <button
          onClick={onToggleFilters}
          disabled={loading}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 ${
            showFilters || activeFilterCount > 0
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <Filter className="w-4 h-4" />
          <span className="hidden sm:inline">Filters</span>
          {activeFilterCount > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full min-w-[18px] text-center">
              {activeFilterCount}
            </span>
          )}
          {showFilters ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {/* Clear All Filters Button */}
        {activeFilterCount > 0 && (
          <button
            onClick={handleClearFilters}
            disabled={loading}
            className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 flex items-center gap-1 disabled:opacity-50 transition-colors"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Clear All</span>
          </button>
        )}
      </div>

      {/* Active Filter Badges */}
      {activeFilterLabels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeFilterLabels.map(({ key, label, onRemove }) => (
            <FilterBadge key={key} label={label} onRemove={onRemove} />
          ))}
        </div>
      )}

      {/* Expanded Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* Category Filter */}
                <FilterSection label="Category" icon={Tag}>
                  <select
                    value={filters.categoryId || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value) {
                        const cat = allCategories.find(c => c.id === value);
                        onFilterChange('categoryId', value);
                        onFilterChange('category', cat?.name || '');
                      } else {
                        onFilterChange('categoryId', '');
                        onFilterChange('category', '');
                      }
                    }}
                    disabled={loading}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                  >
                    <option value="">All Categories</option>
                    {allCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                    <option value="__custom__">Custom Category</option>
                  </select>
                  {filters.category && !filters.categoryId && (
                    <input
                      type="text"
                      value={filters.category}
                      onChange={(e) => onFilterChange('category', e.target.value)}
                      placeholder="Enter category..."
                      className="w-full mt-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </FilterSection>

                {/* Location Filter */}
                <FilterSection label="Location" icon={MapPin}>
                  <select
                    value={filters.location}
                    onChange={(e) => onFilterChange('location', e.target.value)}
                    disabled={loading}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                  >
                    <option value="">All Locations</option>
                    {allLocations.map((loc) => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </FilterSection>

                {/* Status Filter */}
                <FilterSection label="Status" icon={AlertTriangle}>
                  <select
                    value={filters.status}
                    onChange={(e) => onFilterChange('status', e.target.value)}
                    disabled={loading}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </FilterSection>

                {/* Barcode Filter */}
                <FilterSection label="Barcode" icon={Barcode}>
                  <select
                    value={filters.hasBarcode}
                    onChange={(e) => onFilterChange('hasBarcode', e.target.value as 'all' | 'yes' | 'no')}
                    disabled={loading}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                  >
                    {BARCODE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </FilterSection>

                {/* Sort By */}
                <FilterSection label="Sort By" icon={Package}>
                  <select
                    value={filters.sortBy}
                    onChange={(e) => onFilterChange('sortBy', e.target.value)}
                    disabled={loading}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </FilterSection>

                {/* Sort Order */}
                <FilterSection label="Sort Order">
                  <select
                    value={filters.sortOrder}
                    onChange={(e) => onFilterChange('sortOrder', e.target.value as 'asc' | 'desc')}
                    disabled={loading}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                  >
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </select>
                </FilterSection>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                {/* Supplier Filter */}
                <FilterSection label="Supplier" icon={Building}>
                  {suppliers.length > 0 ? (
                    <select
                      value={filters.supplier || ''}
                      onChange={(e) => onFilterChange('supplier', e.target.value)}
                      disabled={loading}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                    >
                      <option value="">All Suppliers</option>
                      {suppliers.map((sup) => (
                        <option key={sup.id} value={sup.id}>{sup.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={filters.supplier || ''}
                      onChange={(e) => onFilterChange('supplier', e.target.value)}
                      placeholder="Filter by supplier"
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </FilterSection>

                {/* Price Range */}
                <FilterSection label="Price Range" icon={DollarSign}>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={filters.minPrice || ''}
                      onChange={(e) => onFilterChange('minPrice', e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder="Min"
                      disabled={loading}
                      className="w-1/2 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                    />
                    <input
                      type="number"
                      value={filters.maxPrice || ''}
                      onChange={(e) => onFilterChange('maxPrice', e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder="Max"
                      disabled={loading}
                      className="w-1/2 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                    />
                  </div>
                </FilterSection>

                {/* Toggle Filters */}
                <FilterSection label="Filters">
                  <div className="flex flex-wrap gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.lowStock}
                        onChange={(e) => onFilterChange('lowStock', e.target.checked)}
                        disabled={loading}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50"
                      />
                      Low Stock
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.isDigital === 'yes'}
                        onChange={(e) => onFilterChange('isDigital', e.target.checked ? 'yes' : 'all')}
                        disabled={loading}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50"
                      />
                      Digital
                    </label>
                  </div>
                </FilterSection>

                {/* Additional Toggles */}
                <FilterSection label="More Filters">
                  <div className="flex flex-wrap gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.featured === 'yes'}
                        onChange={(e) => onFilterChange('featured', e.target.checked ? 'yes' : 'all')}
                        disabled={loading}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50"
                      />
                      Featured
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.isActive === 'yes'}
                        onChange={(e) => onFilterChange('isActive', e.target.checked ? 'yes' : 'all')}
                        disabled={loading}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50"
                      />
                      Active
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.hasImages === 'yes'}
                        onChange={(e) => onFilterChange('hasImages', e.target.checked ? 'yes' : 'all')}
                        disabled={loading}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50"
                      />
                      Has Images
                    </label>
                  </div>
                </FilterSection>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>{activeFilterCount} active filter{activeFilterCount !== 1 ? 's' : ''}</span>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={handleClearFilters}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <button
                  onClick={onToggleFilters}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Close Filters
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// EXPORT
// ============================================

export default InventoryFilters;
