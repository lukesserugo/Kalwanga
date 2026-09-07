'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Loader2, Lock } from 'lucide-react';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';

// Dynamically import the POS component to reduce initial bundle size
const POSComponent = dynamic(
  () => import('../../../../../components/sales/POS/POS').then(mod => mod.POS),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading POS...</p>
        </div>
      </div>
    )
  }
);

export default function POSPage() {
  const { isLoaded, isSignedIn, user: clerkUser } = useUser();
  const { user } = useAuth();
  const { canManage, canView, canCreate, canEdit } = usePermission();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.push('/login?redirect=/admin/sales/pos');
      return;
    }

    // Check if user has POS access via multiple methods
    const role = user?.role || clerkUser?.publicMetadata?.role || '';
    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER'];
    
    // Check permission-based access
    const hasSaleManagePermission = canManage?.(`${PermissionResource.SALE}:manage`) || false;
    const hasSaleViewPermission = canView?.(`${PermissionResource.SALE}:view`) || false;
    const hasPermissionAccess = hasSaleManagePermission || hasSaleViewPermission;
    
    // Check role-based access
    const hasRoleAccess = allowedRoles.includes(role);
    
    // Check if user has any POS access
    const hasAccess = hasRoleAccess || hasPermissionAccess || role === 'SUPER_ADMIN';
    
    if (hasAccess) {
      setAuthorized(true);
    } else {
      router.push('/unauthorized');
    }
    
    setChecking(false);
  }, [isLoaded, isSignedIn, user, clerkUser, router, canManage, canView]);

  // Loading state
  if (!isLoaded || checking) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // Unauthorized state (fallback - should redirect)
  if (!authorized) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md p-8">
          <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Denied</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            You don't have permission to access the POS system.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <POSComponent />;
}
