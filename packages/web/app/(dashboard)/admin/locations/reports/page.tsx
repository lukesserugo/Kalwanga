'use client';

import React from 'react';
import { BarChart3 } from 'lucide-react';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import LocationPageHeader from '../../../../../components/locations/LocationPageHeader';
import LocationEmptyState from '../../../../../components/locations/LocationEmptyState';
import LocationReportsPanel from '../../../../../components/locations/LocationReportsPanel';

export default function LocationReportsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { isLoading: permLoading, hasPermission } = usePermission();

  const booting = authLoading || permLoading;

  if (booting) return <LocationEmptyState variant="loading" />;
  if (!isAuthenticated || !user) return <LocationEmptyState variant="login" />;

  const canView =
    hasPermission(`${PermissionResource.INVENTORY}:view`) ||
    user?.role === 'SUPER_ADMIN';

  if (!canView) return <LocationEmptyState variant="denied" />;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <LocationPageHeader
        title="Location Reports"
        description="Inventory distribution and value across locations in this business unit."
        icon={BarChart3}
      />
      <LocationReportsPanel />
    </div>
  );
}
