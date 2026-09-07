// D:\Projects\Kalwanga\packages\web\components\layout\Sidebar.tsx

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser, useClerk } from '@clerk/nextjs';
import { useState, useCallback, useEffect } from 'react';
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
  StarIcon,
  CurrencyDollarIcon,
  RocketLaunchIcon,
  QuestionMarkCircleIcon,
  ShieldCheckIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
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
  PrinterIcon,
  ArrowPathIcon,
  UserPlusIcon,
  ClockIcon,
  DocumentArrowDownIcon,
  DocumentDuplicateIcon,
  KeyIcon,
  UserCircleIcon,
  EnvelopeIcon,
  PhoneIcon,
  CalendarIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  PlusCircleIcon,
  MinusCircleIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  PencilSquareIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  LockOpenIcon,
  UserMinusIcon,
  QrCodeIcon,
  ViewfinderCircleIcon,
  MagnifyingGlassIcon,
  BuildingOfficeIcon,
  ClipboardIcon,
  ListBulletIcon,
  PlusIcon,
  PencilIcon,
  EyeIcon as EyeIconSolid,
  ShoppingBagIcon,
  GiftIcon,
  HeartIcon,
  CreditCardIcon as CreditCardIconHero,
} from '@heroicons/react/24/outline';

interface UserPermissions {
  canViewDashboard: boolean;
  canViewCategories: boolean;
  canManageCategories: boolean;
  canViewProducts: boolean;
  canManageProducts: boolean;
  canViewOrders: boolean;
  canManageOrders: boolean;
  canViewCustomers: boolean;
  canManageCustomers: boolean;
  canViewInventory: boolean;
  canManageInventory: boolean;
  canViewReports: boolean;
  canManageUsers: boolean;
  canManageSettings: boolean;
  canExportProducts: boolean;
  canImportProducts: boolean;
  canViewSuppliers: boolean;
  canManageSuppliers: boolean;
  canViewSales: boolean;
  canManageSales: boolean;
  canViewAnalytics: boolean;
  canManagePos: boolean;
  canViewReturns: boolean;
  canManageReturns: boolean;
  canViewInvoices: boolean;
  canManageInvoices: boolean;
  canViewReceipts: boolean;
  canPrintReceipts: boolean;
  canViewUsers: boolean;
  canCreateUsers: boolean;
  canEditUsers: boolean;
  canDeleteUsers: boolean;
  canManageUserRoles: boolean;
  canManageUserPermissions: boolean;
  canViewUserActivity: boolean;
  canExportUsers: boolean;
  canImportUsers: boolean;
  canInviteUsers: boolean;
  canManageUserGroups: boolean;
  canViewInventoryAudit: boolean;
  canExportInventory: boolean;
  canImportInventory: boolean;
  canAdjustInventory: boolean;
  canTransferInventory: boolean;
  canViewLowStock: boolean;
  canManageStockCount: boolean;
  canViewInventoryValuation: boolean;
  canViewInventoryTransactions: boolean;
  canViewBarcodes: boolean;
  canManageBarcodes: boolean;
  // Supplier permissions
  canCreateSuppliers: boolean;
  canEditSuppliers: boolean;
  canDeleteSuppliers: boolean;
  canViewSupplierProducts: boolean;
  canViewSupplierOrders: boolean;
  // Business Unit permissions
  canViewBusinessUnits: boolean;
  canManageBusinessUnits: boolean;
  // Company permissions
  canViewCompanies: boolean;
  canManageCompanies: boolean;
  // Cart permissions
  canViewCart: boolean;
  canManageCart: boolean;
  canCheckout: boolean;
  canViewCartHistory: boolean;
  canManageCartSettings: boolean;
  // Checkout permissions
  canViewCheckout: boolean;
  canManageCheckout: boolean;
  canViewCheckoutStats: boolean;
  canManageCheckoutStats: boolean;
  canViewCheckoutSettings: boolean;
  canManageCheckoutSettings: boolean;
  // Payment permissions
  canViewPayments: boolean;
  canManagePayments: boolean;
  canViewPaymentStats: boolean;
  canManagePaymentStats: boolean;
  canViewPaymentSettings: boolean;
  canManagePaymentSettings: boolean;
  canExportPayments: boolean;
  canRefundPayments: boolean;
}

interface SidebarProps {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  onToggleCollapse: () => void;
  onToggleMobile: () => void;
  permissions?: UserPermissions;
}

// ============================================
// CREDIT CARD ICON
// ============================================
const CreditCardIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-6 h-6"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
  </svg>
);

