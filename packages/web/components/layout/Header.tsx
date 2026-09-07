// D:\Projects\Kalwanga\packages\web\components\layout\Header.tsx

'use client';

import { useUser, UserButton, useClerk } from '@clerk/nextjs';
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
  HomeIcon,
  ArrowRightOnRectangleIcon,
  UsersIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  KeyIcon,
  EnvelopeIcon,
  UserPlusIcon,
  ArrowUpTrayIcon
} from '@heroicons/react/24/outline';
import { useThemeStore } from '../stores/themeStore';
import { useNotification } from '../../hooks/useNotification';

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
  // User Management permissions
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
}

interface HeaderProps {
  onMenuClick: () => void;
  permissions?: UserPermissions;
}

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
};

export default function Header({ onMenuClick, permissions: userPermissions }: HeaderProps) {
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
  const [scrolled, setScrolled] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const permissions = { ...defaultPermissions, ...userPermissions };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsProfileOpen(false);
    setIsNotificationsOpen(false);
    setIsSearchOpen(false);
  }, [pathname]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut for search
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

  const getUserEmail = () => {
    return user?.emailAddresses?.[0]?.emailAddress || '';
  };

  const isDashboardPage = pathname?.startsWith('/dashboard') || pathname?.startsWith('/admin') || false;
  const isUserManagementPage = pathname?.startsWith('/admin/users') || false;

  const canManageCategories = permissions.canManageCategories !== false;
  const canManageProducts = permissions.canManageProducts !== false;
  const canViewDashboard = permissions.canViewDashboard !== false;
  const canManageInventory = permissions.canManageInventory !== false;
  const canViewInventory = permissions.canViewInventory !== false;
  const canViewReports = permissions.canViewReports !== false;
  const canViewUsers = permissions.canViewUsers !== false;
  const canCreateUsers = permissions.canCreateUsers !== false;
  const canInviteUsers = permissions.canInviteUsers !== false;
  const canImportUsers = permissions.canImportUsers !== false;
  const canManageUserGroups = permissions.canManageUserGroups !== false;
  const canManageUserRoles = permissions.canManageUserRoles !== false;

  return (
    <header className={`sticky top-0 z-40 transition-all duration-300 ${
      scrolled 
        ? 'bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-md' 
        : 'bg-white dark:bg-gray-900'
    } border-b border-gray-200 dark:border-gray-800`}>
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

          {/* Logo */}
          <Link href={isDashboardPage ? '/dashboard' : '/'} className="flex items-center gap-2 px-2">
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

        {/* Center - Search */}
        <div className="hidden md:flex flex-1 max-w-xl mx-2">
          <form onSubmit={handleSearch} className="relative w-full">
            <div className={`relative group transition-all duration-200 ${
              isFocused 
                ? 'ring-2 ring-blue-500 shadow-sm' 
                : 'ring-1 ring-gray-300 dark:ring-gray-700'
            } rounded-full overflow-hidden`}>
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
          {/* Desktop nav links */}
          {isDashboardPage && (
            <nav className="hidden lg:flex items-center gap-1 mr-2">
              {canViewDashboard && (
                <Link
                  href="dashboard"
                  className={`flex items-center px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                    pathname === '/dashboard' || pathname === '/admin'
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <ChartBarIcon className="w-4 h-4 mr-1.5" />
                  Dashboard
                </Link>
              )}
              {canManageProducts && (
                <Link
                  href="/admin/catalog"
                  className={`flex items-center px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                    pathname?.startsWith('/admin/catalog')
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <CubeIcon className="w-4 h-4 mr-1.5" />
                  Catalog
                </Link>
              )}
              {canViewInventory && (
                <Link
                  href="/admin/inventory"
                  className={`flex items-center px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                    pathname?.startsWith('/admin/inventory')
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <ClipboardDocumentListIcon className="w-4 h-4 mr-1.5" />
                  Inventory
                </Link>
              )}
              {canViewDashboard && (
                <Link
                  href="/admin/sales"
                  className={`flex items-center px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                    pathname?.startsWith('/admin/sales')
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <ShoppingCartIcon className="w-4 h-4 mr-1.5" />
                  Sales
                </Link>
              )}
              {canViewUsers && (
                <Link
                  href="/admin/users"
                  className={`flex items-center px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                    isUserManagementPage
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <UsersIcon className="w-4 h-4 mr-1.5" />
                  Users
                </Link>
              )}
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

          {/* Notifications */}
          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => {
                setIsNotificationsOpen(!isNotificationsOpen);
                setIsProfileOpen(false);
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
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Notifications</h3>
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
                          <p className={`text-sm ${notification.isRead ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white font-medium'}`}>
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
                        {canViewDashboard && (
                          <Link
                            href="/admin/dashboard"
                            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => setIsProfileOpen(false)}
                          >
                            <ChartBarIcon className="w-4 h-4" />
                            Dashboard
                          </Link>
                        )}
                        {permissions.canViewProducts && (
                          <Link
                            href="/admin/catalog"
                            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => setIsProfileOpen(false)}
                          >
                            <CubeIcon className="w-4 h-4" />
                            Catalog
                          </Link>
                        )}
                        {permissions.canViewInventory && (
                          <Link
                            href="/admin/inventory"
                            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => setIsProfileOpen(false)}
                          >
                            <ClipboardDocumentListIcon className="w-4 h-4" />
                            Inventory
                          </Link>
                        )}
                        {canViewUsers && (
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
                    
                    {/* User Management Quick Links */}
                    {canViewUsers && isDashboardPage && (
                      <div className="mb-1">
                        <p className="px-3 py-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                          User Management
                        </p>
                        {canCreateUsers && (
                          <Link
                            href="/admin/users/add"
                            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => setIsProfileOpen(false)}
                          >
                            <UserPlusIcon className="w-4 h-4" />
                            Add User
                          </Link>
                        )}
                        {canInviteUsers && (
                          <Link
                            href="/admin/users/invite"
                            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => setIsProfileOpen(false)}
                          >
                            <EnvelopeIcon className="w-4 h-4" />
                            Invite Users
                          </Link>
                        )}
                        {canImportUsers && (
                          <Link
                            href="/admin/users/import"
                            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => setIsProfileOpen(false)}
                          >
                            <ArrowUpTrayIcon className="w-4 h-4" />
                            Import Users
                          </Link>
                        )}
                        {canManageUserGroups && (
                          <Link
                            href="/admin/users/groups"
                            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => setIsProfileOpen(false)}
                          >
                            <UserGroupIcon className="w-4 h-4" />
                            Groups
                          </Link>
                        )}
                        {canManageUserRoles && (
                          <Link
                            href="/admin/users/roles"
                            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => setIsProfileOpen(false)}
                          >
                            <ShieldCheckIcon className="w-4 h-4" />
                            Roles
                          </Link>
                        )}
                        <div className="border-t border-gray-200 dark:border-gray-700 my-1.5" />
                      </div>
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
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Popular searches</p>
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
    </header>
  );
}
