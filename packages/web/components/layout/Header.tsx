// D:\Projects\Kalwanga\packages\web\components\layout\Header.tsx

'use client';

import { useUser, useClerk } from '@clerk/nextjs';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bars3Icon,
  ChartBarIcon,
  Cog6ToothIcon,
  BellIcon,
  SunIcon,
  MoonIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  FolderIcon,
  PlusIcon,
  CubeIcon,
  TruckIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  ChartPieIcon,
  ShoppingCartIcon,
  ArrowRightOnRectangleIcon,
  UsersIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  EnvelopeIcon,
  UserPlusIcon,
  ArrowUpTrayIcon,
  ClockIcon,
  CurrencyDollarIcon,
  BanknotesIcon,
  Squares2X2Icon,
  BuildingStorefrontIcon,
  CreditCardIcon,
  ShoppingBagIcon,
  ReceiptPercentIcon,
  ArrowPathIcon,
  BookOpenIcon,
  CalculatorIcon,
  BuildingOfficeIcon,
  QrCodeIcon,
  TagIcon,
  ArrowDownTrayIcon,
  DocumentDuplicateIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  LifebuoyIcon,
  ClipboardDocumentCheckIcon,
  InboxIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlayCircleIcon,
  PauseCircleIcon,
} from '@heroicons/react/24/outline';

import { useThemeStore } from '../stores/themeStore';
import { useNotification } from '../../hooks/useNotification';

// ============================================
// TYPES
// ============================================

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
  canViewCompanies: boolean;
  canManageCompanies: boolean;
  canViewBusinessUnits: boolean;
  canManageBusinessUnits: boolean;
  canViewPayments: boolean;
  canManagePayments: boolean;
  canViewBookkeeping: boolean;
  canManageBookkeeping: boolean;
  canViewShifts: boolean;
  canManageShifts: boolean;
  canViewRegisters: boolean;
  canManageRegisters: boolean;
  canStartShift: boolean;
  canEndShift: boolean;
  canManageCash: boolean;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: keyof UserPermissions;
  description?: string;
}

interface NavGroup {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  permission?: keyof UserPermissions;
}

interface HeaderProps {
  onMenuClick: () => void;
  permissions?: UserPermissions;
}

// ============================================
// DEFAULT PERMISSIONS
// ============================================

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
  canViewCompanies: true,
  canManageCompanies: false,
  canViewBusinessUnits: true,
  canManageBusinessUnits: false,
  canViewPayments: true,
  canManagePayments: false,
  canViewBookkeeping: true,
  canManageBookkeeping: false,
  canViewShifts: true,
  canManageShifts: false,
  canViewRegisters: true,
  canManageRegisters: false,
  canStartShift: true,
  canEndShift: true,
  canManageCash: true,
};

// ============================================
// NAVIGATION CONFIGURATION
// ============================================

// Quick-access nav items (shown directly in the header)
const quickNavItems: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: ChartBarIcon,
    permission: 'canViewDashboard',
    description: 'Overview and analytics',
  },
  {
    name: 'POS',
    href: '/admin/sales/pos',
    icon: ShoppingCartIcon,
    permission: 'canViewOrders',
    description: 'Point of sale terminal',
  },
  {
    name: 'Sales',
    href: '/admin/sales',
    icon: CurrencyDollarIcon,
    permission: 'canViewOrders',
    description: 'Sales management',
  },
  {
    name: 'Orders',
    href: '/admin/orders',
    icon: ClipboardDocumentListIcon,
    permission: 'canViewOrders',
    description: 'Order management',
  },
  {
    name: 'Shift',
    href: '/admin/shifts',
    icon: ClockIcon,
    permission: 'canViewShifts',
    description: 'Shift management',
  },
  {
    name: 'Catalog',
    href: '/admin/catalog',
    icon: CubeIcon,
    permission: 'canManageProducts',
    description: 'Product catalog',
  },
  {
    name: 'Inventory',
    href: '/admin/inventory',
    icon: ClipboardDocumentListIcon,
    permission: 'canViewInventory',
    description: 'Stock management',
  },
];

