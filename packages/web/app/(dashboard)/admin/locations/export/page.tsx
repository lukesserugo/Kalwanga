'use client';

import React from 'react';
import { Download } from 'lucide-react';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import LocationPageHeader from '../../../../../components/locations/LocationPageHeader';
import LocationEmptyState from '../../../../../components/locations/LocationEmptyState';
import LocationExportPanel from '../../../../../components/locations/LocationExportPanel';

export default function LocationExportPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { isLoading: permLoading, hasPermission } = usePermission();

  const booting = authLoading || permLoading;

  if (booting) return <LocationEmptyState variant="loading" />;
  if (!isAuthenticated || !user) return <LocationEmptyState variant="login" />;

  const canExport =
    hasPermission(`${PermissionResource.INVENTORY}:export`) ||
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'ADMIN';

  if (!canExport) return <LocationEmptyState variant="denied" />;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <LocationPageHeader
        title="Export Locations"
        description="Download your location list in CSV, Excel, JSON, or PDF format."
        icon={Download}
      />
      <LocationExportPanel />
    </div>
  );
}
