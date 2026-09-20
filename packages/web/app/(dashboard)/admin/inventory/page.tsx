// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\inventory\page.tsx

'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, TrendingUp, TrendingDown, AlertTriangle,
  DollarSign, Clock, RefreshCw, Plus, Search,
  Filter, Download, Eye, Edit, Trash2, Truck,
  Upload, Settings, PieChart,
  Tag, ChevronDown, X,
  CheckCircle, AlertCircle, Lock,
  Barcode, Scan, Printer, RefreshCcw,
  Building2, ChevronUp, Database, Minus, Loader2,
  Star, Globe, Building,
} from 'lucide-react';
import { useAuth } from '../../../../hooks/useAuth';
import { usePermission } from '../../../../hooks/usePermission';
import { inventoryService } from '../../../../services/inventoryService';
import { toast } from '../../../../utils/toast-manager';
import { formatCurrency, formatDate } from '../../../../utils/formatters';

// ============================================
// IMAGE HELPER
// ============================================
//
// `Product.images` is now `ProductImage[]` on the backend. The
// service flattens to `string[]`, but a raw payload (from
// productService or a mixed response) can still arrive with the
// un-flattened shape. Guard every read with this.

function toImageUrls(input: unknown): string[] {
  if (!input) return [];
  if (typeof input === 'string') return [input];
  if (!Array.isArray(input)) return [];
  return input
    .map((v) => {
      if (typeof v === 'string') return v;
      if (v && typeof v === 'object' && typeof (v as any).url === 'string') {
        return (v as any).url as string;
      }
      return null;
    })
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
}

// ============================================
// TYPES
// ============================================

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  stock: number;
  quantity?: number;
  price: number;
  unitPrice?: number;
  reorderPoint: number;
  minStock?: number;
  maxStock?: number;
  category?: string;
  categoryId?: string;
  location?: string;
  supplier?: string;
  supplierId?: string;
  status?: string;
  lastUpdated?: string;
  images?: string[];
  reserved?: number;
  barcode?: string | null;
  createdAt?: string;
  updatedAt?: string;
  costPrice?: number;
  taxRate?: number;
  unit?: string;
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
  description?: string | null;
  weight?: number;
  tags?: string[];
  isDigital?: boolean;
  featured?: boolean;
  expiryDate?: string | null;
  batchNumber?: string | null;
  available?: number;
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
  categories?: Array<{ category: string; count: number; value: number }>;
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
  hasImages?: 'all' | 'yes' | 'no';
  isDigital?: 'all' | 'yes' | 'no';
  featured?: 'all' | 'yes' | 'no';
  isActive?: 'all' | 'yes' | 'no';
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
// CONSTANTS / HELPERS
// ============================================

const SENTINEL_BUSINESS_UNIT_IDS = new Set([
  'default',
  'default-business-unit',
  'undefined',
  'null',
  '',
]);

function isValidBusinessUnitId(id: string | null | undefined): id is string {
  if (!id) return false;
  return !SENTINEL_BUSINESS_UNIT_IDS.has(id);
}

// ============================================
// SUB-COMPONENTS
// ============================================

