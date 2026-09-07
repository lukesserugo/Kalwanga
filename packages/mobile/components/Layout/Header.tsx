'use client';

import { useUser } from '@clerk/nextjs';

export default function Header() {
  const { user } = useUser();

  return (
    <header className="bg-white shadow-sm border-b sticky top-0 z-30">
      <div className="flex items-center justify-between px-8 py-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {user?.firstName ? `Welcome back, ${user.firstName}!` : 'Dashboard'}
          </h1>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-500">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </span>
        </div>
      </div>
    </header>
  );
}
