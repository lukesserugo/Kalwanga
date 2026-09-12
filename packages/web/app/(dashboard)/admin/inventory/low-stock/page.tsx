// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\inventory\low-stock\page.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Package, RefreshCw, ShoppingCart,
  Search, Filter, Download, Eye, Edit, Trash2,
  ChevronLeft, ChevronRight, X, Check, Loader2,
  Building, User, Calendar, ArrowRight, AlertCircle,
  Lock, Shield, Plus, Minus, Truck, Clock,
  DollarSign, Tag, MapPin, Phone, Mail,
  Globe, Star, Award, Archive, CalendarDays,
  Hash, Weight, Percent, Image as ImageIcon,
  Link2, Copy, Printer, ExternalLink, MoreVertical
} from 'lucide-react';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermission } from '../../../../../hooks/usePermission';
import { inventoryService } from '../../../../../services/inventoryService';
import { purchaseOrderService } from '../../../../../services/purchaseOrderService';
import { toast } from '../../../../../utils/toast-manager';
import { formatCurrency, formatDate, formatNumber } from '../../../../../utils/formatters';
import { PermissionResource } from '../../../../../types/enums';

// ============================================
// TYPES
// ============================================

interface InventoryItem {
  id: string;
  productId: string;
  product?: {
    id: string;
    name: string;
    sku: string;
    unitPrice: number;
    costPrice?: number;
    images?: string[];
    category?: { id: string; name: string };
    supplier?: { id: string; name: string };
    description?: string;
    weight?: number;
    taxRate?: number;
  };
  quantity: number;
  reserved: number;
  available?: number;
  reorderPoint: number;
  reorderQuantity: number;
  location?: string;
  supplier?: string;
  supplierId?: string;
  status: string;
  unit?: string;
  isActive?: boolean;
  isDigital?: boolean;
  featured?: boolean;
  tags?: string[];
  images?: string[];
  description?: string;
  weight?: number;
  taxRate?: number;
  expiryDate?: string;
  batchNumber?: string;
}

interface RestockData {
  quantity: number;
  supplier: string;
  unitPrice: number;
  purchaseDate: string;
  notes: string;
}

interface FilterOptions {
  search: string;
  status: 'all' | 'low' | 'out' | 'critical';
  location: string;
  supplier: string;
  category: string;
}

// ============================================
// CONSTANTS
// ============================================

const STATUS_FILTERS = [
  { value: 'all', label: 'All', icon: Package },
  { value: 'low', label: 'Low Stock', icon: AlertTriangle },
  { value: 'out', label: 'Out of Stock', icon: AlertCircle },
  { value: 'critical', label: 'Critical', icon: AlertCircle },
];

// ============================================
// SUB-COMPONENTS
// ============================================

const StatusBadge: React.FC<{ item: InventoryItem }> = ({ item }) => {
  const quantity = item.quantity || 0;
  const reorderPoint = item.reorderPoint || 5;
  const isActive = item.isActive !== false;

  if (!isActive) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
        Inactive
      </span>
    );
  }

  if (quantity === 0) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        Out of Stock
      </span>
    );
  }

  const ratio = quantity / reorderPoint;
  if (ratio <= 0.3) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        Critical
      </span>
    );
  }

  if (quantity <= reorderPoint) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        Low Stock
      </span>
    );
  }

  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 flex items-center gap-1">
      <Check className="w-3 h-3" />
      In Stock
    </span>
  );
};

const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  subtext?: string;
}> = ({ label, value, icon: Icon, color, subtext }) => {
  const colorClasses: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400' },
    green: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400' },
    yellow: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-600 dark:text-yellow-400' },
    red: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400' },
    indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-600 dark:text-indigo-400' },
    teal: { bg: 'bg-teal-50 dark:bg-teal-900/20', text: 'text-teal-600 dark:text-teal-400' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400' },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${colorClasses[color]?.bg || colorClasses.blue.bg} rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className={`text-2xl font-bold ${colorClasses[color]?.text || colorClasses.blue.text} mt-1`}>
            {value}
          </p>
          {subtext && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtext}</p>}
        </div>
        <div className={`p-2 rounded-lg bg-white dark:bg-gray-700/50`}>
          <Icon className={`w-5 h-5 ${colorClasses[color]?.text || colorClasses.blue.text}`} />
        </div>
      </div>
    </motion.div>
  );
};

const LoadingSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <div className="space-y-3">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="animate-pulse flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="flex-1">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
          </div>
          <div className="w-16 h-6 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="w-24 h-8 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      ))}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function LowStockPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { hasPermission } = usePermission();
  
  // Refs
  const initialLoadRef = useRef(false);
  const loadDataRef = useRef(false);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    status: 'all',
    location: '',
    supplier: '',
    category: '',
  });
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [generatingPO, setGeneratingPO] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [restockData, setRestockData] = useState<RestockData>({
    quantity: 1,
    supplier: '',
    unitPrice: 0,
    purchaseDate: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || 
                          (user?.businessUnits?.[0] as any)?.id || 
                          localStorage.getItem('businessUnitId') || '';

  const canViewInventory = hasPermission(`${PermissionResource.INVENTORY}:view`) || user?.role === 'SUPER_ADMIN';
  const canManageInventory = hasPermission(`${PermissionResource.INVENTORY}:manage`) || user?.role === 'SUPER_ADMIN';
  const canCreatePO = hasPermission(`${PermissionResource.INVENTORY}:create`) || user?.role === 'SUPER_ADMIN';


  // ============================================
  // PERMISSION GUARD
  // ============================================

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Please Login</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">You need to be logged in to view low stock items.</p>
      </div>
    );
  }

  if (!canViewInventory) {
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
            You don't have permission to view low stock items. Please contact your administrator.
          </p>
          <button
            onClick={() => router.push('/admin/inventory')}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Inventory
          </button>
        </motion.div>
      </div>
    );
  }

  // ============================================
  // DATA LOADING
  // ============================================

  const loadLowStockItems = useCallback(async () => {
    if (loadDataRef.current) {
      console.log('⏭️ Skipping load - already loading');
      return;
    }
    
    if (!businessUnitId) {
      setLoading(false);
      return;
    }
    
    loadDataRef.current = true;
    
    try {
      setLoading(true);
      setError(null);
      
      // Load low stock items
      const data = await inventoryService.getLowStockItems(businessUnitId);
      
      // Load out of stock items as well
      const outOfStockData = await inventoryService.getOutOfStockItems(businessUnitId);
      
      // Combine and deduplicate
      const allItems = [...(data || []), ...(outOfStockData || [])];
      const uniqueItems = allItems.filter((item, index, self) => 
        index === self.findIndex(i => i.id === item.id)
      );
      
      setItems(uniqueItems);
      setFilteredItems(uniqueItems);
      initialLoadRef.current = true;
      
    } catch (error: any) {
      console.error('Failed to load low stock items:', error);
      const errorMsg = error?.message || 'Failed to load low stock items';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
      setRefreshing(false);
      loadDataRef.current = false;
    }
  }, [businessUnitId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLowStockItems();
    toast.success('Inventory refreshed');
  };

  // ============================================
  // FILTERING
  // ============================================

  const applyFilters = useCallback(() => {
    let filtered = [...items];

    // Search filter
    if (filters.search.trim()) {
      const query = filters.search.toLowerCase().trim();
      filtered = filtered.filter(item =>
        item.product?.name?.toLowerCase().includes(query) ||
        item.product?.sku?.toLowerCase().includes(query) ||
        item.supplier?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (filters.status === 'low') {
      filtered = filtered.filter(item => {
        const quantity = item.quantity || 0;
        const reorderPoint = item.reorderPoint || 5;
        return quantity > 0 && quantity <= reorderPoint;
      });
    } else if (filters.status === 'out') {
      filtered = filtered.filter(item => (item.quantity || 0) === 0);
    } else if (filters.status === 'critical') {
      filtered = filtered.filter(item => {
        const quantity = item.quantity || 0;
        const reorderPoint = item.reorderPoint || 5;
        return quantity > 0 && quantity <= reorderPoint * 0.3;
      });
    }

    // Location filter
    if (filters.location) {
      filtered = filtered.filter(item =>
        item.location?.toLowerCase().includes(filters.location.toLowerCase())
      );
    }

    // Supplier filter
    if (filters.supplier) {
      filtered = filtered.filter(item =>
        item.supplier?.toLowerCase().includes(filters.supplier.toLowerCase())
      );
    }

    // Category filter
    if (filters.category) {
      filtered = filtered.filter(item =>
        item.product?.category?.name?.toLowerCase().includes(filters.category.toLowerCase())
      );
    }

    setFilteredItems(filtered);
  }, [items, filters]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // ============================================
  // SELECTION HANDLERS
  // ============================================

  const handleSelectAll = () => {
    if (selectedItems.length === filteredItems.length && filteredItems.length > 0) {
      setSelectedItems([]);
      setShowBulkActions(false);
    } else {
      setSelectedItems(filteredItems.map(item => item.id));
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

  // ============================================
  // PURCHASE ORDER GENERATION
  // ============================================

  const handleGeneratePO = async () => {
    if (selectedItems.length === 0) {
      toast.warning('Please select items to reorder');
      return;
    }

    if (!canCreatePO) {
      toast.error('You do not have permission to create purchase orders');
      return;
    }

    setGeneratingPO(true);
    setError(null);
    try {
      const selectedInventoryItems = items.filter(item => selectedItems.includes(item.id));
      
      // Group by supplier
      const supplierGroups = new Map<string, InventoryItem[]>();
      selectedInventoryItems.forEach(item => {
        const supplierId = item.supplierId || item.supplier || 'default';
        if (!supplierGroups.has(supplierId)) {
          supplierGroups.set(supplierId, []);
        }
        supplierGroups.get(supplierId)!.push(item);
      });

      const results = [];
      for (const [supplierId, supplierItems] of supplierGroups) {
        try {
          const po = await purchaseOrderService.createPurchaseOrder({
            supplierId: supplierId,
            businessUnitId: businessUnitId,
            items: supplierItems.map(item => ({
              productId: item.productId || item.id,
              quantity: Math.max(item.reorderQuantity || 10, (item.reorderPoint || 5) - (item.quantity || 0) + 10),
              unitPrice: item.product?.costPrice || item.product?.unitPrice || 0,
            })),
            notes: 'Auto-generated from low stock alert',
          });
          results.push(po);
        } catch (err) {
          console.error(`Failed to create PO for supplier ${supplierId}:`, err);
        }
      }

      if (results.length > 0) {
        toast.success(`${results.length} purchase order(s) created successfully`);
        setSelectedItems([]);
        setShowBulkActions(false);
        await loadLowStockItems();
      } else {
        toast.error('Failed to create purchase orders');
      }
    } catch (error: any) {
      console.error('Failed to generate PO:', error);
      const errorMsg = error?.message || 'Failed to generate purchase order';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setGeneratingPO(false);
    }
  };

  // ============================================
  // RESTOCK HANDLERS
  // ============================================

  const handleRestock = async () => {
    if (!selectedItem) return;
    if (restockData.quantity <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await inventoryService.restockItem(selectedItem.id, {
        quantity: restockData.quantity,
        supplier: restockData.supplier || undefined,
        unitPrice: restockData.unitPrice || undefined,
        purchaseDate: restockData.purchaseDate || undefined,
        notes: restockData.notes || undefined,
      });
      toast.success('Item restocked successfully');
      setShowRestockModal(false);
      setSelectedItem(null);
      await loadLowStockItems();
    } catch (error: any) {
      console.error('Failed to restock:', error);
      const errorMsg = error?.message || 'Failed to restock item';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const openRestockModal = (item: InventoryItem) => {
    const quantity = item.quantity || 0;
    const reorderPoint = item.reorderPoint || 5;
    const needed = Math.max(0, reorderPoint - quantity + (item.reorderQuantity || 10));
    
    setSelectedItem(item);
    setRestockData({
      quantity: needed,
      supplier: item.supplier || '',
      unitPrice: item.product?.costPrice || item.product?.unitPrice || 0,
      purchaseDate: new Date().toISOString().split('T')[0],
      notes: `Restock due to low stock (current: ${quantity}, reorder point: ${reorderPoint})`,
    });
    setShowRestockModal(true);
  };

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    if (isAuthenticated && businessUnitId && !initialLoadRef.current) {
      loadLowStockItems();
    }
  }, [isAuthenticated, businessUnitId, loadLowStockItems]);

  // ============================================
  // RENDER
  // ============================================

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading low stock items...</p>
        </div>
      </div>
    );
  }

  const lowStockCount = items.filter(i => {
    const quantity = i.quantity || 0;
    const reorderPoint = i.reorderPoint || 5;
    return quantity > 0 && quantity <= reorderPoint;
  }).length;

  const outOfStockCount = items.filter(i => (i.quantity || 0) === 0).length;
  const criticalCount = items.filter(i => {
    const quantity = i.quantity || 0;
    const reorderPoint = i.reorderPoint || 5;
    return quantity > 0 && quantity <= reorderPoint * 0.3;
  }).length;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="p-1 hover:bg-red-100 dark:hover:bg-red-800/30 rounded transition"
          >
            <X className="w-4 h-4 text-red-600 dark:text-red-400" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <AlertTriangle className="w-7 h-7 sm:w-8 sm:h-8 text-yellow-500" />
            Low Stock Items
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {items.length} items need attention
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 border rounded-lg transition-colors ${
              showFilters || filters.search || filters.status !== 'all' || filters.location || filters.supplier || filters.category
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Filter className="w-4 h-4" />
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          {canCreatePO && (
            <button
              onClick={handleGeneratePO}
              disabled={selectedItems.length === 0 || generatingPO}
              className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1 sm:gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {generatingPO ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShoppingCart className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Generate PO</span>
              <span className="bg-blue-500 rounded-full px-1.5 py-0.5 text-xs text-white">
                {selectedItems.length}
              </span>
            </button>
          )}
        </div>
      </div>

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
              {canCreatePO && (
                <button
                  onClick={handleGeneratePO}
                  disabled={generatingPO}
                  className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors flex items-center gap-1"
                >
                  {generatingPO ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="w-4 h-4" />
                  )}
                  Generate PO
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

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Items"
          value={items.length}
          icon={Package}
          color="blue"
        />
        <StatCard
          label="Low Stock"
          value={lowStockCount}
          icon={AlertTriangle}
          color="yellow"
          subtext={`${((lowStockCount / (items.length || 1)) * 100).toFixed(1)}% of inventory`}
        />
        <StatCard
          label="Out of Stock"
          value={outOfStockCount}
          icon={AlertCircle}
          color="red"
          subtext={`${((outOfStockCount / (items.length || 1)) * 100).toFixed(1)}% of inventory`}
        />
        <StatCard
          label="Critical"
          value={criticalCount}
          icon={AlertCircle}
          color="red"
          subtext="Below 30% of reorder point"
        />
      </div>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value as FilterOptions['status'] })}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  {STATUS_FILTERS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Filter by location..."
                  value={filters.location}
                  onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Filter by supplier..."
                  value={filters.supplier}
                  onChange={(e) => setFilters({ ...filters, supplier: e.target.value })}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {(filters.search || filters.status !== 'all' || filters.location || filters.supplier || filters.category) && (
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => {
                      setFilters({
                        search: '',
                        status: 'all',
                        location: '',
                        supplier: '',
                        category: '',
                      });
                    }}
                    className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 flex items-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    Clear Filters
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Items List */}
      {filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">All Stock Levels Are Healthy</h3>
            <p className="text-gray-500 dark:text-gray-400">No items are currently below their reorder point</p>
          </motion.div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">SKU</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Stock</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Reorder</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">Needed</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredItems.map((item) => {
                  const isSelected = selectedItems.includes(item.id);
                  const quantity = item.quantity || 0;
                  const reorderPoint = item.reorderPoint || 5;
                  const needed = Math.max(0, reorderPoint - quantity + (item.reorderQuantity || 10));
                  const ratio = quantity / reorderPoint;
                  const isCritical = ratio <= 0.3 && quantity > 0;
                  
                  return (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                        isSelected ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                      } ${isCritical ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectItem(item.id)}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                            {item.product?.images?.[0] ? (
                              <img 
                                src={item.product.images[0]} 
                                alt={item.product?.name || 'Product'} 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <Package className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white truncate max-w-[150px] sm:max-w-[200px]">
                              {item.product?.name || 'Unknown'}
                            </p>
                            <div className="flex flex-wrap items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                              {item.location && (
                                <span className="flex items-center gap-0.5">
                                  <MapPin className="w-3 h-3" />
                                  {item.location}
                                </span>
                              )}
                              {item.supplier && (
                                <span className="flex items-center gap-0.5">
                                  <Building className="w-3 h-3" />
                                  {item.supplier}
                                </span>
                              )}
                              {isCritical && (
                                <span className="text-red-600 dark:text-red-400 font-medium">• Critical</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-mono hidden md:table-cell">
                        {item.product?.sku || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium">
                        <span className={`${
                          quantity === 0 ? 'text-red-600 dark:text-red-400' :
                          isCritical ? 'text-red-600 dark:text-red-400' :
                          quantity <= reorderPoint ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-green-600 dark:text-green-400'
                        }`}>
                          {quantity}
                        </span>
                        {item.reserved && item.reserved > 0 && (
                          <span className="text-xs text-gray-400 ml-1">({item.reserved} reserved)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                        {reorderPoint}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-blue-600 dark:text-blue-400 hidden lg:table-cell">
                        {needed}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <StatusBadge item={item} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {(canManageInventory || canCreatePO) && (
                            <button
                              onClick={() => openRestockModal(item)}
                              className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                                quantity === 0 || isCritical
                                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50'
                                  : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-900/50'
                              }`}
                            >
                              {quantity === 0 ? 'Restock' : isCritical ? 'Restock' : 'Reorder'}
                            </button>
                          )}
                          <button
                            onClick={() => router.push(`/admin/inventory/${item.id}`)}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      <AnimatePresence>
        {showRestockModal && selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowRestockModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6"
            >
              <button
                onClick={() => setShowRestockModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>

              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Restock Item</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {selectedItem.product?.name}
              </p>

              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg mb-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Current Stock</span>
                    <p className="font-semibold text-gray-900 dark:text-white">{selectedItem.quantity || 0}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Reorder Point</span>
                    <p className="font-semibold text-gray-900 dark:text-white">{selectedItem.reorderPoint || 5}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Needed</span>
                    <p className="font-semibold text-blue-600 dark:text-blue-400">
                      {Math.max(0, (selectedItem.reorderPoint || 5) - (selectedItem.quantity || 0) + (selectedItem.reorderQuantity || 10))}
                    </p>
                  </div>
                  {selectedItem.reserved && selectedItem.reserved > 0 && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Reserved</span>
                      <p className="font-semibold text-yellow-600 dark:text-yellow-400">{selectedItem.reserved}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRestockData(prev => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }))}
                      disabled={submitting}
                      className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      value={restockData.quantity}
                      onChange={(e) => setRestockData({ ...restockData, quantity: parseInt(e.target.value) || 1 })}
                      min="1"
                      className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center"
                      disabled={submitting}
                    />
                    <button
                      type="button"
                      onClick={() => setRestockData(prev => ({ ...prev, quantity: prev.quantity + 1 }))}
                      disabled={submitting}
                      className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const needed = Math.max(0, (selectedItem.reorderPoint || 5) - (selectedItem.quantity || 0) + (selectedItem.reorderQuantity || 10));
                        setRestockData(prev => ({ ...prev, quantity: Math.max(1, needed) }));
                      }}
                      className="px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 transition-colors"
                    >
                      Max
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Supplier
                  </label>
                  <input
                    type="text"
                    value={restockData.supplier}
                    onChange={(e) => setRestockData({ ...restockData, supplier: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Supplier name"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Unit Price
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      value={restockData.unitPrice}
                      onChange={(e) => setRestockData({ ...restockData, unitPrice: parseFloat(e.target.value) || 0 })}
                      min="0"
                      step="0.01"
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="0.00"
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Purchase Date
                  </label>
                  <input
                    type="date"
                    value={restockData.purchaseDate}
                    onChange={(e) => setRestockData({ ...restockData, purchaseDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={restockData.notes}
                    onChange={(e) => setRestockData({ ...restockData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Additional notes..."
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowRestockModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRestock}
                  disabled={submitting || restockData.quantity <= 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {submitting ? 'Restocking...' : 'Restock Item'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
