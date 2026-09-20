'use client';

import React from 'react';
import { Upload } from 'lucide-react';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import LocationPageHeader from '../../../../../components/locations/LocationPageHeader';
import LocationEmptyState from '../../../../../components/locations/LocationEmptyState';
import LocationImportWizard from '../../../../../components/locations/LocationImportWizard';

export default function LocationImportPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { isLoading: permLoading, hasPermission } = usePermission();

  const booting = authLoading || permLoading;

  if (booting) return <LocationEmptyState variant="loading" />;
  if (!isAuthenticated || !user) return <LocationEmptyState variant="login" />;

  const canImport =
    hasPermission(`${PermissionResource.INVENTORY}:create`) ||
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'ADMIN';

  if (!canImport) return <LocationEmptyState variant="denied" />;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <LocationPageHeader
        title="Import Locations"
        description="Bulk-create locations from a CSV file. Download the template to get started."
        icon={Upload}
      />
      <LocationImportWizard />
    </div>
  );
}
