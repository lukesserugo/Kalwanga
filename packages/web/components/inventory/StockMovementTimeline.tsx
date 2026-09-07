// D:\Projects\Kalwanga\packages\web\components\inventory\StockMovementTimeline.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Clock, Calendar,
  Filter, RefreshCw, Download, Eye, ArrowUp, ArrowDown,
  Package, User, MapPin, FileText
} from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import { toast } from '../../utils/toast-manager';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { useAuth } from '../../hooks/useAuth';

interface Movement {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  transactionType: string;
  quantity: number;
  notes?: string;
  location?: string;
  createdAt: string;
  user: { firstName: string; lastName: string };
}

export function StockMovementTimeline({ productId }: { productId?: string }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [filter, setFilter] = useState({
    startDate: '',
    endDate: '',
    type: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || '';

  useEffect(() => {
    loadMovements();
  }, [businessUnitId, productId, filter, pagination.page]);

  const loadMovements = async () => {
    try {
      setLoading(true);
      const params: any = {
        businessUnitId,
        page: pagination.page,
        limit: pagination.limit,
      };
      if (productId) params.productId = productId;
      if (filter.startDate) params.startDate = filter.startDate;
      if (filter.endDate) params.endDate = filter.endDate;
      if (filter.type) params.transactionType = filter.type;

      const data = await inventoryService.getInventoryTransactions(params);
      
      // Map the data to Movement interface
      const mappedMovements: Movement[] = (data.data || []).map((item: any) => ({
        id: item.id,
        productId: item.productId || item.product?.id || '',
        productName: item.product?.name || 'Unknown Product',
        productSku: item.product?.sku || 'N/A',
        transactionType: item.transactionType || 'UNKNOWN',
        quantity: item.quantity || 0,
        notes: item.notes,
        location: item.location || item.inventory?.location,
        createdAt: item.createdAt,
        user: {
          firstName: item.user?.firstName || 'System',
          lastName: item.user?.lastName || '',
        },
      }));
      
      setMovements(mappedMovements);
      setPagination(prev => ({
        ...prev,
        total: data.total || 0,
        totalPages: data.totalPages || 1,
      }));
    } catch (error) {
      console.error('Failed to load movements:', error);
      toast.error('Failed to load stock movements');
    } finally {
      setLoading(false);
    }
  };

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'PURCHASE':
      case 'RESTOCK':
      case 'ADJUSTMENT_IN':
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'SALE':
      case 'ISSUE':
      case 'ADJUSTMENT_OUT':
        return <TrendingDown className="w-5 h-5 text-red-500" />;
      case 'RETURN':
        return <RefreshCw className="w-5 h-5 text-blue-500" />;
      case 'TRANSFER_IN':
      case 'TRANSFER_OUT':
        return <MapPin className="w-5 h-5 text-purple-500" />;
      default:
        return <Package className="w-5 h-5 text-gray-500" />;
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
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Stock Movement Timeline</h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            ({pagination.total} movements)
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={filter.startDate}
            onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
          />
          <span className="text-xs text-gray-500">to</span>
          <input
            type="date"
            value={filter.endDate}
            onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
          />
          <select
            value={filter.type}
            onChange={(e) => setFilter({ ...filter, type: e.target.value })}
            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
          >
            <option value="">All Types</option>
            <option value="PURCHASE">Purchase</option>
            <option value="SALE">Sale</option>
            <option value="RESTOCK">Restock</option>
            <option value="ISSUE">Issue</option>
            <option value="RETURN">Return</option>
            <option value="ADJUSTMENT_IN">Adjustment In</option>
            <option value="ADJUSTMENT_OUT">Adjustment Out</option>
          </select>
          <button
            onClick={loadMovements}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {movements.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p>No movements found</p>
            <p className="text-sm">Try adjusting your filters</p>
          </div>
        ) : (
          movements.map((movement, index) => (
            <div key={movement.id || index} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-4">
                  <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    {getMovementIcon(movement.transactionType)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {movement.productName || 'Unknown Product'}
                      </p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTypeColor(movement.transactionType)}`}>
                        {movement.transactionType?.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        SKU: {movement.productSku || 'N/A'}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {movement.user?.firstName || 'System'} {movement.user?.lastName || ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(movement.createdAt)}
                      </span>
                      {movement.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {movement.location}
                        </span>
                      )}
                    </div>
                    {movement.notes && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {movement.notes}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${
                    movement.quantity > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                  </p>
                  {movement.transactionType === 'PURCHASE' && (
                    <p className="text-xs text-gray-500">Added to stock</p>
                  )}
                  {movement.transactionType === 'SALE' && (
                    <p className="text-xs text-gray-500">Removed from stock</p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Showing {movements.length} of {pagination.total} movements
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
  );
}
