// packages/web/middleware.ts
import { authMiddleware } from '@clerk/nextjs';

export default authMiddleware({
  publicRoutes: [
    '/',
    '/features',
    '/pricing',
    '/demo',
    '/contact',
    '/help',
    '/docs',
    '/privacy',
    '/terms',
    '/login',
    '/sign-up',
    '/forgot-password',
    '/verify',
    '/reset-password',
    '/cart',
    '/checkout',
    '/product(.*)',
    '/products(.*)',
    '/category(.*)',
    '/categories(.*)',
    '/order-confirmation(.*)',
    '/api/webhooks(.*)',
    '/api/public(.*)',
    '/api/products(.*)',
    '/api/categories(.*)',
    '/_next(.*)',
    '/favicon.ico',
    '/.well-known(.*)',
  ],
  ignoredRoutes: [
    '/api/webhooks(.*)',
    '/_next(.*)',
    '/favicon.ico',
    '/.well-known(.*)',
  ],
});

export const config = {
  matcher: [
    '/((?!.+\\.[\\w]+$|_next).*)',
    '/',
    '/(api|trpc)(.*)',
  ],
};
