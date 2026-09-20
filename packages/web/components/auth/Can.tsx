// packages/web/components/auth/Can.tsx

'use client';

import React from 'react';
import { usePermission } from '../../hooks/usePermission';

interface CanProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function Can({ permission, children, fallback = null }: CanProps) {
  const { hasPermission } = usePermission();
  return hasPermission(permission) ? <>{children}</> : <>{fallback}</>;
}

interface CanAnyProps {
  permissions: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function CanAny({ permissions, children, fallback = null }: CanAnyProps) {
  const { hasAnyPermission } = usePermission();
  return hasAnyPermission(permissions) ? <>{children}</> : <>{fallback}</>;
}
