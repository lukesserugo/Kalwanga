// D:\Projects\Kalwanga\packages\web\components\inventory\StockTransfer.tsx

'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Package, MapPin, Loader2, X, Check,
  AlertCircle, Building, Warehouse, Search, RefreshCw,
  Truck, User, Calendar, DollarSign, FileText, Clock,
  History, ChevronDown, ChevronUp, Lock, Plus, Minus,
  ArrowUp, ArrowDown, TrendingUp, TrendingDown,
  Edit, Trash2, Eye, Copy, Link, ExternalLink,
  Grid, List, LayoutGrid, Filter, ChevronRight
} from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import { toast } from '../../utils/toast-manager';
import { useAuth } from '../../hooks/useAuth';
import { usePermission } from '../../hooks/usePermission';
import { formatCurrency, formatDate, formatNumber } from '../../utils/formatters';
import { PermissionResource } from '../../types/enums';

// ============================================
// TYPES
// ============================================

interface InventoryItem {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
    sku: string;
    unitPrice: number;
    costPrice: number;
    category?: { id: string; name: string };
    images?: string[];
    description?: string;
  };
  quantity: number;
  reserved: number;
  available: number;
  location?: string;
  shelfNumber?: string;
  reorderPoint: number;
  reorderQuantity?: number;
  status: string;
  isActive?: boolean;
  isDigital?: boolean;
  featured?: boolean;
  unit?: string;
  weight?: number;
  taxRate?: number;
  tags?: string[];
}

interface TransferHistoryItem {
  id: string;
  productId: string;
  productName: string;
  productSku?: string;
  fromLocation: string;
  toLocation: string;
  quantity: number;
  notes?: string;
  reference?: string;
  createdAt: string;
  user: { id?: string; firstName: string; lastName: string; email?: string };
  businessUnitId?: string;
}

interface SearchResult {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  available: number;
  location?: string;
  image?: string;
}

interface StockTransferProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
  compact?: boolean;
  preselectProductId?: string;
}

// ============================================
// CONSTANTS
// ============================================

const LOCATIONS = [
  { value: 'Warehouse', label: 'Warehouse' },
  { value: 'Storefront', label: 'Storefront' },
  { value: 'Backroom', label: 'Backroom' },
  { value: 'Supplier', label: 'Supplier' },
  { value: 'In Transit', label: 'In Transit' },
  { value: 'Distribution Center', label: 'Distribution Center' },
  { value: 'Store A', label: 'Store A' },
  { value: 'Store B', label: 'Store B' },
  { value: 'Online Store', label: 'Online Store' },
];

// ============================================
// SUB-COMPONENTS
// ============================================

