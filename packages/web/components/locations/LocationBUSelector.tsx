'use client';

// packages/web/components/locations/LocationBUSelector.tsx

import React, { useEffect, useState } from 'react';
import { Building2, ChevronDown, ChevronUp } from 'lucide-react';

export interface BusinessUnitOption {
  id: string;
  name: string;
  code: string;
  isActive?: boolean;
}

const SENTINEL_BU_IDS = new Set([
  'default',
  'default-business-unit',
  'undefined',
  'null',
  '',
]);

function isValidBU(id?: string | null): id is string {
  return !!id && !SENTINEL_BU_IDS.has(id);
}

interface LocationBUSelectorProps {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  /** Optional override — if not provided, reads from localStorage. */
  options?: BusinessUnitOption[];
}

export function LocationBUSelector({
  value,
  onChange,
  disabled = false,
  options,
}: LocationBUSelectorProps) {
  const [businessUnits, setBusinessUnits] = useState<BusinessUnitOption[]>(
    options ?? []
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (options) {
      setBusinessUnits(options);
      return;
    }
    try {
      const stored = localStorage.getItem('businessUnits');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const mapped: BusinessUnitOption[] = parsed
            .filter((bu: any) => isValidBU(bu?.id))
            .map((bu: any) => ({
              id: bu.id,
              name: bu.name || 'Unnamed',
              code: bu.code || '',
              isActive: bu.isActive !== false,
            }));
          setBusinessUnits(mapped);
        }
      }
    } catch (err) {
      console.warn('LocationBUSelector: failed to read businessUnits', err);
    }
  }, [options]);

  const selected = businessUnits.find((bu) => bu.id === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || businessUnits.length === 0}
        className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition duration-250 min-w-[220px] disabled:opacity-50 focus-ring"
      >
        <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1 text-left">
          {selected?.name || 'Select business unit'}
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {open && businessUnits.length > 0 && (
        <div className="absolute z-modal mt-1 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-card max-h-60 overflow-y-auto custom-scrollbar animate-slide-down">
          {businessUnits.map((bu) => (
            <button
              key={bu.id}
              type="button"
              onClick={() => {
                onChange(bu.id);
                setOpen(false);
                try {
                  localStorage.setItem('selectedBusinessUnitId', bu.id);
                } catch {
                  /* ignore */
                }
              }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition duration-250 focus-ring ${
                bu.id === value
                  ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              <span className="font-medium">{bu.name}</span>
              {bu.code && (
                <span className="text-2xs font-mono tabular-nums text-gray-400 dark:text-gray-500 ml-2">
                  ({bu.code})
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { isValidBU };
export default LocationBUSelector;