// Public Navigation Links
const publicLinks = [
  { name: 'Home', href: '/', icon: HomeIcon },
  { name: 'Shop', href: '/shop', icon: CubeIcon },
  { name: 'Categories', href: '/categories', icon: GlobeAltIcon },
  { name: 'Cart', href: '/cart', icon: ShoppingCartIcon },
  { name: 'Checkout', href: '/checkout', icon: CurrencyDollarIcon },
];

// ============================================
// CART SUB-LINKS
// ============================================
const cartSubLinks = [
  { name: 'Cart Dashboard', href: '/admin/cart', icon: ShoppingCartIcon, permission: 'canViewCart' },
  { name: 'Cart History', href: '/admin/cart/history', icon: ClockIcon, permission: 'canViewCartHistory' },
  { name: 'Checkout', href: '/admin/cart/checkout', icon: CurrencyDollarIcon, permission: 'canCheckout' },
  { name: 'Abandoned Carts', href: '/admin/cart/abandoned', icon: ExclamationTriangleIcon, permission: 'canViewCart' },
  { name: 'Cart Analytics', href: '/admin/cart/analytics', icon: ChartPieIcon, permission: 'canViewCartHistory' },
  { name: 'Cart Settings', href: '/admin/cart/settings', icon: Cog6ToothIcon, permission: 'canManageCartSettings' },
];

// ============================================
// ✅ PAYMENT SUB-LINKS - UPDATED WITH NEW ROUTE STRUCTURE
// ============================================
const paymentSubLinks = [
  { name: 'Payment Dashboard', href: '/admin/payments', icon: CreditCardIcon, permission: 'canViewPayments' },
  { name: 'Payment Providers', href: '/admin/payments/payment-providers', icon: CreditCardIcon, permission: 'canViewPayments' },
  { name: 'Payment History', href: '/admin/payments/history', icon: ClockIcon, permission: 'canViewPayments' },
  { name: 'Payment Stats', href: '/admin/payments/stats', icon: ChartBarIcon, permission: 'canViewPaymentStats' },
  { name: 'Refunds', href: '/admin/payments/refunds', icon: ArrowPathIcon, permission: 'canRefundPayments' },
  { name: 'Export Payments', href: '/admin/payments/export', icon: DocumentArrowDownIcon, permission: 'canExportPayments' },
  { name: 'Payment Settings', href: '/admin/payments/settings', icon: Cog6ToothIcon, permission: 'canManagePaymentSettings' },
];

// ============================================
// CHECKOUT SUB-LINKS
// ============================================
const checkoutSubLinks = [
  { name: 'Checkout Dashboard', href: '/admin/checkout', icon: ShoppingBagIcon, permission: 'canViewCheckout' },
  { name: 'Checkout Stats', href: '/admin/checkout/stats', icon: ChartBarIcon, permission: 'canViewCheckoutStats' },
  { name: 'Sales History', href: '/admin/checkout/history', icon: ClockIcon, permission: 'canViewCheckout' },
  { name: 'Payment Methods', href: '/admin/checkout/payment-methods', icon: CreditCardIcon, permission: 'canManageCheckout' },
  { name: 'Checkout Settings', href: '/admin/checkout/settings', icon: Cog6ToothIcon, permission: 'canManageCheckoutSettings' },
  { name: 'Export Data', href: '/admin/checkout/export', icon: DocumentArrowDownIcon, permission: 'canViewCheckout' },
];

// ============================================
// COMPANY SUB-LINKS
// ============================================
const companySubLinks = [
  { name: 'All Companies', href: '/admin/companies', icon: BuildingOfficeIcon, permission: 'canViewCompanies' },
  { name: 'Add Company', href: '/admin/companies/new', icon: PlusCircleIcon, permission: 'canManageCompanies' },
  { name: 'Settings', href: '/admin/companies/settings', icon: Cog6ToothIcon, permission: 'canManageSettings' },
  { name: 'Reports', href: '/admin/companies/reports', icon: ChartBarIcon, permission: 'canViewReports' },
];

// ============================================
// BUSINESS UNIT SUB-LINKS
// ============================================
const businessUnitSubLinks = [
  { name: 'All Business Units', href: '/admin/business-units', icon: BuildingStorefrontIcon, permission: 'canViewBusinessUnits' },
  { name: 'Add Business Unit', href: '/admin/business-units/new', icon: PlusCircleIcon, permission: 'canManageBusinessUnits' },
  { name: 'Users', href: '/admin/business-units/users', icon: UsersIcon, permission: 'canViewUsers' },
  { name: 'Reports', href: '/admin/business-units/reports', icon: ChartBarIcon, permission: 'canViewReports' },
  { name: 'Settings', href: '/admin/business-units/settings', icon: Cog6ToothIcon, permission: 'canManageSettings' },
];

