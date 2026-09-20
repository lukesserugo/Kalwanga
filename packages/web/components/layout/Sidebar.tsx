// D:\Projects\Kalwanga\packages\web\components\layout\Sidebar.tsx

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser, useClerk } from '@clerk/nextjs';
import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HomeIcon,
  ShoppingCartIcon,
  CubeIcon,
  ChartBarIcon,
  UsersIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  GlobeAltIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
  ChevronDoubleLeftIcon,
  XMarkIcon,
  TruckIcon,
  ClipboardDocumentListIcon,
  BellIcon,
  CalculatorIcon,
  ChartPieIcon,
  FolderIcon,
  TagIcon,
  BuildingStorefrontIcon,
  UserGroupIcon,
  ReceiptPercentIcon,
  HashtagIcon,
  ChevronDownIcon,
  Bars3Icon,
  DevicePhoneMobileIcon,
  ArrowPathIcon,
  UserPlusIcon,
  ClockIcon,
  DocumentArrowDownIcon,
  DocumentDuplicateIcon,
  EnvelopeIcon,
  PlusCircleIcon,
  ArrowUpTrayIcon,
  QrCodeIcon,
  ViewfinderCircleIcon,
  MagnifyingGlassIcon,
  BuildingOfficeIcon,
  ShoppingBagIcon,
  PlusIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentCheckIcon,
  InboxIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';

import { useOnboarding } from '../../hooks/useOnboarding';
import {
  buildPermissionsFromSet,
  isSuperAdminRole,
  type UserPermissions,
} from '../../types/permissions';

// ============================================
// TYPES
// ============================================

interface SubLink {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: keyof UserPermissions;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: keyof UserPermissions;
  subLinks?: SubLink[];
}

interface SidebarProps {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  onToggleCollapse: () => void;
  onToggleMobile: () => void;
  permissions?: UserPermissions;
}

// ============================================
// CUSTOM ICONS
// ============================================

const CreditCardIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className={className || 'w-6 h-6'}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
    />
  </svg>
);

const ShiftIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className={className || 'w-6 h-6'}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const RegisterIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className={className || 'w-6 h-6'}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.21 1.53-.09 1.99-.548l2.392-2.392a2.25 2.25 0 00-.548-1.99A60.07 60.07 0 0018.75 2.25H5.25a60.07 60.07 0 00-2.101 15.797c-.21.727.09 1.53.548 1.99l2.392 2.392a2.25 2.25 0 001.99.548 60.07 60.07 0 0115.797-2.101"
    />
  </svg>
);

// ============================================
// NAVIGATION LINKS
// ============================================

const publicLinks: SubLink[] = [
  { name: 'Home', href: '/', icon: HomeIcon },
  { name: 'Shop', href: '/shop', icon: CubeIcon },
  { name: 'Categories', href: '/categories', icon: GlobeAltIcon },
  { name: 'Cart', href: '/cart', icon: ShoppingCartIcon },
  { name: 'Checkout', href: '/checkout', icon: CurrencyDollarIcon },
];

const shiftSubLinks: SubLink[] = [
  { name: 'Shift Dashboard', href: '/admin/shifts', icon: ShiftIcon, permission: 'canViewShifts' },
  { name: 'Current Shift', href: '/admin/shifts/current', icon: ClockIcon, permission: 'canViewShifts' },
  { name: 'Shift History', href: '/admin/shifts/history', icon: DocumentTextIcon, permission: 'canViewShifts' },
  { name: 'Shift Statistics', href: '/admin/shifts/stats', icon: ChartBarIcon, permission: 'canViewShifts' },
  { name: 'Cash Registers', href: '/admin/shifts/registers', icon: RegisterIcon, permission: 'canViewRegisters' },
  { name: 'Cash Management', href: '/admin/shifts/cash', icon: CurrencyDollarIcon, permission: 'canManageCash' },
];

const cartSubLinks: SubLink[] = [
  { name: 'Cart Dashboard', href: '/admin/cart', icon: ShoppingCartIcon, permission: 'canViewCart' },
  { name: 'Cart History', href: '/admin/cart/history', icon: ClockIcon, permission: 'canViewCartHistory' },
  { name: 'Checkout', href: '/admin/cart/checkout', icon: CurrencyDollarIcon, permission: 'canCheckout' },
  { name: 'Abandoned Carts', href: '/admin/cart/abandoned', icon: ExclamationTriangleIcon, permission: 'canViewCart' },
  { name: 'Cart Analytics', href: '/admin/cart/analytics', icon: ChartPieIcon, permission: 'canViewCartHistory' },
  { name: 'Cart Settings', href: '/admin/cart/settings', icon: Cog6ToothIcon, permission: 'canManageCartSettings' },
];

const paymentSubLinks: SubLink[] = [
  { name: 'Payment Dashboard', href: '/admin/payments', icon: CreditCardIcon, permission: 'canViewPayments' },
  { name: 'Payment Providers', href: '/admin/payments/payment-providers', icon: CreditCardIcon, permission: 'canViewPayments' },
  { name: 'Payment History', href: '/admin/payments/history', icon: ClockIcon, permission: 'canViewPayments' },
  { name: 'Payment Stats', href: '/admin/payments/stats', icon: ChartBarIcon, permission: 'canViewPaymentStats' },
  { name: 'Refunds', href: '/admin/payments/refunds', icon: ArrowPathIcon, permission: 'canRefundPayments' },
  { name: 'Export Payments', href: '/admin/payments/export', icon: DocumentArrowDownIcon, permission: 'canExportPayments' },
  { name: 'Payment Settings', href: '/admin/payments/settings', icon: Cog6ToothIcon, permission: 'canManagePaymentSettings' },
];

