// packages/web/middleware.ts
import { authMiddleware } from '@clerk/nextjs';

export default authMiddleware({
  publicRoutes: [
    // Marketing / static
    '/',
    '/features',
    '/pricing',
    '/demo',
    '/contact',
    '/help',
    '/docs',
    '/privacy',
    '/terms',

    // Auth
    '/login',
    '/sign-up',
    '/forgot-password',
    '/verify',
    '/reset-password',

    // Storefront (public browsing)
    '/cart',
    '/checkout',
    '/product(.*)',
    '/products(.*)',
    '/category(.*)',
    '/categories(.*)',
    '/order-confirmation(.*)',

    // Public API surface only
    '/api/webhooks(.*)',
    '/api/public(.*)',

    // ✅ REMOVED: '/api/products(.*)' — this endpoint requires auth
    // ✅ REMOVED: '/api/categories(.*)' — this endpoint requires auth

    // Next.js internals
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
    // Match everything except Next.js internals and static files
    '/((?!.+\\.[\\w]+$|_next).*)',
    // Match API routes
    '/(api|trpc)(.*)',
  ],
};
