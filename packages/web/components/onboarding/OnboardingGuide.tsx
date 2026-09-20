// D:\Projects\Kalwanga\packages\web\components\onboarding\OnboardingGuide.tsx

'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
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

const MINIMIZED_KEY = 'onboarding:minimized';
const NARRATION_SEEN_KEY = 'onboarding:narration-seen';
const CELEBRATED_KEY = 'onboarding:celebrated-steps';

// ============================================
// RESPONSIVE HOOK
// ============================================

type Layout = 'mobile' | 'tablet' | 'desktop';

function useLayout(): Layout {
  const [layout, setLayout] = useState<Layout>('desktop');

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

  // ── Restore preferences ────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(MINIMIZED_KEY) === 'true') setExpanded(false);

    try {
      const raw = localStorage.getItem(NARRATION_SEEN_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as number[];
        narratedRef.current = new Set(arr);
      }
    } catch {
      /* ignore */
    }

    try {
      const raw = localStorage.getItem(CELEBRATED_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as number[];
        celebratedRef.current = new Set(arr);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(MINIMIZED_KEY, String(!expanded));
  }, [expanded]);

  // ── Steps (memoized so effects have stable deps) ───────
  const steps: NextStep[] = useMemo(
    () => status?.activeSteps ?? [],
    [status?.activeSteps]
  );

  const activeKey = useMemo(
    () => steps.map((s) => s.id).join(','),
    [steps]
  );

  // ── Snap to backend's currentIndex when the step list changes
  //
  // We key the snap on the *identity* of the active step list,
  // not just `currentIndex`. When a step auto-completes in the
  // background (e.g. the user finished a form on another page
  // and the probe fired), the list shrinks, `activeKey` changes,
  // and we jump to whatever is now current.
  //
  // We also detect *which* step just disappeared and show a
  // brief "Step X complete!" banner so the user knows why the
  // guide moved.
  useEffect(() => {
    if (!status) return;

    const previousKey = lastActiveKeyRef.current;
    const keyChanged = activeKey !== previousKey;

    if (keyChanged) {
      lastActiveKeyRef.current = activeKey;

      // Detect which step(s) dropped out so we can celebrate.
      if (previousKey) {
        const prevIds = previousKey
          .split(',')
          .filter(Boolean)
          .map(Number);
        const currIds = new Set(steps.map((s) => s.id));
        const droppedIds = prevIds.filter((id) => !currIds.has(id));

        // Celebrate only the first dropped step (the most
        // recent completion) and only once per step per session.
        for (const id of droppedIds) {
          if (celebratedRef.current.has(id)) continue;
          celebratedRef.current.add(id);
          try {
            localStorage.setItem(
              CELEBRATED_KEY,
              JSON.stringify([...celebratedRef.current])
            );
          } catch {
            /* ignore */
          }
          setJustAdvancedFrom(id);
          if (bannerTimerRef.current) {
            clearTimeout(bannerTimerRef.current);
          }
          bannerTimerRef.current = setTimeout(() => {
            setJustAdvancedFrom(null);
          }, 4500);
          break;
        }
      }

      // Snap viewIndex to the backend's current cursor.
      lastBackendIndexRef.current = status.currentIndex;
      setViewIndex(status.currentIndex >= 0 ? status.currentIndex : 0);
      return;
    }

    // List is unchanged. Only snap if the backend explicitly
    // moved the cursor (e.g. after a Skip mutation that did not
    // remove the step from the list).
    if (status.currentIndex !== lastBackendIndexRef.current) {
      lastBackendIndexRef.current = status.currentIndex;
      setViewIndex(status.currentIndex >= 0 ? status.currentIndex : 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, status?.currentIndex, status]);

  // Cleanup banner timer on unmount
  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);

  // ── Redirect notice from ?redirectedFrom=<stepId> ──────
  useEffect(() => {
    const raw = searchParams.get('redirectedFrom');
    if (!raw) return;
    const n = Number(raw);
    if (!Number.isInteger(n)) return;
    setRedirectNotice(n);
    const url = new URL(window.location.href);
    url.searchParams.delete('redirectedFrom');
    window.history.replaceState({}, '', url.toString());
  }, [searchParams]);

  // ── Current step from viewIndex ────────────────────────
  const safeIndex =
    steps.length > 0
      ? Math.max(0, Math.min(viewIndex, steps.length - 1))
      : 0;
  const step: NextStep | null =
    steps[safeIndex] ?? status?.nextStep ?? null;

  // ── TTS: speak the visible step once per session ───────
  useEffect(() => {
    if (!step) return;
    if (lastSpokenStepIdRef.current === step.id) return;
    if (narratedRef.current.has(step.id)) {
      lastSpokenStepIdRef.current = step.id;
      return;
    }
    const timer = setTimeout(() => {
      speak(step.narration || step.reason, step.id);
      lastSpokenStepIdRef.current = step.id;
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.id]);

  function speak(text: string, stepId: number) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.98;
      utter.pitch = 1.0;
      utter.onstart = () => setSpeaking(true);
      utter.onend = () => {
        setSpeaking(false);
        narratedRef.current.add(stepId);
        try {
          localStorage.setItem(
            NARRATION_SEEN_KEY,
            JSON.stringify([...narratedRef.current])
          );
        } catch {
          /* ignore */
        }
      };
      utter.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utter);
    } catch {
      /* ignore */
    }
  }

  function stopSpeaking() {
    if (typeof window === 'undefined') return;
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
    setSpeaking(false);
  }

  // ── Pagination handlers ────────────────────────────────
  const goPrev = useCallback(() => {
    if (safeIndex <= 0) return;
    const next = safeIndex - 1;
    setViewIndex(next);
    void paginate?.(steps[next]?.id ?? 0).catch(() => undefined);
  }, [safeIndex, steps, paginate]);

  const goNext = useCallback(() => {
    if (safeIndex >= steps.length - 1) return;
    const next = safeIndex + 1;
    setViewIndex(next);
    void paginate?.(steps[next]?.id ?? 0).catch(() => undefined);
  }, [safeIndex, steps.length, steps, paginate]);

  const jumpTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= steps.length) return;
      if (index === safeIndex) return;
      setViewIndex(index);
      void paginate?.(steps[index]?.id ?? 0).catch(() => undefined);
    },
    [safeIndex, steps, paginate]
  );

  // ── Loading / dismissed ────────────────────────────────
  if (loading || !status || dismissed) return null;

  // ── Complete state ─────────────────────────────────────
  if (status.isComplete) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          className={[
            'fixed z-50 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl',
            'border border-emerald-200 dark:border-emerald-800 overflow-hidden',
            layout === 'mobile'
              ? 'inset-x-3 bottom-3'
              : 'bottom-6 right-6 w-[400px] max-w-[calc(100vw-2rem)]',
          ].join(' ')}
        >
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-5 text-white">
            <div className="flex items-center gap-3">
              <SparklesIcon className="w-8 h-8 flex-shrink-0" />
              <div>
                <h2 className="text-lg font-bold">You’re all set!</h2>
                <p className="text-sm text-emerald-50">
                  Onboarding is complete. Every gate is met.
                </p>
              </div>
            </div>
          </div>
          <div className="p-4 flex gap-2">
            <button
              type="button"
              onClick={() => router.push('/admin')}
              className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm"
            >
              Go to Dashboard
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300"
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
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={() => setExpanded(true)}
        className={[
          'fixed z-50 flex items-center gap-2 px-4 py-2.5',
          'bg-gradient-to-r from-blue-600 to-indigo-600 text-white',
          'rounded-full shadow-xl hover:shadow-2xl transition-shadow',
          layout === 'mobile' ? 'bottom-3 right-3' : 'bottom-6 right-6',
        ].join(' ')}
        title="Open onboarding guide"
      >
        <PlayCircleIcon className="w-5 h-5" />
        <span className="text-sm font-medium">
          {current}/{total}
        </span>
        <ChevronUpIcon className="w-3.5 h-3.5 opacity-80" />
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

  const cardClasses = [
    'fixed z-50 bg-white dark:bg-gray-900 shadow-2xl',
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
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.25 }}
        className={cardClasses}
      >
        {/* ── Header ─────────────────────────────────── */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 flex-shrink-0">
          <div className="p-4 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <PlayCircleIcon className="w-7 h-7 text-white flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-blue-100 uppercase tracking-wider font-semibold">
                    Step {shownPosition} of {shownTotal}
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
                  className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                  title="Minimize — reopen anytime"
                  aria-label="Minimize guide"
                >
                  <ChevronDownIcon className="w-4 h-4 text-white" />
                </button>
                <button
                  type="button"
                  onClick={() => setDismissed(true)}
                  className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                  title="Dismiss for this session"
                  aria-label="Dismiss guide"
                >
                  <XMarkIcon className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            <div className="mt-3 h-1 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${status.progress}%` }}
              />
            </div>
            <p className="text-[10px] text-blue-100 mt-1.5">
              {status.completedCount} of {status.totalCount} gates met ·{' '}
              {status.progress}% complete
            </p>
          </div>

          {/* ── Pagination strip ──────────────────────── */}
          {steps.length > 1 && (
            <div className="px-3 pb-3 pt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={goPrev}
                disabled={isFirstPage}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
                aria-label="Previous step"
                title="Previous step"
              >
                <ArrowLeftIcon className="w-4 h-4" />
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
                        'rounded-full transition-all flex-shrink-0',
                        isCurrent
                          ? 'w-6 h-2 bg-white'
                          : isDone
                          ? 'w-2 h-2 bg-emerald-300 hover:bg-emerald-200'
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
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
                aria-label="Next step"
                title="Next step"
              >
                <ArrowRightIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* ── Scrollable body ───────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Just-advanced celebration banner */}
          <AnimatePresence>
            {justAdvancedFrom !== null && (
              <motion.div
                key={`celebrate-${justAdvancedFrom}`}
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-start gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3 text-xs text-emerald-800 dark:text-emerald-300">
                  <CheckCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Step complete!</p>
                    <p className="mt-0.5 text-emerald-700 dark:text-emerald-400">
                      We advanced you to the next step automatically.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {redirectNotice !== null && (
            <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 text-xs text-blue-800 dark:text-blue-300">
              <InformationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>
                Step {redirectNotice} is already done. We brought you to your
                current step instead.
              </p>
            </div>
          )}

          {safeIndex !== status.currentIndex &&
            !isOptional &&
            !stepState?.completed && (
              <div className="flex items-start gap-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-3 text-xs text-gray-700 dark:text-gray-300">
                <LockClosedIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p>
                    You&apos;re previewing a different step.
                  </p>
                  <button
                    type="button"
                    onClick={() => jumpTo(status.currentIndex)}
                    className="mt-1 text-blue-600 dark:text-blue-400 hover:underline font-medium"
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
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2">
              <span className="text-amber-600 font-bold leading-none mt-0.5">
                ⛔
              </span>
              <div className="text-xs text-amber-800 dark:text-amber-300">
                <p className="font-semibold mb-1">Locked until this is done:</p>
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
              className={`flex items-center gap-1.5 text-xs ${
                speaking
                  ? 'text-blue-700 dark:text-blue-300 font-semibold'
                  : 'text-blue-600 dark:text-blue-400 hover:underline'
              }`}
            >
              <SpeakerWaveIcon
                className={`w-4 h-4 ${speaking ? 'animate-pulse' : ''}`}
              />
              {speaking ? 'Speaking…' : 'Listen again'}
            </button>

            <button
              type="button"
              onClick={() => setShowChecklist((s) => !s)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
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

        {/* ── Sticky footer ─────────────────────────────── */}
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-4 flex gap-2 bg-white dark:bg-gray-900">
          <button
            type="button"
            onClick={() => {
              stopSpeaking();
              router.push(step.route);
            }}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors"
          >
            Go to {step.name}
            <ArrowRightIcon className="w-4 h-4" />
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
                  console.error(err);
                } finally {
                  setBusyStep(null);
                }
              }}
              className="px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
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
            className="px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            title="Hide until next session"
          >
            Later
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
