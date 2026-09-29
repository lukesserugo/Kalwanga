// packages/web/components/cart/CartPromotionInput.tsx
'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Gift, Loader2, X, Check, Tag } from 'lucide-react';

import { toast } from '../../utils/toast-manager';
import { cartService } from '../../services/cartService';
import { guestCartService } from '../../services/guestCartService';
import { useAuth } from '../../hooks/useAuth';

// ============================================
// TYPES
// ============================================

/**
 * Minimum shape a promotion-apply response must expose. Both
 * `cartService.applyPromotion` and (if it exists) the guest
 * equivalent return the full `Cart`; this narrow view is what the
 * component actually needs, so consumers don't have to cast.
 */
export interface CartWithPromotion {
  id: string;
  promotionCode?: string;
  promotionDiscount?: number;
  discount?: number;
  total?: number;
  [key: string]: unknown;
}

interface CartPromotionInputProps {
  /**
   * Called after a promotion is applied successfully. Receives the
   * cart returned by the server.
   */
  onPromotionApplied?: (cart: CartWithPromotion) => void;

  /**
   * The promotion code currently attached to the cart, if any. When
   * this changes, the input resets to `'idle'` so a stale "Applied"
   * state can't outlive the code it referred to.
   */
  currentPromotionCode?: string;

  /**
   * Notifies the parent that the user dismissed the local chip.
   *
   * ⚠ The backend has NO "remove promotion" endpoint. Calling this
   *   does NOT clear the server-side promotion. To replace a
   *   promotion, submit a new code via the input. This callback only
   *   hides the chip in the parent's UI.
   */
  onPromotionCleared?: () => void;

  disabled?: boolean;
  className?: string;
}

type ApplyState = 'idle' | 'applying' | 'applied';

/**
 * Minimal interface the panel needs from whichever cart service is
 * active. Both services are checked at runtime — if the guest service
 * has no `applyPromotion`, guests see a sign-in prompt instead of a
 * form whose submit will 400.
 */
interface PromotionCapableCartService {
  applyPromotion?: (code: string) => Promise<CartWithPromotion>;
}

// ============================================
// HELPERS
// ============================================

function extractErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;

  const anyErr = error as any;
  const data = anyErr?.response?.data;

  if (data) {
    if (typeof data.error === 'string') return data.error;
    if (data.error?.message) return String(data.error.message);
    if (data.message) return String(data.message);
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors
        .map((e: any) => `${e.field ?? 'field'}: ${e.message ?? 'invalid'}`)
        .join(', ');
    }
  }

  if (anyErr?.message) return String(anyErr.message);
  return fallback;
}

/**
 * Normalize a user-typed promotion code. Uppercase, strip
 * whitespace, strip anything that isn't `A-Z0-9-_`. Promo codes are
 * conventionally `[A-Z0-9-_]`, so this prevents a paste like
 * `"SAVE 10\n"` from reaching the server.
 */
function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

// ============================================
// COMPONENT
// ============================================

