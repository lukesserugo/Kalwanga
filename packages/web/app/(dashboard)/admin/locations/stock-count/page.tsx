'use client';

import React from 'react';
import { ClipboardList } from 'lucide-react';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import LocationPageHeader from '../../../../../components/locations/LocationPageHeader';
import LocationEmptyState from '../../../../../components/locations/LocationEmptyState';
import StockCountSheet from '../../../../../components/locations/StockCountSheet';

export default function StockCountPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { isLoading: permLoading, hasPermission } = usePermission();

  const booting = authLoading || permLoading;

  if (booting) return <LocationEmptyState variant="loading" />;
  if (!isAuthenticated || !user) return <LocationEmptyState variant="login" />;

  const canCount =
    hasPermission(`${PermissionResource.INVENTORY}:edit`) ||
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'ADMIN' ||
    user?.role === 'MANAGER';

  if (!canCount) return <LocationEmptyState variant="denied" />;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <LocationPageHeader
        title="Stock Count"
        description="Reconcile physical inventory against the system count for a location."
        icon={ClipboardList}
      />
      <StockCountSheet />
    </div>
  );
}
