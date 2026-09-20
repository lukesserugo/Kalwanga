// packages/web/components/categories/CategoryForm.tsx

'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  AlertCircle,
  X,
  Type,
  AlignLeft,
  Hash,
  FolderTree,
  Image as ImageIcon,
  Smile,
  Palette,
  ArrowUpDown,
  Search as SearchIcon,
  ChevronDown,
  Check,
  Sparkles,
  ChevronRight,
  Star,
  Info,
  ExternalLink,
} from 'lucide-react';

import { Category } from '../../types/category';
import { categoryService } from '../../services/categoryService';
import { toast } from '../../utils/toast-manager';
import { CategoryAvatar } from './CategoryAvatar';

// ============================================
// TYPES
// ============================================

interface CategoryFormProps {
  /** Legacy prop — the form will fetch the category itself. */
  categoryId?: string;
  /** Modern prop — pre-fetched category. Takes precedence over categoryId. */
  initialData?: Category | null;
  /** Required for create mode when neither initialData nor categoryId is set. */
  businessUnitId?: string;
  onSuccess?: (category?: Category) => void;
  onCancel?: () => void;
  /** Fired as submission starts/stops so parents can disable navigation. */
  onSubmittingChange?: (submitting: boolean) => void;
}

interface FormData {
  name: string;
  slug: string;
  description: string;
  parentId: string;
  isActive: boolean;
  featured: boolean;
  image: string;
  icon: string;
  color: string;
  sortOrder: number;
  metaTitle: string;
  metaDescription: string;
}

type FieldKey = keyof FormData;
type FormErrors = Partial<Record<FieldKey, string>>;

// ============================================
// CONSTANTS & HELPERS
// ============================================

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
const URL_REGEX = /^https?:\/\//i;

const DEFAULT_COLORS = [
  '#F97316',
  '#EF4444',
  '#EC4899',
  '#8B5CF6',
  '#3B82F6',
  '#06B6D4',
  '#10B981',
  '#84CC16',
  '#EAB308',
  '#F59E0B',
];

