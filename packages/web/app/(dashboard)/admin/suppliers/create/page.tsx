// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\suppliers\create\page.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Truck, Save, Loader2, Lock, 
  Mail, Phone, MapPin, User, Building, 
  AlertCircle, CheckCircle, XCircle, HelpCircle,
  Globe, CreditCard, FileText, Users, Package,
  ShoppingBag, Clock, DollarSign, Shield,
  ChevronDown, ChevronUp, Info, Plus, Minus,
  Eye, X, Building2, Database
} from 'lucide-react';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermission } from '../../../../../hooks/usePermission';
import { supplierService } from '../../../../../services/supplierService';
import { companyService } from '../../../../../services/companyService';
import { toast } from '../../../../../utils/toast-manager';
import { PermissionResource } from '../../../../../types/enums';
import { api } from '../../../../../services/api';

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

interface Company {
  id: string;
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
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

export default function CreateSupplierPage() {
  const router = useRouter();
  const auth = useAuth();
  const { canCreate, canManage, isLoading: permissionLoading } = usePermission();
  
  // Extract values from auth with safe fallbacks
  const user = auth.user;
  const isAuthenticated = auth.isAuthenticated;
  const authLoading = auth.isLoading;
  
  // State for companies - fetch from database
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  
  // State
  const [loading, setLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdSupplierId, setCreatedSupplierId] = useState<string | null>(null);
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

  // ============================================
  // FETCH COMPANIES FROM DATABASE
  // ============================================

  const fetchCompanies = useCallback(async () => {
    setLoadingCompanies(true);
    try {
      console.log('📤 Fetching companies from database...');
      
      // ✅ FIX: Type the response properly
      const response = await api.get('/companies') as any;
      console.log('📥 Companies response:', response);
      
      let companiesData: Company[] = [];
      
      // Extract companies from response with proper type checking
      if (response && typeof response === 'object') {
        // Case 1: Direct array response
        if (Array.isArray(response)) {
          companiesData = response;
        }
        // Case 2: Response with data property
        else if ('data' in response) {
          const data = (response as any).data;
          if (Array.isArray(data)) {
            companiesData = data;
          } else if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as any).data)) {
            companiesData = (data as any).data;
          } else if (data && typeof data === 'object' && 'companies' in data && Array.isArray((data as any).companies)) {
            companiesData = (data as any).companies;
          }
        }
        // Case 3: Response with companies property
        else if ('companies' in response && Array.isArray((response as any).companies)) {
          companiesData = (response as any).companies;
        }
      }
      
      // Filter only active companies
      const activeCompanies = companiesData.filter((c: Company) => c.isActive !== false);
      
      console.log(`✅ Found ${activeCompanies.length} active companies:`, activeCompanies);
      setCompanies(activeCompanies);
      
      // Auto-select the first active company
      if (activeCompanies.length > 0) {
        const firstCompany = activeCompanies[0];
        setSelectedCompany(firstCompany);
        // Store the company ID for future use
        companyService.setCompanyId(firstCompany.id);
        localStorage.setItem('companyId', firstCompany.id);
        console.log(`✅ Auto-selected company: ${firstCompany.name} (${firstCompany.id})`);
      } else {
        console.warn('⚠️ No active companies found in database');
        toast.warning('No companies found. Please create a company first.');
      }
      
    } catch (error) {
      console.error('❌ Error fetching companies:', error);
      
      // Try to get company from user's context as fallback
      try {
        const userAny = user as any;
        if (userAny?.companyId) {
          const companyId = userAny.companyId;
          console.log(`🔍 Using company from user context: ${companyId}`);
          
          // Try to fetch the specific company
          try {
            const companyResponse = await api.get(`/companies/${companyId}`) as any;
            let companyData: Company | null = null;
            
            if (companyResponse && typeof companyResponse === 'object') {
              if ('data' in companyResponse) {
                const data = (companyResponse as any).data;
                if (data && typeof data === 'object') {
                  if ('data' in data && (data as any).data) {
                    companyData = (data as any).data;
                  } else {
                    companyData = data;
                  }
                }
              } else {
                companyData = companyResponse as Company;
              }
            }
            
            if (companyData && companyData.id) {
              setCompanies([companyData]);
              setSelectedCompany(companyData);
              companyService.setCompanyId(companyData.id);
              localStorage.setItem('companyId', companyData.id);
              console.log(`✅ Loaded company from user context: ${companyData.name}`);
              return;
            }
          } catch (e) {
            console.warn('Could not fetch company from user context:', e);
          }
        }
      } catch (e) {
        console.warn('Error accessing user context:', e);
      }
      
      // If still no companies, try to get or create default
      try {
        console.log('🔄 Attempting to get or create default company...');
        const defaultCompany = await companyService.getOrCreateDefault();
        if (defaultCompany && defaultCompany.id) {
          setCompanies([defaultCompany]);
          setSelectedCompany(defaultCompany);
          companyService.setCompanyId(defaultCompany.id);
          localStorage.setItem('companyId', defaultCompany.id);
          console.log(`✅ Created/loaded default company: ${defaultCompany.name}`);
        }
      } catch (e) {
        console.error('❌ Failed to get/create default company:', e);
        toast.error('Could not load company data. Please contact support.');
      }
      
    } finally {
      setLoadingCompanies(false);
    }
  }, [user]);

  // ============================================
  // DERIVED VALUES
  // ============================================

  // Get the actual Company ID from the selected company
  const companyId = useMemo(() => {
    if (selectedCompany?.id) {
      return selectedCompany.id;
    }
    
    // Try from localStorage as fallback
    const stored = localStorage.getItem('companyId');
    if (stored && stored !== 'undefined' && stored !== 'null' && stored.length > 10) {
      return stored;
    }
    
    return undefined;
  }, [selectedCompany]);

  // Get user ID from auth context
  const userId = useMemo(() => {
    return user?.id || (user as any)?.userId || (user as any)?.uid;
  }, [user]);

  // Check if user has a valid company
  const hasValidCompany = useMemo(() => {
    return !!companyId && companyId !== 'default' && companyId !== 'default-company-id';
  }, [companyId]);

  // Check permissions
  const canCreateSupplier = useMemo(() => 
    canCreate(PermissionResource.SUPPLIER) || canManage(PermissionResource.SUPPLIER),
    [canCreate, canManage]
  );

  // ============================================
  // EFFECTS
  // ============================================

  // Client-side only
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Fetch companies on mount
  useEffect(() => {
    if (isClient && isAuthenticated) {
      fetchCompanies();
    }
  }, [isClient, isAuthenticated, fetchCompanies]);

  // ============================================
  // COMPANY SELECTOR
  // ============================================

  const handleCompanySelect = (companyId: string) => {
    const selected = companies.find((c: Company) => c.id === companyId);
    if (selected) {
      setSelectedCompany(selected);
      setShowCompanyDropdown(false);
      localStorage.setItem('companyId', selected.id);
      companyService.setCompanyId(selected.id);
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.general;
        return newErrors;
      });
      toast.success(`Selected: ${selected.name}`);
    }
  };

  const CompanySelector = () => {
    if (loadingCompanies) {
      return (
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse">
          <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
          <div className="w-24 h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
        </div>
      );
    }

    if (companies.length === 0) {
      return (
        <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-yellow-700 dark:text-yellow-300 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>No companies found. Please create a company first.</span>
        </div>
      );
    }

    if (companies.length === 1) {
      const company = companies[0];
      return (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <Building className="w-4 h-4 text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium text-green-700 dark:text-green-300">
            {company.name}
          </span>
          <code className="text-xs text-green-600 dark:text-green-400 font-mono bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded">
            {company.id.slice(0, 12)}...
          </code>
          <span className="text-xs text-green-500">(Active)</span>
        </div>
      );
    }

    const selected = companies.find((c: Company) => c.id === companyId);

    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowCompanyDropdown(!showCompanyDropdown)}
          className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors min-w-[200px] w-full"
        >
          <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1 text-left">
            {selected?.name || 'Select Company'}
          </span>
          {selected && (
            <code className="text-xs text-gray-400 font-mono flex-shrink-0">
              {selected.id.slice(0, 8)}...
            </code>
          )}
          {showCompanyDropdown ? (
            <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )}
        </button>

        {showCompanyDropdown && (
          <div className="absolute left-0 mt-2 w-full min-w-[300px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
            <div className="p-2 max-h-80 overflow-y-auto">
              <p className="text-xs text-gray-500 dark:text-gray-400 px-3 py-1 border-b border-gray-100 dark:border-gray-700 mb-1 flex items-center gap-2">
                <Database className="w-3 h-3" />
                Select Company
              </p>
              {companies.map((company) => {
                const isSelected = companyId === company.id;
                const isActive = company.isActive !== false;
                
                return (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => {
                      if (isActive) {
                        handleCompanySelect(company.id);
                      }
                    }}
                    disabled={!isActive}
                    className={`
                      w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between
                      ${isSelected 
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }
                      ${!isActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{company.name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <code className="text-xs text-gray-400 font-mono">{company.id}</code>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-400">{company.email}</span>
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0 ml-2" />
                    )}
                    {!isActive && (
                      <span className="text-xs text-red-500 flex-shrink-0 ml-2">(Inactive)</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
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

    // Required fields
    if (!formData.name.trim()) {
      newErrors.name = 'Supplier name is required';
      isValid = false;
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Supplier name must be at least 2 characters';
      isValid = false;
    }

    // Optional fields with validation
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

    // Company validation
    if (!companyId) {
      newErrors.general = 'No company found. Please ensure a company exists.';
      isValid = false;
    }

    if (!userId) {
      newErrors.general = 'No user ID found. Please log in again.';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  }, [formData, companyId, userId, validateField]);

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
      const firstErrorField = Object.keys(errors)[0];
      if (firstErrorField) {
        const element = document.querySelector(`[name="${firstErrorField}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      return;
    }

    // Use the actual Company ID from the database
    if (!companyId) {
      const errorMsg = 'No company found. Please ensure a company exists.';
      setErrors(prev => ({ ...prev, general: errorMsg }));
      toast.error(errorMsg);
      return;
    }

    if (!userId) {
      const errorMsg = 'No user ID found. Please log in again.';
      setErrors(prev => ({ ...prev, general: errorMsg }));
      toast.error(errorMsg);
      return;
    }

    console.log(`✅ Using Company ID: ${companyId} (from database)`);
    console.log(`✅ Selected Company: ${selectedCompany?.name}`);

    setLoading(true);
    try {
      // Prepare data - use the actual Company ID from the database
      const data = {
        name: formData.name.trim(),
        contactPerson: formData.contactPerson.trim() || undefined,
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        address: formData.address.trim() || undefined,
        taxId: formData.taxId.trim() || undefined,
        paymentTerms: formData.paymentTerms.trim() || undefined,
        deliveryTerms: formData.deliveryTerms.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        website: formData.website.trim() || undefined,
        creditLimit: formData.creditLimit || undefined,
        rating: formData.rating || undefined,
        isActive: formData.isActive,
        companyId: companyId, // ✅ Using actual Company ID from database
        userId: userId,
      };

      console.log('📤 Creating supplier with data:', data);
      
      const result = await supplierService.createSupplier(data);
      console.log('✅ Supplier created:', result);

      setCreatedSupplierId(result.id);
      setSuccess(true);
      toast.success('Supplier created successfully');

      setFormData({
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
      setTouched({});
      setErrors({});
      setSubmitAttempted(false);

      setTimeout(() => {
        router.push('/admin/catalog/suppliers');
        router.refresh();
      }, 2000);

    } catch (error: any) {
      console.error('❌ Failed to create supplier:', error);
      
      let errorMessage = 'Failed to create supplier';
      let fieldErrors: Record<string, string> = {};
      
      if (error?.response?.data?.errors) {
        const validationErrors = error.response.data.errors;
        if (Array.isArray(validationErrors)) {
          validationErrors.forEach((err: any) => {
            const field = err.field || err.path || 'general';
            fieldErrors[field] = err.message;
          });
        }
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
        fieldErrors.general = errorMessage;
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
        fieldErrors.general = errorMessage;
      } else if (error?.message) {
        errorMessage = error.message;
        fieldErrors.general = errorMessage;
      }
      
      setErrors(fieldErrors);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (success) {
      router.push('/admin/catalog/suppliers');
    } else {
      router.back();
    }
  };

  const handleCreateAnother = () => {
    setSuccess(false);
    setCreatedSupplierId(null);
    setFormData({
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
    setTouched({});
    setErrors({});
    setSubmitAttempted(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    const baseClass = "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
    const error = getFieldError(fieldName);
    if (error) return `${baseClass} border-red-500 dark:border-red-500`;
    return `${baseClass} border-gray-300 dark:border-gray-600`;
  };

  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const emptyStars = 5 - fullStars;
    
    return (
      <div className="flex items-center gap-0.5">
        {[...Array(fullStars)].map((_, i) => (
          <span key={`full-${i}`} className="text-yellow-400">★</span>
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

  if ((!isAuthenticated && isClient) || authLoading || !isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Please Login</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You need to be logged in to create suppliers.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Go to Login
        </button>
      </div>
    );
  }

  if (!canCreateSupplier && !permissionLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to create suppliers. Please contact your administrator.
        </p>
        <button
          onClick={() => router.push('/admin/catalog/suppliers')}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Suppliers
        </button>
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
            <button
              onClick={handleCancel}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Go back"
              disabled={loading}
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Truck className="w-6 h-6 text-blue-500" />
                Add Supplier
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Create a new supplier in your catalog
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasValidCompany && companyId && selectedCompany && (
              <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded-full flex items-center gap-1">
                <Building className="w-3 h-3" />
                {selectedCompany.name}
              </span>
            )}
            <button
              onClick={handleCancel}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 disabled:opacity-50"
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </div>

        {/* SUCCESS BANNER */}
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">Success!</p>
                  <p className="text-sm text-green-700 dark:text-green-300">Supplier created successfully.</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handleCreateAnother}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add Another
                </button>
                <button
                  onClick={() => router.push('/admin/catalog/suppliers')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-1"
                >
                  <Truck className="w-4 h-4" /> View Suppliers
                </button>
                {createdSupplierId && (
                  <button
                    onClick={() => router.push(`/admin/suppliers/${createdSupplierId}`)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm flex items-center gap-1"
                  >
                    <Eye className="w-4 h-4" /> View Supplier
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ERROR DISPLAY */}
        {errors.general && !success && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">Error</p>
              <p className="text-sm text-red-700 dark:text-red-300">{errors.general}</p>
            </div>
            <button
              onClick={() => setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.general;
                return newErrors;
              })}
              className="text-red-600 hover:text-red-800 dark:text-red-400 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* COMPANY SELECTION - FETCHED FROM DATABASE */}
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Company <span className="text-red-500">*</span>
              </label>
              <CompanySelector />
              {!hasValidCompany && (
                <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Please select or assign a company
                </p>
              )}
              <p className="mt-1 text-xs text-gray-400">
                {companies.length} company{companies.length !== 1 ? 'ies' : ''} available
              </p>
            </div>
            {hasValidCompany && companyId && selectedCompany && (
              <div className="flex-shrink-0 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2 border border-green-200 dark:border-green-800">
                <p className="text-xs text-green-600 dark:text-green-400">Selected Company</p>
                <p className="text-sm font-medium text-green-700 dark:text-green-300 truncate max-w-[150px]">
                  {selectedCompany.name}
                </p>
                <code className="text-xs text-green-500 font-mono">{companyId.slice(0, 12)}...</code>
              </div>
            )}
          </div>
        </div>

        {/* INFO BANNER */}
        <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium">Required Fields</p>
            <p className="mt-1">Fields marked with <span className="text-red-500">*</span> are required. All other fields are optional.</p>
            {!hasValidCompany && (
              <p className="mt-1 text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                Please select a company to continue.
              </p>
            )}
          </div>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 space-y-6 transition-colors duration-200">
          {/* BASIC INFORMATION SECTION */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection('basic')}
              className="w-full flex items-center justify-between text-lg font-semibold text-gray-900 dark:text-white mb-4"
            >
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-500" />
                Basic Information
                <span className="text-sm text-red-500">*</span>
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
                        Supplier Name <span className="text-red-500">*</span>
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
                        <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
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
                        <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
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
                        <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
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

          {/* CONTACT INFORMATION SECTION */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <button
              type="button"
              onClick={() => toggleSection('contact')}
              className="w-full flex items-center justify-between text-lg font-semibold text-gray-900 dark:text-white mb-4"
            >
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-500" />
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
                        <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
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
                        <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
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
                        <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
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
                        <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
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

          {/* BUSINESS INFORMATION SECTION */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <button
              type="button"
              onClick={() => toggleSection('business')}
              className="w-full flex items-center justify-between text-lg font-semibold text-gray-900 dark:text-white mb-4"
            >
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-blue-500" />
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
                        <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
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
                          className={`${getInputClassName('creditLimit')} pl-10`}
                          placeholder="0.00"
                          disabled={loading || success}
                        />
                      </div>
                      {getFieldError('creditLimit') && (
                        <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
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
                        <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
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
                        <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
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
                        <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {getFieldError('notes')}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-400">
                        {formData.notes.length}/1000 characters
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* STATUS SECTION */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <button
              type="button"
              onClick={() => toggleSection('additional')}
              className="w-full flex items-center justify-between text-lg font-semibold text-gray-900 dark:text-white mb-4"
            >
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-500" />
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
                        className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 transition-colors duration-200"
                        disabled={loading || success}
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
                        {formData.isActive ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-400" />
                        )}
                        Active (visible to users)
                      </span>
                    </label>

                    <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${hasValidCompany ? 'bg-green-500' : 'bg-red-500'}`} />
                          {hasValidCompany 
                            ? `Company: ${selectedCompany?.name || companyId?.slice(0, 8)}`
                            : '⚠️ No company selected'}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          {userId 
                            ? `User: ${userId.slice(0, 8)}...`
                            : '⚠️ No user ID'}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                          {companies.length} Company{companies.length !== 1 ? 'ies' : ''} available
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ACTIONS */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6 flex flex-col sm:flex-row items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 w-full sm:w-auto text-center disabled:opacity-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || success || !hasValidCompany || !userId}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : success ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Created!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Create Supplier
                </>
              )}
            </button>
          </div>

          {/* FORM FOOTER */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700">
            <span className="flex items-center gap-1">
              <span className="text-red-500">*</span> Required fields
            </span>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${hasValidCompany ? 'bg-green-500' : 'bg-red-500'}`} />
                {hasValidCompany ? 'Company selected' : '⚠️ Company required'}
              </span>
              <span className="flex items-center gap-2">
                <Database className="w-3 h-3" />
                {companies.length} companies loaded
              </span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
