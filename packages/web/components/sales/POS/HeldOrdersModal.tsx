'use client';

import React from 'react';
import {
  X,
  Clock,
  User,
  DollarSign,
  Package,
  Calendar,
  RefreshCw,
  Trash2,
  Loader2
} from 'lucide-react';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';

export interface HeldOrder {
  id: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  customerName?: string;
  total: number;
  createdAt: string;
  notes?: string;
}

export interface HeldOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: HeldOrder[];
  onRestore: (orderId: string) => void;
  onDelete: (orderId: string) => void;
}

export function HeldOrdersModal({
  isOpen,
  onClose,
  orders,
  onRestore,
  onDelete,
}: HeldOrdersModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              Held Orders
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {orders.length} order{orders.length !== 1 ? 's' : ''} on hold
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Orders List */}
        <div className="flex-1 overflow-y-auto p-6">
          {orders.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No held orders</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <HeldOrderItem
                  key={order.id}
                  order={order}
                  onRestore={() => onRestore(order.id)}
                  onDelete={() => onDelete(order.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// HELD ORDER ITEM
// ============================================

interface HeldOrderItemProps {
  order: HeldOrder;
  onRestore: () => void;
  onDelete: () => void;
}

function HeldOrderItem({ order, onRestore, onDelete }: HeldOrderItemProps) {
  return (
    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-yellow-500" />
            <span className="font-medium text-gray-900 dark:text-white">
              Order #{order.id.slice(-6)}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {formatDateTime(order.createdAt)}
            </span>
          </div>
          {order.customerName && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              <User className="w-3 h-3 inline mr-1" />
              {order.customerName}
            </p>
          )}
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Package className="w-3 h-3" />
              {order.items.length} items
            </span>
            <span className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              {formatCurrency(order.total)}
            </span>
          </div>
          {order.notes && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              📝 {order.notes}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onRestore}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Restore
          </button>
          <button
            onClick={onDelete}
            className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
