'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Clock,
  Package,
  DollarSign,
  FileText,
  RefreshCw,
  Printer,
  Settings,
  Building,
  ExternalLink,
  ListOrdered,
  PlusSquare,
  ClipboardList,
} from 'lucide-react';
import { PriceOverrideModal } from './PriceOverrideModal';
import { ReprintReceiptModal } from './ReprintReceiptModal';
import { useToast } from '../../../hooks/useToast';

// ============================================
// TYPES
// ============================================

interface PriceOverrideData {
  productName: string;
  originalPrice: number;
  newPrice: number;
  reason: string;
}

interface QuickActionsProps {
  onRefresh?: () => void;
  onViewSales?: () => void;
  /**
   * Called when the operator confirms a price override.
   *
   * The POS is responsible for translating the override into whatever
   * the current backend supports (today: a cart-level discount via
   * `cartService.applyDiscount`; when a per-item endpoint lands:
   * a direct mutation).
   *
   * When this prop is omitted, confirming the modal shows a warning
   * toast instead of a misleading success toast — the caller owns the
   * feature, so a missing handler is a wiring bug, not a silent no-op.
   */
  onPriceOverride?: (data: PriceOverrideData) => void;
  onShiftAction?: (action: string, data?: any) => void;
  onReprintReceipt?: (receiptNumber: string) => void;
  /** Optional override: if set, POS handles held orders inline. */
  onOpenHeldOrders?: () => void;
  /** POS.tsx should open its own CustomerSearchModal. */
  onOpenCustomerSearch?: () => void;
  heldOrdersCount?: number;
  className?: string;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function QuickActions({
  onRefresh,
  onViewSales,
  onPriceOverride,
  onShiftAction,
  onReprintReceipt,
  onOpenHeldOrders,
  onOpenCustomerSearch,
  heldOrdersCount = 0,
  className = '',
}: QuickActionsProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // ============================================
  // HANDLERS
  // ============================================

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
      router.push('/admin/sales');
    }
  };

  const handleHeldOrders = () => {
    if (onOpenHeldOrders) {
      onOpenHeldOrders();
      return;
    }
    router.push('/admin/orders?status=ON_HOLD');
  };

  const handleViewAllOrders = () => {
    router.push('/admin/orders');
  };

  const handleAddCustomer = () => {
    if (onOpenCustomerSearch) {
      onOpenCustomerSearch();
      return;
    }
    router.push('/admin/customers/create');
  };

  const handleViewCustomers = () => {
    router.push('/admin/customers');
  };

  const handleQuickProduct = () => {
    router.push('/admin/catalog/add');
  };

  const handleManageShift = () => {
    if (onShiftAction) {
      onShiftAction('open-dashboard');
      return;
    }
    router.push('/admin/shifts');
  };

  const handleManageRegisters = () => {
    router.push('/admin/shifts/registers');
  };

  const handleViewCatalog = () => {
    router.push('/admin/catalog');
  };

  /**
   * Confirming the price override modal.
   *
   * If a handler is wired, defer to it — the POS owns the backend
   * translation. Otherwise, surface a warning so the operator knows
   * the override was not applied.
   */
  const handlePriceOverrideConfirm = (data: PriceOverrideData) => {
    if (onPriceOverride) {
      onPriceOverride(data);
      setIsPriceModalOpen(false);
      showToast('Price override applied', 'success');
      return;
    }

    // No handler wired — surface the mistake instead of a false
    // success message.
    showToast(
      'Price override is not connected in this view. Please contact support.',
      'warning'
    );
    setIsPriceModalOpen(false);
  };

  const handleReprintConfirm = (receiptNumber: string) => {
    if (onReprintReceipt) {
      onReprintReceipt(receiptNumber);
    }
    setIsReceiptModalOpen(false);
  };

  // ============================================
  // RENDER
  // ============================================

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
            onClick={handleAddCustomer}
            color="blue"
          />

          <QuickActionButton
            icon={Clock}
            label={`Held Orders (${heldOrdersCount})`}
            onClick={handleHeldOrders}
            color="yellow"
            badge={heldOrdersCount > 0 ? heldOrdersCount : undefined}
            trailingIcon={ExternalLink}
          />

          <QuickActionButton
            icon={ClipboardList}
            label="All Orders"
            onClick={handleViewAllOrders}
            color="blue"
            trailingIcon={ExternalLink}
          />

          <QuickActionButton
            icon={Package}
            label="Quick Product"
            onClick={handleQuickProduct}
            color="green"
            trailingIcon={ExternalLink}
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
            icon={ListOrdered}
            label="View Customers"
            onClick={handleViewCustomers}
            color="blue"
            trailingIcon={ExternalLink}
          />

          <QuickActionButton
            icon={PlusSquare}
            label="View Catalog"
            onClick={handleViewCatalog}
            color="green"
            trailingIcon={ExternalLink}
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
            onClick={handleManageShift}
            color="orange"
            trailingIcon={ExternalLink}
          />

          <QuickActionButton
            icon={Building}
            label="Manage Registers"
            onClick={handleManageRegisters}
            color="orange"
            trailingIcon={ExternalLink}
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
          <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
            Tips
          </h4>
          <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
            <p>
              ⌨️{' '}
              <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                Ctrl+F
              </kbd>{' '}
              Focus search
            </p>
            <p>
              ⌨️{' '}
              <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                Ctrl+Shift+C
              </kbd>{' '}
              Checkout
            </p>
            <p>
              ⌨️{' '}
              <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                Ctrl+Shift+S
              </kbd>{' '}
              Shift manager
            </p>
            <p>
              ⌨️{' '}
              <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                F11
              </kbd>{' '}
              Fullscreen
            </p>
            <p>
              ⌨️{' '}
              <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                Esc
              </kbd>{' '}
              Close modals
            </p>
          </div>
        </div>
      </div>

      {/* Modals */}
      <PriceOverrideModal
        isOpen={isPriceModalOpen}
        onClose={() => setIsPriceModalOpen(false)}
        onConfirm={handlePriceOverrideConfirm}
      />

      <ReprintReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        onReprint={handleReprintConfirm}
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
  trailingIcon?: React.FC<{ className?: string }>;
}

function QuickActionButton({
  icon: Icon,
  label,
  onClick,
  color = 'gray',
  badge,
  disabled = false,
  trailingIcon: TrailingIcon,
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
      {TrailingIcon && (
        <TrailingIcon className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </button>
  );
}

export default QuickActions;
