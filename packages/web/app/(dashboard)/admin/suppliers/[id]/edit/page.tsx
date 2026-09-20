// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\suppliers\[id]\edit\page.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Truck, Save, Loader2, Lock,
  Mail, Phone, MapPin, User, Building,
  AlertCircle, CheckCircle, XCircle, HelpCircle,
  Globe, CreditCard, FileText, Save as SaveIcon,
  ChevronDown, ChevronUp, Info, Plus, Minus,
  DollarSign, Shield, Star, StarHalf
} from 'lucide-react';
import { useAuth } from '../../../../../../hooks/useAuth';
import { usePermission } from '../../../../../../hooks/usePermission';
import { supplierService } from '../../../../../../services/supplierService';
import { toast } from '../../../../../../utils/toast-manager';
import { PermissionResource } from '../../../../../../types/enums';

// ============================================
// TYPES
// ============================================

interface FormData {
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
  website: string;
  creditLimit: number;
  rating: number;
}

interface FormErrors {
  name?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  notes?: string;
  website?: string;
  creditLimit?: string;
  rating?: string;
  general?: string;
}

// ============================================
// CONSTANTS
// ============================================

const PAYMENT_TERMS_OPTIONS = [
  { value: '', label: 'Select payment terms' },
  { value: 'Net 30', label: 'Net 30' },
  { value: 'Net 60', label: 'Net 60' },
  { value: 'Net 90', label: 'Net 90' },
  { value: 'COD', label: 'Cash on Delivery (COD)' },
  { value: 'Prepaid', label: 'Prepaid' },
  { value: 'On Invoice', label: 'On Invoice' },
  { value: 'Letter of Credit', label: 'Letter of Credit' },
  { value: 'Bank Transfer', label: 'Bank Transfer' },
];

const DELIVERY_TERMS_OPTIONS = [
  { value: '', label: 'Select delivery terms' },
  { value: 'FOB', label: 'FOB (Free on Board)' },
  { value: 'CIF', label: 'CIF (Cost, Insurance, Freight)' },
  { value: 'Ex-Works', label: 'Ex-Works' },
  { value: 'DDP', label: 'DDP (Delivered Duty Paid)' },
  { value: 'DDU', label: 'DDU (Delivered Duty Unpaid)' },
  { value: 'Express', label: 'Express Delivery' },
  { value: 'Standard', label: 'Standard Delivery' },
  { value: 'Pickup', label: 'Pickup' },
];

// ============================================
// MAIN COMPONENT
// ============================================

