'use client';

import { usePathname } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { HomeIcon, ShoppingCartIcon } from '@heroicons/react/24/outline';

export default function HomePageWrapper() {
  const pathname = usePathname();
  const { user } = useUser();

  // Check if we're on the home page
  const isHome = pathname === '/';

  return (
    <>
      {/* Home Page Quick Access */}
      {isHome && user && (
        <div className="fixed bottom-4 right-4 z-40">
          <Link
            href="/dashboard"
            className="bg-blue-600 text-white px-4 py-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            Go to Dashboard
          </Link>
        </div>
      )}

      {/* Home Page Tab Label */}
      {isHome && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-40 bg-white/90 backdrop-blur-sm px-6 py-2 rounded-full shadow-sm border border-gray-200 text-sm text-gray-600 flex items-center gap-2">
          <HomeIcon className="w-4 h-4 text-blue-600" />
          <span>You're browsing the store</span>
          {user && (
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
          )}
        </div>
      )}
    </>
  );
}
