// D:\Projects\Kalwanga\packages\web\components\business-units\BusinessUnitForm.tsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save,
  X,
  Building,
  MapPin,
  Phone,
  Mail,
  Loader2,
  Coins,
} from 'lucide-react';
import {
  businessUnitService,
  setBusinessUnitId,
} from '../../services/businessUnitService';
import { companyService } from '../../services/companyService';
import { api } from '../../services/api';
import { toast } from '../../utils/toast-manager';
import type {
  BusinessUnit,
  BusinessUnitType,
  CreateBusinessUnitDto,
  UpdateBusinessUnitDto,
} from '../../types/businessUnit';

interface BusinessUnitFormProps {
  id?: string;
}

interface FormData {
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  type?: BusinessUnitType;
  isActive?: boolean;
  /**
   * ISO 4217 settlement currency for this BU's ledger.
   *
   * Set at creation time. On edit, the field is read-only — a
   * currency change must go through the dedicated endpoint
   * (`PATCH /business-units/:id/currency`) so the dirty-record
   * check and optional conversion run. See the JSDoc on the
   * `<select>` below.
   */
  currency?: string;
}

interface FormErrors {
  name?: string;
  code?: string;
  email?: string;
  currency?: string;
}

interface SettlementCurrencyOption {
  code: string;
  name: string;
  symbol: string;
  isDefault?: boolean;
}

