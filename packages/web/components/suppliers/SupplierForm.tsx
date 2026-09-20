'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Loader2, AlertCircle } from 'lucide-react';
import {
  supplierService,
  SupplierValidationError,
} from '../../services/supplierService';
import { toast } from '../../utils/toast-manager';
import type { Supplier } from '../../types/supplier';

// ============================================
// CONSTANTS
// ============================================

const PLACEHOLDER_IDS = new Set([
  'default',
  'default-company',
  'default-company-id',
  'default-user',
  'default-user-id',
  'null',
  'undefined',
  '',
]);

// ============================================
// TYPES
// ============================================

interface SupplierFormProps {
  supplierId?: string;
  companyId: string;
  userId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface FormState {
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  paymentTerms: string;
  deliveryTerms: string;
  notes: string;
  isActive: boolean;
}

/**
 * Mirrors FormState 1:1 plus `companyId`, `userId` and `general`.
 * Because every FormState key is also a FormErrors key, any field can
 * be passed to helpers like `getInputClassName()` / `getFieldError()`
 * without further type gymnastics.
 */
interface FormErrors {
  // ---- FormState keys -------------------------------------------
  name?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  notes?: string;
  isActive?: string;
  // ---- Context keys ---------------------------------------------
  companyId?: string;
  userId?: string;
  general?: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  contactPerson: '',
  email: '',
  phone: '',
  address: '',
  taxId: '',
  paymentTerms: '',
  deliveryTerms: '',
  notes: '',
  isActive: true,
};

// ============================================
// HELPERS
// ============================================

/**
 * Returns `true` if `value` is a real, usable database ID —
 * i.e. a non-empty string that is not one of our placeholder tokens.
 */
function isRealId(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed === '') return false;
  return !PLACEHOLDER_IDS.has(trimmed.toLowerCase());
}

/**
 * Normalises a possibly-missing string to a trimmed string, defaulting
 * to `''`. Guards against `null`, `undefined`, `0`, `false`.
 */
function safeString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return String(value);
}

// ============================================
// COMPONENT
// ============================================