export function CartPromotionInput({
  onPromotionApplied,
  currentPromotionCode,
  onPromotionCleared,
  disabled = false,
  className = '',
}: CartPromotionInputProps) {
  const { isAuthenticated } = useAuth();

  const [promotionCode, setPromotionCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<ApplyState>('idle');

  const inputRef = useRef<HTMLInputElement | null>(null);

  /**
   * Synchronous guard against double-submit. `state` from `useState`
   * is stale inside an `onSubmit` handler that fires before React
   * re-renders, so two rapid Enter presses can both see `'idle'` and
   * both fire the request. A ref is updated synchronously and can't
   * be raced.
   */
  const applyInFlightRef = useRef(false);

  // ── Resolve the active cart service ─────────────────────────

  const activeCartService = useMemo<PromotionCapableCartService>(
    () =>
      (isAuthenticated
        ? cartService
        : guestCartService) as PromotionCapableCartService,
    [isAuthenticated],
  );

  /**
   * Guests can only apply a promotion if the guest cart service
   * implements `applyPromotion`. The backend's `POST /cart/promotion`
   * requires an authenticated `userId`, so a guest hitting that route
   * gets a 400. Rather than let them type and fail, we hide the form.
   */
  const canApplyPromotion = useMemo(() => {
    if (disabled) return false;
    return typeof activeCartService.applyPromotion === 'function';
  }, [activeCartService, disabled]);

  // ── Prop-driven resets ─────────────────────────────────────

  /**
   * When the applied promotion code changes (parent synced, code was
   * replaced, cart was cleared), drop any transient apply state and
   * error. Without this, a stale "Applied ✓" indicator can outlive
   * the code it referred to.
   */
  useEffect(() => {
    setState('idle');
    setError(null);
  }, [currentPromotionCode]);

  // ── "Applied" indicator auto-clears ────────────────────────

  useEffect(() => {
    if (state !== 'applied') return;
    const timer = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  // ── Handlers ───────────────────────────────────────────────

  const handleApplyPromotion = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (applyInFlightRef.current) return;
      if (!canApplyPromotion || !activeCartService.applyPromotion) return;

      const code = normalizeCode(promotionCode);

      if (!code) {
        setError('Please enter a promotion code');
        inputRef.current?.focus();
        return;
      }

      const currentNormalized = currentPromotionCode
        ? normalizeCode(currentPromotionCode)
        : '';

      if (currentNormalized && code === currentNormalized) {
        setError('This code is already applied');
        inputRef.current?.focus();
        return;
      }

      applyInFlightRef.current = true;
      setError(null);
      setState('applying');

      try {
        const cart = await activeCartService.applyPromotion(code);

        // Prefer the server's echoed code — it may normalize
        // differently (e.g. add a prefix) than the client's input.
        const serverCode = cart?.promotionCode ?? code;

        toast.success(`Promotion "${serverCode}" applied`);
        setPromotionCode('');
        setState('applied');
        window.dispatchEvent(new CustomEvent('cart:updated'));
        onPromotionApplied?.(cart);
      } catch (err) {
        const rawMessage = extractErrorMessage(
          err,
          'Failed to apply promotion',
        );

        // Guests hitting an authenticated-only route get a
        // technical "User ID is required" message. Translate it into
        // something the shopper can act on.
        const friendlyMessage = /user id/i.test(rawMessage)
          ? 'Sign in to apply a promotion code'
          : rawMessage;

        setError(friendlyMessage);
        toast.error(friendlyMessage);
        setState('idle');
      } finally {
        applyInFlightRef.current = false;
      }
    },
    [
      promotionCode,
      currentPromotionCode,
      canApplyPromotion,
      activeCartService,
      onPromotionApplied,
    ],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Strip disallowed characters before storing. The display
      // stays clean even on paste of `" save10 \n"`.
      setPromotionCode(normalizeCode(e.target.value));

      // Typing after a successful apply resets the indicator —
      // otherwise the button reads "Applied" while the user is
      // already entering the next code.
      if (state === 'applied') setState('idle');
      if (error) setError(null);
    },
    [state, error],
  );

  const handleClearInput = useCallback(() => {
    setPromotionCode('');
    setError(null);
    inputRef.current?.focus();
  }, []);

  /**
   * Dismisses the local chip. Does NOT clear the server-side
   * promotion — the backend has no such endpoint.
   */
  const handleDismissChip = useCallback(() => {
    setError(null);
    onPromotionCleared?.();
  }, [onPromotionCleared]);

  // ── Derived UI flags ───────────────────────────────────────

  const isApplying = state === 'applying';
  const justApplied = state === 'applied';
  const inputDisabled = disabled || isApplying;

  const normalizedCurrent = currentPromotionCode
    ? normalizeCode(currentPromotionCode)
    : '';
  const hasApplied = Boolean(normalizedCurrent);

  // ── Render: guests without promotion support ───────────────

  if (!canApplyPromotion) {
    return (
      <div className={`space-y-2 ${className}`}>
        {hasApplied && (
          <AppliedChip
            code={normalizedCurrent}
            onDismiss={onPromotionCleared ? handleDismissChip : undefined}
            disabled={disabled}
          />
        )}

        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700">
          <Tag className="w-4 h-4 text-gray-400 shrink-0" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Sign in to apply a promotion code.
          </p>
        </div>
      </div>
    );
  }

  // ── Render: interactive form ───────────────────────────────

  return (
    <div className={`space-y-2 ${className}`}>
      {hasApplied && (
        <AppliedChip
          code={normalizedCurrent}
          onDismiss={onPromotionCleared ? handleDismissChip : undefined}
          disabled={disabled}
        />
      )}

      <form
        onSubmit={handleApplyPromotion}
        className="flex flex-col sm:flex-row gap-2"
      >
        <div className="flex-1 relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {justApplied ? (
              <Check className="w-4 h-4 text-success-500" />
            ) : (
              <Gift className="w-4 h-4 text-gray-400" />
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={promotionCode}
            onChange={handleInputChange}
            placeholder={
              hasApplied ? 'Replace code' : 'Enter promotion code'
            }
            disabled={inputDisabled}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            inputMode="text"
            className={`w-full pl-9 pr-8 py-2 bg-white dark:bg-gray-700 border rounded-lg focus:ring-2 focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 transition-colors font-mono uppercase tracking-wide ${
              justApplied
                ? 'border-success-500 focus:ring-success-500'
                : error
                ? 'border-danger-500 focus:ring-danger-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-secondary-500'
            }`}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? 'promotion-error' : undefined}
            aria-label={
              hasApplied ? 'Replacement promotion code' : 'Promotion code'
            }
          />
          {promotionCode && (
            <button
              type="button"
              onClick={handleClearInput}
              disabled={inputDisabled}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-orange-50 dark:hover:bg-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50 focus-ring"
              aria-label="Clear promotion code input"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={
            disabled ||
            isApplying ||
            justApplied ||
            !promotionCode.trim()
          }
          className="px-4 py-2 bg-secondary-600 hover:bg-secondary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[100px] focus-ring"
        >
          {isApplying ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Applying…
            </>
          ) : justApplied ? (
            <>
              <Check className="w-4 h-4" />
              Applied
            </>
          ) : (
            'Apply'
          )}
        </button>
      </form>

      {error && (
        <p
          id="promotion-error"
          role="alert"
          className="text-sm text-danger-600 dark:text-danger-400"
        >
          {error}
        </p>
      )}
    </div>
  );
}

