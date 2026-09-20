// D:\Projects\Kalwanga\packages\web\components\notifications\ConfirmProvider.tsx

'use client';

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { ConfirmDialog, type ConfirmTone } from './ConfirmDialog';

// ============================================
// TYPES
// ============================================
//
// Exported so `useConfirm` and any consumer can reference the
// contract without re-declaring it. Keeping the shape in one place
// means a new option (e.g. `autoFocusCancel`) is one edit, not
// three.

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

export interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

// ============================================
// CONTEXT
// ============================================
//
// Exported so `useConfirm` can consume it. The value type is
// explicitly `ConfirmContextValue | null` so `useContext` returns
// `null` when outside the provider — which the hook checks for.

export const ConfirmContext = createContext<ConfirmContextValue | null>(null);

// ============================================
// INTERNAL STATE
// ============================================

interface InternalState extends ConfirmOptions {
  open: boolean;
  loading: boolean;
}

// ============================================
// PROVIDER
// ============================================

export function ConfirmProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<InternalState>({
    open: false,
    loading: false,
    title: '',
  });

  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions): Promise<boolean> => {
      // If a previous confirm is still pending, resolve it as false
      // so its caller doesn't hang forever.
      if (resolverRef.current) {
        resolverRef.current(false);
        resolverRef.current = null;
      }

      return new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
        setState({
          open: true,
          loading: false,
          ...options,
        });
      });
    },
    [],
  );

  const handleConfirm = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    const resolve = resolverRef.current;
    resolverRef.current = null;
    // Yield to allow the loading state to paint before resolving.
    setTimeout(() => {
      resolve?.(true);
      setState((s) => ({ ...s, open: false, loading: false }));
    }, 0);
  }, []);

  const handleCancel = useCallback(() => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(false);
    setState((s) => ({ ...s, open: false, loading: false }));
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmDialog
        open={state.open}
        title={state.title}
        description={state.description}
        confirmLabel={state.confirmLabel}
        cancelLabel={state.cancelLabel}
        tone={state.tone}
        loading={state.loading}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  );
}

// ============================================
// INLINE HOOK (for convenience)
// ============================================
//
// `useConfirm` also lives in its own file (`useConfirm.ts`) for
// consumers who prefer the shorter import path. Both resolve to the
// same context — there is only one implementation.

export function useConfirm(): ConfirmContextValue['confirm'] {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error(
      'useConfirm must be used inside <ConfirmProvider>. ' +
        'Wrap your app (or dashboard layout) with <ConfirmProvider>.',
    );
  }
  return ctx.confirm;
}