// ============================================
// USER MANAGEMENT SUB-LINKS
// ============================================
const userManagementSubLinks = [
  { name: 'All Users', href: '/admin/users', icon: UsersIcon, permission: 'canViewUsers' },
  { name: 'Add User', href: '/admin/users/add', icon: UserPlusIcon, permission: 'canCreateUsers' },
  { name: 'Import Users', href: '/admin/users/import', icon: ArrowUpTrayIcon, permission: 'canImportUsers' },
  { name: 'Invite Users', href: '/admin/users/invite', icon: EnvelopeIcon, permission: 'canInviteUsers' },
  { name: 'Groups', href: '/admin/users/groups', icon: UserGroupIcon, permission: 'canManageUserGroups' },
  { name: 'Roles', href: '/admin/users/roles', icon: ShieldCheckIcon, permission: 'canManageUserRoles' },
  { name: 'Settings', href: '/admin/users/settings', icon: Cog6ToothIcon, permission: 'canManageSettings' },
];

// ============================================
// CATALOG SUB-LINKS
// ============================================
const catalogSubLinks = [
  { name: 'All Products', href: '/admin/catalog', icon: CubeIcon, permission: 'canViewProducts' },
  { name: 'Add Product', href: '/admin/catalog/add', icon: ShoppingCartIcon, permission: 'canManageProducts' },
  { name: 'Categories', href: '/admin/catalog/categories', icon: FolderIcon, permission: 'canViewCategories' },
  { name: 'Suppliers', href: '/admin/catalog/suppliers', icon: TruckIcon, permission: 'canViewSuppliers' },
  { name: 'Import', href: '/admin/catalog/import', icon: DocumentTextIcon, permission: 'canImportProducts' },
  { name: 'Export', href: '/admin/catalog/export', icon: ChartBarIcon, permission: 'canExportProducts' },
  { name: 'Tags', href: '/admin/catalog/tags', icon: HashtagIcon, permission: 'canManageProducts' },
];

// ============================================
// INVENTORY SUB-LINKS
// ============================================
const inventorySubLinks = [
  { name: 'Dashboard', href: '/admin/inventory', icon: ChartBarIcon, permission: 'canViewInventory' },
  { name: 'Add Item', href: '/admin/inventory/add', icon: PlusCircleIcon, permission: 'canManageInventory' },
  { name: 'Low Stock', href: '/admin/inventory/low-stock', icon: BellIcon, permission: 'canViewLowStock' },
  { name: 'Transfer', href: '/admin/inventory/transfer', icon: TruckIcon, permission: 'canTransferInventory' },
  { name: 'Import', href: '/admin/inventory/import', icon: ArrowUpTrayIcon, permission: 'canImportInventory' },
  { name: 'Export', href: '/admin/inventory/export', icon: DocumentArrowDownIcon, permission: 'canExportInventory' },
  { name: 'Reports', href: '/admin/inventory/reports', icon: ChartPieIcon, permission: 'canViewReports' },
  { name: 'Audit Log', href: '/admin/inventory/audit', icon: ClipboardDocumentListIcon, permission: 'canViewInventoryAudit' },
  { name: 'Stock Count', href: '/admin/inventory/stock-count', icon: CalculatorIcon, permission: 'canManageStockCount' },
  { name: 'Valuation', href: '/admin/inventory/valuation', icon: CurrencyDollarIcon, permission: 'canViewInventoryValuation' },
  { name: 'Transactions', href: '/admin/inventory/transactions', icon: DocumentTextIcon, permission: 'canViewInventoryTransactions' },
  { name: 'Categories', href: '/admin/inventory/categories', icon: FolderIcon, permission: 'canManageCategories' },
  { name: 'Suppliers', href: '/admin/inventory/suppliers', icon: TruckIcon, permission: 'canManageSuppliers' },
  { name: 'Settings', href: '/admin/inventory/settings', icon: Cog6ToothIcon, permission: 'canManageSettings' },
];

// ============================================
// BARCODE SUB-LINKS
// ============================================
const barcodeSubLinks = [
  { name: 'All Barcodes', href: '/admin/barcodes', icon: QrCodeIcon, permission: 'canViewBarcodes' },
  { name: 'Scan Barcode', href: '/admin/barcodes/scan', icon: ViewfinderCircleIcon, permission: 'canViewBarcodes' },
  { name: 'Generate Barcodes', href: '/admin/barcodes/generate', icon: PlusCircleIcon, permission: 'canManageBarcodes' },
  { name: 'Barcode Lookup', href: '/admin/barcodes/lookup', icon: MagnifyingGlassIcon, permission: 'canViewBarcodes' },
  { name: 'Barcode Settings', href: '/admin/barcodes/settings', icon: Cog6ToothIcon, permission: 'canManageSettings' },
];

