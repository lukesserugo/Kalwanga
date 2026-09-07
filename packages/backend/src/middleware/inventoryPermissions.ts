// D:\Projects\Kalwanga\packages\backend\src\middleware\inventoryPermissions.ts

import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';
// Fix: Import UserRole from the correct path
import { UserRole } from '../generated/prisma/index.js';

export type InventoryPermission = 
  | 'inventory:view'
  | 'inventory:create'
  | 'inventory:edit'
  | 'inventory:delete'
  | 'inventory:export'
  | 'inventory:import'
  | 'inventory:adjust'
  | 'inventory:transfer'
  | 'inventory:issue'
  | 'inventory:restock'
  | 'inventory:manage_categories'
  | 'inventory:manage_suppliers'
  | 'inventory:view_reports'
  | 'inventory:view_audit'
  | 'inventory:manage_settings'
  | 'inventory:view_low_stock'
  | 'inventory:approve_transfers';

// Role to permission mapping (fallback when no custom permissions)
const INVENTORY_ROLE_PERMISSIONS: Record<UserRole, InventoryPermission[]> = {
  [UserRole.SUPER_ADMIN]: [
    'inventory:view',
    'inventory:create',
    'inventory:edit',
    'inventory:delete',
    'inventory:export',
    'inventory:import',
    'inventory:adjust',
    'inventory:transfer',
    'inventory:issue',
    'inventory:restock',
    'inventory:manage_categories',
    'inventory:manage_suppliers',
    'inventory:view_reports',
    'inventory:view_audit',
    'inventory:manage_settings',
    'inventory:view_low_stock',
    'inventory:approve_transfers',
  ],
  [UserRole.ADMIN]: [
    'inventory:view',
    'inventory:create',
    'inventory:edit',
    'inventory:export',
    'inventory:import',
    'inventory:adjust',
    'inventory:transfer',
    'inventory:issue',
    'inventory:restock',
    'inventory:manage_categories',
    'inventory:manage_suppliers',
    'inventory:view_reports',
    'inventory:view_audit',
    'inventory:view_low_stock',
  ],
  [UserRole.MANAGER]: [
    'inventory:view',
    'inventory:create',
    'inventory:edit',
    'inventory:adjust',
    'inventory:transfer',
    'inventory:issue',
    'inventory:restock',
    'inventory:view_reports',
    'inventory:view_low_stock',
    'inventory:view_audit',
  ],
  [UserRole.EDITOR]: [
    'inventory:view',
    'inventory:create',
    'inventory:edit',
    'inventory:adjust',
    'inventory:restock',
    'inventory:view_low_stock',
  ],
  [UserRole.VIEWER]: [
    'inventory:view',
    'inventory:view_low_stock',
  ],
  [UserRole.EMPLOYEE]: [
    'inventory:view',
    'inventory:view_low_stock',
  ],
  [UserRole.CASHIER]: [
    'inventory:view',
    'inventory:view_low_stock',
  ],
  [UserRole.USER]: [
    'inventory:view',
  ],
};

/**
 * Middleware to check if user has a specific inventory permission
 * Checks both custom permissions (from user.permissions) and role-based permissions
 */
export function requireInventoryPermission(permission: InventoryPermission) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      
      if (!user) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`⚠️ No user found, but allowing ${permission} in development mode`);
          return next();
        }
        throw new AppError('User not authenticated', 401);
      }
      
      const userRole = user.role as UserRole;
      
      // SUPER_ADMIN has all permissions
      if (userRole === UserRole.SUPER_ADMIN) {
        return next();
      }
      
      // Check custom permissions first (from user.permissions field)
      const customPermissions = user.permissions || [];
      if (customPermissions.includes(permission)) {
        return next();
      }
      
      // Check for wildcard permissions
      if (customPermissions.includes('inventory:*') || customPermissions.includes('inventory:manage')) {
        return next();
      }
      
      // Fallback to role-based permissions
      const rolePermissions = INVENTORY_ROLE_PERMISSIONS[userRole] || [];
      if (rolePermissions.includes(permission)) {
        return next();
      }
      
      console.warn(`⚠️ User ${user.email || user.id} (${userRole}) denied permission: ${permission}`);
      throw new AppError(`Insufficient permissions: ${permission} required`, 403);
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to check if user has any of the specified inventory permissions
 */
