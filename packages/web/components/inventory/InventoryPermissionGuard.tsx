// D:\Projects\Kalwanga\packages\web\components\inventory\InventoryPermissionGuard.tsx

'use client';

import React, { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, AlertCircle, Shield, CheckCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePermission } from '../../hooks/usePermission';
import { PermissionResource } from '../../types/enums';

// ============================================
// TYPES
// ============================================

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
  /**
   * The permission required to view the children
   */
  permission: InventoryPermission | PermissionConfig;
  /**
   * The children to render if permission is granted
   */
  children: ReactNode;
  /**
   * Optional fallback content to render if permission is denied
   */
  fallback?: ReactNode;
  /**
   * Whether to show a lock icon when permission is denied
   */
  showLockIcon?: boolean;
  /**
   * Custom message to show when permission is denied
   */
  deniedMessage?: string;
  /**
   * Additional CSS classes
   */
  className?: string;
}

export interface InventoryRoleGuardProps {
  /**
   * The roles allowed to view the children
   */
  roles: UserRole | UserRole[];
  /**
   * The children to render if role is granted
   */
  children: ReactNode;
  /**
   * Optional fallback content to render if role is denied
   */
  fallback?: ReactNode;
  /**
   * Whether to show a lock icon when role is denied
   */
  showLockIcon?: boolean;
  /**
   * Custom message to show when role is denied
   */
  deniedMessage?: string;
  /**
   * Additional CSS classes
   */
  className?: string;
}

export interface InventoryPermissionCheckProps {
  /**
   * The permission to check
   */
  permission: InventoryPermission | PermissionConfig;
  /**
   * The children to render if permission is granted (render prop)
   */
  children: (hasPermission: boolean, isLoading: boolean) => ReactNode;
  /**
   * Whether to check the permission on mount
   */
  checkOnMount?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

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
  'SUPER_ADMIN': 'Super Administrator',
  'ADMIN': 'Administrator',
  'MANAGER': 'Manager',
  'INVENTORY_MANAGER': 'Inventory Manager',
  'STORE_KEEPER': 'Store Keeper',
  'STAFF': 'Staff',
  'VIEWER': 'Viewer',
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Convert InventoryPermission to PermissionResource and action
 */
export function parsePermission(permission: InventoryPermission | PermissionConfig): PermissionConfig {
  if (typeof permission === 'object') {
    return permission;
  }
  
  const [resource, action] = permission.split(':');
  return {
    resource: resource as PermissionResource,
    action: action || 'view',
  };
}

/**
 * Check if a user has a specific inventory permission
 */
export function hasInventoryPermission(
  user: any,
  permission: InventoryPermission | PermissionConfig,
  hasPermissionFn?: (permission: string) => boolean
): boolean {
  if (!user) return false;
  
  // Super admin always has access
  if (user.role === 'SUPER_ADMIN') return true;
  
  // Use the provided hasPermission function if available
  if (hasPermissionFn) {
    const perm = typeof permission === 'string' ? permission : `${permission.resource}:${permission.action}`;
    return hasPermissionFn(perm);
  }
  
  // Fallback: Check if user has the permission in their permissions array
  const perm = typeof permission === 'string' ? permission : `${permission.resource}:${permission.action}`;
  return user.permissions?.includes?.(perm) || false;
}

/**
 * Check if a user has a specific role
 */
export function hasRole(user: any, roles: UserRole | UserRole[]): boolean {
  if (!user) return false;
  
  // Super admin always has access
  if (user.role === 'SUPER_ADMIN') return true;
  
  const roleList = Array.isArray(roles) ? roles : [roles];
  return roleList.some(role => user.role === role);
}

// ============================================
// PERMISSION GUARD COMPONENT
// ============================================

export function InventoryPermissionGuard({
  permission,
  children,
  fallback = null,
  showLockIcon = true,
  deniedMessage,
  className = '',
}: InventoryPermissionGuardProps) {
  const { user, isAuthenticated } = useAuth();
  const { hasPermission, isLoading } = usePermission();
  
  // Determine if user has permission
  const hasAccess = React.useMemo(() => {
    if (!isAuthenticated || !user) return false;
    
    // Super admin always has access
    if (user.role === 'SUPER_ADMIN') return true;
    
    // Parse permission
    const parsed = parsePermission(permission);
    const permString = typeof permission === 'string' ? permission : `${parsed.resource}:${parsed.action}`;
    
    // Check using hasPermission from usePermission hook
    return hasPermission(permString);
  }, [user, isAuthenticated, permission, hasPermission]);

  // Loading state
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />
        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Checking permissions...</span>
      </div>
    );
  }

  // Permission denied
  if (!hasAccess) {
    if (fallback !== null) {
      return <>{fallback}</>;
    }

    const message = deniedMessage || PERMISSION_MESSAGES[permission as InventoryPermission] || 'You do not have permission to access this resource.';

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
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Access Restricted</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">
          {message}
        </p>
      </motion.div>
    );
  }

  return <>{children}</>;
}

// ============================================
// ROLE GUARD COMPONENT
// ============================================

export function InventoryRoleGuard({
  roles,
  children,
  fallback = null,
  showLockIcon = true,
  deniedMessage,
  className = '',
}: InventoryRoleGuardProps) {
  const { user, isAuthenticated } = useAuth();
  
  // Determine if user has the required role
  const hasAccess = React.useMemo(() => {
    if (!isAuthenticated || !user) return false;
    return hasRole(user, roles);
  }, [user, isAuthenticated, roles]);

  if (!hasAccess) {
    if (fallback !== null) {
      return <>{fallback}</>;
    }

    const roleList = Array.isArray(roles) ? roles : [roles];
    const roleLabels = roleList.map(role => ROLE_DISPLAY_NAMES[role] || role).join(', ');
    const message = deniedMessage || `This resource requires one of the following roles: ${roleLabels}`;

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
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Role Required</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">
          {message}
        </p>
      </motion.div>
    );
  }

  return <>{children}</>;
}

