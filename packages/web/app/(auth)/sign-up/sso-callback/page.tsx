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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="max-w-md w-full bg-white rounded-xl shadow-soft p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900">Completing sign up...</h2>
          <p className="text-sm text-gray-600 mt-2">Please wait while we redirect you.</p>
        </div>
        <AuthenticateWithRedirectCallback 
          afterSignInUrl={redirectUrl}
          afterSignUpUrl={redirectUrl}
        />
      </div>
    </div>
  );
}