const checkoutSubLinks: SubLink[] = [
  { name: 'Checkout Dashboard', href: '/admin/checkout', icon: ShoppingBagIcon, permission: 'canViewCheckout' },
  { name: 'Checkout Stats', href: '/admin/checkout/stats', icon: ChartBarIcon, permission: 'canViewCheckoutStats' },
  { name: 'Sales History', href: '/admin/checkout/history', icon: ClockIcon, permission: 'canViewCheckout' },
  { name: 'Payment Methods', href: '/admin/checkout/payment-methods', icon: CreditCardIcon, permission: 'canManageCheckout' },
  { name: 'Checkout Settings', href: '/admin/checkout/settings', icon: Cog6ToothIcon, permission: 'canManageCheckoutSettings' },
  { name: 'Export Data', href: '/admin/checkout/export', icon: DocumentArrowDownIcon, permission: 'canViewCheckout' },
];

const companySubLinks: SubLink[] = [
  { name: 'All Companies', href: '/admin/companies', icon: BuildingOfficeIcon, permission: 'canViewCompanies' },
  { name: 'Add Company', href: '/admin/companies/new', icon: PlusCircleIcon, permission: 'canManageCompanies' },
  { name: 'Reports', href: '/admin/companies/reports', icon: ChartBarIcon, permission: 'canViewReports' },
];

const businessUnitSubLinks: SubLink[] = [
  { name: 'All Business Units', href: '/admin/business-units', icon: BuildingStorefrontIcon, permission: 'canViewBusinessUnits' },
  { name: 'Add Business Unit', href: '/admin/business-units/new', icon: PlusCircleIcon, permission: 'canManageBusinessUnits' },
  { name: 'Users', href: '/admin/business-units/users', icon: UsersIcon, permission: 'canViewUsers' },
  { name: 'Reports', href: '/admin/business-units/reports', icon: ChartBarIcon, permission: 'canViewReports' },
  { name: 'Settings', href: '/admin/business-units/settings', icon: Cog6ToothIcon, permission: 'canManageSettings' },
];

const userManagementSubLinks: SubLink[] = [
  { name: 'All Users', href: '/admin/users', icon: UsersIcon, permission: 'canViewUsers' },
  { name: 'Add User', href: '/admin/users/add', icon: UserPlusIcon, permission: 'canCreateUsers' },
  { name: 'Import Users', href: '/admin/users/import', icon: ArrowUpTrayIcon, permission: 'canImportUsers' },
  { name: 'Invite Users', href: '/admin/users/invite', icon: EnvelopeIcon, permission: 'canInviteUsers' },
  { name: 'Groups', href: '/admin/users/groups', icon: UserGroupIcon, permission: 'canManageUserGroups' },
  { name: 'Roles', href: '/admin/users/roles', icon: ShieldCheckIcon, permission: 'canManageUserRoles' },
  { name: 'Settings', href: '/admin/users/settings', icon: Cog6ToothIcon, permission: 'canManageSettings' },
];

const catalogSubLinks: SubLink[] = [
  { name: 'All Products', href: '/admin/catalog', icon: CubeIcon, permission: 'canViewProducts' },
  { name: 'Add Product', href: '/admin/catalog/add', icon: PlusIcon, permission: 'canManageProducts' },
  { name: 'Categories', href: '/admin/categories', icon: FolderIcon, permission: 'canViewCategories' },
  { name: 'Suppliers', href: '/admin/suppliers', icon: TruckIcon, permission: 'canViewSuppliers' },
  { name: 'Import', href: '/admin/catalog/import', icon: DocumentTextIcon, permission: 'canImportProducts' },
  { name: 'Export', href: '/admin/catalog/export', icon: ChartBarIcon, permission: 'canExportProducts' },
  { name: 'Tags', href: '/admin/catalog/tags', icon: HashtagIcon, permission: 'canManageProducts' },
];

const inventorySubLinks: SubLink[] = [
  { name: 'Dashboard', href: '/admin/inventory', icon: ChartBarIcon, permission: 'canViewInventory' },
  { name: 'Add Item', href: '/admin/inventory/add', icon: PlusCircleIcon, permission: 'canManageInventory' },
  { name: 'Low Stock', href: '/admin/inventory/low-stock', icon: BellIcon, permission: 'canViewInventoryLowStock' },
  { name: 'Transfer', href: '/admin/inventory/transfer', icon: TruckIcon, permission: 'canTransferInventory' },
  { name: 'Locations', href: '/admin/locations', icon: MapPinIcon, permission: 'canViewInventory' },
  { name: 'Import', href: '/admin/inventory/import', icon: ArrowUpTrayIcon, permission: 'canImportInventory' },
  { name: 'Export', href: '/admin/inventory/export', icon: DocumentArrowDownIcon, permission: 'canExportInventory' },
  { name: 'Reports', href: '/admin/inventory/reports', icon: ChartPieIcon, permission: 'canViewInventoryReports' },
  { name: 'Audit Log', href: '/admin/inventory/audit', icon: ClipboardDocumentListIcon, permission: 'canViewInventoryAudit' },
  { name: 'Stock Count', href: '/admin/inventory/stock-count', icon: CalculatorIcon, permission: 'canManageStockCount' },
  { name: 'Valuation', href: '/admin/inventory/valuation', icon: CurrencyDollarIcon, permission: 'canViewInventoryValuation' },
  { name: 'Transactions', href: '/admin/inventory/transactions', icon: DocumentTextIcon, permission: 'canViewInventoryTransactions' },
  { name: 'Categories', href: '/admin/inventory/categories', icon: FolderIcon, permission: 'canManageCategories' },
  { name: 'Suppliers', href: '/admin/inventory/suppliers', icon: TruckIcon, permission: 'canManageSuppliers' },
  { name: 'Settings', href: '/admin/inventory/settings', icon: Cog6ToothIcon, permission: 'canManageSettings' },
];

