// packages/web/components/onboarding/OnboardingGuide.tsx

'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  XMarkIcon,
  PlayCircleIcon,
  SpeakerWaveIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  SparklesIcon,
  InformationCircleIcon,
  LockClosedIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';

import { useOnboarding } from '../../hooks/useOnboarding';
import { OnboardingChecklist } from './OnboardingChecklist';
import type { NextStep } from '../../services/onboardingService';

// ============================================
// CONSTANTS
// ============================================

const MINIMIZED_KEY = 'onboarding:minimized';
const NARRATION_SEEN_KEY = 'onboarding:narration-seen';
const CELEBRATED_KEY = 'onboarding:celebrated-steps';

const CELEBRATION_MS = 4500;
const NARRATION_DELAY_MS = 500;

// ============================================
// RESPONSIVE HOOK
// ============================================
//
// Returns `null` until the first `compute()` runs so the guide
// doesn't paint with a stale layout and then jump. On a phone, the
// initial `'desktop'` layout would briefly render as a 440px
// bottom-right card before flipping to a full-width bottom sheet —
// a visible pop. Returning `null` on first paint avoids that.

type Layout = 'mobile' | 'tablet' | 'desktop';

function useLayout(): Layout | null {
  const [layout, setLayout] = useState<Layout | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const compute = () => {
      const w = window.innerWidth;
      if (w < 640) setLayout('mobile');
      else if (w < 1024) setLayout('tablet');
      else setLayout('desktop');
    };

    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  return layout;
}

// ============================================
// STORAGE HELPERS
// ============================================
//
// ⚠ `Array.from(set)` rather than `[...set]`.
//
//    Spreading a `Set` (`[...set]`) requires either `--target`
//    ≥ ES2015 or `--downlevelIteration`. Without one of those,
//    TypeScript emits TS2802 ("Type 'Set<number>' can only be
//    iterated through when using the '--downlevelIteration' flag
//    or with a '--target' of 'es2015' or higher") because it would
//    have to compile the spread into a manual iterator walk.
//
//    `Array.from` performs the same conversion but is typed as an
//    ordinary library call, so it compiles against any target.

function readNumberSet(key: string): Set<number> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((v): v is number => Number.isInteger(v)),
    );
  } catch {
    return new Set();
  }
}

function writeNumberSet(key: string, set: Set<number>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    /* quota exceeded or storage disabled — safe to ignore */
  }
}

// ============================================
// COMPONENT
// ============================================

