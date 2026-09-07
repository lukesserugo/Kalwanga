// D:\Projects\Kalwanga\packages\web\components\inventory\InventoryPermissionGuard.tsx
'use client';

import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { InventoryPermission, INVENTORY_ROLE_PERMISSIONS } from '../../types/inventoryPermissions';

interface InventoryPermissionGuardProps {
  permission: InventoryPermission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function InventoryPermissionGuard({ 
  permission, 
  children, 
  fallback = null 
}: InventoryPermissionGuardProps) {
  const { user, can } = useAuth();

  if (!user) {
    return fallback;
  }

  // Check if user has the specific permission
  // SUPER_ADMIN has all permissions, handled by the can function
  const hasPermission = can(permission);

  if (!hasPermission) {
    return fallback;
  }

  return <>{children}</>;
}

interface InventoryRoleGuardProps {
  roles: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function InventoryRoleGuard({ 
  roles, 
  children, 
  fallback = null 
}: InventoryRoleGuardProps) {
  const { user } = useAuth();

  if (!user) {
    return fallback;
  }

  const hasRole = roles.some(role => user.role === role);

  if (!hasRole) {
    return fallback;
  }

  return <>{children}</>;
}
