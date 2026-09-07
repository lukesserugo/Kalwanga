// D:\Projects\Kalwanga\packages\web\components\providers\ClerkTokenProvider.tsx
'use client';

import { useEffect } from 'react';
import { useAuth as useClerkAuth } from '@clerk/nextjs';
import { api } from '../../services/api';

export function ClerkTokenProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useClerkAuth();

  useEffect(() => {
    // Set up the Clerk token getter
    api.setClerkTokenGetter(async () => {
      try {
        const token = await getToken();
        console.log('🔑 Got Clerk token:', token ? 'YES' : 'NO');
        return token;
      } catch (error) {
        console.error('Failed to get Clerk token:', error);
        return null;
      }
    });
  }, [getToken]);

  return <>{children}</>;
}
