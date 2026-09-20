'use client';

import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Lock, Shield } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePermission } from '../../hooks/usePermission';
import { PermissionResource } from '../../types/enums';

export type InventoryPermission =
  | 'INVENTORY:view'
  | 'INVENTORY:create'
  | 'INVENTORY:edit'
  | 'INVENTORY:delete'
  | 'INVENTORY:manage'
  | 'INVENTORY:adjust'
  | 'INVENTORY:transfer'
  | 'INVENTORY:issue'
  | 'INVENTORY:restock'
  | 'INVENTORY:export'
  | 'INVENTORY:import'
  | 'INVENTORY:audit';

export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'MANAGER'
  | 'INVENTORY_MANAGER'
  | 'STORE_KEEPER'
  | 'STAFF'
  | 'VIEWER';

export interface PermissionConfig {
  resource: PermissionResource;
  action: string;
}

export interface InventoryPermissionGuardProps {
  permission: InventoryPermission | PermissionConfig;
  children: ReactNode;
  fallback?: ReactNode;
  showLockIcon?: boolean;
  deniedMessage?: string;
  className?: string;
}

export interface InventoryRoleGuardProps {
  roles: UserRole | UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
  showLockIcon?: boolean;
  deniedMessage?: string;
  className?: string;
}

export interface InventoryPermissionCheckProps {
  permission: InventoryPermission | PermissionConfig;
  children: (hasPermission: boolean, isLoading: boolean) => ReactNode;
  checkOnMount?: boolean;
}

const PERMISSION_MESSAGES: Record<InventoryPermission, string> = {
  'INVENTORY:view': 'You need permission to view inventory items.',
  'INVENTORY:create': 'You need permission to create inventory items.',
  'INVENTORY:edit': 'You need permission to edit inventory items.',
  'INVENTORY:delete': 'You need permission to delete inventory items.',
  'INVENTORY:manage': 'You need management permission for inventory.',
  'INVENTORY:adjust': 'You need permission to adjust inventory stock.',
  'INVENTORY:transfer': 'You need permission to transfer inventory.',
  'INVENTORY:issue': 'You need permission to issue inventory items.',
  'INVENTORY:restock': 'You need permission to restock inventory items.',
  'INVENTORY:export': 'You need permission to export inventory data.',
  'INVENTORY:import': 'You need permission to import inventory data.',
  'INVENTORY:audit': 'You need permission to view inventory audit logs.',
};

const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Administrator',
  ADMIN: 'Administrator',
  MANAGER: 'Manager',
  INVENTORY_MANAGER: 'Inventory Manager',
  STORE_KEEPER: 'Store Keeper',
  STAFF: 'Staff',
  VIEWER: 'Viewer',
};

export function normalizePermissionString(
  permission: InventoryPermission | PermissionConfig
): string {
  if (typeof permission === 'object') {
    return `${String(permission.resource).toLowerCase()}:${permission.action.toLowerCase()}`;
  }
  const [resource, action] = permission.split(':');
  return `${String(resource).toLowerCase()}:${String(action || 'view').toLowerCase()}`;
}

export function parsePermission(
  permission: InventoryPermission | PermissionConfig
): PermissionConfig {
  if (typeof permission === 'object') return permission;
  const [resource, action] = permission.split(':');
  return {
    resource: resource as PermissionResource,
    action: action || 'view',
  };
}

export function hasInventoryPermission(
  user: any,
  permission: InventoryPermission | PermissionConfig,
  hasPermissionFn?: (permission: string) => boolean
): boolean {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;

  const perm = normalizePermissionString(permission);
  if (hasPermissionFn) return hasPermissionFn(perm);
  return user.permissions?.includes?.(perm) || false;
}

export function hasRole(user: any, roles: UserRole | UserRole[]): boolean {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  const list = Array.isArray(roles) ? roles : [roles];
  return list.some((r) => user.role === r);
}

