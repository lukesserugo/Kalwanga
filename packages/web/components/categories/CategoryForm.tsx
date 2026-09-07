// D:\Projects\Kalwanga\packages\web\components\categories\CategoryForm.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';
import { Category } from '../../types/category';
import { categoryService } from '../../services/categoryService';
import { toast } from '../../utils/toast-manager';

interface CategoryFormProps {
  categoryId?: string;
  businessUnitId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface FormData {
  name: string;
  description: string;
  parentId: string;
  isActive: boolean;
  featured: boolean;
}

interface FormErrors {
  name?: string;
  description?: string;
  parentId?: string;
}

interface ToastMessage {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

export function CategoryForm({ 
  categoryId, 
  businessUnitId, 
  onSuccess, 
  onCancel 
}: CategoryFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    parentId: '',
    isActive: true,
    featured: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [toastMessage, setToastMessage] = useState<ToastMessage | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const isEdit = !!categoryId;

  // Auto-dismiss toast after duration
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, toastMessage.duration || 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Load categories
  const loadCategories = useCallback(async () => {
    try {
      const result = await categoryService.getAllCategories({ 
        businessUnitId, 
        limit: 100 
      });
      setCategories(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }, [businessUnitId]);

  // Load category for edit
  const loadCategory = useCallback(async () => {
    if (!categoryId) return;
    try {
      setLoading(true);
      const category = await categoryService.getCategoryById(categoryId);
      setFormData({
        name: category.name,
        description: category.description || '',
        parentId: category.parentId || '',
        isActive: category.isActive,
        featured: (category as any).featured || false,
      });
    } catch (error) {
      console.error('Failed to load category:', error);
      showToast('error', 'Failed to load category');
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    loadCategories();
    if (isEdit) {
      loadCategory();
    }
  }, [loadCategories, isEdit, loadCategory]);

  // Toast helper
  const showToast = (type: ToastMessage['type'], message: string, duration?: number) => {
    setToastMessage({ type, message, duration });
    // Also use the global toast for consistency
    toast[type](message);
  };

  // Validation
  const validateField = useCallback((name: string, value: any): string | undefined => {
    switch (name) {
      case 'name':
        if (!value || value.trim() === '') return 'Category name is required';
        if (value.trim().length < 2) return 'Category name must be at least 2 characters';
        if (value.trim().length > 100) return 'Category name must be less than 100 characters';
        return undefined;
      case 'description':
        if (value && value.trim().length > 500) return 'Description must be less than 500 characters';
        return undefined;
      default:
        return undefined;
    }
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    let isValid = true;

    if (!formData.name.trim()) {
      newErrors.name = 'Category name is required';
      isValid = false;
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Category name must be at least 2 characters';
      isValid = false;
    } else if (formData.name.trim().length > 100) {
      newErrors.name = 'Category name must be less than 100 characters';
      isValid = false;
    }

    if (formData.description && formData.description.trim().length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  }, [formData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
    
    const newValue = type === 'checkbox' ? checked : value;
    
    setTouched(prev => ({ ...prev, [name]: true }));
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));

    const error = validateField(name, newValue);
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    const error = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitSuccess(false);
    setToastMessage(null);

    // Mark all fields as touched
    const allTouched: Record<string, boolean> = {};
    Object.keys(formData).forEach(key => {
      allTouched[key] = true;
    });
    setTouched(allTouched);

    // Validate form
    const isValid = validateForm();
    if (!isValid) {
      const firstError = Object.values(errors).find(err => err);
      if (firstError) {
        showToast('error', firstError);
      }
      return;
    }

    try {
      setSubmitting(true);
      
      // Prepare data for submission
      const data = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        parentId: formData.parentId || null,
        isActive: formData.isActive,
        featured: formData.featured,
        businessUnitId: businessUnitId,
      };

      console.log('📤 Submitting category data:', data);
      showToast('info', isEdit ? 'Updating category...' : 'Creating category...');

      let result;
      if (isEdit) {
        result = await categoryService.updateCategory(categoryId!, data);
        console.log('✅ Category updated:', result);
        showToast('success', `Category "${result.name}" updated successfully!`);
      } else {
        result = await categoryService.createCategory(data);
        console.log('✅ Category created:', result);
        showToast('success', `Category "${result.name}" created successfully!`);
      }
      
      setSubmitSuccess(true);
      
      // Reset form on success (for create)
      if (!isEdit) {
        setFormData({
          name: '',
          description: '',
          parentId: '',
          isActive: true,
          featured: false,
        });
        setTouched({});
        setErrors({});
      }
      
      // Call onSuccess callback or redirect
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 1500);
      } else {
        setTimeout(() => {
          router.push('/admin/categories');
          router.refresh();
        }, 1500);
      }
    } catch (error: any) {
      console.error('❌ Failed to save category:', error);
      
      // Extract error message from response
      let errorMessage = isEdit ? 'Failed to update category' : 'Failed to create category';
      let errorDetails = '';
      
      if (error?.response?.data) {
        const responseData = error.response.data;
        if (responseData.message) {
          errorMessage = responseData.message;
        }
        if (responseData.errors) {
          const validationErrors = responseData.errors;
          if (Array.isArray(validationErrors)) {
            errorDetails = validationErrors
              .map((err: any) => `${err.field}: ${err.message}`)
              .join(', ');
          }
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      const finalMessage = errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage;
      showToast('error', finalMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const getFieldError = (fieldName: keyof FormErrors): string | undefined => {
    return touched[fieldName] ? errors[fieldName] : undefined;
  };

  const getInputClassName = (fieldName: keyof FormErrors): string => {
    const baseClass = "w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
    const error = getFieldError(fieldName);
    if (error) {
      return `${baseClass} border-red-500 dark:border-red-500 focus:ring-red-500`;
    }
    return `${baseClass} border-gray-300 dark:border-gray-600`;
  };

  // Render toast notification
  const renderToast = () => {
    if (!toastMessage) return null;

    const colors = {
      success: 'bg-green-50 dark:bg-green-900/20 border-green-500 text-green-800 dark:text-green-200',
      error: 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-800 dark:text-red-200',
      warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500 text-yellow-800 dark:text-yellow-200',
      info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-800 dark:text-blue-200',
    };

    const icons = {
      success: <CheckCircle className="w-5 h-5 text-green-500" />,
      error: <AlertCircle className="w-5 h-5 text-red-500" />,
      warning: <AlertCircle className="w-5 h-5 text-yellow-500" />,
      info: <AlertCircle className="w-5 h-5 text-blue-500" />,
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`mb-4 p-4 rounded-lg border-l-4 ${colors[toastMessage.type]} flex items-start justify-between`}
        role="alert"
      >
        <div className="flex items-start gap-3">
          {icons[toastMessage.type]}
          <div>
            <p className="text-sm font-medium">{toastMessage.message}</p>
          </div>
        </div>
        <button
          onClick={() => setToastMessage(null)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-gray-500 dark:text-gray-400 mt-2">Loading category...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {renderToast()}
      </AnimatePresence>

      {/* Success Banner */}
      {submitSuccess && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3"
        >
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              {isEdit ? 'Category updated successfully!' : 'Category created successfully!'}
            </p>
            <p className="text-sm text-green-700 dark:text-green-300">
              Redirecting to categories list...
            </p>
          </div>
        </motion.div>
      )}

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Category Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="Enter category name"
          required
          disabled={submitting || submitSuccess}
          className={getInputClassName('name')}
          aria-invalid={!!getFieldError('name')}
          aria-describedby={getFieldError('name') ? 'name-error' : undefined}
        />
        {getFieldError('name') && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1"
            id="name-error"
          >
            <AlertCircle className="w-3 h-3" />
            {getFieldError('name')}
          </motion.p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Description
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={3}
          className={getInputClassName('description')}
          placeholder="Enter category description"
          disabled={submitting || submitSuccess}
        />
        {getFieldError('description') && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1"
          >
            <AlertCircle className="w-3 h-3" />
            {getFieldError('description')}
          </motion.p>
        )}
      </div>

      {/* Parent Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Parent Category
        </label>
        <select
          name="parentId"
          value={formData.parentId}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={submitting || submitSuccess}
          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors disabled:opacity-50"
        >
          <option value="">None (Top Level)</option>
          {categories
            .filter(cat => cat.id !== categoryId)
            .map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
        </select>
        {formData.parentId && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            This category will be nested under "{categories.find(c => c.id === formData.parentId)?.name || 'selected parent'}"
          </p>
        )}
      </div>

      {/* Status & Featured */}
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            name="isActive"
            checked={formData.isActive}
            onChange={handleChange}
            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            disabled={submitting || submitSuccess}
          />
          <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
            {formData.isActive ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-gray-400" />
            )}
            Active (visible to customers)
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            name="featured"
            checked={formData.featured}
            onChange={handleChange}
            className="w-4 h-4 text-yellow-600 rounded border-gray-300 focus:ring-yellow-500"
            disabled={submitting || submitSuccess}
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            ⭐ Featured (show on homepage)
          </span>
        </label>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting || submitSuccess}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {isEdit ? 'Updating...' : 'Creating...'}
            </>
          ) : (
            <>
              {isEdit ? 'Update Category' : 'Create Category'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