const StatsCards: React.FC<{
  stats: InventoryStatsData;
  loading?: boolean;
}> = ({ stats, loading }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-gray-200 dark:bg-gray-700 rounded-xl h-24" />
          </div>
        ))}
      </div>
    );
  }

  const cards: Array<{
    label: string;
    value: string | number;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }> = [
    { label: 'Total Items', value: stats.totalItems, icon: Package, color: 'blue' },
    { label: 'Total Value', value: formatCurrency(stats.totalValue || 0), icon: DollarSign, color: 'green' },
    { label: 'Total Cost', value: formatCurrency(stats.totalCost || 0), icon: TrendingDown, color: 'purple' },
    { label: 'Low Stock', value: stats.lowStock, icon: AlertTriangle, color: 'yellow' },
    { label: 'Out of Stock', value: stats.outOfStock, icon: AlertCircle, color: 'red' },
    {
      label: 'In Stock',
      value: stats.inStock ?? stats.totalItems - stats.outOfStock,
      icon: CheckCircle,
      color: 'teal',
    },
  ];

  if (stats.withBarcode !== undefined || stats.withoutBarcode !== undefined) {
    cards.splice(3, 0, {
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
      {cards.map((card, index) => {
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
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {card.label}
              </p>
              <div
                className={`p-1.5 rounded-lg ${
                  colorClasses[card.color] || colorClasses.blue
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
              {card.value}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
};

const BusinessUnitSelector: React.FC<{
  businessUnits: BusinessUnitOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  loading?: boolean;
}> = ({ businessUnits, selectedId, onSelect, loading }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selected = businessUnits.find((bu) => bu.id === selectedId);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse">
        <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded" />
        <div className="w-24 h-4 bg-gray-300 dark:bg-gray-600 rounded" />
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
          <span className="text-xs text-gray-400">
            ({businessUnits[0].code})
          </span>
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
                      ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }
                      ${
                        !isActive
                          ? 'opacity-50 cursor-not-allowed'
                          : 'cursor-pointer'
                      }
                    `}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{bu.name}</span>
                        {bu.code && (
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            ({bu.code})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        {bu.type && <span>{bu.type}</span>}
                        {bu.companyName && (
                          <span className="text-indigo-500">
                            • {bu.companyName}
                          </span>
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

const QuickActions: React.FC<{
  onAction: (action: string) => void;
  permissions: {
    canCreate: boolean;
    canTransfer: boolean;
    canAdjust: boolean;
    canExport: boolean;
  };
  loading?: boolean;
}> = ({ onAction, permissions, loading }) => {
  const actions = [
    { id: 'add', label: 'Add Item', icon: Plus, visible: permissions.canCreate, color: 'blue' },
    { id: 'scan', label: 'Scan Barcode', icon: Scan, visible: true, color: 'purple' },
    { id: 'adjust', label: 'Adjust Stock', icon: RefreshCcw, visible: permissions.canAdjust, color: 'orange' },
    { id: 'transfer', label: 'Transfer', icon: Truck, visible: permissions.canTransfer, color: 'amber' },
    { id: 'export', label: 'Export', icon: Download, visible: permissions.canExport, color: 'green' },
    { id: 'import', label: 'Import', icon: Upload, visible: permissions.canCreate, color: 'indigo' },
    { id: 'settings', label: 'Settings', icon: Settings, visible: permissions.canAdjust, color: 'gray' },
  ];

  const visibleActions = actions.filter((a) => a.visible);

  if (visibleActions.length === 0) return null;

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-600 hover:bg-blue-700 text-white',
    purple: 'bg-purple-600 hover:bg-purple-700 text-white',
    orange: 'bg-orange-600 hover:bg-orange-700 text-white',
    green: 'bg-green-600 hover:bg-green-700 text-white',
    indigo: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    gray: 'bg-gray-600 hover:bg-gray-700 text-white',
    amber: 'bg-amber-600 hover:bg-amber-700 text-white',
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

const InventoryFiltersBar: React.FC<{
  filters: InventoryFilters;
  onFilterChange: (key: string, value: any) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  categories?: Array<{ id: string; name: string }>;
  locations?: string[];
  loading?: boolean;
}> = ({
  filters,
  onFilterChange,
  showFilters,
  onToggleFilters,
  categories = [],
  locations = [],
  loading,
}) => {
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

  const booleanOptions = [
    { value: 'all', label: 'All' },
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
  ];

  const sortOptions = [
    { value: 'name', label: 'Name' },
    { value: 'stock', label: 'Stock' },
    { value: 'price', label: 'Price' },
    { value: 'value', label: 'Total Value' },
    { value: 'createdAt', label: 'Created Date' },
    { value: 'updatedAt', label: 'Last Updated' },
  ];

  const defaultLocations = [
    'Warehouse', 'Storefront', 'Backroom', 'Supplier',
    'In Transit', 'Distribution Center',
    'Store A', 'Store B', 'Online Store',
  ];

  const allLocations = locations.length > 0 ? locations : defaultLocations;
  const allCategories = categories;

  const activeFilterCount = [
    filters.search ? 1 : 0,
    filters.category ? 1 : 0,
    filters.categoryId ? 1 : 0,
    filters.location ? 1 : 0,
    filters.status !== 'all' ? 1 : 0,
    filters.lowStock ? 1 : 0,
    filters.hasBarcode !== 'all' ? 1 : 0,
    filters.minPrice ? 1 : 0,
    filters.maxPrice ? 1 : 0,
    filters.supplier ? 1 : 0,
    filters.inStock ? 1 : 0,
    filters.hasImages !== 'all' ? 1 : 0,
    filters.isDigital !== 'all' ? 1 : 0,
    filters.featured !== 'all' ? 1 : 0,
    filters.isActive !== 'all' ? 1 : 0,
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
          {[
            { id: 'name', label: 'Name' },
            { id: 'stock', label: 'Stock' },
            { id: 'price', label: 'Price' },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => onFilterChange('sortBy', opt.id)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                filters.sortBy === opt.id
                  ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {activeFilterCount > 0 && (
          <button
            onClick={() => {
              onFilterChange('search', '');
              onFilterChange('category', '');
              onFilterChange('categoryId', '');
              onFilterChange('location', '');
              onFilterChange('status', 'all');
              onFilterChange('lowStock', false);
              onFilterChange('hasBarcode', 'all');
              onFilterChange('minPrice', undefined);
              onFilterChange('maxPrice', undefined);
              onFilterChange('supplier', '');
              onFilterChange('inStock', undefined);
              onFilterChange('sortBy', 'name');
              onFilterChange('sortOrder', 'asc');
              onFilterChange('hasImages', 'all');
              onFilterChange('isDigital', 'all');
              onFilterChange('featured', 'all');
              onFilterChange('isActive', 'all');
            }}
            disabled={loading}
            className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 flex items-center gap-1 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
            Clear All
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
                    if (allCategories.some((c) => c.id === value)) {
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
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
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
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
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
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Barcode
                </label>
                <select
                  value={filters.hasBarcode}
                  onChange={(e) =>
                    onFilterChange(
                      'hasBarcode',
                      e.target.value as 'all' | 'yes' | 'no'
                    )
                  }
                  disabled={loading}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {barcodeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
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
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.lowStock}
                      onChange={(e) =>
                        onFilterChange('lowStock', e.target.checked)
                      }
                      disabled={loading}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50"
                    />
                    Low Stock
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!filters.inStock}
                      onChange={(e) =>
                        onFilterChange('inStock', e.target.checked)
                      }
                      disabled={loading}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50"
                    />
                    In Stock
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Min Price
                </label>
                <input
                  type="number"
                  value={filters.minPrice || ''}
                  onChange={(e) =>
                    onFilterChange(
                      'minPrice',
                      e.target.value ? parseFloat(e.target.value) : undefined
                    )
                  }
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
                  onChange={(e) =>
                    onFilterChange(
                      'maxPrice',
                      e.target.value ? parseFloat(e.target.value) : undefined
                    )
                  }
                  placeholder="0.00"
                  disabled={loading}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Has Images
                </label>
                <select
                  value={filters.hasImages || 'all'}
                  onChange={(e) => onFilterChange('hasImages', e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {booleanOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Digital Product
                </label>
                <select
                  value={filters.isDigital || 'all'}
                  onChange={(e) => onFilterChange('isDigital', e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {booleanOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Featured
                </label>
                <select
                  value={filters.featured || 'all'}
                  onChange={(e) => onFilterChange('featured', e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {booleanOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Active Status
                </label>
                <select
                  value={filters.isActive || 'all'}
                  onChange={(e) => onFilterChange('isActive', e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {booleanOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
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
};

const InventoryTable: React.FC<{
  data: InventoryItem[];
  loading: boolean;
  selectedItems: string[];
  onSelectItem: (id: string) => void;
  onSelectAll: () => void;
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
  onView: (item: InventoryItem) => void;
  onPrintBarcode: (item: InventoryItem) => void;
  onAdjust: (item: InventoryItem) => void;
  pagination: PaginationData;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}> = ({
  data,
  loading,
  selectedItems,
  onSelectItem,
  onSelectAll,
  onEdit,
  onDelete,
  onView,
  onPrintBarcode,
  onAdjust,
  pagination,
  onPageChange,
  onLimitChange,
}) => {
  const getStatusBadge = (item: InventoryItem) => {
    const stock = item.stock || item.quantity || 0;
    const reorderPoint = item.reorderPoint || item.minStock || 5;

    if (stock === 0) {
      return {
        label: 'Out of Stock',
        color:
          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      };
    }
    if (stock <= reorderPoint) {
      return {
        label: 'Low Stock',
        color:
          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      };
    }
    return {
      label: 'In Stock',
      color:
        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    };
  };

  const getStockValue = (item: InventoryItem) => {
    const stock = item.stock || item.quantity || 0;
    const price = item.price || item.unitPrice || 0;
    return stock * price;
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <span className="ml-3 text-gray-500 dark:text-gray-400">
            Loading inventory...
          </span>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
        <Package className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          No inventory items found
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Try adjusting your filters or add a new item
        </p>
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
                  checked={
                    selectedItems.length === data.length && data.length > 0
                  }
                  onChange={onSelectAll}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Item
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                SKU
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                Barcode
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Price
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Stock
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                Value
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.map((item) => {
              const status = getStatusBadge(item);
              const isSelected = selectedItems.includes(item.id);
              const stock = item.stock || item.quantity || 0;
              const stockValue = getStockValue(item);
              const hasImages = item.images && item.images.length > 0;
              const hasBarcode = !!item.barcode;

              return (
                <tr
                  key={item.id}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${
                    isSelected ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                  }`}
                  onClick={() => onView(item)}
                >
                  <td
                    className="px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
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
                        {hasImages ? (
                          <img
                            src={item.images![0]}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                '/placeholder-image.png';
                            }}
                          />
                        ) : (
                          <Package className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white truncate max-w-[150px] sm:max-w-[200px]">
                          {item.name}
                        </p>
                        {item.variantName && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {item.variantName}
                          </span>
                        )}
                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                          {item.category && (
                            <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-0.5">
                              <Tag className="w-3 h-3" />
                              {item.category}
                            </span>
                          )}
                          {item.isDigital && (
                            <span className="text-xs text-blue-400 flex items-center gap-0.5">
                              <Globe className="w-3 h-3" />
                              Digital
                            </span>
                          )}
                          {item.featured && (
                            <span className="text-xs text-yellow-400 flex items-center gap-0.5">
                              <Star className="w-3 h-3" />
                              Featured
                            </span>
                          )}
                        </div>
                        {item.businessUnit && (
                          <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                            <Building className="w-3 h-3" />
                            {item.businessUnit.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono hidden md:table-cell">
                    {item.sku}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {hasBarcode ? (
                      <div className="flex items-center gap-1">
                        <Barcode className="w-4 h-4 text-green-500" />
                        <span className="text-xs font-mono text-gray-600 dark:text-gray-300 truncate max-w-[100px]">
                          {item.barcode}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">No barcode</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                    {formatCurrency(item.price || item.unitPrice || 0)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`font-medium ${
                        stock === 0
                          ? 'text-red-600 dark:text-red-400'
                          : stock <= (item.reorderPoint || item.minStock || 5)
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-green-600 dark:text-green-400'
                      }`}
                    >
                      {stock}
                      {item.reserved !== undefined && item.reserved > 0 && (
                        <span className="text-xs text-gray-400 ml-1">
                          ({item.reserved} reserved)
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                    {formatCurrency(stockValue)}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}
                    >
                      {status.label}
                    </span>
                  </td>
                  <td
                    className="px-4 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      {hasBarcode && (
                        <button
                          onClick={() => onPrintBarcode(item)}
                          className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                          title="Print Barcode"
                        >
                          <Printer className="w-4 h-4 text-green-500" />
                        </button>
                      )}
                      <button
                        onClick={() => onAdjust(item)}
                        className="p-1 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded transition-colors"
                        title="Adjust Stock"
                      >
                        <RefreshCcw className="w-4 h-4 text-amber-500" />
                      </button>
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
              Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total}
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

const RecentActivity: React.FC<{ businessUnitId?: string }> = ({
  businessUnitId,
}) => {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

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
        if (!cancelled) setActivities(transactions?.data || []);
      } catch (error) {
        console.error('Failed to load recent activity:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadActivities();

    return () => {
      cancelled = true;
    };
  }, [businessUnitId]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
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
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
          No recent activity
        </p>
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
            <div
              className={`p-1.5 rounded-full ${
                activity.quantity && activity.quantity > 0
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
              }`}
            >
              {activity.quantity && activity.quantity > 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-700 dark:text-gray-300">
                <span className="font-medium">
                  {activity.product?.name || 'Unknown'}
                </span>
                <span
                  className={`ml-1 ${
                    activity.quantity && activity.quantity > 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {activity.quantity && activity.quantity > 0 ? '+' : ''}
                  {activity.quantity || 0}
                </span>
              </p>
              <p className="text-xs text-gray-400">
                {formatDate(activity.createdAt || activity.timestamp)} •{' '}
                {activity.transactionType || 'Adjustment'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const InventoryCharts: React.FC<{
  data: InventoryItem[];
  stats: InventoryStatsData;
}> = ({ data }) => {
  const categoryMap = new Map<string, { count: number; value: number }>();
  data.forEach((item) => {
    const cat = item.category || 'Uncategorized';
    const stock = item.stock || item.quantity || 0;
    const price = item.price || item.unitPrice || 0;
    const existing = categoryMap.get(cat) || { count: 0, value: 0 };
    existing.count += stock;
    existing.value += stock * price;
    categoryMap.set(cat, existing);
  });

  const categories = Array.from(categoryMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  const total =
    data.reduce((sum, item) => sum + (item.stock || item.quantity || 0), 0) ||
    1;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
        <PieChart className="w-4 h-4 text-gray-400" />
        Stock by Category
      </h3>
      {categories.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
          No category data
        </p>
      ) : (
        <div className="space-y-2">
          {categories.map(([name, cat]) => {
            const percentage = (cat.count / total) * 100;
            return (
              <div key={name}>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400 truncate flex-1 mr-2">
                    {name}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {cat.count} units
                  </span>
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

interface AdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    quantity: number;
    type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
    notes: string;
  }) => void;
  currentStock: number;
  reserved: number;
  reorderPoint: number;
  itemName: string;
  loading: boolean;
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
}) => {
  const [localQuantity, setLocalQuantity] = useState(1);
  const [localType, setLocalType] = useState<'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT'>(
    'ADJUSTMENT_IN'
  );
  const [localNotes, setLocalNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLocalQuantity(1);
      setLocalType('ADJUSTMENT_IN');
      setLocalNotes('');
    }
  }, [isOpen]);

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
    onConfirm({
      quantity: localQuantity,
      type: localType,
      notes: localNotes,
    });
  };

  const newStock =
    localType === 'ADJUSTMENT_IN'
      ? currentStock + localQuantity
      : currentStock - localQuantity;

  const isNewStockLow = newStock <= reorderPoint && newStock > 0;
  const isNewStockOut = newStock === 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm dark:bg-black/70"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 m-4 border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            <RefreshCcw className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Adjust Stock
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[200px] sm:max-w-[300px]">
              {itemName}
            </p>
          </div>
        </div>

        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-300">
                Current Stock
              </span>
              <p className="font-semibold text-gray-900 dark:text-white">
                {currentStock} units
              </p>
            </div>
            {reserved > 0 && (
              <div>
                <span className="text-gray-600 dark:text-gray-300">
                  Reserved
                </span>
                <p className="font-semibold text-yellow-600 dark:text-yellow-400">
                  {reserved} units
                </p>
              </div>
            )}
            <div>
              <span className="text-gray-600 dark:text-gray-300">
                Available
              </span>
              <p
                className={`font-semibold ${
                  availableStock === 0
                    ? 'text-red-600 dark:text-red-400'
                    : isLowStock
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-green-600 dark:text-green-400'
                }`}
              >
                {availableStock} units
              </p>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-300">
                Reorder Point
              </span>
              <p className="font-semibold text-gray-700 dark:text-gray-300">
                {reorderPoint} units
              </p>
            </div>
          </div>
          {(isLowStock || isOutOfStock) && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
              <p
                className={`text-sm flex items-center gap-1 ${
                  isOutOfStock
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-yellow-600 dark:text-yellow-400'
                }`}
              >
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
                disabled={loading}
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
                disabled={loading}
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
                onChange={(e) =>
                  setLocalQuantity(Math.max(0, parseInt(e.target.value) || 0))
                }
                min="0"
                step="1"
                className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                placeholder="Enter quantity"
                disabled={loading}
                autoFocus
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500">
                units
              </div>
            </div>

            {localType === 'ADJUSTMENT_OUT' &&
              localQuantity > currentStock && (
                <p className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  Cannot remove more than current stock ({currentStock} units)
                </p>
              )}

            {localQuantity > 0 && (
              <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">
                    New stock:
                  </span>
                  <span
                    className={`font-semibold ${
                      isNewStockOut
                        ? 'text-red-600 dark:text-red-400'
                        : isNewStockLow
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-green-600 dark:text-green-400'
                    }`}
                  >
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
                {!isNewStockLow &&
                  !isNewStockOut &&
                  localType === 'ADJUSTMENT_IN' && (
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
              Notes{' '}
              <span className="text-gray-400 dark:text-gray-500 text-xs font-normal">
                (optional)
              </span>
            </label>
            <textarea
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors resize-none"
              placeholder="Reason for adjustment (e.g., Restock, Damaged, Return, etc.)"
              disabled={loading}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 text-sm font-medium w-full sm:w-auto"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={
              loading ||
              localQuantity <= 0 ||
              (localType === 'ADJUSTMENT_OUT' &&
                localQuantity > currentStock)
            }
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 w-full sm:w-auto ${
              localType === 'ADJUSTMENT_IN'
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? (
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
    user,
    isAuthenticated,
    isLoading: authLoading,
  } = useAuth();

  const {
    canViewInventory,
    canCreateInventory,
    canDeleteInventory,
    canAdjustInventory,
    canTransferInventory,
    canExportInventory,
    isLoading: permLoading,
    isSuperAdmin,
    getBusinessUnits: getBusinessUnitsFromHook,
    getCurrentBusinessUnit,
  } = usePermission();

  const canView     = isSuperAdmin || canViewInventory();
  const canCreate   = isSuperAdmin || canCreateInventory();
  const canDelete   = isSuperAdmin || canDeleteInventory();
  const canAdjust   = isSuperAdmin || canAdjustInventory();
  const canTransfer = isSuperAdmin || canTransferInventory();
  const canExport   = isSuperAdmin || canExportInventory();

  const booting = authLoading || permLoading;

  const initialLoadDoneRef = useRef(false);
  const loadDataRef = useRef(false);
  const businessUnitsLoadedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
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
    hasImages: 'all',
    isDigital: 'all',
    featured: 'all',
    isActive: 'all',
  });
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [categories, setCategories] = useState<
    Array<{ id: string; name: string }>
  >([]);

  const [businessUnits, setBusinessUnits] = useState<BusinessUnitOption[]>([]);
  const [loadingBusinessUnits, setLoadingBusinessUnits] = useState(true);
  const [selectedBusinessUnitId, setSelectedBusinessUnitId] =
    useState<string>('');
  const [businessUnitError, setBusinessUnitError] = useState<string | null>(
    null
  );

  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(
    null
  );
  const [adjustingLoading, setAdjustingLoading] = useState(false);

  const fallbackBusinessUnitId = businessUnits[0]?.id ?? '';

  const businessUnitLookup = useMemo(
    () =>
      Object.fromEntries(
        businessUnits.map((bu) => [bu.id, bu])
      ) as Record<string, BusinessUnitOption>,
    [businessUnits]
  );

  // ============================================
  // NORMALIZE
  // ============================================
  //
  // ⚠️ `images` is now `ProductImage[]` on the raw product shape.
  //    Service flattens, but this guard makes the normaliser
  //    resilient to both.

  const normalizeInventoryItem = useCallback(
    (item: any): InventoryItem => {
      return {
        id: item.id || '',
        name: item.name || item.product?.name || 'Unknown',
        sku: item.sku || item.product?.sku || 'N/A',
        stock: item.quantity || item.stock || 0,
        quantity: item.quantity || item.stock || 0,
        price: item.unitPrice || item.price || item.product?.unitPrice || 0,
        unitPrice: item.unitPrice || item.price || item.product?.unitPrice || 0,
        reorderPoint: item.reorderPoint || item.minStock || 5,
        minStock: item.minStock || item.reorderPoint || 5,
        maxStock: item.maxStock || item.reorderQuantity || 100,
        category: item.category || item.product?.category?.name || undefined,
        categoryId: item.categoryId || item.product?.categoryId || undefined,
        location: item.location || 'Warehouse',
        supplier: item.supplier || item.product?.supplier?.name || undefined,
        supplierId:
          item.supplierId || item.product?.supplier?.id || undefined,
        status: item.status || 'ACTIVE',
        lastUpdated: item.updatedAt || new Date().toISOString(),
        // ✅ Flatten ProductImage[] if it slipped through.
        images:
          item.images && item.images.length > 0
            ? toImageUrls(item.images)
            : toImageUrls(item.product?.images),
        reserved: item.reserved || 0,
        barcode: item.barcode || item.product?.barcode || null,
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || new Date().toISOString(),
        costPrice: item.costPrice || item.product?.costPrice || 0,
        taxRate: item.taxRate || item.product?.taxRate || 0,
        unit: item.unit || 'each',
        isActive: item.isActive !== undefined ? item.isActive : true,
        productId: item.productId || item.product?.id || undefined,
        variantId: item.variantId || undefined,
        variantName: item.variantName || item.variant?.name || undefined,
        businessUnitId: item.businessUnitId || undefined,
        businessUnit: item.businessUnit || undefined,
        description: item.description || item.product?.description || null,
        weight: item.weight || item.product?.weight || 0,
        tags: item.tags || item.product?.tags || [],
        isDigital: item.isDigital || item.product?.isDigital || false,
        featured: item.featured || item.product?.featured || false,
        expiryDate: item.expiryDate || null,
        batchNumber: item.batchNumber || null,
        available:
          (item.quantity || item.stock || 0) - (item.reserved || 0),
      };
    },
    []
  );

  // ============================================
  // BUSINESS UNITS
  // ============================================

  const loadBusinessUnitsFromHook = useCallback((): boolean => {
    const hookUnits = getBusinessUnitsFromHook();
    const hookCurrent = getCurrentBusinessUnit();

    if (!Array.isArray(hookUnits) || hookUnits.length === 0) return false;

    const mapped: BusinessUnitOption[] = hookUnits
      .filter((bu: any) => isValidBusinessUnitId(bu?.id))
      .map((bu: any) => ({
        id: bu.id,
        name: bu.name || 'Unnamed Business Unit',
        code: bu.code || '',
        type: bu.type || '',
        isActive: bu.isActive !== false,
        companyId: bu.companyId || undefined,
        companyName: bu.companyName || undefined,
      }));

    if (mapped.length === 0) return false;

    setBusinessUnits(mapped);

    const storedId =
      typeof window !== 'undefined'
        ? localStorage.getItem('selectedBusinessUnitId') ||
          localStorage.getItem('businessUnitId')
        : null;

    const preferred =
      (storedId && mapped.find((u) => u.id === storedId && u.isActive !== false)) ||
      (hookCurrent && mapped.find((u) => u.id === hookCurrent.id)) ||
      mapped.find((u) => u.isActive !== false) ||
      mapped[0];

    if (preferred) {
      setSelectedBusinessUnitId(preferred.id);
      setFilters((prev) => ({ ...prev, businessUnitId: preferred.id }));
      try {
        localStorage.setItem('selectedBusinessUnitId', preferred.id);
        localStorage.setItem('businessUnitId', preferred.id);
      } catch {
        /* ignore */
      }
    }

    businessUnitsLoadedRef.current = true;
    return true;
  }, [getBusinessUnitsFromHook, getCurrentBusinessUnit]);

  const fetchBusinessUnitsLegacy = useCallback(async () => {
    if (businessUnitsLoadedRef.current) return;

    setLoadingBusinessUnits(true);
    setBusinessUnitError(null);

    try {
      let units: BusinessUnitOption[] = [];

      try {
        const stored =
          typeof window !== 'undefined'
            ? localStorage.getItem('businessUnits')
            : null;
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            units = parsed
              .filter((bu: any) => {
                const id = bu.id || bu.businessUnitId;
                return isValidBusinessUnitId(id);
              })
              .map((bu: any) => ({
                id: bu.id || bu.businessUnitId,
                name: bu.name || bu.businessUnit?.name || 'Unnamed',
                code: bu.code || bu.businessUnit?.code || '',
                type: bu.type || bu.businessUnit?.type || '',
                isActive: bu.isActive !== false,
                companyName:
                  bu.companyName ||
                  bu.businessUnit?.company?.name ||
                  undefined,
              }));
          }
        }
      } catch (storageError) {
        console.warn(
          '[inventory] localStorage businessUnits parse failed:',
          storageError
        );
      }

      if (units.length === 0) {
        try {
          const userAny = user as any;
          if (
            userAny?.businessUnits &&
            Array.isArray(userAny.businessUnits)
          ) {
            const mappedUnits = userAny.businessUnits
              .map((bu: any) => {
                const id = bu.businessUnitId || bu.id;
                if (!isValidBusinessUnitId(id)) return null;
                return {
                  id,
                  name: bu.businessUnit?.name || bu.name || 'Unnamed',
                  code: bu.businessUnit?.code || bu.code || '',
                  type: bu.businessUnit?.type || bu.type || '',
                  isActive:
                    bu.businessUnit?.isActive !== undefined
                      ? bu.businessUnit.isActive
                      : true,
                  companyName:
                    bu.businessUnit?.company?.name ||
                    bu.companyName ||
                    undefined,
                } as BusinessUnitOption;
              })
              .filter(
                (bu: BusinessUnitOption | null): bu is BusinessUnitOption =>
                  bu !== null
              );

            units = mappedUnits;
          }
        } catch (userError) {
          console.warn(
            '[inventory] user-context businessUnits read failed:',
            userError
          );
        }
      }

      if (units.length === 0) {
        const savedId =
          typeof window !== 'undefined'
            ? localStorage.getItem('selectedBusinessUnitId') ||
              localStorage.getItem('businessUnitId')
            : null;
        if (isValidBusinessUnitId(savedId)) {
          units.push({
            id: savedId,
            name: 'Default Business Unit',
            code: 'DEFAULT',
            type: 'STORE',
            isActive: true,
          });
        }
      }

      const uniqueUnits = units.filter(
        (unit, index, self) =>
          index === self.findIndex((u) => u.id === unit.id)
      );

      if (!mountedRef.current) return;

      setBusinessUnits(uniqueUnits);

      if (uniqueUnits.length > 0) {
        const storedId =
          typeof window !== 'undefined'
            ? localStorage.getItem('selectedBusinessUnitId') ||
              localStorage.getItem('businessUnitId')
            : null;

        const saved =
          storedId &&
          uniqueUnits.find((bu) => bu.id === storedId && bu.isActive !== false);

        const preferred =
          saved ||
          uniqueUnits.find((bu) => bu.isActive !== false) ||
          uniqueUnits[0];

        if (preferred) {
          setSelectedBusinessUnitId(preferred.id);
          setFilters((prev) => ({ ...prev, businessUnitId: preferred.id }));
          try {
            localStorage.setItem('selectedBusinessUnitId', preferred.id);
            localStorage.setItem('businessUnitId', preferred.id);
          } catch {
            /* ignore */
          }
        }
      } else {
        setBusinessUnitError('No business units available.');
        toast.warning('No business units available');
      }

      businessUnitsLoadedRef.current = true;
    } catch (err) {
      console.error('[inventory] fetchBusinessUnitsLegacy failed:', err);
      setBusinessUnitError('Failed to load business units.');
      toast.error('Failed to load business units');
    } finally {
      if (mountedRef.current) setLoadingBusinessUnits(false);
    }
  }, [user]);

  const ensureBusinessUnitsLoaded = useCallback(async () => {
    if (businessUnitsLoadedRef.current) return;
    if (loadBusinessUnitsFromHook()) {
      setLoadingBusinessUnits(false);
      return;
    }
    await fetchBusinessUnitsLegacy();
  }, [loadBusinessUnitsFromHook, fetchBusinessUnitsLegacy]);

  // ============================================
  // LOAD INVENTORY
  // ============================================

  const loadInventoryData = useCallback(
    async (showLoading = true) => {
      if (loadDataRef.current) return;
      if (!canView) {
        if (mountedRef.current) setLoading(false);
        return;
      }

      const effectiveBusinessUnitId =
        selectedBusinessUnitId || fallbackBusinessUnitId;

      if (!isValidBusinessUnitId(effectiveBusinessUnitId)) {
        if (mountedRef.current) {
          setLoading(false);
          setInventory([]);
        }
        return;
      }

      loadDataRef.current = true;

      try {
        if (showLoading && mountedRef.current) setLoading(true);

        let allData: any[] = [];

        try {
          const allInventory =
            await inventoryService.getAllInventory(effectiveBusinessUnitId);
          if (allInventory && Array.isArray(allInventory.items)) {
            allData = allInventory.items;
          }
        } catch (err) {
          console.warn('[inventory] getAllInventory failed:', err);
        }

        if (allData.length === 0) {
          try {
            const inventoryResponse = await inventoryService.getInventory({
              businessUnitId: effectiveBusinessUnitId,
              limit: 1000,
            });
            if (
              inventoryResponse &&
              Array.isArray(inventoryResponse.inventory)
            ) {
              allData = inventoryResponse.inventory;
            }
          } catch (err) {
            console.warn('[inventory] getInventory also failed:', err);
          }
        }

        if (!mountedRef.current) return;

        if (allData.length > 0) {
          const normalizedData = allData.map(normalizeInventoryItem);

          setInventory(normalizedData);

          const withBarcode = normalizedData.filter(
            (item: InventoryItem) => item.barcode
          ).length;
          const withoutBarcode = normalizedData.length - withBarcode;
          const inStock = normalizedData.filter(
            (item: InventoryItem) => (item.stock || 0) > 0
          ).length;
          const lowStockCount = normalizedData.filter(
            (item: InventoryItem) =>
              (item.stock || 0) <=
                (item.reorderPoint || item.minStock || 5) &&
              (item.stock || 0) > 0
          ).length;
          const outOfStockCount = normalizedData.filter(
            (item: InventoryItem) => (item.stock || 0) === 0
          ).length;
          const totalValue = normalizedData.reduce(
            (sum: number, item: InventoryItem) =>
              sum + (item.stock || 0) * (item.price || 0),
            0
          );
          const totalCost = normalizedData.reduce(
            (sum: number, item: InventoryItem) =>
              sum + (item.stock || 0) * (item.costPrice || 0),
            0
          );

          const uniqueCategories = new Set(
            normalizedData
              .map((item: InventoryItem) => item.category)
              .filter(Boolean)
          );
          const uniqueSuppliers = new Set(
            normalizedData
              .map((item: InventoryItem) => item.supplier)
              .filter(Boolean)
          );

          setStats({
            totalItems: normalizedData.length,
            totalValue,
            totalCost,
            lowStock: lowStockCount,
            outOfStock: outOfStockCount,
            totalCategories: uniqueCategories.size,
            totalSuppliers: uniqueSuppliers.size,
            profitMargin:
              totalCost > 0
                ? ((totalValue - totalCost) / totalCost) * 100
                : 0,
            withBarcode,
            withoutBarcode,
            inStock,
          });

          setLastUpdated(new Date());

          try {
            const categoriesData = await inventoryService.getCategories(
              effectiveBusinessUnitId
            );
            if (
              Array.isArray(categoriesData) &&
              categoriesData.length > 0 &&
              mountedRef.current
            ) {
              setCategories(
                categoriesData.map((cat: any) => ({
                  id: cat.id,
                  name: cat.name,
                }))
              );
            }
          } catch (err) {
            console.warn('[inventory] load categories for filter failed:', err);
          }
        } else {
          setInventory([]);
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
      } catch (err) {
        console.error('[inventory] loadInventoryData failed:', err);
        toast.error('Failed to load inventory data');
        if (mountedRef.current) setInventory([]);
      } finally {
        loadDataRef.current = false;
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [
      canView,
      selectedBusinessUnitId,
      fallbackBusinessUnitId,
      normalizeInventoryItem,
    ]
  );

  const enrichedInventory = useMemo(() => {
    const bu = businessUnitLookup[selectedBusinessUnitId];
    if (!bu) return inventory;
    return inventory.map((item) => ({
      ...item,
      businessUnit: { id: bu.id, name: bu.name, code: bu.code },
    }));
  }, [inventory, businessUnitLookup, selectedBusinessUnitId]);

  useEffect(() => {
    if (booting) return;
    if (!isAuthenticated || !user) return;
    ensureBusinessUnitsLoaded();
  }, [booting, isAuthenticated, user, ensureBusinessUnitsLoaded]);

  useEffect(() => {
    if (booting) return;
    if (!isAuthenticated) return;
    if (!businessUnitsLoadedRef.current) return;
    if (!isValidBusinessUnitId(selectedBusinessUnitId)) return;
    if (loadDataRef.current) return;
    if (initialLoadDoneRef.current) return;

    loadInventoryData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    booting,
    isAuthenticated,
    selectedBusinessUnitId,
    loadInventoryData,
  ]);

  // ============================================
  // FILTERING
  // ============================================

  const filteredInventory = useMemo(() => {
    let filtered = [...enrichedInventory];

    if (filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          (item.barcode && item.barcode.toLowerCase().includes(q))
      );
    }

    if (filters.categoryId) {
      filtered = filtered.filter(
        (item) => item.categoryId === filters.categoryId
      );
    } else if (filters.category) {
      const q = filters.category.toLowerCase();
      filtered = filtered.filter(
        (item) => item.category && item.category.toLowerCase().includes(q)
      );
    }

    if (filters.location) {
      filtered = filtered.filter(
        (item) => item.location === filters.location
      );
    }

    if (filters.status !== 'all') {
      switch (filters.status) {
        case 'active':
          filtered = filtered.filter((item) => item.isActive !== false);
          break;
        case 'inactive':
          filtered = filtered.filter((item) => item.isActive === false);
          break;
        case 'low_stock':
          filtered = filtered.filter((item) => {
            const stock = item.stock || 0;
            const rp = item.reorderPoint || item.minStock || 5;
            return stock <= rp && stock > 0;
          });
          break;
        case 'out_of_stock':
          filtered = filtered.filter((item) => (item.stock || 0) === 0);
          break;
        case 'discontinued':
          filtered = filtered.filter(
            (item) => item.status === 'DISCONTINUED'
          );
          break;
      }
    }

    if (filters.lowStock) {
      filtered = filtered.filter((item) => {
        const stock = item.stock || 0;
        const rp = item.reorderPoint || item.minStock || 5;
        return stock <= rp && stock > 0;
      });
    }

    if (filters.inStock !== undefined) {
      filtered = filtered.filter((item) => {
        const stock = item.stock || 0;
        return filters.inStock ? stock > 0 : stock === 0;
      });
    }

    if (filters.hasBarcode !== 'all') {
      const hasBarcode = filters.hasBarcode === 'yes';
      filtered = filtered.filter((item) =>
        hasBarcode ? !!item.barcode : !item.barcode
      );
    }

    if (filters.hasImages && filters.hasImages !== 'all') {
      const hasImages = filters.hasImages === 'yes';
      filtered = filtered.filter((item) =>
        hasImages
          ? !!(item.images && item.images.length > 0)
          : !(item.images && item.images.length > 0)
      );
    }

    if (filters.isDigital && filters.isDigital !== 'all') {
      const want = filters.isDigital === 'yes';
      filtered = filtered.filter((item) => item.isDigital === want);
    }

    if (filters.featured && filters.featured !== 'all') {
      const want = filters.featured === 'yes';
      filtered = filtered.filter((item) => item.featured === want);
    }

    if (filters.isActive && filters.isActive !== 'all') {
      const want = filters.isActive === 'yes';
      filtered = filtered.filter((item) => item.isActive === want);
    }

    if (filters.minPrice !== undefined) {
      filtered = filtered.filter(
        (item) => (item.price || 0) >= filters.minPrice!
      );
    }
    if (filters.maxPrice !== undefined) {
      filtered = filtered.filter(
        (item) => (item.price || 0) <= filters.maxPrice!
      );
    }

    if (filters.supplier) {
      const q = filters.supplier.toLowerCase();
      filtered = filtered.filter(
        (item) => item.supplier && item.supplier.toLowerCase().includes(q)
      );
    }

    if (filters.sortBy) {
      const order = filters.sortOrder || 'asc';
      filtered.sort((a, b) => {
        let aVal: any;
        let bVal: any;
        switch (filters.sortBy) {
          case 'name':
            aVal = a.name;
            bVal = b.name;
            break;
          case 'stock':
            aVal = a.stock || 0;
            bVal = b.stock || 0;
            break;
          case 'price':
            aVal = a.price || 0;
            bVal = b.price || 0;
            break;
          case 'value':
            aVal = (a.stock || 0) * (a.price || 0);
            bVal = (b.stock || 0) * (b.price || 0);
            break;
          case 'createdAt':
            aVal = a.createdAt || '';
            bVal = b.createdAt || '';
            break;
          case 'updatedAt':
            aVal = a.updatedAt || '';
            bVal = b.updatedAt || '';
            break;
          default:
            aVal = a.name;
            bVal = b.name;
        }
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return order === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }
        return order === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }

    return filtered;
  }, [enrichedInventory, filters]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleBusinessUnitSelect = (id: string) => {
    setSelectedBusinessUnitId(id);
    setFilters((prev) => ({ ...prev, businessUnitId: id }));
    setPagination((prev) => ({ ...prev, page: 1 }));
    try {
      localStorage.setItem('selectedBusinessUnitId', id);
      localStorage.setItem('businessUnitId', id);
    } catch {
      /* ignore */
    }
    initialLoadDoneRef.current = false;
    loadDataRef.current = false;
    const bu = businessUnits.find((b) => b.id === id);
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
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleSelectAll = () => {
    const pageItems = filteredInventory.slice(
      (pagination.page - 1) * pagination.limit,
      pagination.page * pagination.limit
    );
    if (
      selectedItems.length === pageItems.length &&
      pageItems.length > 0
    ) {
      setSelectedItems([]);
      setShowBulkActions(false);
    } else {
      setSelectedItems(pageItems.map((item) => item.id));
      setShowBulkActions(true);
    }
  };

  const handleSelectItem = (id: string) => {
    setSelectedItems((prev) => {
      const next = prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id];
      setShowBulkActions(next.length > 0);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (!canDelete) {
      toast.error('You do not have permission to delete inventory items');
      return;
    }
    if (
      !confirm(
        `Are you sure you want to delete ${selectedItems.length} items?`
      )
    )
      return;

    try {
      let successCount = 0;
      for (const id of selectedItems) {
        try {
          await inventoryService.deleteInventoryItem(id);
          successCount++;
        } catch (err) {
          console.error(`[inventory] delete ${id} failed:`, err);
        }
      }
      toast.success(
        `${successCount} of ${selectedItems.length} items deleted`
      );
      setSelectedItems([]);
      setShowBulkActions(false);
      initialLoadDoneRef.current = false;
      await loadInventoryData(false);
    } catch (err) {
      console.error('[inventory] bulk delete failed:', err);
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
      case 'adjust':
        router.push('/admin/inventory/adjust');
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

  const handlePageChange = (page: number) =>
    setPagination((prev) => ({ ...prev, page }));

  const handleLimitChange = (limit: number) =>
    setPagination((prev) => ({ ...prev, limit, page: 1 }));

  const handleViewItem = (item: InventoryItem) =>
    router.push(`/admin/inventory/${item.id}`);

  const handleEditItem = (item: InventoryItem) =>
    router.push(`/admin/inventory/${item.id}/edit`);

  const handleDeleteItem = async (id: string) => {
    if (!canDelete) {
      toast.error('You do not have permission to delete inventory items');
      return;
    }
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await inventoryService.deleteInventoryItem(id);
      toast.success('Item deleted successfully');
      initialLoadDoneRef.current = false;
      await loadInventoryData(false);
    } catch (err) {
      console.error('[inventory] delete failed:', err);
      toast.error('Failed to delete item');
    }
  };

  const handlePrintBarcode = (item: InventoryItem) =>
    router.push(`/admin/inventory/${item.id}/barcode`);

  const handleAdjustItem = (item: InventoryItem) => {
    setAdjustingItem(item);
    setShowAdjustmentModal(true);
  };

  const closeAdjustmentModal = () => {
    setShowAdjustmentModal(false);
    setAdjustingItem(null);
  };

  const handleAdjustmentConfirm = async (data: {
    quantity: number;
    type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
    notes: string;
  }) => {
    if (!adjustingItem) return;

    setAdjustingLoading(true);
    try {
      await inventoryService.updateStock(adjustingItem.id, {
        quantity: data.quantity,
        transactionType: data.type,
        notes: data.notes,
      });
      toast.success(
        `Stock ${
          data.type === 'ADJUSTMENT_IN' ? 'added' : 'removed'
        } successfully`
      );
      closeAdjustmentModal();
      initialLoadDoneRef.current = false;
      await loadInventoryData(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to adjust stock');
    } finally {
      setAdjustingLoading(false);
    }
  };

  // ============================================
  // GATES
  // ============================================

  if (booting) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Checking your session...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
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
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
            Please Login
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
            You need to be logged in to view inventory.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </button>
        </motion.div>
      </div>
    );
  }

  if (!canView) {
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
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
            Access Restricted
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
            You don't have permission to view inventory. Please contact your
            administrator.
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

  if (
    loading &&
    !refreshing &&
    inventory.length === 0 &&
    !initialLoadDoneRef.current
  ) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading inventory...
          </p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  const selectedBU = businessUnits.find(
    (bu) => bu.id === selectedBusinessUnitId
  );

  const paginatedItems = filteredInventory.slice(
    (pagination.page - 1) * pagination.limit,
    pagination.page * pagination.limit
  );

  const computedTotalPages =
    Math.ceil(filteredInventory.length / pagination.limit) || 1;

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
              {stats.totalItems} items •{' '}
              {formatCurrency(stats.totalValue || 0)} total value
            </p>
            {stats.withBarcode !== undefined && (
              <span className="text-xs text-gray-400">
                {stats.withBarcode} with barcode • {stats.withoutBarcode}{' '}
                without
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
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
            />
          </button>

          {canCreate && (
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

      <StatsCards stats={stats} loading={loading} />

      <QuickActions
        onAction={handleQuickAction}
        permissions={{
          canCreate,
          canTransfer,
          canAdjust,
          canExport,
        }}
        loading={loading}
      />

      <InventoryFiltersBar
        filters={filters}
        onFilterChange={handleFilterChange}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        categories={categories}
        loading={loading}
      />

      <AnimatePresence>
        {showBulkActions && selectedItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3"
          >
            <span className="text-sm text-blue-700 dark:text-blue-300">
              {selectedItems.length} item
              {selectedItems.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {canDelete && (
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

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3">
          <InventoryTable
            data={paginatedItems}
            loading={loading}
            selectedItems={selectedItems}
            onSelectItem={handleSelectItem}
            onSelectAll={handleSelectAll}
            onEdit={handleEditItem}
            onDelete={handleDeleteItem}
            onView={handleViewItem}
            onPrintBarcode={handlePrintBarcode}
            onAdjust={handleAdjustItem}
            pagination={{
              ...pagination,
              total: filteredInventory.length,
              totalPages: computedTotalPages,
            }}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
          />
        </div>

        <div className="space-y-6">
          <InventoryCharts data={enrichedInventory} stats={stats} />
          <RecentActivity businessUnitId={selectedBusinessUnitId} />
        </div>
      </div>

      <AdjustmentModal
        isOpen={showAdjustmentModal}
        onClose={closeAdjustmentModal}
        onConfirm={handleAdjustmentConfirm}
        currentStock={adjustingItem?.stock || adjustingItem?.quantity || 0}
        reserved={adjustingItem?.reserved || 0}
        reorderPoint={
          adjustingItem?.reorderPoint || adjustingItem?.minStock || 5
        }
        itemName={adjustingItem?.name || 'Item'}
        loading={adjustingLoading}
      />
    </div>
  );
}
