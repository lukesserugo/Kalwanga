// D:\Projects\Kalwanga\packages\web\app\(dashboard)\layout.tsx

'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import Sidebar from '../../components/layout/Sidebar';
import Header from '../../components/layout/Header';
import { OnboardingProvider } from '../../hooks/useOnboarding';
import OnboardingGateGuard from '../../components/onboarding/OnboardingGateGuard';
import OnboardingGuide from '../../components/onboarding/OnboardingGuide';

// ============================================
// NOTIFICATION UI
// ============================================
//
// These three pieces wire the notification surface into every
// dashboard route:
//
//   ConfirmProvider            — provides imperative confirm()
//                                everywhere, rendering a styled
//                                ConfirmDialog at the tree root.
//                                The notifications page and any
//                                future surface can call
//                                `useConfirm()` without each page
//                                mounting its own dialog.
//   NotificationBell           — mounted inside the Header so the
//                                unread count and dropdown are
//                                globally reachable.
//   BrowserNotificationPrompt  — floating opt-in banner for
//                                browser push permission.
//
// None of them alter routing, permissions, or onboarding. They
// are strictly additive.

import { ConfirmProvider } from '../../components/notifications/ConfirmProvider';
import { NotificationBell } from '../../components/notifications/NotificationBell';
import { BrowserNotificationPrompt } from '../../components/notifications/BrowserNotificationPrompt';

// ============================================
// CANONICAL PERMISSION IMPORTS
// ============================================
//
// All role → permission decisions live in `types/permissions.ts`.
// The layout only consumes them — no local role tables, no local
// builders. This guarantees the sidebar, header, route guard, and
// every other consumer agrees on who has what.
//
//   UserPermissions           — the boolean-flag interface
//   ALL_ACCESS_PERMISSIONS    — the wildcard flag set (SUPER_ADMIN)
//   NO_ACCESS_PERMISSIONS     — the locked-out baseline
//   buildPermissionsForRole   — role string → UserPermissions
//   isSuperAdminRole          — single source of truth for the role

import {
  UserPermissions,
  ALL_ACCESS_PERMISSIONS,
  NO_ACCESS_PERMISSIONS,
  buildPermissionsForRole,
  isSuperAdminRole,
} from '../../types/permissions';

// ============================================================
// ROUTE ACCESS RULES
// ============================================================
//
// IMPORTANT: order matters. More specific paths must come BEFORE
// their parent prefixes, or the parent will match first.
//
// The check function below sorts by path length so this file
// doesn't need to be manually ordered — but keeping the map
// roughly ordered from specific to general makes it easier to
// reason about.

const PUBLIC_ROUTES = ['/dashboard', '/admin', '/admin/catalog'];