const locationsSubLinks: SubLink[] = [
  { name: 'Locations Dashboard', href: '/admin/locations', icon: MapPinIcon, permission: 'canViewInventory' },
  { name: 'Add Location', href: '/admin/locations/add', icon: PlusCircleIcon, permission: 'canManageInventory' },
  { name: 'Transfer Stock', href: '/admin/locations/transfer', icon: TruckIcon, permission: 'canTransferInventory' },
  { name: 'Stock Count', href: '/admin/locations/stock-count', icon: CalculatorIcon, permission: 'canManageStockCount' },
  { name: 'Import Locations', href: '/admin/locations/import', icon: ArrowUpTrayIcon, permission: 'canImportInventory' },
  { name: 'Export Locations', href: '/admin/locations/export', icon: DocumentArrowDownIcon, permission: 'canExportInventory' },
  { name: 'Location Reports', href: '/admin/locations/reports', icon: ChartPieIcon, permission: 'canViewInventoryReports' },
  { name: 'Location Audit', href: '/admin/locations/audit', icon: ClipboardDocumentListIcon, permission: 'canViewInventoryAudit' },
  { name: 'Location Settings', href: '/admin/locations/settings', icon: Cog6ToothIcon, permission: 'canManageSettings' },
];

const barcodeSubLinks: SubLink[] = [
  { name: 'All Barcodes', href: '/admin/barcodes', icon: QrCodeIcon, permission: 'canViewBarcodes' },
  { name: 'Scan Barcode', href: '/admin/barcodes/scan', icon: ViewfinderCircleIcon, permission: 'canViewBarcodes' },
  { name: 'Generate Barcodes', href: '/admin/barcodes/generate', icon: PlusCircleIcon, permission: 'canManageBarcodes' },
  { name: 'Barcode Lookup', href: '/admin/barcodes/lookup', icon: MagnifyingGlassIcon, permission: 'canViewBarcodes' },
  { name: 'Barcode Settings', href: '/admin/barcodes/settings', icon: Cog6ToothIcon, permission: 'canManageSettings' },
];

const salesSubLinks: SubLink[] = [
  { name: 'POS Terminal', href: '/admin/sales/pos', icon: DevicePhoneMobileIcon, permission: 'canManagePos' },
  { name: 'Add Customer', href: '/admin/sales/pos?action=customer', icon: UserPlusIcon, permission: 'canManageCustomers' },
  { name: 'Quick Product', href: '/admin/sales/pos?action=product', icon: ShoppingCartIcon, permission: 'canViewProducts' },
  { name: 'Price Override', href: '/admin/sales/pos?action=price', icon: TagIcon, permission: 'canManageSales' },
  { name: 'Reprint Receipt', href: '/admin/sales/pos?action=receipt', icon: DocumentDuplicateIcon, permission: 'canPrintReceipts' },
  { name: 'All Sales', href: '/admin/sales', icon: CurrencyDollarIcon, permission: 'canViewSales' },
  { name: 'Sales Dashboard', href: '/admin/sales/dashboard', icon: ChartPieIcon, permission: 'canViewSales' },
  { name: 'Sales Analytics', href: '/admin/sales/analytics', icon: ChartBarIcon, permission: 'canViewAnalytics' },
  { name: 'Sales Settings', href: '/admin/sales/settings', icon: Cog6ToothIcon, permission: 'canManageSales' },
  { name: 'Returns', href: '/admin/sales/returns', icon: ReceiptPercentIcon, permission: 'canViewReturns' },
  { name: 'Refunds', href: '/admin/sales/refunds', icon: ArrowRightOnRectangleIcon, permission: 'canManageReturns' },
  { name: 'Invoices', href: '/admin/sales/invoices', icon: DocumentTextIcon, permission: 'canViewInvoices' },
  { name: 'Receipts', href: '/admin/sales/receipts', icon: DocumentTextIcon, permission: 'canViewReceipts' },
  { name: 'Sales Reports', href: '/admin/sales/reports', icon: ChartPieIcon, permission: 'canViewReports' },
  { name: 'Export Sales', href: '/admin/sales/export', icon: DocumentArrowDownIcon, permission: 'canViewSales' },
];

