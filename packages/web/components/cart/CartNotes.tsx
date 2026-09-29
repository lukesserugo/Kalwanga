// packages/web/components/cart/CartNotes.tsx
'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FileText, Loader2, Check } from 'lucide-react';

import { toast } from '../../utils/toast-manager';
import { cartService } from '../../services/cartService';
import { guestCartService } from '../../services/guestCartService';
import { useAuth } from '../../hooks/useAuth';

// ============================================
// TYPES
// ============================================

interface CartNotesProps {
  initialNotes?: string;
  onNotesUpdated?: (notes: string) => void;
  disabled?: boolean;
  className?: string;
  maxLength?: number;
}

type SaveState = 'idle' | 'saving' | 'saved';

/**
 * Minimal interface the panel needs from whichever cart service is
 * active. Both `cartService` and `guestCartService` are checked
 * against this at runtime — if the guest service doesn't implement
 * `updateCartNotes`, guests see a read-only panel instead of a
 * button that fails when clicked.
 */
interface NotesCapableCartService {
  updateCartNotes?: (notes?: string) => Promise<unknown>;
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

// ============================================
// COMPONENT
// ============================================

export function CartNotes({
  initialNotes = '',
  onNotesUpdated,
  disabled = false,
  className = '',
  maxLength,
}: CartNotesProps) {
  const { isAuthenticated } = useAuth();

  // Normalize on the way in so a whitespace-only server value doesn't
  // render as a blank block.
  const normalizedInitial = useMemo(
    () => String(initialNotes ?? '').trim(),
    [initialNotes],
  );

  const [notes, setNotes] = useState(normalizedInitial);
  const [tempNotes, setTempNotes] = useState(normalizedInitial);
  const [isEditing, setIsEditing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  /**
   * Synchronous guard against concurrent saves. `saveState` from
   * `useState` is stale inside a keydown handler that fires before
   * React re-renders, so two rapid Ctrl+Enter presses can both see
   * `'idle'` and both fire the request. A ref is updated
   * synchronously and can't be raced.
   */
  const saveInFlightRef = useRef(false);

  // ── Resolve the active cart service ─────────────────────────

  const activeCartService = useMemo<NotesCapableCartService>(
    () =>
      (isAuthenticated ? cartService : guestCartService) as NotesCapableCartService,
    [isAuthenticated],
  );

  /**
   * Guests can only edit notes if the guest cart service actually
   * implements `updateCartNotes`. The backend's `PATCH /cart/notes`
   * requires an authenticated `userId` — a guest hitting that route
   * gets a 400. Rather than let a guest type a note and fail on
   * save, we detect the capability up front.
   */
  const canEditNotes = useMemo(() => {
    if (disabled) return false;
    return typeof activeCartService.updateCartNotes === 'function';
  }, [activeCartService, disabled]);

  // ── Sync from props ────────────────────────────────────────

  /**
   * When the parent supplies a new `initialNotes` and the user is NOT
   * editing, adopt it. When the user IS editing, keep their draft —
   * but remember the parent's newer value so Cancel can restore to
   * *that*, not to the stale pre-edit value.
   */
  useEffect(() => {
    if (isEditing) return;
    setNotes(normalizedInitial);
    setTempNotes(normalizedInitial);
  }, [normalizedInitial, isEditing]);

  // ── "Saved" indicator auto-clears ──────────────────────────

  useEffect(() => {
    if (saveState !== 'saved') return;
    const timer = setTimeout(() => setSaveState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [saveState]);

  // ── Focus the textarea when editing begins ─────────────────

  useEffect(() => {
    if (!isEditing) return;
    // Defer one tick so the textarea is mounted before we focus it.
    const t = setTimeout(() => textareaRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [isEditing]);

  // ── Handlers ───────────────────────────────────────────────

  const handleEdit = useCallback(() => {
    if (!canEditNotes) return;
    setTempNotes(notes);
    setIsEditing(true);
  }, [notes, canEditNotes]);

  const handleCancel = useCallback(() => {
    // Restore to the parent's latest value, not the last saved draft.
    // `normalizedInitial` is the source of truth for "what the server
    // said last time we weren't editing."
    setTempNotes(normalizedInitial);
    setNotes(normalizedInitial);
    setIsEditing(false);
    setSaveState('idle');
  }, [normalizedInitial]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      let next = e.target.value;

      // Enforce max length on the value, not just the input element.
      // Some browsers don't enforce `maxLength` on programmatic paste.
      if (typeof maxLength === 'number' && next.length > maxLength) {
        next = next.slice(0, maxLength);
      }

      setTempNotes(next);
    },
    [maxLength],
  );

  const handleSave = useCallback(async () => {
    if (saveInFlightRef.current) return;
    if (!canEditNotes || !activeCartService.updateCartNotes) return;

    const trimmed = tempNotes.trim();

    // Compare raw values, not trimmed — whitespace-only changes are
    // still the user's input, and the server normalizes.
    if (tempNotes === notes) {
      setIsEditing(false);
      return;
    }

    saveInFlightRef.current = true;
    setSaveState('saving');

    try {
      await activeCartService.updateCartNotes(trimmed);

      setNotes(trimmed);
      setTempNotes(trimmed);
      setIsEditing(false);
      setSaveState('saved');
      toast.success('Cart notes updated');

      // Notify any subscriber that the cart changed. The `cart:updated`
      // event is the same one `ProductCard`, `POSCart`, and others
      // dispatch after a mutation.
      window.dispatchEvent(new CustomEvent('cart:updated'));

      onNotesUpdated?.(trimmed);
    } catch (err) {
      const rawMessage = extractErrorMessage(err, 'Failed to update notes');

      // Guests hitting an authenticated-only route get a technical
      // "User ID is required" message. Translate it into something
      // the shopper can act on.
      const friendlyMessage = /user id/i.test(rawMessage)
        ? 'Sign in to save order notes'
        : rawMessage;

      toast.error(friendlyMessage);
      setSaveState('idle');
    } finally {
      saveInFlightRef.current = false;
    }
  }, [
    tempNotes,
    notes,
    canEditNotes,
    activeCartService,
    onNotesUpdated,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
        return;
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        void handleSave();
      }
    },
    [handleCancel, handleSave],
  );

  // ── Derived UI flags ───────────────────────────────────────

  const isSaving = saveState === 'saving';
  const justSaved = saveState === 'saved';
  const isLocked = disabled || isSaving;

  const remainingChars =
    typeof maxLength === 'number' ? maxLength - tempNotes.length : null;

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-400 shrink-0" />
          <span className="font-medium text-gray-900 dark:text-white">
            Order Notes
          </span>
          {justSaved && (
            <span className="inline-flex items-center gap-1 text-xs text-success-600 dark:text-success-400">
              <Check className="w-3.5 h-3.5" />
              Saved
            </span>
          )}
        </div>

        {!isEditing && canEditNotes && (
          <button
            type="button"
            onClick={handleEdit}
            className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors shrink-0 focus-ring rounded"
          >
            {notes ? 'Edit' : 'Add Note'}
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <textarea
            ref={textareaRef}
            value={tempNotes}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Add special instructions, delivery notes, or any other comments…"
            disabled={isLocked}
            rows={3}
            maxLength={maxLength}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 resize-none transition-all"
            aria-label="Order notes"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isLocked}
              className="px-3 py-1.5 bg-brand-gradient hover:shadow-brand-lg text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-2 shadow-brand focus-ring"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save'
              )}
            </button>

            <button
              type="button"
              onClick={handleCancel}
              disabled={isLocked}
              className="btn-secondary focus-ring disabled:opacity-50"
            >
              Cancel
            </button>

            <span className="text-2xs text-gray-400 ml-auto hidden sm:inline-flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-2xs font-mono">
                Ctrl
              </kbd>
              {' + '}
              <kbd className="px-1 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-2xs font-mono">
                Enter
              </kbd>
              {' to save'}
            </span>

            {remainingChars !== null && (
              <span
                className={`text-xs tabular-nums ${
                  remainingChars < 20
                    ? 'text-danger-500'
                    : 'text-gray-400'
                }`}
              >
                {remainingChars} left
              </span>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleEdit}
          disabled={!canEditNotes}
          className="w-full text-left p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg min-h-[60px] hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors disabled:cursor-default disabled:hover:bg-gray-50 dark:disabled:hover:bg-gray-700/50 focus-ring"
          aria-label={
            !canEditNotes
              ? 'Order notes (read-only)'
              : notes
              ? 'Edit order notes'
              : 'Add order notes'
          }
        >
          {notes ? (
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
              {notes}
            </p>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">
              {canEditNotes
                ? 'No notes added. Click to add special instructions…'
                : 'Sign in to add order notes.'}
            </p>
          )}
        </button>
      )}
    </div>
  );
}

export default CartNotes;
