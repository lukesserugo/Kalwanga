// D:\Projects\Kalwanga\packages\web\components\onboarding\OnboardingGateGuard.tsx

'use client';

import React, { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useOnboarding } from '../../hooks/useOnboarding';

// ============================================================
// ALLOWLIST
// Routes that must remain reachable regardless of onboarding state.
// Everything here bypasses the guard so the user can always:
//   - Sign out
//   - Reach the help center
//   - Change their own account settings
//   - Complete the actual onboarding step
//   - Reach the /onboarding/* helpers (redirectors, step pages)
// ============================================================
const ALLOWED_PATH_PREFIXES = [
  '/sign-in',
  '/sign-up',
  '/help',
  '/privacy',
  '/terms',
  '/support',
  '/settings',           // personal account settings, not company
  '/profile',
  '/onboarding',         // step redirector pages
  '/logout',
  '/auth',
];

function isAllowedPath(pathname: string): boolean {
  if (!pathname) return false;
  return ALLOWED_PATH_PREFIXES.some((prefix) =>
    pathname === prefix || pathname.startsWith(prefix + '/')
  );
}

export default function OnboardingGateGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status, isRouteBlocked } = useOnboarding();
  const pathname = usePathname();
  const router = useRouter();

  // Track the last redirect target so we never redirect to the same
  // URL twice in a row — even if the component re-renders.
  const lastRedirectRef = useRef<string | null>(null);

  // Track whether we've already navigated away from this pathname.
  // Reset the guard when pathname changes.
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!status || !status.nextStep || !pathname) return;

    // Reset the redirect guard whenever the path changes
    if (lastPathRef.current !== pathname) {
      lastPathRef.current = pathname;
      lastRedirectRef.current = null;
    }

    // ── 1. Always allow the current step route and its children ──
    if (pathname.startsWith(status.nextStep.route)) {
      return;
    }

    // ── 2. Always allow explicitly allowlisted paths ──
    if (isAllowedPath(pathname)) {
      return;
    }

    // ── 3. If the current path is not actually blocked, do nothing ──
    if (!isRouteBlocked(pathname)) {
      return;
    }

    // ── 4. Compute the redirect target ──
    const target = status.nextStep.route;

    // ── 5. Never redirect to a route that is itself blocked ──
    // This prevents the redirect loop when the reserved-route guard
    // nulls out nextStep and the guard re-runs with the same target.
    if (isRouteBlocked(target)) {
      console.warn(
        '[OnboardingGateGuard] Target route is itself blocked, skipping redirect:',
        target
      );
      return;
    }

    // ── 6. Only redirect once per unique target ──
    if (lastRedirectRef.current === target) {
      return;
    }
    lastRedirectRef.current = target;

    router.replace(target);
  }, [status, pathname, isRouteBlocked, router]);

  return <>{children}</>;
}

