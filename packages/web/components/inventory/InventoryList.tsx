// D:\Projects\Kalwanga\packages\web\components\inventory\InventoryList.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Search, Filter, X, RefreshCw, Lock,
  Eye, Edit, Trash2, Plus, Minus, ArrowUpDown,
  Grid, List, LayoutGrid, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle, AlertTriangle, Info,
  Clock, User, Building, Tag, MapPin, DollarSign,
  Download, Printer, FileText, MoreVertical,
  Shield, Activity, BarChart3, TrendingUp, TrendingDown,
  ShoppingCart, Truck, Copy, Link2, ExternalLink,
  Star, Award, Globe, Archive, Hash, Weight,
  Percent, Image as ImageIcon, Calendar
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePermission } from '../../hooks/usePermission';
import { PermissionResource } from '../../types/enums';
import { inventoryService } from '../../services/inventoryService';
import { toast } from '../../utils/toast-manager';
import { formatCurrency, formatDate, formatNumber } from '../../utils/formatters';

// ============================================
// TYPES
// ============================================

interface InventoryItem {
  id: string;
  productId: string | null;
  product: any | null;
  variantId: string | null;
  variant: any | null;
  name: string;
  sku: string;  // ✅ Now included
  barcode: string | null;  // ✅ Now included
  quantity: number;
  reserved: number;
  available: number;
  unitPrice: number;
  costPrice: number;
  category: string;
  categoryId: string | null;
  supplier: string | null;
  supplierId: string | null;
  reorderPoint: number;
  location: string;
  notes: string | null;
  hasProduct: boolean;
  images: string[];
  description: string | null;
  weight: number;
  taxRate: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  status?: string;
  businessUnitId?: string;
  maxStock?: number;
  minStock?: number;
  stock?: number;
  price?: number;
  isActive?: boolean;
  isDigital?: boolean;
  featured?: boolean;
  reorderQuantity?: number;
}

interface InventoryListResponse {
  inventory: any[];
  items?: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: {
    totalProducts: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalValue: number;
    totalCost: number;
    potentialProfit: number;
    profitMargin: number;
    totalUnits: number;
    totalReserved: number;
    availableUnits: number;
    byCategory: Array<{ category: string; count: number; value: number }>;
  };
  appliedFilters: {
    search: string | null;
    category: string | null;
    location: string | null;
    status: string | null;
    lowStock: boolean;
  };
}

interface InventoryListProps {
  className?: string;
  compact?: boolean;
  showFilters?: boolean;
  showActions?: boolean;
  onItemSelect?: (item: InventoryItem) => void;
}

// ============================================
// CONSTANTS
// ============================================

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  ACTIVE: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
  INACTIVE: { bg: 'bg-gray-100 dark:bg-gray-700/50', text: 'text-gray-600 dark:text-gray-400' },
  LOW_STOCK: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300' },
  OUT_OF_STOCK: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
};

// ============================================
// SUB-COMPONENTS
// ============================================

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config = STATUS_COLORS[status] || STATUS_COLORS.ACTIVE;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {status}
    </span>
  );
};

const LoadingSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="animate-pulse bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            <div className="flex-1">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            </div>
          </div>
          <div className="mt-3 flex justify-between">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export function InventoryList({
  className = '',
  compact = false,
  showFilters = true,
  showActions = true,
  onItemSelect,
}: InventoryListProps) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { hasPermission } = usePermission();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortField, setSortField] = useState<'name' | 'quantity' | 'unitPrice' | 'createdAt'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId ||
    (user?.businessUnits?.[0] as any)?.id ||
    localStorage.getItem('businessUnitId') || '';

  const canManage = hasPermission(`${PermissionResource.INVENTORY}:manage`) || user?.role === 'SUPER_ADMIN';
  const canCreate = hasPermission(`${PermissionResource.INVENTORY}:create`) || user?.role === 'SUPER_ADMIN';
  const canEdit = hasPermission(`${PermissionResource.INVENTORY}:edit`) || user?.role === 'SUPER_ADMIN';
  const canDelete = hasPermission(`${PermissionResource.INVENTORY}:delete`) || user?.role === 'SUPER_ADMIN';
  const canExport = hasPermission(`${PermissionResource.INVENTORY}:export`) || user?.role === 'SUPER_ADMIN';

  // ============================================
  // DATA LOADING
  // ============================================

  const loadItems = useCallback(async () => {
    if (!businessUnitId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // ✅ FIXED: Removed 'supplier' from params (not in GetInventoryParams)
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        sortBy: sortField,
        sortOrder: sortOrder,
        businessUnitId,
      };

      if (searchQuery) params.search = searchQuery;
      if (categoryFilter) params.category = categoryFilter;
      if (locationFilter) params.location = locationFilter;
      if (statusFilter === 'low_stock') params.lowStock = true;
      else if (statusFilter === 'out_of_stock') params.inStock = false;
      else if (statusFilter === 'active') params.status = 'active';
      else if (statusFilter === 'inactive') params.status = 'inactive';

      const response = await inventoryService.getInventory(params);

      // ✅ FIXED: Use response.inventory instead of response.data
      const inventoryItems = response?.inventory || response?.items || [];

      // Normalize items
      const normalizedItems = inventoryItems.map((item: any) => ({
        id: item.id || item.productId || '',
        productId: item.productId || item.product?.id || null,
        product: item.product || null,
        variantId: item.variantId || null,
        variant: item.variant || null,
        name: item.name || item.product?.name || 'Unknown',
        sku: item.sku || item.product?.sku || 'N/A',
        barcode: item.barcode || item.product?.barcode || null,
        quantity: item.quantity || item.stock || 0,
        reserved: item.reserved || 0,
        available: (item.quantity || item.stock || 0) - (item.reserved || 0),
        unitPrice: item.unitPrice || item.price || item.product?.unitPrice || 0,
        costPrice: item.costPrice || item.product?.costPrice || 0,
        category: item.category || item.product?.category?.name || 'Uncategorized',
        categoryId: item.categoryId || item.product?.category?.id || null,
        supplier: item.supplier || item.product?.supplier?.name || null,
        supplierId: item.supplierId || item.product?.supplier?.id || null,
        reorderPoint: item.reorderPoint || 5,
        location: item.location || 'Warehouse',
        notes: item.notes || null,
        hasProduct: !!item.product,
        images: (item.images && item.images.length > 0) ? item.images : (item.product?.images || []),
        description: item.description || item.product?.description || null,
        weight: item.weight || item.product?.weight || 0,
        taxRate: item.taxRate || item.product?.taxRate || 0,
        tags: (item.tags && item.tags.length > 0) ? item.tags : (item.product?.tags || []),
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || new Date().toISOString(),
        status: item.status || 'ACTIVE',
        businessUnitId: item.businessUnitId || businessUnitId,
        maxStock: item.maxStock || item.reorderQuantity || 100,
        minStock: item.minStock || item.reorderPoint || 5,
        stock: item.quantity || item.stock || 0,
        price: item.unitPrice || item.price || 0,
        isActive: item.isActive !== false,
        isDigital: item.isDigital || false,
        featured: item.featured || false,
        reorderQuantity: item.reorderQuantity || 10,
      }));

      setItems(normalizedItems);
      setFilteredItems(normalizedItems);

      // Extract categories and locations for filters
      const uniqueCategories = Array.from(new Set(normalizedItems.map(i => i.category).filter(Boolean)));
      const uniqueLocations = Array.from(new Set(normalizedItems.map(i => i.location).filter(Boolean)));
      setCategories(uniqueCategories);
      setLocations(uniqueLocations);

      setPagination(prev => ({
        ...prev,
        total: response?.total || normalizedItems.length,
        totalPages: response?.totalPages || 1,
      }));

    } catch (error: any) {
      console.error('Failed to load inventory:', error);
      setError(error?.message || 'Failed to load inventory');
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessUnitId, pagination.page, pagination.limit, sortField, sortOrder, searchQuery, categoryFilter, locationFilter, statusFilter]);

  // ============================================
  // FILTERING
  // ============================================

  const applyFilters = useCallback(() => {
    let filtered = items;

    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query) ||
        (item.barcode && item.barcode.toLowerCase().includes(query))
      );
    }

    // Category
    if (categoryFilter) {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }

    // Location
    if (locationFilter) {
      filtered = filtered.filter(item => item.location === locationFilter);
    }

    // Status
    if (statusFilter) {
      if (statusFilter === 'low_stock') {
        filtered = filtered.filter(item => item.quantity > 0 && item.quantity <= item.reorderPoint);
      } else if (statusFilter === 'out_of_stock') {
        filtered = filtered.filter(item => item.quantity === 0);
      } else if (statusFilter === 'active') {
        filtered = filtered.filter(item => item.isActive !== false);
      } else if (statusFilter === 'inactive') {
        filtered = filtered.filter(item => item.isActive === false);
      }
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any = a[sortField as keyof InventoryItem];
      let bVal: any = b[sortField as keyof InventoryItem];

      if (aVal === undefined || aVal === null) aVal = 0;
      if (bVal === undefined || bVal === null) bVal = 0;

      if (typeof aVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    setFilteredItems(filtered);
  }, [items, searchQuery, categoryFilter, locationFilter, statusFilter, sortField, sortOrder]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // ============================================
  // CRUD OPERATIONS
  // ============================================

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadItems();
    toast.success('Inventory refreshed');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      await inventoryService.deleteInventoryItem(id, businessUnitId);
      toast.success('Item deleted successfully');
      await loadItems();
    } catch (error: any) {
      console.error('Failed to delete item:', error);
      toast.error(error?.message || 'Failed to delete item');
    }
  };

  const handleExport = async () => {
    if (!canExport) {
      toast.error('You do not have permission to export inventory');
      return;
    }

    try {
      await inventoryService.exportInventory(businessUnitId, 'csv');
      toast.success('Inventory exported successfully');
    } catch (error: any) {
      console.error('Failed to export:', error);
      toast.error(error?.message || 'Failed to export inventory');
    }
  };

  // ✅ FIXED: Added missing handleAdjustStock function
  const handleAdjustStock = async (id: string, quantity: number) => {
    try {
      await inventoryService.updateStock(id, {
        quantity,
        transactionType: 'ADJUSTMENT',
        notes: 'Manual adjustment from inventory list',
      });
      toast.success('Stock adjusted successfully');
      await loadItems();
    } catch (error: any) {
      console.error('Failed to adjust stock:', error);
      toast.error(error?.message || 'Failed to adjust stock');
    }
  };

  // ============================================
  // PERMISSION GUARD
  // ============================================

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Please Login</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">You need to be logged in to view inventory.</p>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  if (loading && !refreshing) {
    return <LoadingSkeleton count={compact ? 4 : 6} />;
  }

  const hasActiveFilters = searchQuery || categoryFilter || locationFilter || statusFilter;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Inventory Items
          </h3>
          <span className="text-xs text-gray-400">({filteredItems.length} items)</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          {showFilters && (
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`p-1.5 border rounded-lg transition-colors ${
                showFilterPanel || hasActiveFilters
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                  : ''
              }`}
            >
              <Filter className="w-4 h-4" />
            </button>
          )}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1 rounded transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1 rounded transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
          {canExport && (
            <button
              onClick={handleExport}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5 text-sm"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          )}
          {canCreate && (
            <button
              onClick={() => router.push('/admin/inventory/add')}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5 text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && showFilterPanel && (
        <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[150px] relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Locations</option>
              {locations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="low_stock">Low Stock</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as any)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="name">Sort by Name</option>
              <option value="quantity">Sort by Quantity</option>
              <option value="unitPrice">Sort by Price</option>
              <option value="createdAt">Sort by Date</option>
            </select>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('');
                  setLocationFilter('');
                  setStatusFilter('');
                }}
                className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Items Display */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
          <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500 dark:text-gray-400">No inventory items found</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {hasActiveFilters ? 'Try adjusting your filters' : 'Add your first inventory item'}
          </p>
          {canCreate && !hasActiveFilters && (
            <button
              onClick={() => router.push('/admin/inventory/add')}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Add Item →
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const hasImage = (item.images && item.images.length > 0);
            const imageUrl = hasImage ? item.images[0] : null;

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/admin/inventory/${item.id}`)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Package className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">SKU: {item.sku}</p>
                    {item.barcode && (
                      <p className="text-xs text-gray-400 font-mono">Barcode: {item.barcode}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                      <span className="text-gray-600 dark:text-gray-400">{item.category}</span>
                      <span className="text-gray-300 dark:text-gray-600">|</span>
                      <span className="text-gray-600 dark:text-gray-400">{item.location}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold ${
                      item.quantity === 0 ? 'text-red-600 dark:text-red-400' :
                      item.quantity <= item.reorderPoint ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-green-600 dark:text-green-400'
                    }`}>
                      {item.quantity} units
                    </span>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      {formatCurrency(item.unitPrice)}
                    </span>
                  </div>
                  <StatusBadge status={item.status || 'ACTIVE'} />
                </div>

                {showActions && canManage && (
                  <div className="mt-2 flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => router.push(`/admin/inventory/${item.id}`)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      title="View"
                    >
                      <Eye className="w-4 h-4 text-gray-500" />
                    </button>
                    {canEdit && (
                      <button
                        onClick={() => router.push(`/admin/inventory/${item.id}/edit`)}
                        className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4 text-blue-500" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">Barcode</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  {showActions && canManage && (
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/admin/inventory/${item.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                          {(item.images && item.images.length > 0) ? (
                            <img
                              src={item.images[0]}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <Package className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-mono hidden sm:table-cell">
                      {item.sku}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-mono hidden lg:table-cell">
                      {item.barcode || '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-medium ${
                        item.quantity === 0 ? 'text-red-600 dark:text-red-400' :
                        item.quantity <= item.reorderPoint ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-green-600 dark:text-green-400'
                      }`}>
                        {item.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400 hidden md:table-cell">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                      {item.category}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status || 'ACTIVE'} />
                    </td>
                    {showActions && canManage && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => router.push(`/admin/inventory/${item.id}`)}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4 text-gray-500" />
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => router.push(`/admin/inventory/${item.id}/edit`)}
                              className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4 text-blue-500" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Showing {filteredItems.length} of {pagination.total} items
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              disabled={pagination.page <= 1}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// EXPORT
// ============================================

export default InventoryList;
