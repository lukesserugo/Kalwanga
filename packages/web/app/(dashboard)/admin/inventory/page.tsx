// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\inventory\page.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, TrendingUp, TrendingDown, AlertTriangle,
  DollarSign, Clock, RefreshCw, Plus, Search,
  Filter, Download, Eye, Edit, Trash2, Truck,
  Upload, Settings, BarChart3, PieChart,
  ShoppingCart, Users, Building, Tag,
  Bell, ChevronRight, ChevronDown, X,
  CheckCircle, AlertCircle, HelpCircle, Lock,
  Grid, List, LayoutGrid, Barcode, QrCode, Scan,
  Printer, Copy, ExternalLink, MoreVertical,
  Archive, RefreshCcw, FileSpreadsheet, FileText,
  Building2, ChevronUp, Database, Minus, Loader2 
} from 'lucide-react';
import { usePermission } from '../../../../hooks/usePermission';
import { inventoryService } from '../../../../services/inventoryService';
import { companyService } from '../../../../services/companyService';
import { toast } from '../../../../utils/toast-manager';
import { formatCurrency, formatDate, formatNumber } from '../../../../utils/formatters';
import { PermissionResource } from '../../../../types/enums';

// ============================================
// TYPES
// ============================================

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  stock: number;
  price: number;
  reorderPoint: number;
  category?: string;
  categoryId?: string;
  location?: string;
  supplier?: string;
  supplierId?: string;
  status?: string;
  lastUpdated?: string;
  images?: string[];
  reserved?: number;
  quantity?: number;
  unitPrice?: number;
  barcode?: string | null;
  createdAt?: string;
  updatedAt?: string;
  costPrice?: number;
  taxRate?: number;
  unit?: string;
  minStock?: number;
  maxStock?: number;
  isActive?: boolean;
  productId?: string;
  variantId?: string;
  variantName?: string;
  businessUnitId?: string;
  businessUnit?: {
    id: string;
    name: string;
    code: string;
  };
}

interface InventoryStatsData {
  totalItems: number;
  totalValue: number;
  totalCost: number;
  lowStock: number;
  outOfStock: number;
  totalCategories: number;
  totalSuppliers: number;
  profitMargin?: number;
  potentialProfit?: number;
  totalUnits?: number;
  totalReserved?: number;
  availableUnits?: number;
  withBarcode?: number;
  withoutBarcode?: number;
  inStock?: number;
  inStockValue?: number;
  locations?: Array<{ location: string; count: number; value: number }>;
}