export function SupplierForm({
  supplierId,
  companyId,
  userId,
  onSuccess,
  onCancel,
}: SupplierFormProps) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [formData, setFormData] = useState<FormState>({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const isEdit = !!supplierId;

  // ---- Derived IDs (validated) ------------------------------------
  const hasValidCompany = useMemo(() => isRealId(companyId), [companyId]);
  const hasValidUser = useMemo(() => isRealId(userId), [userId]);

  // ============================================
  // LOAD EXISTING SUPPLIER (edit mode)
  // ============================================

  const loadSupplier = useCallback(async () => {
    if (!supplierId) return;

    try {
      setLoadingData(true);
      const data: Supplier = await supplierService.getSupplierById(
        supplierId,
        hasValidCompany ? companyId : undefined
      );

      setFormData({
        name: safeString(data.name),
        contactPerson: safeString((data as any).contactPerson),
        email: safeString((data as any).email),
        phone: safeString((data as any).phone),
        address: safeString((data as any).address),
        taxId: safeString((data as any).taxId),
        paymentTerms: safeString((data as any).paymentTerms),
        deliveryTerms: safeString((data as any).deliveryTerms),
        notes: safeString((data as any).notes),
        isActive:
          typeof (data as any).isActive === 'boolean'
            ? (data as any).isActive
            : true,
      });
      setErrors({});
      setTouched({});
    } catch (error) {
      console.error('Failed to load supplier:', error);
      toast.error('Failed to load supplier');
    } finally {
      setLoadingData(false);
    }
  }, [supplierId, companyId, hasValidCompany]);

  useEffect(() => {
    if (isEdit && supplierId) {
      loadSupplier();
    }
  }, [isEdit, supplierId, loadSupplier]);

  // ============================================
  // VALIDATION
  // ============================================

  const validateField = useCallback(
    (name: keyof FormState, value: any): string => {
      switch (name) {
        case 'name':
          if (!value || !String(value).trim()) {
            return 'Supplier name is required';
          }
          if (String(value).trim().length < 2) {
            return 'Supplier name must be at least 2 characters';
          }
          return '';
        case 'email':
          if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
            return 'Please enter a valid email address';
          }
          return '';
        case 'phone':
          if (value && !/^[\+\d\s\-\(\)]{7,20}$/.test(String(value))) {
            return 'Please enter a valid phone number';
          }
          return '';
        case 'taxId':
          if (value && String(value).length > 50) {
            return 'Tax ID must be less than 50 characters';
          }
          return '';
        case 'contactPerson':
          if (value && String(value).length > 100) {
            return 'Contact person name must be less than 100 characters';
          }
          return '';
        case 'address':
          if (value && String(value).length > 200) {
            return 'Address must be less than 200 characters';
          }
          return '';
        case 'paymentTerms':
          if (value && String(value).length > 100) {
            return 'Payment terms must be less than 100 characters';
          }
          return '';
        case 'deliveryTerms':
          if (value && String(value).length > 100) {
            return 'Delivery terms must be less than 100 characters';
          }
          return '';
        case 'notes':
          if (value && String(value).length > 1000) {
            return 'Notes must be less than 1000 characters';
          }
          return '';
        default:
          return '';
      }
    },
    []
  );

  const validateForm = useCallback((): boolean => {
    const next: FormErrors = {};
    let ok = true;

    // ---- Name -------------------------------------------------------
    const nameErr = validateField('name', formData.name);
    if (nameErr) {
      next.name = nameErr;
      ok = false;
    }

    // ---- Email ------------------------------------------------------
    const emailErr = validateField('email', formData.email);
    if (emailErr) {
      next.email = emailErr;
      ok = false;
    }

    // ---- Phone ------------------------------------------------------
    const phoneErr = validateField('phone', formData.phone);
    if (phoneErr) {
      next.phone = phoneErr;
      ok = false;
    }

    // ---- Tax ID -----------------------------------------------------
    const taxIdErr = validateField('taxId', formData.taxId);
    if (taxIdErr) {
      next.taxId = taxIdErr;
      ok = false;
    }

    // ---- Contact Person ---------------------------------------------
    const contactPersonErr = validateField(
      'contactPerson',
      formData.contactPerson
    );
    if (contactPersonErr) {
      next.contactPerson = contactPersonErr;
      ok = false;
    }

    // ---- Address ----------------------------------------------------
    const addressErr = validateField('address', formData.address);
    if (addressErr) {
      next.address = addressErr;
      ok = false;
    }

    // ---- Payment Terms ----------------------------------------------
    const paymentTermsErr = validateField(
      'paymentTerms',
      formData.paymentTerms
    );
    if (paymentTermsErr) {
      next.paymentTerms = paymentTermsErr;
      ok = false;
    }

    // ---- Delivery Terms ---------------------------------------------
    const deliveryTermsErr = validateField(
      'deliveryTerms',
      formData.deliveryTerms
    );
    if (deliveryTermsErr) {
      next.deliveryTerms = deliveryTermsErr;
      ok = false;
    }

    // ---- Notes ------------------------------------------------------
    const notesErr = validateField('notes', formData.notes);
    if (notesErr) {
      next.notes = notesErr;
      ok = false;
    }

    // ---- Company (required for create) ------------------------------
    if (!isEdit && !hasValidCompany) {
      next.companyId =
        'No valid company. Please select a company before creating a supplier.';
      next.general = next.companyId;
      ok = false;
    }

    // ---- User (required for create) ---------------------------------
    if (!isEdit && !hasValidUser) {
      next.userId = 'No valid user ID. Please log in again.';
      next.general = next.general ?? next.userId;
      ok = false;
    }

    setErrors(next);
    return ok;
  }, [formData, isEdit, hasValidCompany, hasValidUser, validateField]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type } = target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? target.checked : value,
    }));

    // Clear the error for this field as soon as the user types.
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name as keyof FormErrors];
        return next;
      });
    }

    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const handleBlur = (
    e: React.FocusEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));

    const err = validateField(name as keyof FormState, value);
    if (err) {
      setErrors((prev) => ({ ...prev, [name]: err }));
    } else {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name as keyof FormErrors];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);

    // ---- 1. Form validation -----------------------------------------
    if (!validateForm()) {
      // `errors` hasn't been committed yet — derive the first message
      // from the fresh validation snapshot directly.
      const snapshot: FormErrors = {};
      const nameErr = validateField('name', formData.name);
      if (nameErr) snapshot.name = nameErr;
      if (!isEdit && !hasValidCompany)
        snapshot.general =
          'No valid company. Please select a company before creating a supplier.';
      if (!isEdit && !hasValidUser)
        snapshot.general =
          snapshot.general ?? 'No valid user ID. Please log in again.';

      const firstError =
        snapshot.general ||
        snapshot.name ||
        Object.values(errors).find((v) => v) ||
        'Please fix all validation errors';
      toast.error(firstError);
      return;
    }

    // ---- 2. Placeholder-ID guard (belt & suspenders) ----------------
    if (!isEdit) {
      if (!isRealId(companyId)) {
        const msg =
          'No valid company. Please select a company before creating a supplier.';
        setErrors((prev) => ({ ...prev, companyId: msg, general: msg }));
        toast.error(msg);
        return;
      }
      if (!isRealId(userId)) {
        const msg = 'No valid user ID. Please log in again.';
        setErrors((prev) => ({ ...prev, userId: msg, general: msg }));
        toast.error(msg);
        return;
      }
    }

    setLoading(true);
    try {
      // ---- 3. Build a clean payload --------------------------------
      const trimmed: Record<string, unknown> = {
        name: formData.name.trim(),
      };

      const optionalStringFields: Array<keyof FormState> = [
        'contactPerson',
        'email',
        'phone',
        'address',
        'taxId',
        'paymentTerms',
        'deliveryTerms',
        'notes',
      ];

      for (const field of optionalStringFields) {
        const v = formData[field];
        if (typeof v === 'string' && v.trim()) {
          trimmed[field] = v.trim();
        }
      }

      trimmed.isActive = formData.isActive;

      if (isEdit && supplierId) {
        await supplierService.updateSupplier(supplierId, trimmed);
        toast.success('Supplier updated successfully');
      } else {
        await supplierService.createSupplier({
          ...(trimmed as any),
          companyId,
          userId: userId!,
        });
        toast.success('Supplier created successfully');
      }

      if (onSuccess) onSuccess();
      router.refresh();
    } catch (error: any) {
      console.error('Failed to save supplier:', error);

      // ---- 4. Local SupplierValidationError ------------------------
      if (error instanceof SupplierValidationError) {
        const field = (error.field as keyof FormErrors) || 'general';
        setErrors((prev) => ({ ...prev, [field]: error.message }));

        if (field === 'companyId' || field === 'userId') {
          setErrors((prev) => ({ ...prev, general: error.message }));
        }
        toast.error(error.message);
        return;
      }

      // ---- 5. Server-side errors -----------------------------------
      let message = isEdit
        ? 'Failed to update supplier'
        : 'Failed to create supplier';

      const resp = error?.response?.data;
      if (resp?.errors && Array.isArray(resp.errors)) {
        const fieldErrors: Record<string, string> = {};
        resp.errors.forEach((e: any) => {
          const f = e.field || e.path || 'general';
          fieldErrors[f] = e.message || 'Invalid value';
        });
        setErrors(fieldErrors as FormErrors);
        message = Object.values(fieldErrors)[0] || message;
      } else if (resp?.message) {
        message = resp.message;
        setErrors({ general: message });
      } else if (resp?.error) {
        message = resp.error;
        setErrors({ general: message });
      } else if (error?.message) {
        message = error.message;
        setErrors({ general: message });
      }

      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // HELPERS FOR RENDERING
  // ============================================

  const getFieldError = (field: keyof FormErrors): string | undefined => {
    if (submitAttempted || touched[field]) {
      return errors[field];
    }
    return undefined;
  };

  const getInputClassName = (field: keyof FormErrors): string => {
    const base =
      'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed';
    return getFieldError(field)
      ? `${base} border-red-500 dark:border-red-500`
      : `${base} border-gray-300 dark:border-gray-600`;
  };

  // ============================================
  // LOADING STATE
  // ============================================

  if (loadingData) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  const submitDisabled =
    loading || (!isEdit && (!hasValidCompany || !hasValidUser));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* GENERAL ERROR BANNER */}
      {errors.general && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300 flex-1">
            {errors.general}
          </p>
          <button
            type="button"
            onClick={() =>
              setErrors((prev) => {
                const next = { ...prev };
                delete next.general;
                return next;
              })
            }
            className="text-red-600 hover:text-red-800 dark:text-red-400 p-0.5"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* NAME */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Supplier Name *
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            onBlur={handleBlur}
            required
            disabled={loading}
            className={getInputClassName('name')}
            placeholder="Enter supplier name"
          />
          {getFieldError('name') && (
            <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {getFieldError('name')}
            </p>
          )}
        </div>

        {/* CONTACT PERSON */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Contact Person
          </label>
          <input
            type="text"
            name="contactPerson"
            value={formData.contactPerson}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={loading}
            className={getInputClassName('contactPerson')}
            placeholder="Enter contact person"
          />
          {getFieldError('contactPerson') && (
            <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {getFieldError('contactPerson')}
            </p>
          )}
        </div>

        {/* EMAIL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={loading}
            className={getInputClassName('email')}
            placeholder="Enter email"
          />
          {getFieldError('email') && (
            <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {getFieldError('email')}
            </p>
          )}
        </div>

        {/* PHONE */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Phone
          </label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={loading}
            className={getInputClassName('phone')}
            placeholder="Enter phone"
          />
          {getFieldError('phone') && (
            <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {getFieldError('phone')}
            </p>
          )}
        </div>

        {/* ADDRESS */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Address
          </label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={loading}
            className={getInputClassName('address')}
            placeholder="Enter address"
          />
          {getFieldError('address') && (
            <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {getFieldError('address')}
            </p>
          )}
        </div>

        {/* TAX ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Tax ID
          </label>
          <input
            type="text"
            name="taxId"
            value={formData.taxId}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={loading}
            className={getInputClassName('taxId')}
            placeholder="Enter tax ID"
          />
          {getFieldError('taxId') && (
            <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {getFieldError('taxId')}
            </p>
          )}
        </div>

        {/* PAYMENT TERMS */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Payment Terms
          </label>
          <input
            type="text"
            name="paymentTerms"
            value={formData.paymentTerms}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={loading}
            className={getInputClassName('paymentTerms')}
            placeholder="e.g., Net 30"
          />
          {getFieldError('paymentTerms') && (
            <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {getFieldError('paymentTerms')}
            </p>
          )}
        </div>

        {/* DELIVERY TERMS */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Delivery Terms
          </label>
          <input
            type="text"
            name="deliveryTerms"
            value={formData.deliveryTerms}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={loading}
            className={getInputClassName('deliveryTerms')}
            placeholder="e.g., FOB"
          />
          {getFieldError('deliveryTerms') && (
            <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {getFieldError('deliveryTerms')}
            </p>
          )}
        </div>

        {/* NOTES */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notes
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            onBlur={handleBlur}
            rows={3}
            disabled={loading}
            className={getInputClassName('notes')}
            placeholder="Additional notes"
          />
          {getFieldError('notes') && (
            <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {getFieldError('notes')}
            </p>
          )}
        </div>

        {/* ACTIVE */}
        <div className="md:col-span-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
              disabled={loading}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Active
            </span>
          </label>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitDisabled}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {isEdit ? 'Update Supplier' : 'Create Supplier'}
        </button>
      </div>
    </form>
  );
}

export default SupplierForm;
