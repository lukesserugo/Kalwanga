// D:\Projects\Kalwanga\packages\web\app\(auth)\sign-up\page.tsx
'use client';

import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function SignUpPage() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect_url') || '/dashboard';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-accent-50 dark:from-gray-900 dark:to-gray-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-block focus-ring rounded">
            <h1 className="text-4xl font-bold text-brand-600 dark:text-brand-400">
              POS System
            </h1>
          </Link>
          <h2 className="mt-6 text-2xl font-semibold text-gray-900 dark:text-white">
            Create Your Account
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Start managing your business today
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-soft border border-gray-200 dark:border-gray-700 p-6">
          <SignUp
            routing="path"
            path="/sign-up"
            signInUrl="/login"
            afterSignUpUrl="/dashboard"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-none",
                formButtonPrimary: "bg-brand-500 hover:bg-brand-600 text-white shadow-brand",
                footerActionLink: "text-brand-600 hover:text-brand-800",
              }
            }}
          />
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors duration-250 focus-ring rounded"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
