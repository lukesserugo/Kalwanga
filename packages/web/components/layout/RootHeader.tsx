// packages/web/components/layout/RootHeader.tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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

// ============================================
// NAV DEFINITIONS
// ============================================

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
// MODULE-LEVEL HELPERS
// ============================================

function extractCount(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const obj = raw as { count?: unknown; data?: { count?: unknown } };
    if (typeof obj.count === 'number') return obj.count;
    if (obj.data && typeof obj.data.count === 'number') return obj.data.count;
  }
  return 0;
}

function isActiveRoute(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

// ============================================
// ROOT HEADER
// ============================================

export function RootHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { isDark } = useThemeStore();
  const { isAuthenticated, logout } = useAuth();

  const [visible, setVisible] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [searchValue, setSearchValue] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  const lastScrollY = useRef(0);
  const rafScheduledRef = useRef(false);

  const cartFetchIdRef = useRef(0);

  const serverUnreadRef = useRef(0);
  const pendingUnreadIncrementsRef = useRef(0);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ------------------------------------------------
  // AUTO-HIDE ON SCROLL (rAF-throttled)
  // ------------------------------------------------

  const autoHideEnabled = !mobileOpen && !expanded;

  useEffect(() => {
    if (!autoHideEnabled) {
      setVisible(true);
      return;
    }

    const tick = () => {
      rafScheduledRef.current = false;
      const currentY = window.scrollY;

      if (currentY < 60) {
        setVisible(true);
        lastScrollY.current = currentY;
        return;
      }

      const delta = currentY - lastScrollY.current;
      if (Math.abs(delta) < 10) return;

      if (delta > 0) {
        setVisible(false);
        setExpanded(false);
      } else {
        setVisible(true);
      }
      lastScrollY.current = currentY;
    };

    const handleScroll = () => {
      if (rafScheduledRef.current) return;
      rafScheduledRef.current = true;
      requestAnimationFrame(tick);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      rafScheduledRef.current = false;
    };
  }, [autoHideEnabled]);

  // ------------------------------------------------
  // CLOSE MENUS ON ROUTE CHANGE
  // ------------------------------------------------

  useEffect(() => {
    setExpanded(false);
    setMobileOpen(false);
  }, [pathname]);

  // ------------------------------------------------
  // ESCAPE CLOSES THE MOBILE MENU
  // ------------------------------------------------

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  // ------------------------------------------------
  // CART COUNT
  // ------------------------------------------------
  //
  // ⚠ `cartService` and `guestCartService` do NOT share a method for
  //    this. `cartService.getCartCount()` returns
  //    `CartCountResponse`; `guestCartService.getCount()` returns a
  //    bare `number`. Calling `cart.getCartCount()` on the union
  //    fails because the method exists on only one member. Branch on
  //    `isAuthenticated` before calling, and normalize both results
  //    to a plain `number`.

  const fetchCartCount = useCallback(async () => {
    const fetchId = ++cartFetchIdRef.current;

    try {
      let count = 0;

      if (isAuthenticated) {
        const response = await cartService.getCartCount();
        count = response?.count ?? 0;
      } else {
        count = await guestCartService.getCount();
      }

      if (fetchId !== cartFetchIdRef.current) return;
      if (!mountedRef.current) return;

      setCartCount(count);
    } catch {
      if (fetchId !== cartFetchIdRef.current) return;
      if (!mountedRef.current) return;

      setCartCount(0);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void fetchCartCount();
    const handler = () => void fetchCartCount();
    window.addEventListener('cart:updated', handler);
    return () => window.removeEventListener('cart:updated', handler);
  }, [fetchCartCount]);

  // ------------------------------------------------
  // UNREAD NOTIFICATION COUNT
  // ------------------------------------------------

  const refreshUnreadCount = useCallback(async () => {
    if (!isAuthenticated) {
      serverUnreadRef.current = 0;
      pendingUnreadIncrementsRef.current = 0;
      setUnreadCount(0);
      return;
    }

    try {
      const raw = await notificationService.getUnreadCount();
      const serverCount = extractCount(raw);

      if (!mountedRef.current) return;

      serverUnreadRef.current = serverCount;
      const merged = serverCount + pendingUnreadIncrementsRef.current;
      pendingUnreadIncrementsRef.current = 0;
      setUnreadCount(merged);
    } catch {
      // Silent — the badge is best-effort.
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refreshUnreadCount();
    if (!isAuthenticated) return;
    const interval = setInterval(() => void refreshUnreadCount(), 60_000);
    return () => clearInterval(interval);
  }, [refreshUnreadCount, isAuthenticated]);

  const handleStreamNotification = useCallback(() => {
    if (!mountedRef.current) return;
    pendingUnreadIncrementsRef.current += 1;
    setUnreadCount((c) => c + 1);
  }, []);

  const streamOptions = useMemo(
    () => ({
      enabled: isAuthenticated,
      onNotification: handleStreamNotification,
    }),
    [isAuthenticated, handleStreamNotification],
  );

  useNotificationStream(streamOptions);

  // ------------------------------------------------
  // HANDLERS
  // ------------------------------------------------

  const handleSignOut = useCallback(async () => {
    try {
      if (typeof logout === 'function') {
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
      if (e.key !== 'Enter') return;
      const value = searchValue.trim();
      router.push(
        value ? `/shop?search=${encodeURIComponent(value)}` : '/shop',
      );
      setSearchValue('');
    },
    [router, searchValue],
  );

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
          {/* LEFT: logo + primary nav */}
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href="/"
              className="flex items-center gap-2 shrink-0"
              aria-label="POS Store home"
            >
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-sm">
                <ShoppingBag className="w-4 h-4" aria-hidden="true" />
              </span>
              <span className="hidden sm:inline text-base font-bold text-gray-900 dark:text-white">
                POS Store
              </span>
            </Link>

            <nav
              className="hidden lg:flex items-center gap-0.5"
              aria-label="Primary"
            >
              {PRIMARY_NAV.map((item) => {
                const active = isActiveRoute(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
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
                aria-controls="secondary-nav"
                aria-label="More navigation"
              >
                More
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    expanded ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>
            </nav>
          </div>

          {/* CENTER: search */}
          <div className="hidden md:block flex-1 max-w-md relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="Search products, categories…"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleSearch}
              aria-label="Search products"
              className={`w-full pl-9 pr-3 py-1.5 rounded-md text-sm outline-none transition-colors ${
                isDark
                  ? 'bg-gray-800 text-white placeholder-gray-500'
                  : 'bg-orange-50/60 text-gray-900 placeholder-gray-500'
              } border border-transparent focus:border-orange-400 focus:ring-1 focus:ring-orange-400/40`}
            />
          </div>

          {/* RIGHT: cart · bell · wishlist · profile · dashboard · sign-out */}
          <div className="flex items-center gap-1 shrink-0">
            <HeaderIconItem
              href="/cart"
              icon={<ShoppingCart className="w-5 h-5" />}
              label="Cart"
              badge={cartCount > 0 ? cartCount : undefined}
              badgeLabel={
                cartCount > 0
                  ? `${cartCount} item${cartCount === 1 ? '' : 's'} in cart`
                  : undefined
              }
              isDark={isDark}
              active={isActiveRoute(pathname, '/cart')}
            />

            {isAuthenticated && (
              <HeaderIconItem
                href="/notifications"
                icon={<Bell className="w-5 h-5" />}
                label="Alerts"
                badge={unreadCount > 0 ? unreadCount : undefined}
                badgeLabel={
                  unreadCount > 0
                    ? `${unreadCount} unread notification${
                        unreadCount === 1 ? '' : 's'
                      }`
                    : undefined
                }
                isDark={isDark}
                active={isActiveRoute(pathname, '/notifications')}
              />
            )}

            <span className="hidden md:inline-flex">
              <HeaderIconItem
                href="/wishlist"
                icon={<Heart className="w-5 h-5" />}
                label="Wishlist"
                isDark={isDark}
                active={isActiveRoute(pathname, '/wishlist')}
              />
            </span>

            <span className="hidden md:inline-flex">
              <HeaderIconItem
                href="/profile"
                icon={<UserIcon className="w-5 h-5" />}
                label="Me"
                isDark={isDark}
                active={isActiveRoute(pathname, '/profile')}
              />
            </span>

            <Link
              href="/dashboard"
              className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isDark
                  ? 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  : 'text-gray-700 hover:bg-orange-50 hover:text-gray-900'
              }`}
              title="Dashboard"
            >
              <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
              Dashboard
            </Link>

            {isAuthenticated && (
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isDark
                    ? 'text-gray-300 hover:bg-red-950/40 hover:text-red-300'
                    : 'text-gray-700 hover:bg-red-50 hover:text-red-600'
                }`}
                title="Sign out"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                Sign Out
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className={`lg:hidden p-2 rounded-md transition-colors ${
                isDark
                  ? 'hover:bg-gray-800 text-gray-300'
                  : 'hover:bg-orange-50 text-gray-700'
              }`}
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
            >
              {mobileOpen ? (
                <X className="w-5 h-5" aria-hidden="true" />
              ) : (
                <Menu className="w-5 h-5" aria-hidden="true" />
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
            id="secondary-nav"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden border-t border-gray-100 dark:border-gray-800"
          >
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
              <nav
                className="hidden lg:flex items-center gap-1 flex-wrap"
                aria-label="Secondary"
              >
                {SECONDARY_NAV.map((item) => {
                  const Icon = item.icon;
                  const active = isActiveRoute(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
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
                      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
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
            id="mobile-menu"
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
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  placeholder="Search products, categories…"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onKeyDown={handleSearch}
                  aria-label="Search products"
                  className={`w-full pl-10 pr-3 py-2 rounded-md text-sm outline-none transition-colors ${
                    isDark
                      ? 'bg-gray-800 text-white placeholder-gray-500'
                      : 'bg-orange-50/60 text-gray-900 placeholder-gray-500'
                  } border border-transparent focus:border-orange-400 focus:ring-1 focus:ring-orange-400/40`}
                />
              </div>

              <MobileNavGroup
                items={PRIMARY_NAV}
                pathname={pathname}
                isDark={isDark}
                onNavigate={() => setMobileOpen(false)}
              />

              <Divider isDark={isDark} />

              <MobileNavGroup
                items={SECONDARY_NAV}
                pathname={pathname}
                isDark={isDark}
                onNavigate={() => setMobileOpen(false)}
              />

              <Divider isDark={isDark} />

              <MobileAccountLinks
                isDark={isDark}
                isAuthenticated={isAuthenticated}
                cartCount={cartCount}
                unreadCount={unreadCount}
                pathname={pathname}
                onNavigate={() => setMobileOpen(false)}
                onSignOut={() => {
                  setMobileOpen(false);
                  void handleSignOut();
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

// ============================================
// MOBILE SUBCOMPONENTS
// ============================================

function Divider({ isDark }: { isDark: boolean }) {
  return (
    <div
      className={`border-t ${
        isDark ? 'border-gray-800' : 'border-orange-100'
      }`}
    />
  );
}

function MobileNavGroup({
  items,
  pathname,
  isDark,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string | null;
  isDark: boolean;
  onNavigate: () => void;
}) {
  return (
    <div className="flex flex-col">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActiveRoute(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
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
            <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

function MobileAccountLinks({
  isDark,
  isAuthenticated,
  cartCount,
  unreadCount,
  pathname,
  onNavigate,
  onSignOut,
}: {
  isDark: boolean;
  isAuthenticated: boolean;
  cartCount: number;
  unreadCount: number;
  pathname: string | null;
  onNavigate: () => void;
  onSignOut: () => void;
}) {
  const links: NavItem[] = useMemo(() => {
    const base: NavItem[] = [
      { href: '/cart', label: 'Cart', icon: ShoppingCart },
      { href: '/wishlist', label: 'Wishlist', icon: Heart },
      { href: '/profile', label: 'Profile', icon: UserIcon },
    ];
    if (isAuthenticated) {
      base.push({ href: '/notifications', label: 'Alerts', icon: Bell });
    }
    base.push({ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard });
    return base;
  }, [isAuthenticated]);

  return (
    <div className="flex flex-col">
      {links.map((item) => {
        const Icon = item.icon;
        const suffix =
          item.href === '/cart' && cartCount > 0
            ? ` (${cartCount})`
            : item.href === '/notifications' && unreadCount > 0
            ? ` (${unreadCount})`
            : '';
        const active = isActiveRoute(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
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
            <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">
              {item.label}
              {suffix}
            </span>
          </Link>
        );
      })}

      {isAuthenticated && (
        <button
          type="button"
          onClick={onSignOut}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-left transition-colors ${
            isDark
              ? 'text-red-300 hover:bg-red-950/40'
              : 'text-red-600 hover:bg-red-50'
          }`}
        >
          <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="flex-1">Sign Out</span>
        </button>
      )}
    </div>
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
  badgeLabel?: string;
  isDark: boolean;
}

function HeaderIconItem({
  href,
  icon,
  label,
  active,
  badge,
  badgeLabel,
  isDark,
}: HeaderIconItemProps) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`relative flex flex-col items-center justify-center px-2.5 py-1.5 rounded-md transition-colors min-w-[52px] ${
        isDark
          ? 'text-gray-400 hover:text-white hover:bg-gray-800'
          : 'text-gray-500 hover:text-gray-900 hover:bg-orange-50'
      } ${active ? (isDark ? 'text-white' : 'text-gray-900') : ''}`}
    >
      <span className="relative">
        {icon}
        {badge !== undefined && badge > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white text-[9px] font-bold flex items-center justify-center shadow-sm"
            aria-label={badgeLabel}
            role={badgeLabel ? 'status' : undefined}
          >
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
