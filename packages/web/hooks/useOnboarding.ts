// packages/web/hooks/useOnboarding.ts

'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  createElement,
} from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';
import {
  onboardingService,
  OnboardingStatus,
} from '../services/onboardingService';

// ============================================================
// CONTEXT TYPE
// ============================================================

interface OnboardingContextValue {
  // Read state
  status: OnboardingStatus | null;
  loading: boolean;

  // Refresh
  refresh: () => Promise<void>;

  // Gate helpers
  isGateMet: (gate: keyof OnboardingStatus) => boolean;
  isRouteBlocked: (route: string) => boolean;

  // Mutators
  markComplete: (stepId: number, notes?: string) => Promise<void>;
  skipStep: (stepId: number, notes?: string) => Promise<void>;
  resetProgress: (userId?: string) => Promise<void>;

  /**
   * Notify the server that the user navigated to a step in the
   * guide. Returns the refreshed status. Stateless on the server —
   * the client owns the cursor.
   */
  paginate: (stepId: number) => Promise<OnboardingStatus>;

  // Guide visibility
  isGuideOpen: boolean;
  openGuide: () => void;
  closeGuide: () => void;
}

const DEFAULT_CONTEXT: OnboardingContextValue = {
  status: null,
  loading: true,
  refresh: async () => undefined,
  isGateMet: () => true,
  isRouteBlocked: () => false,
  markComplete: async () => undefined,
  skipStep: async () => undefined,
  resetProgress: async () => undefined,
  paginate: async () => {
    throw new Error('OnboardingProvider not mounted');
  },
  isGuideOpen: false,
  openGuide: () => undefined,
  closeGuide: () => undefined,
};

const OnboardingContext = createContext<OnboardingContextValue>(
  DEFAULT_CONTEXT
);

// ============================================================
// PERSISTENCE KEYS + EVENTS
// ============================================================

const GUIDE_OPEN_KEY = 'onboarding:guide-open';
const GUIDE_EVENT = 'onboarding:open';

/**
 * Event dispatched by the API client after any successful
 * mutation (POST/PUT/PATCH/DELETE). The provider listens for
 * this and refetches the onboarding status after a short
 * debounce. This is how the guide learns in real time that a
 * step was just completed on its target page.
 */
const MUTATED_EVENT = 'onboarding:mutated';

/**
 * How long to wait after the last mutation before refetching.
 * A form might fire 2-3 mutations in quick succession (e.g.
 * create a company, then create its settings). We wait for the
 * burst to settle, then refetch once.
 */
const MUTATION_DEBOUNCE_MS = 600;