export function requireAnyInventoryPermission(permissions: InventoryPermission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      
      if (!user) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`⚠️ No user found, but allowing any permission in development mode`);
          return next();
        }
        throw new AppError('User not authenticated', 401);
      }
      
      const userRole = user.role as UserRole;
      
      // SUPER_ADMIN has all permissions
      if (userRole === UserRole.SUPER_ADMIN) {
        return next();
      }
      
      const customPermissions = user.permissions || [];
      const rolePermissions = INVENTORY_ROLE_PERMISSIONS[userRole] || [];
      
      // Check if user has any of the required permissions
      const hasPermission = permissions.some((p: InventoryPermission) => 
        customPermissions.includes(p) ||
        customPermissions.includes('inventory:*') ||
        customPermissions.includes('inventory:manage') ||
        rolePermissions.includes(p)
      );
      
      if (!hasPermission) {
        throw new AppError(`Insufficient permissions. Required one of: ${permissions.join(', ')}`, 403);
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to check if user has all of the specified inventory permissions
 */
export function requireAllInventoryPermissions(permissions: InventoryPermission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      
      if (!user) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`⚠️ No user found, but allowing all permissions in development mode`);
          return next();
        }
        throw new AppError('User not authenticated', 401);
      }
      
      const userRole = user.role as UserRole;
      
      // SUPER_ADMIN has all permissions
      if (userRole === UserRole.SUPER_ADMIN) {
        return next();
      }
      
      const customPermissions = user.permissions || [];
      const rolePermissions = INVENTORY_ROLE_PERMISSIONS[userRole] || [];
      
      // Check if user has all required permissions
      const hasAllPermissions = permissions.every((p: InventoryPermission) => 
        customPermissions.includes(p) ||
        customPermissions.includes('inventory:*') ||
        customPermissions.includes('inventory:manage') ||
        rolePermissions.includes(p)
      );
      
      if (!hasAllPermissions) {
        throw new AppError(`Insufficient permissions. Required all of: ${permissions.join(', ')}`, 403);
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Helper function to get all permissions for a role
 */
export function getInventoryPermissionsForRole(role: UserRole): InventoryPermission[] {
  return INVENTORY_ROLE_PERMISSIONS[role] || [];
}

/**
 * Helper function to check if a role has a specific permission
 */
export function roleHasInventoryPermission(role: UserRole, permission: InventoryPermission): boolean {
  if (role === UserRole.SUPER_ADMIN) return true;
  const permissions = INVENTORY_ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

/**
 * Helper function to check if user has inventory permission (for use in services)
 */
export function userHasInventoryPermission(
  user: any, 
  permission: InventoryPermission
): boolean {
  if (!user) return false;
  
  const userRole = user.role as UserRole;
  
  if (userRole === UserRole.SUPER_ADMIN) return true;
  
  const customPermissions = user.permissions || [];
  if (customPermissions.includes(permission)) return true;
  if (customPermissions.includes('inventory:*') || customPermissions.includes('inventory:manage')) return true;
  
  const rolePermissions = INVENTORY_ROLE_PERMISSIONS[userRole] || [];
  return rolePermissions.includes(permission);
}

/**
 * Helper function to get all permissions for a user (custom + role-based)
 */
export function getAllUserPermissions(user: any): string[] {
  if (!user) return [];
  
  const userRole = user.role as UserRole;
  
  if (userRole === UserRole.SUPER_ADMIN) {
    // Return all possible permissions for SUPER_ADMIN
    const allPermissions: string[] = [];
    Object.values(INVENTORY_ROLE_PERMISSIONS).forEach((perms: InventoryPermission[]) => {
      perms.forEach((p: InventoryPermission) => {
        if (!allPermissions.includes(p)) {
          allPermissions.push(p);
        }
      });
    });
    return allPermissions;
  }
  
  const customPermissions = user.permissions || [];
  const rolePermissions = INVENTORY_ROLE_PERMISSIONS[userRole] || [];
  
  return [...new Set([...customPermissions, ...rolePermissions])];
}

// ============================================
// SHORTHAND MIDDLEWARE FUNCTIONS
// ============================================

/**
 * Require inventory view permission
 */
export const requireInventoryView = requireInventoryPermission('inventory:view');

/**
 * Require inventory create permission
 */
export const requireInventoryCreate = requireInventoryPermission('inventory:create');

/**
 * Require inventory edit permission
 */
export const requireInventoryEdit = requireInventoryPermission('inventory:edit');

/**
 * Require inventory delete permission
 */
export const requireInventoryDelete = requireInventoryPermission('inventory:delete');

/**
 * Require inventory export permission
 */
export const requireInventoryExport = requireInventoryPermission('inventory:export');

/**
 * Require inventory import permission
 */
export const requireInventoryImport = requireInventoryPermission('inventory:import');

/**
 * Require inventory adjust permission
 */
export const requireInventoryAdjust = requireInventoryPermission('inventory:adjust');

/**
 * Require inventory transfer permission
 */
export const requireInventoryTransfer = requireInventoryPermission('inventory:transfer');

/**
 * Require inventory issue permission
 */
export const requireInventoryIssue = requireInventoryPermission('inventory:issue');

/**
 * Require inventory restock permission
 */
export const requireInventoryRestock = requireInventoryPermission('inventory:restock');

/**
 * Require inventory manage categories permission
 */
export const requireInventoryManageCategories = requireInventoryPermission('inventory:manage_categories');

/**
 * Require inventory manage suppliers permission
 */
export const requireInventoryManageSuppliers = requireInventoryPermission('inventory:manage_suppliers');

/**
 * Require inventory view reports permission
 */
export const requireInventoryViewReports = requireInventoryPermission('inventory:view_reports');

/**
 * Require inventory view audit permission
 */
export const requireInventoryViewAudit = requireInventoryPermission('inventory:view_audit');

/**
 * Require inventory manage settings permission
 */
export const requireInventoryManageSettings = requireInventoryPermission('inventory:manage_settings');

/**
 * Require inventory view low stock permission
 */
export const requireInventoryViewLowStock = requireInventoryPermission('inventory:view_low_stock');

/**
 * Require inventory approve transfers permission
 */
export const requireInventoryApproveTransfers = requireInventoryPermission('inventory:approve_transfers');

// ============================================
// EXPORT DEFAULT
// ============================================

export default {
  requireInventoryPermission,
  requireAnyInventoryPermission,
  requireAllInventoryPermissions,
  getInventoryPermissionsForRole,
  roleHasInventoryPermission,
  userHasInventoryPermission,
  getAllUserPermissions,
  requireInventoryView,
  requireInventoryCreate,
  requireInventoryEdit,
  requireInventoryDelete,
  requireInventoryExport,
  requireInventoryImport,
  requireInventoryAdjust,
  requireInventoryTransfer,
  requireInventoryIssue,
  requireInventoryRestock,
  requireInventoryManageCategories,
  requireInventoryManageSuppliers,
  requireInventoryViewReports,
  requireInventoryViewAudit,
  requireInventoryManageSettings,
  requireInventoryViewLowStock,
  requireInventoryApproveTransfers,
};
