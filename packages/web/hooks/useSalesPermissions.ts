// packages/web/hooks/useSalesPermissions.ts
'use client';

import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { usePermission } from './usePermission';
import { getBusinessUnitId } from '../services/businessUnitService';

/**
 * Sales-scoped permission surface.
 *
 * ⚠️ This hook does NOT decide who can do what. It reflects the
 * resolved permission set the backend returned from /auth/permissions.
 * Every boolean below is a straight alias to a stable `usePermission`
 * checker.
 *
 * Because `usePermission`'s named checkers (canViewSales, etc.) and
 * its `hasPermission` are referentially stable across renders, the
 * `useMemo` below will only recompute when the underlying user or
 * permission set actually changes — not on every render.
 *
 * If you add a new sales-related permission to the backend catalogue,
 * add the matching boolean here. Nothing else in this file should
 * interpret roles.
 */
export function useSalesPermissions() {
  const { user, can } = useAuth();
  const {
    hasPermission,
    canViewSales: canViewSalesFromHook,
    canManageSales: canManageSalesFromHook,
    canEditSales: canEditSalesFromHook,
    canDeleteSales: canDeleteSalesFromHook,
    canExportSales: canExportSalesFromHook,
    canViewCustomers,
    canViewBusinessUnits,
    canViewAnalytics,
  } = usePermission();

  const role = (user?.role as string) ?? 'EMPLOYEE';

  return useMemo(() => {
    const hasWildcard = can('*');
    const hasGlobalView = hasWildcard || hasPermission('sale:view:all');

    // Values (not functions) — computed once per memo run.
    const canViewSales = canViewSalesFromHook();
    const canManageSales = canManageSalesFromHook();
    const canEditSales = canEditSalesFromHook();
    const canDeleteSales = canDeleteSalesFromHook();
    const canExportSales = canExportSalesFromHook();

    /**
     * The filter object consumed by salesService.list / getStats.
     *
     *   { }                              → no filter, see everything
     *   { businessUnitId: <current> }    → scoped to current BU
     *   { userId: <current user> }       → scoped to own sales
     */
    const getSalesFilter = (): {
      userId?: string;
      businessUnitId?: string;
    } => {
      if (!user) return {};

      // Full access — no narrowing.
      if (hasGlobalView) return {};

      // Scoped to a business unit.
      const currentBusinessUnitId = getBusinessUnitId();
      if (currentBusinessUnitId) {
        return { businessUnitId: currentBusinessUnitId };
      }

      // Fall back to "only my own sales".
      return { userId: user.id };
    };

    return {
      // ---------- View ----------
      canViewSales,
      canViewAllSales: hasGlobalView,
      canViewStats: canViewAnalytics(),

      // ---------- Manage ----------
      canManageSales,
      canRefundSales: hasPermission('refund:create'),
      canEditSales,
      canDeleteSales,

      // ---------- Export ----------
      canExportSales,

      // ---------- Scoped detail views ----------
      canViewCustomerDetails: canViewCustomers(),
      canViewCashierInfo: canViewBusinessUnits(),

      // ---------- Filters ----------
      getSalesFilter,

      // ---------- Role convenience (read-only, do not branch on these) ----------
      role,
      isAdmin: role === 'SUPER_ADMIN' || role === 'ADMIN',
      isManager: role === 'MANAGER',
      isEmployee: role === 'EMPLOYEE' || role === 'CASHIER',
    };
    // All deps below are referentially stable now:
    //  - `user`            → object from useAuth context (stable per auth change)
    //  - `role`            → primitive string
    //  - `can`             → useCallback from useAuth
    //  - `hasPermission`   → useCallback from usePermission
    //  - `canXFromHook`    → stable named checkers from usePermission
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user,
    role,
    can,
    hasPermission,
    canViewSalesFromHook,
    canManageSalesFromHook,
    canEditSalesFromHook,
    canDeleteSalesFromHook,
    canExportSalesFromHook,
    canViewCustomers,
    canViewBusinessUnits,
    canViewAnalytics,
  ]);
}
