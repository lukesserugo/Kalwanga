// D:\Projects\Kalwanga\packages\web\app\layout.tsx

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { AuthProvider } from '../hooks/useAuth';
import { ThemeProvider } from '../components/providers/ThemeProvider';
import { ClerkTokenProvider } from '../components/providers/ClerkTokenProvider';
import { ToastContainer } from '../utils/toast-manager';
import { PaymentProvider } from '../contexts/PaymentContext';
import { CheckoutProvider } from '../contexts/CheckoutContext';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'POS System - Point of Sale',
  description: 'Advanced Point of Sale System for modern businesses',
  keywords: 'POS, Point of Sale, Retail, Inventory, Sales',
  icons: {
    icon: '/favicon.ico',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  // Matches the app's warm orange/red primary.
  themeColor: '#F97316',
};

// ============================================
// PAYMENT / CHECKOUT PROVIDER STACK
// ============================================
//
// Nested once at the root so every page (public shop, cart, checkout,
// admin) can read payment methods and checkout state without wiring
// the providers individually.

function PaymentProviders({ children }: { children: React.ReactNode }) {
  return (
    <PaymentProvider>
      <CheckoutProvider>{children}</CheckoutProvider>
    </PaymentProvider>
  );
}

// ============================================
// ROOT LAYOUT
// ============================================
//
// The root layout only provides the HTML shell and the global
// providers. Page chrome — headers, footers, sidebars — is owned by
// each route group:
//
//   (public)/layout.tsx     → RootHeader + RootFooter
//   (dashboard)/layout.tsx  → admin Header + Sidebar
//
// This lets the public and admin areas have completely different
// layouts without any conditional logic in the root.

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  // ------------------------------------------------
  // Fallback: Clerk not configured
  // ------------------------------------------------
  //
  // The app must still render so a developer can see the UI without a
  // Clerk account. We render a small inline warning banner and drop the
  // Clerk-dependent providers. The banner sits above {children} so it
  // appears on every page when Clerk is missing.

  if (!clerkPublishableKey) {
    return (
      <html lang="en" suppressHydrationWarning>
        <body className={inter.className}>
          <ThemeProvider>
            <AuthProvider>
              <PaymentProviders>
                <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
                  {/* Clerk-not-configured warning banner */}
                  <div className="w-full">
                    <div className="max-w-7xl mx-auto px-4 py-4">
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 rounded-r-lg">
                        <p className="text-yellow-700 dark:text-yellow-400 text-sm">
                          ⚠️ Clerk authentication is not configured. Please
                          add{' '}
                          <code className="mx-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-800 rounded text-xs">
                            NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
                          </code>
                          to your <code>.env.local</code> file to enable
                          sign-in and admin features.
                        </p>
                      </div>
                    </div>
                  </div>

                  {children}
                </div>
                <ToastContainer />
              </PaymentProviders>
            </AuthProvider>
          </ThemeProvider>
        </body>
      </html>
    );
  }

  // ------------------------------------------------
  // Configured: ClerkProvider on top of the tree
  // ------------------------------------------------

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      signInUrl="/login"
      signUpUrl="/sign-up"
      afterSignInUrl="/dashboard"
      afterSignUpUrl="/dashboard"
    >
      <html lang="en" suppressHydrationWarning>
        <body className={inter.className}>
          <ThemeProvider>
            <AuthProvider>
              <ClerkTokenProvider>
                <PaymentProviders>
                  {children}
                  <ToastContainer />
                </PaymentProviders>
              </ClerkTokenProvider>
            </AuthProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
