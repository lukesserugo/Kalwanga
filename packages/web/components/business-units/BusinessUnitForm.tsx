'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Save, X, Building, MapPin, Phone, Mail, Loader2 } from 'lucide-react';
import { businessUnitService, setBusinessUnitId } from '../../services/businessUnitService';
import { companyService } from '../../services/companyService';
import { toast } from '../../utils/toast-manager';
import type { BusinessUnit, BusinessUnitType } from '../../types/businessUnit';

// Add interface for props with optional id
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
}

interface FormErrors {
  name?: string;
  code?: string;
  email?: string;
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
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [companyId, setCompanyId] = useState<string>('');

  // Load company ID on mount
  useEffect(() => {
    const loadCompanyId = async () => {
      try {
        // Try to get existing company ID
        let id = companyService.getCompanyId();
        console.log('📦 Company ID from storage:', id);
        
        // If no valid company ID, try to get from localStorage
        if (!id || id === 'default-company-id' || id.length < 10) {
          // Try localStorage directly
          try {
            const storedCompany = localStorage.getItem('companyId');
            if (storedCompany && storedCompany !== 'default-company-id' && storedCompany.length >= 10) {
              id = storedCompany;
              console.log('📦 Company ID from localStorage:', id);
            }
          } catch (_e) {
            // Ignore
          }
        }
        
        // If still no valid ID, try to fetch companies
        if (!id || id === 'default-company-id' || id.length < 10) {
          try {
            const companies = await companyService.getAll();
            if (companies && companies.data && companies.data.length > 0) {
              id = companies.data[0].id;
              companyService.setCompanyId(id);
              console.log('📦 Company ID from API:', id);
            }
          } catch (fetchError) {
            console.warn('Failed to fetch companies:', fetchError);
          }
        }
        
        // If we have a valid ID, set it
        if (id && id !== 'default-company-id' && id.length >= 10) {
          setCompanyId(id);
        } else {
          console.warn('⚠️ No valid company ID found');
        }
      } catch (error) {
        console.error('Failed to load company ID:', error);
      }
    };
    
    loadCompanyId();
  }, []);

  useEffect(() => {
    if (isEdit && id) {
      loadBusinessUnit();
    }
  }, [id]);

  const loadBusinessUnit = async () => {
    try {
      setLoading(true);
      const data = await businessUnitService.getBusinessUnitById(id!);
      setFormData({
        name: data.name || '',
        code: data.code || '',
        address: data.address || null,
        phone: data.phone || null,
        email: data.email || null,
        type: ((data as any).type as BusinessUnitType) || ('STORE' as BusinessUnitType),
        isActive: data.isActive !== undefined ? data.isActive : true,
      });
    } catch (error) {
      console.error('Failed to load business unit:', error);
      toast.error('Failed to load business unit');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => {
      const newData = { ...prev };
      
      if (type === 'checkbox') {
        const checked = (e.target as HTMLInputElement).checked;
        (newData as any)[name] = checked;
      } else if (name === 'address' || name === 'phone' || name === 'email') {
        (newData as any)[name] = value.trim() || null;
      } else if (name === 'type') {
        (newData as any)[name] = value ? (value as BusinessUnitType) : undefined;
      } else {
        (newData as any)[name] = value;
      }
      
      return newData;
    });

    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    // Ensure we have a company ID for create mode
    if (!isEdit && (!companyId || companyId === 'default-company-id' || companyId.length < 10)) {
      toast.error('Company ID not available. Please select a company first.');
      console.error('❌ Invalid company ID:', companyId);
      return;
    }

    setSaving(true);

    try {
      if (isEdit && id) {
        // Build update payload with only defined values
        const updatePayload: Record<string, any> = {};
        if (formData.name) updatePayload.name = formData.name.trim();
        if (formData.code) updatePayload.code = formData.code.trim().toUpperCase();
        if (formData.address !== undefined) updatePayload.address = formData.address;
        if (formData.phone !== undefined) updatePayload.phone = formData.phone;
        if (formData.email !== undefined) updatePayload.email = formData.email;
        if (formData.type) updatePayload.type = formData.type;
        if (formData.isActive !== undefined) updatePayload.isActive = formData.isActive;

        console.log('📤 Updating business unit:', updatePayload);
        await businessUnitService.updateBusinessUnit(id, updatePayload);
        toast.success('Business unit updated successfully');
      } else {
        // Create new business unit with valid company ID
        const createPayload: Record<string, any> = {
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          companyId: companyId,
          isActive: formData.isActive !== undefined ? formData.isActive : true,
          type: formData.type || ('STORE' as BusinessUnitType),
        };
        if (formData.address) createPayload.address = formData.address;
        if (formData.phone) createPayload.phone = formData.phone;
        if (formData.email) createPayload.email = formData.email;

        console.log('📤 Creating business unit with payload:', createPayload);

        const result = await businessUnitService.createBusinessUnit(createPayload);
        console.log('✅ Business unit created:', result);
        
        // Save the new business unit ID using the standalone function
        if (result?.id && result.id !== 'default') {
          setBusinessUnitId(result.id);
          console.log('✅ Business unit ID saved to storage:', result.id);
        }
        
        toast.success('Business unit created successfully');
      }
      router.push('/admin/business-units');
    } catch (error: any) {
      console.error('Failed to save business unit:', error);
      
      // Better error handling with validation errors
      if (error?.response?.data?.errors) {
        const validationErrors = error.response.data.errors;
        validationErrors.forEach((err: any) => {
          if (err.field === 'companyId') {
            toast.error('Invalid company ID. Please refresh and try again.');
          } else {
            toast.error(err.message);
          }
        });
      } else if (error?.message?.includes('code already exists')) {
        setErrors(prev => ({ ...prev, code: 'This code is already taken' }));
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
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isEdit ? 'Edit Business Unit' : 'Create Business Unit'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {isEdit ? 'Update business unit information' : 'Add a new business location'}
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

        {/* Show company ID for debugging */}
        {!isEdit && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <span className="font-semibold">Company ID:</span> {companyId || 'Loading...'}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Business Unit Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
              <input
                id="name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 ${
                  errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="Main Store"
                required
                disabled={saving}
                autoFocus
              />
            </div>
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Business Unit Code <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 font-mono">#</span>
              <input
                id="code"
                type="text"
                name="code"
                value={formData.code}
                onChange={handleChange}
                className={`w-full pl-8 pr-4 py-2 bg-white dark:bg-gray-900 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 ${
                  errors.code ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="STORE001"
                required
                disabled={saving}
                maxLength={20}
              />
            </div>
            {errors.code ? (
              <p className="mt-1 text-sm text-red-500">{errors.code}</p>
            ) : (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Unique identifier (2-20 alphanumeric characters)
              </p>
            )}
          </div>

          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Business Unit Type
            </label>
            <div className="relative">
              <select
                id="type"
                name="type"
                value={formData.type || 'STORE'}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white appearance-none"
                disabled={saving}
              >
                <option value="HEADQUARTERS">Headquarters</option>
                <option value="BRANCH">Branch</option>
                <option value="WAREHOUSE">Warehouse</option>
                <option value="STORE">Store</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                placeholder="123 Main St, City, State"
                disabled={saving}
              />
            </div>
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                placeholder="+1 234 567 890"
                disabled={saving}
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                className={`w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 ${
                  errors.email ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="store@example.com"
                disabled={saving}
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-sm text-red-500">{errors.email}</p>
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
                <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
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
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
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
