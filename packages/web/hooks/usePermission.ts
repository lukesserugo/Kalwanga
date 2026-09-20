// packages/web/hooks/usePermission.ts
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './useAuth';
import {
  businessUnitService,
  isValidID,
  getBusinessUnitId,
} from '../services/businessUnitService';
import type { BusinessUnit } from '../types/businessUnit';
import {
  buildPermissionsFromSet,
  type UserPermissions,
} from '../types/permissions';

// ============================================================
// CONSTANTS
// ============================================================

const SUPER_ADMIN_ROLES = new Set<string>([
  'SUPER_ADMIN',
  'super_admin',
  'SuperAdmin',
]);

const WILDCARD_TOKENS = new Set<string>(['*', '*:*', '*:*:*']);

// ============================================================
// HELPERS
// ============================================================

function isSuperAdminRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return SUPER_ADMIN_ROLES.has(role);
}

function hasWildcardToken(permissions: readonly string[]): boolean {
  return permissions.some((p) => WILDCARD_TOKENS.has(p));
}

/** Stable stringify for permissions array (avoids array ref churn). */
function permissionsKey(perms: readonly string[]): string {
  return perms.slice().sort().join('|');
}

// ============================================================
// STABLE NAMED CHECKERS
// ============================================================
//
// `safeCan` is ref-backed and stable, so we can safely cache one
// function per permission string at module scope. This is what
// makes `canViewSales`, `canManageUsers`, etc. keep the SAME
// identity across every render — which is what lets components
// depend on them without triggering re-render loops.
//
// The cache stores closures that read the LATEST safeCan via a
// mutable slot, so a checker created once keeps working after
// the hook re-renders with new permission state.
//
// ⚠️ One process-wide cache is fine because every hook instance
//    ultimately funnels through the same resolved `safeCan`
//    semantics. The slot is refreshed on every hook render.

type SafeCan = (permission: string) => boolean;

interface CheckerSlot {
  fn: () => boolean;
  safeCan: { current: SafeCan };
}

const permissionCheckerCache = new Map<string, CheckerSlot>();

function getNamedChecker(permission: string, safeCan: SafeCan): () => boolean {
  const existing = permissionCheckerCache.get(permission);
  if (existing) {
    // Refresh the slot so the closure reads the newest safeCan.
    existing.safeCan.current = safeCan;
    return existing.fn;
  }
  const slot = { current: safeCan };
  const fn = () => slot.current(permission);
  permissionCheckerCache.set(permission, { fn, safeCan: slot });
  return fn;
}

// ============================================================
// HOOK
// ============================================================

