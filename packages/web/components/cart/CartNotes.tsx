'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Loader2, Check, X } from 'lucide-react';
import { toast } from '../../utils/toast-manager';
import { cartService } from '../../services/cartService';
import { guestCartService } from '../../services/guestCartService';
import { useAuth } from '../../hooks/useAuth';

interface CartNotesProps {
  initialNotes?: string;
  onNotesUpdated?: (notes: string) => void;
  disabled?: boolean;
  className?: string;
  maxLength?: number;
}

type SaveState = 'idle' | 'saving' | 'saved';

export function CartNotes({
  initialNotes = '',
  onNotesUpdated,
  disabled = false,
  className = '',
  maxLength,
}: CartNotesProps) {
  const { isAuthenticated } = useAuth();
  const [notes, setNotes] = useState(initialNotes);
  const [tempNotes, setTempNotes] = useState(initialNotes);
  const [isEditing, setIsEditing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const activeCartService = useMemo(
    () => (isAuthenticated ? cartService : guestCartService),
    [isAuthenticated],
  );

  useEffect(() => {
    if (!isEditing) {
      setNotes(initialNotes);
      setTempNotes(initialNotes);
    }
  }, [initialNotes, isEditing]);

  useEffect(() => {
    if (saveState !== 'saved') return;
    const t = setTimeout(() => setSaveState('idle'), 2000);
    return () => clearTimeout(t);
  }, [saveState]);

  const handleEdit = useCallback(() => {
    if (disabled) return;
    setTempNotes(notes);
    setIsEditing(true);
  }, [notes, disabled]);

  const handleCancel = useCallback(() => {
    setTempNotes(notes);
    setIsEditing(false);
  }, [notes]);

  const handleSave = useCallback(async () => {
    if (saveState === 'saving') return;

    const trimmed = tempNotes.trim();

    if (trimmed === notes.trim()) {
      setIsEditing(false);
      return;
    }

    setSaveState('saving');

    try {
      await activeCartService.updateCartNotes(trimmed);
      setNotes(trimmed);
      setTempNotes(trimmed);
      setIsEditing(false);
      setSaveState('saved');
      toast.success('Cart notes updated');
      window.dispatchEvent(new CustomEvent('cart:updated'));
      onNotesUpdated?.(trimmed);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to update notes';
      toast.error(message);
      setSaveState('idle');
    }
  }, [
    saveState,
    tempNotes,
    notes,
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

  const isSaving = saveState === 'saving';
  const justSaved = saveState === 'saved';

  const remainingChars =
    typeof maxLength === 'number'
      ? maxLength - tempNotes.length
      : null;

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

        {!isEditing && !disabled && (
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
            value={tempNotes}
            onChange={(e) => setTempNotes(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add special instructions, delivery notes, or any other comments…"
            disabled={disabled || isSaving}
            rows={3}
            maxLength={maxLength}
            autoFocus
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 resize-none transition-all"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={disabled || isSaving}
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
              disabled={disabled || isSaving}
              className="btn-secondary focus-ring disabled:opacity-50"
            >
              Cancel
            </button>

            <span className="text-2xs text-gray-400 ml-auto">
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
          disabled={disabled}
          className="w-full text-left p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg min-h-[60px] hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors disabled:cursor-default disabled:hover:bg-gray-50 dark:disabled:hover:bg-gray-700/50 focus-ring"
          aria-label={notes ? 'Edit order notes' : 'Add order notes'}
        >
          {notes ? (
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
              {notes}
            </p>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">
              No notes added. Click to add special instructions…
            </p>
          )}
        </button>
      )}
    </div>
  );
}

export default CartNotes;