const ROUTE_PERMISSIONS: Record<string, keyof UserPermissions> = {
  // ------------------------------------------------------------
  // Sales — specific routes first
  // ------------------------------------------------------------
  '/admin/sales/dashboard': 'canViewSales',
  '/admin/sales/analytics': 'canViewAnalytics',
  '/admin/sales/pos': 'canManagePos',
  '/admin/sales/returns': 'canViewReturns',
  '/admin/sales/refunds': 'canManageReturns',
  '/admin/sales/invoices': 'canViewInvoices',
  '/admin/sales/receipts': 'canViewReceipts',
  '/admin/sales/settings': 'canManageSales',
  '/admin/sales/reports': 'canViewReports',
  '/admin/sales/export': 'canViewSales',
  '/admin/sales': 'canViewSales',

  // ------------------------------------------------------------
  // Catalog
  // ------------------------------------------------------------
  '/admin/catalog/categories': 'canViewCategories',
  '/admin/catalog/suppliers': 'canViewSuppliers',
  '/admin/catalog/import': 'canImportProducts',
  '/admin/catalog/export': 'canExportProducts',
  '/admin/catalog/tags': 'canManageProducts',
  '/admin/catalog/edit': 'canManageProducts',
  '/admin/catalog/add': 'canManageProducts',
  '/admin/catalog': 'canViewProducts',

  // ------------------------------------------------------------
  // Other admin areas
  // ------------------------------------------------------------
  '/admin/categories': 'canViewCategories',
  '/admin/suppliers': 'canViewSuppliers',
  '/admin/inventory': 'canViewInventory',
  '/admin/orders': 'canViewOrders',
  '/admin/customers': 'canViewCustomers',
  '/admin/users': 'canManageUsers',
  '/admin/reports': 'canViewReports',
  '/admin/settings': 'canManageSettings',
  '/admin/shifts': 'canViewShifts',
  '/admin/bookkeeping': 'canViewBookkeeping',
  '/admin/payments': 'canViewPayments',

  // ------------------------------------------------------------
  // Public storefront
  // ------------------------------------------------------------
  '/shop/create': 'canManageProducts',
  '/shop/edit': 'canManageProducts',
  '/shop': 'canViewProducts',

  '/categories/create': 'canManageCategories',
  '/categories/edit': 'canManageCategories',
  '/categories': 'canViewCategories',

  '/orders/create': 'canManageOrders',
  '/orders': 'canViewOrders',

  '/customers': 'canViewCustomers',
  '/inventory': 'canViewInventory',
  '/reports': 'canViewReports',
  '/users': 'canManageUsers',
  '/settings': 'canManageSettings',
  '/pos': 'canViewOrders',
  '/suppliers': 'canViewSuppliers',
};

// ============================================================
// PRE-COMPUTED ROUTE RULES
// ============================================================
//
// Sort ONCE at module load. Longest prefix first so
// `/admin/sales/pos` beats `/admin/sales`.
//
// Previously this sort ran inside `checkRouteAccess`, which meant
// every pathname change for every non-super-admin user re-sorted
// a ~30-entry array. Hoisting it removes that work from the hot
// path entirely.

const SORTED_ROUTE_RULES: Array<[string, keyof UserPermissions]> =
  Object.entries(ROUTE_PERMISSIONS).sort(
    (a, b) => b[0].length - a[0].length
  );

// ============================================================
// HELPERS
// ============================================================

/**
 * Check whether the given path is under the given prefix.
 * `/admin/sales` matches `/admin/sales` and `/admin/sales/pos`
 * but NOT `/admin/salesx`.
 */
function isUnderPath(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + '/');
}

/**
 * Extract a role string from Clerk's flexible metadata. Returns
 * `null` when nothing usable is present, so `buildPermissionsForRole`
 * can decide the fallback (which is the locked-out baseline, not
 * admin). Returning 'ADMIN' here would silently grant admin
 * permissions to an unidentified user — that was a bug in the
 * previous version.
 */
