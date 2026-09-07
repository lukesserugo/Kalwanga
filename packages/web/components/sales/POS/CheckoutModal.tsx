// D:\Projects\Kalwanga\packages\web\components\sales\POS\CartItems.tsx

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { 
  Plus, Minus, Trash2, X, Package, AlertCircle,
  ChevronDown, ChevronUp, Edit2, Save, Copy,
  ShoppingBag, Tag, DollarSign, Info, Clock,
  Printer, Send, Download, MoreVertical,
  CheckCircle, AlertTriangle, Loader2,
  Filter, Search, Layers, Calendar
} from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';
import { toast } from '../../../utils/toast-manager';

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
    description?: string;
    isDigital?: boolean;
  };
  variant?: {
    id: string;
    name: string;
    sku: string;
    price: number;
    attributes: Record<string, any>;
    stock?: number;
  };
  quantity: number;
  unitPrice: number;
  total: number;
  discount?: number;
  discountedTotal?: number;
  notes?: string;
  isVoided?: boolean;
  voidReason?: string;
  voidedAt?: string;
  voidedBy?: string;
  availableStock?: number;
  isLowStock?: boolean;
  isOutOfStock?: boolean;
  addedAt?: string;
  isSelected?: boolean;
}

export interface CartSummary {
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  itemCount: number;
  totalItems: number;
  uniqueItems: number;
  voidedCount: number;
  voidedTotal: number;
  averagePrice: number;
  highestPrice: number;
  lowestPrice: number;
}

interface CartItemsProps {
  items: CartItem[];
  onUpdateQuantity: (itemId: string, quantity: number) => Promise<void> | void;
  onRemoveItem: (itemId: string) => Promise<void> | void;
  onVoidItem?: (itemId: string, reason?: string) => Promise<void> | void;
  onUpdateNotes?: (itemId: string, notes: string) => Promise<void> | void;
  onApplyDiscount?: (itemId: string, discount: number, type?: 'PERCENTAGE' | 'FIXED') => Promise<void> | void;
  onDuplicateItem?: (itemId: string) => Promise<void> | void;
  onSelectItem?: (itemId: string, selected: boolean) => Promise<void> | void;
  onBulkAction?: (itemIds: string[], action: string) => Promise<void> | void;
  onReorder?: (itemId: string) => Promise<void> | void;
  isProcessing?: boolean;
  showVoided?: boolean;
  summary?: CartSummary;
  maxItems?: number;
  maxQuantity?: number;
}

interface BulkAction {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
}

// ============================================
// SUB-COMPONENTS
// ============================================

const ItemNotesModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (notes: string) => void;
  currentNotes: string;
  itemName?: string;
}> = ({ isOpen, onClose, onSave, currentNotes, itemName }) => {
  const [notes, setNotes] = useState(currentNotes || '');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 m-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
          Item Notes {itemName && `- ${itemName}`}
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
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave(notes);
              onClose();
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Notes
          </button>
        </div>
      </div>
    </div>
  );
};

const DiscountModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onApply: (discount: number, type: 'PERCENTAGE' | 'FIXED') => void;
  itemName?: string;
  currentDiscount?: number;
  itemTotal?: number;
}> = ({ isOpen, onClose, onApply, itemName, currentDiscount, itemTotal }) => {
  const [discount, setDiscount] = useState(currentDiscount || 0);
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');

  if (!isOpen) return null;

  const maxDiscount = discountType === 'PERCENTAGE' ? 100 : (itemTotal || 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 m-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
          Apply Discount {itemName && `- ${itemName}`}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Item total: <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(itemTotal || 0)}</span>
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Discount Type
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setDiscountType('PERCENTAGE')}
                className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                  discountType === 'PERCENTAGE'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                Percentage (%)
              </button>
              <button
                onClick={() => setDiscountType('FIXED')}
                className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                  discountType === 'FIXED'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                Fixed ($)
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {discountType === 'PERCENTAGE' ? 'Percentage (%)' : 'Amount ($)'}
            </label>
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(Math.min(parseFloat(e.target.value) || 0, maxDiscount))}
              min={0}
              max={maxDiscount}
              step={discountType === 'PERCENTAGE' ? 1 : 0.01}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            {discountType === 'PERCENTAGE' && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Max: 100% {itemTotal && `(${formatCurrency((itemTotal * discount) / 100)} discount)`}
              </p>
            )}
            {discountType === 'FIXED' && itemTotal && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Max: {formatCurrency(itemTotal)}
              </p>
            )}
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Original Total</span>
              <span className="text-gray-900 dark:text-white">{formatCurrency(itemTotal || 0)}</span>
            </div>
            <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
              <span>Discount</span>
              <span>
                {discountType === 'PERCENTAGE' 
                  ? `${discount}% (${formatCurrency(((itemTotal || 0) * discount) / 100)})`
                  : formatCurrency(discount)
                }
              </span>
            </div>
            <div className="flex justify-between font-bold text-sm pt-1 border-t border-gray-200 dark:border-gray-600">
              <span className="text-gray-900 dark:text-white">New Total</span>
              <span className="text-gray-900 dark:text-white">
                {formatCurrency((itemTotal || 0) - (discountType === 'PERCENTAGE' 
                  ? ((itemTotal || 0) * discount) / 100 
                  : discount
                ))}
              </span>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onApply(discount, discountType);
              onClose();
            }}
            disabled={discount <= 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Tag className="w-4 h-4" />
            Apply Discount
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
  onSelectItem,
  onBulkAction,
  onReorder,
  isProcessing = false,
  showVoided = false,
  summary,
  maxItems = 100,
  maxQuantity = 999
}: CartItemsProps) {
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [editingDiscount, setEditingDiscount] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'discounted' | 'hasNotes' | 'lowStock'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'quantity' | 'total'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showBulkActions, setShowBulkActions] = useState(false);

  const handleToggleExpand = useCallback((itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  const handleSelectItem = useCallback((itemId: string) => {
    if (!onSelectItem) return;
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      const selected = newSet.has(itemId);
      onSelectItem(itemId, selected);
      return newSet;
    });
  }, [onSelectItem]);

  const handleSelectAll = useCallback(() => {
    const visibleItemIds = visibleItems.map(item => item.id);
    const allSelected = visibleItemIds.every(id => selectedItems.has(id));
    
    if (allSelected) {
      setSelectedItems(new Set());
      visibleItemIds.forEach(id => onSelectItem?.(id, false));
    } else {
      const newSet = new Set(selectedItems);
      visibleItemIds.forEach(id => {
        newSet.add(id);
        onSelectItem?.(id, true);
      });
      setSelectedItems(newSet);
    }
  }, [visibleItems, selectedItems, onSelectItem]);

  const handleQuantityChange = useCallback(async (itemId: string, newQuantity: number) => {
    if (isProcessing) return;
    
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    if (newQuantity > maxQuantity) {
      toast.error(`Maximum ${maxQuantity} units allowed per item`);
      return;
    }
    
    if (item.availableStock !== undefined && newQuantity > item.availableStock) {
      toast.error(`Only ${item.availableStock} items available in stock`);
      return;
    }
    
    if (newQuantity < 0) return;
    if (newQuantity === 0) {
      await handleRemoveItem(itemId);
      return;
    }
    
    try {
      await onUpdateQuantity(itemId, newQuantity);
    } catch (error) {
      console.error('Failed to update quantity:', error);
      toast.error('Failed to update quantity');
    }
  }, [items, isProcessing, onUpdateQuantity, maxQuantity]);

  const handleRemoveItem = useCallback(async (itemId: string) => {
    if (isProcessing) return;
    if (!confirm('Remove this item from cart?')) return;
    
    try {
      await onRemoveItem(itemId);
      toast.success('Item removed');
    } catch (error) {
      console.error('Failed to remove item:', error);
      toast.error('Failed to remove item');
    }
  }, [isProcessing, onRemoveItem]);

  const handleVoidItem = useCallback(async (itemId: string, reason?: string) => {
    if (isProcessing || !onVoidItem) return;
    
    const reasonText = reason || window.prompt('Reason for voiding this item:') || 'No reason provided';
    if (!reasonText) return;
    
    try {
      await onVoidItem(itemId, reasonText);
      toast.success('Item voided');
    } catch (error) {
      console.error('Failed to void item:', error);
      toast.error('Failed to void item');
    }
  }, [isProcessing, onVoidItem]);

  const handleUpdateNotes = useCallback(async (itemId: string, notes: string) => {
    if (isProcessing || !onUpdateNotes) return;
    
    try {
      await onUpdateNotes(itemId, notes);
      toast.success('Notes updated');
    } catch (error) {
      console.error('Failed to update notes:', error);
      toast.error('Failed to update notes');
    }
  }, [isProcessing, onUpdateNotes]);

  const handleApplyDiscount = useCallback(async (itemId: string, discount: number, type: 'PERCENTAGE' | 'FIXED' = 'PERCENTAGE') => {
    if (isProcessing || !onApplyDiscount) return;
    
    try {
      await onApplyDiscount(itemId, discount, type);
      toast.success('Discount applied');
    } catch (error) {
      console.error('Failed to apply discount:', error);
      toast.error('Failed to apply discount');
    }
  }, [isProcessing, onApplyDiscount]);

  const handleDuplicateItem = useCallback(async (itemId: string) => {
    if (isProcessing || !onDuplicateItem) return;
    
    try {
      await onDuplicateItem(itemId);
      toast.success('Item duplicated');
    } catch (error) {
      console.error('Failed to duplicate item:', error);
      toast.error('Failed to duplicate item');
    }
  }, [isProcessing, onDuplicateItem]);

  const handleReorder = useCallback(async (itemId: string) => {
    if (isProcessing || !onReorder) return;
    
    try {
      await onReorder(itemId);
      toast.success('Item reordered');
    } catch (error) {
      console.error('Failed to reorder item:', error);
      toast.error('Failed to reorder item');
    }
  }, [isProcessing, onReorder]);

  const handleBulkAction = useCallback(async (action: string) => {
    if (!onBulkAction || selectedItems.size === 0) return;
    
    try {
      await onBulkAction(Array.from(selectedItems), action);
      toast.success(`Bulk action "${action}" completed`);
      setSelectedItems(new Set());
    } catch (error) {
      console.error('Failed to perform bulk action:', error);
      toast.error('Failed to perform bulk action');
    }
  }, [selectedItems, onBulkAction]);

  // Filter and sort items
  const visibleItems = useMemo(() => {
    let filtered = showVoided ? items : items.filter(item => !item.isVoided);
    
    // Apply filters
    switch (filter) {
      case 'discounted':
        filtered = filtered.filter(item => item.discount && item.discount > 0);
        break;
      case 'hasNotes':
        filtered = filtered.filter(item => item.notes);
        break;
      case 'lowStock':
        filtered = filtered.filter(item => item.isLowStock || item.isOutOfStock);
        break;
      default:
        break;
    }
    
    // Apply search
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.product.name.toLowerCase().includes(search) ||
        item.product.sku.toLowerCase().includes(search) ||
        (item.product.barcode && item.product.barcode.toLowerCase().includes(search))
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.product.name.localeCompare(b.product.name);
          break;
        case 'price':
          comparison = a.unitPrice - b.unitPrice;
          break;
        case 'quantity':
          comparison = a.quantity - b.quantity;
          break;
        case 'total':
          comparison = a.total - b.total;
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [items, showVoided, filter, searchTerm, sortBy, sortOrder]);

  const voidedItems = useMemo(() => items.filter(item => item.isVoided), [items]);
  const hasSelectedItems = selectedItems.size > 0;

  // Bulk actions
  const bulkActions: BulkAction[] = [
    { id: 'remove', label: 'Remove Selected', icon: Trash2, color: 'red' },
    { id: 'void', label: 'Void Selected', icon: X, color: 'orange' },
    { id: 'duplicate', label: 'Duplicate Selected', icon: Copy, color: 'blue' },
  ];

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <ShoppingBag className="w-10 h-10 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Cart is empty</h3>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Add items to start building your order</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cart Summary */}
      {summary && (
        <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400">Items</p>
              <p className="font-bold text-gray-900 dark:text-white">{summary.totalItems} units</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Unique</p>
              <p className="font-bold text-gray-900 dark:text-white">{summary.uniqueItems}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Subtotal</p>
              <p className="font-bold text-gray-900 dark:text-white">{formatCurrency(summary.subtotal)}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Total</p>
              <p className="font-bold text-green-600 dark:text-green-400">{formatCurrency(summary.total)}</p>
            </div>
          </div>
          {summary.voidedCount > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
              Voided: {summary.voidedCount} items ({formatCurrency(summary.voidedTotal)})
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[150px] relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search items..."
            className="w-full pl-8 pr-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="all">All Items</option>
          <option value="discounted">Discounted</option>
          <option value="hasNotes">Has Notes</option>
          <option value="lowStock">Low Stock</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="name">Sort by Name</option>
          <option value="price">Sort by Price</option>
          <option value="quantity">Sort by Quantity</option>
          <option value="total">Sort by Total</option>
        </select>
        <button
          onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
          className="p-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          {sortOrder === 'asc' ? '↑' : '↓'}
        </button>
        {onSelectItem && (
          <button
            onClick={handleSelectAll}
            className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {visibleItems.every(id => selectedItems.has(id.id)) ? 'Deselect All' : 'Select All'}
          </button>
        )}
      </div>

      {/* Bulk Actions */}
      {hasSelectedItems && onBulkAction && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2 flex flex-wrap items-center gap-2">
          <span className="text-sm text-blue-700 dark:text-blue-300">
            {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex-1" />
          {bulkActions.map((action) => {
            const Icon = action.icon;
            const colorClasses: Record<string, string> = {
              red: 'bg-red-600 hover:bg-red-700 text-white',
              orange: 'bg-orange-600 hover:bg-orange-700 text-white',
              blue: 'bg-blue-600 hover:bg-blue-700 text-white',
            };
            return (
              <button
                key={action.id}
                onClick={() => handleBulkAction(action.id)}
                className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 ${colorClasses[action.color]}`}
              >
                <Icon className="w-3 h-3" />
                {action.label}
              </button>
            );
          })}
          <button
            onClick={() => {
              setSelectedItems(new Set());
              visibleItems.forEach(item => onSelectItem?.(item.id, false));
            }}
            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Clear
          </button>
        </div>
      )}

      {/* Items List */}
      {visibleItems.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No items match your filters
        </div>
      ) : (
        visibleItems.map((item) => {
          const isExpanded = expandedItems.has(item.id);
          const isSelected = selectedItems.has(item.id);
          const hasDiscount = item.discount && item.discount > 0;
          const displayTotal = item.discountedTotal || item.total;
          const isVoided = item.isVoided;
          const stockWarning = item.isLowStock || (item.availableStock !== undefined && item.availableStock < item.quantity);
          const isOutOfStock = item.isOutOfStock || item.availableStock === 0;

          return (
            <div
              key={item.id}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow border ${
                isVoided 
                  ? 'border-red-300 dark:border-red-700 opacity-60' 
                  : isOutOfStock
                    ? 'border-red-300 dark:border-red-700'
                    : stockWarning 
                      ? 'border-yellow-300 dark:border-yellow-700' 
                      : isSelected
                        ? 'border-blue-400 dark:border-blue-700 ring-1 ring-blue-400'
                        : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="p-3">
                <div className="flex items-center gap-3">
                  {/* Select checkbox */}
                  {onSelectItem && !isVoided && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectItem(item.id)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                  )}

                  {/* Product Image */}
                  <div className="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                    {item.product.images?.[0] ? (
                      <img
                        src={item.product.images[0]}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-7 h-7 text-gray-400 dark:text-gray-500" />
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {item.product.name}
                      </p>
                      {isVoided && (
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-xs rounded-full flex-shrink-0">
                          Voided
                        </span>
                      )}
                      {isOutOfStock && (
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-xs rounded-full flex-shrink-0">
                          Out of Stock
                        </span>
                      )}
                      {stockWarning && !isOutOfStock && (
                        <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 text-xs rounded-full flex-shrink-0">
                          Low Stock
                        </span>
                      )}
                      {hasDiscount && (
                        <span className="px-1.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs rounded-full flex-shrink-0">
                          {item.discount}% Off
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
                      <span>{formatCurrency(item.unitPrice)} each</span>
                      {item.availableStock !== undefined && (
                        <span className={`text-xs ${isOutOfStock ? 'text-red-500' : stockWarning ? 'text-yellow-500' : 'text-gray-400'}`}>
                          Stock: {item.availableStock}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                      disabled={isProcessing || isVoided || item.quantity <= 1}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Minus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                    <span className="w-8 text-center font-medium text-gray-900 dark:text-white">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                      disabled={isProcessing || isVoided || (maxQuantity !== undefined && item.quantity >= maxQuantity)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>

                  {/* Total */}
                  <div className="text-right min-w-[80px]">
                    <p className={`font-bold text-gray-900 dark:text-white ${hasDiscount ? 'line-through text-gray-400 dark:text-gray-500 text-sm' : ''}`}>
                      {formatCurrency(item.total)}
                    </p>
                    {hasDiscount && (
                      <p className="font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(displayTotal)}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => handleToggleExpand(item.id)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      title="Toggle details"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                    </button>
                    
                    {onApplyDiscount && !isVoided && !isOutOfStock && (
                      <button
                        onClick={() => setEditingDiscount(item.id)}
                        className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                        title="Apply discount"
                      >
                        <Tag className="w-4 h-4 text-green-500" />
                      </button>
                    )}
                    
                    {onUpdateNotes && !isVoided && (
                      <button
                        onClick={() => setEditingNotes(item.id)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Edit notes"
                      >
                        <Edit2 className="w-4 h-4 text-gray-500" />
                      </button>
                    )}
                    
                    {onDuplicateItem && !isVoided && (
                      <button
                        onClick={() => handleDuplicateItem(item.id)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Duplicate item"
                      >
                        <Copy className="w-4 h-4 text-gray-500" />
                      </button>
                    )}
                    
                    {onReorder && !isVoided && (
                      <button
                        onClick={() => handleReorder(item.id)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Reorder item"
                      >
                        <RefreshCw className="w-4 h-4 text-gray-500" />
                      </button>
                    )}
                    
                    {onVoidItem && !isVoided && (
                      <button
                        onClick={() => handleVoidItem(item.id)}
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-colors"
                        title="Void Item"
                      >
                        <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={isProcessing}
                      className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-colors disabled:opacity-50"
                      title="Remove Item"
                    >
                      <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {(item.notes || isExpanded) && (
                  <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                    {isExpanded && (
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-500 dark:text-gray-400">
                        {item.variant && (
                          <div>
                            <span className="font-medium">Variant:</span> {item.variant.name}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Unit Price:</span> {formatCurrency(item.unitPrice)}
                        </div>
                        {item.product.taxRate !== undefined && (
                          <div>
                            <span className="font-medium">Tax Rate:</span> {item.product.taxRate}%
                          </div>
                        )}
                        {item.product.costPrice !== undefined && (
                          <div>
                            <span className="font-medium">Cost:</span> {formatCurrency(item.product.costPrice)}
                          </div>
                        )}
                        {item.discount !== undefined && item.discount > 0 && (
                          <div>
                            <span className="font-medium">Discount:</span> {item.discount}% 
                            {item.discountedTotal !== undefined && (
                              <span className="text-green-600 ml-1">({formatCurrency(item.discountedTotal)} total)</span>
                            )}
                          </div>
                        )}
                        {item.product.barcode && (
                          <div>
                            <span className="font-medium">Barcode:</span> {item.product.barcode}
                          </div>
                        )}
                        {item.product.category && (
                          <div>
                            <span className="font-medium">Category:</span> {item.product.category.name}
                          </div>
                        )}
                        {item.addedAt && (
                          <div>
                            <span className="font-medium">Added:</span> {new Date(item.addedAt).toLocaleTimeString()}
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
                        <span className="font-medium">Void Reason:</span> {item.voidReason}
                        {item.voidedBy && <span> (by {item.voidedBy})</span>}
                        {item.voidedAt && <span className="text-xs block">at {new Date(item.voidedAt).toLocaleString()}</span>}
                      </div>
                    )}
                    
                    {isOutOfStock && (
                      <div className="text-sm text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>This item is currently out of stock</span>
                      </div>
                    )}
                    
                    {stockWarning && !isOutOfStock && (
                      <div className="text-sm text-yellow-600 dark:text-yellow-400 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Only {item.availableStock} units available in stock</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}

      {/* Voided Items Section */}
      {showVoided && voidedItems.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
            Voided Items ({voidedItems.length})
          </h4>
          {voidedItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-1.5 text-sm text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 last:border-0">
              <div className="flex items-center gap-2">
                <X className="w-3.5 h-3.5 text-red-500" />
                <span>{item.product.name}</span>
                <span className="text-xs text-gray-400">×{item.quantity}</span>
                {item.voidReason && (
                  <span className="text-xs text-red-400 truncate max-w-[100px]">({item.voidReason})</span>
                )}
              </div>
              <span>{formatCurrency(item.total)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Notes Modal */}
      {editingNotes && onUpdateNotes && (
        <ItemNotesModal
          isOpen={!!editingNotes}
          onClose={() => setEditingNotes(null)}
          onSave={(notes) => {
            handleUpdateNotes(editingNotes, notes);
            setEditingNotes(null);
          }}
          currentNotes={items.find(i => i.id === editingNotes)?.notes || ''}
          itemName={items.find(i => i.id === editingNotes)?.product.name}
        />
      )}

      {/* Discount Modal */}
      {editingDiscount && onApplyDiscount && (
        <DiscountModal
          isOpen={!!editingDiscount}
          onClose={() => setEditingDiscount(null)}
          onApply={(discount, type) => {
            handleApplyDiscount(editingDiscount, discount, type);
            setEditingDiscount(null);
          }}
          itemName={items.find(i => i.id === editingDiscount)?.product.name}
          currentDiscount={items.find(i => i.id === editingDiscount)?.discount}
          itemTotal={items.find(i => i.id === editingDiscount)?.total}
        />
      )}
    </div>
  );
}

export default CartItems;