const TransferCard: React.FC<{
  transfer: TransferHistoryItem;
  onClick?: () => void;
}> = ({ transfer, onClick }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      className="px-4 py-3 hover:bg-brand-50/50 dark:hover:bg-brand-950/20 transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
            {transfer.productName}
          </p>
          {transfer.productSku && (
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              SKU: {transfer.productSku}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            <span className="flex items-center gap-0.5">
              <Warehouse className="w-3 h-3" />
              {transfer.fromLocation}
            </span>
            <ArrowRight className="w-3 h-3 flex-shrink-0 text-brand-500" />
            <span className="flex items-center gap-0.5">
              <Building className="w-3 h-3" />
              {transfer.toLocation}
            </span>
            <span className="font-medium text-gray-700 dark:text-gray-300">
              Qty: {transfer.quantity}
            </span>
            {transfer.reference && (
              <span className="font-mono text-gray-400">#{transfer.reference}</span>
            )}
          </div>
          {transfer.notes && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
              {transfer.notes}
            </p>
          )}
        </div>
        <div className="text-right text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDate(transfer.createdAt)}
          </span>
          <span className="block mt-0.5">
            by {transfer.user.firstName} {transfer.user.lastName}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export function StockTransfer({ 
  onSuccess, 
  onCancel,
  className = '',
  compact = false,
  preselectProductId,
}: StockTransferProps) {
  const { user, isAuthenticated } = useAuth();
  const { hasPermission } = usePermission();
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);
  const [inventoryDetails, setInventoryDetails] = useState<InventoryItem | null>(null);
  const [transferHistory, setTransferHistory] = useState<TransferHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    fromLocation: '',
    toLocation: '',
    quantity: 1,
    notes: '',
  });
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const canTransfer = hasPermission(`${PermissionResource.INVENTORY}:transfer`) || 
                       hasPermission(`${PermissionResource.INVENTORY}:manage`) || 
                       user?.role === 'SUPER_ADMIN';

  // Get business unit ID
  const businessUnitId = useCallback(() => {
    const units = user?.businessUnits;
    if (units && units.length > 0) {
      const firstUnit = units[0] as any;
      return firstUnit?.businessUnitId || firstUnit?.id || undefined;
    }
    const userAny = user as any;
    if (userAny?.businessUnitId && userAny.businessUnitId !== 'default') {
      return userAny.businessUnitId;
    }
    return localStorage.getItem('businessUnitId') || undefined;
  }, [user]);

  // Get user ID
  const userId = useCallback(() => {
    const userAny = user as any;
    return userAny?.id || userAny?.userId || userAny?.clerkId || undefined;
  }, [user]);

  // ============================================
  // DATA LOADING
  // ============================================

  const loadTransferHistory = useCallback(async () => {
    const buId = businessUnitId();
    if (!buId) return;
    
    setLoadingHistory(true);
    try {
      const transactions = await inventoryService.getInventoryTransactions({
        businessUnitId: buId,
        transactionType: 'TRANSFER_IN',
        limit: 50,
      });
      
      const historyItems: TransferHistoryItem[] = (transactions?.data || []).map((tx: any) => ({
        id: tx.id || '',
        productId: tx.productId || '',
        productName: tx.product?.name || 'Unknown Product',
        productSku: tx.product?.sku || 'N/A',
        fromLocation: tx.fromLocation || tx.location || 'Unknown',
        toLocation: tx.toLocation || 'Unknown',
        quantity: Math.abs(tx.quantity || 0),
        notes: tx.notes || '',
        reference: tx.reference || '',
        createdAt: tx.createdAt || new Date().toISOString(),
        user: {
          id: tx.user?.id,
          firstName: tx.user?.firstName || 'System',
          lastName: tx.user?.lastName || '',
          email: tx.user?.email,
        },
        businessUnitId: tx.businessUnitId,
      }));
      
      setTransferHistory(historyItems);
    } catch (error) {
      console.error('Failed to load transfer history:', error);
      setTransferHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [businessUnitId]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length >= 2) {
      setSearchLoading(true);
      try {
        const buId = businessUnitId();
        if (!buId) {
          setSearchResults([]);
          setSearchLoading(false);
          return;
        }
        
        const results = await inventoryService.searchInventory(query, buId);
        
        const transformedResults = (results || [])
          .filter((item: any) => item && typeof item === 'object')
          .map((item: any) => {
            const product = item.product || item;
            return {
              id: item.id || product.id || item.productId || '',
              name: item.name || product.name || 'Unknown',
              sku: item.sku || product.sku || 'N/A',
              unitPrice: item.unitPrice || product.unitPrice || item.price || product.price || 0,
              quantity: item.quantity || product.quantity || item.stock || product.stock || 0,
              available: (item.quantity || product.quantity || item.stock || product.stock || 0) - (item.reserved || product.reserved || 0),
              location: item.location || product.location || 'Warehouse',
              image: item.images?.[0] || product.images?.[0] || item.image,
            };
          })
          .filter((item: SearchResult) => item.id && item.id !== '');
        
        setSearchResults(transformedResults);
        setIsSearchOpen(transformedResults.length > 0);
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
        setIsSearchOpen(false);
      } finally {
        setSearchLoading(false);
      }
    } else {
      setSearchResults([]);
      setIsSearchOpen(false);
    }
  };

  const handleSelectItem = async (item: SearchResult) => {
    setSelectedItem(item);
    setSearchQuery('');
    setSearchResults([]);
    setIsSearchOpen(false);
    setFormErrors({});
    setTouched({});
    
    const buId = businessUnitId();
    if (!buId) {
      toast.warning('Business unit not found');
      return;
    }
    
    try {
      const details: any = await inventoryService.getInventoryItemById(item.id, buId);
      
      const mappedDetails: InventoryItem = {
        id: details?.id || item.id || '',
        productId: details?.productId || details?.product?.id || item.id || '',
        product: {
          id: details?.productId || details?.product?.id || item.id || '',
          name: details?.name || details?.product?.name || item.name || 'Unknown',
          sku: details?.sku || details?.product?.sku || item.sku || 'N/A',
          unitPrice: details?.unitPrice || details?.product?.unitPrice || item.unitPrice || 0,
          costPrice: details?.costPrice || details?.product?.costPrice || 0,
          category: details?.category || details?.product?.category ? {
            id: details?.category?.id || details?.product?.category?.id || '',
            name: details?.category?.name || details?.product?.category?.name || '',
          } : undefined,
          images: details?.images || details?.product?.images || [],
          description: details?.description || details?.product?.description,
        },
        quantity: details?.quantity || item.quantity || 0,
        reserved: details?.reserved || 0,
        available: details?.available || (details?.quantity || 0) - (details?.reserved || 0) || item.available || 0,
        location: details?.location || item.location || 'Warehouse',
        shelfNumber: details?.shelfNumber,
        reorderPoint: details?.reorderPoint || 5,
        reorderQuantity: details?.reorderQuantity,
        status: details?.status || 'active',
        isActive: details?.isActive !== false,
        isDigital: details?.isDigital || false,
        featured: details?.featured || false,
        unit: details?.unit || 'each',
        weight: details?.weight || 0,
        taxRate: details?.taxRate || 0,
        tags: details?.tags || [],
      };
      
      setInventoryDetails(mappedDetails);
      
      if (mappedDetails.location) {
        setFormData(prev => ({ ...prev, fromLocation: mappedDetails.location || '' }));
      }
      
      // Focus on quantity input
      setTimeout(() => {
        const qtyInput = document.getElementById('quantity-input');
        if (qtyInput) qtyInput.focus();
      }, 100);
      
    } catch (error) {
      console.error('Failed to load inventory details:', error);
      setInventoryDetails({
        id: item.id || '',
        productId: item.id || '',
        product: {
          id: item.id || '',
          name: item.name || 'Unknown',
          sku: item.sku || 'N/A',
          unitPrice: item.unitPrice || 0,
          costPrice: 0,
        },
        quantity: item.quantity || 0,
        reserved: 0,
        available: item.available || 0,
        location: item.location || 'Warehouse',
        reorderPoint: 5,
        status: 'active',
      });
      toast.warning('Could not load full inventory details');
    }
  };

  const handleClearSelection = () => {
    setSelectedItem(null);
    setInventoryDetails(null);
    setSearchQuery('');
    setSearchResults([]);
    setIsSearchOpen(false);
    setFormData(prev => ({ ...prev, fromLocation: '', quantity: 1 }));
    setFormErrors({});
    setTouched({});
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const buId = businessUnitId();
    const uid = userId();
    
    const errors: Record<string, string> = {};
    
    if (!selectedItem) errors.product = 'Please select a product';
    if (!formData.fromLocation) errors.fromLocation = 'Source location is required';
    if (!formData.toLocation) errors.toLocation = 'Destination location is required';
    if (formData.fromLocation === formData.toLocation) errors.locations = 'Source and destination locations must be different';
    if (formData.quantity <= 0) errors.quantity = 'Quantity must be greater than 0';
    if (!buId) errors.businessUnit = 'Business unit is not available';
    if (!uid) errors.user = 'User ID is not available';
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setTouched(Object.keys(errors).reduce((acc, key) => ({ ...acc, [key]: true }), {}));
      const firstError = Object.values(errors)[0];
      toast.error(firstError);
      return;
    }
    
    const availableStock = selectedItem?.available || inventoryDetails?.available || 0;
    if (formData.quantity > availableStock) {
      setFormErrors({ ...formErrors, quantity: `Not enough stock. Available: ${availableStock}` });
      toast.error(`Not enough stock available. Available: ${availableStock}`);
      return;
    }

    setLoading(true);
    try {
      await inventoryService.transferStock({
        productId: selectedItem!.id,
        fromLocation: formData.fromLocation,
        toLocation: formData.toLocation,
        quantity: formData.quantity,
        notes: formData.notes || undefined,
        businessUnitId: buId!,
      });
      
      toast.success('Stock transferred successfully');
      
      setSelectedItem(null);
      setInventoryDetails(null);
      setFormData({ fromLocation: '', toLocation: '', quantity: 1, notes: '' });
      setFormErrors({});
      setTouched({});
      
      await loadTransferHistory();
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Transfer failed:', error);
      let errorMessage = 'Failed to transfer stock';
      if (error?.response?.data?.message) errorMessage = error.response.data.message;
      else if (error?.message) errorMessage = error.message;
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getAvailableStock = (): number => {
    return selectedItem?.available || inventoryDetails?.available || 0;
  };

  // Close search results on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load history on mount
  useEffect(() => {
    if (isAuthenticated) {
      loadTransferHistory();
    }
  }, [isAuthenticated, loadTransferHistory]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery && searchQuery.length >= 2) {
        handleSearch(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Pre-select product if provided
  useEffect(() => {
    if (preselectProductId) {
      const preselectedItem: SearchResult = {
        id: preselectProductId,
        name: 'Selected Product',
        sku: 'Loading...',
        unitPrice: 0,
        quantity: 0,
        available: 0,
        location: 'Warehouse',
      };
      setSelectedItem(preselectedItem);
      // Fetch details
      const buId = businessUnitId();
      if (buId) {
        inventoryService.getInventoryItemById(preselectProductId, buId)
          .then((details: any) => {
            if (details) {
              handleSelectItem({
                id: details.id || preselectProductId,
                name: details.name || 'Product',
                sku: details.sku || 'N/A',
                unitPrice: details.unitPrice || 0,
                quantity: details.quantity || 0,
                available: (details.quantity || 0) - (details.reserved || 0),
                location: details.location || 'Warehouse',
              });
            }
          })
          .catch(() => {
            toast.warning('Could not load preselected product');
          });
      }
    }
  }, [preselectProductId]);

  // Permission check
  if (!canTransfer) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Access Denied</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          You don't have permission to transfer stock.
        </p>
        <button 
          onClick={() => router.push('/admin/inventory')} 
          className="mt-4 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors focus-ring"
        >
          Back to Inventory
        </button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Please Login</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">You need to be logged in to transfer stock.</p>
        <button 
          onClick={() => router.push('/login')} 
          className="mt-4 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors focus-ring"
        >
          Go to Login
        </button>
      </div>
    );
  }

  const availableStock = getAvailableStock();

  return (
    <div className={`max-w-4xl mx-auto ${className}`}>
      <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden ${compact ? 'p-4' : ''}`}>
        {/* Header */}
        <div className={`${compact ? 'px-0 pb-3' : 'px-6 py-4'} border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3`}>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Truck className="w-6 h-6 text-brand-500" />
              Transfer Stock
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Move inventory between locations</p>
          </div>
          <button
            type="button"
            onClick={() => { 
              setShowHistory(!showHistory); 
              if (!showHistory) loadTransferHistory(); 
            }}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors flex items-center gap-1.5 text-sm focus-ring"
          >
            <History className="w-4 h-4" />
            {showHistory ? 'Hide History' : 'View History'}
            {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        <form onSubmit={handleSubmit} className={`${compact ? 'p-4' : 'p-6'} space-y-6`}>
          {/* Product Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Product <span className="text-brand-accent-500">*</span>
            </label>
            <div className="relative" ref={searchRef}>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search by name or SKU..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => searchResults.length > 0 && setIsSearchOpen(true)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 transition-colors"
                    disabled={!!selectedItem || loading}
                  />
                  {searchLoading && (
                    <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-brand-500" />
                  )}
                </div>
                {selectedItem && (
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="px-3 py-2 bg-brand-accent-50 dark:bg-brand-accent-950/30 text-brand-accent-600 dark:text-brand-accent-400 rounded-lg hover:bg-brand-accent-100 dark:hover:bg-brand-accent-950/50 transition-colors focus-ring"
                    disabled={loading}
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              
              <AnimatePresence>
                {isSearchOpen && searchResults.length > 0 && !selectedItem && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto custom-scrollbar"
                  >
                    {searchResults.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectItem(item)}
                        className="w-full px-4 py-2 text-left hover:bg-brand-50 dark:hover:bg-brand-950/30 flex items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gray-100 dark:bg-gray-600 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                              {item.image ? (
                                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                              ) : (
                                <Package className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">SKU: {item.sku}</p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm text-gray-500 dark:text-gray-400">{formatCurrency(item.unitPrice)}</p>
                          <p className={`text-xs ${item.available > 0 ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'}`}>
                            Available: {item.available}
                          </p>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {formErrors.product && touched.product && (
              <p className="mt-1 text-sm text-danger-600 dark:text-danger-400">{formErrors.product}</p>
            )}

            {selectedItem && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 p-4 bg-brand-50 dark:bg-brand-950/20 rounded-lg border border-brand-200 dark:border-brand-800"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {inventoryDetails?.product?.images?.[0] && (
                        <img 
                          src={inventoryDetails.product.images[0]} 
                          alt={selectedItem.name} 
                          className="w-10 h-10 rounded-lg object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{selectedItem.name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">SKU: {selectedItem.sku}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Price: {formatCurrency(selectedItem.unitPrice)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Available Stock</p>
                    <p className={`text-lg font-bold tabular-nums ${
                      availableStock === 0 ? 'text-danger-600 dark:text-danger-400' : 
                      availableStock <= (inventoryDetails?.reorderPoint || 5) ? 'text-warning-600 dark:text-warning-400' : 
                      'text-success-600 dark:text-success-400'
                    }`}>
                      {availableStock} {inventoryDetails?.unit || 'units'}
                    </p>
                  </div>
                </div>
                {inventoryDetails && (
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      Location: {inventoryDetails.location || 'Warehouse'}
                    </span>
                    {inventoryDetails.reserved > 0 && (
                      <span className="text-warning-600 dark:text-warning-400">
                        ({inventoryDetails.reserved} reserved)
                      </span>
                    )}
                    <span className="ml-2">Reorder Point: {inventoryDetails.reorderPoint}</span>
                    {inventoryDetails.shelfNumber && (
                      <span>Shelf: {inventoryDetails.shelfNumber}</span>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Locations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                From Location <span className="text-brand-accent-500">*</span>
              </label>
              <div className="relative">
                <Warehouse className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <select
                  value={formData.fromLocation}
                  onChange={(e) => {
                    setFormData({ ...formData, fromLocation: e.target.value });
                    setTouched({ ...touched, fromLocation: true });
                    if (formErrors.fromLocation) {
                      setFormErrors({ ...formErrors, fromLocation: '' });
                    }
                  }}
                  onBlur={() => setTouched({ ...touched, fromLocation: true })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 transition-colors"
                  disabled={loading || !selectedItem}
                  required
                >
                  <option value="">Select source location</option>
                  {LOCATIONS.map((loc) => (
                    <option key={loc.value} value={loc.value}>{loc.label}</option>
                  ))}
                </select>
              </div>
              {formErrors.fromLocation && touched.fromLocation && (
                <p className="mt-1 text-sm text-danger-600 dark:text-danger-400">{formErrors.fromLocation}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                To Location <span className="text-brand-accent-500">*</span>
              </label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <select
                  value={formData.toLocation}
                  onChange={(e) => {
                    setFormData({ ...formData, toLocation: e.target.value });
                    setTouched({ ...touched, toLocation: true });
                    if (formErrors.toLocation) {
                      setFormErrors({ ...formErrors, toLocation: '' });
                    }
                    if (formErrors.locations) {
                      setFormErrors({ ...formErrors, locations: '' });
                    }
                  }}
                  onBlur={() => setTouched({ ...touched, toLocation: true })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 transition-colors"
                  disabled={loading || !selectedItem}
                  required
                >
                  <option value="">Select destination location</option>
                  {LOCATIONS.map((loc) => (
                    <option key={loc.value} value={loc.value}>{loc.label}</option>
                  ))}
                </select>
              </div>
              {formErrors.toLocation && touched.toLocation && (
                <p className="mt-1 text-sm text-danger-600 dark:text-danger-400">{formErrors.toLocation}</p>
              )}
              {formErrors.locations && (
                <p className="mt-1 text-sm text-danger-600 dark:text-danger-400">{formErrors.locations}</p>
              )}
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Quantity to Transfer <span className="text-brand-accent-500">*</span>
            </label>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }))}
                  disabled={loading || !selectedItem || formData.quantity <= 1}
                  className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-600 hover:border-brand-300 dark:hover:border-brand-700 transition-colors disabled:opacity-50 focus-ring"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  id="quantity-input"
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setFormData({ ...formData, quantity: Math.max(0, val) });
                    setTouched({ ...touched, quantity: true });
                    if (formErrors.quantity) {
                      setFormErrors({ ...formErrors, quantity: '' });
                    }
                  }}
                  onBlur={() => setTouched({ ...touched, quantity: true })}
                  min="1"
                  max={availableStock || 0}
                  className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 text-center tabular-nums transition-colors"
                  required
                  disabled={loading || !selectedItem}
                />
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, quantity: Math.min(availableStock || 999, prev.quantity + 1) }))}
                  disabled={loading || !selectedItem || formData.quantity >= (availableStock || 0)}
                  className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-600 hover:border-brand-300 dark:hover:border-brand-700 transition-colors disabled:opacity-50 focus-ring"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {inventoryDetails && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Max: {availableStock}
                </span>
              )}
              {availableStock > 0 && (
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, quantity: availableStock }))}
                  className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors focus-ring"
                  disabled={loading || !selectedItem}
                >
                  Max
                </button>
              )}
            </div>
            {formData.quantity > availableStock && (
              <p className="mt-1 text-sm text-danger-600 dark:text-danger-400 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                Not enough stock available. Max: {availableStock}
              </p>
            )}
            {formErrors.quantity && touched.quantity && (
              <p className="mt-1 text-sm text-danger-600 dark:text-danger-400">{formErrors.quantity}</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes <span className="text-gray-400 text-xs font-normal">(optional)</span>
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 resize-y transition-colors"
              placeholder="Reason for transfer..."
              disabled={loading || !selectedItem}
            />
          </div>

          {/* Business Unit Info */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/30 p-2 rounded-lg">
            <span className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${businessUnitId() ? 'bg-success-500' : 'bg-danger-500'}`} />
              {businessUnitId() ? `Business Unit: ${businessUnitId()?.slice(0, 8)}...` : '⚠️ No business unit selected'}
            </span>
            <span className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${userId() ? 'bg-brand-500' : 'bg-danger-500'}`} />
              {userId() ? `User: ${userId()?.slice(0, 8)}...` : '⚠️ No user ID'}
            </span>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-warning-500 dark:text-warning-400 flex-shrink-0" />
              <span>Stock will be deducted from source and added to destination</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 focus-ring"
                  disabled={loading}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={
                  loading || 
                  !selectedItem || 
                  formData.quantity <= 0 || 
                  formData.fromLocation === formData.toLocation || 
                  !businessUnitId() ||
                  formData.quantity > availableStock
                }
                className="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-ring shadow-brand"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Transferring...</>
                ) : (
                  <><ArrowRight className="w-4 h-4" />Transfer Stock</>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Transfer History */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-brand-500" />
                  Transfer History
                </h3>
                <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                  {transferHistory.length} transfers
                </span>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-80 overflow-y-auto custom-scrollbar">
                {loadingHistory ? (
                  <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-500" />
                    Loading history...
                  </div>
                ) : transferHistory.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    <Package className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p>No transfer history yet</p>
                    <p className="text-xs mt-1">Transfers will appear here</p>
                  </div>
                ) : (
                  transferHistory.map((transfer) => (
                    <TransferCard
                      key={transfer.id}
                      transfer={transfer}
                      onClick={() => {
                        if (transfer.productId) {
                          router.push(`/admin/inventory/${transfer.productId}`);
                        }
                      }}
                    />
                  ))
                )}
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

export default StockTransfer;

