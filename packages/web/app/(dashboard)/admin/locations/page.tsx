// packages/web/app/(dashboard)/admin/locations/page.tsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Plus, Edit, Trash2, Loader2, X, Save,
  AlertCircle, CheckCircle, Building2, Star, Lock,
  Search, Hash, Phone, FileText, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useAuth } from '../../../../hooks/useAuth';
import { usePermission } from '../../../../hooks/usePermission';
import {
  locationService,
  Location,
  LOCATION_TYPES,
  LOCATION_TYPE_LABELS, // ✅ NEW — sibling map for human-readable labels
} from '../../../../services/locationService';
import { toast } from '../../../../utils/toast-manager';

interface BusinessUnitOption {
  id: string;
  name: string;
  code: string;
  isActive?: boolean;
}

interface LocationFormData {
  name: string;
  code: string;
  type: string;
  description: string;
  address: string;
  phone: string;
  isDefault: boolean;
}

const emptyForm: LocationFormData = {
  name: '',
  code: '',
  type: 'STORE',
  description: '',
  address: '',
  phone: '',
  isDefault: false,
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

export default function LocationsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { isLoading: permLoading, isSuperAdmin } = usePermission();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnitOption[]>([]);
  const [selectedBUId, setSelectedBUId] = useState<string>('');
  const [loadingBUs, setLoadingBUs] = useState(true);
  const [showBUDropdown, setShowBUDropdown] = useState(false);
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [form, setForm] = useState<LocationFormData>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Location | null>(null);
  const [deleting, setDeleting] = useState(false);

  const booting = authLoading || permLoading;

  // ────────────────────────────────────────────────────────────
  // Load business units from localStorage (already populated by
  // usePermission / other pages).
  // ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (booting) return;
    if (!isAuthenticated) return;

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

          if (preferred) {
            setSelectedBUId(preferred.id);
            try {
              localStorage.setItem('selectedBusinessUnitId', preferred.id);
            } catch {
              /* ignore */
            }
          }
        }
      }
    } catch (err) {
      console.warn('Failed to read businessUnits from localStorage:', err);
    } finally {
      setLoadingBUs(false);
    }
  }, [booting, isAuthenticated]);

  // ────────────────────────────────────────────────────────────
  // Load locations whenever the selected BU changes.
  // ────────────────────────────────────────────────────────────
  const loadLocations = useCallback(
    async (buId: string) => {
      if (!isValidBU(buId)) {
        setLocations([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const list = await locationService.list(buId);
        setLocations(list);
      } catch (err) {
        console.error('Failed to load locations:', err);
        toast.error('Failed to load locations');
        setLocations([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (booting) return;
    if (!isAuthenticated) return;
    if (!isValidBU(selectedBUId)) return;
    loadLocations(selectedBUId);
  }, [booting, isAuthenticated, selectedBUId, loadLocations]);

  // ────────────────────────────────────────────────────────────
  // Form handlers
  // ────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (loc: Location) => {
    setEditing(loc);
    setForm({
      name: loc.name,
      code: loc.code || '',
      type: loc.type || 'STORE',
      description: loc.description || '',
      address: loc.address || '',
      phone: loc.phone || '',
      isDefault: !!loc.isDefault,
    });
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
  };

  const handleSave = async () => {
    if (!isValidBU(selectedBUId)) {
      setFormError('Please select a business unit');
      return;
    }
    if (!form.name.trim()) {
      setFormError('Name is required');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await locationService.update(
          editing.id,
          {
            name: form.name.trim(),
            code: form.code.trim() || undefined,
            type: form.type,
            description: form.description.trim() || undefined,
            address: form.address.trim() || undefined,
            phone: form.phone.trim() || undefined,
            isDefault: form.isDefault,
          },
          selectedBUId
        );
        toast.success('Location updated');
      } else {
        await locationService.create(
          {
            name: form.name.trim(),
            code: form.code.trim() || undefined,
            type: form.type,
            description: form.description.trim() || undefined,
            address: form.address.trim() || undefined,
            phone: form.phone.trim() || undefined,
            isDefault: form.isDefault,
          },
          selectedBUId
        );
        toast.success('Location created');
      }
      closeForm();
      await loadLocations(selectedBUId);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to save location';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !isValidBU(selectedBUId)) return;
    setDeleting(true);
    try {
      await locationService.remove(deleteTarget.id, selectedBUId);
      toast.success('Location deleted');
      setDeleteTarget(null);
      await loadLocations(selectedBUId);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to delete location';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const filteredLocations = locations.filter((l) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      l.name.toLowerCase().includes(q) ||
      (l.code || '').toLowerCase().includes(q)
    );
  });

  const selectedBU = businessUnits.find((bu) => bu.id === selectedBUId);

  // ────────────────────────────────────────────────────────────
  // Gates
  // ────────────────────────────────────────────────────────────
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
            <Lock className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
            Please Login
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            You need to be logged in to manage locations.
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

  // ────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-6 h-6 text-brand-500" />
            Locations
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage physical storage locations for each business unit
          </p>
        </div>
        <button
          onClick={openCreate}
          disabled={!isValidBU(selectedBUId)}
          className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
        >
          <Plus className="w-4 h-4" />
          Add Location
        </button>
      </div>

      {/* BU SELECTOR + SEARCH */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowBUDropdown(!showBUDropdown)}
            disabled={loadingBUs || businessUnits.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors min-w-[200px] disabled:opacity-50 focus-ring"
          >
            <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1 text-left">
              {selectedBU?.name || 'Select Business Unit'}
            </span>
            {showBUDropdown ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {showBUDropdown && (
            <div className="absolute z-header mt-1 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto sidebar-scroll">
              {businessUnits.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  No business units available
                </div>
              ) : (
                businessUnits.map((bu) => (
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
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search locations..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* LIST */}
      {loading ? (
        <div className="card-brand p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600 mx-auto" />
          <p className="mt-2 text-sm text-gray-500">Loading locations...</p>
        </div>
      ) : !isValidBU(selectedBUId) ? (
        <div className="bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-xl p-6 text-center">
          <AlertCircle className="w-10 h-10 text-warning-500 mx-auto mb-2" />
          <p className="text-sm text-warning-700 dark:text-warning-300">
            Please select a business unit to view its locations.
          </p>
        </div>
      ) : filteredLocations.length === 0 ? (
        <div className="card-brand p-12 text-center">
          <MapPin className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            No locations yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {search
              ? 'No locations match your search.'
              : 'Add your first location to organize inventory.'}
          </p>
          {!search && (
            <button
              onClick={openCreate}
              className="mt-4 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors inline-flex items-center gap-2 focus-ring"
            >
              <Plus className="w-4 h-4" />
              Add Location
            </button>
          )}
        </div>
      ) : (
        <div className="card-brand p-0 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                  Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredLocations.map((loc) => (
                <tr
                  key={loc.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="font-medium text-gray-900 dark:text-white">
                        {loc.name}
                      </span>
                      {loc.isDefault && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300">
                          <Star className="w-3 h-3" />
                          Default
                        </span>
                      )}
                    </div>
                    {loc.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 ml-6">
                        {loc.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 hidden md:table-cell">
                    {/* ✅ human-readable label instead of raw enum */}
                    {loc.type
                      ? LOCATION_TYPE_LABELS[loc.type] ?? loc.type
                      : 'OTHER'}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-300 hidden lg:table-cell">
                    {loc.code || '—'}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {loc.isActive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300">
                        <CheckCircle className="w-3 h-3" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(loc)}
                        className="p-1.5 hover:bg-brand-100 dark:hover:bg-brand-900/30 rounded transition-colors focus-ring"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4 text-brand-500" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(loc)}
                        className="p-1.5 hover:bg-danger-100 dark:hover:bg-danger-900/30 rounded transition-colors focus-ring"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-danger-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE/EDIT FORM MODAL */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={closeForm}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {editing ? 'Edit Location' : 'New Location'}
                </h3>
                <button
                  onClick={closeForm}
                  disabled={saving}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {formError && (
                <div className="mb-4 p-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-danger-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-danger-700 dark:text-danger-300">
                    {formError}
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name <span className="text-danger-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="e.g. Main Warehouse"
                    disabled={saving}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Type
                    </label>
                    <select
                      value={form.type}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, type: e.target.value }))
                      }
                      disabled={saving}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
                    >
                      {/*
                        ✅ LOCATION_TYPES is a string[] of raw enum values.
                        Labels come from the sibling LOCATION_TYPE_LABELS map.
                        Fallback to the raw enum name if a label is missing.
                      */}
                      {LOCATION_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {LOCATION_TYPE_LABELS[t] ?? t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Code
                    </label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={form.code}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, code: e.target.value }))
                        }
                        placeholder="WH-01"
                        disabled={saving}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <textarea
                      value={form.description}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          description: e.target.value,
                        }))
                      }
                      rows={2}
                      placeholder="Optional description"
                      disabled={saving}
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Address
                    </label>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, address: e.target.value }))
                      }
                      disabled={saving}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Phone
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={form.phone}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, phone: e.target.value }))
                        }
                        disabled={saving}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        isDefault: e.target.checked,
                      }))
                    }
                    disabled={saving}
                    className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  Set as default location for this business unit
                </label>
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={closeForm}
                  disabled={saving}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 focus-ring"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.name.trim()}
                  className="flex-1 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors focus-ring"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {editing ? 'Update' : 'Create'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => !deleting && setDeleteTarget(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-danger-100 dark:bg-danger-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-danger-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  Delete Location
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Delete{' '}
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    "{deleteTarget.name}"
                  </span>
                  ? This cannot be undone. Inventory rows must be moved to
                  another location first.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteTarget(null)}
                    disabled={deleting}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 focus-ring"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 px-4 py-2 bg-danger-600 text-white rounded-lg hover:bg-danger-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors focus-ring"
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
