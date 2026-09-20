'use client';

// packages/web/components/locations/LocationEmptyState.tsx

import React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, Shield } from 'lucide-react';

interface LocationEmptyStateProps {
  variant: 'login' | 'denied' | 'loading' | 'empty';
  title?: string;
  description?: string;
  icon?: React.ElementType;
  action?: React.ReactNode;
}

export function LocationEmptyState({
  variant,
  title,
  description,
  icon: Icon,
  action,
}: LocationEmptyStateProps) {
  const router = useRouter();

  if (variant === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
        <Loader2 className="w-10 h-10 animate-spin text-brand-600 dark:text-brand-400" />
      </div>
    );
  }

  const isLogin = variant === 'login';
  const isDenied = variant === 'denied';
  const FallbackIcon = isLogin ? Lock : isDenied ? Shield : undefined;
  const FinalIcon = Icon ?? FallbackIcon;

  const defaultTitle = isLogin
    ? 'Please Login'
    : isDenied
    ? 'Access Denied'
    : 'Nothing here yet';

  const defaultDesc = isLogin
    ? 'You need to be logged in to view this page.'
    : isDenied
    ? "You don't have permission to view this page."
    : 'When there is data to show, it will appear here.';

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 animate-fade-in">
      <div className="text-center max-w-md">
        {FinalIcon && (
          <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <FinalIcon className="w-10 h-10 text-gray-400 dark:text-gray-500" />
          </div>
        )}
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
          {title ?? defaultTitle}
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          {description ?? defaultDesc}
        </p>
        {isLogin && !action && (
          <button
            onClick={() => router.push('/login')}
            className="mt-4 btn-brand"
          >
            Go to Login
          </button>
        )}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}

export default LocationEmptyState;