// ============================================================
// PROVIDER
// ============================================================

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();

  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(true);

  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const lastPathnameRef = useRef<string | null>(null);
  const mutationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Guide visibility persistence ────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (localStorage.getItem(GUIDE_OPEN_KEY) === 'false') {
        setIsGuideOpen(false);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(GUIDE_OPEN_KEY, String(isGuideOpen));
    } catch {
      /* ignore */
    }
  }, [isGuideOpen]);

  const openGuide = useCallback(() => setIsGuideOpen(true), []);
  const closeGuide = useCallback(() => setIsGuideOpen(false), []);

  // ── Keyboard shortcut: Ctrl+Shift+O ─────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === 'o'
      ) {
        e.preventDefault();
        setIsGuideOpen(true);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // ── Event bus: window.dispatchEvent(new Event('onboarding:open')) ──
  useEffect(() => {
    const handleOpen = () => setIsGuideOpen(true);
    window.addEventListener(GUIDE_EVENT, handleOpen);
    return () => window.removeEventListener(GUIDE_EVENT, handleOpen);
  }, []);

  // ── Refresh ─────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!isLoaded || !isSignedIn) {
      setLoading(false);
      return;
    }
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const data = await onboardingService.getStatus();
      setStatus(data);
    } catch (err) {
      console.error('Failed to load onboarding status:', err);
      // Only null the status on the *first* load. On background
      // refetches, keep the previous status so the guide doesn't
      // flash to nothing.
      if (!hasFetchedRef.current) setStatus(null);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [isLoaded, isSignedIn]);

  // ── Initial fetch ───────────────────────────────────────
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    void refresh();
  }, [refresh]);

  // ── Refetch on route change ─────────────────────────────
  //
  // When the user completes a step on its target page (e.g.
  // filling out the business-unit form at
  // /admin/business-units/new), the form calls router.push() to
  // navigate away. The pathname changes, this effect fires, and
  // the guide picks up the new state within a few hundred ms.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (lastPathnameRef.current === pathname) return;
    lastPathnameRef.current = pathname;
    void refresh();
  }, [pathname, isLoaded, isSignedIn, refresh]);

  // ── Refetch on window focus / visibility ────────────────
  //
  // Covers:
  //   - User returns from another browser tab
  //   - Laptop wakes from sleep
  //   - OAuth/popup flow closes and focus returns
  //   - A step was completed via a background process
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onFocus = () => {
      void refresh();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);

  // ── Refetch after any successful mutation ───────────────
  //
  // The API client dispatches `onboarding:mutated` on every 2xx
  // POST/PUT/PATCH/DELETE. We debounce so a burst of saves (e.g.
  // a form that creates a company and then settings in two
  // requests) triggers one refetch, not two.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onMutated = () => {
      if (mutationTimerRef.current) {
        clearTimeout(mutationTimerRef.current);
      }
      mutationTimerRef.current = setTimeout(() => {
        void refresh();
      }, MUTATION_DEBOUNCE_MS);
    };

    window.addEventListener(MUTATED_EVENT, onMutated);
    return () => {
      window.removeEventListener(MUTATED_EVENT, onMutated);
      if (mutationTimerRef.current) {
        clearTimeout(mutationTimerRef.current);
      }
    };
  }, [refresh]);

  // ── Mutators ────────────────────────────────────────────
  const markComplete = useCallback(
    async (stepId: number, notes?: string) => {
      try {
        const result = await onboardingService.markComplete(stepId, notes);
        if (result?.status) setStatus(result.status);
      } catch (err) {
        console.error('Failed to mark step complete:', err);
        throw err;
      }
    },
    []
  );

  const skipStep = useCallback(async (stepId: number, notes?: string) => {
    try {
      const result = await onboardingService.skip(stepId, notes);
      if (result?.status) setStatus(result.status);
    } catch (err) {
      console.error('Failed to skip step:', err);
      throw err;
    }
  }, []);

  const resetProgress = useCallback(async (userId?: string) => {
    try {
      const updated = await onboardingService.reset(userId);
      setStatus(updated);
      setIsGuideOpen(true);
    } catch (err) {
      console.error('Failed to reset onboarding:', err);
      throw err;
    }
  }, []);

  /**
   * Notify the server that the guide moved to a step. Returns the
   * refreshed status and also updates local state so consumers
   * (e.g. the checklist) stay in sync.
   */
  const paginate = useCallback(async (stepId: number) => {
    const updated = await onboardingService.paginate(stepId);
    setStatus(updated);
    return updated;
  }, []);

  // ── Gate helpers ────────────────────────────────────────
  const isGateMet = useCallback(
    (gate: keyof OnboardingStatus): boolean => {
      if (!status) return true;
      const value = status[gate];
      return typeof value === 'boolean' ? value : true;
    },
    [status]
  );

  const isRouteBlocked = useCallback(
    (route: string): boolean => {
      if (!status || !status.nextStep) return false;
      return status.nextStep.blocksRoutes.some((base) =>
        route.startsWith(base)
      );
    },
    [status]
  );

  // ── Memoized context value ──────────────────────────────
  const value = useMemo<OnboardingContextValue>(
    () => ({
      status,
      loading,
      refresh,
      isGateMet,
      isRouteBlocked,
      markComplete,
      skipStep,
      resetProgress,
      paginate,
      isGuideOpen,
      openGuide,
      closeGuide,
    }),
    [
      status,
      loading,
      refresh,
      isGateMet,
      isRouteBlocked,
      markComplete,
      skipStep,
      resetProgress,
      paginate,
      isGuideOpen,
      openGuide,
      closeGuide,
    ]
  );

  return createElement(OnboardingContext.Provider, { value }, children);
}

// ============================================================
// HOOK
// ============================================================

export function useOnboarding(): OnboardingContextValue {
  return useContext(OnboardingContext);
}

export default useOnboarding;
