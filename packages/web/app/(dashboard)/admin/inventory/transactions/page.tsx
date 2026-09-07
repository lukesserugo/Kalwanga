'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  History, TrendingUp, TrendingDown, RefreshCw,
  Search, Filter, Download, Calendar, User,
  Package, ArrowUp, ArrowDown, Lock,
  ChevronLeft, ChevronRight, X, AlertCircle,
  Barcode, QrCode, Scan, Copy, Check, Eye
} from 'lucide-react';
import { useAuth } from '../../../../../hooks/useAuth';
import { inventoryService } from '../../../../../services/inventoryService';
import { barcodeService } from '../../../../../services/barcodeService';
import { productService } from '../../../../../services/productService';
import { toast } from '../../../../../utils/toast-manager';
import { formatCurrency, formatDate } from '../../../../../utils/formatters';

// ============================================
// TYPES - Match the service response exactly
// ============================================

// ✅ FIXED: Use the exact type from inventoryService
interface Transaction {
  id: string;
  transactionType: string;
  quantity: number;
  notes?: string | null;
  reference?: string | null;
  productId: string;
  variantId?: string | null;
  inventoryId: string;
  businessUnitId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  product?: {
    id: string;
    name: string;
    sku: string;
    barcode?: string | null;
    unitPrice?: number;
  };
  variant?: {
    id: string;
    name: string;
    sku: string;
  };
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  };
}