interface InventoryFilters {
  search: string;
  category: string;
  categoryId: string;
  location: string;
  status: string;
  lowStock: boolean;
  hasBarcode: 'all' | 'yes' | 'no';
  minPrice?: number;
  maxPrice?: number;
  supplier?: string;
  inStock?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  businessUnitId?: string;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface BusinessUnitOption {
  id: string;
  name: string;
  code: string;
  type?: string;
  isActive?: boolean;
  companyId?: string;
  companyName?: string;
}

// ============================================
// SUB-COMPONENTS
// ============================================

const InventoryStats: React.FC<{ stats: InventoryStatsData; loading?: boolean }> = ({ stats, loading }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-gray-200 dark:bg-gray-700 rounded-xl h-24"></div>
          </div>
        ))}
      </div>
    );
  }

  const statsCards = [
    { label: 'Total Items', value: stats.totalItems, icon: Package, color: 'blue' },
    { label: 'Total Value', value: formatCurrency(stats.totalValue || 0), icon: DollarSign, color: 'green' },
    { label: 'Total Cost', value: formatCurrency(stats.totalCost || 0), icon: TrendingDown, color: 'purple' },
    { label: 'Low Stock', value: stats.lowStock, icon: AlertTriangle, color: 'yellow' },
    { label: 'Out of Stock', value: stats.outOfStock, icon: AlertCircle, color: 'red' },
    { label: 'In Stock', value: stats.inStock ?? (stats.totalItems - stats.outOfStock), icon: CheckCircle, color: 'teal' },
  ];

  if (stats.withBarcode !== undefined || stats.withoutBarcode !== undefined) {
    statsCards.splice(3, 0, {
      label: 'With Barcode',
      value: stats.withBarcode || 0,
      icon: Barcode,
      color: 'indigo',
    });
  }

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
    teal: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400',
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {statsCards.map((card, index) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{card.label}</p>
              <div className={`p-1.5 rounded-lg ${colorClasses[card.color] || colorClasses.blue}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{card.value}</p>
          </motion.div>
        );
      })}
    </div>
  );
};

// ============================================
// BUSINESS UNIT SELECTOR COMPONENT
// ============================================

const BusinessUnitSelector: React.FC<{
  businessUnits: BusinessUnitOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  loading?: boolean;
}> = ({ businessUnits, selectedId, onSelect, loading }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selected = businessUnits.find(bu => bu.id === selectedId);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse">
        <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
        <div className="w-24 h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
      </div>
    );
  }

  if (businessUnits.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-yellow-700 dark:text-yellow-300 text-sm">
        <AlertTriangle className="w-4 h-4" />
        <span>No business units</span>
      </div>
    );
  }

  if (businessUnits.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
        <Building className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {businessUnits[0].name}
        </span>
        {businessUnits[0].code && (
          <span className="text-xs text-gray-400">({businessUnits[0].code})</span>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors min-w-[180px]"
      >
        <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1 text-left">
          {selected?.name || 'Select Business Unit'}
        </span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden"
          >
            <div className="p-2 max-h-80 overflow-y-auto">
              <p className="text-xs text-gray-500 dark:text-gray-400 px-3 py-1 border-b border-gray-100 dark:border-gray-700 mb-1 flex items-center gap-2">
                <Database className="w-3 h-3" />
                Switch Business Unit
              </p>
              {businessUnits.map((bu) => {
                const isSelected = selectedId === bu.id;
                const isActive = bu.isActive !== false;
                
                return (
                  <button
                    key={bu.id}
                    onClick={() => {
                      if (isActive) {
                        onSelect(bu.id);
                        setIsOpen(false);
                      }
                    }}
                    disabled={!isActive}
                    className={`
                      w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between
                      ${isSelected 
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }
                      ${!isActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{bu.name}</span>
                        {bu.code && (
                          <span className="text-xs text-gray-400 flex-shrink-0">({bu.code})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        {bu.type && <span>{bu.type}</span>}
                        {bu.companyName && (
                          <span className="text-indigo-500">• {bu.companyName}</span>
                        )}
                        {!isActive && (
                          <span className="text-red-500">• Inactive</span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================
// QUICK ACTIONS COMPONENT
// ============================================

const QuickActions: React.FC<{
  onAction: (action: string) => void;
  permissions: { canCreate: boolean; canTransfer: boolean; canAdjust: boolean; canExport: boolean };
  loading?: boolean;
}> = ({ onAction, permissions, loading }) => {
  const actions = [
    { id: 'add', label: 'Add Item', icon: Plus, visible: permissions.canCreate, color: 'blue' },
    { id: 'scan', label: 'Scan Barcode', icon: Scan, visible: true, color: 'purple' },
    { id: 'transfer', label: 'Transfer', icon: Truck, visible: permissions.canTransfer, color: 'orange' },
    { id: 'export', label: 'Export', icon: Download, visible: permissions.canExport, color: 'green' },
    { id: 'import', label: 'Import', icon: Upload, visible: permissions.canCreate, color: 'indigo' },
    { id: 'settings', label: 'Settings', icon: Settings, visible: permissions.canAdjust, color: 'gray' },
  ];

  const visibleActions = actions.filter(a => a.visible);

  if (visibleActions.length === 0) return null;

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-600 hover:bg-blue-700 text-white',
    purple: 'bg-purple-600 hover:bg-purple-700 text-white',
    orange: 'bg-orange-600 hover:bg-orange-700 text-white',
    green: 'bg-green-600 hover:bg-green-700 text-white',
    indigo: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    gray: 'bg-gray-600 hover:bg-gray-700 text-white',
  };

  return (
    <div className="flex flex-wrap gap-2">
      {visibleActions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            onClick={() => onAction(action.id)}
            disabled={loading}
            className={`px-3 sm:px-4 py-2 rounded-lg flex items-center gap-1 sm:gap-2 transition-colors text-sm ${colorClasses[action.color]} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{action.label}</span>
          </button>
        );
      })}
    </div>
  );
};

// ============================================
// INVENTORY FILTERS COMPONENT
// ============================================

const InventoryFilters: React.FC<{
  filters: InventoryFilters;
  onFilterChange: (key: string, value: any) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  categories?: Array<{ id: string; name: string }>;
  locations?: string[];
  loading?: boolean;
}> = ({ filters, onFilterChange, showFilters, onToggleFilters, categories = [], locations = [], loading }) => {
  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'low_stock', label: 'Low Stock' },
    { value: 'out_of_stock', label: 'Out of Stock' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'discontinued', label: 'Discontinued' },
  ];

  const barcodeOptions = [
    { value: 'all', label: 'All' },
    { value: 'yes', label: 'Has Barcode' },
    { value: 'no', label: 'No Barcode' },
  ];

  const sortOptions = [
    { value: 'name', label: 'Name' },
    { value: 'stock', label: 'Stock' },
    { value: 'price', label: 'Price' },
    { value: 'createdAt', label: 'Created Date' },
    { value: 'updatedAt', label: 'Last Updated' },
  ];

  const defaultLocations = ['Warehouse', 'Storefront', 'Backroom', 'Supplier', 'In Transit', 'Distribution Center'];

  const allLocations = locations.length > 0 ? locations : defaultLocations;
  const allCategories = categories.length > 0 ? categories : [];

  const activeFilterCount = [
    filters.category ? 1 : 0,
    filters.categoryId ? 1 : 0,
    filters.location ? 1 : 0,
    filters.status !== 'all' ? 1 : 0,
    filters.lowStock ? 1 : 0,
    filters.hasBarcode !== 'all' ? 1 : 0,
    filters.minPrice ? 1 : 0,
    filters.maxPrice ? 1 : 0,
    filters.supplier ? 1 : 0,
    filters.inStock !== undefined ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, SKU, or barcode..."
            value={filters.search}
            onChange={(e) => onFilterChange('search', e.target.value)}
            disabled={loading}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>

        <button
          onClick={onToggleFilters}
          disabled={loading}
          className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 ${
            showFilters
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
        </button>

        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
          <button
            onClick={() => onFilterChange('sortBy', 'name')}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              filters.sortBy === 'name' 
                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm' 
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            Name
          </button>
          <button
            onClick={() => onFilterChange('sortBy', 'stock')}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              filters.sortBy === 'stock' 
                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm' 
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            Stock
          </button>
          <button
            onClick={() => onFilterChange('sortBy', 'price')}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              filters.sortBy === 'price' 
                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm' 
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            Price
          </button>
        </div>

        {activeFilterCount > 0 && (
          <button
            onClick={() => {
              onFilterChange('category', '');
              onFilterChange('categoryId', '');
              onFilterChange('location', '');
              onFilterChange('status', 'all');
              onFilterChange('lowStock', false);
              onFilterChange('hasBarcode', 'all');
              onFilterChange('search', '');
              onFilterChange('minPrice', undefined);
              onFilterChange('maxPrice', undefined);
              onFilterChange('supplier', '');
              onFilterChange('inStock', undefined);
              onFilterChange('sortBy', 'name');
              onFilterChange('sortOrder', 'asc');
            }}
            disabled={loading}
            className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 flex items-center gap-1 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <select
                  value={filters.categoryId || filters.category}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (allCategories.some(c => c.id === value)) {
                      onFilterChange('categoryId', value);
                      onFilterChange('category', '');
                    } else {
                      onFilterChange('category', value);
                      onFilterChange('categoryId', '');
                    }
                  }}
                  disabled={loading}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
                    className="w-full mt-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Location
                </label>
                <select
                  value={filters.location}
                  onChange={(e) => onFilterChange('location', e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="">All Locations</option>
                  {allLocations.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => onFilterChange('status', e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Barcode
                </label>
                <select
                  value={filters.hasBarcode}
                  onChange={(e) => onFilterChange('hasBarcode', e.target.value as 'all' | 'yes' | 'no')}
                  disabled={loading}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {barcodeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Sort By
                  </label>
                  <select
                    value={filters.sortBy || 'name'}
                    onChange={(e) => onFilterChange('sortBy', e.target.value)}
                    disabled={loading}
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {sortOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.lowStock}
                      onChange={(e) => onFilterChange('lowStock', e.target.checked)}
                      disabled={loading}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50"
                    />
                    Low Stock Only
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.inStock}
                      onChange={(e) => onFilterChange('inStock', e.target.checked)}
                      disabled={loading}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50"
                    />
                    In Stock
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Min Price
                </label>
                <input
                  type="number"
                  value={filters.minPrice || ''}
                  onChange={(e) => onFilterChange('minPrice', e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="0.00"
                  disabled={loading}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Price
                </label>
                <input
                  type="number"
                  value={filters.maxPrice || ''}
                  onChange={(e) => onFilterChange('maxPrice', e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="0.00"
                  disabled={loading}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================
// INVENTORY TABLE COMPONENT
// ============================================

const InventoryTable: React.FC<{
  data: InventoryItem[];
  loading: boolean;
  viewMode: 'table' | 'grid' | 'compact';
  selectedItems: string[];
  onSelectItem: (id: string) => void;
  onSelectAll: () => void;
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
  onView: (item: InventoryItem) => void;
  onPrintBarcode: (item: InventoryItem) => void;
  pagination: PaginationData;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}> = ({
  data,
  loading,
  viewMode,
  selectedItems,
  onSelectItem,
  onSelectAll,
  onEdit,
  onDelete,
  onView,
  onPrintBarcode,
  pagination,
  onPageChange,
  onLimitChange,
}) => {
  const getStatusBadge = (item: InventoryItem) => {
    const stock = item.stock || item.quantity || 0;
    const reorderPoint = item.reorderPoint || item.minStock || 5;

    if (stock === 0) {
      return { label: 'Out of Stock', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
    }
    if (stock <= reorderPoint) {
      return { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' };
    }
    return { label: 'In Stock', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' };
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-500 dark:text-gray-400">Loading inventory...</span>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
        <Package className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No inventory items found</h3>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Try adjusting your filters or add a new item</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left w-10">
                <input
                  type="checkbox"
                  checked={selectedItems.length === data.length && data.length > 0}
                  onChange={onSelectAll}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Item</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">SKU</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">Barcode</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Price</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Stock</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.map((item) => {
              const status = getStatusBadge(item);
              const isSelected = selectedItems.includes(item.id);
              const stock = item.stock || item.quantity || 0;

              return (
                <tr
                  key={item.id}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${
                    isSelected ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                  }`}
                  onClick={() => onView(item)}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onSelectItem(item.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                        {item.images?.[0] ? (
                          <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
                        {item.variantName && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">{item.variantName}</span>
                        )}
                        {item.category && (
                          <span className="text-xs text-gray-400 dark:text-gray-500 block">{item.category}</span>
                        )}
                        {item.businessUnit && (
                          <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-0.5">
                            <Building className="w-3 h-3" />
                            {item.businessUnit.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono hidden md:table-cell">{item.sku}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {item.barcode ? (
                      <div className="flex items-center gap-1">
                        <Barcode className="w-4 h-4 text-green-500" />
                        <span className="text-xs font-mono text-gray-600 dark:text-gray-300">{item.barcode}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">No barcode</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                    {formatCurrency(item.price || item.unitPrice || 0)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-medium ${
                      stock === 0 ? 'text-red-600' :
                      stock <= (item.reorderPoint || item.minStock || 5) ? 'text-yellow-600' :
                      'text-green-600'
                    }`}>
                      {stock}
                      {item.reserved !== undefined && item.reserved > 0 && (
                        <span className="text-xs text-gray-400 ml-1">({item.reserved} reserved)</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {item.barcode && (
                        <button
                          onClick={() => onPrintBarcode(item)}
                          className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                          title="Print Barcode"
                        >
                          <Printer className="w-4 h-4 text-green-500" />
                        </button>
                      )}
                      <button
                        onClick={() => onView(item)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => onEdit(item)}
                        className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4 text-blue-500" />
                      </button>
                      <button
                        onClick={() => onDelete(item.id)}
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </span>
            <select
              value={pagination.limit}
              onChange={(e) => onLimitChange(parseInt(e.target.value))}
              className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// RECENT ACTIVITY COMPONENT
// ============================================

const RecentActivity: React.FC<{ businessUnitId?: string }> = ({ businessUnitId }) => {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadActivities = async () => {
      if (!businessUnitId) {
        setLoading(false);
        return;
      }
      
      try {
        const transactions = await inventoryService.getInventoryTransactions({
          businessUnitId,
          limit: 5,
        });
        setActivities(transactions?.data || []);
      } catch (error) {
        console.error('Failed to load recent activity:', error);
      } finally {
        setLoading(false);
      }
    };
    loadActivities();
  }, [businessUnitId]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          Recent Activity
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
        <Clock className="w-4 h-4 text-gray-400" />
        Recent Activity
      </h3>
      <div className="space-y-3 max-h-[300px] overflow-y-auto">
        {activities.map((activity: any, index) => (
          <div key={index} className="flex items-start gap-3 text-sm">
            <div className={`p-1.5 rounded-full ${
              activity.quantity && activity.quantity > 0 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
            }`}>
              {activity.quantity && activity.quantity > 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-700 dark:text-gray-300">
                <span className="font-medium">{activity.product?.name || 'Unknown'}</span>
                <span className={`ml-1 ${activity.quantity && activity.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {activity.quantity && activity.quantity > 0 ? '+' : ''}{activity.quantity || 0}
                </span>
              </p>
              <p className="text-xs text-gray-400">
                {formatDate(activity.createdAt || activity.timestamp)} • {activity.transactionType || 'Adjustment'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// INVENTORY CHARTS COMPONENT
// ============================================

const InventoryCharts: React.FC<{ data: InventoryItem[]; stats: InventoryStatsData }> = ({ data, stats }) => {
  const categoryMap = new Map<string, number>();
  data.forEach(item => {
    const cat = item.category || 'Uncategorized';
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + (item.stock || item.quantity || 0));
  });

  const categories = Array.from(categoryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const total = data.reduce((sum, item) => sum + (item.stock || item.quantity || 0), 0) || 1;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
        <PieChart className="w-4 h-4 text-gray-400" />
        Stock by Category
      </h3>
      {categories.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No category data</p>
      ) : (
        <div className="space-y-2">
          {categories.map(([name, count]) => {
            const percentage = (count / total) * 100;
            return (
              <div key={name}>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400 truncate flex-1 mr-2">{name}</span>
                  <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">{count} units</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-0.5">
                  <div
                    className="bg-blue-500 rounded-full h-1.5 transition-all duration-500"
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex justify-between">
        <span>Total: {total} units</span>
        <span>{data.length} items</span>
      </div>
    </div>
  );
};

// ============================================
// ADJUSTMENT MODAL COMPONENT
// ============================================

interface AdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { quantity: number; type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT'; notes: string }) => void;
  currentStock: number;
  reserved: number;
  reorderPoint: number;
  itemName: string;
  loading: boolean;
  quantity?: number;
  type?: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
  notes?: string;
}

const AdjustmentModal: React.FC<AdjustmentModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  currentStock,
  reserved,
  reorderPoint,
  itemName,
  loading,
  quantity = 0,
  type = 'ADJUSTMENT_IN',
  notes = '',
}) => {
  const [localQuantity, setLocalQuantity] = useState(quantity);
  const [localType, setLocalType] = useState<'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT'>(type);
  const [localNotes, setLocalNotes] = useState(notes);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableStock = currentStock - reserved;
  const isLowStock = currentStock <= reorderPoint && currentStock > 0;
  const isOutOfStock = currentStock === 0;

  const handleConfirm = () => {
    if (localQuantity <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }
    if (localType === 'ADJUSTMENT_OUT' && localQuantity > currentStock) {
      toast.error('Cannot remove more than current stock');
      return;
    }
    setIsSubmitting(true);
    onConfirm({
      quantity: localQuantity,
      type: localType,
      notes: localNotes,
    });
    setTimeout(() => setIsSubmitting(false), 500);
  };

  const handleClose = () => {
    setLocalQuantity(0);
    setLocalType('ADJUSTMENT_IN');
    setLocalNotes('');
    onClose();
  };

  const newStock = localType === 'ADJUSTMENT_IN' 
    ? currentStock + localQuantity 
    : currentStock - localQuantity;

  const isNewStockLow = newStock <= reorderPoint && newStock > 0;
  const isNewStockOut = newStock === 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm dark:bg-black/70" 
        onClick={handleClose}
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 m-4 border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto"
      >
        <button 
          onClick={handleClose} 
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            <Plus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Adjust Stock</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[200px] sm:max-w-[300px]">
              {itemName}
            </p>
          </div>
        </div>

        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-300">Current Stock</span>
              <p className="font-semibold text-gray-900 dark:text-white">{currentStock} units</p>
            </div>
            {reserved > 0 && (
              <div>
                <span className="text-gray-600 dark:text-gray-300">Reserved</span>
                <p className="font-semibold text-yellow-600 dark:text-yellow-400">{reserved} units</p>
              </div>
            )}
            <div>
              <span className="text-gray-600 dark:text-gray-300">Available</span>
              <p className={`font-semibold ${
                availableStock === 0 ? 'text-red-600 dark:text-red-400' : 
                isLowStock ? 'text-yellow-600 dark:text-yellow-400' : 
                'text-green-600 dark:text-green-400'
              }`}>
                {availableStock} units
              </p>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-300">Reorder Point</span>
              <p className="font-semibold text-gray-700 dark:text-gray-300">{reorderPoint} units</p>
            </div>
          </div>
          {(isLowStock || isOutOfStock) && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
              <p className={`text-sm flex items-center gap-1 ${
                isOutOfStock ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'
              }`}>
                {isOutOfStock ? (
                  <AlertCircle className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                {isOutOfStock ? 'Out of stock!' : 'Low stock alert!'}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Adjustment Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLocalType('ADJUSTMENT_IN')}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  localType === 'ADJUSTMENT_IN'
                    ? 'bg-green-600 text-white shadow-md ring-2 ring-green-500 ring-offset-2 dark:ring-offset-gray-800'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                disabled={loading || isSubmitting}
              >
                <div className="flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add Stock
                </div>
              </button>
              <button
                type="button"
                onClick={() => setLocalType('ADJUSTMENT_OUT')}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  localType === 'ADJUSTMENT_OUT'
                    ? 'bg-red-600 text-white shadow-md ring-2 ring-red-500 ring-offset-2 dark:ring-offset-gray-800'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                disabled={loading || isSubmitting}
              >
                <div className="flex items-center justify-center gap-2">
                  <Minus className="w-4 h-4" />
                  Remove Stock
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Quantity <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={localQuantity}
                onChange={(e) => setLocalQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                min="0"
                step="1"
                className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                placeholder="Enter quantity"
                disabled={loading || isSubmitting}
                autoFocus
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500">
                units
              </div>
            </div>
            
            {localType === 'ADJUSTMENT_OUT' && localQuantity > currentStock && (
              <p className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                Cannot remove more than current stock ({currentStock} units)
              </p>
            )}
            
            {localQuantity > 0 && (
              <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">New stock:</span>
                  <span className={`font-semibold ${
                    isNewStockOut ? 'text-red-600 dark:text-red-400' :
                    isNewStockLow ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-green-600 dark:text-green-400'
                  }`}>
                    {newStock} units
                  </span>
                </div>
                {isNewStockLow && !isNewStockOut && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Below reorder point ({reorderPoint} units)
                  </p>
                )}
                {isNewStockOut && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Will be out of stock
                  </p>
                )}
                {!isNewStockLow && !isNewStockOut && localType === 'ADJUSTMENT_IN' && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Stock level healthy
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Notes <span className="text-gray-400 dark:text-gray-500 text-xs font-normal">(optional)</span>
            </label>
            <textarea
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors resize-none"
              placeholder="Reason for adjustment (e.g., Restock, Damaged, Return, etc.)"
              disabled={loading || isSubmitting}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClose}
            className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 text-sm font-medium w-full sm:w-auto"
            disabled={loading || isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={
              loading || 
              isSubmitting || 
              localQuantity <= 0 || 
              (localType === 'ADJUSTMENT_OUT' && localQuantity > currentStock)
            }
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 w-full sm:w-auto ${
              localType === 'ADJUSTMENT_IN'
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                {localType === 'ADJUSTMENT_IN' ? 'Add Stock' : 'Remove Stock'}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function InventoryDashboardPage() {
  const router = useRouter();
  const { 
    canView, 
    canCreate, 
    canEdit, 
    canDelete, 
    canManage,
    user,
    isLoading: permissionsLoading
  } = usePermission();
  
  // Refs to prevent infinite loops
  const initialLoadDoneRef = useRef(false);
  const loadDataRef = useRef(false);
  const businessUnitsLoadedRef = useRef(false);
  
  // Permission checks
  const canViewInventory = canView(PermissionResource.INVENTORY) || canManage(PermissionResource.INVENTORY);
  const canCreateInventory = canCreate(PermissionResource.INVENTORY) || canManage(PermissionResource.INVENTORY);
  const canEditInventory = canEdit(PermissionResource.INVENTORY) || canManage(PermissionResource.INVENTORY);
  const canDeleteInventory = canDelete(PermissionResource.INVENTORY) || canManage(PermissionResource.INVENTORY);
  const canTransferInventory = canManage(PermissionResource.INVENTORY);
  const canAdjustInventory = canManage(PermissionResource.INVENTORY);
  const canExportInventory = canManage(PermissionResource.INVENTORY);

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<InventoryItem[]>([]);
  const [stats, setStats] = useState<InventoryStatsData>({
    totalItems: 0,
    totalValue: 0,
    totalCost: 0,
    lowStock: 0,
    outOfStock: 0,
    totalCategories: 0,
    totalSuppliers: 0,
    withBarcode: 0,
    withoutBarcode: 0,
  });
  const [filters, setFilters] = useState<InventoryFilters>({
    search: '',
    category: '',
    categoryId: '',
    location: '',
    status: 'all',
    lowStock: false,
    hasBarcode: 'all',
    sortBy: 'name',
    sortOrder: 'asc',
    businessUnitId: '',
  });
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [viewMode] = useState<'table' | 'grid' | 'compact'>('table');
  const [showFilters, setShowFilters] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  
  // Business Unit State
  const [businessUnits, setBusinessUnits] = useState<BusinessUnitOption[]>([]);
  const [loadingBusinessUnits, setLoadingBusinessUnits] = useState(true);
  const [selectedBusinessUnitId, setSelectedBusinessUnitId] = useState<string>('');
  const [businessUnitError, setBusinessUnitError] = useState<string | null>(null);

  // Adjustment Modal State
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [adjustmentData, setAdjustmentData] = useState<{
    quantity: number;
    type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
    notes: string;
  }>({
    quantity: 0,
    type: 'ADJUSTMENT_IN',
    notes: '',
  });
  const [adjustingLoading, setAdjustingLoading] = useState(false);

  // ============================================
  // NORMALIZE INVENTORY DATA
  // ============================================

  const normalizeInventoryItem = useCallback((item: any): InventoryItem => {
    return {
      id: item.id || '',
      name: item.name || item.product?.name || 'Unknown',
      sku: item.sku || item.product?.sku || 'N/A',
      stock: item.quantity || item.stock || 0,
      price: item.unitPrice || item.price || item.product?.unitPrice || 0,
      reorderPoint: item.reorderPoint || item.minStock || 5,
      category: item.category || item.product?.category?.name || undefined,
      categoryId: item.categoryId || item.product?.categoryId || undefined,
      location: item.location || 'Warehouse',
      supplier: item.supplier || undefined,
      supplierId: item.supplierId || undefined,
      status: item.status || 'ACTIVE',
      lastUpdated: item.updatedAt || new Date().toISOString(),
      images: item.images || item.product?.images || [],
      reserved: item.reserved || 0,
      quantity: item.quantity || item.stock || 0,
      unitPrice: item.unitPrice || item.price || item.product?.unitPrice || 0,
      barcode: item.barcode || item.product?.barcode || null,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString(),
      costPrice: item.costPrice || item.product?.costPrice || undefined,
      taxRate: item.taxRate || item.product?.taxRate || undefined,
      unit: item.unit || 'each',
      minStock: item.minStock || item.reorderPoint || 5,
      maxStock: item.maxStock || undefined,
      isActive: item.isActive !== undefined ? item.isActive : true,
      productId: item.productId || undefined,
      variantId: item.variantId || undefined,
      variantName: item.variantName || item.variant?.name || undefined,
      businessUnitId: item.businessUnitId || undefined,
      businessUnit: item.businessUnit || undefined,
    };
  }, []);

  // ============================================
  // FETCH BUSINESS UNITS
  // ============================================

  const fetchBusinessUnits = useCallback(async () => {
    if (businessUnitsLoadedRef.current) {
      console.log('⏭️ Business units already loaded');
      return;
    }
    
    setLoadingBusinessUnits(true);
    setBusinessUnitError(null);
    
    try {
      console.log('📤 Fetching business units...');
      
      let units: BusinessUnitOption[] = [];
      
      // Try to get from localStorage first
      try {
        const stored = localStorage.getItem('businessUnits');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            units = parsed.filter((bu: any) => {
              const id = bu.id || bu.businessUnitId;
              return id && id !== 'default' && id !== 'default-business-unit';
            }).map((bu: any) => ({
              id: bu.id || bu.businessUnitId,
              name: bu.name || bu.businessUnit?.name || 'Unnamed',
              code: bu.code || bu.businessUnit?.code || '',
              type: bu.type || bu.businessUnit?.type || '',
              isActive: bu.isActive !== false,
              companyName: bu.companyName || bu.businessUnit?.company?.name || undefined,
            }));
            console.log(`✅ Found ${units.length} business units from localStorage`);
          }
        }
      } catch (storageError) {
        console.warn('Failed to parse from localStorage:', storageError);
      }
      
      // If no localStorage, try from user context
      if (units.length === 0) {
        try {
          const userAny = user as any;
          if (userAny?.businessUnits && Array.isArray(userAny.businessUnits)) {
            const mappedUnits = userAny.businessUnits
              .map((bu: any) => {
                const id = bu.businessUnitId || bu.id;
                if (!id || id === 'default' || id === 'default-business-unit') {
                  return null;
                }
                return {
                  id: id,
                  name: bu.businessUnit?.name || bu.name || 'Unnamed',
                  code: bu.businessUnit?.code || bu.code || '',
                  type: bu.businessUnit?.type || bu.type || '',
                  isActive: bu.businessUnit?.isActive !== undefined ? bu.businessUnit.isActive : true,
                  companyName: bu.businessUnit?.company?.name || bu.companyName || undefined,
                };
              })
              .filter((bu: BusinessUnitOption | null): bu is BusinessUnitOption => bu !== null);
            
            units = mappedUnits;
            console.log(`✅ Found ${units.length} business units from user context`);
          }
        } catch (userError) {
          console.warn('Failed to fetch from user context:', userError);
        }
      }
      
      // Fallback to saved ID
      if (units.length === 0) {
        const savedId = localStorage.getItem('selectedBusinessUnitId') || localStorage.getItem('businessUnitId');
        if (savedId && savedId !== 'default' && savedId !== 'default-business-unit') {
          units.push({
            id: savedId,
            name: 'Default Business Unit',
            code: 'DEFAULT',
            type: 'STORE',
            isActive: true,
          });
          console.log(`✅ Using fallback business unit from localStorage: ${savedId}`);
        }
      }
      
      // Remove duplicates
      const uniqueUnits = units.filter((unit, index, self) => 
        index === self.findIndex((u) => u.id === unit.id)
      );
      
      setBusinessUnits(uniqueUnits);
      
      // Auto-select business unit
      if (uniqueUnits.length > 0) {
        const savedId = localStorage.getItem('selectedBusinessUnitId') || localStorage.getItem('businessUnitId');
        if (savedId) {
          const saved = uniqueUnits.find(bu => bu.id === savedId && bu.isActive !== false);
          if (saved) {
            setSelectedBusinessUnitId(saved.id);
            setFilters(prev => ({ ...prev, businessUnitId: saved.id }));
            console.log(`✅ Restored selected business unit: ${saved.name}`);
            businessUnitsLoadedRef.current = true;
            setLoadingBusinessUnits(false);
            return;
          }
        }
        const active = uniqueUnits.find(bu => bu.isActive !== false);
        if (active) {
          setSelectedBusinessUnitId(active.id);
          setFilters(prev => ({ ...prev, businessUnitId: active.id }));
          localStorage.setItem('selectedBusinessUnitId', active.id);
          localStorage.setItem('businessUnitId', active.id);
          console.log(`✅ Auto-selected business unit: ${active.name}`);
        }
      } else {
        setBusinessUnitError('No business units available.');
        toast.warning('No business units available');
      }
      
      businessUnitsLoadedRef.current = true;
      
    } catch (error) {
      console.error('Error fetching business units:', error);
      setBusinessUnitError('Failed to load business units.');
      toast.error('Failed to load business units');
    } finally {
      setLoadingBusinessUnits(false);
    }
  }, [user]);

  // ============================================
  // LOAD INVENTORY DATA - FIXED
  // ============================================

  const loadInventoryData = useCallback(async (showLoading = true) => {
    if (loadDataRef.current) {
      console.log('⏭️ Skipping load - already loading');
      return;
    }
    
    if (!canViewInventory) {
      setLoading(false);
      return;
    }
    
    // Use selected business unit ID or fallback
    const effectiveBusinessUnitId = selectedBusinessUnitId || businessUnits[0]?.id;
    
    if (!effectiveBusinessUnitId) {
      console.warn('No business unit ID available, skipping inventory load');
      setLoading(false);
      setInventory([]);
      setFilteredInventory([]);
      return;
    }
    
    loadDataRef.current = true;
    
    try {
      if (showLoading) setLoading(true);
      
      console.log(`📤 Fetching inventory for business unit: ${effectiveBusinessUnitId}`);
      
      // Use getAllInventory with businessUnitId
      const allInventory = await inventoryService.getAllInventory(effectiveBusinessUnitId);
      console.log('📥 getAllInventory response:', allInventory);
      
      let data: any[] = [];
      
      if (allInventory && allInventory.items && Array.isArray(allInventory.items)) {
        data = allInventory.items;
        console.log(`✅ Loaded ${data.length} inventory items from getAllInventory`);
      } else if (Array.isArray(allInventory)) {
        data = allInventory;
        console.log(`✅ Loaded ${data.length} inventory items from getAllInventory (array)`);
      }
      
      if (data.length > 0) {
        // Add business unit info to each item
        const normalizedData = data.map((item: any) => {
          const normalized = normalizeInventoryItem(item);
          const bu = businessUnits.find(b => b.id === effectiveBusinessUnitId);
          if (bu) {
            normalized.businessUnit = {
              id: bu.id,
              name: bu.name,
              code: bu.code,
            };
          }
          return normalized;
        });
        
        setInventory(normalizedData);
        setFilteredInventory(normalizedData);
        setPagination(prev => ({ 
          ...prev, 
          total: normalizedData.length, 
          totalPages: Math.ceil(normalizedData.length / prev.limit) || 1 
        }));
        
        // Calculate stats from data
        const withBarcode = normalizedData.filter((item: InventoryItem) => item.barcode).length;
        const withoutBarcode = normalizedData.length - withBarcode;
        const inStock = normalizedData.filter((item: InventoryItem) => (item.stock || 0) > 0).length;
        const lowStockCount = normalizedData.filter((item: InventoryItem) => 
          (item.stock || 0) <= (item.reorderPoint || item.minStock || 5) && (item.stock || 0) > 0
        ).length;
        const outOfStockCount = normalizedData.filter((item: InventoryItem) => 
          (item.stock || 0) === 0
        ).length;
        const totalValue = normalizedData.reduce((sum: number, item: InventoryItem) => 
          sum + (item.stock || 0) * (item.price || 0), 0
        );
        const totalCost = normalizedData.reduce((sum: number, item: InventoryItem) => 
          sum + (item.stock || 0) * (item.costPrice || 0), 0
        );
        
        setStats({
          totalItems: normalizedData.length,
          totalValue: totalValue,
          totalCost: totalCost,
          lowStock: lowStockCount,
          outOfStock: outOfStockCount,
          totalCategories: 0,
          totalSuppliers: 0,
          profitMargin: totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0,
          withBarcode,
          withoutBarcode,
          inStock,
        });
        
        setLastUpdated(new Date());
        
        // Load categories for filter
        try {
          const categoriesData = await inventoryService.getCategories(effectiveBusinessUnitId);
          if (categoriesData && Array.isArray(categoriesData) && categoriesData.length > 0) {
            setCategories(categoriesData.map((cat: any) => ({
              id: cat.id,
              name: cat.name,
            })));
          }
        } catch (error) {
          console.warn('Failed to load categories for filter:', error);
        }
      } else {
        setInventory([]);
        setFilteredInventory([]);
        setStats({
          totalItems: 0,
          totalValue: 0,
          totalCost: 0,
          lowStock: 0,
          outOfStock: 0,
          totalCategories: 0,
          totalSuppliers: 0,
          withBarcode: 0,
          withoutBarcode: 0,
        });
      }
      
      initialLoadDoneRef.current = true;
      
    } catch (error) {
      console.error('Failed to load inventory:', error);
      toast.error('Failed to load inventory data');
      setInventory([]);
      setFilteredInventory([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      loadDataRef.current = false;
    }
  }, [canViewInventory, selectedBusinessUnitId, businessUnits, normalizeInventoryItem]);

  // ============================================
  // EFFECTS - FIXED
  // ============================================

  // Fetch business units on mount
  useEffect(() => {
    if (!permissionsLoading && user && !businessUnitsLoadedRef.current) {
      fetchBusinessUnits();
    }
  }, [permissionsLoading, user, fetchBusinessUnits]);

  // Load data when business unit is selected and business units are loaded
  useEffect(() => {
    if (
      businessUnitsLoadedRef.current &&
      selectedBusinessUnitId &&
      selectedBusinessUnitId !== 'default' &&
      !loadDataRef.current &&
      !initialLoadDoneRef.current
    ) {
      loadInventoryData();
    }
  }, [selectedBusinessUnitId, businessUnitsLoadedRef, loadInventoryData]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleBusinessUnitSelect = (id: string) => {
    setSelectedBusinessUnitId(id);
    setFilters(prev => ({ ...prev, businessUnitId: id }));
    localStorage.setItem('selectedBusinessUnitId', id);
    localStorage.setItem('businessUnitId', id);
    setPagination(prev => ({ ...prev, page: 1 }));
    // Reset load state to force reload
    initialLoadDoneRef.current = false;
    loadDataRef.current = false;
    const bu = businessUnits.find(b => b.id === id);
    toast.success(`Switched to ${bu?.name || 'Business Unit'}`);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    initialLoadDoneRef.current = false;
    loadDataRef.current = false;
    await loadInventoryData(false);
    toast.success('Inventory refreshed');
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleSelectAll = () => {
    if (selectedItems.length === filteredInventory.length && filteredInventory.length > 0) {
      setSelectedItems([]);
      setShowBulkActions(false);
    } else {
      setSelectedItems(filteredInventory.map(item => item.id));
      setShowBulkActions(true);
    }
  };

  const handleSelectItem = (id: string) => {
    setSelectedItems(prev => {
      const newSelection = prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id];
      setShowBulkActions(newSelection.length > 0);
      return newSelection;
    });
  };

  const handleBulkDelete = async () => {
    if (!canDeleteInventory) {
      toast.error('You do not have permission to delete inventory items');
      return;
    }
    if (!confirm(`Are you sure you want to delete ${selectedItems.length} items?`)) return;
    
    try {
      let successCount = 0;
      for (const id of selectedItems) {
        try {
          await inventoryService.deleteInventoryItem(id);
          successCount++;
        } catch (e) {
          console.error(`Failed to delete item ${id}:`, e);
        }
      }
      toast.success(`${successCount} of ${selectedItems.length} items deleted successfully`);
      setSelectedItems([]);
      setShowBulkActions(false);
      initialLoadDoneRef.current = false;
      await loadInventoryData(false);
    } catch (error) {
      console.error('Failed to delete items:', error);
      toast.error('Failed to delete items');
    }
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'add':
        router.push('/admin/inventory/add');
        break;
      case 'scan':
        router.push('/admin/inventory/scan');
        break;
      case 'transfer':
        router.push('/admin/inventory/transfer');
        break;
      case 'export':
        router.push('/admin/inventory/export');
        break;
      case 'import':
        router.push('/admin/inventory/import');
        break;
      case 'settings':
        router.push('/admin/inventory/settings');
        break;
      default:
        break;
    }
  };

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
  };

  const handleLimitChange = (limit: number) => {
    setPagination(prev => ({ ...prev, limit, page: 1 }));
  };

  const handleViewItem = (item: InventoryItem) => {
    router.push(`/admin/inventory/${item.id}`);
  };

  const handleEditItem = (item: InventoryItem) => {
    router.push(`/admin/inventory/${item.id}/edit`);
  };

  const handleDeleteItem = async (id: string) => {
    if (!canDeleteInventory) {
      toast.error('You do not have permission to delete inventory items');
      return;
    }
    if (confirm('Are you sure you want to delete this item?')) {
      try {
        await inventoryService.deleteInventoryItem(id);
        toast.success('Item deleted successfully');
        initialLoadDoneRef.current = false;
        await loadInventoryData(false);
      } catch (error) {
        console.error('Failed to delete item:', error);
        toast.error('Failed to delete item');
      }
    }
  };

  const handlePrintBarcode = (item: InventoryItem) => {
    router.push(`/admin/inventory/${item.id}/barcode`);
  };

  // ============================================
  // ADJUSTMENT MODAL HANDLERS
  // ============================================

  const openAdjustmentModal = (item: InventoryItem) => {
    setAdjustingItem(item);
    setAdjustmentData({
      quantity: 0,
      type: 'ADJUSTMENT_IN',
      notes: '',
    });
    setShowAdjustmentModal(true);
  };

  const closeAdjustmentModal = () => {
    setShowAdjustmentModal(false);
    setAdjustingItem(null);
    setAdjustmentData({
      quantity: 0,
      type: 'ADJUSTMENT_IN',
      notes: '',
    });
  };

  const handleAdjustmentConfirm = async (data: { quantity: number; type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT'; notes: string }) => {
    if (!adjustingItem) return;
    
    setAdjustingLoading(true);
    try {
      await inventoryService.updateStock(adjustingItem.id, {
        quantity: data.quantity,
        transactionType: data.type,
        notes: data.notes,
      });
      
      toast.success(`Stock ${data.type === 'ADJUSTMENT_IN' ? 'added' : 'removed'} successfully`);
      closeAdjustmentModal();
      initialLoadDoneRef.current = false;
      await loadInventoryData(false);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to adjust stock');
    } finally {
      setAdjustingLoading(false);
    }
  };

  // ============================================
  // PERMISSION GUARD
  // ============================================

  if (!canViewInventory && !permissionsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
            You don't have permission to view inventory. Please contact your administrator.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  const selectedBU = businessUnits.find(bu => bu.id === selectedBusinessUnitId);

  if (loading && !refreshing && inventory.length === 0 && !initialLoadDoneRef.current) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Package className="w-7 h-7 sm:w-8 sm:h-8 text-blue-500" />
            Inventory Management
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
              {stats.totalItems} items • {formatCurrency(stats.totalValue || 0)} total value
            </p>
            {stats.withBarcode !== undefined && (
              <span className="text-xs text-gray-400">
                {stats.withBarcode} with barcode • {stats.withoutBarcode} without
              </span>
            )}
            {lastUpdated && (
              <span className="text-xs text-gray-400">
                Updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            {selectedBU && (
              <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Building className="w-3 h-3" />
                {selectedBU.name}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Business Unit Selector */}
          <BusinessUnitSelector
            businessUnits={businessUnits}
            selectedId={selectedBusinessUnitId}
            onSelect={handleBusinessUnitSelect}
            loading={loadingBusinessUnits}
          />
          
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          
          {canCreateInventory && (
            <button
              onClick={() => router.push('/admin/inventory/add')}
              className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1 sm:gap-2 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Item</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <InventoryStats stats={stats} loading={loading} />

      {/* Quick Actions */}
      <QuickActions onAction={handleQuickAction} permissions={{
        canCreate: canCreateInventory,
        canTransfer: canTransferInventory,
        canAdjust: canAdjustInventory,
        canExport: canExportInventory,
      }} loading={loading} />

      {/* Filters */}
      <InventoryFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        categories={categories}
        loading={loading}
      />

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {showBulkActions && selectedItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3"
          >
            <span className="text-sm text-blue-700 dark:text-blue-300">
              {selectedItems.length} item{selectedItems.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {canDeleteInventory && (
                <button
                  onClick={handleBulkDelete}
                  className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
              <button
                onClick={() => {
                  setSelectedItems([]);
                  setShowBulkActions(false);
                }}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN CONTENT */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3">
          <InventoryTable
            data={filteredInventory}
            loading={loading}
            viewMode={viewMode}
            selectedItems={selectedItems}
            onSelectItem={handleSelectItem}
            onSelectAll={handleSelectAll}
            onEdit={handleEditItem}
            onDelete={handleDeleteItem}
            onView={handleViewItem}
            onPrintBarcode={handlePrintBarcode}
            pagination={pagination}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
          />
        </div>

        <div className="space-y-6">
          <InventoryCharts data={inventory} stats={stats} />
          <RecentActivity businessUnitId={selectedBusinessUnitId} />
        </div>
      </div>

      {/* Adjustment Modal */}
      <AdjustmentModal
        isOpen={showAdjustmentModal}
        onClose={closeAdjustmentModal}
        onConfirm={handleAdjustmentConfirm}
        currentStock={adjustingItem?.stock || adjustingItem?.quantity || 0}
        reserved={adjustingItem?.reserved || 0}
        reorderPoint={adjustingItem?.reorderPoint || adjustingItem?.minStock || 5}
        itemName={adjustingItem?.name || 'Item'}
        loading={adjustingLoading}
        quantity={adjustmentData.quantity}
        type={adjustmentData.type}
        notes={adjustmentData.notes}
      />
    </div>
  );
}