export default function EditSupplierPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { user } = useAuth();
  const { canEdit, canManage, isLoading: permissionLoading } = usePermission();

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    contact: true,
    business: true,
    additional: false,
  });

  const [formData, setFormData] = useState<FormData>({
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
    website: '',
    creditLimit: 0,
    rating: 0,
  });

  const companyId = useMemo(() => user?.companyId || 'default', [user]);
  const canEditSupplier = useMemo(() =>
    canEdit(PermissionResource.SUPPLIER) || canManage(PermissionResource.SUPPLIER),
    [canEdit, canManage]
  );

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && id) {
      loadSupplier();
    }
  }, [id, isClient]);

  // ============================================
  // LOAD SUPPLIER
  // ============================================

  const loadSupplier = async () => {
    try {
      setLoadingData(true);
      setError(null);
      const data = await supplierService.getSupplierById(id, companyId);

      setFormData({
        name: data.name || '',
        contactPerson: data.contactPerson || '',
        email: data.email || '',
        phone: data.phone || '',
        address: data.address || '',
        taxId: data.taxId || '',
        paymentTerms: (data as any).paymentTerms || '',
        deliveryTerms: (data as any).deliveryTerms || '',
        notes: data.notes || '',
        isActive: data.isActive !== undefined ? data.isActive : true,
        website: (data as any).website || '',
        creditLimit: (data as any).creditLimit || 0,
        rating: (data as any).rating || 0,
      });
    } catch (error: any) {
      console.error('Failed to load supplier:', error);
      if (error?.response?.status === 404) {
        setError('Supplier not found');
      } else {
        setError('Failed to load supplier. Please try again.');
      }
      toast.error('Failed to load supplier');
    } finally {
      setLoadingData(false);
    }
  };

  // ============================================
  // VALIDATION
  // ============================================

  const validateField = useCallback((name: keyof FormData, value: any): string => {
    switch (name) {
      case 'name':
        if (!value || !value.trim()) return 'Supplier name is required';
        if (value.trim().length < 2) return 'Supplier name must be at least 2 characters';
        if (value.trim().length > 100) return 'Supplier name must be less than 100 characters';
        return '';
      case 'email':
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return 'Please enter a valid email address';
        }
        return '';
      case 'phone':
        if (value && !/^[\+\d\s\-\(\)]{7,20}$/.test(value)) {
          return 'Please enter a valid phone number';
        }
        return '';
      case 'taxId':
        if (value && value.length > 50) return 'Tax ID must be less than 50 characters';
        return '';
      case 'website':
        if (value && !/^https?:\/\/[^\s]+$/.test(value) && !/^[^\s]+\.[^\s]+$/.test(value)) {
          return 'Please enter a valid website URL';
        }
        return '';
      case 'creditLimit':
        if (value && value < 0) return 'Credit limit cannot be negative';
        if (value && value > 999999999) return 'Credit limit is too large';
        return '';
      case 'rating':
        if (value && (value < 0 || value > 5)) return 'Rating must be between 0 and 5';
        return '';
      case 'contactPerson':
        if (value && value.length > 100) return 'Contact person name must be less than 100 characters';
        return '';
      case 'address':
        if (value && value.length > 200) return 'Address must be less than 200 characters';
        return '';
      case 'notes':
        if (value && value.length > 1000) return 'Notes must be less than 1000 characters';
        return '';
      default:
        return '';
    }
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    let isValid = true;

    if (!formData.name.trim()) {
      newErrors.name = 'Supplier name is required';
      isValid = false;
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Supplier name must be at least 2 characters';
      isValid = false;
    }

    if (formData.email) {
      const emailError = validateField('email', formData.email);
      if (emailError) {
        newErrors.email = emailError;
        isValid = false;
      }
    }

    if (formData.phone) {
      const phoneError = validateField('phone', formData.phone);
      if (phoneError) {
        newErrors.phone = phoneError;
        isValid = false;
      }
    }

    if (formData.website) {
      const websiteError = validateField('website', formData.website);
      if (websiteError) {
        newErrors.website = websiteError;
        isValid = false;
      }
    }

    if (formData.creditLimit < 0) {
      newErrors.creditLimit = 'Credit limit cannot be negative';
      isValid = false;
    }

    if (formData.rating && (formData.rating < 0 || formData.rating > 5)) {
      newErrors.rating = 'Rating must be between 0 and 5';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  }, [formData, validateField]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    let parsedValue: any = value;
    if (type === 'number') {
      parsedValue = value === '' ? 0 : parseFloat(value);
    }
    if (type === 'checkbox') {
      parsedValue = (e.target as HTMLInputElement).checked;
    }

    setFormData(prev => ({ ...prev, [name]: parsedValue }));

    if (errors[name as keyof FormErrors]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name as keyof FormErrors];
        return newErrors;
      });
    }

    setTouched(prev => ({ ...prev, [name]: true }));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));

    const error = validateField(name as keyof FormData, value);
    if (error) {
      setErrors(prev => ({ ...prev, [name]: error }));
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name as keyof FormErrors];
        return newErrors;
      });
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setSuccess(false);
    setErrors({});

    if (!validateForm()) {
      const firstError = Object.values(errors).find(err => err);
      if (firstError) {
        toast.error(firstError);
      } else {
        toast.error('Please fix all validation errors');
      }
      return;
    }

    setLoading(true);
    try {
      const data = {
        name: formData.name.trim(),
        contactPerson: formData.contactPerson.trim() || null,
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        address: formData.address.trim() || null,
        taxId: formData.taxId.trim() || null,
        paymentTerms: formData.paymentTerms.trim() || null,
        deliveryTerms: formData.deliveryTerms.trim() || null,
        notes: formData.notes.trim() || null,
        website: formData.website.trim() || null,
        creditLimit: formData.creditLimit || null,
        rating: formData.rating || null,
        isActive: formData.isActive,
      };

      await supplierService.updateSupplier(id, data);
      setSuccess(true);
      toast.success('Supplier updated successfully');

      setTimeout(() => {
        router.push(`/admin/suppliers/${id}`);
        router.refresh();
      }, 1500);
    } catch (error: any) {
      console.error('Failed to update supplier:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to update supplier';

      if (errorMessage.toLowerCase().includes('email')) {
        setErrors(prev => ({ ...prev, email: errorMessage }));
      } else if (errorMessage.toLowerCase().includes('name')) {
        setErrors(prev => ({ ...prev, name: errorMessage }));
      } else {
        setErrors(prev => ({ ...prev, general: errorMessage }));
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // HELPERS
  // ============================================

  const getFieldError = (fieldName: keyof FormErrors): string | undefined => {
    if (submitAttempted || touched[fieldName]) {
      return errors[fieldName];
    }
    return undefined;
  };

  const getInputClassName = (fieldName: keyof FormErrors): string => {
    const baseClass = "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
    const error = getFieldError(fieldName);
    if (error) return `${baseClass} border-danger-500 dark:border-danger-500`;
    return `${baseClass} border-gray-300 dark:border-gray-600`;
  };

  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const emptyStars = 5 - fullStars;

    return (
      <div className="flex items-center gap-0.5">
        {[...Array(fullStars)].map((_, i) => (
          <span key={`full-${i}`} className="text-warning-400">★</span>
        ))}
        {[...Array(emptyStars)].map((_, i) => (
          <span key={`empty-${i}`} className="text-gray-300 dark:text-gray-600">★</span>
        ))}
      </div>
    );
  };

  // ============================================
  // AUTHENTICATION GUARD
  // ============================================

  if (!canEditSupplier && !permissionLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to edit suppliers. Please contact your administrator.
        </p>
        <button
          onClick={() => router.push(`/admin/suppliers/${id}`)}
          className="mt-4 px-6 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors flex items-center gap-2 focus-ring"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Supplier
        </button>
      </div>
    );
  }

  // ============================================
  // LOADING STATE
  // ============================================

  if (permissionLoading || !isClient || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 dark:border-brand-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading supplier...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // ERROR STATE
  // ============================================

  if (error || !formData.name) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="text-6xl mb-4">🚚</div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {error || 'Supplier not found'}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          The supplier you're looking for doesn't exist or has been removed.
        </p>
        <Link
          href="/admin/catalog/suppliers"
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors focus-ring"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Suppliers
        </Link>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 transition-colors duration-200">
      <div className="max-w-4xl mx-auto">
        {/* HEADER */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Link
              href={`/admin/suppliers/${id}`}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Truck className="w-6 h-6 text-brand-500" />
                Edit Supplier
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Update supplier information
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {companyId && companyId !== 'default' && (
              <span className="text-xs bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300 px-2 py-1 rounded-full flex items-center gap-1">
                <Building className="w-3 h-3" />
                BU: {companyId.slice(0, 8)}...
              </span>
            )}
            <Link
              href={`/admin/suppliers/${id}`}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 focus-ring"
            >
              Cancel
            </Link>
          </div>
        </div>

        {/* SUCCESS BANNER */}
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6 bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg p-4 flex items-center gap-3"
            >
              <CheckCircle className="w-5 h-5 text-success-600 dark:text-success-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-success-800 dark:text-success-200">Success!</p>
                <p className="text-sm text-success-700 dark:text-success-300">Supplier updated successfully.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ERROR DISPLAY */}
        {errors.general && !success && (
          <div className="mb-6 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-danger-600 dark:text-danger-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-danger-800 dark:text-danger-200">Error</p>
              <p className="text-sm text-danger-700 dark:text-danger-300">{errors.general}</p>
            </div>
            <button
              onClick={() => setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.general;
                return newErrors;
              })}
              className="text-danger-600 hover:text-danger-800 dark:text-danger-400 p-1 focus-ring"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* INFO BANNER */}
        <div className="mb-6 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-brand-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-brand-700 dark:text-brand-300">
            <p className="font-medium">Required Fields</p>
            <p className="mt-1">Fields marked with <span className="text-danger-500">*</span> are required. All other fields are optional.</p>
          </div>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="card-brand p-4 sm:p-6 space-y-6 transition-colors duration-200">
          {/* ============================================ */}
          {/* BASIC INFORMATION SECTION */}
          {/* ============================================ */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection('basic')}
              className="w-full flex items-center justify-between text-lg font-semibold text-gray-900 dark:text-white mb-4 focus-ring rounded"
            >
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-brand-500" />
                Basic Information
                <span className="text-sm text-danger-500">*</span>
              </div>
              {expandedSections.basic ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>

            <AnimatePresence>
              {expandedSections.basic && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Supplier Name <span className="text-danger-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        required
                        value={formData.name}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        className={getInputClassName('name')}
                        placeholder="Enter supplier name"
                        disabled={loading || success}
                      />
                      {getFieldError('name') && (
                        <p className="mt-1 text-sm text-danger-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {getFieldError('name')}
                        </p>
                      )}
                    </div>

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
                        className={getInputClassName('contactPerson')}
                        placeholder="Enter contact person name"
                        disabled={loading || success}
                      />
                      {getFieldError('contactPerson') && (
                        <p className="mt-1 text-sm text-danger-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {getFieldError('contactPerson')}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Rating
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          name="rating"
                          min="0"
                          max="5"
                          step="0.5"
                          value={formData.rating}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          className={getInputClassName('rating')}
                          placeholder="0"
                          disabled={loading || success}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {renderStars(formData.rating)}
                        </div>
                      </div>
                      {getFieldError('rating') && (
                        <p className="mt-1 text-sm text-danger-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {getFieldError('rating')}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-400">Rate supplier from 0 to 5 stars</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ============================================ */}
          {/* CONTACT INFORMATION SECTION */}
          {/* ============================================ */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <button
              type="button"
              onClick={() => toggleSection('contact')}
              className="w-full flex items-center justify-between text-lg font-semibold text-gray-900 dark:text-white mb-4 focus-ring rounded"
            >
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-brand-500" />
                Contact Information
              </div>
              {expandedSections.contact ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>

            <AnimatePresence>
              {expandedSections.contact && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Email
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          className={`${getInputClassName('email')} pl-10`}
                          placeholder="Enter email address"
                          disabled={loading || success}
                        />
                      </div>
                      {getFieldError('email') && (
                        <p className="mt-1 text-sm text-danger-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {getFieldError('email')}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Phone
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          className={`${getInputClassName('phone')} pl-10`}
                          placeholder="Enter phone number"
                          disabled={loading || success}
                        />
                      </div>
                      {getFieldError('phone') && (
                        <p className="mt-1 text-sm text-danger-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {getFieldError('phone')}
                        </p>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Address
                      </label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          name="address"
                          value={formData.address}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          className={`${getInputClassName('address')} pl-10`}
                          placeholder="Enter address"
                          disabled={loading || success}
                        />
                      </div>
                      {getFieldError('address') && (
                        <p className="mt-1 text-sm text-danger-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {getFieldError('address')}
                        </p>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Website
                      </label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          name="website"
                          value={formData.website}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          className={`${getInputClassName('website')} pl-10`}
                          placeholder="Enter website URL"
                          disabled={loading || success}
                        />
                      </div>
                      {getFieldError('website') && (
                        <p className="mt-1 text-sm text-danger-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {getFieldError('website')}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-400">Include https:// for external links</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ============================================ */}
          {/* BUSINESS INFORMATION SECTION */}
          {/* ============================================ */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <button
              type="button"
              onClick={() => toggleSection('business')}
              className="w-full flex items-center justify-between text-lg font-semibold text-gray-900 dark:text-white mb-4 focus-ring rounded"
            >
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-brand-500" />
                Business Information
              </div>
              {expandedSections.business ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>

            <AnimatePresence>
              {expandedSections.business && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
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
                        className={getInputClassName('taxId')}
                        placeholder="Enter tax ID"
                        disabled={loading || success}
                      />
                      {getFieldError('taxId') && (
                        <p className="mt-1 text-sm text-danger-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {getFieldError('taxId')}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Credit Limit
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="number"
                          name="creditLimit"
                          min="0"
                          step="0.01"
                          value={formData.creditLimit}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          className={`${getInputClassName('creditLimit')} pl-10 tabular-nums`}
                          placeholder="0.00"
                          disabled={loading || success}
                        />
                      </div>
                      {getFieldError('creditLimit') && (
                        <p className="mt-1 text-sm text-danger-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {getFieldError('creditLimit')}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Payment Terms
                      </label>
                      <select
                        name="paymentTerms"
                        value={formData.paymentTerms}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        className={getInputClassName('paymentTerms')}
                        disabled={loading || success}
                      >
                        {PAYMENT_TERMS_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      {getFieldError('paymentTerms') && (
                        <p className="mt-1 text-sm text-danger-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {getFieldError('paymentTerms')}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Delivery Terms
                      </label>
                      <select
                        name="deliveryTerms"
                        value={formData.deliveryTerms}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        className={getInputClassName('deliveryTerms')}
                        disabled={loading || success}
                      >
                        {DELIVERY_TERMS_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      {getFieldError('deliveryTerms') && (
                        <p className="mt-1 text-sm text-danger-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {getFieldError('deliveryTerms')}
                        </p>
                      )}
                    </div>

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
                        className={getInputClassName('notes')}
                        placeholder="Additional notes about the supplier"
                        disabled={loading || success}
                      />
                      {getFieldError('notes') && (
                        <p className="mt-1 text-sm text-danger-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {getFieldError('notes')}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-400 tabular-nums">
                        {formData.notes.length}/1000 characters
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ============================================ */}
          {/* STATUS SECTION */}
          {/* ============================================ */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <button
              type="button"
              onClick={() => toggleSection('additional')}
              className="w-full flex items-center justify-between text-lg font-semibold text-gray-900 dark:text-white mb-4 focus-ring rounded"
            >
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-brand-500" />
                Status & Configuration
              </div>
              {expandedSections.additional ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>

            <AnimatePresence>
              {expandedSections.additional && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pt-2 space-y-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="isActive"
                        checked={formData.isActive}
                        onChange={handleChange}
                        className="w-4 h-4 text-brand-600 border-gray-300 dark:border-gray-600 rounded focus:ring-brand-500 dark:focus:ring-brand-400 bg-white dark:bg-gray-700 transition-colors duration-200"
                        disabled={loading || success}
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
                        {formData.isActive ? (
                          <CheckCircle className="w-4 h-4 text-success-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-400" />
                        )}
                        Active (visible to users)
                      </span>
                    </label>

                    {/* Business Unit Info */}
                    <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${companyId && companyId !== 'default' ? 'bg-success-500' : 'bg-warning-500'}`} />
                          {companyId && companyId !== 'default'
                            ? `Business Unit: ${companyId.slice(0, 8)}...`
                            : '⚠️ Using default business unit'}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                          {user?.id ? `User: ${user.id.slice(0, 8)}...` : '⚠️ No user ID'}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ============================================ */}
          {/* ACTIONS */}
          {/* ============================================ */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6 flex flex-col sm:flex-row items-center justify-end gap-3">
            <Link
              href={`/admin/suppliers/${id}`}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 w-full sm:w-auto text-center disabled:opacity-50 focus-ring"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || success}
              className="px-6 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 w-full sm:w-auto justify-center focus-ring"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : success ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Updated!
                </>
              ) : (
                <>
                  <SaveIcon className="w-4 h-4" />
                  Update Supplier
                </>
              )}
            </button>
          </div>

          {/* FORM FOOTER */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700">
            <span className="flex items-center gap-1">
              <span className="text-danger-500">*</span> Required fields
            </span>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${companyId && companyId !== 'default' ? 'bg-success-500' : 'bg-warning-500'}`} />
                {companyId && companyId !== 'default' ? 'Business unit resolved' : '⚠️ Business unit required'}
              </span>
              <span className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${Object.keys(formData).filter(k => k !== 'isActive').some(k => formData[k as keyof FormData]) ? 'bg-brand-500' : 'bg-gray-400'}`} />
                {Object.keys(formData).filter(k => k !== 'isActive').some(k => formData[k as keyof FormData]) ? 'Form filled' : 'Empty form'}
              </span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// Add missing import
import { X } from 'lucide-react';