// Mega-menu navigation groups
const navGroups: NavGroup[] = [
  {
    name: 'Sales & Operations',
    icon: ShoppingBagIcon,
    permission: 'canViewOrders',
    items: [
      { name: 'POS Terminal', href: '/admin/sales/pos', icon: ShoppingCartIcon, permission: 'canViewOrders', description: 'Point of sale interface' },
      { name: 'All Sales', href: '/admin/sales', icon: CurrencyDollarIcon, permission: 'canViewOrders', description: 'Sales transactions' },
      { name: 'Sales Dashboard', href: '/admin/sales/dashboard', icon: ChartPieIcon, permission: 'canViewOrders', description: 'Sales overview' },
      { name: 'Sales Analytics', href: '/admin/sales/analytics', icon: ChartBarIcon, permission: 'canViewReports', description: 'Performance metrics' },
      { name: 'Returns', href: '/admin/sales/returns', icon: ReceiptPercentIcon, permission: 'canViewOrders', description: 'Return processing' },
      { name: 'Refunds', href: '/admin/sales/refunds', icon: ArrowPathIcon, permission: 'canViewOrders', description: 'Refund management' },
      { name: 'Invoices', href: '/admin/sales/invoices', icon: DocumentTextIcon, permission: 'canViewOrders', description: 'Invoice management' },
      { name: 'Receipts', href: '/admin/sales/receipts', icon: DocumentDuplicateIcon, permission: 'canViewOrders', description: 'Receipt history' },
    ],
  },
  {
    // ⬇️ NEW: Orders group
    name: 'Orders',
    icon: ClipboardDocumentListIcon,
    permission: 'canViewOrders',
    items: [
      { name: 'All Orders', href: '/admin/orders', icon: ClipboardDocumentListIcon, permission: 'canViewOrders', description: 'Order list' },
      { name: 'Pending Orders', href: '/admin/orders?status=PENDING', icon: ClockIcon, permission: 'canViewOrders', description: 'Awaiting action' },
      { name: 'Processing', href: '/admin/orders?status=PROCESSING', icon: ArrowPathIcon, permission: 'canViewOrders', description: 'In progress' },
      { name: 'On Hold', href: '/admin/orders?status=ON_HOLD', icon: PauseCircleIcon, permission: 'canViewOrders', description: 'Paused orders' },
      { name: 'Completed', href: '/admin/orders?status=COMPLETED', icon: CheckCircleIcon, permission: 'canViewOrders', description: 'Fulfilled orders' },
      { name: 'Cancelled', href: '/admin/orders?status=CANCELLED', icon: XCircleIcon, permission: 'canViewOrders', description: 'Cancelled orders' },
      { name: 'Create Order', href: '/admin/orders/create', icon: PlusIcon, permission: 'canManageOrders', description: 'New order' },
      { name: 'Order Analytics', href: '/admin/orders/analytics', icon: ChartPieIcon, permission: 'canViewOrders', description: 'Order insights' },
    ],
  },
  {
    name: 'Shift Management',
    icon: ClockIcon,
    permission: 'canViewShifts',
    items: [
      { name: 'Shift Dashboard', href: '/admin/shifts', icon: ClockIcon, permission: 'canViewShifts', description: 'Shift overview' },
      { name: 'Current Shift', href: '/admin/shifts/current', icon: PlayCircleIcon, permission: 'canViewShifts', description: 'Active shift' },
      { name: 'Shift History', href: '/admin/shifts/history', icon: DocumentTextIcon, permission: 'canViewShifts', description: 'Past shifts' },
      { name: 'Shift Statistics', href: '/admin/shifts/stats', icon: ChartBarIcon, permission: 'canViewShifts', description: 'Shift analytics' },
      { name: 'Cash Registers', href: '/admin/shifts/registers', icon: BanknotesIcon, permission: 'canViewRegisters', description: 'Register management' },
      { name: 'Register Management', href: '/admin/shifts/registers/manage', icon: Cog6ToothIcon, permission: 'canManageRegisters', description: 'Configure registers' },
      { name: 'Cash Management', href: '/admin/shifts/cash', icon: CurrencyDollarIcon, permission: 'canManageCash', description: 'Cash operations' },
    ],
  },
  {
    name: 'Catalog & Products',
    icon: CubeIcon,
    permission: 'canViewProducts',
    items: [
      { name: 'All Products', href: '/admin/catalog', icon: CubeIcon, permission: 'canViewProducts', description: 'Product list' },
      { name: 'Add Product', href: '/admin/catalog/add', icon: PlusIcon, permission: 'canManageProducts', description: 'Create product' },
      { name: 'Categories', href: '/admin/catalog/categories', icon: FolderIcon, permission: 'canViewCategories', description: 'Category management' },
      { name: 'Suppliers', href: '/admin/catalog/suppliers', icon: TruckIcon, permission: 'canViewSuppliers', description: 'Supplier management' },
      { name: 'Import Products', href: '/admin/catalog/import', icon: ArrowUpTrayIcon, permission: 'canImportProducts', description: 'Bulk import' },
      { name: 'Export Products', href: '/admin/catalog/export', icon: ArrowDownTrayIcon, permission: 'canExportProducts', description: 'Export data' },
      { name: 'Tags', href: '/admin/catalog/tags', icon: TagIcon, permission: 'canManageProducts', description: 'Product tags' },
      { name: 'Barcodes', href: '/admin/barcodes', icon: QrCodeIcon, permission: 'canViewProducts', description: 'Barcode management' },
    ],
  },
  {
    name: 'Inventory',
    icon: ClipboardDocumentListIcon,
    permission: 'canViewInventory',
    items: [
      { name: 'Inventory Dashboard', href: '/admin/inventory', icon: ChartBarIcon, permission: 'canViewInventory', description: 'Stock overview' },
      { name: 'Add Item', href: '/admin/inventory/add', icon: PlusIcon, permission: 'canManageInventory', description: 'Add stock' },
      { name: 'Low Stock', href: '/admin/inventory/low-stock', icon: ExclamationTriangleIcon, permission: 'canViewInventory', description: 'Low stock alerts' },
      { name: 'Transfer', href: '/admin/inventory/transfer', icon: ArrowPathIcon, permission: 'canManageInventory', description: 'Stock transfers' },
      { name: 'Stock Count', href: '/admin/inventory/stock-count', icon: CalculatorIcon, permission: 'canManageInventory', description: 'Inventory count' },
      { name: 'Valuation', href: '/admin/inventory/valuation', icon: CurrencyDollarIcon, permission: 'canViewReports', description: 'Stock value' },
      { name: 'Transactions', href: '/admin/inventory/transactions', icon: DocumentTextIcon, permission: 'canViewInventory', description: 'Stock movements' },
      { name: 'Audit Log', href: '/admin/inventory/audit', icon: EyeIcon, permission: 'canViewInventory', description: 'Inventory history' },
    ],
  },
  {
    name: 'Customers & Suppliers',
    icon: UsersIcon,
    permission: 'canViewCustomers',
    items: [
      { name: 'All Customers', href: '/admin/customers', icon: UsersIcon, permission: 'canViewCustomers', description: 'Customer list' },
      { name: 'Add Customer', href: '/admin/customers/create', icon: UserPlusIcon, permission: 'canManageCustomers', description: 'New customer' },
      { name: 'All Suppliers', href: '/admin/suppliers', icon: TruckIcon, permission: 'canViewSuppliers', description: 'Supplier list' },
      { name: 'Add Supplier', href: '/admin/suppliers/create', icon: PlusIcon, permission: 'canManageSuppliers', description: 'New supplier' },
      { name: 'Supplier Products', href: '/admin/suppliers/products', icon: CubeIcon, permission: 'canViewSuppliers', description: 'Supplier catalog' },
      { name: 'Supplier Orders', href: '/admin/suppliers/orders', icon: ClipboardDocumentListIcon, permission: 'canViewSuppliers', description: 'Purchase orders' },
    ],
  },
  {
    name: 'User Management',
    icon: UsersIcon,
    permission: 'canViewUsers',
    items: [
      { name: 'All Users', href: '/admin/users', icon: UsersIcon, permission: 'canViewUsers', description: 'User list' },
      { name: 'Add User', href: '/admin/users/add', icon: UserPlusIcon, permission: 'canCreateUsers', description: 'Create user' },
      { name: 'Invite Users', href: '/admin/users/invite', icon: EnvelopeIcon, permission: 'canInviteUsers', description: 'Send invites' },
      { name: 'Import Users', href: '/admin/users/import', icon: ArrowUpTrayIcon, permission: 'canImportUsers', description: 'Bulk import' },
      { name: 'Groups', href: '/admin/users/groups', icon: UserGroupIcon, permission: 'canManageUserGroups', description: 'User groups' },
      { name: 'Roles', href: '/admin/users/roles', icon: ShieldCheckIcon, permission: 'canManageUserRoles', description: 'Role management' },
      { name: 'Activity Log', href: '/admin/users/activity', icon: EyeIcon, permission: 'canViewUserActivity', description: 'User activity' },
    ],
  },
  {
    name: 'Business & Finance',
    icon: BuildingOfficeIcon,
    permission: 'canViewCompanies',
    items: [
      { name: 'Companies', href: '/admin/companies', icon: BuildingOfficeIcon, permission: 'canViewCompanies', description: 'Company management' },
      { name: 'Business Units', href: '/admin/business-units', icon: BuildingStorefrontIcon, permission: 'canViewCompanies', description: 'Business units' },
      { name: 'Payments', href: '/admin/payments', icon: CreditCardIcon, permission: 'canViewDashboard', description: 'Payment management' },
      { name: 'Bookkeeping', href: '/admin/bookkeeping', icon: BookOpenIcon, permission: 'canViewReports', description: 'Accounting' },
      { name: 'Reports', href: '/admin/reports', icon: ChartPieIcon, permission: 'canViewReports', description: 'Business reports' },
    ],
  },
  {
    name: 'System',
    icon: Cog6ToothIcon,
    permission: 'canManageSettings',
    items: [
      { name: 'Settings', href: '/admin/settings', icon: Cog6ToothIcon, permission: 'canManageSettings', description: 'System settings' },
      { name: 'Notifications', href: '/notifications', icon: BellIcon, permission: 'canViewDashboard', description: 'Notifications' },
      { name: 'Help Center', href: '/help', icon: LifebuoyIcon, permission: 'canViewDashboard', description: 'Get help' },
    ],
  },
];