export function InventoryPermissionGuard({
  permission,
  children,
  fallback = null,
  showLockIcon = true,
  deniedMessage,
  className = '',
}: InventoryPermissionGuardProps) {
  const { user, isAuthenticated } = useAuth();
  const {
    hasPermission,
    isLoading: permLoading,
    isSuperAdmin,
  } = usePermission();

  const permString = React.useMemo(
    () => normalizePermissionString(permission),
    [permission]
  );

  const decision = React.useMemo<'loading' | 'granted' | 'denied'>(() => {
    if (permLoading) return 'loading';
    if (!isAuthenticated || !user) return 'denied';

    if (isSuperAdmin) return 'granted';

    return hasPermission(permString) ? 'granted' : 'denied';
  }, [
    permLoading,
    isAuthenticated,
    user,
    isSuperAdmin,
    hasPermission,
    permString,
  ]);

  if (decision === 'loading') {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-brand-500 border-t-transparent" />
        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
          Checking permissions…
        </span>
      </div>
    );
  }

  if (decision === 'denied') {
    if (fallback !== null) return <>{fallback}</>;

    const message =
      deniedMessage ||
      PERMISSION_MESSAGES[permission as InventoryPermission] ||
      'You do not have permission to access this resource.';

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-6 text-center ${className}`}
      >
        {showLockIcon && (
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-gray-400 dark:text-gray-500" />
          </div>
        )}
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
          Access Restricted
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">
          {message}
        </p>
      </motion.div>
    );
  }

  return <>{children}</>;
}

export function InventoryRoleGuard({
  roles,
  children,
  fallback = null,
  showLockIcon = true,
  deniedMessage,
  className = '',
}: InventoryRoleGuardProps) {
  const { user, isAuthenticated } = useAuth();
  const { isSuperAdmin, userRole } = usePermission();

  const decision = React.useMemo<'loading' | 'granted' | 'denied'>(() => {
    if (!isAuthenticated || !user) return 'denied';
    if (isSuperAdmin) return 'granted';
    const list = Array.isArray(roles) ? roles : [roles];
    return list.some((r) => userRole === r) ? 'granted' : 'denied';
  }, [user, isAuthenticated, isSuperAdmin, userRole, roles]);

  if (decision === 'denied') {
    if (fallback !== null) return <>{fallback}</>;

    const list = Array.isArray(roles) ? roles : [roles];
    const labels = list.map((r) => ROLE_DISPLAY_NAMES[r] || r).join(', ');
    const message =
      deniedMessage ||
      `This resource requires one of the following roles: ${labels}`;

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-6 text-center ${className}`}
      >
        {showLockIcon && (
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-gray-400 dark:text-gray-500" />
          </div>
        )}
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
          Role Required
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">
          {message}
        </p>
      </motion.div>
    );
  }

  return <>{children}</>;
}

export function InventoryPermissionCheck({
  permission,
  children,
  checkOnMount = true,
}: InventoryPermissionCheckProps) {
  const { user, isAuthenticated } = useAuth();
  const { hasPermission, isLoading, isSuperAdmin } = usePermission();

  const permString = React.useMemo(
    () => normalizePermissionString(permission),
    [permission]
  );

  const hasAccess = React.useMemo(() => {
    if (isLoading) return false;
    if (!isAuthenticated || !user) return false;
    if (isSuperAdmin) return true;
    return hasPermission(permString);
  }, [isLoading, isAuthenticated, user, isSuperAdmin, hasPermission, permString]);

  void checkOnMount;

  return <>{children(hasAccess, isLoading)}</>;
}

export function InventoryCreateGuard(
  props: Omit<InventoryPermissionGuardProps, 'permission'>
) {
  return <InventoryPermissionGuard permission="INVENTORY:create" {...props} />;
}

export function InventoryEditGuard(
  props: Omit<InventoryPermissionGuardProps, 'permission'>
) {
  return <InventoryPermissionGuard permission="INVENTORY:edit" {...props} />;
}

