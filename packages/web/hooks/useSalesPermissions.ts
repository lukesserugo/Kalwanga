// hooks/useSalesPermissions.ts
'use client';

import { useAuth } from './useAuth';
import { useMemo } from 'react';

type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'CASHIER';

export function useSalesPermissions() {
  const { user } = useAuth();

  const permissions = useMemo(() => {
    const role = user?.role as UserRole || 'EMPLOYEE';

    return {
      // View permissions
      canViewSales: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE', 'CASHIER'].includes(role),
      canViewAllSales: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role),
      canViewStats: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role),
      
      // Edit permissions
      canManageSales: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role),
      canRefundSales: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role),
      canEditSales: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role),
      canDeleteSales: ['SUPER_ADMIN', 'ADMIN'].includes(role),
      
      // Export permissions
      canExportSales: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role),
      
      // View specific data
      canViewCustomerDetails: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'].includes(role),
      canViewCashierInfo: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role),
      
      // Role-based filters
      getSalesFilter: () => {
        if (!user) return { userId: undefined, businessUnitId: undefined };
        
        if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
          return { userId: undefined, businessUnitId: undefined };
        }
        
        if (role === 'MANAGER' && user.businessUnits?.length) {
          return { userId: undefined, businessUnitId: user.businessUnits[0].businessUnitId };
        }
        
        return { userId: user.id, businessUnitId: undefined };
      },
      
      role,
      isAdmin: role === 'SUPER_ADMIN' || role === 'ADMIN',
      isManager: role === 'MANAGER',
      isEmployee: role === 'EMPLOYEE' || role === 'CASHIER',
    };
  }, [user]);

  return permissions;
}