const ordersSubLinks: SubLink[] = [
  { name: 'All Orders', href: '/admin/orders', icon: ClipboardDocumentListIcon, permission: 'canViewOrders' },
  { name: 'Pending Orders', href: '/admin/orders?status=PENDING', icon: ClockIcon, permission: 'canViewOrders' },
  { name: 'Processing', href: '/admin/orders?status=PROCESSING', icon: ArrowPathIcon, permission: 'canViewOrders' },
  { name: 'On Hold', href: '/admin/orders?status=ON_HOLD', icon: InboxIcon, permission: 'canViewOrders' },
  { name: 'Completed', href: '/admin/orders?status=COMPLETED', icon: CheckCircleIcon, permission: 'canViewOrders' },
  { name: 'Cancelled', href: '/admin/orders?status=CANCELLED', icon: XCircleIcon, permission: 'canViewOrders' },
  { name: 'Create Order', href: '/admin/orders/create', icon: PlusCircleIcon, permission: 'canManageOrders' },
  { name: 'Order Analytics', href: '/admin/orders/analytics', icon: ChartPieIcon, permission: 'canViewOrders' },
  { name: 'Order Settings', href: '/admin/orders/settings', icon: Cog6ToothIcon, permission: 'canManageOrders' },
];

const customersSubLinks: SubLink[] = [
  { name: 'All Customers', href: '/admin/customers', icon: UserGroupIcon, permission: 'canViewCustomers' },
  { name: 'Add Customer', href: '/admin/customers/create', icon: UserPlusIcon, permission: 'canManageCustomers' },
];

const supplierSubLinks: SubLink[] = [
  { name: 'All Suppliers', href: '/admin/suppliers', icon: TruckIcon, permission: 'canViewSuppliers' },
  { name: 'Add Supplier', href: '/admin/suppliers/create', icon: PlusCircleIcon, permission: 'canCreateSuppliers' },
  { name: 'Import Suppliers', href: '/admin/suppliers/import', icon: ArrowUpTrayIcon, permission: 'canManageSuppliers' },
  { name: 'Export Suppliers', href: '/admin/suppliers/export', icon: DocumentArrowDownIcon, permission: 'canManageSuppliers' },
  { name: 'Supplier Products', href: '/admin/suppliers/products', icon: CubeIcon, permission: 'canViewSupplierProducts' },
  { name: 'Supplier Orders', href: '/admin/suppliers/orders', icon: ClipboardDocumentListIcon, permission: 'canViewSupplierOrders' },
  { name: 'Supplier Reports', href: '/admin/suppliers/reports', icon: ChartPieIcon, permission: 'canViewReports' },
  { name: 'Settings', href: '/admin/suppliers/settings', icon: Cog6ToothIcon, permission: 'canManageSettings' },
];

const bookkeepingSubLinks: SubLink[] = [
  { name: 'Overview', href: '/admin/bookkeeping', icon: HomeIcon, permission: 'canViewBookkeeping' },
  { name: 'Chart of Accounts', href: '/admin/bookkeeping/accounts', icon: ClipboardDocumentListIcon, permission: 'canViewAccounts' },
  { name: 'Journal Entries', href: '/admin/bookkeeping/journal-entries', icon: DocumentTextIcon, permission: 'canViewJournalEntries' },
  { name: 'Reports', href: '/admin/bookkeeping/reports', icon: ChartPieIcon, permission: 'canViewReports' },
  { name: 'Balance Sheet', href: '/admin/bookkeeping/reports/balance-sheet', icon: ChartBarIcon, permission: 'canViewReports' },
  { name: 'Income Statement', href: '/admin/bookkeeping/reports/income-statement', icon: ChartPieIcon, permission: 'canViewReports' },
  { name: 'Trial Balance', href: '/admin/bookkeeping/reports/trial-balance', icon: CalculatorIcon, permission: 'canViewReports' },
  { name: 'Settings', href: '/admin/bookkeeping/settings', icon: Cog6ToothIcon, permission: 'canManageSettings' },
];

// ============================================
// NOTIFICATION SUB-LINKS (NEW)
// ============================================
//
// Three destinations, all under `/admin/notifications`:
//
//   Inbox        — the main list, filters, bulk actions
//   Templates    — customize alert content per type
//   Settings     — per-user channels, quiet hours, frequency
//
// All three are visible to any signed-in user with `canViewDashboard`,
// which is the flag the notifications page already guards on. If you
// want stricter gating (e.g. only MANAGER+ can edit templates), swap
// the `permission` on the specific SubLink — nothing else changes.

const notificationSubLinks: SubLink[] = [
  { name: 'Inbox', href: '/admin/notifications', icon: BellIcon, permission: 'canViewDashboard' },
  { name: 'Templates', href: '/admin/notifications/templates', icon: DocumentDuplicateIcon, permission: 'canViewDashboard' },
  { name: 'Settings', href: '/admin/notifications/settings', icon: Cog6ToothIcon, permission: 'canViewDashboard' },
];

