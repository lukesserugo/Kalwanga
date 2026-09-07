'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, Package, MapPin, Loader2, X, Check,
  AlertCircle, Building, Warehouse, Search, RefreshCw,
  Truck, User, Calendar, DollarSign, FileText, Clock,
  History, ChevronDown, ChevronUp, Lock
} from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import { toast } from '../../utils/toast-manager';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency, formatDate } from '../../utils/formatters';

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
  };
  quantity: number;
  reserved: number;
  available: number;
  location?: string;
  reorderPoint: number;
  status: string;
}

interface TransferHistoryItem {
  id: string;
  productId: string;
  productName: string;
  fromLocation: string;
  toLocation: string;
  quantity: number;
  notes?: string;
  createdAt: string;
  user: { firstName: string; lastName: string };
}

interface SearchResult {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  available: number;
  location?: string;
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
// MAIN COMPONENT
// ============================================

export function StockTransfer({ onSuccess }: { onSuccess?: () => void }) {
  const { user, isAuthenticated } = useAuth();
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
  
  const [formData, setFormData] = useState({
    fromLocation: '',
    toLocation: '',
    quantity: 1,
    notes: '',
  });
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // FIXED: Get business unit ID - handles both businessUnitId and id on units
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
    return undefined;
  }, [user]);

  // FIXED: Get user ID
  const userId = useCallback(() => {
    const userObj = user as any;
    return userObj?.id || userObj?.userId || userObj?.clerkId || undefined;
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
        fromLocation: 'Unknown',
        toLocation: 'Unknown',
        quantity: Math.abs(tx.quantity || 0),
        notes: tx.notes || '',
        createdAt: tx.createdAt || new Date().toISOString(),
        user: {
          firstName: tx.user?.firstName || 'System',
          lastName: tx.user?.lastName || '',
        },
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
        
        // FIXED: Transform with null filtering and proper type casting
        const transformedResults = (results || [])
          .map((item: any): SearchResult | null => {
            if (typeof item === 'string' || item === null || item === undefined) {
              return null;
            }
            const product = item.product || item;
            return {
              id: item.id || product.id || item.productId || '',
              name: item.name || product.name || 'Unknown',
              sku: item.sku || product.sku || 'N/A',
              unitPrice: item.unitPrice || product.unitPrice || item.price || product.price || 0,
              quantity: item.quantity || product.quantity || item.stock || product.stock || 0,
              available: (item.quantity || product.quantity || item.stock || product.stock || 0) - (item.reserved || product.reserved || 0),
              location: item.location || product.location || 'Warehouse',
            };
          })
          .filter((item): item is SearchResult => item !== null) as SearchResult[];
        
        setSearchResults(transformedResults);
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    } else {
      setSearchResults([]);
    }
  };

  // FIXED: handleSelectItem - item is properly typed as SearchResult
  const handleSelectItem = async (item: SearchResult) => {
    setSelectedItem(item);
    setSearchQuery('');
    setSearchResults([]);
    setFormErrors({});
    
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
        },
        quantity: details?.quantity || item.quantity || 0,
        reserved: details?.reserved || 0,
        available: details?.available || (details?.quantity || 0) - (details?.reserved || 0) || item.available || 0,
        location: details?.location || item.location || 'Warehouse',
        reorderPoint: details?.reorderPoint || 5,
        status: details?.status || 'active',
      };
      
      setInventoryDetails(mappedDetails);
      
      if (mappedDetails.location) {
        setFormData(prev => ({ ...prev, fromLocation: mappedDetails.location || '' }));
      }
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
      const firstError = Object.values(errors)[0];
      toast.error(firstError);
      return;
    }
    
    const availableStock = selectedItem?.available || inventoryDetails?.available || 0;
    if (formData.quantity > availableStock) {
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
      
      loadTransferHistory();
      
      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/admin/inventory');
        router.refresh();
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

  const handleClearSelection = () => {
    setSelectedItem(null);
    setInventoryDetails(null);
    setSearchQuery('');
    setSearchResults([]);
    setFormData(prev => ({ ...prev, fromLocation: '', quantity: 1 }));
    setFormErrors({});
  };

  useEffect(() => {
    if (isAuthenticated) loadTransferHistory();
  }, [isAuthenticated, loadTransferHistory]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery && searchQuery.length >= 2) handleSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4"><Lock className="w-8 h-8 text-gray-400" /></div>
        <h3 className="text-lg font-semibold">Please Login</h3>
        <p className="text-gray-500 mt-1">You need to be logged in to transfer stock.</p>
        <button onClick={() => router.push('/login')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">Go to Login</button>
      </div>
    );
  }

  const getAvailableStock = (): number => {
    return selectedItem?.available || inventoryDetails?.available || 0;
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Truck className="w-6 h-6 text-blue-500" /> Transfer Stock
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Move inventory between locations</p>
          </div>
          <button type="button" onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadTransferHistory(); }} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-sm">
            <History className="w-4 h-4" /> {showHistory ? 'Hide History' : 'View History'} {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Product Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Product <span className="text-red-500">*</span></label>
            <div className="relative">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input type="text" placeholder="Search by name or SKU..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50" disabled={!!selectedItem || loading} />
                  {searchLoading && <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />}
                </div>
                {selectedItem && <button type="button" onClick={handleClearSelection} className="px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors" disabled={loading}><X className="w-5 h-5" /></button>}
              </div>
              
              {searchResults.length > 0 && !selectedItem && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                  {searchResults.map((item) => (
                    <button key={item.id} type="button" onClick={() => handleSelectItem(item)} className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">SKU: {item.sku}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm text-gray-500 dark:text-gray-400">{formatCurrency(item.unitPrice)}</p>
                        <p className={`text-xs ${item.available > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>Available: {item.available}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {formErrors.product && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.product}</p>}

            {selectedItem && (
              <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white">{selectedItem.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">SKU: {selectedItem.sku}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Price: {formatCurrency(selectedItem.unitPrice)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Available Stock</p>
                    <p className={`text-lg font-bold ${getAvailableStock() === 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{getAvailableStock()}</p>
                  </div>
                </div>
                {inventoryDetails && (
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Location: {inventoryDetails.location || 'Warehouse'} {inventoryDetails.reserved > 0 && `(${inventoryDetails.reserved} reserved)`} <span className="ml-2">Reorder Point: {inventoryDetails.reorderPoint}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Locations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">From Location <span className="text-red-500">*</span></label>
              <div className="relative">
                <Warehouse className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <select value={formData.fromLocation} onChange={(e) => setFormData({ ...formData, fromLocation: e.target.value })} className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50" disabled={loading || !selectedItem} required>
                  <option value="">Select source location</option>
                  {LOCATIONS.map((loc) => <option key={loc.value} value={loc.value}>{loc.label}</option>)}
                </select>
              </div>
              {formErrors.fromLocation && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.fromLocation}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">To Location <span className="text-red-500">*</span></label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <select value={formData.toLocation} onChange={(e) => setFormData({ ...formData, toLocation: e.target.value })} className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50" disabled={loading || !selectedItem} required>
                  <option value="">Select destination location</option>
                  {LOCATIONS.map((loc) => <option key={loc.value} value={loc.value}>{loc.label}</option>)}
                </select>
              </div>
              {formErrors.toLocation && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.toLocation}</p>}
              {formErrors.locations && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.locations}</p>}
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quantity to Transfer <span className="text-red-500">*</span></label>
            <div className="flex flex-wrap items-center gap-4">
              <input type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })} min="1" max={getAvailableStock() || 0} className="w-32 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50" required disabled={loading || !selectedItem} />
              {inventoryDetails && <span className="text-sm text-gray-500 dark:text-gray-400">Max: {getAvailableStock()}</span>}
              {getAvailableStock() > 0 && <button type="button" onClick={() => setFormData(prev => ({ ...prev, quantity: getAvailableStock() }))} className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300" disabled={loading || !selectedItem}>Max</button>}
            </div>
            {formData.quantity > getAvailableStock() && <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1"><AlertCircle className="w-4 h-4" />Not enough stock available. Max: {getAvailableStock()}</p>}
            {formErrors.quantity && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.quantity}</p>}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Notes</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50" placeholder="Reason for transfer..." disabled={loading || !selectedItem} />
          </div>

          {/* Business Unit Info */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400 dark:text-gray-500">
            <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />{businessUnitId() ? `Business Unit: ${businessUnitId()?.slice(0, 8)}...` : '⚠️ No business unit selected'}</span>
            <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" />{userId() ? `User: ${userId()?.slice(0, 8)}...` : '⚠️ No user ID'}</span>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-yellow-500 dark:text-yellow-400 flex-shrink-0" /><span>Stock will be deducted from source and added to destination</span></div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => router.push('/admin/inventory')} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50" disabled={loading}>Cancel</button>
              <button type="submit" disabled={loading || !selectedItem || formData.quantity <= 0 || formData.fromLocation === formData.toLocation || !businessUnitId()} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Transferring...</> : <><ArrowRight className="w-4 h-4" />Transfer Stock</>}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Transfer History */}
      {showHistory && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><History className="w-4 h-4" />Transfer History</h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">{transferHistory.length} transfers</span>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-80 overflow-y-auto">
            {loadingHistory ? (
              <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Loading history...</div>
            ) : transferHistory.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No transfer history yet</div>
            ) : (
              transferHistory.map((transfer) => (
                <div key={transfer.id} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{transfer.productName}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>From: {transfer.fromLocation}</span><ArrowRight className="w-3 h-3 flex-shrink-0" /><span>To: {transfer.toLocation}</span><span className="font-medium text-gray-700 dark:text-gray-300">Qty: {transfer.quantity}</span>
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                      <span>{formatDate(transfer.createdAt)}</span>
                      <span className="block">by {transfer.user.firstName} {transfer.user.lastName}</span>
                    </div>
                  </div>
                  {transfer.notes && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">{transfer.notes}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
