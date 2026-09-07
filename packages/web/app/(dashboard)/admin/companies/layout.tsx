// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\companies\layout.tsx

'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Building, Home, ChevronRight, Users, Briefcase, Settings } from 'lucide-react';

export default function CompaniesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isFormPage = pathname?.includes('/new') || pathname?.includes('/edit');
  const isSettingsPage = pathname?.includes('/settings');

  const getBreadcrumb = () => {
    if (pathname?.includes('/new')) return 'Create Company';
    if (pathname?.includes('/edit')) return 'Edit Company';
    if (pathname?.includes('/settings')) return 'Settings';
    if (pathname?.match(/\/companies\/[^/]+$/)) return 'Company Details';
    return 'Companies';
  };

  const getBreadcrumbIcon = () => {
    if (pathname?.includes('/settings')) return <Settings className="w-4 h-4" />;
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
            href="/admin/companies" 
            className={`${
              pathname === '/admin/companies' 
                ? 'text-gray-900 dark:text-white font-medium' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            } transition-colors flex items-center gap-1`}
          >
            <Building className="w-4 h-4" />
            Companies
          </Link>
          
          {pathname && !pathname.match(/^\/admin\/companies\/?$/) && (
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
