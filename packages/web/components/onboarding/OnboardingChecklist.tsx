// packages/web/components/onboarding/OnboardingChecklist.tsx

'use client';

import React from 'react';
import Link from 'next/link';
import {
  CheckCircleIcon,
  ChevronRightIcon,
  LockClosedIcon,
  MinusCircleIcon,
} from '@heroicons/react/24/outline';
import type {
  OnboardingStatus,
  NextStep,
} from '../../services/onboardingService';

interface Props {
  status: OnboardingStatus;
  /** The step the guide is currently showing (may not equal nextStep). */
  currentStepId?: number;
  onNavigate?: () => void;
}

export function OnboardingChecklist({
  status,
  currentStepId,
  onNavigate,
}: Props) {
  // The backend already filters out completed and skipped steps from
  // `activeSteps`. Anything not in that list is done — we show them
  // collapsed at the top so the user can see progress at a glance.
  const activeSteps: NextStep[] = status.activeSteps ?? [];

  const completedIds: number[] = Object.entries(status.steps)
    .filter(([, s]) => s.completed)
    .map(([id]) => Number(id))
    .sort((a, b) => a - b);

  const skippedIds: number[] = Object.entries(status.steps)
    .filter(([, s]) => s.skipped && !s.completed)
    .map(([id]) => Number(id))
    .sort((a, b) => a - b);

  const highlightedId = currentStepId ?? status.nextStep?.id ?? null;

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {/* Completed summary row */}
      {completedIds.length > 0 && (
        <div className="px-3 py-2.5">
          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
            {completedIds.length} step
            {completedIds.length === 1 ? '' : 's'} completed
          </p>
        </div>
      )}

      {/* Active steps */}
      {activeSteps.map((s) => {
        const isCurrent = s.id === highlightedId;
        const isOptional = s.optional;

        return (
          <ActiveStepRow
            key={s.id}
            step={s}
            isCurrent={isCurrent}
            isOptional={isOptional}
            onNavigate={onNavigate}
          />
        );
      })}

      {/* Skipped summary row */}
      {skippedIds.length > 0 && (
        <div className="px-3 py-2.5">
          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <MinusCircleIcon className="w-4 h-4 text-purple-500" />
            {skippedIds.length} step
            {skippedIds.length === 1 ? '' : 's'} skipped
          </p>
        </div>
      )}

      {activeSteps.length === 0 && (
        <div className="px-3 py-4 text-center text-xs text-gray-500 dark:text-gray-400">
          All steps done.
        </div>
      )}
    </div>
  );
}

function ActiveStepRow({
  step,
  isCurrent,
  isOptional,
  onNavigate,
}: {
  step: NextStep;
  isCurrent: boolean;
  isOptional: boolean;
  onNavigate?: () => void;
}) {
  const dot = isCurrent ? (
    <span className="relative flex items-center justify-center w-5 h-5 flex-shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60" />
      <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
    </span>
  ) : (
    <span className="flex items-center justify-center w-5 h-5 flex-shrink-0">
      <span className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600" />
    </span>
  );

  const body = (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
        isCurrent
          ? 'bg-blue-50 dark:bg-blue-900/20'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
      }`}
    >
      {dot}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm truncate ${
            isCurrent
              ? 'font-semibold text-blue-700 dark:text-blue-300'
              : 'text-gray-700 dark:text-gray-300'
          }`}
        >
          {step.displayPosition}. {step.name}
          {isOptional && (
            <span className="ml-2 text-[10px] uppercase tracking-wider text-gray-400">
              optional
            </span>
          )}
        </p>
        {!isCurrent && (
          <p className="text-[11px] text-gray-400 mt-0.5 truncate">
            {step.reason}
          </p>
        )}
      </div>
      <ChevronRightIcon
        className={`w-4 h-4 flex-shrink-0 ${
          isCurrent ? 'text-blue-500' : 'text-gray-300 dark:text-gray-600'
        }`}
      />
    </div>
  );

  // Only the current step is a real navigation link. Other active
  // steps route through the guide's pager — the checklist is a
  // preview, not a shortcut.
  if (!isCurrent) return body;

  return (
    <Link
      href={`/onboarding/step/${step.id}?from=guide`}
      className="block"
      onClick={onNavigate}
    >
      {body}
    </Link>
  );
}