export function BusinessUnitForm({ id }: BusinessUnitFormProps) {
  const router = useRouter();
  const isEdit = !!id;

  const [formData, setFormData] = useState<FormData>({
    name: '',
    code: '',
    address: null,
    phone: null,
    email: null,
    type: 'STORE' as BusinessUnitType,
    isActive: true,
    currency: undefined,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [companyId, setCompanyId] = useState<string>('');

  // Settlement currencies — populated from `GET /currencies/settlement`.
  // The backend already filters to `settlementAllowed: true`, so this
  // list is exactly the set a BU may use as its ledger currency.
  const [currencies, setCurrencies] = useState<SettlementCurrencyOption[]>(
    [],
  );
  const [currenciesLoading, setCurrenciesLoading] = useState(true);
  const [currenciesError, setCurrenciesError] = useState<string | null>(null);

  // ── Load the settlement-currency list once ────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setCurrenciesLoading(true);
        setCurrenciesError(null);

        const response = await api.get<any>('/currencies/settlement');

        // The `api` wrapper may unwrap the `{ success, data }` envelope
        // or return the full body. Normalize both shapes.
        const list: SettlementCurrencyOption[] = Array.isArray(response)
          ? response
          : Array.isArray((response as any)?.data)
            ? (response as any).data
            : Array.isArray((response as any)?.data?.data)
              ? (response as any).data.data
              : [];

        if (!cancelled) setCurrencies(list);
      } catch (err: any) {
        if (cancelled) return;
        console.warn('Failed to load settlement currencies:', err);
        setCurrenciesError(
          err?.response?.data?.message ||
            err?.message ||
            'Failed to load currencies',
        );
      } finally {
        if (!cancelled) setCurrenciesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Load company id ───────────────────────────────────────────
  useEffect(() => {
    const loadCompanyId = async () => {
      try {
        let cid = companyService.getCompanyId();
        console.log('📦 Company ID from storage:', cid);

        if (!cid || cid === 'default-company-id' || cid.length < 10) {
          try {
            const storedCompany = localStorage.getItem('companyId');
            if (
              storedCompany &&
              storedCompany !== 'default-company-id' &&
              storedCompany.length >= 10
            ) {
              cid = storedCompany;
              console.log('📦 Company ID from localStorage:', cid);
            }
          } catch (_e) {
            /* ignore */
          }
        }

        if (!cid || cid === 'default-company-id' || cid.length < 10) {
          try {
            const companies = await companyService.getAll();
            if (companies && companies.data && companies.data.length > 0) {
              cid = companies.data[0].id;
              companyService.setCompanyId(cid);
              console.log('📦 Company ID from API:', cid);
            }
          } catch (fetchError) {
            console.warn('Failed to fetch companies:', fetchError);
          }
        }

        if (cid && cid !== 'default-company-id' && cid.length >= 10) {
          setCompanyId(cid);
        } else {
          console.warn('⚠️ No valid company ID found');
        }
      } catch (error) {
        console.error('Failed to load company ID:', error);
      }
    };

    loadCompanyId();
  }, []);

  // ── Load business unit for edit ───────────────────────────────
  const loadBusinessUnit = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await businessUnitService.getBusinessUnitById(id);
      setFormData({
        name: data.name || '',
        code: data.code || '',
        address: data.address || null,
        phone: data.phone || null,
        email: data.email || null,
        type:
          ((data as any).type as BusinessUnitType) ||
          ('STORE' as BusinessUnitType),
        isActive: data.isActive !== undefined ? data.isActive : true,
        // Read the current currency from the response. The backend
        // always resolves and returns it via the registry walk.
        currency: (data as any).currency ?? undefined,
      });
    } catch (error) {
      console.error('Failed to load business unit:', error);
      toast.error('Failed to load business unit');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isEdit && id) {
      void loadBusinessUnit();
    }
  }, [isEdit, id, loadBusinessUnit]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;

    setFormData((prev) => {
      const newData = { ...prev };

      if (type === 'checkbox') {
        const checked = (e.target as HTMLInputElement).checked;
        (newData as any)[name] = checked;
      } else if (name === 'address' || name === 'phone' || name === 'email') {
        (newData as any)[name] = value.trim() || null;
      } else if (name === 'type') {
        (newData as any)[name] = value ? (value as BusinessUnitType) : undefined;
      } else if (name === 'currency') {
        (newData as any)[name] = value || undefined;
      } else {
        (newData as any)[name] = value;
      }

      return newData;
    });

    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Business unit name is required';
    }

    if (!formData.code.trim()) {
      newErrors.code = 'Business unit code is required';
    } else if (!/^[A-Z0-9]{2,20}$/i.test(formData.code.trim())) {
      newErrors.code = 'Code must be 2-20 alphanumeric characters';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // On create, currency is required — the admin must make an
    // explicit choice rather than silently accepting the platform
    // default. On edit, the field is read-only and cannot fail.
    if (!isEdit && !formData.currency) {
      newErrors.currency = 'Please select a settlement currency';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    if (
      !isEdit &&
      (!companyId || companyId === 'default-company-id' || companyId.length < 10)
    ) {
      toast.error('Company ID not available. Please select a company first.');
      console.error('❌ Invalid company ID:', companyId);
      return;
    }

    setSaving(true);

    try {
      if (isEdit && id) {
        // ⚠ Do NOT send `currency` on update. A currency change must
        //   go through `PATCH /business-units/:id/currency`, which
        //   runs the dirty-record check and offers the conversion
        //   path. The generic PUT would either silently succeed
        //   (clean BU) or 409 with no UI to collect a conversion
        //   rate. The form's currency field is disabled on edit; if
        //   it somehow contains a different value, we drop it.
        const updatePayload: UpdateBusinessUnitDto = {
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          address: formData.address,
          phone: formData.phone,
          email: formData.email,
          type: formData.type,
          isActive: formData.isActive !== undefined ? formData.isActive : true,
        };

        console.log('📤 Updating business unit:', updatePayload);
        await businessUnitService.updateBusinessUnit(id, updatePayload);
        toast.success('Business unit updated successfully');
      } else {
        const createPayload: CreateBusinessUnitDto = {
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          companyId: companyId,
          address: formData.address,
          phone: formData.phone,
          email: formData.email,
          isActive: formData.isActive !== undefined ? formData.isActive : true,
          type: formData.type || ('STORE' as BusinessUnitType),
          // The backend validates this against `settlementAllowed`
          // and rejects unknown or display-only codes with a 400.
          currency: formData.currency,
        };

        console.log('📤 Creating business unit with payload:', createPayload);

        const result = await businessUnitService.createBusinessUnit(
          createPayload
        );
        console.log('✅ Business unit created:', result);

        if (result?.id && result.id !== 'default') {
          setBusinessUnitId(result.id);
          console.log('✅ Business unit ID saved to storage:', result.id);
        }

        toast.success('Business unit created successfully');
      }
      router.push('/admin/business-units');
    } catch (error: any) {
      console.error('Failed to save business unit:', error);

      if (error?.response?.data?.errors) {
        const validationErrors = error.response.data.errors;
        validationErrors.forEach((err: any) => {
          if (err.field === 'companyId') {
            toast.error('Invalid company ID. Please refresh and try again.');
          } else if (err.field === 'currency') {
            setErrors((prev) => ({ ...prev, currency: err.message }));
            toast.error(err.message);
          } else {
            toast.error(err.message);
          }
        });
      } else if (error?.message?.includes('code already exists')) {
        setErrors((prev) => ({ ...prev, code: 'This code is already taken' }));
        toast.error('Business unit code already exists');
      } else if (error?.response?.data?.message) {
        toast.error(error.response.data.message);
      } else if (error?.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error(error?.message || 'Failed to save business unit');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (saving) return;
    router.push('/admin/business-units');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto animate-fade-in">
      <div className="card-brand">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isEdit ? 'Edit Business Unit' : 'Create Business Unit'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {isEdit
                ? 'Update business unit information'
                : 'Add a new business location'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="p-2 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
            aria-label="Close"
            disabled={saving}
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {!isEdit && (
          <div className="mb-4 p-3 bg-brand-50 dark:bg-brand-900/20 rounded-lg">
            <p className="text-sm text-brand-700 dark:text-brand-300">
              <span className="font-semibold">Company ID:</span>{' '}
              {companyId || 'Loading...'}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Business Unit Name <span className="text-danger-500">*</span>
            </label>
            <div className="relative">
              <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
              <input
                id="name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 ${
                  errors.name
                    ? 'border-danger-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="Main Store"
                required
                disabled={saving}
                autoFocus
              />
            </div>
            {errors.name && (
              <p className="mt-1 text-sm text-danger-500">{errors.name}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="code"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Business Unit Code <span className="text-danger-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 font-mono">
                #
              </span>
              <input
                id="code"
                type="text"
                name="code"
                value={formData.code}
                onChange={handleChange}
                className={`w-full pl-8 pr-4 py-2 bg-white dark:bg-gray-900 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent uppercase text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 font-mono tabular-nums ${
                  errors.code
                    ? 'border-danger-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="STORE001"
                required
                disabled={saving}
                maxLength={20}
              />
            </div>
            {errors.code ? (
              <p className="mt-1 text-sm text-danger-500">{errors.code}</p>
            ) : (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Unique identifier (2-20 alphanumeric characters)
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="type"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Business Unit Type
            </label>
            <div className="relative">
              <select
                id="type"
                name="type"
                value={formData.type || 'STORE'}
                onChange={handleChange}
                className="input-brand appearance-none"
                disabled={saving}
              >
                <option value="HEADQUARTERS">Headquarters</option>
                <option value="BRANCH">Branch</option>
                <option value="WAREHOUSE">Warehouse</option>
                <option value="STORE">Store</option>
              </select>
            </div>
          </div>

          {/* ── Settlement currency ───────────────────────────── */}
          {/*
            ⚠ On CREATE: the admin picks the ledger currency. Required
              so no BU inherits the platform default by accident.

            ⚠ On EDIT: read-only. Changing the currency of an existing
              BU goes through `/admin/settings/currency`, which runs
              the dirty-record check and, if the BU is dirty, requires
              an explicit conversion rate. The generic PUT is not the
              right endpoint for a currency change.
          */}
          <div>
            <label
              htmlFor="currency"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Settlement Currency{' '}
              {!isEdit && <span className="text-danger-500">*</span>}
            </label>
            <div className="relative">
              <Coins className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5 pointer-events-none" />
              <select
                id="currency"
                name="currency"
                value={formData.currency || ''}
                onChange={handleChange}
                className={`w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900 dark:text-white ${
                  errors.currency
                    ? 'border-danger-500'
                    : 'border-gray-300 dark:border-gray-600'
                } ${isEdit || saving ? 'opacity-60 cursor-not-allowed' : ''}`}
                disabled={saving || isEdit || currenciesLoading}
                required={!isEdit}
              >
                {currenciesLoading ? (
                  <option value="">Loading currencies…</option>
                ) : currenciesError ? (
                  <option value="">Failed to load currencies</option>
                ) : (
                  <>
                    <option value="">
                      {isEdit ? '—' : 'Select a currency…'}
                    </option>
                    {currencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.name} ({c.symbol})
                        {c.isDefault ? ' (platform default)' : ''}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
            {errors.currency ? (
              <p className="mt-1 text-sm text-danger-500">
                {errors.currency}
              </p>
            ) : isEdit ? (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                To change the currency of an existing business unit, use
                the{' '}
                <a
                  href="/admin/settings/currency"
                  className="text-brand-600 dark:text-brand-400 hover:underline"
                >
                  Currency Settings
                </a>{' '}
                page. That page runs the dirty-record check and, if
                needed, the conversion.
              </p>
            ) : (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Every sale, receipt, and report for this business unit
                will be denominated in this currency. It can be changed
                later from the Currency Settings page.
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="address"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Address
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
              <input
                id="address"
                type="text"
                name="address"
                value={formData.address || ''}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                placeholder="123 Main St, City, State"
                disabled={saving}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
              <input
                id="phone"
                type="tel"
                name="phone"
                value={formData.phone || ''}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                placeholder="+1 234 567 890"
                disabled={saving}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email || ''}
                onChange={handleChange}
                className={`w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 ${
                  errors.email
                    ? 'border-danger-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="store@example.com"
                disabled={saving}
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-sm text-danger-500">{errors.email}</p>
            )}
          </div>

          {isEdit && (
            <div className="flex items-center gap-3 pt-2">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive !== false}
                  onChange={handleChange}
                  className="sr-only peer"
                  disabled={saving}
                />
                <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
                <span className="ms-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  {formData.isActive !== false ? 'Active' : 'Inactive'}
                </span>
              </label>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleCancel}
              className="btn-secondary focus-ring disabled:opacity-50"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-brand-gradient hover:shadow-brand-lg text-white rounded-lg shadow-brand transition-all flex items-center gap-2 disabled:opacity-50 focus-ring"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isEdit ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {isEdit ? 'Update Business Unit' : 'Create Business Unit'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BusinessUnitForm;
