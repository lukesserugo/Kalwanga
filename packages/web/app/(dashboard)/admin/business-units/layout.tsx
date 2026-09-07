// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\business-units\layout.tsx

'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Building,
  Users,
  Home,
  ChevronRight,
} from 'lucide-react';

export default function BusinessUnitsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isFormPage = pathname?.includes('/new') || pathname?.includes('/edit');
  const isUsersPage = pathname?.includes('/users');

  const getBreadcrumb = () => {
    if (pathname?.includes('/new')) return 'Create Business Unit';
    if (pathname?.includes('/edit')) return 'Edit Business Unit';
    if (pathname?.includes('/users')) return 'Users';
    if (pathname?.match(/\/business-units\/[^/]+$/)) return 'Business Unit Details';
    return 'Business Units';
  };

  const getBreadcrumbIcon = () => {
    if (pathname?.includes('/users')) return <Users className="w-4 h-4" />;
    return <Building className="w-4 h-4" />;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Breadcrumb */}
      <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto flex items-center gap-2 text-sm">
          <Link 
            href="/admin" 
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors flex items-center gap-1"
          >
            <Home className="w-4 h-4" />
            Dashboard
          </Link>
          <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600" />
          
          <Link 
            href="/admin/business-units" 
            className={`${
              pathname === '/admin/business-units' 
                ? 'text-gray-900 dark:text-white font-medium' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            } transition-colors flex items-center gap-1`}
          >
            <Building className="w-4 h-4" />
            Business Units
          </Link>
          
          {pathname && !pathname.match(/^\/admin\/business-units\/?$/) && (
            <>
              <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600" />
              <span className="text-gray-900 dark:text-white font-medium flex items-center gap-1">
                {getBreadcrumbIcon()}
                {getBreadcrumb()}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Page Content */}
      <div className="bg-gray-50 dark:bg-gray-900">
        {children}
      </div>
    </div>
  );
}
