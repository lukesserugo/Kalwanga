// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\companies\components\CompanyForm.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save,
  X,
  Building,
  MapPin,
  Phone,
  Mail,
  Globe,
  Loader2,
  DollarSign,
  Clock,
  Briefcase,
} from 'lucide-react';
import { companyService } from '../../services/companyService';
import { toast } from '../../utils/toast-manager';

// ============================================================
// RESERVED ROUTE GUARD
// These strings are route segments, not company IDs.
// If any of them appears as the dynamic [id] param, we must
// NOT call the API — the route is invalid.
// ============================================================
const RESERVED_ROUTE_IDS = new Set([
  'settings',
  'default',
  'search',
  'email',
  'by-business-unit',
  'ensure-user',
  'bulk',
  'export',
  'activity',
  'stats',
  'business-units',
  'default-business-unit',
  'new',
  'edit',
]);

function isReservedRouteId(id: string | undefined): boolean {
  if (!id) return false;
  return RESERVED_ROUTE_IDS.has(id);
}

interface CompanyFormProps {
  id?: string;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  currency: string;
  timezone: string;
  logo: string;
  isActive: boolean;
  businessUnitName: string;
  businessUnitCode: string;
  businessUnitType: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  currency?: string;
  timezone?: string;
  businessUnitName?: string;
  businessUnitCode?: string;
}

const currencies = ['USD', 'EUR', 'GBP', 'NGN', 'KES', 'ZAR', 'GHS', 'UGX', 'TZS'];
const timezones = ['UTC', 'EST', 'PST', 'GMT', 'CET', 'EAT', 'WAT', 'CAT', 'SAST'];
const businessUnitTypes = ['HEADQUARTERS', 'BRANCH', 'WAREHOUSE', 'STORE'];