export default function OnboardingGuide() {
  const { status, loading, skipStep, paginate } = useOnboarding();
  const router = useRouter();
  const searchParams = useSearchParams();
  const layout = useLayout();

  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [busyStep, setBusyStep] = useState<number | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [redirectNotice, setRedirectNotice] = useState<number | null>(null);
  const [justAdvancedFrom, setJustAdvancedFrom] = useState<number | null>(null);
  const [viewIndex, setViewIndex] = useState(0);

  const narratedRef = useRef<Set<number>>(new Set());
  const celebratedRef = useRef<Set<number>>(new Set());
  const lastActiveKeyRef = useRef<string>('');
  const lastBackendIndexRef = useRef<number>(-999);
  const lastSpokenStepIdRef = useRef<number | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const redirectHandledRef = useRef(false);

  // ── Restore preferences ────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (localStorage.getItem(MINIMIZED_KEY) === 'true') setExpanded(false);

    narratedRef.current = readNumberSet(NARRATION_SEEN_KEY);
    celebratedRef.current = readNumberSet(CELEBRATED_KEY);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(MINIMIZED_KEY, String(!expanded));
    } catch {
      /* ignore */
    }
  }, [expanded]);

  // ── Steps (memoized so effects have stable deps) ───────

  const steps: NextStep[] = useMemo(
    () => status?.activeSteps ?? [],
    [status?.activeSteps],
  );

  const activeKey = useMemo(
    () => steps.map((s) => s.id).join(','),
    [steps],
  );

  // ── Snap to backend's currentIndex on step-list change ─

  useEffect(() => {
    if (!status) return;

    const previousKey = lastActiveKeyRef.current;
    const keyChanged = activeKey !== previousKey;

    if (keyChanged) {
      lastActiveKeyRef.current = activeKey;

      // Celebrate the most recent completion — the first step that
      // dropped out of the list since the last snapshot.
      if (previousKey) {
        const prevIds = previousKey
          .split(',')
          .filter(Boolean)
          .map(Number);
        const currIds = new Set(steps.map((s) => s.id));
        const droppedIds = prevIds.filter((id) => !currIds.has(id));

        for (const id of droppedIds) {
          if (celebratedRef.current.has(id)) continue;

          celebratedRef.current.add(id);
          writeNumberSet(CELEBRATED_KEY, celebratedRef.current);

          setJustAdvancedFrom(id);
          if (bannerTimerRef.current) {
            clearTimeout(bannerTimerRef.current);
          }
          bannerTimerRef.current = setTimeout(() => {
            setJustAdvancedFrom(null);
            bannerTimerRef.current = null;
          }, CELEBRATION_MS);
          break;
        }
      }

      lastBackendIndexRef.current = status.currentIndex;
      setViewIndex(status.currentIndex >= 0 ? status.currentIndex : 0);
      return;
    }

    if (status.currentIndex !== lastBackendIndexRef.current) {
      lastBackendIndexRef.current = status.currentIndex;
      setViewIndex(status.currentIndex >= 0 ? status.currentIndex : 0);
    }
  }, [activeKey, status, steps]);

  // Cleanup banner timer on unmount.
  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);

  // ── Redirect notice from ?redirectedFrom=<stepId> ──────

  useEffect(() => {
    if (redirectHandledRef.current) return;

    const raw = searchParams.get('redirectedFrom');
    if (!raw) {
      redirectHandledRef.current = true;
      return;
    }

    const n = Number(raw);
    redirectHandledRef.current = true;

    if (Number.isInteger(n)) setRedirectNotice(n);

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('redirectedFrom');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  // ── Current step ───────────────────────────────────────

  const safeIndex =
    steps.length > 0
      ? Math.max(0, Math.min(viewIndex, steps.length - 1))
      : 0;

  const step: NextStep | null =
    steps[safeIndex] ?? status?.nextStep ?? null;

  // ── TTS ─────────────────────────────────────────────────

  const speak = useCallback((text: string, stepId: number) => {
    if (
      typeof window === 'undefined' ||
      !('speechSynthesis' in window) ||
      !text
    ) {
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.98;
      utter.pitch = 1.0;
      utter.onstart = () => setSpeaking(true);
      utter.onend = () => setSpeaking(false);
      utter.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utter);
    } catch {
      setSpeaking(false);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
    setSpeaking(false);
  }, []);

  // ── Auto-narrate the visible step once per browser ────

  useEffect(() => {
    if (!step) return;
    if (lastSpokenStepIdRef.current === step.id) return;

    lastSpokenStepIdRef.current = step.id;

    if (narratedRef.current.has(step.id)) return;

    const narration = step.narration || step.reason;
    if (!narration) return;

    const timer = setTimeout(() => {
      narratedRef.current.add(step.id);
      writeNumberSet(NARRATION_SEEN_KEY, narratedRef.current);
      speak(narration, step.id);
    }, NARRATION_DELAY_MS);

    return () => clearTimeout(timer);
  }, [step, speak]);

  // ── Pagination handlers ────────────────────────────────

  const goPrev = useCallback(() => {
    if (safeIndex <= 0) return;
    const next = safeIndex - 1;
    const target = steps[next];
    if (!target) return;

    setViewIndex(next);
    void paginate?.(target.id).catch(() => undefined);
  }, [safeIndex, steps, paginate]);

  const goNext = useCallback(() => {
    if (safeIndex >= steps.length - 1) return;
    const next = safeIndex + 1;
    const target = steps[next];
    if (!target) return;

    setViewIndex(next);
    void paginate?.(target.id).catch(() => undefined);
  }, [safeIndex, steps, paginate]);

  const jumpTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= steps.length) return;
      if (index === safeIndex) return;

      const target = steps[index];
      if (!target) return;

      setViewIndex(index);
      void paginate?.(target.id).catch(() => undefined);
    },
    [safeIndex, steps, paginate],
  );

  // ── Gating ─────────────────────────────────────────────

  if (layout === null) return null;

  if (loading || !status || dismissed) return null;

  // ── Complete state ─────────────────────────────────────

  if (status.isComplete) {
    return (
      <AnimatePresence>
        <motion.div
          role="region"
          aria-label="Onboarding complete"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          className={[
            'fixed z-fab bg-white dark:bg-gray-900 rounded-2xl shadow-card',
            'border border-success-200 dark:border-success-800 overflow-hidden',
            layout === 'mobile'
              ? 'inset-x-3 bottom-3'
              : 'bottom-6 right-6 w-[400px] max-w-[calc(100vw-2rem)]',
          ].join(' ')}
        >
          <div className="bg-gradient-to-r from-success-500 to-emerald-600 p-5 text-white">
            <div className="flex items-center gap-3">
              <SparklesIcon
                className="w-8 h-8 flex-shrink-0"
                aria-hidden="true"
              />
              <div>
                <h2 className="text-lg font-bold">You&apos;re all set!</h2>
                <p className="text-sm text-success-50">
                  Onboarding is complete. Every gate is met.
                </p>
              </div>
            </div>
          </div>
          <div className="p-4 flex gap-2">
            <button
              type="button"
              onClick={() => router.push('/admin')}
              className="flex-1 btn-brand"
            >
              Go to Dashboard
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="btn-secondary"
            >
              Close
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Minimized pill ─────────────────────────────────────

  if (!expanded) {
    const current = step?.displayPosition ?? status.completedCount + 1;
    const total = step?.displayTotal ?? status.totalCount;

    return (
      <motion.button
        type="button"
        aria-label="Open onboarding guide"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={() => setExpanded(true)}
        className={[
          'fixed z-fab flex items-center gap-2 px-4 py-2.5',
          'bg-brand-gradient text-white',
          'rounded-full shadow-brand-lg hover:shadow-brand-lg transition duration-250 focus-ring',
          layout === 'mobile' ? 'bottom-3 right-3' : 'bottom-6 right-6',
        ].join(' ')}
        title="Open onboarding guide"
      >
        <PlayCircleIcon className="w-5 h-5" aria-hidden="true" />
        <span className="text-sm font-medium tabular-nums">
          {current}/{total}
        </span>
        <ChevronUpIcon className="w-3.5 h-3.5 opacity-80" aria-hidden="true" />
      </motion.button>
    );
  }

  // ── No step to show ────────────────────────────────────

  if (!step) return null;

  const stepState = status.steps[step.id];
  const isOptional = step.optional;
  const isFirstPage = safeIndex <= 0;
  const isLastPage = safeIndex >= steps.length - 1;
  const shownPosition = step.displayPosition;
  const shownTotal = step.displayTotal;
  const canJumpBack =
    status.currentIndex >= 0 && safeIndex !== status.currentIndex;
  const isBusy = busyStep !== null;

  const cardClasses = [
    'fixed z-fab bg-white dark:bg-gray-900 shadow-card',
    'border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col',
    layout === 'mobile'
      ? 'inset-x-3 bottom-3 rounded-2xl max-h-[75vh]'
      : layout === 'tablet'
      ? 'bottom-6 right-6 w-[400px] max-w-[calc(100vw-2rem)] rounded-2xl max-h-[80vh]'
      : 'bottom-6 right-6 w-[440px] max-w-[calc(100vw-2rem)] rounded-2xl max-h-[80vh]',
  ].join(' ');

  return (
    <AnimatePresence>
      <motion.div
        key="onboarding-guide"
        role="region"
        aria-label="Onboarding guide"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.25 }}
        className={cardClasses}
      >
        {/* Header */}
        <div className="bg-brand-gradient flex-shrink-0">
          <div className="p-4 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <PlayCircleIcon
                  className="w-7 h-7 text-white flex-shrink-0"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-2xs text-white/80 uppercase tracking-wider font-semibold eyebrow">
                    Step <span className="tabular-nums">{shownPosition}</span>{' '}
                    of <span className="tabular-nums">{shownTotal}</span>
                    {isOptional && (
                      <span className="ml-2 text-white/70 normal-case tracking-normal">
                        · optional
                      </span>
                    )}
                  </p>
                  <h2 className="text-base font-bold text-white leading-tight truncate">
                    {step.name}
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="p-1.5 hover:bg-white/10 rounded-full transition duration-250 focus-ring"
                  title="Minimize — reopen anytime"
                  aria-label="Minimize guide"
                >
                  <ChevronDownIcon className="w-4 h-4 text-white" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setDismissed(true)}
                  className="p-1.5 hover:bg-white/10 rounded-full transition duration-250 focus-ring"
                  title="Dismiss for this session"
                  aria-label="Dismiss guide"
                >
                  <XMarkIcon className="w-4 h-4 text-white" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="mt-3 h-1 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${status.progress}%` }}
              />
            </div>
            <p className="text-2xs text-white/80 mt-1.5 tabular-nums">
              {status.completedCount} of {status.totalCount} gates met ·{' '}
              {status.progress}% complete
            </p>
          </div>

          {/* Pagination strip */}
          {steps.length > 1 && (
            <div className="px-3 pb-3 pt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={goPrev}
                disabled={isFirstPage}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed text-white transition duration-250 focus-ring"
                aria-label="Previous step"
                title="Previous step"
              >
                <ArrowLeftIcon className="w-4 h-4" aria-hidden="true" />
              </button>

              <div className="flex-1 flex items-center justify-center gap-1.5 overflow-hidden">
                {steps.map((s, i) => {
                  const isCurrent = i === safeIndex;
                  const isDone = s.state.completed || s.state.skipped;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => jumpTo(i)}
                      className={[
                        'rounded-full transition-all duration-250 flex-shrink-0 focus-ring',
                        isCurrent
                          ? 'w-6 h-2 bg-white'
                          : isDone
                          ? 'w-2 h-2 bg-success-300 hover:bg-success-200'
                          : 'w-2 h-2 bg-white/40 hover:bg-white/70',
                      ].join(' ')}
                      title={`${s.displayPosition}. ${s.name}${
                        s.optional ? ' (optional)' : ''
                      }`}
                      aria-label={`Go to step ${s.displayPosition}: ${s.name}`}
                      aria-current={isCurrent ? 'step' : undefined}
                    />
                  );
                })}
              </div>

              <button
                type="button"
                onClick={goNext}
                disabled={isLastPage}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed text-white transition duration-250 focus-ring"
                aria-label="Next step"
                title="Next step"
              >
                <ArrowRightIcon className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          <AnimatePresence>
            {justAdvancedFrom !== null && (
              <motion.div
                key={`celebrate-${justAdvancedFrom}`}
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-start gap-2 rounded-lg bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 p-3 text-xs text-success-800 dark:text-success-300">
                  <CheckCircleIcon
                    className="w-4 h-4 flex-shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-semibold">Step complete!</p>
                    <p className="mt-0.5 text-success-700 dark:text-success-400">
                      We advanced you to the next step automatically.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {redirectNotice !== null && (
            <div className="flex items-start gap-2 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 p-3 text-xs text-primary-800 dark:text-primary-300">
              <InformationCircleIcon
                className="w-4 h-4 flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <p>
                Step <span className="tabular-nums">{redirectNotice}</span>{' '}
                is already done. We brought you to your current step instead.
              </p>
            </div>
          )}

          {canJumpBack &&
            !isOptional &&
            !stepState?.completed && (
              <div className="flex items-start gap-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-3 text-xs text-gray-700 dark:text-gray-300">
                <LockClosedIcon
                  className="w-4 h-4 flex-shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div className="flex-1">
                  <p>You&apos;re previewing a different step.</p>
                  <button
                    type="button"
                    onClick={() => jumpTo(status.currentIndex)}
                    className="mt-1 text-brand-600 dark:text-brand-400 hover:underline font-medium transition duration-250 focus-ring rounded"
                  >
                    Jump back to your current step →
                  </button>
                </div>
              </div>
            )}

          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {step.reason}
          </p>

          {step.blocks.length > 0 && (
            <div className="bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg p-3 flex items-start gap-2">
              <span
                className="text-warning-600 font-bold leading-none mt-0.5"
                aria-hidden="true"
              >
                ⛔
              </span>
              <div className="text-xs text-warning-800 dark:text-warning-300">
                <p className="font-semibold mb-1">
                  Locked until this is done:
                </p>
                <ul className="list-disc list-inside space-y-0.5">
                  {step.blocks.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => speak(step.narration || step.reason, step.id)}
              className={`flex items-center gap-1.5 text-xs transition duration-250 focus-ring rounded ${
                speaking
                  ? 'text-brand-700 dark:text-brand-300 font-semibold'
                  : 'text-brand-600 dark:text-brand-400 hover:underline'
              }`}
            >
              <SpeakerWaveIcon
                className={`w-4 h-4 ${speaking ? 'animate-pulse' : ''}`}
                aria-hidden="true"
              />
              {speaking ? 'Speaking…' : 'Listen again'}
            </button>

            <button
              type="button"
              onClick={() => setShowChecklist((s) => !s)}
              className="text-xs text-brand-600 dark:text-brand-400 hover:underline transition duration-250 focus-ring rounded"
            >
              {showChecklist ? 'Hide all steps' : 'Show all steps'}
            </button>
          </div>

          <AnimatePresence initial={false}>
            {showChecklist && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-t border-gray-200 dark:border-gray-700 pt-2 -mx-4"
              >
                <OnboardingChecklist
                  status={status}
                  currentStepId={step.id}
                  onNavigate={() => setShowChecklist(false)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sticky footer */}
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-4 flex gap-2 bg-white dark:bg-gray-900">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => {
              stopSpeaking();
              router.push(step.route);
            }}
            className="flex-1 btn-brand disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Go to {step.name}
            <ArrowRightIcon className="w-4 h-4" aria-hidden="true" />
          </button>

          {isOptional && !stepState?.skipped && (
            <button
              type="button"
              disabled={busyStep === step.id}
              onClick={async () => {
                try {
                  setBusyStep(step.id);
                  stopSpeaking();
                  await skipStep(step.id, 'Skipped from guide');
                } catch (err) {
                  console.error('Failed to skip onboarding step:', err);
                } finally {
                  setBusyStep(null);
                }
              }}
              className="btn-secondary disabled:opacity-50"
            >
              {busyStep === step.id ? 'Skipping…' : 'Skip'}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              stopSpeaking();
              setDismissed(true);
            }}
            className="btn-secondary"
            title="Hide until next session"
          >
            Later
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
