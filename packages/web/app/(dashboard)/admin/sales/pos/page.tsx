// packages/web/app/(dashboard)/admin/sales/pos/page.tsx
'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2,
  Lock,
  ArrowLeft,
  LayoutDashboard,
  List,
} from 'lucide-react';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';

// Dynamically import the POS component to reduce initial bundle size.
// Do NOT change this import path — the existing POS component is untouched.
const POSComponent = dynamic(
  () =>
    import('../../../../../components/sales/POS/POS').then(
      (mod) => mod.POS
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-brand-600 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading POS...
          </p>
        </div>
      </div>
    ),
  }
);

export default function POSPage() {
  const { isLoaded, isSignedIn } = useUser();
  const { user } = useAuth();
  const { canView, canCreate, canManage } = usePermission();
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  // Same permission model as the orders and customers pages.
  // SUPER_ADMIN always passes via canManage.
  const canAccessPos =
    canView(PermissionResource.SALE) ||
    canCreate(PermissionResource.SALE) ||
    canManage(PermissionResource.SALE);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.push('/login?redirect=/admin/sales/pos');
      return;
    }

    // Give `useAuth` / `usePermission` a tick to hydrate from the JWT
    // before deciding. The other admin pages do the same implicitly.
    if (!user) return;

    if (canAccessPos) {
      setAuthorized(true);
      setChecking(false);
    } else {
      setAuthorized(false);
      setChecking(false);
    }
  }, [isLoaded, isSignedIn, user, canAccessPos, router]);

  // ─────────────────────────────────────────────────────────────
  // Loading
  // ─────────────────────────────────────────────────────────────
  if (!isLoaded || checking || !user) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-brand-600 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Checking permissions...
          </p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Unauthorized — matches the customers page "Access Restricted" card
  // ─────────────────────────────────────────────────────────────
  if (!authorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          You don't have permission to access the POS system.
        </p>
        <Link
          href="/admin/sales"
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors focus-ring"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Sales
        </Link>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Authorized
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header — same pattern as orders/create page */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-header">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/sales"
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors focus-ring rounded"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Back to Sales</span>
            </Link>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">
              Point of Sale
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/sales"
              className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-1.5 text-gray-700 dark:text-gray-300 focus-ring"
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">Sales List</span>
            </Link>
            <Link
              href="/admin/sales/dashboard"
              className="px-3 py-1.5 text-sm bg-brand-50 dark:bg-brand-900/30 hover:bg-brand-100 dark:hover:bg-brand-900/50 rounded-lg transition-colors flex items-center gap-1.5 text-brand-600 dark:text-brand-400 focus-ring"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          </div>
        </div>
      </div>

      {/* POS Component — untouched */}
      <div className="h-[calc(100vh-73px)]">
        <POSComponent />
      </div>
    </div>
  );
}
