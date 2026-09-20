'use client';

import { useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useOnboarding } from '../../../../hooks/useOnboarding';

export default function OnboardingStepPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, loading } = useOnboarding();
  const hasRedirected = useRef(false);

  const rawStepId = params?.stepId;
  const stepIdStr = Array.isArray(rawStepId) ? rawStepId[0] : rawStepId;
  const requestedStepId = Number(stepIdStr);
  const fromGuide = searchParams.get('from') === 'guide';

  useEffect(() => {
    if (loading) return;
    if (hasRedirected.current) return;

    // Invalid step id → dashboard
    if (!requestedStepId || !Number.isInteger(requestedStepId)) {
      hasRedirected.current = true;
      router.replace('/dashboard');
      return;
    }

    // No status yet → wait
    if (!status) return;

    // Case A: user clicked the step that IS the current next step.
    // Send them straight there via the backend-provided route.
    if (status.nextStep?.id === requestedStepId) {
      hasRedirected.current = true;
      const target = status.nextStep.route;
      // Only forward ?from=guide if the target accepts it
      router.replace(fromGuide ? `${target}?from=guide` : target);
      return;
    }

    // Case B: the requested step is already complete or skipped.
    // Send them to the current next step (or dashboard if done).
    // We can't reconstruct the completed step's route because the
    // backend only ships the route for the *current* step — so the
    // safest destination is the live nextStep.
    if (status.nextStep) {
      hasRedirected.current = true;
      const target = status.nextStep.route;
      // Add a flag so the guide can show "you were moved to the current step"
      const sep = target.includes('?') ? '&' : '?';
      router.replace(`${target}${sep}redirectedFrom=${requestedStepId}`);
      return;
    }

    // Case C: everything is complete → dashboard
    hasRedirected.current = true;
    router.replace('/dashboard');
  }, [requestedStepId, status, loading, router, fromGuide]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400 mx-auto" />
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          Taking you to step {requestedStepId || '…'}…
        </p>
      </div>
    </div>
  );
}
