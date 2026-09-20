'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useUser, useClerk } from '@clerk/nextjs';
import { usePathname, useRouter } from 'next/navigation';
import {
  HomeIcon,
  ShoppingCartIcon,
  Bars3Icon,
  XMarkIcon,
  UserIcon,
  ArrowRightOnRectangleIcon,
  UserPlusIcon,
  QuestionMarkCircleIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  StarIcon,
  CurrencyDollarIcon,
  RocketLaunchIcon,
} from '@heroicons/react/24/outline';

export default function PublicNavigation() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    return pathname === path || pathname?.startsWith(path + '/');
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const publicLinks = [
    { name: 'Home', href: '/', icon: HomeIcon },
    { name: 'Features', href: '/features', icon: StarIcon },
    { name: 'Pricing', href: '/pricing', icon: CurrencyDollarIcon },
    { name: 'Demo', href: '/demo', icon: RocketLaunchIcon },
    { name: 'Help', href: '/help', icon: QuestionMarkCircleIcon },
    { name: 'Privacy', href: '/privacy', icon: ShieldCheckIcon },
    { name: 'Terms', href: '/terms', icon: DocumentTextIcon },
  ];

  return (
    <nav className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm shadow-soft fixed w-full z-header">
      <div className="max-w-container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center flex-shrink-0 focus-ring rounded">
            <span className="text-2xl font-bold text-brand-600 dark:text-brand-400">POS</span>
            <span className="ml-2 text-gray-700 dark:text-gray-300 font-medium hidden sm:block">
              System
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {publicLinks.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`text-sm font-medium transition-colors duration-250 flex items-center gap-1 focus-ring rounded ${
                  isActive(item.href)
                    ? 'text-brand-600 dark:text-brand-400'
                    : 'text-gray-700 dark:text-gray-300 hover:text-brand-600 dark:hover:text-brand-400'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-3">
            {/* Cart Icon */}
            <Link
              href="/cart"
              className="text-gray-700 dark:text-gray-300 hover:text-brand-600 dark:hover:text-brand-400 p-2 rounded-full hover:bg-brand-50 dark:hover:bg-brand-950/40 transition-colors duration-250 relative focus-ring"
            >
              <ShoppingCartIcon className="w-6 h-6" />
              <span className="absolute -top-1 -right-1 bg-brand-500 text-white text-2xs rounded-full min-w-5 h-5 px-1 flex items-center justify-center tabular-nums">
                0
              </span>
            </Link>

            {user ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-gray-700 dark:text-gray-300 hover:text-brand-600 dark:hover:text-brand-400 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-250 focus-ring"
                >
                  Dashboard
                </Link>
                <button
                  onClick={handleSignOut}
                  className="text-gray-700 dark:text-gray-300 hover:text-danger-600 dark:hover:text-danger-400 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-250 flex items-center gap-1 focus-ring"
                >
                  <ArrowRightOnRectangleIcon className="w-4 h-4" />
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-gray-700 dark:text-gray-300 hover:text-brand-600 dark:hover:text-brand-400 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-250 flex items-center gap-1 focus-ring"
                >
                  <UserIcon className="w-4 h-4" />
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="btn-brand shadow-brand focus-ring px-4 py-2 flex items-center gap-1 text-sm font-medium"
                >
                  <UserPlusIcon className="w-4 h-4" />
                  Get Started
                </Link>
              </>
            )}

            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-250 focus-ring"
            >
              {isMobileMenuOpen ? (
                <XMarkIcon className="w-6 h-6" />
              ) : (
                <Bars3Icon className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200 dark:border-gray-700">
            <div className="space-y-1">
              {publicLinks.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-colors duration-250 focus-ring ${
                    isActive(item.href)
                      ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-brand-50 dark:hover:bg-gray-800 hover:text-brand-600 dark:hover:text-brand-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <item.icon className="w-5 h-5" />
                    {item.name}
                  </div>
                </Link>
              ))}

              {/* Mobile Auth Links */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                {user ? (
                  <>
                    <Link
                      href="/dashboard"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-brand-50 dark:hover:bg-gray-800 hover:text-brand-600 dark:hover:text-brand-400 transition-colors duration-250 focus-ring"
                    >
                      Dashboard
                    </Link>
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        handleSignOut();
                      }}
                      className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-950/30 transition-colors duration-250 focus-ring"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-brand-50 dark:hover:bg-gray-800 hover:text-brand-600 dark:hover:text-brand-400 transition-colors duration-250 focus-ring"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/sign-up"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="btn-brand shadow-brand focus-ring block px-3 py-2 text-base font-medium"
                    >
                      Get Started
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
