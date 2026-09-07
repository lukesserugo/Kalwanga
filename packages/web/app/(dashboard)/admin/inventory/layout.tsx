'use client';

import React from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import { Lock } from 'lucide-react';
import { InventoryNavigation } from '../../../../components/inventory/InventoryNavigation';

export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, canViewInventory } = useAuth();

  // If user doesn't have permission, show access denied
  if (!canViewInventory) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to access inventory management.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto p-4">
        {/* Navigation */}
        <InventoryNavigation />
        
        {/* Page content */}
        <div className="mt-4">
          {children}
        </div>
      </div>
    </div>
  );
}