interface BarcodeLookupResult {
  barcode: string;
  productId: string;
  productName: string;
  sku: string;
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function TransactionsPage() {
  const router = useRouter();
  const { user, canViewInventory } = useAuth();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [barcodeLookupResult, setBarcodeLookupResult] = useState<BarcodeLookupResult | null>(null);
  const [lookingUpBarcode, setLookingUpBarcode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [filters, setFilters] = useState({
    type: '',
    startDate: '',
    endDate: '',
    productId: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [exporting, setExporting] = useState(false);

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || '';

  // Check permission
  if (!canViewInventory) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">You don't have permission to view transactions.</p>
      </div>
    );
  }

  useEffect(() => {
    loadTransactions();
  }, [businessUnitId, filters, pagination.page]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const params: any = {
        businessUnitId,
        page: pagination.page,
        limit: pagination.limit,
      };
      if (filters.type) params.transactionType = filters.type;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.productId) params.productId = filters.productId;

      const data = await inventoryService.getInventoryTransactions(params);
      
      const mappedTransactions: Transaction[] = (data.data || []).map((tx: any) => ({
        id: tx.id,
        transactionType: tx.transactionType || tx.type || 'UNKNOWN',
        quantity: tx.quantity || 0,
        notes: tx.notes || null,
        reference: tx.reference || null,
        productId: tx.productId || tx.product?.id,
        variantId: tx.variantId || tx.variant?.id || null,
        inventoryId: tx.inventoryId || tx.inventory?.id,
        businessUnitId: tx.businessUnitId,
        userId: tx.userId || tx.user?.id,
        createdAt: tx.createdAt || tx.transactionDate || new Date().toISOString(),
        updatedAt: tx.updatedAt || tx.createdAt || new Date().toISOString(),
        product: tx.product ? {
          id: tx.product.id,
          name: tx.product.name || 'Unknown Product',
          sku: tx.product.sku || 'N/A',
          barcode: tx.product.barcode || null,
          unitPrice: tx.product.unitPrice || 0,
        } : undefined,
        variant: tx.variant ? {
          id: tx.variant.id,
          name: tx.variant.name || 'Unknown Variant',
          sku: tx.variant.sku || 'N/A',
        } : undefined,
        user: tx.user ? {
          id: tx.user.id,
          firstName: tx.user.firstName || 'System',
          lastName: tx.user.lastName || '',
          email: tx.user.email || '',
        } : undefined,
      }));

      setTransactions(mappedTransactions);
      setPagination(prev => ({
        ...prev,
        total: data.total || 0,
        totalPages: data.totalPages || 1,
      }));
    } catch (error) {
      console.error('Failed to load transactions:', error);
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // BARCODE HANDLERS - ✅ FIXED
  // ============================================

  const handleBarcodeSearch = async () => {
    if (!barcodeSearch || barcodeSearch.length < 3) {
      toast.warning('Please enter a valid barcode');
      return;
    }

    setLookingUpBarcode(true);
    try {
      // ✅ FIXED: Step 1 - Get product ID from barcode
      const result = await barcodeService.getProductByBarcode(barcodeSearch);
      
      if (result && result.productId) {
        // ✅ FIXED: Step 2 - Fetch full product details using productService
        try {
          const product = await productService.getProductById(result.productId);
          
          if (product && product.id) {
            setBarcodeLookupResult({
              barcode: barcodeSearch,
              productId: product.id,
              productName: product.name || 'Unknown Product',
              sku: product.sku || 'N/A',
            });
            
            // Filter transactions by this product
            setFilters(prev => ({ ...prev, productId: product.id }));
            toast.success(`Found product: ${product.name || 'Unknown Product'}`);
          } else {
            // Fallback: Use only the product ID from barcode lookup
            setBarcodeLookupResult({
              barcode: barcodeSearch,
              productId: result.productId,
              productName: 'Unknown Product',
              sku: 'N/A',
            });
            setFilters(prev => ({ ...prev, productId: result.productId }));
            toast.warning('Product found but details could not be loaded');
          }
        } catch (productError) {
          // Fallback: Use the product ID from barcode lookup
          console.warn('Could not fetch product details:', productError);
          setBarcodeLookupResult({
            barcode: barcodeSearch,
            productId: result.productId,
            productName: 'Unknown Product',
            sku: 'N/A',
          });
          setFilters(prev => ({ ...prev, productId: result.productId }));
          toast.warning('Product found but details could not be loaded');
        }
      } else {
        setBarcodeLookupResult(null);
        toast.warning('No product found for this barcode');
      }
    } catch (error: any) {
      console.error('Failed to lookup barcode:', error);
      if (error?.response?.status === 404) {
        toast.warning('No product found for this barcode');
      } else {
        toast.error('Failed to lookup barcode');
      }
      setBarcodeLookupResult(null);
    } finally {
      setLookingUpBarcode(false);
    }
  };

  const handleCopyBarcode = async () => {
    if (!barcodeLookupResult?.barcode) return;
    try {
      await navigator.clipboard.writeText(barcodeLookupResult.barcode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Barcode copied');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const clearBarcodeSearch = () => {
    setBarcodeSearch('');
    setBarcodeLookupResult(null);
    setFilters(prev => ({ ...prev, productId: '' }));
  };

  const handleScanBarcode = () => {
    const input = document.getElementById('barcode-input');
    if (input) input.focus();
    toast.info('Enter barcode manually or use a scanner');
  };

  // ============================================
  // EXPORT HANDLERS
  // ============================================

  const handleExport = async () => {
    setExporting(true);
    try {
      await inventoryService.exportInventory(businessUnitId, 'csv');
      toast.success('Transactions exported successfully');
    } catch (error) {
      toast.error('Failed to export transactions');
    } finally {
      setExporting(false);
    }
  };

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'PURCHASE':
      case 'RESTOCK':
      case 'ADJUSTMENT_IN':
      case 'TRANSFER_IN':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'SALE':
      case 'ISSUE':
      case 'ADJUSTMENT_OUT':
      case 'TRANSFER_OUT':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      case 'RETURN':
        return <RefreshCw className="w-4 h-4 text-blue-500" />;
      case 'INITIAL':
        return <Package className="w-4 h-4 text-gray-500" />;
      default:
        return <Package className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'PURCHASE':
      case 'RESTOCK':
      case 'ADJUSTMENT_IN':
      case 'TRANSFER_IN':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'SALE':
      case 'ISSUE':
      case 'ADJUSTMENT_OUT':
      case 'TRANSFER_OUT':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'RETURN':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'INITIAL':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300';
    }
  };

  const getTypeLabel = (type: string) => {
    return type?.replace(/_/g, ' ') || 'Unknown';
  };

  // ============================================
  // FILTERED TRANSACTIONS
  // ============================================

  const filteredTransactions = transactions.filter(tx => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const productName = tx.product?.name?.toLowerCase() || '';
    const sku = tx.product?.sku?.toLowerCase() || '';
    const barcode = tx.product?.barcode?.toLowerCase() || '';
    return productName.includes(query) || sku.includes(query) || barcode.includes(query);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <History className="w-8 h-8 text-blue-500" />
            Transaction History
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">View all inventory transactions</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadTransactions}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>

      {/* Barcode Search Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Barcode className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              id="barcode-input"
              type="text"
              placeholder="Search by barcode..."
              value={barcodeSearch}
              onChange={(e) => setBarcodeSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleBarcodeSearch()}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>
          <button
            onClick={handleBarcodeSearch}
            disabled={lookingUpBarcode || !barcodeSearch}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {lookingUpBarcode ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <Scan className="w-4 h-4" />
            )}
            Lookup
          </button>
          <button
            onClick={handleScanBarcode}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <QrCode className="w-4 h-4" />
            Scan
          </button>
          {barcodeLookupResult && (
            <button
              onClick={clearBarcodeSearch}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>

        {/* Barcode Lookup Result */}
        {barcodeLookupResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {barcodeLookupResult.productName}
                  </p>
                  <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                    <span>SKU: {barcodeLookupResult.sku}</span>
                    <span className="flex items-center gap-1">
                      Barcode: {barcodeLookupResult.barcode}
                      <button
                        onClick={handleCopyBarcode}
                        className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                      >
                        {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => router.push(`/admin/inventory?search=${barcodeLookupResult.sku}`)}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
              >
                <Eye className="w-3 h-3" />
                View in Inventory
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by product name, SKU, or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
          >
            <option value="">All Types</option>
            <option value="PURCHASE">Purchase</option>
            <option value="SALE">Sale</option>
            <option value="RESTOCK">Restock</option>
            <option value="ISSUE">Issue</option>
            <option value="RETURN">Return</option>
            <option value="ADJUSTMENT_IN">Adjustment In</option>
            <option value="ADJUSTMENT_OUT">Adjustment Out</option>
            <option value="TRANSFER_IN">Transfer In</option>
            <option value="TRANSFER_OUT">Transfer Out</option>
            <option value="INITIAL">Initial</option>
          </select>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
          />
          <span className="text-sm text-gray-500">to</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
          />
          {filters.productId && (
            <button
              onClick={() => {
                setFilters({ ...filters, productId: '' });
                clearBarcodeSearch();
              }}
              className="text-sm text-red-600 hover:text-red-800 flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Clear Filter
            </button>
          )}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Barcode
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p>No transactions found</p>
                    {barcodeLookupResult && (
                      <p className="text-sm mt-1">
                        Showing transactions for <strong>{barcodeLookupResult.productName}</strong>
                      </p>
                    )}
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <motion.tr
                    key={tx.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getTransactionIcon(tx.transactionType)}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(tx.transactionType)}`}>
                          {getTypeLabel(tx.transactionType)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {tx.product?.name || 'Unknown Product'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">SKU: {tx.product?.sku || 'N/A'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {tx.product?.barcode ? (
                        <div className="flex items-center gap-1">
                          <Barcode className="w-3 h-3 text-green-500" />
                          <span className="text-xs font-mono text-gray-600 dark:text-gray-300">
                            {tx.product.barcode}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">No barcode</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${tx.quantity > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {tx.quantity > 0 ? '+' : ''}{tx.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {tx.user?.firstName || 'System'} {tx.user?.lastName || ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(tx.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                      {tx.notes || '-'}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Summary Stats */}
        {filteredTransactions.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                Total: <strong className="text-gray-900 dark:text-white">{filteredTransactions.length}</strong> transactions
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                Net Change: <strong className="text-gray-900 dark:text-white">
                  {filteredTransactions.reduce((sum, tx) => sum + tx.quantity, 0)}
                </strong>
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                In: <strong className="text-green-600 dark:text-green-400">
                  {filteredTransactions.filter(tx => tx.quantity > 0).reduce((sum, tx) => sum + tx.quantity, 0)}
                </strong>
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                Out: <strong className="text-red-600 dark:text-red-400">
                  {filteredTransactions.filter(tx => tx.quantity < 0).reduce((sum, tx) => sum + Math.abs(tx.quantity), 0)}
                </strong>
              </span>
              {barcodeLookupResult && (
                <span className="text-gray-600 dark:text-gray-400">
                  Filtered by: <strong className="text-blue-600 dark:text-blue-400">{barcodeLookupResult.productName}</strong>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Showing {filteredTransactions.length} of {pagination.total} transactions
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page <= 1}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