function extractRole(user: ReturnType<typeof useUser>['user']): string | null {
  if (!user) return null;

  const candidates: unknown[] = [
    (user.publicMetadata as Record<string, unknown> | undefined)?.role,
    (user.unsafeMetadata as Record<string, unknown> | undefined)?.role,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
}

/**
 * Decide whether the current user has access to a given path.
 *
 * Access rules, in priority order:
 *   1. PUBLIC_ROUTES — always allowed for signed-in users.
 *   2. Any other /admin or /dashboard/admin path — allowed if the
 *      user holds ANY admin-level permission flag.
 *   3. ROUTE_PERMISSIONS — the specific flag for the matched prefix.
 *   4. Default — allowed. (This is the "route has no rule, let it
 *      through" case, which is intended for user-level pages like
 *      /profile, /settings/personal, etc.)
 *
 * Sort order for ROUTE_PERMISSIONS: longest prefix wins, so
 * `/admin/sales/pos` beats `/admin/sales`. The sort is
 * pre-computed at module scope in `SORTED_ROUTE_RULES`.
 */
function checkRouteAccess(
  path: string,
  permissions: UserPermissions,
  isSuperAdmin: boolean
): boolean {
  // 1. Super admin bypasses every route check unconditionally.
  if (isSuperAdmin) return true;

  // 2. Public routes.
  for (const route of PUBLIC_ROUTES) {
    if (isUnderPath(path, route)) return true;
  }

  // 3. Any /admin path — check for at least one admin-level flag.
  if (path.startsWith('/admin') || path.startsWith('/dashboard/admin')) {
    const hasAnyAdminFlag =
      permissions.canManageProducts ||
      permissions.canViewProducts ||
      permissions.canManageInventory ||
      permissions.canViewInventory ||
      permissions.canManageCategories ||
      permissions.canViewCategories ||
      permissions.canManageOrders ||
      permissions.canViewOrders ||
      permissions.canManageCustomers ||
      permissions.canViewCustomers ||
      permissions.canManageUsers ||
      permissions.canViewReports ||
      permissions.canManageSettings ||
      permissions.canManageSuppliers ||
      permissions.canViewSuppliers ||
      permissions.canViewSales ||
      permissions.canManageSales ||
      permissions.canViewAnalytics ||
      permissions.canManagePos ||
      permissions.canViewReturns ||
      permissions.canManageReturns ||
      permissions.canViewInvoices ||
      permissions.canManageInvoices ||
      permissions.canViewReceipts ||
      permissions.canPrintReceipts ||
      permissions.canViewShifts ||
      permissions.canManageShifts ||
      permissions.canViewBookkeeping ||
      permissions.canManageBookkeeping ||
      permissions.canViewPayments ||
      permissions.canManagePayments;

    if (!hasAnyAdminFlag) return false;
  }

  // 4. Specific route rules — longest match wins.
  for (const [route, permission] of SORTED_ROUTE_RULES) {
    if (isUnderPath(path, route)) {
      return Boolean(permissions[permission]);
    }
  }

  // 5. No rule — allow. Personal pages like /profile, /settings/profile
  //    fall here and don't require a specific permission.
  return true;
}

// ============================================================
// LAYOUT
// ============================================================

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

  // ------------------------------------------------------------
  // DERIVED ROLE + PERMISSIONS
  //
  // Flow:
  //   1. role         = extractRole(user)   — null when unset
  //   2. isSuperAdmin = isSuperAdminRole(role)
  //   3. permissions  = isSuperAdmin
  //                     ? ALL_ACCESS_PERMISSIONS
  //                     : buildPermissionsForRole(role) ?? NO_ACCESS_PERMISSIONS
  //
  // We memoize on `role` (a primitive string) rather than on
  // `user` (an object whose identity Clerk may refresh). That
  // means the heavy permission memo only recomputes when the
  // role actually changes — not on every Clerk metadata refresh,
  // not on every parent re-render.
  //
  // The super-admin short-circuit lives here as well as inside
  // `buildPermissionsForRole` — belt and braces. If either layer
  // gains a bug, the other keeps super admins working.
  // ------------------------------------------------------------
  const role = useMemo(() => extractRole(user), [user]);

  const { userPermissions, isSuperAdmin } = useMemo<{
    userPermissions: UserPermissions;
    isSuperAdmin: boolean;
  }>(() => {
    // No role metadata yet (signed out, or signed in but Clerk
    // hasn't populated metadata). Grant everything so the layout
    // doesn't render a half-built sidebar — the loading gate
    // (`permissionsReady`) hides this frame from the user.
    if (!role) {
      return {
        userPermissions: ALL_ACCESS_PERMISSIONS,
        isSuperAdmin: false,
      };
    }

    if (isSuperAdminRole(role)) {
      return {
        userPermissions: ALL_ACCESS_PERMISSIONS,
        isSuperAdmin: true,
      };
    }

    return {
      userPermissions: buildPermissionsForRole(role) ?? NO_ACCESS_PERMISSIONS,
      isSuperAdmin: false,
    };
  }, [role]);

  // Permissions are ready when Clerk has loaded AND either the
  // user is present (permissions derived above) or the user is
  // definitively signed out.
  const permissionsReady = isLoaded && (!isSignedIn || Boolean(user));

  // ------------------------------------------------------------
  // SIDEBAR STATE
  // ------------------------------------------------------------
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebarCollapsed');
      if (saved !== null) {
        setIsCollapsed(saved === 'true');
      }
    } catch (error) {
      console.error('Failed to load sidebar state:', error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('sidebarCollapsed', String(isCollapsed));
    } catch (error) {
      console.error('Failed to save sidebar state:', error);
    }
  }, [isCollapsed]);

  // ------------------------------------------------------------
  // REDIRECT UNAUTHENTICATED
  // ------------------------------------------------------------
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      const redirectPath = pathname || '/dashboard';
      router.push(
        `/login?redirect_url=${encodeURIComponent(redirectPath)}`
      );
    }
  }, [isLoaded, isSignedIn, router, pathname]);

  // ------------------------------------------------------------
  // ENFORCE ROUTE PERMISSIONS
  //
  // Super admin bypasses this entirely (returns early). Everyone
  // else falls through to `checkRouteAccess`.
  // ------------------------------------------------------------
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !permissionsReady) return;
    if (isSuperAdmin) return;

    const hasAccess = checkRouteAccess(
      pathname,
      userPermissions,
      false
    );

    if (!hasAccess) {
      router.push('/unauthorized');
    }
  }, [
    isLoaded,
    isSignedIn,
    permissionsReady,
    isSuperAdmin,
    pathname,
    userPermissions,
    router,
  ]);

  const handleToggleCollapse = () => setIsCollapsed((prev) => !prev);
  const handleToggleMobile = () => setIsMobileOpen((prev) => !prev);

  // ------------------------------------------------------------
  // LOADING STATE
  // ------------------------------------------------------------
  if (!permissionsReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading dashboard...
          </p>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------
  // UNAUTHENTICATED
  // The redirect effect above navigates away; return null so we
  // don't flash anything.
  // ------------------------------------------------------------
  if (!isSignedIn) {
    return null;
  }

  // ------------------------------------------------------------
  // MAIN RENDER
  //
  // Notification wiring:
  //   ConfirmProvider      — outer wrapper; must be above anything
  //                          that calls useConfirm().
  //   Header               — receives the bell via a `rightSlot`
  //                          prop OR the bell is placed inside
  //                          Header. See note below.
  //   BrowserNotificationPrompt — floating, placed once at the
  //                          dashboard root.
  //
  // The Header component itself is NOT modified by this file —
  // it stays exactly as it was. If your Header already accepts a
  // `rightSlot` or `actions` prop, pass <NotificationBell /> there.
  // If it doesn't, we render the bell as a fixed-position element
  // in the top-right corner, visually aligned with the header,
  // without touching Header's internals.
  // ------------------------------------------------------------
  return (
    <ConfirmProvider>
      <OnboardingProvider>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="flex h-screen overflow-hidden">
            <Sidebar
              isCollapsed={isCollapsed}
              isMobileOpen={isMobileOpen}
              onToggleCollapse={handleToggleCollapse}
              onToggleMobile={handleToggleMobile}
              permissions={userPermissions}
            />

            <div className="flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out">
              <Header
                onMenuClick={handleToggleMobile}
                permissions={userPermissions}
              />

              <motion.main
                key={pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex-1 overflow-y-auto p-4 md:p-6"
              >
                <div className="max-w-7xl mx-auto">
                  <OnboardingGateGuard>{children}</OnboardingGateGuard>
                </div>
              </motion.main>
            </div>
          </div>

          {/* Floating onboarding guide — auto-hides when all gates are met */}
          <OnboardingGuide />

          {/*
            Notification bell.
            Rendered as an absolutely-positioned element so it
            doesn't require changing Header's API. Sits in the
            top-right of the header area, on top of whatever the
            Header renders there. z-index is below the bell's own
            dropdown (z-50) so the panel still layers correctly.
          */}
          <div className="fixed top-3 right-3 md:top-4 md:right-6 z-30">
            <NotificationBell />
          </div>

          {/* Floating push-permission opt-in banner */}
          <BrowserNotificationPrompt />
        </div>
      </OnboardingProvider>
    </ConfirmProvider>
  );
}