const COMMON_ICONS = [
  '👕',
  '👟',
  '👜',
  '💻',
  '📱',
  '🎧',
  '📚',
  '🏠',
  '🍔',
  '☕',
  '🧴',
  '🧸',
  '🎮',
  '⚽',
  '🎨',
  '🔧',
  '💊',
  '🌱',
  '🐾',
  '🎁',
  '🚗',
  '💄',
  '👶',
  '🍕',
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function emptyForm(): FormData {
  return {
    name: '',
    slug: '',
    description: '',
    parentId: '',
    isActive: true,
    featured: false,
    image: '',
    icon: '',
    color: '',
    sortOrder: 0,
    metaTitle: '',
    metaDescription: '',
  };
}

function formFromCategory(c: Category): FormData {
  return {
    name: c.name ?? '',
    slug: c.slug ?? '',
    description: c.description ?? '',
    parentId: c.parentId ?? '',
    isActive: c.isActive ?? true,
    featured: (c as any).featured ?? false,
    image: c.image ?? '',
    icon: c.icon ?? '',
    color: c.color ?? '',
    sortOrder: c.sortOrder ?? 0,
    metaTitle: c.metaTitle ?? '',
    metaDescription: c.metaDescription ?? '',
  };
}

// ============================================
// COMPONENT
// ============================================

export function CategoryForm({
  categoryId,
  initialData,
  businessUnitId,
  onSuccess,
  onCancel,
  onSubmittingChange,
}: CategoryFormProps) {
  const router = useRouter();

  // Edit mode if either a pre-fetched category or an id was provided
  const isEdit = !!(initialData || categoryId);

  // ---- State ----
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [loadedCategory, setLoadedCategory] = useState<Category | null>(
    initialData ?? null,
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState<FormData>(
    initialData ? formFromCategory(initialData) : emptyForm(),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [showSeo, setShowSeo] = useState(
    !!(initialData?.metaTitle || initialData?.metaDescription),
  );
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const iconPickerRef = useRef<HTMLDivElement>(null);

  // ---- Propagate submit state ----
  useEffect(() => {
    onSubmittingChange?.(submitting);
  }, [submitting, onSubmittingChange]);

  // ---- Load categories for parent picker ----
  const loadCategories = useCallback(async () => {
    const bu = businessUnitId || loadedCategory?.businessUnitId;
    try {
      const result = await categoryService.getAllCategories({
        businessUnitId: bu,
        limit: 200,
      });
      setCategories(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error('Failed to load categories:', err);
      setCategories([]);
    }
  }, [businessUnitId, loadedCategory?.businessUnitId]);

  // ---- Fetch the category if only an id was provided ----
  const loadCategory = useCallback(async () => {
    if (!categoryId || initialData) return;
    try {
      setLoading(true);
      const category = await categoryService.getCategoryById(categoryId);
      setLoadedCategory(category);
      setFormData(formFromCategory(category));
      if (category.metaTitle || category.metaDescription) {
        setShowSeo(true);
      }
    } catch (err: any) {
      console.error('Failed to load category:', err);
      toast.error(err?.message || 'Failed to load category');
    } finally {
      setLoading(false);
    }
  }, [categoryId, initialData]);

  useEffect(() => {
    loadCategories();
    if (categoryId && !initialData) {
      loadCategory();
    }
  }, [loadCategories, loadCategory, categoryId, initialData]);

  // ---- Auto-slug ----
  useEffect(() => {
    if (slugTouched) return;
    if (!formData.name) return;
    setFormData((prev) => ({ ...prev, slug: slugify(prev.name) }));
  }, [formData.name, slugTouched]);

  // ---- Close icon picker on outside click ----
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        iconPickerRef.current &&
        !iconPickerRef.current.contains(e.target as Node)
      ) {
        setIconPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ---- Esc cancels ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting && onCancel) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel, submitting]);

  // ---- Field helpers ----
  const setField = useCallback(
    <K extends FieldKey>(key: K, value: FormData[K]) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    },
    [],
  );

  const markTouched = useCallback((key: FieldKey) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
  }, []);

  // ---- Validation ----
  const validateField = useCallback(
    (key: FieldKey, value: any): string | undefined => {
      switch (key) {
        case 'name':
          if (!value || !value.trim()) return 'Category name is required';
          if (value.trim().length < 2)
            return 'Name must be at least 2 characters';
          if (value.trim().length > 120)
            return 'Name must be 120 characters or fewer';
          return undefined;

        case 'slug':
          if (!value) return undefined; // auto-generated if empty
          if (!SLUG_REGEX.test(value))
            return 'Use lowercase letters, numbers, and hyphens only';
          return undefined;

        case 'description':
          if (value && value.length > 2000)
            return 'Description must be 2000 characters or fewer';
          return undefined;

        case 'image':
          if (value && !URL_REGEX.test(value))
            return 'Must be a valid URL starting with http(s)://';
          if (value && value.length > 2048)
            return 'URL is too long';
          return undefined;

        case 'icon':
          if (value && value.length > 64)
            return 'Icon must be 64 characters or fewer';
          return undefined;

        case 'color':
          if (value && !HEX_REGEX.test(value))
            return 'Use a hex value like #F97316';
          return undefined;

        case 'sortOrder':
          if (value < 0) return 'Sort order must be 0 or greater';
          return undefined;

        case 'metaTitle':
          if (value && value.length > 160)
            return 'Meta title must be 160 characters or fewer';
          return undefined;

        case 'metaDescription':
          if (value && value.length > 320)
            return 'Meta description must be 320 characters or fewer';
          return undefined;

        default:
          return undefined;
      }
    },
    [],
  );

  const validateForm = useCallback((): boolean => {
    const next: FormErrors = {};
    (Object.keys(formData) as FieldKey[]).forEach((key) => {
      const msg = validateField(key, formData[key]);
      if (msg) next[key] = msg;
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [formData, validateField]);

  // ---- Input handlers ----
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const target = e.target;
    const key = target.name as FieldKey;
    const isCheckbox = target.type === 'checkbox';
    const value = isCheckbox
      ? (target as HTMLInputElement).checked
      : target.type === 'number'
        ? Number(target.value) || 0
        : target.value;

    setField(key, value as any);
    if (key === 'slug') setSlugTouched(true);
  };

  const handleBlur = (
    e: React.FocusEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const key = e.target.name as FieldKey;
    markTouched(key);
    const msg = validateField(key, formData[key]);
    setErrors((prev) => ({ ...prev, [key]: msg }));
  };

  // ---- Submit ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || submitSuccess) return;

    // Mark all touched, then validate
    const allTouched: Partial<Record<FieldKey, boolean>> = {};
    (Object.keys(formData) as FieldKey[]).forEach((k) => {
      allTouched[k] = true;
    });
    setTouched(allTouched);

    if (!validateForm()) {
      toast.error('Please fix the highlighted fields');
      return;
    }

    try {
      setSubmitting(true);

      const payload: any = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        parentId: formData.parentId || null,
        isActive: formData.isActive,
        featured: formData.featured,
        image: formData.image.trim() || null,
        icon: formData.icon.trim() || null,
        color: formData.color.trim() || null,
        sortOrder: formData.sortOrder,
        metaTitle: formData.metaTitle.trim() || null,
        metaDescription: formData.metaDescription.trim() || null,
      };

      // Include slug whenever the user has set one (auto or manual)
      if (formData.slug.trim()) {
        payload.slug = formData.slug.trim();
      }

      let result: Category;

      if (isEdit) {
        const id = loadedCategory?.id ?? categoryId!;
        result = await categoryService.updateCategory(id, payload);
        toast.success(`Category "${result.name}" updated`);
      } else {
        result = await categoryService.createCategory({
          ...payload,
          businessUnitId,
        });
        toast.success(`Category "${result.name}" created`);
      }

      setSubmitSuccess(true);

      // Reset on create (edit stays populated in case onSuccess is delayed)
      if (!isEdit) {
        setFormData(emptyForm());
        setTouched({});
        setErrors({});
        setSlugTouched(false);
      }

      if (onSuccess) {
        // Small delay so the user sees the success banner
        setTimeout(() => onSuccess(result), 600);
      } else {
        setTimeout(() => {
          router.push('/admin/categories');
          router.refresh();
        }, 900);
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.errors?.[0]?.message ||
        err?.response?.data?.message ||
        err?.message ||
        (isEdit ? 'Failed to update category' : 'Failed to create category');
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Derived ----
  const avatarPreview = useMemo(
    () => ({
      id: loadedCategory?.id ?? 'preview',
      name: formData.name || 'New Category',
      image: formData.image || null,
      icon: formData.icon || null,
      color: formData.color || null,
    }),
    [formData.name, formData.image, formData.icon, formData.color, loadedCategory?.id],
  );

  const filteredParents = useMemo(() => {
    return categories.filter((c) => c.id !== (loadedCategory?.id ?? categoryId));
  }, [categories, loadedCategory?.id, categoryId]);

  const parentCategory = useMemo(
    () => categories.find((c) => c.id === formData.parentId) || null,
    [categories, formData.parentId],
  );

  const disabled = submitting || submitSuccess;

  // ---- Field class helpers ----
  const inputClass = (key: FieldKey, extra = ''): string => {
    const base =
      'w-full px-3 py-2.5 rounded-xl border bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all disabled:opacity-60 disabled:cursor-not-allowed';
    const state = errors[key] && touched[key]
      ? 'border-red-400 dark:border-red-500 focus:ring-red-500'
      : 'border-gray-200 dark:border-gray-700 focus:ring-blue-500';
    return `${base} ${state} ${extra}`.trim();
  };

  const fieldError = (key: FieldKey) =>
    touched[key] && errors[key] ? errors[key] : undefined;

  // ---- Loading ----
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
          Loading category…
        </p>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Success banner */}
      <AnimatePresence>
        {submitSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
          >
            <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-emerald-800 dark:text-emerald-200">
                {isEdit ? 'Category updated' : 'Category created'}
              </p>
              <p className="text-emerald-700 dark:text-emerald-300 mt-0.5">
                {onSuccess ? 'Finishing up…' : 'Redirecting…'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================
          SECTION 1 — IDENTITY
          ============================================ */}
      <section>
        <SectionHeader
          icon={<Sparkles className="w-4 h-4" />}
          title="Identity"
          subtitle="How the category appears in lists, menus, and the shop."
        />

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
          {/* Avatar preview */}
          <div className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-800/30 border border-gray-200 dark:border-gray-700">
            <CategoryAvatar
              category={avatarPreview}
              size="xl"
              rounded="xl"
              className="shadow-md"
            />
            <div className="text-center">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Avatar preview
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                image → icon → initials
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Name */}
            <Field
              label="Name"
              required
              icon={<Type className="w-4 h-4" />}
              error={fieldError('name')}
            >
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="e.g., Summer Collection"
                maxLength={120}
                autoFocus={!isEdit}
                disabled={disabled}
                className={inputClass('name')}
                aria-invalid={!!fieldError('name')}
              />
            </Field>

            {/* Slug */}
            <Field
              label="Slug"
              icon={<Hash className="w-4 h-4" />}
              error={fieldError('slug')}
              hint={
                slugTouched
                  ? 'Manually set'
                  : formData.name
                    ? 'Auto-generated from name'
                    : 'Will be auto-generated'
              }
            >
              <div className="flex items-stretch rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                <span className="flex items-center px-3 text-sm text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/60 border-r border-gray-200 dark:border-gray-700">
                  /
                </span>
                <input
                  type="text"
                  name="slug"
                  value={formData.slug}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="summer-collection"
                  disabled={disabled}
                  className="flex-1 px-3 py-2.5 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none disabled:opacity-60"
                />
                {formData.name && !disabled && (
                  <button
                    type="button"
                    onClick={() => {
                      setField('slug', slugify(formData.name));
                      setSlugTouched(false);
                    }}
                    className="px-3 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
            </Field>

            {/* Description */}
            <Field
              label="Description"
              icon={<AlignLeft className="w-4 h-4" />}
              error={fieldError('description')}
              hint={
                formData.description
                  ? `${formData.description.length} / 2000`
                  : undefined
              }
            >
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                onBlur={handleBlur}
                rows={3}
                maxLength={2000}
                placeholder="Short description of this category…"
                disabled={disabled}
                className={inputClass('description', 'resize-y')}
              />
            </Field>
          </div>
        </div>
      </section>

      {/* ============================================
          SECTION 2 — VISUAL IDENTITY
          ============================================ */}
      <section>
        <SectionHeader
          icon={<Palette className="w-4 h-4" />}
          title="Visual identity"
          subtitle="Optional image, icon, or accent color used in the avatar chain."
        />

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Image URL */}
          <Field
            label="Image URL"
            icon={<ImageIcon className="w-4 h-4" />}
            error={fieldError('image')}
            hint="Replaces icon when present"
          >
            <div className="flex items-center gap-2">
              <input
                type="url"
                name="image"
                value={formData.image}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="https://cdn.example.com/categories/summer.jpg"
                disabled={disabled}
                className={inputClass('image')}
              />
              {formData.image && (
                <a
                  href={formData.image}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0"
                  title="Preview image"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </Field>

          {/* Icon picker */}
          <Field
            label="Icon"
            icon={<Smile className="w-4 h-4" />}
            error={fieldError('icon')}
            hint="Emoji or short text"
          >
            <div className="relative" ref={iconPickerRef}>
              <div className="flex items-stretch rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                <input
                  type="text"
                  name="icon"
                  value={formData.icon}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="👕"
                  maxLength={64}
                  disabled={disabled}
                  className="flex-1 px-3 py-2.5 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => !disabled && setIconPickerOpen((v) => !v)}
                  disabled={disabled}
                  className="px-3 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l border-gray-200 dark:border-gray-700 transition-colors disabled:opacity-50"
                  aria-label="Open icon picker"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              <AnimatePresence>
                {iconPickerOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute z-20 mt-2 w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-2"
                  >
                    <div className="grid grid-cols-6 gap-1">
                      {COMMON_ICONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            setField('icon', emoji);
                            markTouched('icon');
                            setIconPickerOpen(false);
                          }}
                          className={`aspect-square flex items-center justify-center text-xl rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                            formData.icon === emoji
                              ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : ''
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Field>

          {/* Color */}
          <Field
            label="Accent color"
            icon={<Palette className="w-4 h-4" />}
            error={fieldError('color')}
            hint="Fallback color for initials avatar"
          >
            <div className="flex items-center gap-2">
              <div
                className="relative w-11 h-11 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shrink-0"
                style={{
                  backgroundColor: HEX_REGEX.test(formData.color)
                    ? formData.color
                    : '#e5e7eb',
                }}
              >
                <input
                  type="color"
                  value={
                    HEX_REGEX.test(formData.color) ? formData.color : '#3B82F6'
                  }
                  onChange={(e) => setField('color', e.target.value)}
                  disabled={disabled}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  aria-label="Pick accent color"
                />
              </div>
              <input
                type="text"
                name="color"
                value={formData.color}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="#F97316"
                disabled={disabled}
                className={inputClass('color', 'font-mono')}
              />
              {formData.color && !disabled && (
                <button
                  type="button"
                  onClick={() => setField('color', '')}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0"
                  aria-label="Clear color"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Swatches */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {DEFAULT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setField('color', c);
                    markTouched('color');
                  }}
                  className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ring-2 ring-offset-2 dark:ring-offset-gray-800 disabled:opacity-50 disabled:hover:scale-100 ${
                    formData.color.toLowerCase() === c.toLowerCase()
                      ? 'ring-gray-900 dark:ring-white'
                      : 'ring-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Set color ${c}`}
                />
              ))}
            </div>
          </Field>

          {/* Sort order */}
          <Field
            label="Sort order"
            icon={<ArrowUpDown className="w-4 h-4" />}
            error={fieldError('sortOrder')}
            hint="Lower values appear first"
          >
            <input
              type="number"
              name="sortOrder"
              min={0}
              value={formData.sortOrder}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={disabled}
              className={inputClass('sortOrder', 'tabular-nums')}
            />
          </Field>
        </div>
      </section>

      {/* ============================================
          SECTION 3 — HIERARCHY & STATUS
          ============================================ */}
      <section>
        <SectionHeader
          icon={<FolderTree className="w-4 h-4" />}
          title="Hierarchy & status"
          subtitle="Where this category sits and how it's exposed."
        />

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Parent picker */}
          <Field
            label="Parent category"
            icon={<FolderTree className="w-4 h-4" />}
            hint="Leave empty for a root category"
          >
            <select
              name="parentId"
              value={formData.parentId}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={disabled}
              className={inputClass('parentId')}
            >
              <option value="">None (top-level)</option>
              {filteredParents.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {parentCategory && (
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Nested under "{parentCategory.name}"
              </p>
            )}
          </Field>

          {/* Toggles */}
          <div className="space-y-3">
            <Toggle
              checked={formData.isActive}
              onChange={(v) => setField('isActive', v)}
              disabled={disabled}
              label="Active"
              description="Visible in the shop and API listings"
            />
            <Toggle
              checked={formData.featured}
              onChange={(v) => setField('featured', v)}
              disabled={disabled}
              label="Featured"
              description="Highlighted in featured sections"
              icon={<Star className="w-4 h-4" />}
              tone="amber"
            />
          </div>
        </div>
      </section>

      {/* ============================================
          SECTION 4 — SEO (collapsible)
          ============================================ */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowSeo((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
              <SearchIcon className="w-4 h-4" />
            </span>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                SEO metadata
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Optional — used in search engines and social previews
              </p>
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-gray-400 transition-transform ${
              showSeo ? 'rotate-180' : ''
            }`}
          />
        </button>

        <AnimatePresence initial={false}>
          {showSeo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-4 space-y-4">
                <Field
                  label="Meta title"
                  error={fieldError('metaTitle')}
                  hint={
                    formData.metaTitle
                      ? `${formData.metaTitle.length} / 160`
                      : undefined
                  }
                >
                  <input
                    type="text"
                    name="metaTitle"
                    value={formData.metaTitle}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    maxLength={160}
                    placeholder={
                      formData.name
                        ? `${formData.name} | Shop`
                        : 'Page title for search engines'
                    }
                    disabled={disabled}
                    className={inputClass('metaTitle')}
                  />
                </Field>

                <Field
                  label="Meta description"
                  error={fieldError('metaDescription')}
                  hint={
                    formData.metaDescription
                      ? `${formData.metaDescription.length} / 320`
                      : undefined
                  }
                >
                  <textarea
                    name="metaDescription"
                    value={formData.metaDescription}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    rows={2}
                    maxLength={320}
                    placeholder="Short summary that appears under the title in search results…"
                    disabled={disabled}
                    className={inputClass('metaDescription', 'resize-y')}
                  />
                </Field>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ============================================
          ACTIONS
          ============================================ */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={disabled}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium hover:from-blue-700 hover:to-indigo-700 shadow-sm hover:shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {isEdit ? 'Updating…' : 'Creating…'}
            </>
          ) : (
            <>{isEdit ? 'Update Category' : 'Create Category'}</>
          )}
        </button>
      </div>
    </form>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}

function SectionHeader({ icon, title, subtitle }: SectionHeaderProps) {
  return (
    <div className="flex items-start gap-3 pb-4 border-b border-gray-100 dark:border-gray-800">
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-600 dark:text-blue-400 shrink-0">
        {icon}
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  required?: boolean;
  icon?: React.ReactNode;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}

function Field({ label, required, icon, error, hint, children }: FieldProps) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
        {icon && <span className="text-gray-400">{icon}</span>}
        {label}
        {required && <span className="text-red-500">*</span>}
        {hint && (
          <span className="ml-auto text-xs font-normal text-gray-400 dark:text-gray-500">
            {hint}
          </span>
        )}
      </label>
      {children}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-1.5 text-xs text-red-600 dark:text-red-400 flex items-center gap-1"
          >
            <AlertCircle className="w-3 h-3 shrink-0" />
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  tone?: 'blue' | 'amber';
}

function Toggle({
  checked,
  onChange,
  disabled,
  label,
  description,
  icon,
  tone = 'blue',
}: ToggleProps) {
  const activeBg =
    tone === 'amber'
      ? 'bg-amber-500'
      : 'bg-blue-600';
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
        checked
          ? 'border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-900/10'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50'
      } disabled:opacity-60 disabled:cursor-not-allowed`}
    >
      {icon && (
        <span
          className={`shrink-0 ${
            checked && tone === 'amber'
              ? 'text-amber-500'
              : checked
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-400'
          }`}
        >
          {icon}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {label}
        </p>
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {description}
          </p>
        )}
      </div>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? activeBg : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}

export default CategoryForm;
