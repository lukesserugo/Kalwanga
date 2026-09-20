'use client';

// packages/web/components/locations/LocationSelector.tsx

import React, { useState, useEffect, useMemo, useId } from 'react';
import { MapPin, ChevronDown, Loader2 } from 'lucide-react';
import {
  locationService,
  LOCATION_TYPE_LABELS,
  type Location,
} from '../../services/locationService';

interface LocationSelectorProps {
  businessUnitId: string;
  value: string;
  onChange: (name: string, location: Location | null) => void;
  allowCustom?: boolean;
  onAddNew?: () => void;
  disabled?: boolean;
  required?: boolean;
  /** Optional id so callers can pair this with a <label htmlFor>. */
  id?: string;
  /** Optional name attribute for native form submission. */
  name?: string;
}

export function LocationSelector({
  businessUnitId,
  value,
  onChange,
  allowCustom = true,
  onAddNew,
  disabled = false,
  required = false,
  id,
  name,
}: LocationSelectorProps) {
  const reactId = useId();
  const selectId = id ?? `location-selector-${reactId}`;

  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState('');

  // Load locations for the BU. Cancellation guard prevents setState after unmount.
  useEffect(() => {
    if (!businessUnitId) {
      setLocations([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    locationService
      .list(businessUnitId)
      .then((list) => {
        if (!cancelled) setLocations(list);
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn('❌ LocationSelector: failed to load locations', err);
          setLocations([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [businessUnitId]);

  // ✅ Whenever the parent's `value` changes from the outside, discard any
  // stale text in the hidden custom input so re-opening custom mode starts
  // fresh (or seeds with the current value if it's a custom one).
  useEffect(() => {
    if (isCustomMode) return;
    setCustomValue('');
  }, [value, isCustomMode]);

  const currentSelected = useMemo(
    () => locations.find((l) => l.name === value),
    [locations, value]
  );

  // ✅ A value that doesn't match any loaded location is treated as custom —
  // shown as a hint below the select so the user knows it's been accepted.
  const isCustomValue =
    !!value && !currentSelected && value !== '__custom__' && value !== '__add_new__';

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;

    if (v === '__custom__') {
      setIsCustomMode(true);
      setCustomValue(value || '');
      return;
    }
    if (v === '__add_new__') {
      onAddNew?.();
      return;
    }

    const match = locations.find((l) => l.name === v);
    onChange(v, match ?? null);
  };

  const commitCustom = () => {
    const trimmed = customValue.trim();
    if (!trimmed) return;
    onChange(trimmed, null);
    setIsCustomMode(false);
    setCustomValue('');
  };

  const cancelCustom = () => {
    setIsCustomMode(false);
    setCustomValue('');
  };

  if (isCustomMode) {
    return (
      <div className="flex gap-2">
        <input
          type="text"
          value={customValue}
          onChange={(e) => setCustomValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitCustom();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cancelCustom();
            }
          }}
          placeholder="Enter custom location name"
          disabled={disabled}
          autoFocus
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={commitCustom}
          disabled={disabled || !customValue.trim()}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Set
        </button>
        <button
          type="button"
          onClick={cancelCustom}
          disabled={disabled}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <select
          id={selectId}
          name={name}
          value={value}
          onChange={handleSelectChange}
          disabled={disabled || loading}
          required={required}
          className="w-full px-3 py-2 pr-9 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 appearance-none"
        >
          <option value="">
            {loading ? 'Loading locations...' : 'Select a location'}
          </option>

          {locations.map((loc) => (
            <option key={loc.id} value={loc.name}>
              {loc.name}
              {loc.isDefault ? ' (default)' : ''}
            </option>
          ))}

          {allowCustom && (
            <option value="__custom__">+ Enter custom location…</option>
          )}
          {onAddNew && (
            <option value="__add_new__">+ Add new location…</option>
          )}
        </select>

        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* Hint line — shows type/code when the value matches a known location. */}
      {currentSelected && (
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          {currentSelected.type
            ? LOCATION_TYPE_LABELS[currentSelected.type] ?? currentSelected.type
            : 'Other'}
          {currentSelected.code && (
            <span className="font-mono">• {currentSelected.code}</span>
          )}
        </p>
      )}

      {/* ✅ Hint line — reassures the user when a free-form value is in play. */}
      {isCustomValue && (
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          Custom location: <span className="font-mono">{value}</span>
        </p>
      )}
    </div>
  );
}

export default LocationSelector;
