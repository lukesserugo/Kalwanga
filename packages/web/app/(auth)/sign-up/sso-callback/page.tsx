// D:\Projects\Kalwanga\packages\web\app\(auth)\sign-up\sso-callback\page.tsx
'use client';

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export default function SSOCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect_url') || '/dashboard';

  // Handle any errors from the OAuth flow
  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      console.error('SSO Error:', error);
      router.push(`/sign-up?error=${error}`);
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-accent-50 dark:from-gray-900 dark:to-gray-950">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-soft border border-gray-200 dark:border-gray-700 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 dark:border-brand-400 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Completing sign up...
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Please wait while we redirect you.
          </p>
        </div>
        <AuthenticateWithRedirectCallback
          afterSignInUrl={redirectUrl}
          afterSignUpUrl={redirectUrl}
        />
      </div>
    </div>
  );
}