export function InventoryDeleteGuard(
  props: Omit<InventoryPermissionGuardProps, 'permission'>
) {
  return <InventoryPermissionGuard permission="INVENTORY:delete" {...props} />;
}

export function InventoryViewGuard(
  props: Omit<InventoryPermissionGuardProps, 'permission'>
) {
  return <InventoryPermissionGuard permission="INVENTORY:view" {...props} />;
}

export function InventoryManageGuard(
  props: Omit<InventoryPermissionGuardProps, 'permission'>
) {
  return <InventoryPermissionGuard permission="INVENTORY:manage" {...props} />;
}

export function InventoryAdjustGuard(
  props: Omit<InventoryPermissionGuardProps, 'permission'>
) {
  return <InventoryPermissionGuard permission="INVENTORY:adjust" {...props} />;
}

export function InventoryTransferGuard(
  props: Omit<InventoryPermissionGuardProps, 'permission'>
) {
  return <InventoryPermissionGuard permission="INVENTORY:transfer" {...props} />;
}

export function InventoryExportGuard(
  props: Omit<InventoryPermissionGuardProps, 'permission'>
) {
  return <InventoryPermissionGuard permission="INVENTORY:export" {...props} />;
}

export function useInventoryPermission(
  permission: InventoryPermission | PermissionConfig
): {
  hasPermission: boolean;
  isLoading: boolean;
  isSuperAdmin: boolean;
} {
  const { user, isAuthenticated } = useAuth();
  const {
    hasPermission: hasPerm,
    isLoading,
    isSuperAdmin,
  } = usePermission();

  const permString = React.useMemo(
    () => normalizePermissionString(permission),
    [permission]
  );

  const hasPermission = React.useMemo(() => {
    if (isLoading) return false;
    if (!isAuthenticated || !user) return false;
    if (isSuperAdmin) return true;
    return hasPerm(permString);
  }, [isLoading, isAuthenticated, user, isSuperAdmin, hasPerm, permString]);

  return { hasPermission, isLoading, isSuperAdmin };
}

export function useAnyInventoryPermission(
  permissions: (InventoryPermission | PermissionConfig)[]
): {
  hasAny: boolean;
  isLoading: boolean;
  isSuperAdmin: boolean;
} {
  const { user, isAuthenticated } = useAuth();
  const {
    hasPermission: hasPerm,
    isLoading,
    isSuperAdmin,
  } = usePermission();

  const permStrings = React.useMemo(
    () => permissions.map(normalizePermissionString),
    [JSON.stringify(permissions)]
  );

  const hasAny = React.useMemo(() => {
    if (isLoading) return false;
    if (!isAuthenticated || !user) return false;
    if (isSuperAdmin) return true;
    return permStrings.some((p) => hasPerm(p));
  }, [isLoading, isAuthenticated, user, isSuperAdmin, hasPerm, permStrings]);

  return { hasAny, isLoading, isSuperAdmin };
}

export function useAllInventoryPermissions(
  permissions: (InventoryPermission | PermissionConfig)[]
): {
  hasAll: boolean;
  isLoading: boolean;
  isSuperAdmin: boolean;
} {
  const { user, isAuthenticated } = useAuth();
  const {
    hasPermission: hasPerm,
    isLoading,
    isSuperAdmin,
  } = usePermission();

  const permStrings = React.useMemo(
    () => permissions.map(normalizePermissionString),
    [JSON.stringify(permissions)]
  );

  const hasAll = React.useMemo(() => {
    if (isLoading) return false;
    if (!isAuthenticated || !user) return false;
    if (isSuperAdmin) return true;
    return permStrings.every((p) => hasPerm(p));
  }, [isLoading, isAuthenticated, user, isSuperAdmin, hasPerm, permStrings]);

  return { hasAll, isLoading, isSuperAdmin };
}

export default InventoryPermissionGuard;