// ============================================
// SALES SUB-LINKS
// ============================================
const salesSubLinks = [
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

// ============================================
// CUSTOMERS SUB-LINKS
// ============================================
const customersSubLinks = [
  { name: 'All Customers', href: '/admin/customers', icon: UserGroupIcon, permission: 'canViewCustomers' },
  { name: 'Add Customer', href: '/admin/customers/create', icon: UserPlusIcon, permission: 'canManageCustomers' },
];

// ============================================
// SUPPLIER SUB-LINKS
// ============================================
const supplierSubLinks = [
  { name: 'All Suppliers', href: '/admin/suppliers', icon: TruckIcon, permission: 'canViewSuppliers' },
  { name: 'Add Supplier', href: '/admin/suppliers/create', icon: PlusCircleIcon, permission: 'canCreateSuppliers' },
  { name: 'Import Suppliers', href: '/admin/suppliers/import', icon: ArrowUpTrayIcon, permission: 'canManageSuppliers' },
  { name: 'Export Suppliers', href: '/admin/suppliers/export', icon: DocumentArrowDownIcon, permission: 'canManageSuppliers' },
  { name: 'Supplier Products', href: '/admin/suppliers/products', icon: CubeIcon, permission: 'canViewSupplierProducts' },
  { name: 'Supplier Orders', href: '/admin/suppliers/orders', icon: ClipboardDocumentListIcon, permission: 'canViewSupplierOrders' },
  { name: 'Supplier Reports', href: '/admin/suppliers/reports', icon: ChartPieIcon, permission: 'canViewReports' },
  { name: 'Settings', href: '/admin/suppliers/settings', icon: Cog6ToothIcon, permission: 'canManageSettings' },
];

// ============================================
// DASHBOARD LINKS - UPDATED WITH PAYMENT PROVIDERS ROUTE
// ============================================
const dashboardLinks = [
  { 
    name: 'Dashboard', 
    href: '/admin/dashboard',
    icon: ChartBarIcon, 
    permission: 'canViewDashboard' 
  },
  { 
    name: 'Cart',
    href: '/admin/cart', 
    icon: ShoppingCartIcon,
    permission: 'canViewCart',
    subLinks: cartSubLinks 
  },
  { 
    name: 'Checkout',
    href: '/admin/checkout', 
    icon: CurrencyDollarIcon,
    permission: 'canViewCheckout',
    subLinks: checkoutSubLinks 
  },
  { 
    name: 'Payments',
    href: '/admin/payments', 
    icon: CreditCardIcon,
    permission: 'canViewPayments',
    subLinks: paymentSubLinks 
  },
  { 
    name: 'Companies',
    href: '/admin/companies', 
    icon: BuildingOfficeIcon,
    permission: 'canViewCompanies',
    subLinks: companySubLinks 
  },
  { 
    name: 'Business Units',
    href: '/admin/business-units', 
    icon: BuildingStorefrontIcon,
    permission: 'canViewBusinessUnits',
    subLinks: businessUnitSubLinks 
  },
  { 
    name: 'Catalog',
    href: '/admin/catalog', 
    icon: CubeIcon, 
    permission: 'canViewProducts',
    subLinks: catalogSubLinks 
  },
  { 
    name: 'Barcodes',
    href: '/admin/barcodes', 
    icon: QrCodeIcon, 
    permission: 'canViewBarcodes',
    subLinks: barcodeSubLinks 
  },
  { 
    name: 'Inventory', 
    href: '/admin/inventory', 
    icon: BuildingStorefrontIcon, 
    permission: 'canViewInventory', 
    subLinks: inventorySubLinks 
  },
  { 
    name: 'Sales', 
    href: '/admin/sales', 
    icon: CurrencyDollarIcon, 
    permission: 'canViewSales',
    subLinks: salesSubLinks 
  },
  { 
    name: 'Customers', 
    href: '/admin/customers', 
    icon: UserGroupIcon, 
    permission: 'canViewCustomers',
    subLinks: customersSubLinks
  },
  { 
    name: 'Suppliers',
    href: '/admin/suppliers',
    icon: TruckIcon,
    permission: 'canViewSuppliers',
    subLinks: supplierSubLinks
  },
  { 
    name: 'Users', 
    href: '/admin/users', 
    icon: UsersIcon, 
    permission: 'canViewUsers',
    subLinks: userManagementSubLinks
  },
  { 
    name: 'Reports', 
    href: '/admin/reports', 
    icon: ChartPieIcon, 
    permission: 'canViewReports' 
  },
  { 
    name: 'Categories', 
    href: '/admin/categories', 
    icon: FolderIcon, 
    permission: 'canViewCategories' 
  },
  { 
    name: 'Settings', 
    href: '/admin/settings', 
    icon: Cog6ToothIcon, 
    permission: 'canManageSettings' 
  },
];

const infoLinks = [
  { name: 'Features', href: '/features', icon: StarIcon },
  { name: 'Pricing', href: '/pricing', icon: CurrencyDollarIcon },
  { name: 'Demo', href: '/demo', icon: RocketLaunchIcon },
  { name: 'Help', href: '/help', icon: QuestionMarkCircleIcon },
  { name: 'Privacy', href: '/privacy', icon: ShieldCheckIcon },
  { name: 'Terms', href: '/terms', icon: DocumentTextIcon },
];

const defaultPermissions: UserPermissions = {
  canViewDashboard: true,
  canViewCategories: true,
  canManageCategories: false,
  canViewProducts: true,
  canManageProducts: false,
  canViewOrders: true,
  canManageOrders: false,
  canViewCustomers: true,
  canManageCustomers: false,
  canViewInventory: true,
  canManageInventory: false,
  canViewReports: true,
  canManageUsers: false,
  canManageSettings: false,
  canExportProducts: false,
  canImportProducts: false,
  canViewSuppliers: true,
  canManageSuppliers: false,
  canViewSales: true,
  canManageSales: false,
  canViewAnalytics: true,
  canManagePos: true,
  canViewReturns: true,
  canManageReturns: false,
  canViewInvoices: true,
  canManageInvoices: false,
  canViewReceipts: true,
  canPrintReceipts: true,
  canViewUsers: true,
  canCreateUsers: false,
  canEditUsers: false,
  canDeleteUsers: false,
  canManageUserRoles: false,
  canManageUserPermissions: false,
  canViewUserActivity: true,
  canExportUsers: false,
  canImportUsers: false,
  canInviteUsers: false,
  canManageUserGroups: false,
  canViewInventoryAudit: true,
  canExportInventory: false,
  canImportInventory: false,
  canAdjustInventory: false,
  canTransferInventory: false,
  canViewLowStock: true,
  canManageStockCount: false,
  canViewInventoryValuation: true,
  canViewInventoryTransactions: true,
  canViewBarcodes: true,
  canManageBarcodes: false,
  // Supplier permissions
  canCreateSuppliers: true,
  canEditSuppliers: true,
  canDeleteSuppliers: false,
  canViewSupplierProducts: true,
  canViewSupplierOrders: true,
  // Business Unit permissions
  canViewBusinessUnits: true,
  canManageBusinessUnits: false,
  // Company permissions
  canViewCompanies: true,
  canManageCompanies: false,
  // Cart permissions
  canViewCart: true,
  canManageCart: true,
  canCheckout: true,
  canViewCartHistory: true,
  canManageCartSettings: true,
  // Checkout permissions
  canViewCheckout: true,
  canManageCheckout: true,
  canViewCheckoutStats: true,
  canManageCheckoutStats: true,
  canViewCheckoutSettings: true,
  canManageCheckoutSettings: true,
  // Payment permissions
  canViewPayments: true,
  canManagePayments: true,
  canViewPaymentStats: true,
  canManagePaymentStats: true,
  canViewPaymentSettings: true,
  canManagePaymentSettings: true,
  canExportPayments: true,
  canRefundPayments: true,
};

export default function Sidebar({ 
  isCollapsed, 
  isMobileOpen, 
  onToggleCollapse, 
  onToggleMobile,
  permissions: userPermissions 
}: SidebarProps) {
  const pathname = usePathname();
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const [expandedSubMenu, setExpandedSubMenu] = useState<string | null>('/admin/companies');

  const permissions = { ...defaultPermissions, ...userPermissions };

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

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    if (href.includes('?')) {
      const basePath = href.split('?')[0];
      return pathname === basePath || pathname?.startsWith(basePath + '/');
    }
    return pathname === href || pathname?.startsWith(href + '/');
  };

  const isSubLinkActive = (subLinks: typeof inventorySubLinks) => {
    return subLinks.some(link => isActive(link.href));
  };

  const filteredDashboardLinks = dashboardLinks.filter(item => {
    if (!permissions) return true;
    if (!item.permission) return true;
    const permissionKey = item.permission as keyof UserPermissions;
    return permissions[permissionKey] !== false;
  });

  // Auto-expand submenu based on current path
  useEffect(() => {
    if (pathname) {
      // Check payment sub-links first (including payment-providers)
      const isPaymentActive = paymentSubLinks.some(sub => isActive(sub.href));
      if (isPaymentActive || pathname.includes('/admin/payments') || pathname.includes('/admin/payments/payment-providers')) {
        setExpandedSubMenu('/admin/payments');
        return;
      }

      // Check checkout sub-links
      const isCheckoutActive = checkoutSubLinks.some(sub => isActive(sub.href));
      if (isCheckoutActive || pathname.includes('/admin/checkout')) {
        setExpandedSubMenu('/admin/checkout');
        return;
      }

      // Check cart sub-links
      const isCartActive = cartSubLinks.some(sub => isActive(sub.href));
      if (isCartActive) {
        setExpandedSubMenu('/admin/cart');
        return;
      }

      // Check supplier sub-links
      const isSupplierActive = supplierSubLinks.some(sub => isActive(sub.href));
      if (isSupplierActive) {
        setExpandedSubMenu('/admin/suppliers');
        return;
      }

      // Check company sub-links
      const isCompanyActive = companySubLinks.some(sub => isActive(sub.href));
      if (isCompanyActive) {
        setExpandedSubMenu('/admin/companies');
        return;
      }

      // Check business unit sub-links
      const isBusinessUnitActive = businessUnitSubLinks.some(sub => isActive(sub.href));
      if (isBusinessUnitActive) {
        setExpandedSubMenu('/admin/business-units');
        return;
      }

      // Check inventory sub-links
      const isInventoryActive = inventorySubLinks.some(sub => isActive(sub.href));
      if (isInventoryActive) {
        setExpandedSubMenu('/admin/inventory');
        return;
      }

      // Check barcode sub-links
      const isBarcodeActive = barcodeSubLinks.some(sub => isActive(sub.href));
      if (isBarcodeActive) {
        setExpandedSubMenu('/admin/barcodes');
        return;
      }

      // Check user management sub-links
      const isUserManagementActive = userManagementSubLinks.some(sub => isActive(sub.href));
      if (isUserManagementActive) {
        setExpandedSubMenu('/admin/users');
        return;
      }

      // Check catalog sub-links
      const isCatalogActive = catalogSubLinks.some(sub => isActive(sub.href));
      if (isCatalogActive) {
        setExpandedSubMenu('/admin/catalog');
        return;
      }

      // Check sales sub-links
      const isSalesActive = salesSubLinks.some(sub => isActive(sub.href));
      if (isSalesActive) {
        setExpandedSubMenu('/admin/sales');
        return;
      }

      // Check customers sub-links
      const isCustomersActive = customersSubLinks.some(sub => isActive(sub.href));
      if (isCustomersActive) {
        setExpandedSubMenu('/admin/customers');
        return;
      }

      // Check if we're on a main dashboard page
      for (const link of filteredDashboardLinks) {
        if (link.subLinks) {
          const isSubActive = link.subLinks.some(sub => isActive(sub.href));
          if (isSubActive) {
            setExpandedSubMenu(link.href);
            break;
          }
        }
      }
    }
  }, [pathname, filteredDashboardLinks]);

  // Render a simple nav link (no children)
  const renderNavLink = (item: { name: string; href: string; icon: any }) => {
    const active = isActive(item.href);
    
    return (
      <Link
        key={item.href}
        href={item.href}
        title={isCollapsed ? item.name : undefined}
        className={`group flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-2 py-2 rounded-lg transition-all duration-150 relative ${
          active 
            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'
        } ${isCollapsed ? 'w-full' : ''}`}
      >
        <item.icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'}`} />
        
        {!isCollapsed && (
          <span className={`font-medium text-sm flex-1 ${active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
            {item.name}
          </span>
        )}
        
        {!isCollapsed && active && (
          <span className="w-1.5 h-1.5 bg-blue-600 rounded-full flex-shrink-0" />
        )}
        
        {isCollapsed && active && (
          <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-l-full"></span>
        )}
      </Link>
    );
  };

  // Render section header
  const renderSectionHeader = (title: string) => {
    if (isCollapsed) {
      return <div className="flex justify-center my-1"><div className="w-4 h-px bg-gray-300 dark:bg-gray-600"></div></div>;
    }
    return (
      <div className="px-2 py-1">
        <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          {title}
        </p>
      </div>
    );
  };

  // Render expandable menu item
  const renderExpandableMenuItem = (item: any) => {
    const active = isActive(item.href);
    const hasSubLinks = item.subLinks && item.subLinks.length > 0;
    const isSubActive = hasSubLinks && isSubLinkActive(item.subLinks);
    const isExpanded = expandedSubMenu === item.href;
    const isItemActive = active || isSubActive;
    
    const visibleSubLinks = item.subLinks?.filter((subLink: any) => {
      if (subLink.permission && permissions) {
        const permissionKey = subLink.permission as keyof UserPermissions;
        return permissions[permissionKey] !== false;
      }
      return true;
    }) || [];

    if (visibleSubLinks.length === 0 && !isItemActive) {
      return null;
    }

    // Collapsed mode
    if (isCollapsed) {
      return (
        <div key={item.href} className="relative group">
          <button
            className={`flex items-center justify-center px-2 py-2 rounded-lg transition-all duration-150 relative w-full ${
              isItemActive 
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'
            }`}
            title={item.name}
          >
            <item.icon className={`w-5 h-5 ${isItemActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`} />
            {isItemActive && (
              <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-l-full"></span>
            )}
            
            {hasSubLinks && visibleSubLinks.length > 0 && (
              <div className="absolute left-full top-0 ml-1 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 hidden group-hover:block">
                <div className="p-2">
                  <p className="px-3 py-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">
                    {item.name}
                  </p>
                  {visibleSubLinks.map((subLink: any) => {
                    const subActive = isActive(subLink.href);
                    return (
                      <Link
                        key={subLink.href}
                        href={subLink.href}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          subActive
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <subLink.icon className="w-4 h-4 flex-shrink-0" />
                        <span>{subLink.name}</span>
                        {subActive && (
                          <span className="ml-auto w-1.5 h-1.5 bg-blue-600 rounded-full" />
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

    // Expanded mode
    return (
      <div key={item.href}>
        <button
          onClick={() => setExpandedSubMenu(isExpanded ? null : item.href)}
          className={`group w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-all duration-150 ${
            isItemActive 
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <item.icon className={`w-5 h-5 flex-shrink-0 ${isItemActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`} />
          <span className={`font-medium text-sm flex-1 text-left ${isItemActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
            {item.name}
          </span>
          <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''} text-gray-400`} />
          {isItemActive && (
            <span className="w-1.5 h-1.5 bg-blue-600 rounded-full flex-shrink-0" />
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
            {visibleSubLinks.map((subLink: any) => {
              const subActive = isActive(subLink.href);
              return (
                <Link
                  key={subLink.href}
                  href={subLink.href}
                  className={`flex items-center gap-3 px-2 py-1.5 rounded-lg transition-all duration-150 text-sm ${
                    subActive
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <subLink.icon className="w-4 h-4 flex-shrink-0" />
                  <span>{subLink.name}</span>
                  {subActive && (
                    <span className="ml-auto w-1.5 h-1.5 bg-blue-600 rounded-full" />
                  )}
                </Link>
              );
            })}
          </motion.div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside 
        className={`hidden lg:flex fixed inset-y-0 left-0 z-40 bg-white dark:bg-gray-900 shadow-xl flex-col overflow-y-auto border-r border-gray-200 dark:border-gray-800 transition-all duration-300 ${
          isCollapsed ? 'w-[72px]' : 'w-[280px]'
        }`}
      >
        {/* Header */}
        <div className={`p-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} w-full`}>
          {!isCollapsed ? (
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-all">
                <span className="text-white font-bold text-sm">P</span>
              </div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  POS System
                </h1>
                <p className="text-[10px] text-gray-400 -mt-0.5">Point of Sale</p>
              </div>
            </Link>
          ) : (
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <Bars3Icon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </button>
          )}
          
          {!isCollapsed && (
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronDoubleLeftIcon className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>
        
        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-1 px-1.5 sidebar-scroll">
          {/* Public Section */}
          <div className="mb-1">
            {renderSectionHeader('Shop')}
            {publicLinks.map(link => renderNavLink(link))}
          </div>

          {/* Admin Dashboard Section */}
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

          {/* Info Section */}
          <div className="mb-1">
            {renderSectionHeader('Information')}
            {infoLinks.map(link => renderNavLink(link))}
          </div>
        </div>

        {/* User profile */}
        <div className="border-t border-gray-200 dark:border-gray-800 p-2 flex-shrink-0">
          {!isCollapsed ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 p-1.5 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center text-white font-semibold text-xs shadow-md flex-shrink-0">
                  {getInitials()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                    {getFullName()}
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                    {getUserEmail()}
                  </p>
                </div>
              </div>
              {isLoaded && isSignedIn ? (
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 border border-red-200 dark:border-red-800"
                >
                  <ArrowRightOnRectangleIcon className="w-4 h-4 mr-1.5" />
                  Sign Out
                </button>
              ) : (
                <Link
                  href="/sign-in"
                  className="w-full flex items-center justify-center px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200 border border-blue-200 dark:border-blue-800"
                >
                  <ArrowRightOnRectangleIcon className="w-4 h-4 mr-1.5" />
                  Sign In
                </Link>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center text-white font-semibold text-xs shadow-md">
                {getInitials()}
              </div>
              {isLoaded && isSignedIn ? (
                <button
                  onClick={handleSignOut}
                  className="p-1 text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
                  title="Sign Out"
                >
                  <ArrowRightOnRectangleIcon className="w-4 h-4" />
                </button>
              ) : (
                <Link
                  href="/sign-in"
                  className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200"
                  title="Sign In"
                >
                  <ArrowRightOnRectangleIcon className="w-4 h-4" />
                </Link>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onToggleMobile} />
            <motion.div 
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 w-[280px] bg-white dark:bg-gray-900 shadow-2xl flex flex-col"
            >
              <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-white font-bold text-sm">P</span>
                  </div>
                  <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    POS System
                  </h1>
                </div>
                <button onClick={onToggleMobile} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto px-3 py-4">
                {/* Public Links */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 px-3">
                    Shop
                  </p>
                  {publicLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onToggleMobile}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${
                        isActive(item.href) 
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium text-sm">{item.name}</span>
                      {isActive(item.href) && <span className="ml-auto w-2 h-2 bg-blue-600 rounded-full" />}
                    </Link>
                  ))}
                </div>

                {/* Admin Links */}
                {isLoaded && isSignedIn && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 px-3">
                      Admin Dashboard
                    </p>
                    {filteredDashboardLinks.map((item) => {
                      const isItemActive = isActive(item.href);
                      const hasSubLinks = item.subLinks && item.subLinks.length > 0;
                      const isExpanded = expandedSubMenu === item.href;
                      
                      return (
                        <div key={item.href}>
                          <button
                            onClick={() => hasSubLinks && setExpandedSubMenu(isExpanded ? null : item.href)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${
                              isItemActive 
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                            }`}
                          >
                            <item.icon className="w-5 h-5" />
                            <span className="font-medium text-sm">{item.name}</span>
                            {hasSubLinks && (
                              <ChevronDownIcon className={`w-4 h-4 ml-auto transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                            )}
                            {!hasSubLinks && isItemActive && <span className="ml-auto w-2 h-2 bg-blue-600 rounded-full" />}
                          </button>
                          {hasSubLinks && isExpanded && (
                            <div className="ml-6 mt-1 space-y-0.5">
                              {item.subLinks?.map((subLink: any) => {
                                if (subLink.permission && permissions) {
                                  const permissionKey = subLink.permission as keyof UserPermissions;
                                  if (permissions[permissionKey] === false) return null;
                                }
                                return (
                                  <Link
                                    key={subLink.href}
                                    href={subLink.href}
                                    onClick={onToggleMobile}
                                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm ${
                                      isActive(subLink.href)
                                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                                    }`}
                                  >
                                    <subLink.icon className="w-4 h-4" />
                                    <span>{subLink.name}</span>
                                    {isActive(subLink.href) && (
                                      <span className="ml-auto w-1.5 h-1.5 bg-blue-600 rounded-full" />
                                    )}
                                  </Link>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Info Links */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 px-3">
                    Information
                  </p>
                  {infoLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onToggleMobile}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${
                        isActive(item.href) 
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium text-sm">{item.name}</span>
                      {isActive(item.href) && <span className="ml-auto w-2 h-2 bg-blue-600 rounded-full" />}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Mobile User Profile */}
              <div className="border-t border-gray-200 dark:border-gray-800 p-4">
                {isLoaded && isSignedIn ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-2 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center text-white font-semibold text-sm shadow-md">
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
                      className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all duration-200 border border-red-200 dark:border-red-800"
                    >
                      <ArrowRightOnRectangleIcon className="w-5 h-5 mr-2" />
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <Link
                    href="/sign-in"
                    className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all duration-200 border border-blue-200 dark:border-blue-800"
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

      {/* Spacer for desktop layout */}
      <div className={`hidden lg:block flex-shrink-0 transition-all duration-300 ${
        isCollapsed ? 'w-[72px]' : 'w-[280px]'
      }`} />
    </>
  );
}
