// D:\Projects\Kalwanga\packages\web\components\common\PermissionGuard.tsx
'use client';

import React, { ReactNode } from 'react';
import { usePermissions } from '../../hooks/usePermission';

interface PermissionGuardProps {
  children: ReactNode;
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  fallback?: ReactNode;
  role?: string | string[];
}

export function PermissionGuard({
  children,
  permission,
  permissions = [],
  requireAll = false,
  fallback = null,
  role,
}: PermissionGuardProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, user } = usePermissions();

  // Get user role
  const userRole = user?.role || 'USER';

  // Check role-based access
  const hasRole = (): boolean => {
    if (!role) return true;
    if (Array.isArray(role)) {
      return role.includes(userRole);
    }
    return userRole === role;
  };

  // Check permission-based access
  const hasPermissionAccess = (): boolean => {
    if (permission) {
      return hasPermission(permission);
    }
    if (permissions.length > 0) {
      return requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions);
    }
    return true;
  };

  const hasAccess = hasRole() && hasPermissionAccess();

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Higher-order component for page-level protection
export function withPermission<P extends object>(
  Component: React.ComponentType<P>,
  permission?: string,
  permissions?: string[],
  requireAll?: boolean
) {
  return function ProtectedComponent(props: P) {
    return (
      <PermissionGuard
        permission={permission}
        permissions={permissions}
        requireAll={requireAll}
      >
        <Component {...props} />
      </PermissionGuard>
    );
  };
}

// Higher-order component for role-based protection
export function withRole<P extends object>(
  Component: React.ComponentType<P>,
  role: string | string[]
) {
  return function ProtectedComponent(props: P) {
    return (
      <PermissionGuard role={role}>
        <Component {...props} />
      </PermissionGuard>
    );
  };
}