const dashboardLinks: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: ChartBarIcon, permission: 'canViewDashboard' },
  { name: 'Shifts', href: '/admin/shifts', icon: ShiftIcon, permission: 'canViewShifts', subLinks: shiftSubLinks },
  { name: 'Bookkeeping', href: '/admin/bookkeeping', icon: DocumentTextIcon, permission: 'canViewBookkeeping', subLinks: bookkeepingSubLinks },
  { name: 'Cart', href: '/admin/cart', icon: ShoppingCartIcon, permission: 'canViewCart', subLinks: cartSubLinks },
  { name: 'Checkout', href: '/admin/checkout', icon: CurrencyDollarIcon, permission: 'canViewCheckout', subLinks: checkoutSubLinks },
  { name: 'Payments', href: '/admin/payments', icon: CreditCardIcon, permission: 'canViewPayments', subLinks: paymentSubLinks },
  { name: 'Companies', href: '/admin/companies', icon: BuildingOfficeIcon, permission: 'canViewCompanies', subLinks: companySubLinks },
  { name: 'Business Units', href: '/admin/business-units', icon: BuildingStorefrontIcon, permission: 'canViewBusinessUnits', subLinks: businessUnitSubLinks },
  { name: 'Catalog', href: '/admin/catalog', icon: CubeIcon, permission: 'canViewProducts', subLinks: catalogSubLinks },
  { name: 'Barcodes', href: '/admin/barcodes', icon: QrCodeIcon, permission: 'canViewBarcodes', subLinks: barcodeSubLinks },
  { name: 'Inventory', href: '/admin/inventory', icon: BuildingStorefrontIcon, permission: 'canViewInventory', subLinks: inventorySubLinks },
  { name: 'Locations', href: '/admin/locations', icon: MapPinIcon, permission: 'canViewInventory', subLinks: locationsSubLinks },
  { name: 'Sales', href: '/admin/sales', icon: CurrencyDollarIcon, permission: 'canViewSales', subLinks: salesSubLinks },
  { name: 'Orders', href: '/admin/orders', icon: ClipboardDocumentCheckIcon, permission: 'canViewOrders', subLinks: ordersSubLinks },
  { name: 'Customers', href: '/admin/customers', icon: UserGroupIcon, permission: 'canViewCustomers', subLinks: customersSubLinks },
  { name: 'Suppliers', href: '/admin/suppliers', icon: TruckIcon, permission: 'canViewSuppliers', subLinks: supplierSubLinks },
  { name: 'Users', href: '/admin/users', icon: UsersIcon, permission: 'canViewUsers', subLinks: userManagementSubLinks },
  { name: 'Notifications', href: '/admin/notifications', icon: BellIcon, permission: 'canViewDashboard', subLinks: notificationSubLinks },
  { name: 'Reports', href: '/admin/reports', icon: ChartPieIcon, permission: 'canViewReports' },
  { name: 'Categories', href: '/admin/categories', icon: FolderIcon, permission: 'canViewCategories' },
  { name: 'Settings', href: '/admin/settings', icon: Cog6ToothIcon, permission: 'canManageSettings' },
];

// ============================================
// MAIN SIDEBAR COMPONENT
// ============================================

