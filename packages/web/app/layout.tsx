// D:\Projects\Kalwanga\packages\web\app\layout.tsx

import type { Metadata } from 'next';
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
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  themeColor: '#2563eb',
  icons: {
    icon: '/favicon.ico',
  },
};

// ✅ Payment provider wrapper component
function PaymentProviders({ children }: { children: React.ReactNode }) {
  return (
    <PaymentProvider>
      <CheckoutProvider>
        {children}
      </CheckoutProvider>
    </PaymentProvider>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  // If Clerk is not configured, still show the app with a warning
  if (!clerkPublishableKey) {
    return (
      <html lang="en" suppressHydrationWarning>
        <body className={inter.className}>
          <ThemeProvider>
            <AuthProvider>
              <PaymentProviders>
                <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
                  <div className="max-w-7xl mx-auto px-4 py-8">
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 mb-4 rounded-r-lg">
                      <p className="text-yellow-700 dark:text-yellow-400">
                        ⚠️ Clerk authentication is not configured. Please add{' '}
                        <code className="mx-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-800 rounded">
                          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
                        </code>
                        to your .env.local file.
                      </p>
                    </div>
                    {children}
                  </div>
                </div>
                <ToastContainer />
              </PaymentProviders>
            </AuthProvider>
          </ThemeProvider>
        </body>
      </html>
    );
  }

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
                  {/* Main content wrapper with flex column for proper layout */}
                  <div className="flex flex-col min-h-screen">
                    {children}
                  </div>
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
