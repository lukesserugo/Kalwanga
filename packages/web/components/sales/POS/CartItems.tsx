// D:\Projects\Kalwanga\packages\web\components\sales\POS\CartItems.tsx
'use client';

import React, { useState, useCallback } from 'react';
import Image from 'next/image';
import {
  Plus,
  Minus,
  Trash2,
  X,
  Package,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Edit2,
  Copy,
  ShoppingBag,
} from 'lucide-react';
import { toast } from '../../../utils/toast-manager';
import {
  formatPosCurrency,
  getPosImageSource,
  pickPosCurrency,
} from './posDisplay';

// ============================================
// TYPES
// ============================================

export interface CartItem {
  id: string;
  product: {
    id: string;
    name: string;
    sku: string;
    unitPrice: number;
    images?: string[];
    barcode?: string;
    category?: { id: string; name: string };
    taxRate?: number;
    weight?: number;
    costPrice?: number;
  };
  variant?: {
    id: string;
    name: string;
    sku: string;
    price: number;
    attributes: Record<string, any>;
  };
  quantity: number;
  unitPrice: number;
  total: number;
  discount?: number;
  discountedTotal?: number;
  notes?: string;
  isVoided?: boolean;
  voidReason?: string;
  availableStock?: number;
  /** ISO 4217 ledger currency for this line. Optional. */
  currency?: string;
}

export interface CartSummary {
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  itemCount: number;
  totalItems: number;
  uniqueItems: number;
  /** ISO 4217 ledger currency for the summary amounts. Optional. */
  currency?: string;
}

interface CartItemsProps {
  items: CartItem[];
  onUpdateQuantity: (itemId: string, quantity: number) => Promise<void> | void;
  onRemoveItem: (itemId: string) => Promise<void> | void;
  onVoidItem?: (itemId: string, reason?: string) => Promise<void> | void;
  onUpdateNotes?: (itemId: string, notes: string) => Promise<void> | void;
  onApplyDiscount?: (itemId: string, discount: number) => Promise<void> | void;
  onDuplicateItem?: (itemId: string) => Promise<void> | void;
  isProcessing?: boolean;
  showVoided?: boolean;
  summary?: CartSummary;
  /**
   * Optional ISO 4217 fallback currency supplied by the POS parent.
   * Used only when neither a line item nor the summary carries one.
   */
  currency?: string;
}

// ============================================
// SUB-COMPONENTS
// ============================================

const ItemNotesModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (notes: string) => void;
  currentNotes: string;
}> = ({ isOpen, onClose, onSave, currentNotes }) => {
  const [notes, setNotes] = useState(currentNotes || '');

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 m-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
        >
          <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
          Item Notes
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter notes for this item..."
              autoFocus
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(notes);
              onClose();
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors focus-ring"
          >
            Save Notes
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export function CartItems({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onVoidItem,
  onUpdateNotes,
  onApplyDiscount,
  onDuplicateItem,
  isProcessing = false,
  showVoided = false,
  summary,
  currency: currencyProp,
}: CartItemsProps) {
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const defaultCurrency = pickPosCurrency(
    items[0]?.currency,
    summary?.currency,
    currencyProp,
  );

  const handleToggleExpand = useCallback((itemId: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  const handleQuantityChange = useCallback(
    async (itemId: string, newQuantity: number) => {
      if (isProcessing) return;

      const item = items.find((i) => i.id === itemId);
      if (!item) return;

      if (
        item.availableStock !== undefined &&
        newQuantity > item.availableStock
      ) {
        toast.error(`Only ${item.availableStock} items available in stock`);
        return;
      }

      if (newQuantity < 0) return;

      try {
        await onUpdateQuantity(itemId, newQuantity);
      } catch (error) {
        console.error('Failed to update quantity:', error);
        toast.error('Failed to update quantity');
      }
    },
    [items, isProcessing, onUpdateQuantity],
  );

  const handleRemoveItem = useCallback(
    async (itemId: string) => {
      if (isProcessing) return;
      if (!confirm('Remove this item from cart?')) return;

      try {
        await onRemoveItem(itemId);
        toast.success('Item removed');
      } catch (error) {
        console.error('Failed to remove item:', error);
        toast.error('Failed to remove item');
      }
    },
    [isProcessing, onRemoveItem],
  );

  const handleVoidItem = useCallback(
    async (itemId: string, reason?: string) => {
      if (isProcessing || !onVoidItem) return;

      const reasonText =
        reason ||
        window.prompt('Reason for voiding this item:') ||
        'No reason provided';
      if (!reasonText) return;

      try {
        await onVoidItem(itemId, reasonText);
        toast.success('Item voided');
      } catch (error) {
        console.error('Failed to void item:', error);
        toast.error('Failed to void item');
      }
    },
    [isProcessing, onVoidItem],
  );

  const handleUpdateNotes = useCallback(
    async (itemId: string, notes: string) => {
      if (isProcessing || !onUpdateNotes) return;

      try {
        await onUpdateNotes(itemId, notes);
        toast.success('Notes updated');
      } catch (error) {
        console.error('Failed to update notes:', error);
        toast.error('Failed to update notes');
      }
    },
    [isProcessing, onUpdateNotes],
  );

  const handleDuplicateItem = useCallback(
    async (itemId: string) => {
      if (isProcessing || !onDuplicateItem) return;

      try {
        await onDuplicateItem(itemId);
        toast.success('Item duplicated');
      } catch (error) {
        console.error('Failed to duplicate item:', error);
        toast.error('Failed to duplicate item');
      }
    },
    [isProcessing, onDuplicateItem],
  );

  const visibleItems = showVoided
    ? items
    : items.filter((item) => !item.isVoided);
  const voidedItems = items.filter((item) => item.isVoided);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <ShoppingBag className="w-10 h-10 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
          Cart is empty
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Add items to start building your order
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {summary && (
        <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400">Items</p>
              <p className="font-bold text-gray-900 dark:text-white tabular-nums">
                {summary.totalItems} units
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Unique</p>
              <p className="font-bold text-gray-900 dark:text-white tabular-nums">
                {summary.uniqueItems}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Subtotal</p>
              <p className="font-bold text-gray-900 dark:text-white tabular-nums">
                {formatPosCurrency(summary.subtotal, defaultCurrency)}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Total</p>
              <p className="font-bold text-green-600 dark:text-green-400 tabular-nums">
                {formatPosCurrency(summary.total, defaultCurrency)}
              </p>
            </div>
          </div>
        </div>
      )}

      {visibleItems.map((item) => {
        const isExpanded = expandedItems.has(item.id);
        const hasDiscount = item.discount && item.discount > 0;
        const displayTotal = item.discountedTotal || item.total;
        const isVoided = item.isVoided;
        const stockWarning =
          item.availableStock !== undefined &&
          item.availableStock < item.quantity;

        const lineCurrency = pickPosCurrency(
          item.currency,
          defaultCurrency,
        );
        const imageSource = getPosImageSource(item.product.images?.[0]);

        return (
          <div
            key={item.id}
            className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow border ${
              isVoided
                ? 'border-red-300 dark:border-red-700 opacity-60'
                : stockWarning
                ? 'border-yellow-300 dark:border-yellow-700'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <div className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                  {imageSource ? (
                    <Image
                      src={imageSource}
                      alt={item.product.name}
                      width={56}
                      height={56}
                      unoptimized
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-7 h-7 text-gray-400 dark:text-gray-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {item.product.name}
                    </p>
                    {isVoided && (
                      <span className="px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-xs rounded-full flex-shrink-0">
                        Voided
                      </span>
                    )}
                    {stockWarning && (
                      <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 text-xs rounded-full flex-shrink-0">
                        Low Stock
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <span>SKU: {item.product.sku}</span>
                    {item.variant && (
                      <span className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                        {item.variant.name}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    <span className="tabular-nums">
                      {formatPosCurrency(item.unitPrice, lineCurrency)} each
                    </span>
                    {item.availableStock !== undefined && (
                      <span className="text-xs text-gray-400 tabular-nums">
                        Stock: {item.availableStock}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleQuantityChange(item.id, item.quantity - 1)
                    }
                    disabled={isProcessing || isVoided}
                    aria-label="Decrease quantity"
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 focus-ring"
                  >
                    <Minus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                  <span className="w-8 text-center font-medium text-gray-900 dark:text-white tabular-nums">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleQuantityChange(item.id, item.quantity + 1)
                    }
                    disabled={isProcessing || isVoided}
                    aria-label="Increase quantity"
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 focus-ring"
                  >
                    <Plus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>

                <div className="text-right min-w-[80px]">
                  <p
                    className={`font-bold text-gray-900 dark:text-white tabular-nums ${
                      hasDiscount
                        ? 'line-through text-gray-400 dark:text-gray-500 text-sm'
                        : ''
                    }`}
                  >
                    {formatPosCurrency(item.total, lineCurrency)}
                  </p>
                  {hasDiscount && (
                    <p className="font-bold text-green-600 dark:text-green-400 tabular-nums">
                      {formatPosCurrency(displayTotal, lineCurrency)}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => handleToggleExpand(item.id)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
                    title="Toggle details"
                    aria-label="Toggle item details"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    )}
                  </button>

                  {onUpdateNotes && !isVoided && (
                    <button
                      type="button"
                      onClick={() => setEditingNotes(item.id)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
                      title="Edit notes"
                      aria-label="Edit notes"
                    >
                      <Edit2 className="w-4 h-4 text-gray-500" />
                    </button>
                  )}

                  {onDuplicateItem && !isVoided && (
                    <button
                      type="button"
                      onClick={() => handleDuplicateItem(item.id)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
                      title="Duplicate item"
                      aria-label="Duplicate item"
                    >
                      <Copy className="w-4 h-4 text-gray-500" />
                    </button>
                  )}

                  {onVoidItem && !isVoided && (
                    <button
                      type="button"
                      onClick={() => handleVoidItem(item.id)}
                      className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-colors focus-ring"
                      title="Void Item"
                      aria-label="Void item"
                    >
                      <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    disabled={isProcessing}
                    className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-colors disabled:opacity-50 focus-ring"
                    title="Remove Item"
                    aria-label="Remove item"
                  >
                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </button>
                </div>
              </div>

              {(item.notes || isExpanded) && (
                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                  {isExpanded && (
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-500 dark:text-gray-400">
                      {item.variant && (
                        <div>
                          <span className="font-medium">Variant:</span>{' '}
                          {item.variant.name}
                        </div>
                      )}
                      <div>
                        <span className="font-medium">Unit Price:</span>{' '}
                        {formatPosCurrency(item.unitPrice, lineCurrency)}
                      </div>
                      {item.product.taxRate !== undefined && (
                        <div>
                          <span className="font-medium">Tax Rate:</span>{' '}
                          {item.product.taxRate}%
                        </div>
                      )}
                      {item.product.costPrice !== undefined && (
                        <div>
                          <span className="font-medium">Cost:</span>{' '}
                          {formatPosCurrency(
                            item.product.costPrice,
                            lineCurrency,
                          )}
                        </div>
                      )}
                      {item.discount !== undefined && item.discount > 0 && (
                        <div>
                          <span className="font-medium">Discount:</span>{' '}
                          {formatPosCurrency(item.discount, lineCurrency)}
                        </div>
                      )}
                      {item.product.barcode && (
                        <div>
                          <span className="font-medium">Barcode:</span>{' '}
                          {item.product.barcode}
                        </div>
                      )}
                      {item.product.category && (
                        <div>
                          <span className="font-medium">Category:</span>{' '}
                          {item.product.category.name}
                        </div>
                      )}
                    </div>
                  )}

                  {item.notes && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      <span className="font-medium">Notes:</span> {item.notes}
                    </div>
                  )}

                  {isVoided && item.voidReason && (
                    <div className="text-sm text-red-500 dark:text-red-400 mt-1">
                      <span className="font-medium">Void Reason:</span>{' '}
                      {item.voidReason}
                    </div>
                  )}

                  {stockWarning && (
                    <div className="text-sm text-yellow-600 dark:text-yellow-400 mt-1 flex items-center gap-1">
                      <AlertCircle
                        className="w-3.5 h-3.5"
                        aria-hidden="true"
                      />
                      <span>
                        Only {item.availableStock} units available in stock
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {showVoided && voidedItems.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
            Voided Items ({voidedItems.length})
          </h4>
          {voidedItems.map((item) => {
            const lineCurrency = pickPosCurrency(
              item.currency,
              defaultCurrency,
            );
            return (
              <div
                key={item.id}
                className="flex items-center justify-between py-1.5 text-sm text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <X
                    className="w-3.5 h-3.5 text-red-500"
                    aria-hidden="true"
                  />
                  <span>{item.product.name}</span>
                  <span className="text-xs text-gray-400 tabular-nums">
                    ×{item.quantity}
                  </span>
                </div>
                <span className="tabular-nums">
                  {formatPosCurrency(item.total, lineCurrency)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {editingNotes && onUpdateNotes && (
        <ItemNotesModal
          isOpen={!!editingNotes}
          onClose={() => setEditingNotes(null)}
          onSave={(notes) => {
            handleUpdateNotes(editingNotes, notes);
            setEditingNotes(null);
          }}
          currentNotes={
            items.find((i) => i.id === editingNotes)?.notes || ''
          }
        />
      )}
    </div>
  );
}

export default CartItems;
