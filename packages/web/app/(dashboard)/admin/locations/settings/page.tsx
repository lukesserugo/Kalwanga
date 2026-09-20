'use client';

// packages/web/app/(dashboard)/admin/locations/settings/page.tsx

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  MapPin,
  Save,
  Settings2,
  Shield,
  Star,
  Truck,
  Warehouse,
  AlertCircle,
} from 'lucide-react';

import { useAuth } from '../../../../../hooks/useAuth';
import { usePermission } from '../../../../../hooks/usePermission';
import { toast } from '../../../../../utils/toast-manager';
import {
  locationService,
  LOCATION_TYPES,
  LOCATION_TYPE_LABELS,
  type Location,
  type LocationType,
} from '../../../../../services/locationService';

// ============================================
// TYPES
// ============================================

interface LocationSettings {
  /** Location id that new forms should pre-select. */
  defaultLocationId: string | null;

  /** Which LocationType values appear in dropdowns across the app. */
  enabledTypes: LocationType[];

  // ─── Stock allocation ────────────────────────────────
  allowNegativeStock: boolean;
  reserveStockOnAdd: boolean;
  defaultReorderPoint: number;
  defaultReorderQuantity: number;

  // ─── Transfers ───────────────────────────────────────
  requireTransferReference: boolean;
  autoReceiveTransfers: boolean;
  allowCrossBusinessUnitTransfers: boolean;

  // ─── Display ─────────────────────────────────────────
  showCodeOnCards: boolean;
  showInactiveInLists: boolean;
}

interface BusinessUnitOption {
  id: string;
  name: string;
  code: string;
  isActive?: boolean;
}

const STORAGE_KEY = 'locationSettings';

const DEFAULT_SETTINGS: LocationSettings = {
  defaultLocationId: null,
  enabledTypes: [...LOCATION_TYPES],
  allowNegativeStock: false,
  reserveStockOnAdd: true,
  defaultReorderPoint: 5,
  defaultReorderQuantity: 10,
  requireTransferReference: false,
  autoReceiveTransfers: false,
  allowCrossBusinessUnitTransfers: false,
  showCodeOnCards: true,
  showInactiveInLists: false,
};

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

// ============================================
// SECTION COMPONENT
// ============================================

interface SectionProps {
  title: string;
  description: string;
  icon: React.ElementType;
  children: React.ReactNode;
}

function Section({ title, description, icon: Icon, children }: SectionProps) {
  return (
    <section className="card-brand p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4.5 h-4.5 text-brand-600 dark:text-brand-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {description}
          </p>
        </div>
      </div>
      <div className="space-y-4 pl-12">{children}</div>
    </section>
  );
}

// ============================================
// TOGGLE COMPONENT
// ============================================

interface ToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: ToggleRowProps) {
  return (
    <label
      className={`flex items-start justify-between gap-4 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </p>
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed ${
          checked
            ? 'bg-brand-600'
            : 'bg-gray-200 dark:bg-gray-600'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4.5' : 'translate-x-1'
          }`}
        />
      </button>
    </label>
  );
}

// ============================================
// PAGE
// ============================================