// ============================================
// SUBCOMPONENT: APPLIED CHIP
// ============================================

/**
 * The chip shown when a promotion is attached to the cart.
 *
 * The `X` button dismisses the local chip only — the backend has no
 * endpoint to remove a promotion. The tooltip and aria-label make
 * that explicit so a user doesn't think clicking it removes the
 * discount from their total.
 */
function AppliedChip({
  code,
  onDismiss,
  disabled,
}: {
  code: string;
  onDismiss?: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-secondary-50 dark:bg-secondary-900/20 border border-secondary-200 dark:border-secondary-800">
      <div className="flex items-center gap-2 min-w-0">
        <Check className="w-4 h-4 text-secondary-600 dark:text-secondary-400 shrink-0" />
        <span className="text-sm font-medium text-secondary-700 dark:text-secondary-300 truncate font-mono tabular-nums">
          {code}
        </span>
        <span className="text-xs text-secondary-500 dark:text-secondary-400">
          applied
        </span>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          disabled={disabled}
          title="Hide this indicator. The discount stays on your cart until you replace it with another code."
          className="shrink-0 p-1 rounded-md text-secondary-600 hover:bg-secondary-100 dark:text-secondary-400 dark:hover:bg-secondary-900/40 transition-colors disabled:opacity-50 focus-ring"
          aria-label="Hide promotion indicator"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default CartPromotionInput;