export function CompanyForm({ id }: CompanyFormProps) {
  const router = useRouter();

  // ✅ An "edit" form is only valid when we have a real, non-reserved ID
  const isEdit = !!id && !isReservedRouteId(id);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    address: '',
    taxId: '',
    currency: 'USD',
    timezone: 'UTC',
    logo: '',
    isActive: true,
    businessUnitName: 'Main Store',
    businessUnitCode: 'MAIN',
    businessUnitType: 'STORE',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (isEdit && id) {
      loadCompany();
    } else if (id && isReservedRouteId(id)) {
      // ✅ Fail fast with a clear message instead of hitting the API
      toast.error(`Invalid company ID: "${id}" is a reserved route`);
    }
  }, [id, isEdit]);

  const loadCompany = async () => {
    // ✅ Defense in depth: never call the API with a reserved word
    if (!id || isReservedRouteId(id)) {
      return;
    }

    try {
      setLoading(true);
      const data = await companyService.getById(id);
      setFormData({
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        address: data.address || '',
        taxId: data.taxId || '',
        currency: data.currency || 'USD',
        timezone: data.timezone || 'UTC',
        logo: data.logo || '',
        isActive: data.isActive !== undefined ? data.isActive : true,
        businessUnitName: data.businessUnits?.[0]?.name || 'Main Store',
        businessUnitCode: data.businessUnits?.[0]?.code || 'MAIN',
        businessUnitType: data.businessUnits?.[0]?.type || 'STORE',
      });
    } catch (error: any) {
      console.error('Failed to load company:', error);

      // ✅ If the backend says 404, redirect back to the list — the ID is bad
      if (error?.response?.status === 404) {
        toast.error('Company not found. Redirecting to companies list...');
        router.replace('/admin/companies');
        return;
      }

      toast.error(error?.message || 'Failed to load company');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;

    setFormData((prev) => {
      const newData = { ...prev };

      if (type === 'checkbox') {
        const checked = (e.target as HTMLInputElement).checked;
        (newData as any)[name] = checked;
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
      newErrors.name = 'Company name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }

    if (!formData.currency) {
      newErrors.currency = 'Currency is required';
    }

    if (!formData.timezone) {
      newErrors.timezone = 'Timezone is required';
    }

    if (!isEdit) {
      if (!formData.businessUnitName.trim()) {
        newErrors.businessUnitName = 'Business unit name is required';
      }
      if (!formData.businessUnitCode.trim()) {
        newErrors.businessUnitCode = 'Business unit code is required';
      }
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

    setSaving(true);

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim() || undefined,
        taxId: formData.taxId.trim() || undefined,
        currency: formData.currency,
        timezone: formData.timezone,
        logo: formData.logo.trim() || undefined,
        isActive: formData.isActive,
      };

      let result;
      if (isEdit && id) {
        result = await companyService.update(id, payload);
        toast.success('Company updated successfully');
      } else {
        const companyPayload = {
          ...payload,
          businessUnitName: formData.businessUnitName.trim(),
          businessUnitCode: formData.businessUnitCode.trim().toUpperCase(),
          businessUnitType: formData.businessUnitType,
        };
        result = await companyService.create(companyPayload);
        toast.success('Company created successfully with business unit');

        if (result?.id) {
          companyService.setCompanyId(result.id);

          if (result.businessUnits && result.businessUnits.length > 0) {
            const businessUnitId = result.businessUnits[0].id;
            companyService.setBusinessUnitId(businessUnitId);
          }
        }
      }

      router.push('/admin/companies');
    } catch (error: any) {
      console.error('Failed to save company:', error);

      if (error?.response?.data?.errors) {
        const validationErrors = error.response.data.errors;
        validationErrors.forEach((err: any) => {
          toast.error(err.message);
        });
      } else if (error?.message?.includes('email already exists')) {
        setErrors((prev) => ({ ...prev, email: 'This email is already taken' }));
        toast.error('Company with this email already exists');
      } else {
        toast.error(error?.message || 'Failed to save company');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (saving) return;
    router.push('/admin/companies');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isEdit ? 'Edit Company' : 'Create Company'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {isEdit
                ? 'Update company information'
                : 'Add a new company to your organization'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close"
            disabled={saving}
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Name */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Company Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
              <input
                id="name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 ${
                  errors.name
                    ? 'border-red-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="Acme Corporation"
                required
                disabled={saving}
                autoFocus
              />
            </div>
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 ${
                    errors.email
                      ? 'border-red-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="contact@company.com"
                  required
                  disabled={saving}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-500">{errors.email}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Phone Number <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 ${
                    errors.phone
                      ? 'border-red-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="+1 234 567 890"
                  required
                  disabled={saving}
                />
              </div>
              {errors.phone && (
                <p className="mt-1 text-sm text-red-500">{errors.phone}</p>
              )}
            </div>
          </div>

          {/* Address */}
          <div>
            <label
              htmlFor="address"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Address
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
              <input
                id="address"
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                placeholder="123 Main St, City, State, ZIP"
                disabled={saving}
              />
            </div>
          </div>

          {/* Tax ID */}
          <div>
            <label
              htmlFor="taxId"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Tax ID / VAT Number
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 font-mono">
                #
              </span>
              <input
                id="taxId"
                type="text"
                name="taxId"
                value={formData.taxId}
                onChange={handleChange}
                className="w-full pl-8 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                placeholder="TAX-123456"
                disabled={saving}
              />
            </div>
          </div>

          {/* Currency & Timezone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="currency"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Currency <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
                <select
                  id="currency"
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white appearance-none ${
                    errors.currency
                      ? 'border-red-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  disabled={saving}
                >
                  {currencies.map((curr) => (
                    <option key={curr} value={curr}>
                      {curr}
                    </option>
                  ))}
                </select>
              </div>
              {errors.currency && (
                <p className="mt-1 text-sm text-red-500">{errors.currency}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="timezone"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Timezone <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
                <select
                  id="timezone"
                  name="timezone"
                  value={formData.timezone}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white appearance-none ${
                    errors.timezone
                      ? 'border-red-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  disabled={saving}
                >
                  {timezones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
              {errors.timezone && (
                <p className="mt-1 text-sm text-red-500">{errors.timezone}</p>
              )}
            </div>
          </div>

          {/* Logo URL */}
          <div>
            <label
              htmlFor="logo"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Logo URL
            </label>
            <input
              id="logo"
              type="text"
              name="logo"
              value={formData.logo}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
              placeholder="https://example.com/logo.png"
              disabled={saving}
            />
          </div>

          {/* Business Unit Section - Only for new companies */}
          {!isEdit && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-4">
                <Briefcase className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Default Business Unit
                </h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  (Required)
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                A default business unit will be created for this company.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="businessUnitName"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Business Unit Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="businessUnitName"
                    type="text"
                    name="businessUnitName"
                    value={formData.businessUnitName}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 bg-white dark:bg-gray-900 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 ${
                      errors.businessUnitName
                        ? 'border-red-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="Main Store"
                    required
                    disabled={saving}
                  />
                  {errors.businessUnitName && (
                    <p className="mt-1 text-sm text-red-500">
                      {errors.businessUnitName}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="businessUnitCode"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Business Unit Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="businessUnitCode"
                    type="text"
                    name="businessUnitCode"
                    value={formData.businessUnitCode}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 bg-white dark:bg-gray-900 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 uppercase ${
                      errors.businessUnitCode
                        ? 'border-red-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="MAIN"
                    required
                    disabled={saving}
                  />
                  {errors.businessUnitCode && (
                    <p className="mt-1 text-sm text-red-500">
                      {errors.businessUnitCode}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="businessUnitType"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Business Unit Type
                  </label>
                  <select
                    id="businessUnitType"
                    name="businessUnitType"
                    value={formData.businessUnitType}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white appearance-none"
                    disabled={saving}
                  >
                    {businessUnitTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Active Status */}
          {isEdit && (
            <div className="flex items-center gap-3 pt-2">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                  className="sr-only peer"
                  disabled={saving}
                />
                <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <span className="ms-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  {formData.isActive ? 'Active' : 'Inactive'}
                </span>
              </label>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isEdit ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {isEdit ? 'Update Company' : 'Create Company'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