// ============================================
// PERMISSION CHECK COMPONENT (Render Props)
// ============================================

export function InventoryPermissionCheck({
  permission,
  children,
  checkOnMount = true,
}: InventoryPermissionCheckProps) {
  const { user, isAuthenticated } = useAuth();
  const { hasPermission, isLoading } = usePermission();
  const [hasAccess, setHasAccess] = React.useState(false);
  const [checked, setChecked] = React.useState(false);

  React.useEffect(() => {
    if (checkOnMount) {
      const parsed = parsePermission(permission);
      const permString = typeof permission === 'string' ? permission : `${parsed.resource}:${parsed.action}`;
      const result = hasPermission(permString);
      setHasAccess(result);
      setChecked(true);
    }
  }, [permission, hasPermission, checkOnMount]);

  // If not checked yet, show loading
  if (checkOnMount && !checked) {
    return children(false, true);
  }

  return children(hasAccess, false);
}

// ============================================
// COMPOSED GUARD COMPONENTS
// ============================================

export function InventoryCreateGuard(props: Omit<InventoryPermissionGuardProps, 'permission'>) {
  return <InventoryPermissionGuard permission="INVENTORY:create" {...props} />;
}

export function InventoryEditGuard(props: Omit<InventoryPermissionGuardProps, 'permission'>) {
  return <InventoryPermissionGuard permission="INVENTORY:edit" {...props} />;
}

export function InventoryDeleteGuard(props: Omit<InventoryPermissionGuardProps, 'permission'>) {
  return <InventoryPermissionGuard permission="INVENTORY:delete" {...props} />;
}

export function InventoryViewGuard(props: Omit<InventoryPermissionGuardProps, 'permission'>) {
  return <InventoryPermissionGuard permission="INVENTORY:view" {...props} />;
}

export function InventoryManageGuard(props: Omit<InventoryPermissionGuardProps, 'permission'>) {
  return <InventoryPermissionGuard permission="INVENTORY:manage" {...props} />;
}

export function InventoryAdjustGuard(props: Omit<InventoryPermissionGuardProps, 'permission'>) {
  return <InventoryPermissionGuard permission="INVENTORY:adjust" {...props} />;
}

export function InventoryTransferGuard(props: Omit<InventoryPermissionGuardProps, 'permission'>) {
  return <InventoryPermissionGuard permission="INVENTORY:transfer" {...props} />;
}

export function InventoryExportGuard(props: Omit<InventoryPermissionGuardProps, 'permission'>) {
  return <InventoryPermissionGuard permission="INVENTORY:export" {...props} />;
}

// ============================================
// HOOKS
// ============================================

/**
 * Hook to check if the user has a specific inventory permission
 */
export function useInventoryPermission(permission: InventoryPermission | PermissionConfig): {
  hasPermission: boolean;
  isLoading: boolean;
  isSuperAdmin: boolean;
} {
  const { user, isAuthenticated } = useAuth();
  const { hasPermission: hasPerm, isLoading } = usePermission();

  const hasPermission = React.useMemo(() => {
    if (!isAuthenticated || !user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    
    const parsed = parsePermission(permission);
    const permString = typeof permission === 'string' ? permission : `${parsed.resource}:${parsed.action}`;
    return hasPerm(permString);
  }, [user, isAuthenticated, permission, hasPerm]);

  return {
    hasPermission,
    isLoading,
    isSuperAdmin: user?.role === 'SUPER_ADMIN',
  };
}

/**
 * Hook to check if the user has any of the specified inventory permissions
 */
export function useAnyInventoryPermission(permissions: (InventoryPermission | PermissionConfig)[]): {
  hasAny: boolean;
  isLoading: boolean;
  isSuperAdmin: boolean;
} {
  const { user, isAuthenticated } = useAuth();
  const { hasPermission: hasPerm, isLoading } = usePermission();

  const hasAny = React.useMemo(() => {
    if (!isAuthenticated || !user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    
    return permissions.some(perm => {
      const parsed = parsePermission(perm);
      const permString = typeof perm === 'string' ? perm : `${parsed.resource}:${parsed.action}`;
      return hasPerm(permString);
    });
  }, [user, isAuthenticated, permissions, hasPerm]);

  return {
    hasAny,
    isLoading,
    isSuperAdmin: user?.role === 'SUPER_ADMIN',
  };
}

/**
 * Hook to check if the user has all of the specified inventory permissions
 */
export function useAllInventoryPermissions(permissions: (InventoryPermission | PermissionConfig)[]): {
  hasAll: boolean;
  isLoading: boolean;
  isSuperAdmin: boolean;
} {
  const { user, isAuthenticated } = useAuth();
  const { hasPermission: hasPerm, isLoading } = usePermission();

  const hasAll = React.useMemo(() => {
    if (!isAuthenticated || !user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    
    return permissions.every(perm => {
      const parsed = parsePermission(perm);
      const permString = typeof perm === 'string' ? perm : `${parsed.resource}:${parsed.action}`;
      return hasPerm(permString);
    });
  }, [user, isAuthenticated, permissions, hasPerm]);

  return {
    hasAll,
    isLoading,
    isSuperAdmin: user?.role === 'SUPER_ADMIN',
  };
}

// ============================================
// EXPORT
// ============================================

export default InventoryPermissionGuard;
