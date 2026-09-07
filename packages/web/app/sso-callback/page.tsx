// D:\Projects\Kalwanga\packages\web\app\sso-callback\page.tsx
'use client';

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SSOCallbackPage() {
  const router = useRouter();

  // The AuthenticateWithRedirectCallback component handles the OAuth flow
  // and redirects to the URLs specified in afterSignInUrl/afterSignUpUrl
  
  // You can optionally handle the redirect manually using useEffect
  // to detect when the callback is complete
  useEffect(() => {
    // This effect will run when the component mounts
    // The AuthenticateWithRedirectCallback will handle the OAuth flow
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="max-w-md w-full bg-white rounded-xl shadow-soft p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900">Completing sign in...</h2>
          <p className="text-sm text-gray-600 mt-2">Please wait while we redirect you.</p>
        </div>
        <AuthenticateWithRedirectCallback 
          afterSignInUrl="/dashboard"
          afterSignUpUrl="/dashboard"
        />
      </div>
    </div>
  );
}