export default function Sidebar({
  isCollapsed,
  isMobileOpen,
  onToggleCollapse,
  onToggleMobile,
  permissions: userPermissions,
}: SidebarProps) {
  const pathname = usePathname();
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const [expandedSubMenu, setExpandedSubMenu] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const { isRouteBlocked } = useOnboarding();

  const isSuperAdmin = useMemo(() => {
    if (!user) return false;
    const meta = user.publicMetadata as Record<string, unknown> | undefined;
    const unsafe = user.unsafeMetadata as Record<string, unknown> | undefined;
    const roleFromMeta = typeof meta?.role === 'string' ? meta.role : null;
    const roleFromUnsafe =
      typeof unsafe?.role === 'string' ? unsafe.role : null;
    return isSuperAdminRole(roleFromMeta) || isSuperAdminRole(roleFromUnsafe);
  }, [user]);

  const permissions = useMemo<UserPermissions>(() => {
    if (isSuperAdmin) {
      return buildPermissionsFromSet(['*']);
    }
    const permissiveDefault = buildPermissionsFromSet(['*']);
    return { ...permissiveDefault, ...userPermissions };
  }, [isSuperAdmin, userPermissions]);

  const isLinkVisible = useMemo(() => {
    return (href: string, permission?: keyof UserPermissions): boolean => {
      if (isSuperAdmin) return true;
      if (permission && permissions[permission] === false) return false;
      if (isRouteBlocked(href)) return false;
      return true;
    };
  }, [isSuperAdmin, permissions, isRouteBlocked]);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/';
  };

  const getInitials = () => {
    const firstName = user?.firstName || '';
    const lastName = user?.lastName || '';
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || 'U';
  };

  const getFullName = () => {
    const firstName = user?.firstName || '';
    const lastName = user?.lastName || '';
    return `${firstName} ${lastName}`.trim() || 'Guest';
  };

  const getUserEmail = () => {
    return user?.emailAddresses?.[0]?.emailAddress || '';
  };

  const isActive = (href: string): boolean => {
    if (href === '/') return pathname === '/';
    if (href === '/dashboard')
      return pathname === '/dashboard' || pathname?.startsWith('/dashboard/');
    if (href.includes('?')) {
      const basePath = href.split('?')[0];
      return pathname === basePath || pathname?.startsWith(basePath + '/');
    }
    return pathname === href || pathname?.startsWith(href + '/');
  };

  const isSubLinkActive = (subLinks: SubLink[]): boolean =>
    subLinks.some((link) => isActive(link.href));

  const handleSubMenuToggle = (href: string) => {
    setExpandedSubMenu((prev) => (prev === href ? null : href));
  };

  const filteredDashboardLinks = useMemo(
    () =>
      dashboardLinks.filter((item) =>
        isLinkVisible(item.href, item.permission)
      ),
    [isLinkVisible]
  );

  useEffect(() => {
    if (!pathname) return;

    if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
      setExpandedSubMenu(null);
      return;
    }

    for (const link of filteredDashboardLinks) {
      if (!link.subLinks || link.subLinks.length === 0) continue;
      const hasActiveSub = link.subLinks.some((sub) => isActive(sub.href));
      if (hasActiveSub) {
        setExpandedSubMenu(link.href);
        return;
      }
    }

    const subLinkGroups: Array<{ base: string; menuKey: string }> = [
      { base: '/admin/shifts', menuKey: '/admin/shifts' },
      { base: '/admin/bookkeeping', menuKey: '/admin/bookkeeping' },
      { base: '/admin/payments', menuKey: '/admin/payments' },
      { base: '/admin/checkout', menuKey: '/admin/checkout' },
      { base: '/admin/cart', menuKey: '/admin/cart' },
      { base: '/admin/suppliers', menuKey: '/admin/suppliers' },
      { base: '/admin/companies', menuKey: '/admin/companies' },
      { base: '/admin/business-units', menuKey: '/admin/business-units' },
      { base: '/admin/inventory', menuKey: '/admin/inventory' },
      { base: '/admin/locations', menuKey: '/admin/locations' },
      { base: '/admin/barcodes', menuKey: '/admin/barcodes' },
      { base: '/admin/users', menuKey: '/admin/users' },
      { base: '/admin/notifications', menuKey: '/admin/notifications' },
      { base: '/admin/catalog', menuKey: '/admin/catalog' },
      { base: '/admin/sales', menuKey: '/admin/sales' },
      { base: '/admin/orders', menuKey: '/admin/orders' },
      { base: '/admin/customers', menuKey: '/admin/customers' },
    ];

    for (const group of subLinkGroups) {
      if (pathname === group.base || pathname.startsWith(group.base + '/')) {
        setExpandedSubMenu(group.menuKey);
        return;
      }
    }
  }, [pathname, filteredDashboardLinks]);

  // ============================================
  // RENDER HELPERS
  // ============================================

  const renderNavLink = (item: SubLink) => {
    const active = isActive(item.href);

    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch={false}
        title={isCollapsed ? item.name : undefined}
        className={`group flex items-center ${
          isCollapsed ? 'justify-center' : 'gap-3'
        } px-2 py-2 rounded-lg transition-all duration-150 relative focus-ring ${
          active
            ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
            : 'text-gray-600 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'
        } ${isCollapsed ? 'w-full' : ''}`}
        onClick={() => {
          if (isMobileOpen) onToggleMobile();
        }}
      >
        <item.icon
          className={`w-5 h-5 flex-shrink-0 ${
            active
              ? 'text-brand-600 dark:text-brand-400'
              : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'
          }`}
        />

        {!isCollapsed && (
          <span
            className={`font-medium text-sm flex-1 ${
              active
                ? 'text-brand-600 dark:text-brand-400'
                : 'text-gray-700 dark:text-gray-300'
            }`}
          >
            {item.name}
          </span>
        )}

        {!isCollapsed && active && (
          <span className="w-1.5 h-1.5 bg-brand-500 rounded-full flex-shrink-0" />
        )}

        {isCollapsed && active && (
          <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand-500 rounded-l-full" />
        )}
      </Link>
    );
  };

  const renderSectionHeader = (title: string) => {
    if (isCollapsed) {
      return (
        <div className="flex justify-center my-1">
          <div className="w-4 h-px bg-gray-300 dark:bg-gray-600" />
        </div>
      );
    }
    return (
      <div className="px-2 py-1">
        <p className="text-2xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          {title}
        </p>
      </div>
    );
  };

  const renderExpandableMenuItem = (item: NavItem) => {
    const active = isActive(item.href);
    const hasSubLinks = !!item.subLinks && item.subLinks.length > 0;
    const isSubActive = hasSubLinks && isSubLinkActive(item.subLinks!);
    const isExpanded = expandedSubMenu === item.href;
    const isItemActive = active || isSubActive;

    const visibleSubLinks =
      item.subLinks?.filter((subLink) =>
        isLinkVisible(subLink.href, subLink.permission)
      ) ?? [];

    if (visibleSubLinks.length === 0 && !isItemActive) {
      return null;
    }

    if (isCollapsed) {
      return (
        <div key={item.href} className="relative group">
          <button
            className={`flex items-center justify-center px-2 py-2 rounded-lg transition-all duration-150 relative w-full focus-ring ${
              isItemActive
                ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'
            }`}
            title={item.name}
          >
            <item.icon
              className={`w-5 h-5 ${
                isItemActive
                  ? 'text-brand-600 dark:text-brand-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            />
            {isItemActive && (
              <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand-500 rounded-l-full" />
            )}

            {hasSubLinks && visibleSubLinks.length > 0 && (
              <div className="absolute left-full top-0 ml-1 w-56 bg-white dark:bg-gray-800 rounded-2xl shadow-card-hover border border-gray-200 dark:border-gray-700 z-toast hidden group-hover:block custom-scrollbar">
                <div className="p-2">
                  <p className="px-3 py-1 text-2xs font-semibold text-gray-400 dark:text-gray-500 uppercase">
                    {item.name}
                  </p>
                  {visibleSubLinks.map((subLink) => {
                    const subActive = isActive(subLink.href);
                    return (
                      <Link
                        key={subLink.href}
                        href={subLink.href}
                        prefetch={false}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors focus-ring ${
                          subActive
                            ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700'
                        }`}
                        onClick={() => {
                          if (isMobileOpen) onToggleMobile();
                        }}
                      >
                        <subLink.icon className="w-4 h-4 flex-shrink-0" />
                        <span>{subLink.name}</span>
                        {subActive && (
                          <span className="ml-auto w-1.5 h-1.5 bg-brand-500 rounded-full" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </button>
        </div>
      );
    }

    return (
      <div key={item.href}>
        <button
          onClick={() => handleSubMenuToggle(item.href)}
          className={`group w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-all duration-150 focus-ring ${
            isItemActive
              ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
              : 'text-gray-600 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <item.icon
            className={`w-5 h-5 flex-shrink-0 ${
              isItemActive
                ? 'text-brand-600 dark:text-brand-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          />
          <span
            className={`font-medium text-sm flex-1 text-left ${
              isItemActive
                ? 'text-brand-600 dark:text-brand-400'
                : 'text-gray-700 dark:text-gray-300'
            }`}
          >
            {item.name}
          </span>
          <ChevronDownIcon
            className={`w-4 h-4 transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            } text-gray-400`}
          />
          {isItemActive && !isExpanded && (
            <span className="w-1.5 h-1.5 bg-brand-500 rounded-full flex-shrink-0" />
          )}
        </button>

        {hasSubLinks && isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="ml-7 mt-1 space-y-0.5 overflow-hidden"
          >
            {visibleSubLinks.map((subLink) => {
              const subActive = isActive(subLink.href);
              return (
                <Link
                  key={subLink.href}
                  href={subLink.href}
                  prefetch={false}
                  className={`flex items-center gap-3 px-2 py-1.5 rounded-lg transition-all duration-150 text-sm focus-ring ${
                    subActive
                      ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-gray-700/50 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                  onClick={() => {
                    if (isMobileOpen) onToggleMobile();
                  }}
                >
                  <subLink.icon className="w-4 h-4 flex-shrink-0" />
                  <span>{subLink.name}</span>
                  {subActive && (
                    <span className="ml-auto w-1.5 h-1.5 bg-brand-500 rounded-full" />
                  )}
                </Link>
              );
            })}
          </motion.div>
        )}
      </div>
    );
  };

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <>
      <aside
        ref={sidebarRef}
        className={`hidden lg:flex fixed inset-y-0 left-0 z-header bg-white dark:bg-gray-900 shadow-soft flex-col overflow-y-auto border-r border-gray-200 dark:border-gray-800 transition-all duration-300 sidebar-scroll ${
          isCollapsed ? 'w-[72px]' : 'w-[280px]'
        }`}
      >
        <div
          className={`p-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0 flex items-center ${
            isCollapsed ? 'justify-center' : 'justify-between'
          } w-full`}
        >
          {!isCollapsed ? (
            <Link
              href="/"
              prefetch={false}
              className="flex items-center gap-2 group focus-ring rounded-lg"
            >
              <div className="w-8 h-8 bg-brand-gradient rounded-xl flex items-center justify-center shadow-brand group-hover:shadow-brand-lg transition-all">
                <span className="text-white font-bold text-sm">P</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-brand-gradient">
                  POS System
                </h1>
                <p className="text-2xs text-gray-400 -mt-0.5">Point of Sale</p>
              </div>
            </Link>
          ) : (
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-800 transition-all focus-ring"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <Bars3Icon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </button>
          )}

          {!isCollapsed && (
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-800 transition-all focus-ring"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronDoubleLeftIcon className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-1 px-1.5 sidebar-scroll">
          <div className="mb-1">
            {renderSectionHeader('Shop')}
            {publicLinks.map((link) => renderNavLink(link))}
          </div>

          {isLoaded && isSignedIn && (
            <div className="mb-1">
              {renderSectionHeader('Admin Dashboard')}
              {filteredDashboardLinks.map((item) => {
                if (item.subLinks && item.subLinks.length > 0) {
                  return renderExpandableMenuItem(item);
                }
                return renderNavLink(item);
              })}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-800 p-2 flex-shrink-0">
          {!isCollapsed ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 p-1.5 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <div className="w-8 h-8 rounded-full bg-brand-gradient flex items-center justify-center text-white font-semibold text-xs shadow-brand flex-shrink-0">
                  {getInitials()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                    {getFullName()}
                  </p>
                  <p className="text-2xs text-gray-500 dark:text-gray-400 truncate">
                    {getUserEmail()}
                  </p>
                </div>
              </div>
              {isLoaded && isSignedIn ? (
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center px-3 py-1.5 text-xs font-medium text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg transition-all duration-200 border border-danger-200 dark:border-danger-800 focus-ring"
                >
                  <ArrowRightOnRectangleIcon className="w-4 h-4 mr-1.5" />
                  Sign Out
                </button>
              ) : (
                <Link
                  href="/sign-in"
                  prefetch={false}
                  className="w-full flex items-center justify-center px-3 py-1.5 text-xs font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-all duration-200 border border-brand-200 dark:border-brand-800 focus-ring"
                >
                  <ArrowRightOnRectangleIcon className="w-4 h-4 mr-1.5" />
                  Sign In
                </Link>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-brand-gradient flex items-center justify-center text-white font-semibold text-xs shadow-brand">
                {getInitials()}
              </div>
              {isLoaded && isSignedIn ? (
                <button
                  onClick={handleSignOut}
                  className="p-1 text-gray-700 dark:text-gray-300 hover:text-danger-600 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg transition-all duration-200 focus-ring"
                  title="Sign Out"
                >
                  <ArrowRightOnRectangleIcon className="w-4 h-4" />
                </button>
              ) : (
                <Link
                  href="/sign-in"
                  prefetch={false}
                  className="p-1 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-all duration-200 focus-ring"
                  title="Sign In"
                >
                  <ArrowRightOnRectangleIcon className="w-4 h-4" />
                </Link>
              )}
            </div>
          )}
        </div>
      </aside>

      <AnimatePresence>
        {isMobileOpen && (
          <>
            <div
              className="fixed inset-0 z-drawer bg-black/50 backdrop-blur-sm"
              onClick={onToggleMobile}
            />
            <motion.div
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-modal w-[280px] bg-white dark:bg-gray-900 shadow-card-hover flex flex-col"
            >
              <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-brand-gradient rounded-xl flex items-center justify-center shadow-brand">
                    <span className="text-white font-bold text-sm">P</span>
                  </div>
                  <h1 className="text-lg font-bold text-brand-gradient">
                    POS System
                  </h1>
                </div>
                <button
                  onClick={onToggleMobile}
                  className="p-2 hover:bg-orange-50 dark:hover:bg-gray-800 rounded-xl transition-all focus-ring"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-4 sidebar-scroll">
                <div className="mb-4">
                  <p className="text-2xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 px-3">
                    Shop
                  </p>
                  {publicLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={false}
                      onClick={onToggleMobile}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 focus-ring ${
                        isActive(item.href)
                          ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-gray-800/50'
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium text-sm">{item.name}</span>
                      {isActive(item.href) && (
                        <span className="ml-auto w-2 h-2 bg-brand-500 rounded-full" />
                      )}
                    </Link>
                  ))}
                </div>

                {isLoaded && isSignedIn && (
                  <div className="mb-4">
                    <p className="text-2xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 px-3">
                      Admin Dashboard
                    </p>
                    {filteredDashboardLinks.map((item) => {
                      const isItemActive = isActive(item.href);
                      const hasSubLinks =
                        !!item.subLinks && item.subLinks.length > 0;
                      const isExpanded = expandedSubMenu === item.href;

                      const visibleSubLinks =
                        item.subLinks?.filter((subLink) =>
                          isLinkVisible(subLink.href, subLink.permission)
                        ) ?? [];

                      return (
                        <div key={item.href}>
                          <button
                            onClick={() => {
                              if (hasSubLinks) {
                                setExpandedSubMenu(
                                  isExpanded ? null : item.href
                                );
                              } else {
                                window.location.href = item.href;
                              }
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 focus-ring ${
                              isItemActive
                                ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-gray-800/50'
                            }`}
                          >
                            <item.icon className="w-5 h-5" />
                            <span className="font-medium text-sm">
                              {item.name}
                            </span>
                            {hasSubLinks && (
                              <ChevronDownIcon
                                className={`w-4 h-4 ml-auto transition-transform duration-200 ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                              />
                            )}
                            {!hasSubLinks && isItemActive && (
                              <span className="ml-auto w-2 h-2 bg-brand-500 rounded-full" />
                            )}
                          </button>
                          {hasSubLinks &&
                            isExpanded &&
                            visibleSubLinks.length > 0 && (
                              <div className="ml-6 mt-1 space-y-0.5">
                                {visibleSubLinks.map((subLink) => (
                                  <Link
                                    key={subLink.href}
                                    href={subLink.href}
                                    prefetch={false}
                                    onClick={onToggleMobile}
                                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm focus-ring ${
                                      isActive(subLink.href)
                                        ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                                        : 'text-gray-500 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-gray-800/50'
                                    }`}
                                  >
                                    <subLink.icon className="w-4 h-4" />
                                    <span>{subLink.name}</span>
                                    {isActive(subLink.href) && (
                                      <span className="ml-auto w-1.5 h-1.5 bg-brand-500 rounded-full" />
                                    )}
                                  </Link>
                                ))}
                              </div>
                            )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 dark:border-gray-800 p-4">
                {isLoaded && isSignedIn ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-2 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                      <div className="w-10 h-10 rounded-full bg-brand-gradient flex items-center justify-center text-white font-semibold text-sm shadow-brand">
                        {getInitials()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {getFullName()}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {getUserEmail()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        onToggleMobile();
                        handleSignOut();
                      }}
                      className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-xl transition-all duration-200 border border-danger-200 dark:border-danger-800 focus-ring"
                    >
                      <ArrowRightOnRectangleIcon className="w-5 h-5 mr-2" />
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <Link
                    href="/sign-in"
                    prefetch={false}
                    className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-xl transition-all duration-200 border border-brand-200 dark:border-brand-800 focus-ring"
                  >
                    <ArrowRightOnRectangleIcon className="w-5 h-5 mr-2" />
                    Sign In
                  </Link>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div
        className={`hidden lg:block flex-shrink-0 transition-all duration-300 ${
          isCollapsed ? 'w-[72px]' : 'w-[280px]'
        }`}
      />
    </>
  );
}
