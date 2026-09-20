// D:\Projects\Kalwanga\packages\web\components\layout\RootHeader.tsx

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  ShoppingCart,
  Search,
  Layers,
  Menu,
  X,
  LayoutDashboard,
  LogOut,
  User as UserIcon,
  Home,
  ChevronDown,
  Sparkles,
  Package,
  Heart,
  Bell,
  Shield,
} from 'lucide-react';
import { useThemeStore } from '../../app/stores/themeStore';
import { useAuth } from '../../hooks/useAuth';
import { cartService } from '../../services/cartService';
import { guestCartService } from '../../services/guestCartService';
import { toast } from '../../utils/toast-manager';
import { notificationService } from '../../services/notificationService';
import { useNotificationStream } from '../../hooks/useNotificationStream';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PRIMARY_NAV: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/shop', label: 'Shop', icon: ShoppingBag },
  { href: '/categories', label: 'Categories', icon: Layers },
];

const SECONDARY_NAV: NavItem[] = [
  { href: '/help', label: 'Help', icon: Sparkles },
  { href: '/privacy', label: 'Privacy', icon: Shield },
  { href: '/terms', label: 'Terms', icon: Package },
];

// ============================================
// ROOT HEADER
// ============================================

export function RootHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { isDark } = useThemeStore();
  const { isAuthenticated, logout } = useAuth() as {
    isAuthenticated: boolean;
    logout?: () => Promise<void> | void;
  };

  const [visible, setVisible] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [searchValue, setSearchValue] = useState('');

  // Unread count for the storefront bell. Populated from the same
  // service method the dashboard bell uses, and kept live by the
  // SSE subscription below.
  const [unreadCount, setUnreadCount] = useState(0);

  const lastScrollY = useRef(0);
  const scrollThreshold = 10;

  // ------------------------------------------------
  // AUTO-HIDE ON SCROLL
  // ------------------------------------------------

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;

      // Always show at the very top.
      if (currentY < 60) {
        setVisible(true);
        lastScrollY.current = currentY;
        return;
      }

      const delta = currentY - lastScrollY.current;
      if (Math.abs(delta) < scrollThreshold) return;

      if (delta > 0) {
        setVisible(false);
        setExpanded(false);
      } else {
        setVisible(true);
      }
      lastScrollY.current = currentY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ------------------------------------------------
  // CLOSE MENUS ON ROUTE CHANGE
  // ------------------------------------------------

  useEffect(() => {
    setExpanded(false);
    setMobileOpen(false);
  }, [pathname]);

  // ------------------------------------------------
  // CART COUNT
  // ------------------------------------------------

  const fetchCartCount = useCallback(async () => {
    try {
      const cart = isAuthenticated ? cartService : guestCartService;
      const response = await cart.getCartCount();
      setCartCount(response?.count || 0);
    } catch {
      setCartCount(0);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchCartCount();
    const handler = () => fetchCartCount();
    window.addEventListener('cart:updated', handler);
    return () => window.removeEventListener('cart:updated', handler);
  }, [fetchCartCount]);

  // ------------------------------------------------
  // UNREAD NOTIFICATION COUNT
  // ------------------------------------------------
  //
  // Two sources feed the badge:
  //
  //   1. Initial + periodic polling via
  //      notificationService.getUnreadCount().
  //   2. Live increments from the SSE stream whenever a new
  //      notification arrives for this user.
  //
  // The stream is only enabled when the shopper is authenticated;
  // guests have no notifications to receive.
  //
  // `getUnreadCount` may return a bare number, `{ count }`, or
  // `{ data: { count } }` depending on the service's unwrapping.
  // `extractCount` handles all three without throwing.

  const extractCount = (raw: unknown): number => {
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (raw && typeof raw === 'object') {
      const obj = raw as { count?: unknown; data?: { count?: unknown } };
      if (typeof obj.count === 'number') return obj.count;
      if (obj.data && typeof obj.data.count === 'number') return obj.data.count;
    }
    return 0;
  };

  const refreshUnreadCount = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }
    try {
      const raw = await notificationService.getUnreadCount();
      setUnreadCount(extractCount(raw));
    } catch {
      // Silent — the badge is best-effort.
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshUnreadCount();
    if (!isAuthenticated) return;
    const interval = setInterval(refreshUnreadCount, 60_000);
    return () => clearInterval(interval);
  }, [refreshUnreadCount, isAuthenticated]);

  useNotificationStream({
    enabled: isAuthenticated,
    onNotification: () => {
      // A new notification arrived while the shopper is browsing.
      // Increment optimistically; the next poll reconciles.
      setUnreadCount((c) => c + 1);
    },
  });

  // ------------------------------------------------
  // HANDLERS
  // ------------------------------------------------

  const handleSignOut = useCallback(async () => {
    try {
      if (logout) {
        await logout();
      } else {
        window.location.href = '/sign-out';
      }
    } catch (err) {
      console.error('Sign-out failed:', err);
      toast.error('Failed to sign out. Please try again.');
    }
  }, [logout]);

  const handleSearch = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const value = (e.target as HTMLInputElement).value.trim();
        router.push(
          value
            ? `/shop?search=${encodeURIComponent(value)}`
            : '/shop',
        );
        setSearchValue('');
      }
    },
    [router],
  );

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname?.startsWith(href);
  };

  // ------------------------------------------------
  // RENDER
  // ------------------------------------------------

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${
        visible ? 'translate-y-0' : '-translate-y-full'
      } ${
        isDark
          ? 'bg-gray-900/95 border-gray-800'
          : 'bg-white/95 border-orange-100'
      } backdrop-blur-md border-b shadow-sm`}
    >
      {/* ============================================
          ROW 1 — compact bar
          ============================================ */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-3">
          {/* ---------- LEFT: logo + primary nav ---------- */}
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href="/"
              className="flex items-center gap-2 shrink-0"
              aria-label="POS Store home"
            >
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-sm">
                <ShoppingBag className="w-4 h-4" />
              </span>
              <span className="hidden sm:inline text-base font-bold text-gray-900 dark:text-white">
                POS Store
              </span>
            </Link>

            {/* Primary nav — always visible on lg+ */}
            <nav className="hidden lg:flex items-center gap-0.5">
              {PRIMARY_NAV.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative px-2.5 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                      active
                        ? isDark
                          ? 'text-white'
                          : 'text-gray-900'
                        : isDark
                          ? 'text-gray-400 hover:text-white hover:bg-gray-800'
                          : 'text-gray-500 hover:text-gray-900 hover:bg-orange-50'
                    }`}
                  >
                    {item.label}
                    {active && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-gradient-to-r from-orange-500 to-red-500" />
                    )}
                  </Link>
                );
              })}

              {/* Expand toggle for secondary nav */}
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className={`relative inline-flex items-center gap-1 px-2.5 py-2 text-sm font-medium rounded-md transition-colors ${
                  expanded
                    ? isDark
                      ? 'text-white bg-gray-800'
                      : 'text-gray-900 bg-orange-50'
                    : isDark
                      ? 'text-gray-400 hover:text-white hover:bg-gray-800'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-orange-50'
                }`}
                aria-expanded={expanded}
                aria-label="More navigation"
              >
                More
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    expanded ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </nav>
          </div>

          {/* ---------- CENTER: search ---------- */}
          <div className="hidden md:block flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search products, categories…"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleSearch}
              className={`w-full pl-9 pr-3 py-1.5 rounded-md text-sm outline-none transition-colors ${
                isDark
                  ? 'bg-gray-800 text-white placeholder-gray-500'
                  : 'bg-orange-50/60 text-gray-900 placeholder-gray-500'
              } border border-transparent focus:border-orange-400 focus:ring-1 focus:ring-orange-400/40`}
            />
          </div>

          {/* ---------- RIGHT: cart · icon rail · dashboard · sign-out ---------- */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Cart with badge */}
            <HeaderIconItem
              href="/cart"
              icon={<ShoppingCart className="w-5 h-5" />}
              label="Cart"
              badge={cartCount > 0 ? cartCount : undefined}
              isDark={isDark}
            />

            {/*
              Notifications — customer-facing bell.

              Points to `/notifications`, the shared route used by
              the rest of the app. The previous `/account/notifications`
              href was wrong and 404'd.
            */}
            {isAuthenticated && (
              <HeaderIconItem
                href="/notifications"
                icon={<Bell className="w-5 h-5" />}
                label="Alerts"
                badge={unreadCount > 0 ? unreadCount : undefined}
                isDark={isDark}
                active={pathname?.startsWith('/notifications')}
              />
            )}

            {/* Wishlist */}
            <span className="hidden md:inline-flex">
              <HeaderIconItem
                href="/wishlist"
                icon={<Heart className="w-5 h-5" />}
                label="Wishlist"
                isDark={isDark}
              />
            </span>

            {/* Profile */}
            <span className="hidden md:inline-flex">
              <HeaderIconItem
                href="/profile"
                icon={<UserIcon className="w-5 h-5" />}
                label="Me"
                isDark={isDark}
              />
            </span>

            {/* Dashboard */}
            <Link
              href="/dashboard"
              className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isDark
                  ? 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  : 'text-gray-700 hover:bg-orange-50 hover:text-gray-900'
              }`}
              title="Dashboard"
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>

            {/* Sign Out */}
            {isAuthenticated && (
              <button
                type="button"
                onClick={handleSignOut}
                className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isDark
                    ? 'text-gray-300 hover:bg-red-950/40 hover:text-red-300'
                    : 'text-gray-700 hover:bg-red-50 hover:text-red-600'
                }`}
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            )}

            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className={`lg:hidden p-2 rounded-md transition-colors ${
                isDark
                  ? 'hover:bg-gray-800 text-gray-300'
                  : 'hover:bg-orange-50 text-gray-700'
              }`}
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ============================================
          ROW 1.5 — expandable secondary nav strip
          ============================================ */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="secondary-nav"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden border-t border-gray-100 dark:border-gray-800"
          >
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
              <nav className="hidden lg:flex items-center gap-1 flex-wrap">
                {SECONDARY_NAV.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        active
                          ? isDark
                            ? 'text-white bg-gray-800'
                            : 'text-gray-900 bg-orange-50'
                          : isDark
                            ? 'text-gray-400 hover:text-white hover:bg-gray-800'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-orange-50'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================
          MOBILE MENU
          ============================================ */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`lg:hidden overflow-hidden border-t ${
              isDark
                ? 'border-gray-800 bg-gray-900'
                : 'border-orange-100 bg-white'
            }`}
          >
            <div className="max-w-[1600px] mx-auto px-4 py-3 flex flex-col gap-3">
              {/* Mobile search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search products, categories…"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onKeyDown={handleSearch}
                  className={`w-full pl-10 pr-3 py-2 rounded-md text-sm outline-none transition-colors ${
                    isDark
                      ? 'bg-gray-800 text-white placeholder-gray-500'
                      : 'bg-orange-50/60 text-gray-900 placeholder-gray-500'
                  } border border-transparent focus:border-orange-400 focus:ring-1 focus:ring-orange-400/40`}
                />
              </div>

              {/* Primary nav */}
              <div className="flex flex-col">
                {PRIMARY_NAV.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                        active
                          ? isDark
                            ? 'text-white bg-orange-950/30'
                            : 'text-gray-900 bg-orange-50'
                          : isDark
                            ? 'text-gray-300 hover:bg-gray-800'
                            : 'text-gray-700 hover:bg-orange-50'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              <div
                className={`border-t ${
                  isDark ? 'border-gray-800' : 'border-orange-100'
                }`}
              />

              {/* Secondary nav */}
              <div className="flex flex-col">
                {SECONDARY_NAV.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                        active
                          ? isDark
                            ? 'text-white bg-orange-950/30'
                            : 'text-gray-900 bg-orange-50'
                          : isDark
                            ? 'text-gray-300 hover:bg-gray-800'
                            : 'text-gray-700 hover:bg-orange-50'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              <div
                className={`border-t ${
                  isDark ? 'border-gray-800' : 'border-orange-100'
                }`}
              />

              {/* Account */}
              <div className="flex flex-col">
                {[
                  {
                    href: '/cart',
                    label: `Cart${cartCount > 0 ? ` (${cartCount})` : ''}`,
                    icon: ShoppingCart,
                  },
                  { href: '/wishlist', label: 'Wishlist', icon: Heart },
                  { href: '/profile', label: 'Profile', icon: UserIcon },
                  // Notification row — shown only when signed in, and
                  // includes the live unread count when present.
                  // Points to /notifications (shared route).
                  ...(isAuthenticated
                    ? [
                        {
                          href: '/notifications',
                          label: `Alerts${
                            unreadCount > 0 ? ` (${unreadCount})` : ''
                          }`,
                          icon: Bell,
                        },
                      ]
                    : []),
                  {
                    href: '/dashboard',
                    label: 'Dashboard',
                    icon: LayoutDashboard,
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                        isDark
                          ? 'text-gray-300 hover:bg-gray-800'
                          : 'text-gray-700 hover:bg-orange-50'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  );
                })}

                {isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      handleSignOut();
                    }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-left transition-colors ${
                      isDark
                        ? 'text-red-300 hover:bg-red-950/40'
                        : 'text-red-600 hover:bg-red-50'
                    }`}
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span className="flex-1">Sign Out</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

// ============================================
// HEADER ICON ITEM
// ============================================

interface HeaderIconItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: number;
  isDark: boolean;
}

function HeaderIconItem({
  href,
  icon,
  label,
  active,
  badge,
  isDark,
}: HeaderIconItemProps) {
  return (
    <Link
      href={href}
      className={`relative flex flex-col items-center justify-center px-2.5 py-1.5 rounded-md transition-colors min-w-[52px] ${
        isDark
          ? 'text-gray-400 hover:text-white hover:bg-gray-800'
          : 'text-gray-500 hover:text-gray-900 hover:bg-orange-50'
      } ${active ? (isDark ? 'text-white' : 'text-gray-900') : ''}`}
    >
      <span className="relative">
        {icon}
        {badge && badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
      <span className="text-[10px] font-medium mt-0.5 leading-tight">
        {label}
      </span>
      {active && (
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-gradient-to-r from-orange-500 to-red-500" />
      )}
    </Link>
  );
}

export default RootHeader;