// ============================================
// MAIN COMPONENT
// ============================================

export default function Header({
  onMenuClick,
  permissions: userPermissions,
}: HeaderProps) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const pathname = usePathname();
  const router = useRouter();
  const { isDark, toggleTheme } = useThemeStore();
  const { unreadCount, notifications } = useNotification();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const megaMenuRef = useRef<HTMLDivElement>(null);

  const permissions: UserPermissions = { ...defaultPermissions, ...userPermissions };

  // Scroll listener for backdrop-blur effect
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close all dropdowns on route change
  useEffect(() => {
    setIsProfileOpen(false);
    setIsNotificationsOpen(false);
    setIsSearchOpen(false);
    setIsMegaMenuOpen(false);
  }, [pathname]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target as Node)
      ) {
        setIsNotificationsOpen(false);
      }
      if (megaMenuRef.current && !megaMenuRef.current.contains(event.target as Node)) {
        setIsMegaMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setIsProfileOpen(false);
        setIsNotificationsOpen(false);
        setIsMegaMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/';
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/shop?search=${encodeURIComponent(searchQuery)}`);
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };

  const getInitials = () => {
    if (!user) return '?';
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || 'U';
  };

  const getFullName = () => {
    if (!user) return 'Guest';
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    return `${firstName} ${lastName}`.trim() || 'User';
  };

  const getUserEmail = () => user?.emailAddresses?.[0]?.emailAddress || '';

  const isDashboardPage =
    pathname?.startsWith('/dashboard') || pathname?.startsWith('/admin') || false;

  const filteredNavGroups = navGroups.filter((group) => {
    if (!group.permission) return true;
    return permissions[group.permission] !== false;
  });

  const filteredQuickNavItems = quickNavItems.filter((item) => {
    if (!item.permission) return true;
    return permissions[item.permission] !== false;
  });

  const isGroupActive = (group: NavGroup) =>
    group.items.some((item) => pathname?.startsWith(item.href));

  const getFilteredItems = (group: NavGroup) =>
    group.items.filter((item) => {
      if (!item.permission) return true;
      return permissions[item.permission] !== false;
    });

  // ============================================
  // RENDER
  // ============================================

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-md'
          : 'bg-white dark:bg-gray-900'
      } border-b border-gray-200 dark:border-gray-800`}
    >
      <div className="flex items-center justify-between h-14 px-3 md:px-4 gap-2">
        {/* Left section */}
        <div className="flex items-center gap-1 min-w-0 flex-shrink-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle menu"
          >
            <Bars3Icon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>

          <Link
            href={isDashboardPage ? '/dashboard' : '/'}
            className="flex items-center gap-2 px-2"
          >
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                POS System
              </h1>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 -mt-0.5">
                Point of Sale
              </p>
            </div>
          </Link>
        </div>

        {/* Center — Search */}
        <div className="hidden md:flex flex-1 max-w-xl mx-2">
          <form onSubmit={handleSearch} className="relative w-full">
            <div
              className={`relative group transition-all duration-200 ${
                isFocused
                  ? 'ring-2 ring-blue-500 shadow-sm'
                  : 'ring-1 ring-gray-300 dark:ring-gray-700'
              } rounded-full overflow-hidden`}
            >
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                className="w-full pl-10 pr-12 py-2 bg-gray-100 dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:bg-white dark:focus:bg-gray-700 transition-all duration-200"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-12 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors"
                >
                  <XMarkIcon className="w-4 h-4 text-gray-400" />
                </button>
              ) : (
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden lg:block px-1.5 py-0.5 text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">
                  Ctrl K
                </kbd>
              )}
            </div>
          </form>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {/* Desktop nav links — dashboard only */}
          {isDashboardPage && (
            <nav className="hidden lg:flex items-center gap-1 mr-2">
              {filteredQuickNavItems.slice(0, 4).map((item) => {
                const isActive = pathname?.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-1.5" />
                    {item.name}
                  </Link>
                );
              })}

              {/* Mega Menu Button */}
              <div className="relative" ref={megaMenuRef}>
                <button
                  onClick={() => {
                    setIsMegaMenuOpen(!isMegaMenuOpen);
                    setIsProfileOpen(false);
                    setIsNotificationsOpen(false);
                  }}
                  className={`flex items-center px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                    isMegaMenuOpen
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <Squares2X2Icon className="w-4 h-4 mr-1.5" />
                  More
                  <ChevronDownIcon
                    className={`w-4 h-4 ml-1 transition-transform ${
                      isMegaMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {isMegaMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-[880px] max-h-[70vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50"
                    >
                      <div className="p-6">
                        <div className="grid grid-cols-4 gap-6">
                          {filteredNavGroups.map((group) => {
                            const filteredItems = getFilteredItems(group);
                            if (filteredItems.length === 0) return null;

                            const GroupIcon = group.icon;
                            const isActive = isGroupActive(group);

                            return (
                              <div key={group.name} className="space-y-3">
                                <div
                                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${
                                    isActive ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                                  }`}
                                >
                                  <GroupIcon
                                    className={`w-5 h-5 ${
                                      isActive
                                        ? 'text-blue-600 dark:text-blue-400'
                                        : 'text-gray-500 dark:text-gray-400'
                                    }`}
                                  />
                                  <h3
                                    className={`text-sm font-semibold ${
                                      isActive
                                        ? 'text-blue-700 dark:text-blue-300'
                                        : 'text-gray-900 dark:text-white'
                                    }`}
                                  >
                                    {group.name}
                                  </h3>
                                </div>
                                <ul className="space-y-1">
                                  {filteredItems.map((item) => {
                                    const ItemIcon = item.icon;
                                    const isItemActive = pathname?.startsWith(item.href);

                                    return (
                                      <li key={item.href}>
                                        <Link
                                          href={item.href}
                                          onClick={() => setIsMegaMenuOpen(false)}
                                          className={`group flex items-start gap-2 px-2 py-2 rounded-lg transition-all duration-150 ${
                                            isItemActive
                                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'
                                          }`}
                                        >
                                          <ItemIcon
                                            className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                                              isItemActive
                                                ? 'text-blue-600 dark:text-blue-400'
                                                : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                                            }`}
                                          />
                                          <div className="flex-1 min-w-0">
                                            <p
                                              className={`text-sm font-medium ${
                                                isItemActive
                                                  ? 'text-blue-700 dark:text-blue-300'
                                                  : 'text-gray-700 dark:text-gray-300'
                                              }`}
                                            >
                                              {item.name}
                                            </p>
                                            {item.description && (
                                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                                {item.description}
                                              </p>
                                            )}
                                          </div>
                                          {isItemActive && (
                                            <span className="w-1.5 h-1.5 bg-blue-600 rounded-full flex-shrink-0 mt-1.5" />
                                          )}
                                        </Link>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-3 bg-gray-50 dark:bg-gray-800/50">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Press{' '}
                            <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-[10px] font-mono">
                              Esc
                            </kbd>{' '}
                            to close
                          </p>
                          <Link
                            href="/admin/settings"
                            onClick={() => setIsMegaMenuOpen(false)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center gap-1"
                          >
                            <Cog6ToothIcon className="w-3.5 h-3.5" />
                            Settings
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </nav>
          )}

          {/* Divider */}
          <div className="hidden lg:block w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle theme"
          >
            {isDark ? (
              <SunIcon className="w-5 h-5 text-yellow-400" />
            ) : (
              <MoonIcon className="w-5 h-5 text-gray-600" />
            )}
          </button>

          {/* Mobile search button */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="md:hidden p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Search"
          >
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>

          {/* Mobile mega menu button */}
          {isDashboardPage && (
            <button
              onClick={() => setIsMegaMenuOpen(!isMegaMenuOpen)}
              className="lg:hidden p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Menu"
            >
              <Squares2X2Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          )}

          {/* Notifications */}
          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => {
                setIsNotificationsOpen(!isNotificationsOpen);
                setIsProfileOpen(false);
                setIsMegaMenuOpen(false);
              }}
              className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Notifications"
            >
              <BellIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {isNotificationsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50"
                >
                  <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                      Notifications
                    </h3>
                    {unreadCount > 0 && (
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                        {unreadCount} unread
                      </span>
                    )}
                  </div>
                  <div className="p-1">
                    {notifications && notifications.length > 0 ? (
                      notifications.slice(0, 5).map((notification: any) => (
                        <Link
                          key={notification.id}
                          href={`/notifications/${notification.id}`}
                          className="block p-2.5 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          onClick={() => setIsNotificationsOpen(false)}
                        >
                          <p
                            className={`text-sm ${
                              notification.isRead
                                ? 'text-gray-500 dark:text-gray-400'
                                : 'text-gray-900 dark:text-white font-medium'
                            }`}
                          >
                            {notification.title}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {notification.message}
                          </p>
                        </Link>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
                        No notifications
                      </p>
                    )}
                  </div>
                  {notifications && notifications.length > 5 && (
                    <div className="p-2 border-t border-gray-200 dark:border-gray-700">
                      <Link
                        href="/notifications"
                        className="block text-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium py-1"
                        onClick={() => setIsNotificationsOpen(false)}
                      >
                        View All
                      </Link>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User Profile */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => {
                setIsProfileOpen(!isProfileOpen);
                setIsNotificationsOpen(false);
                setIsMegaMenuOpen(false);
              }}
              className="flex items-center gap-1 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Profile"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-semibold text-xs shadow-sm">
                {getInitials()}
              </div>
            </button>

            <AnimatePresence>
              {isProfileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden"
                >
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-semibold text-sm shadow-md">
                        {getInitials()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate text-sm">
                          {getFullName()}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {getUserEmail()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-1.5">
                    {isDashboardPage && (
                      <>
                        {permissions.canViewDashboard !== false && (
                          <Link
                            href="/dashboard"
                            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => setIsProfileOpen(false)}
                          >
                            <ChartBarIcon className="w-4 h-4" />
                            Dashboard
                          </Link>
                        )}
                        {permissions.canViewShifts !== false && (
                          <Link
                            href="/admin/shifts"
                            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => setIsProfileOpen(false)}
                          >
                            <ClockIcon className="w-4 h-4" />
                            Shifts
                          </Link>
                        )}
                        <Link
                          href="/admin/sales"
                          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          <CurrencyDollarIcon className="w-4 h-4" />
                          Sales
                        </Link>
                        {permissions.canViewOrders !== false && (
                          <Link
                            href="/admin/orders"
                            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => setIsProfileOpen(false)}
                          >
                            <ClipboardDocumentListIcon className="w-4 h-4" />
                            Orders
                          </Link>
                        )}
                        <Link
                          href="/admin/catalog"
                          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          <CubeIcon className="w-4 h-4" />
                          Catalog
                        </Link>
                        <Link
                          href="/admin/inventory"
                          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          <ClipboardDocumentListIcon className="w-4 h-4" />
                          Inventory
                        </Link>
                        {permissions.canViewUsers !== false && (
                          <Link
                            href="/admin/users"
                            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => setIsProfileOpen(false)}
                          >
                            <UsersIcon className="w-4 h-4" />
                            Users
                          </Link>
                        )}
                        <div className="border-t border-gray-200 dark:border-gray-700 my-1.5" />
                      </>
                    )}

                    <Link
                      href="/shop"
                      className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => setIsProfileOpen(false)}
                    >
                      <ShoppingCartIcon className="w-4 h-4" />
                      Shop
                    </Link>
                    <Link
                      href="/settings"
                      className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => setIsProfileOpen(false)}
                    >
                      <Cog6ToothIcon className="w-4 h-4" />
                      Settings
                    </Link>
                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        handleSignOut();
                      }}
                      className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors w-full text-left"
                    >
                      <ArrowRightOnRectangleIcon className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Mobile Search Modal */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-white dark:bg-gray-900 md:hidden"
          >
            <div className="flex items-center gap-3 p-4">
              <button
                onClick={() => setIsSearchOpen(false)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <XMarkIcon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </button>
              <form onSubmit={handleSearch} className="flex-1">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
              </form>
            </div>

            <div className="px-4 mt-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                Popular searches
              </p>
              <div className="flex flex-wrap gap-2">
                {['Electronics', 'Clothing', 'Books', 'Home', 'Sports'].map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      router.push(`/shop?search=${encodeURIComponent(item)}`);
                      setIsSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-full text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Mega Menu */}
      <AnimatePresence>
        {isMegaMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
              onClick={() => setIsMegaMenuOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, x: '100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-50 w-[320px] bg-white dark:bg-gray-900 shadow-2xl lg:hidden overflow-y-auto"
            >
              <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Menu</h2>
                <button
                  onClick={() => setIsMegaMenuOpen(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-6">
                {filteredNavGroups.map((group) => {
                  const filteredItems = getFilteredItems(group);
                  if (filteredItems.length === 0) return null;

                  const GroupIcon = group.icon;
                  const isActive = isGroupActive(group);

                  return (
                    <div key={group.name}>
                      <div
                        className={`flex items-center gap-2 mb-3 ${
                          isActive
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-900 dark:text-white'
                        }`}
                      >
                        <GroupIcon className="w-5 h-5" />
                        <h3 className="text-sm font-semibold">{group.name}</h3>
                      </div>
                      <ul className="space-y-1">
                        {filteredItems.map((item) => {
                          const ItemIcon = item.icon;
                          const isItemActive = pathname?.startsWith(item.href);

                          return (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                onClick={() => setIsMegaMenuOpen(false)}
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                                  isItemActive
                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                                }`}
                              >
                                <ItemIcon className="w-4 h-4" />
                                <span className="text-sm">{item.name}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