export default function LocationSettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { isLoading: permLoading } = usePermission();

  const booting = authLoading || permLoading;

  // ---- state ----
  const [settings, setSettings] = useState<LocationSettings>(DEFAULT_SETTINGS);
  const [locations, setLocations] = useState<Location[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnitOption[]>([]);
  const [selectedBUId, setSelectedBUId] = useState<string>('');
  const [showBUDropdown, setShowBUDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ---- load business units ----
  useEffect(() => {
    if (booting || !isAuthenticated) return;

    try {
      const stored = localStorage.getItem('businessUnits');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const mapped: BusinessUnitOption[] = parsed
            .filter((bu: any) => isValidBU(bu?.id))
            .map((bu: any) => ({
              id: bu.id,
              name: bu.name || 'Unnamed',
              code: bu.code || '',
              isActive: bu.isActive !== false,
            }));
          setBusinessUnits(mapped);

          const storedId =
            localStorage.getItem('selectedBusinessUnitId') ||
            localStorage.getItem('businessUnitId');
          const preferred =
            (storedId && mapped.find((u) => u.id === storedId)) ||
            mapped.find((u) => u.isActive !== false) ||
            mapped[0];
          if (preferred) setSelectedBUId(preferred.id);
        }
      }
    } catch (err) {
      console.warn('Failed to read businessUnits from localStorage:', err);
    }
  }, [booting, isAuthenticated]);

  // ---- load settings + locations for the selected BU ----
  const loadSettings = useCallback(async (buId: string) => {
    if (!isValidBU(buId)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Load locations for the BU (used for the "default location" picker).
      const list = await locationService.list(buId);
      setLocations(list.filter((l) => l.isActive && !l.deletedAt));

      // Load settings from localStorage, scoped per BU.
      // TODO: swap this block for `await api.get('/locations/settings?businessUnitId=…')`
      const stored = localStorage.getItem(`${STORAGE_KEY}:${buId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({
          ...DEFAULT_SETTINGS,
          ...parsed,
          // Guard against stale enabledTypes that no longer exist in the enum.
          enabledTypes: Array.isArray(parsed.enabledTypes)
            ? parsed.enabledTypes.filter((t: string) =>
                (LOCATION_TYPES as readonly string[]).includes(t)
              )
            : [...LOCATION_TYPES],
        });
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
    } catch (err) {
      console.error('Failed to load location settings:', err);
      toast.error('Failed to load settings');
      setLocations([]);
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (booting || !isAuthenticated) return;
    if (!isValidBU(selectedBUId)) {
      setLoading(false);
      return;
    }
    loadSettings(selectedBUId);
  }, [booting, isAuthenticated, selectedBUId, loadSettings]);

  // ---- handlers ----
  const patch = <K extends keyof LocationSettings>(
    key: K,
    value: LocationSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const toggleType = (type: LocationType) => {
    setSettings((prev) => {
      const has = prev.enabledTypes.includes(type);
      // Never allow zero enabled types — the location form would have an
      // empty dropdown. Require at least one.
      if (has && prev.enabledTypes.length === 1) {
        toast.error('At least one location type must remain enabled');
        return prev;
      }
      return {
        ...prev,
        enabledTypes: has
          ? prev.enabledTypes.filter((t) => t !== type)
          : [...prev.enabledTypes, type],
      };
    });
  };

  const handleSave = async () => {
    if (!isValidBU(selectedBUId)) {
      toast.error('Select a business unit first');
      return;
    }

    setSaving(true);
    try {
      // TODO: swap for `await api.put('/locations/settings', { businessUnitId, ...settings })`
      localStorage.setItem(
        `${STORAGE_KEY}:${selectedBUId}`,
        JSON.stringify(settings)
      );
      toast.success('Location settings saved');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    toast.success('Reset to defaults (not saved yet)');
  };

  const selectedBU = useMemo(
    () => businessUnits.find((bu) => bu.id === selectedBUId),
    [businessUnits, selectedBUId]
  );

  const defaultLocation = useMemo(
    () => locations.find((l) => l.id === settings.defaultLocationId),
    [locations, settings.defaultLocationId]
  );

  // ============================================
  // GATES
  // ============================================

  if (booting) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
            Please Login
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            You need to be logged in to manage settings.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="mt-4 px-6 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors focus-ring"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/admin/locations')}
            className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
            aria-label="Back to locations"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Settings2 className="w-6 h-6 text-brand-500" />
              Location Settings
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Configure how locations behave across inventory, transfers, and forms.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 focus-ring"
          >
            Reset to defaults
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !isValidBU(selectedBUId) || loading}
            className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 transition-colors focus-ring"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* BU selector */}
      <div className="card-brand p-4">
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
          Business unit
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowBUDropdown((v) => !v)}
            disabled={businessUnits.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors min-w-[240px] disabled:opacity-50 focus-ring"
          >
            <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1 text-left">
              {selectedBU?.name || 'Select business unit'}
            </span>
            {showBUDropdown ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {showBUDropdown && businessUnits.length > 0 && (
            <div className="absolute z-header mt-1 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto sidebar-scroll">
              {businessUnits.map((bu) => (
                <button
                  key={bu.id}
                  type="button"
                  onClick={() => {
                    setSelectedBUId(bu.id);
                    setShowBUDropdown(false);
                    try {
                      localStorage.setItem('selectedBusinessUnitId', bu.id);
                    } catch {
                      /* ignore */
                    }
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring ${
                    bu.id === selectedBUId
                      ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <span className="font-medium">{bu.name}</span>
                  {bu.code && (
                    <span className="text-xs text-gray-400 ml-2">
                      ({bu.code})
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Settings are scoped per business unit. Switching units loads its saved values.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* ─── Default location ───────────────────────────────── */}
          <Section
            title="Default location"
            description="Pre-selected on inventory, transfer, and receipt forms for this business unit."
            icon={Star}
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Default location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={settings.defaultLocationId ?? ''}
                  onChange={(e) =>
                    patch('defaultLocationId', e.target.value || null)
                  }
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">None — leave forms unselected</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                      {loc.isDefault ? ' (currently marked default)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              {defaultLocation && (
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  {LOCATION_TYPE_LABELS[defaultLocation.type] ?? defaultLocation.type}
                  {defaultLocation.code && ` • ${defaultLocation.code}`}
                </p>
              )}
              {locations.length === 0 && (
                <p className="mt-1.5 text-xs text-warning-600 dark:text-warning-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  No active locations yet — add one on the Locations page first.
                </p>
              )}
            </div>
          </Section>

          {/* ─── Enabled types ──────────────────────────────────── */}
          <Section
            title="Location types in use"
            description="Only enabled types appear in dropdowns across the app. Disable types your business doesn't use."
            icon={Warehouse}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {LOCATION_TYPES.map((type) => {
                const enabled = settings.enabledTypes.includes(type);
                const isOnlyOne =
                  enabled && settings.enabledTypes.length === 1;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleType(type)}
                    title={
                      isOnlyOne
                        ? 'At least one type must remain enabled'
                        : enabled
                        ? 'Click to disable'
                        : 'Click to enable'
                    }
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors focus-ring ${
                      enabled
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                        enabled
                          ? 'bg-brand-600 border-brand-600'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {enabled && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </span>
                    <span className="truncate">
                      {LOCATION_TYPE_LABELS[type] ?? type}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
              {settings.enabledTypes.length} of {LOCATION_TYPES.length} types enabled
            </p>
          </Section>

          {/* ─── Stock allocation ───────────────────────────────── */}
          <Section
            title="Stock allocation"
            description="How inventory quantities are tracked and reserved at each location."
            icon={Warehouse}
          >
            <ToggleRow
              label="Allow negative stock"
              description="Permit sales even when the location's quantity drops below zero. Useful for backorder workflows."
              checked={settings.allowNegativeStock}
              onChange={(v) => patch('allowNegativeStock', v)}
            />
            <ToggleRow
              label="Reserve stock on add-to-cart"
              description="Temporarily reserve units while they sit in a cart, so two cashiers can't sell the last item."
              checked={settings.reserveStockOnAdd}
              onChange={(v) => patch('reserveStockOnAdd', v)}
            />
            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Default reorder point
                </label>
                <input
                  type="number"
                  min={0}
                  value={settings.defaultReorderPoint}
                  onChange={(e) =>
                    patch(
                      'defaultReorderPoint',
                      Math.max(0, parseInt(e.target.value, 10) || 0)
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 tabular-nums"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Applied to new inventory rows. Existing rows keep their own value.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Default reorder quantity
                </label>
                <input
                  type="number"
                  min={1}
                  value={settings.defaultReorderQuantity}
                  onChange={(e) =>
                    patch(
                      'defaultReorderQuantity',
                      Math.max(1, parseInt(e.target.value, 10) || 1)
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 tabular-nums"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Suggested order size when the reorder point is hit.
                </p>
              </div>
            </div>
          </Section>

          {/* ─── Transfers ──────────────────────────────────────── */}
          <Section
            title="Transfers"
            description="Rules applied when moving stock between locations."
            icon={Truck}
          >
            <ToggleRow
              label="Require a reference number"
              description="Force users to enter a reference (e.g. TRF-2024-001) on every transfer."
              checked={settings.requireTransferReference}
              onChange={(v) => patch('requireTransferReference', v)}
            />
            <ToggleRow
              label="Auto-receive on creation"
              description="Skip the pending/approval step — transfers immediately deduct from source and add to destination."
              checked={settings.autoReceiveTransfers}
              onChange={(v) => patch('autoReceiveTransfers', v)}
            />
            <ToggleRow
              label="Allow cross-business-unit transfers"
              description="Let users transfer stock to a location belonging to a different business unit. Off by default."
              checked={settings.allowCrossBusinessUnitTransfers}
              onChange={(v) => patch('allowCrossBusinessUnitTransfers', v)}
            />
          </Section>

          {/* ─── Display ────────────────────────────────────────── */}
          <Section
            title="Display"
            description="How locations appear on cards, tables, and dropdowns."
            icon={MapPin}
          >
            <ToggleRow
              label="Show code on location cards"
              description="Display the location code (e.g. WH-01) alongside the name."
              checked={settings.showCodeOnCards}
              onChange={(v) => patch('showCodeOnCards', v)}
            />
            <ToggleRow
              label="Show inactive locations in lists"
              description="Include deactivated locations in pickers and tables. Off by default to reduce noise."
              checked={settings.showInactiveInLists}
              onChange={(v) => patch('showInactiveInLists', v)}
            />
          </Section>

          {/* Save bar (bottom) */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.push('/admin/locations')}
              disabled={saving}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 focus-ring"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !isValidBU(selectedBUId)}
              className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 transition-colors focus-ring"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save changes
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