export function usePermission() {
  // ────────────────────────────────────────────────────────────
  // FIX #1 — Destructure the AUTHORITATIVE `isSuperAdmin` from
  // useAuth. useAuth already resolves wildcard + role + cache,
  // so we don't have to re-derive it here and risk drift.
  // ────────────────────────────────────────────────────────────
  const {
    user,
    userRole,
    loading: authLoading,
    can,
    isSuperAdmin: authIsSuperAdmin,
  } = useAuth();

  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);

  // ────────────────────────────────────────────────────────────
  // Resolved permission set — keyed by CONTENT, not reference.
  // ────────────────────────────────────────────────────────────
  const permissionsArray = useMemo<string[]>(() => {
    return Array.isArray((user as any)?.permissions)
      ? ((user as any).permissions as string[])
      : [];
  }, [user]);

  const permissionsKeyValue = useMemo(
    () => permissionsKey(permissionsArray),
    [permissionsArray]
  );

  // Stable-by-content permissions reference. Only changes when
  // the underlying permission strings actually change.
  const permissions = useMemo<string[]>(
    () => permissionsArray,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [permissionsKeyValue]
  );

  const userPermissions: UserPermissions = useMemo(
    () => buildPermissionsFromSet(permissions),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [permissionsKeyValue]
  );

  // ────────────────────────────────────────────────────────────
  // FIX #2 — SUPER ADMIN
  //
  // Prefer the authoritative flag from useAuth, then fall back
  // to the same checks the hook previously used. The fallbacks
  // exist so this hook remains correct if it's ever consumed
  // without useAuth in scope (unit tests, storybook, etc.).
  // ────────────────────────────────────────────────────────────
  const isSuperAdmin: boolean = useMemo(() => {
    // Authoritative source of truth.
    if (authIsSuperAdmin) return true;

    // Defensive fallbacks.
    if (isSuperAdminRole(userRole)) return true;
    if (isSuperAdminRole((user as any)?.role)) return true;
    if (hasWildcardToken(permissions)) return true;

    return false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    authIsSuperAdmin,
    userRole,
    (user as any)?.role,
    permissionsKeyValue,
  ]);

  // ────────────────────────────────────────────────────────────
  // FIX #3 — CANONICAL CHECKER — stable via refs.
  //
  // Refs are assigned DURING RENDER (not in effects). Effects
  // run after paint, which previously left a one-render window
  // where `safeCan` saw stale values and returned `false` for
  // SUPER_ADMIN — the source of the "Please Login" flash.
  //
  // ⚠️ Assigning refs during render is safe as long as we don't
  //    READ them during the same render for output. We only read
  //    them inside callbacks invoked after render.
  // ────────────────────────────────────────────────────────────
  const isSuperAdminRef = useRef(isSuperAdmin);
  const permissionsRef = useRef(permissions);
  const canRef = useRef(can);

  isSuperAdminRef.current = isSuperAdmin;
  permissionsRef.current = permissions;
  canRef.current = can;

  // ────────────────────────────────────────────────────────────
  // FIX #4 — safeCan short-circuits on the authoritative flag.
  //
  // `authIsSuperAdmin` is the same value useAuth uses for its own
  // `isSuper`. Reading it directly here means we don't depend on
  // a ref having been refreshed — we get the truth immediately.
  // ────────────────────────────────────────────────────────────
  const safeCan = useCallback(
    (permission: string): boolean => {
      // 1. Authoritative super-admin short-circuit.
      if (authIsSuperAdmin) return true;

      // 2. Ref-based short-circuit (covers future mutations).
      if (isSuperAdminRef.current) return true;

      // 3. Explicit permissions.
      const perms = permissionsRef.current;
      if (hasWildcardToken(perms)) return true;
      if (perms.includes(permission)) return true;

      // 4. Fall through to useAuth's own `can()`.
      const canFn = canRef.current;
      if (typeof canFn === 'function') {
        try {
          return Boolean(canFn(permission));
        } catch {
          return false;
        }
      }

      return false;
    },
    [authIsSuperAdmin]
  );

  // ────────────────────────────────────────────────────────────
  // Business units — guard against repeated fetches
  // ────────────────────────────────────────────────────────────
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [currentBusinessUnit, setCurrentBusinessUnit] =
    useState<BusinessUnit | null>(null);
  const [loadingBusinessUnits, setLoadingBusinessUnits] = useState(false);

  const userId = (user as any)?.id ?? null;
  const fetchedForUserRef = useRef<string | null>(null);

  const refreshBusinessUnits = useCallback(async () => {
    if (!isClient || !user) {
      setBusinessUnits([]);
      setCurrentBusinessUnit(null);
      return;
    }

    setLoadingBusinessUnits(true);
    try {
      const result = await businessUnitService.getAll({
        limit: 100,
        isActive: true,
      });
      const units = result.data;

      setBusinessUnits(units);

      const savedId = getBusinessUnitId();
      const chosen =
        units.find((u) => u.id === savedId && u.isActive !== false) ||
        units.find((u) => u.isActive !== false) ||
        units[0] ||
        null;

      setCurrentBusinessUnit(chosen);
      if (chosen) {
        try {
          localStorage.setItem('businessUnitId', chosen.id);
        } catch {
          /* storage may be unavailable */
        }
      }
    } catch (err) {
      console.error('Failed to load business units:', err);
      setBusinessUnits([]);
      setCurrentBusinessUnit(null);
    } finally {
      setLoadingBusinessUnits(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, userId]);

  // Fetch once per user; do NOT re-run on every render.
  useEffect(() => {
    if (!isClient || !user) return;
    if (fetchedForUserRef.current === userId) return;
    fetchedForUserRef.current = userId;
    refreshBusinessUnits();
  }, [isClient, userId, user, refreshBusinessUnits]);

  const getBusinessUnits = useCallback(() => businessUnits, [businessUnits]);

  const getCurrentBusinessUnit = useCallback(
    () => currentBusinessUnit,
    [currentBusinessUnit]
  );

  const switchBusinessUnit = useCallback(
    async (id: string) => {
      if (!isValidID(id)) throw new Error(`Invalid business unit ID: "${id}"`);
      const unit = businessUnits.find((u) => u.id === id);
      if (!unit) throw new Error(`Business unit ${id} not found`);
      if (unit.isActive === false) throw new Error('Business unit is inactive');
      setCurrentBusinessUnit(unit);
      try {
        localStorage.setItem('businessUnitId', id);
      } catch {
        /* ignore */
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('businessUnitChanged', {
            detail: { businessUnitId: id, businessUnit: unit },
          })
        );
      }
    },
    [businessUnits]
  );

  const hasBusinessUnitAccess = useCallback(
    (businessUnitId: string) => {
      if (!isValidID(businessUnitId)) return false;
      // ✅ Authoritative super-admin check first.
      if (authIsSuperAdmin) return true;
      if (isSuperAdminRef.current) return true;
      return businessUnits.some(
        (u) => u.id === businessUnitId && u.isActive !== false
      );
    },
    [businessUnits, authIsSuperAdmin]
  );

  const getBusinessUnitById = useCallback(
    (id: string) => businessUnits.find((u) => u.id === id),
    [businessUnits]
  );

  const isBusinessUnitSelected = useCallback(
    () => currentBusinessUnit !== null,
    [currentBusinessUnit]
  );

  const getBusinessUnitName = useCallback(
    (id: string) =>
      businessUnits.find((u) => u.id === id)?.name ?? 'Unknown Business Unit',
    [businessUnits]
  );

  // ────────────────────────────────────────────────────────────
  // Permission surface
  // ────────────────────────────────────────────────────────────
  const hasPermissionExact = useCallback(
    (perm: string) => (isClient ? safeCan(perm) : false),
    [isClient, safeCan]
  );

  const hasPermission = hasPermissionExact;

  const hasAnyPermission = useCallback(
    (ps: string[]) => (isClient ? ps.some((p) => safeCan(p)) : false),
    [isClient, safeCan]
  );

  const hasAllPermissions = useCallback(
    (ps: string[]) => (isClient ? ps.every((p) => safeCan(p)) : false),
    [isClient, safeCan]
  );

  // ────────────────────────────────────────────────────────────
  // Role helpers
  //
  // `isSuperAdmin` uses authIsSuperAdmin as the authoritative
  // signal, but role comparison still works normally for the
  // other role tiers.
  // ────────────────────────────────────────────────────────────
  const isRole = useCallback(
    (role: string) => (isClient ? userRole === role : false),
    [isClient, userRole]
  );

  const isAdminOrAbove = useCallback(
    () =>
      isClient
        ? authIsSuperAdmin || ['SUPER_ADMIN', 'ADMIN'].includes(userRole)
        : false,
    [isClient, userRole, authIsSuperAdmin]
  );

  const isManagerOrAbove = useCallback(
    () =>
      isClient
        ? authIsSuperAdmin ||
          ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(userRole)
        : false,
    [isClient, userRole, authIsSuperAdmin]
  );

  const isEditorOrAbove = useCallback(
    () =>
      isClient
        ? authIsSuperAdmin ||
          ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EDITOR'].includes(userRole)
        : false,
    [isClient, userRole, authIsSuperAdmin]
  );

  const isViewerOrAbove = useCallback(
    () =>
      isClient
        ? authIsSuperAdmin ||
          ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER'].includes(
            userRole
          )
        : false,
    [isClient, userRole, authIsSuperAdmin]
  );

  const isAtLeast = useCallback(
    (role: string) => {
      if (!isClient) return false;
      // ✅ Super-admin is at least every role.
      if (authIsSuperAdmin) return true;

      const order = [
        'USER',
        'CASHIER',
        'VIEWER',
        'EMPLOYEE',
        'EDITOR',
        'MANAGER',
        'ADMIN',
        'SUPER_ADMIN',
      ];
      const me = order.indexOf(userRole);
      const need = order.indexOf(role);
      return me >= 0 && need >= 0 && me >= need;
    },
    [isClient, userRole, authIsSuperAdmin]
  );

  // ────────────────────────────────────────────────────────────
  // Resource helpers
  // ────────────────────────────────────────────────────────────
  const canView = useCallback((r: string) => safeCan(`${r}:view`), [safeCan]);
  const canCreate = useCallback(
    (r: string) => safeCan(`${r}:create`),
    [safeCan]
  );
  const canEdit = useCallback(
    (r: string) => safeCan(`${r}:edit`) || safeCan(`${r}:update`),
    [safeCan]
  );
  const canDelete = useCallback(
    (r: string) => safeCan(`${r}:delete`),
    [safeCan]
  );
  const canManage = useCallback(
    (r: string) => safeCan(`${r}:manage`),
    [safeCan]
  );
  const canExport = useCallback(() => safeCan('export:create'), [safeCan]);
  const canImport = useCallback(() => safeCan('import:create'), [safeCan]);

  // ────────────────────────────────────────────────────────────
  // STABLE NAMED CHECKERS
  //
  // Every `canX` below is created via `named(...)`, which returns a
  // module-cached function whose identity never changes across
  // renders. Components may safely use these in dependency arrays.
  //
  // When the backend catalogue gains a permission, add the matching
  // `named(...)` call here and add the export to the return object.
  // ────────────────────────────────────────────────────────────
  const named = useCallback(
    (p: string) => getNamedChecker(p, safeCan),
    [safeCan]
  );

  const canManageUsers = named('user:manage');
  const canViewUsers = named('user:view');
  const canCreateUsers = named('user:create');
  const canEditUsers = named('user:edit');
  const canDeleteUsers = named('user:delete');
  const canExportUsers = named('user:export');
  const canActivateUsers = named('user:activate');
  const canDeactivateUsers = named('user:deactivate');
  const canUpdateUserRole = named('user:role:update');

  const canManageCategories = named('category:manage');
  const canViewCategories = named('category:view');
  const canCreateCategories = named('category:create');
  const canEditCategories = named('category:edit');
  const canDeleteCategories = named('category:delete');

  const canManageProducts = named('product:manage');
  const canViewProducts = named('product:view');
  const canCreateProducts = named('product:create');
  const canEditProducts = named('product:edit');
  const canDeleteProducts = named('product:delete');
  const canExportProducts = named('product:export');
  const canImportProducts = named('product:import');

  const canManageOrders = named('order:manage');
  const canViewOrders = named('order:view');
  const canCreateOrders = named('order:create');
  const canEditOrders = named('order:edit');
  const canDeleteOrders = named('order:delete');
  const canProcessOrders = named('order:process');
  const canCancelOrders = named('order:cancel');

  const canManageCustomers = named('customer:manage');
  const canViewCustomers = named('customer:view');
  const canCreateCustomers = named('customer:create');
  const canEditCustomers = named('customer:edit');
  const canDeleteCustomers = named('customer:delete');

  // ────────────────────────────────────────────────────────────
  // Inventory — mirrors the backend catalogue at
  // packages/backend/src/permissions/inventory.ts.
  // If you add a permission there, add the matching checker here.
  // ────────────────────────────────────────────────────────────
  const canManageInventory = named('inventory:manage');
  const canViewInventory = named('inventory:view');
  const canCreateInventory = named('inventory:create');
  const canEditInventory = named('inventory:edit');
  const canDeleteInventory = named('inventory:delete');
  const canExportInventory = named('inventory:export');
  const canImportInventory = named('inventory:import');
  const canAdjustInventory = named('inventory:adjust');
  const canTransferInventory = named('inventory:transfer');
  const canIssueInventory = named('inventory:issue');
  const canRestockInventory = named('inventory:restock');
  const canViewInventoryLowStock = named('inventory:view_low_stock');
  const canViewInventoryReports = named('inventory:view_reports');
  const canViewInventoryAudit = named('inventory:view_audit');

  const canManageSales = named('sale:manage');
  const canViewSales = named('sale:view');
  const canCreateSales = named('sale:create');
  const canEditSales = named('sale:edit');
  const canDeleteSales = named('sale:delete');
  const canExportSales = named('sale:export');
  const canPrintSales = named('sale:print');
  const canEmailSales = named('sale:email');

  const canManageReturns = named('return:manage');
  const canViewReturns = named('return:view');
  const canCreateReturns = named('return:create');
  const canEditReturns = named('return:edit');
  const canDeleteReturns = named('return:delete');
  const canApproveReturns = named('return:approve');
  const canRejectReturns = named('return:reject');
  const canProcessReturns = named('return:process');

  const canManageRefunds = named('refund:manage');
  const canViewRefunds = named('refund:view');
  const canCreateRefunds = named('refund:create');
  const canEditRefunds = named('refund:edit');
  const canDeleteRefunds = named('refund:delete');
  const canApproveRefunds = named('refund:approve');
  const canRejectRefunds = named('refund:reject');
  const canCompleteRefunds = named('refund:complete');

  const canManageInvoices = named('invoice:manage');
  const canViewInvoices = named('invoice:view');
  const canCreateInvoices = named('invoice:create');
  const canEditInvoices = named('invoice:edit');
  const canDeleteInvoices = named('invoice:delete');
  const canSendInvoices = named('invoice:send');
  const canPrintInvoices = named('invoice:print');
  const canMarkInvoicePaid = named('invoice:paid');
  const canVoidInvoices = named('invoice:void');
  const canCancelInvoices = named('invoice:cancel');

  const canManageReceipts = named('receipt:manage');
  const canViewReceipts = named('receipt:view');
  const canCreateReceipts = named('receipt:create');
  const canEditReceipts = named('receipt:edit');
  const canDeleteReceipts = named('receipt:delete');
  const canPrintReceipts = named('receipt:print');
  const canEmailReceipts = named('receipt:email');
  const canVoidReceipts = named('receipt:void');

  const canManagePayments = named('payment:manage');
  const canViewPayments = named('payment:view');
  const canCreatePayments = named('payment:create');
  const canRefundPayments = named('payment:refund');

  const canManagePos = named('pos:manage');
  const canViewPos = named('pos:view');
  const canCreatePos = named('pos:create');
  const canPrintPos = named('pos:print');

  const canManageCashRegister = named('cash_register:manage');
  const canViewCashRegister = named('cash_register:view');
  const canOpenCashRegister = named('cash_register:open');
  const canCloseCashRegister = named('cash_register:close');

  const canManageShifts = named('shift:manage');
  const canViewShifts = named('shift:view');
  const canStartShift = named('shift:start');
  const canEndShift = named('shift:end');

  const canManageReports = named('report:manage');
  const canViewReports = named('report:view');
  const canCreateReports = named('report:create');
  const canExportReports = named('report:export');

  const canViewAnalytics = named('analytics:view');
  const canExportAnalytics = named('analytics:export');

  const canManageSettings = named('settings:manage');
  const canViewSettings = named('settings:view');
  const canEditSettings = named('settings:edit');

  const canManageBusinessUnits = named('business_unit:manage');
  const canViewBusinessUnits = named('business_unit:view');
  const canCreateBusinessUnits = named('business_unit:create');
  const canEditBusinessUnits = named('business_unit:edit');
  const canDeleteBusinessUnits = named('business_unit:delete');

  const canViewSystemLogs = named('system:logs');
  const canBackupSystem = named('system:backup');
  const canRestoreSystem = named('system:restore');

  const canViewDashboard = named('dashboard:view');
  const canManageDashboard = named('dashboard:manage');

  const canManageIntegrations = named('integration:manage');
  const canViewIntegrations = named('integration:view');
  const canManageApi = named('api:manage');
  const canViewApi = named('api:view');
  const canManageWebhooks = named('webhook:manage');
  const canViewWebhooks = named('webhook:view');

  const getPermissions = useCallback(() => permissions, [permissions]);

  const getPermissionsByResource = useCallback(() => {
    const grouped: Record<string, string[]> = {};
    for (const p of permissions) {
      const [resource, action] = p.split(':');
      if (!resource) continue;
      if (!grouped[resource]) grouped[resource] = [];
      if (action && !grouped[resource].includes(action)) {
        grouped[resource].push(action);
      }
    }
    return grouped;
  }, [permissions]);

  // IMPORTANT: isLoading should NOT include loadingBusinessUnits,
  // otherwise POS is stuck on "Checking permissions..." until BUs
  // finish loading. BUs load async and are not required for the
  // permission gate.
  //
  // ⚠️ Also do NOT wait for `isSuperAdmin` to be true before
  //    reporting `isLoading: false`. Once auth is settled, the
  //    permission gate is ready to answer — even if the answer
  //    is "no". Waiting longer would re-introduce the flash.
  const isLoading = authLoading || !isClient;

  return {
    isLoading,

    hasPermission,
    hasPermissionExact,
    hasAnyPermission,
    hasAllPermissions,

    isSuperAdmin,
    isRole,
    isAtLeast,
    isAdminOrAbove,
    isManagerOrAbove,
    isEditorOrAbove,
    isViewerOrAbove,

    canView,
    canCreate,
    canEdit,
    canDelete,
    canManage,
    canExport,
    canImport,

    canManageUsers,
    canViewUsers,
    canCreateUsers,
    canEditUsers,
    canDeleteUsers,
    canExportUsers,
    canActivateUsers,
    canDeactivateUsers,
    canUpdateUserRole,

    canManageCategories,
    canViewCategories,
    canCreateCategories,
    canEditCategories,
    canDeleteCategories,

    canManageProducts,
    canViewProducts,
    canCreateProducts,
    canEditProducts,
    canDeleteProducts,
    canExportProducts,
    canImportProducts,

    canManageOrders,
    canViewOrders,
    canCreateOrders,
    canEditOrders,
    canDeleteOrders,
    canProcessOrders,
    canCancelOrders,

    canManageCustomers,
    canViewCustomers,
    canCreateCustomers,
    canEditCustomers,
    canDeleteCustomers,

    // ────────────────────────────────────────────────────────────
    // Inventory — mirrors packages/backend/src/permissions/inventory.ts
    // ────────────────────────────────────────────────────────────
    canManageInventory,
    canViewInventory,
    canCreateInventory,
    canEditInventory,
    canDeleteInventory,
    canExportInventory,
    canImportInventory,
    canAdjustInventory,
    canTransferInventory,
    canIssueInventory,
    canRestockInventory,
    canViewInventoryLowStock,
    canViewInventoryReports,
    canViewInventoryAudit,

    canManageSales,
    canViewSales,
    canCreateSales,
    canEditSales,
    canDeleteSales,
    canExportSales,
    canPrintSales,
    canEmailSales,

    canManageReturns,
    canViewReturns,
    canCreateReturns,
    canEditReturns,
    canDeleteReturns,
    canApproveReturns,
    canRejectReturns,
    canProcessReturns,

    canManageRefunds,
    canViewRefunds,
    canCreateRefunds,
    canEditRefunds,
    canDeleteRefunds,
    canApproveRefunds,
    canRejectRefunds,
    canCompleteRefunds,

    canManageInvoices,
    canViewInvoices,
    canCreateInvoices,
    canEditInvoices,
    canDeleteInvoices,
    canSendInvoices,
    canPrintInvoices,
    canMarkInvoicePaid,
    canVoidInvoices,
    canCancelInvoices,

    canManageReceipts,
    canViewReceipts,
    canCreateReceipts,
    canEditReceipts,
    canDeleteReceipts,
    canPrintReceipts,
    canEmailReceipts,
    canVoidReceipts,

    canManagePayments,
    canViewPayments,
    canCreatePayments,
    canRefundPayments,

    canManagePos,
    canViewPos,
    canCreatePos,
    canPrintPos,

    canManageCashRegister,
    canViewCashRegister,
    canOpenCashRegister,
    canCloseCashRegister,

    canManageShifts,
    canViewShifts,
    canStartShift,
    canEndShift,

    canManageReports,
    canViewReports,
    canCreateReports,
    canExportReports,

    canViewAnalytics,
    canExportAnalytics,

    canManageSettings,
    canViewSettings,
    canEditSettings,

    canManageBusinessUnits,
    canViewBusinessUnits,
    canCreateBusinessUnits,
    canEditBusinessUnits,
    canDeleteBusinessUnits,

    canViewSystemLogs,
    canBackupSystem,
    canRestoreSystem,

    canViewDashboard,
    canManageDashboard,

    canManageIntegrations,
    canViewIntegrations,
    canManageApi,
    canViewApi,
    canManageWebhooks,
    canViewWebhooks,

    getPermissions,
    getPermissionsByResource,

    getBusinessUnits,
    getCurrentBusinessUnit,
    switchBusinessUnit,
    refreshBusinessUnits,
    hasBusinessUnitAccess,
    getBusinessUnitById,
    isBusinessUnitSelected,
    getBusinessUnitName,

    userPermissions,

    user,
    userRole,
    permissions,
  };
}

export { usePermission as usePermissions };

export function useCan(permission: string): boolean {
  const { hasPermissionExact } = usePermission();
  return hasPermissionExact(permission);
}

export function useCanAny(permissions: string[]): boolean {
  const { hasAnyPermission } = usePermission();
  return hasAnyPermission(permissions);
}

export function useCanAll(permissions: string[]): boolean {
  const { hasAllPermissions } = usePermission();
  return hasAllPermissions(permissions);
}

export type { BusinessUnit };
