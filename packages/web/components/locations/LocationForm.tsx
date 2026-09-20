'use client';

// packages/web/components/locations/LocationForm.tsx

import React, { useState, useEffect, useRef } from 'react';
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

interface LocationFormProps {
  initialValues?: Partial<CreateLocationInput>;
  onSubmit: (data: CreateLocationInput) => Promise<void> | void;
  onCancel: () => void;
  saving?: boolean;
  error?: string | null;
  mode?: 'create' | 'edit';
}

const EMPTY: CreateLocationInput = {
  name: '',
  code: '',
  type: 'STORE',
  description: '',
  address: '',
  phone: '',
  isDefault: false,
};

// Shared class strings so every input stays in lockstep.
const inputBase =
  'w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 disabled:opacity-50';
const inputBorder = 'border-gray-300 dark:border-gray-600';
const inputWithIcon = 'pl-9 pr-3';
const labelBase =
  'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const iconBase =
  'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none';

export function LocationForm({
  initialValues,
  onSubmit,
  onCancel,
  saving = false,
  error = null,
  mode = 'create',
}: LocationFormProps) {
  const [form, setForm] = useState<CreateLocationInput>({
    ...EMPTY,
    ...initialValues,
  });
  const [localError, setLocalError] = useState<string | null>(null);

  // ✅ Only re-seed when the underlying entity identity changes, not on every
  // parent render. Without this guard, an inline `initialValues={{...}}` in
  // the parent wipes unsaved keystrokes on every render.
  const seedKey = `${mode}:${initialValues?.id ?? 'new'}`;
  const lastSeedRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastSeedRef.current === seedKey) return;
    lastSeedRef.current = seedKey;
    setForm({ ...EMPTY, ...initialValues });
    setLocalError(null);
  }, [seedKey, initialValues]);

  // ✅ Clear the local error as soon as the user edits anything, so a stale
  // "Name is required" doesn't linger while they're already typing a name.
  const updateField = <K extends keyof CreateLocationInput>(
    key: K,
    value: CreateLocationInput[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (localError) setLocalError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setLocalError('Name is required');
      return;
    }
    setLocalError(null);
    await onSubmit({
      ...form,
      name: form.name.trim(),
      code: form.code?.trim() || undefined,
    });
  };

  // ✅ Normalize name/code on blur so what's stored matches what's shown.
  const trimOnBlur = (key: 'name' | 'code') => () => {
    const current = form[key];
    if (typeof current === 'string' && current !== current.trim()) {
      updateField(key, current.trim());
    }
  };

  const displayError = localError || error;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Error banner — same envelope as LocationsPage modal */}
      {displayError && (
        <div className="p-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl flex items-start gap-2 animate-slide-down">
          <AlertCircle className="w-4 h-4 text-danger-600 dark:text-danger-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-danger-700 dark:text-danger-300">
            {displayError}
          </p>
        </div>
      )}

      {/* Name */}
      <div>
        <label className={labelBase}>
          Name <span className="text-danger-500">*</span>
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
          onBlur={trimOnBlur('name')}
          placeholder="e.g. Main Warehouse"
          disabled={saving}
          autoFocus
          className={`${inputBase} ${inputBorder}`}
        />
      </div>

      {/* Type + Code */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelBase}>Type</label>
          <select
            value={form.type}
            onChange={(e) => updateField('type', e.target.value)}
            disabled={saving}
            className={`${inputBase} ${inputBorder}`}
          >
            {LOCATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {LOCATION_TYPE_LABELS[t] ?? t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelBase}>Code</label>
          <div className="relative">
            <Hash className={iconBase} />
            <input
              type="text"
              value={form.code || ''}
              onChange={(e) => updateField('code', e.target.value)}
              onBlur={trimOnBlur('code')}
              placeholder="WH-01"
              disabled={saving}
              className={`${inputBase} ${inputBorder} ${inputWithIcon} font-mono tabular-nums`}
            />
          </div>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className={labelBase}>Description</label>
        <div className="relative">
          <FileText className="absolute left-3 top-3 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
          <textarea
            value={form.description || ''}
            onChange={(e) => updateField('description', e.target.value)}
            rows={2}
            placeholder="Optional description"
            disabled={saving}
            className={`${inputBase} ${inputBorder} ${inputWithIcon} resize-none custom-scrollbar`}
          />
        </div>
      </div>

      {/* Address + Phone */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelBase}>Address</label>
          <input
            type="text"
            value={form.address || ''}
            onChange={(e) => updateField('address', e.target.value)}
            placeholder="Street, city"
            disabled={saving}
            className={`${inputBase} ${inputBorder}`}
          />
        </div>
        <div>
          <label className={labelBase}>Phone</label>
          <div className="relative">
            <Phone className={iconBase} />
            <input
              type="text"
              value={form.phone || ''}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder="+1 555 0100"
              disabled={saving}
              className={`${inputBase} ${inputBorder} ${inputWithIcon} tabular-nums`}
            />
          </div>
        </div>
      </div>

      {/* Default toggle — checkbox style matches LocationsPage */}
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
        <input
          type="checkbox"
          checked={!!form.isDefault}
          onChange={(e) => updateField('isDefault', e.target.checked)}
          disabled={saving}
          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500 transition duration-250"
        />
        Set as default location for this business unit
      </label>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 btn-secondary disabled:opacity-50"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !form.name.trim()}
          className="flex-1 btn-brand disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {mode === 'edit' ? 'Update' : 'Create'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export default LocationForm;
