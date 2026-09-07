// packages/shared/src/config/clerk.ts
export const CLERK_CONFIG = {
  // Web
  web: {
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '',
    signInUrl: '/login',
    signUpUrl: '/sign-up',
    afterSignInUrl: '/dashboard',
    afterSignUpUrl: '/dashboard',
  },
  // Mobile
  mobile: {
    publishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || '',
  },
  // Backend
  backend: {
    secretKey: process.env.CLERK_SECRET_KEY || '',
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY || '',
  },
};
