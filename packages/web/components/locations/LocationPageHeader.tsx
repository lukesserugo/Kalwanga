'use client';

// packages/web/components/locations/LocationPageHeader.tsx

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface LocationPageHeaderProps {
  title: string;
  description?: string;
  icon: React.ElementType;
  /** Where the back arrow goes. Defaults to /admin/locations. */
  backHref?: string;
  /** Right-aligned action buttons. */
  actions?: React.ReactNode;
}

export function LocationPageHeader({
  title,
  description,
  icon: Icon,
  backHref = '/admin/locations',
  actions,
}: LocationPageHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => router.push(backHref)}
          className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Icon className="w-6 h-6 text-blue-500 flex-shrink-0" />
            <span className="truncate">{title}</span>
          </h1>
          {description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

export default LocationPageHeader;
