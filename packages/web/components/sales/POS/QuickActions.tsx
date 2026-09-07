'use client';

import React, { useState } from 'react';
import {
  Users,
  Clock,
  Package,
  DollarSign,
  FileText,
  RefreshCw,
  Printer,
  Settings,
  Plus,
  Search,
  X,
  Loader2,
  User,
  Mail,
  Phone,
  CreditCard,
  Wallet,
  Banknote,
  Smartphone,
  Gift,
  Building,
  Check,
  AlertCircle
} from 'lucide-react';
import { useToast } from '../../common/Toast';
import { CustomerSearchModal } from './CustomerSearchModal';
import { QuickProductModal } from './QuickProductModal';
import { PriceOverrideModal } from './PriceOverrideModal';
// Comment out or remove the ShiftManagerModal import if it doesn't exist yet
// import { ShiftManagerModal } from './ShiftManagerModal';
import { ReprintReceiptModal } from './ReprintReceiptModal';

// Define types for the props
interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
}

interface PriceOverrideData {
  productName: string;
  originalPrice: number;
  newPrice: number;
  reason: string;
}

interface QuickActionsProps {
  onRefresh?: () => void;
  onViewSales?: () => void;
  onAddCustomer?: (customer: Customer) => void;
  onAddProduct?: (product: Product) => void;
  onPriceOverride?: (data: PriceOverrideData) => void;
  onShiftAction?: (action: string, data?: any) => void;
  onReprintReceipt?: (receiptNumber: string) => void;
  heldOrdersCount?: number;
  className?: string;
}

export function QuickActions({
  onRefresh,
  onViewSales,
  onAddCustomer,
  onAddProduct,
  onPriceOverride,
  onShiftAction,
  onReprintReceipt,
  heldOrdersCount = 0,
  className = '',
}: QuickActionsProps) {
  const { showToast } = useToast();
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
      showToast('Cart refreshed', 'success');
    }
  };

  const handleViewSales = () => {
    if (onViewSales) {
      onViewSales();
    } else {
      window.open('/admin/sales', '_blank');
    }
  };

  const handleShiftAction = (action: string, data?: any) => {
    if (onShiftAction) {
      onShiftAction(action, data);
    }
    setIsShiftModalOpen(false);
  };

  return (
    <>
      <div className={`space-y-2 ${className}`}>
        <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
          <span className="w-1 h-6 bg-blue-600 rounded-full"></span>
          Quick Actions
        </h3>
        <div className="space-y-2">
          <QuickActionButton
            icon={Users}
            label="Add Customer"
            onClick={() => setIsCustomerModalOpen(true)}
            color="blue"
          />
          <QuickActionButton
            icon={Clock}
            label={`Held Orders (${heldOrdersCount})`}
            onClick={() => showToast('Opening held orders...', 'info')}
            color="yellow"
            badge={heldOrdersCount > 0 ? heldOrdersCount : undefined}
          />
          <QuickActionButton
            icon={Package}
            label="Quick Product"
            onClick={() => setIsProductModalOpen(true)}
            color="green"
          />
          <QuickActionButton
            icon={DollarSign}
            label="Price Override"
            onClick={() => setIsPriceModalOpen(true)}
            color="purple"
          />
          <QuickActionButton
            icon={FileText}
            label="View Sales"
            onClick={handleViewSales}
            color="gray"
          />
          <QuickActionButton
            icon={RefreshCw}
            label="Refresh Cart"
            onClick={handleRefresh}
            color="blue"
          />
          <QuickActionButton
            icon={Settings}
            label="Manage Shift"
            onClick={() => setIsShiftModalOpen(true)}
            color="orange"
          />
          <QuickActionButton
            icon={Printer}
            label="Reprint Receipt"
            onClick={() => setIsReceiptModalOpen(true)}
            color="gray"
          />
        </div>

        {/* Tips Section */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Tips</h4>
          <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
            <p>⌨️ <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">Ctrl+F</kbd> Focus search</p>
            <p>⌨️ <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">Ctrl+Shift+C</kbd> Checkout</p>
            <p>⌨️ <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">F11</kbd> Fullscreen</p>
            <p>⌨️ <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">Esc</kbd> Close modals</p>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CustomerSearchModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSelectCustomer={(customer: Customer) => {
          if (onAddCustomer) onAddCustomer(customer);
          setIsCustomerModalOpen(false);
          showToast(`Customer ${customer.firstName} ${customer.lastName} selected`, 'success');
        }}
      />

      <QuickProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSelectProduct={(product: Product) => {
          if (onAddProduct) onAddProduct(product);
          setIsProductModalOpen(false);
          showToast(`${product.name} added to cart`, 'success');
        }}
      />

      <PriceOverrideModal
        isOpen={isPriceModalOpen}
        onClose={() => setIsPriceModalOpen(false)}
        onConfirm={(data: PriceOverrideData) => {
          if (onPriceOverride) onPriceOverride(data);
          setIsPriceModalOpen(false);
          showToast(`Price override applied`, 'success');
        }}
      />

      {/* Shift Manager Modal - Commented out until file exists */}
      {/* 
      <ShiftManagerModal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        onAction={handleShiftAction}
      />
      */}

      <ReprintReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        onReprint={(receiptNumber: string) => {
          if (onReprintReceipt) onReprintReceipt(receiptNumber);
          setIsReceiptModalOpen(false);
        }}
      />
    </>
  );
}

// ============================================
// QUICK ACTION BUTTON COMPONENT
// ============================================

interface QuickActionButtonProps {
  icon: React.FC<{ className?: string }>;
  label: string;
  onClick: () => void;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'yellow' | 'gray' | 'red';
  badge?: number | string;
  disabled?: boolean;
}

function QuickActionButton({
  icon: Icon,
  label,
  onClick,
  color = 'gray',
  badge,
  disabled = false,
}: QuickActionButtonProps) {
  const colorClasses: Record<string, string> = {
    blue: 'text-blue-500',
    green: 'text-green-500',
    purple: 'text-purple-500',
    orange: 'text-orange-500',
    yellow: 'text-yellow-500',
    red: 'text-red-500',
    gray: 'text-gray-500',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg flex items-center gap-3 transition-colors text-left text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed group relative"
    >
      <Icon className={`w-4 h-4 flex-shrink-0 ${colorClasses[color]}`} />
      <span className="flex-1 text-sm">{label}</span>
      {badge && (
        <span className="px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full min-w-[20px] text-center">
          {badge}
        </span>
      )}
    </button>
  );
}
