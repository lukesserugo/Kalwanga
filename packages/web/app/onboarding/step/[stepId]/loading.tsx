// app/onboarding/step/[stepId]/loading.tsx

import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400 mx-auto" />
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          Loading step…
        </p>
      </div>
    </div>
  );
}
