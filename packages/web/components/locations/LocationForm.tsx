// packages/web/components/locations/LocationForm.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Save,
  Loader2,
  AlertCircle,
  Hash,
  Phone,
  FileText,
} from 'lucide-react';

import {
  LOCATION_TYPES,
  LOCATION_TYPE_LABELS,
  type CreateLocationInput,
} from '../../services/locationService';

// ============================================
// TYPES
// ============================================

interface LocationFormProps {
  /**
   * Seed values for the form. In edit mode this is the location being
   * edited; in create mode it's usually omitted or a partial from a
   * "duplicate" flow.
   *
   * The form re-seeds from these values only when the underlying
   * entity identity changes — not on every parent render.
   */
  initialValues?: Partial<CreateLocationInput> & {
    /** Present in edit mode; may be absent in create mode. */
    id?: string;
  };
  onSubmit: (data: CreateLocationInput) => Promise<void> | void;
  onCancel: () => void;
  saving?: boolean;
  error?: string | null;
  mode?: 'create' | 'edit';
  /**
   * Focus the Name input on mount. Defaults to `true` in create mode
   * and `false` in edit mode — editing an existing record should not
   * steal focus from wherever the user was.
   */
  autoFocus?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

/**
 * Default location type.
 *
 * Derived from `LOCATION_TYPES[0]` rather than hardcoding `'STORE'`.
 * If the service's array ever diverges from the backend's
 * `VALID_TYPES` set — say `'RETAIL'` replaces `'STORE'` — a
 * hardcoded default would leave the `<select>` with no matching
 * option, React would warn, and the browser would silently display
 * the first entry while `form.type` held a value the backend rejects.
 *
 * The `'OTHER'` fallback matches the backend's own default when
 * `input.type` is omitted (`(input.type || 'OTHER').toUpperCase()`).
 */
const DEFAULT_TYPE: NonNullable<CreateLocationInput['type']> =
  (LOCATION_TYPES[0] as CreateLocationInput['type']) ?? 'OTHER';

const EMPTY: CreateLocationInput = {
  name: '',
  code: '',
  type: DEFAULT_TYPE,
  description: '',
  address: '',
  phone: '',
  isDefault: false,
};

// ============================================
// SHARED CLASS STRINGS
// ============================================
//
// Padding is split into `inputPadding` and `inputPaddingWithIcon`
// rather than layering `pl-9` on top of `px-3`. Tailwind's source
// order happens to make that work today, but relying on it means a
// future stylesheet reshuffle silently breaks the icon insets.

const inputBase =
  'w-full py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 disabled:opacity-50';
const inputBorder = 'border-gray-300 dark:border-gray-600';
const inputPadding = 'px-3';
const inputPaddingWithIcon = 'pl-9 pr-3';
const labelBase =
  'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const iconBase =
  'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none';

// ============================================
// COMPONENT
// ============================================

export function LocationForm({
  initialValues,
  onSubmit,
  onCancel,
  saving = false,
  error = null,
  mode = 'create',
  autoFocus,
}: LocationFormProps) {
  const [form, setForm] = useState<CreateLocationInput>({
    ...EMPTY,
    ...initialValues,
  });
  const [localError, setLocalError] = useState<string | null>(null);

  const resolvedAutoFocus = autoFocus ?? mode === 'create';

  // ── Re-seed guard ─────────────────────────────────────────
  //
  // Only re-seed when the underlying entity identity changes — not
  // on every parent render. Without this guard, an inline
  // `initialValues={{...}}` in the parent wipes unsaved keystrokes
  // on every render.

  const entityKey =
    initialValues?.id ??
    initialValues?.code ??
    (mode === 'edit' ? 'unknown' : 'new');

  const seedKey = `${mode}:${entityKey}`;
  const lastSeedRef = useRef<string | null>(null);

  // Keep a ref of the latest `initialValues` so the seed effect can
  // read it without listing it as a dependency. Listing it would
  // re-fire the effect on every parent render when the parent passes
  // an inline object.
  const initialValuesRef = useRef(initialValues);
  useEffect(() => {
    initialValuesRef.current = initialValues;
  });

  useEffect(() => {
    if (lastSeedRef.current === seedKey) return;
    lastSeedRef.current = seedKey;
    setForm({ ...EMPTY, ...initialValuesRef.current });
    setLocalError(null);
  }, [seedKey]);

  // ── Field updates ─────────────────────────────────────────

  const updateField = <K extends keyof CreateLocationInput>(
    key: K,
    value: CreateLocationInput[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (localError) setLocalError(null);
  };

  /**
   * Trim `name` and `code` on blur so what's stored matches what's
   * shown. Uses the functional form of `setForm` so the closure
   * reads the latest state regardless of when the handler was
   * created.
   */
  const trimFieldOnBlur = (key: 'name' | 'code') => () => {
    setForm((prev) => {
      const current = prev[key];
      if (typeof current !== 'string') return prev;
      const trimmed = current.trim();
      if (trimmed === current) return prev;
      return { ...prev, [key]: trimmed };
    });
  };

  // ── Submit ────────────────────────────────────────────────

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Guard against re-submission via Enter while a save is in
    // flight. The submit button's `disabled` prop only blocks
    // clicks — Enter bypasses it.
    if (saving) return;

    if (!form.name.trim()) {
      setLocalError('Name is required');
      return;
    }

    setLocalError(null);

    // Fire-and-forget: the parent owns the `saving` state and the
    // error display. Awaiting here would surface a rejection as an
    // unhandled promise rejection in the event handler, and the
    // parent has no way to route it back into this component.
    void onSubmit({
      ...form,
      name: form.name.trim(),
      code: form.code?.trim() || undefined,
    });
  };

  const displayError = localError || error;

  // ── Render ────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {displayError && (
        <div
          role="alert"
          aria-live="assertive"
          className="p-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl flex items-start gap-2 animate-slide-down"
        >
          <AlertCircle
            className="w-4 h-4 text-danger-600 dark:text-danger-400 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <p className="text-sm text-danger-700 dark:text-danger-300">
            {displayError}
          </p>
        </div>
      )}

      {/* Name */}
      <div>
        <label htmlFor="location-name" className={labelBase}>
          Name <span className="text-danger-500">*</span>
        </label>
        <input
          id="location-name"
          type="text"
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
          onBlur={trimFieldOnBlur('name')}
          placeholder="e.g. Main Warehouse"
          disabled={saving}
          autoFocus={resolvedAutoFocus}
          required
          autoComplete="off"
          className={`${inputBase} ${inputBorder} ${inputPadding}`}
        />
      </div>

      {/* Type + Code */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="location-type" className={labelBase}>
            Type
          </label>
          <select
            id="location-type"
            value={form.type}
            onChange={(e) =>
              updateField(
                'type',
                e.target.value as CreateLocationInput['type'],
              )
            }
            disabled={saving}
            className={`${inputBase} ${inputBorder} ${inputPadding}`}
          >
            {LOCATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {LOCATION_TYPE_LABELS[t] ?? t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="location-code" className={labelBase}>
            Code
          </label>
          <div className="relative">
            <Hash className={iconBase} aria-hidden="true" />
            <input
              id="location-code"
              type="text"
              value={form.code || ''}
              onChange={(e) => updateField('code', e.target.value)}
              onBlur={trimFieldOnBlur('code')}
              placeholder="WH-01"
              disabled={saving}
              autoComplete="off"
              className={`${inputBase} ${inputBorder} ${inputPaddingWithIcon} font-mono tabular-nums`}
            />
          </div>
        </div>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="location-description" className={labelBase}>
          Description
        </label>
        <div className="relative">
          <FileText
            className="absolute left-3 top-3 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none"
            aria-hidden="true"
          />
          <textarea
            id="location-description"
            value={form.description || ''}
            onChange={(e) => updateField('description', e.target.value)}
            rows={2}
            placeholder="Optional description"
            disabled={saving}
            className={`${inputBase} ${inputBorder} ${inputPaddingWithIcon} resize-none custom-scrollbar`}
          />
        </div>
      </div>

      {/* Address + Phone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="location-address" className={labelBase}>
            Address
          </label>
          <input
            id="location-address"
            type="text"
            value={form.address || ''}
            onChange={(e) => updateField('address', e.target.value)}
            placeholder="Street, city"
            disabled={saving}
            autoComplete="off"
            className={`${inputBase} ${inputBorder} ${inputPadding}`}
          />
        </div>
        <div>
          <label htmlFor="location-phone" className={labelBase}>
            Phone
          </label>
          <div className="relative">
            <Phone className={iconBase} aria-hidden="true" />
            <input
              id="location-phone"
              type="tel"
              value={form.phone || ''}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder="+1 555 0100"
              disabled={saving}
              autoComplete="off"
              className={`${inputBase} ${inputBorder} ${inputPaddingWithIcon} tabular-nums`}
            />
          </div>
        </div>
      </div>

      {/* Default toggle */}
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
        <input
          type="checkbox"
          checked={!!form.isDefault}
          onChange={(e) => updateField('isDefault', e.target.checked)}
          disabled={saving}
          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-2 focus:ring-brand-500 focus:ring-offset-0 transition duration-250 disabled:opacity-50"
        />
        Set as default location for this business unit
      </label>

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 btn-secondary disabled:opacity-50"
        >
          <X className="w-4 h-4" aria-hidden="true" />
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 btn-brand disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader2
                className="w-4 h-4 animate-spin"
                aria-hidden="true"
              />
              Saving…
            </>
          ) : (
            <>
              <Save className="w-4 h-4" aria-hidden="true" />
              {mode === 'edit' ? 'Update' : 'Create'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export default LocationForm;
