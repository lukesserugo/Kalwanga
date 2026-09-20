'use client';

// packages/web/app/(dashboard)/admin/catalog/edit/[id]/page.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Lock, Loader2, Save, AlertCircle, X, Plus,
  Package, DollarSign, Tag, Layers,
  CheckCircle, AlertTriangle, Eye, RefreshCw, Sun, Moon,
  Trash2, Edit, Copy,
  ImageIcon, Link2,
} from 'lucide-react';

import { usePermission } from '../../../../../../hooks/usePermission';
import { productService } from '../../../../../../services/productService';
import { categoryService } from '../../../../../../services/categoryService';
import { supplierService } from '../../../../../../services/supplierService';
import { toast } from '../../../../../../utils/toast-manager';
import { PermissionResource } from '../../../../../../types/enums';
import { useThemeStore } from '../../../../../stores/themeStore';

// ============================================
// TYPES
// ============================================

interface Category {
  id: string;
  name: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface Variant {
  id: string;
  name: string;
  sku: string;
  price: number;
  costPrice?: number;
  stock: number;
  images?: string[];
  attributes?: Record<string, any>;
  isActive?: boolean;
  barcode?: string | null;
  inventoryId?: string | null;
}

interface ProductFormData {
  name: string;
  sku: string;
  description: string;
  unitPrice: string;
  costPrice: string;
  barcode: string;
  categoryId: string;
  supplierId: string;
  isActive: boolean;
  featured: boolean;
  isDigital: boolean;
  taxRate: string;
  weight: string;
  minStock: string;
  maxStock: string;
  tags: string[];
  images: string[];
  notes: string;
  seo: {
    title: string;
    description: string;
    slug: string;
    keywords: string[];
  };
  variants: Variant[];
}

interface FormErrors {
  name?: string;
  sku?: string;
  unitPrice?: string;
  minStock?: string;
  maxStock?: string;
  [key: string]: string | undefined;
}

interface LoadedProduct {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  isActive: boolean;
  rating?: number;
  inventoryId?: string;
  inventory?: {
    id: string;
    quantity: number;
    reserved: number;
  };
}

// ============================================
// CONSTANTS
// ============================================

const PLACEHOLDER_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const SECTIONS = [
  { id: 'basic', label: 'Basic Info', icon: Package },
  { id: 'pricing', label: 'Pricing', icon: DollarSign },
  { id: 'inventory', label: 'Inventory', icon: Layers },
  { id: 'variants', label: 'Variants', icon: Layers },
  { id: 'classification', label: 'Classification', icon: Tag },
  { id: 'seo', label: 'SEO', icon: Eye },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

// ============================================
// PAGE
// ============================================

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();

  // `params?.id` can be `string | string[] | undefined`. Normalize once.
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const {
    canEdit,
    canManage,
    canDelete,
    isLoading: permissionLoading,
  } = usePermission();
  const { isDark, toggleTheme } = useThemeStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productExists, setProductExists] = useState(true);
  const [originalProduct, setOriginalProduct] = useState<LoadedProduct | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<FormErrors>({});
  const [activeSection, setActiveSection] = useState<SectionId>('basic');
  const [newTag, setNewTag] = useState('');
  const [newSeoKeyword, setNewSeoKeyword] = useState('');

  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [variantImageErrors, setVariantImageErrors] = useState<Record<string, boolean>>({});

  const [showVariantModal, setShowVariantModal] = useState(false);
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
  const [savingVariant, setSavingVariant] = useState(false);

  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    sku: '',
    description: '',
    unitPrice: '',
    costPrice: '',
    barcode: '',
    categoryId: '',
    supplierId: '',
    isActive: true,
    featured: false,
    isDigital: false,
    taxRate: '',
    weight: '',
    minStock: '5',
    maxStock: '',
    tags: [],
    images: [],
    notes: '',
    seo: {
      title: '',
      description: '',
      slug: '',
      keywords: [],
    },
    variants: [],
  });

  const canEditProducts =
    canEdit(PermissionResource.PRODUCT) ||
    canManage(PermissionResource.PRODUCT);
  const canDeleteProducts =
    canDelete(PermissionResource.PRODUCT) ||
    canManage(PermissionResource.PRODUCT);

  // ============================================
  // IMAGE HANDLERS
  // ============================================

  const handleImageError = useCallback((imageUrl: string) => {
    setImageErrors((prev) => ({ ...prev, [imageUrl]: true }));
  }, []);

  const handleVariantImageError = useCallback((imageUrl: string) => {
    setVariantImageErrors((prev) => ({ ...prev, [imageUrl]: true }));
  }, []);

  const getValidImage = useCallback(
    (imageUrl: string): string => {
      if (!imageUrl) return PLACEHOLDER_IMAGE;
      if (imageErrors[imageUrl]) return PLACEHOLDER_IMAGE;
      return imageUrl;
    },
    [imageErrors]
  );

  const getValidVariantImage = useCallback(
    (imageUrl: string): string => {
      if (!imageUrl) return PLACEHOLDER_IMAGE;
      if (variantImageErrors[imageUrl]) return PLACEHOLDER_IMAGE;
      return imageUrl;
    },
    [variantImageErrors]
  );

  /** Variant images are always an array after `loadData` maps them. */
  const getVariantImages = useCallback(
    (variant: Variant): string[] => variant.images || [],
    []
  );

  const hasVariantImages = useCallback(
    (variant: Variant): boolean =>
      Array.isArray(variant.images) && variant.images.length > 0,
    []
  );

  const getVariantFirstImage = useCallback(
    (variant: Variant): string => {
      const imgs = variant.images;
      if (imgs && imgs.length > 0) return getValidVariantImage(imgs[0]);
      return PLACEHOLDER_IMAGE;
    },
    [getValidVariantImage]
  );

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && !id) {
      router.push('/admin/catalog');
    }
  }, [isClient, id, router]);

  // ============================================
  // DATA LOADING
  // ============================================

  const loadData = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setImageErrors({});
      setVariantImageErrors({});

      const [product, categoriesData, suppliersData] = await Promise.all([
        productService.getProductById(id),
        categoryService.getAllCategories({ limit: 100, isActive: true }),
        supplierService.getAllSuppliers({ limit: 100, isActive: true }),
      ]);

      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      setSuppliers(Array.isArray(suppliersData) ? suppliersData : []);

      if (!product || !product.id) {
        setProductExists(false);
        setError('Product not found');
        setOriginalProduct(null);
        return;
      }

      const mappedVariants: Variant[] = Array.isArray(product.variants)
        ? product.variants.map((v: any) => ({
            id: v.id,
            name: v.name,
            sku: v.sku,
            price: v.price,
            costPrice: v.costPrice,
            stock: v.stock || 0,
            images: Array.isArray(v.images) ? v.images : [],
            attributes: v.attributes || {},
            isActive: v.isActive !== undefined ? v.isActive : true,
            barcode: v.barcode || null,
            inventoryId: v.inventoryId || null,
          }))
        : [];

      setFormData({
        name: product.name || '',
        sku: product.sku || '',
        description: product.description || '',
        unitPrice: product.unitPrice?.toString() || '',
        costPrice: product.costPrice?.toString() || '',
        barcode: product.barcode || '',
        categoryId: product.categoryId || '',
        supplierId: product.supplierId || '',
        isActive: product.isActive !== undefined ? product.isActive : true,
        featured: product.featured || false,
        isDigital: product.isDigital || false,
        taxRate: product.taxRate?.toString() || '',
        weight: product.weight?.toString() || '',
        minStock: product.minStock?.toString() || '5',
        maxStock: product.maxStock?.toString() || '',
        tags: Array.isArray(product.tags) ? product.tags : [],
        images: Array.isArray(product.images) ? product.images : [],
        notes: product.notes || '',
        seo: {
          title: product.seo?.title || '',
          description: product.seo?.description || '',
          slug: product.seo?.slug || '',
          keywords: Array.isArray(product.seo?.keywords)
            ? product.seo!.keywords
            : [],
        },
        variants: mappedVariants,
      });

      setOriginalProduct({
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode || undefined,
        isActive: product.isActive,
        rating: product.rating || undefined,
        inventoryId: product.inventoryId || undefined,
        inventory: product.inventory
          ? {
              id: product.inventory.id,
              quantity: product.inventory.quantity || 0,
              reserved: product.inventory.reserved || 0,
            }
          : undefined,
      });

      setProductExists(true);
    } catch (err: any) {
      console.error('Failed to load product:', err);
      if (err?.response?.status === 404) {
        setProductExists(false);
        setError('Product not found');
      } else {
        setError('Failed to load product. Please try again.');
        toast.error('Failed to load product');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    if (isClient && id && canEditProducts) {
      loadData();
    }
  }, [isClient, id, canEditProducts, loadData]);

  // ============================================
  // VALIDATION
  // ============================================

  const validateField = useCallback(
    (name: string, value: any): string => {
      switch (name) {
        case 'name':
          if (!value || !String(value).trim()) return 'Product name is required';
          if (String(value).trim().length < 2)
            return 'Product name must be at least 2 characters';
          return '';
        case 'sku':
          if (!value || !String(value).trim()) return 'SKU is required';
          if (String(value).trim().length < 2)
            return 'SKU must be at least 2 characters';
          return '';
        case 'unitPrice':
          if (value === '' || value === null || value === undefined)
            return 'Unit price is required';
          if (parseFloat(String(value)) < 0)
            return 'Unit price must be greater than or equal to 0';
          return '';
        case 'minStock':
          if (value && parseInt(String(value), 10) < 0)
            return 'Min stock must be greater than or equal to 0';
          return '';
        case 'maxStock':
          if (value && parseInt(String(value), 10) < 0)
            return 'Max stock must be greater than or equal to 0';
          if (
            value &&
            formData.minStock &&
            parseInt(String(value), 10) < parseInt(formData.minStock, 10)
          ) {
            return 'Max stock must be greater than min stock';
          }
          return '';
        default:
          return '';
      }
    },
    [formData.minStock]
  );

  const handleBlur = useCallback(
    (field: string, value: any) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      const error = validateField(field, value);
      setErrors((prev) => {
        const next = { ...prev };
        if (error) next[field] = error;
        else delete next[field];
        return next;
      });
    },
    [validateField]
  );

  // ============================================
  // SUBMIT / DELETE / REFRESH
  // ============================================

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!id) return;

      const requiredFields = ['name', 'sku', 'unitPrice'];
      const newErrors: FormErrors = {};
      let hasError = false;

      requiredFields.forEach((field) => {
        const value = formData[field as keyof typeof formData];
        const error = validateField(field, value);
        if (error) {
          newErrors[field] = error;
          hasError = true;
        }
      });

      if (hasError) {
        setErrors(newErrors);
        toast.error('Please fix all errors before submitting');
        const firstErrorField = Object.keys(newErrors)[0];
        const element = document.querySelector(`[name="${firstErrorField}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      setSaving(true);

      try {
        // The service's `Product` type declares `category?: any` and
        // `supplier?: any` — the update payload can safely carry
        // `categoryId`/`supplierId` because the service maps them
        // internally. Cast through `any` so the compile-time shape
        // doesn't need to match every field.
        const data: any = {
          name: formData.name.trim(),
          sku: formData.sku.trim().toUpperCase(),
          description: formData.description.trim() || undefined,
          unitPrice: parseFloat(formData.unitPrice),
          costPrice: formData.costPrice
            ? parseFloat(formData.costPrice)
            : undefined,
          barcode: formData.barcode.trim() || undefined,
          categoryId: formData.categoryId || undefined,
          supplierId: formData.supplierId || undefined,
          isActive: formData.isActive,
          featured: formData.featured,
          isDigital: formData.isDigital,
          taxRate: formData.taxRate ? parseFloat(formData.taxRate) : undefined,
          weight: formData.weight ? parseFloat(formData.weight) : undefined,
          minStock: formData.minStock ? parseInt(formData.minStock, 10) : 5,
          maxStock: formData.maxStock
            ? parseInt(formData.maxStock, 10)
            : undefined,
          tags: formData.tags,
          images: formData.images,
          notes: formData.notes.trim() || undefined,
          seo: {
            title: formData.seo.title.trim() || undefined,
            description: formData.seo.description.trim() || undefined,
            slug: formData.seo.slug.trim() || undefined,
            keywords: formData.seo.keywords,
          },
          variants: formData.variants.map((v) => ({
            id: v.id,
            name: v.name,
            sku: v.sku,
            price: v.price,
            costPrice: v.costPrice || 0,
            stock: v.stock || 0,
            images: v.images || [],
            attributes: v.attributes || {},
            isActive: v.isActive !== undefined ? v.isActive : true,
            barcode: v.barcode || undefined,
          })),
        };

        const result = await productService.updateProduct(id, data);
        if (result) {
          setOriginalProduct((prev) =>
            prev
              ? {
                  ...prev,
                  name: result.name || prev.name,
                  sku: result.sku || prev.sku,
                  barcode: result.barcode || prev.barcode,
                  isActive: result.isActive !== false,
                }
              : prev
          );
        }
        toast.success('Product updated successfully');

        setTimeout(() => {
          router.push('/admin/catalog');
          router.refresh();
        }, 1500);
      } catch (err: any) {
        console.error('Error updating product:', err);
        const message =
          err?.response?.data?.message ||
          err?.message ||
          'Failed to update product';
        toast.error(message);
      } finally {
        setSaving(false);
      }
    },
    [formData, id, router, validateField]
  );

  const handleDelete = useCallback(async () => {
    if (!id) return;

    if (!canDeleteProducts) {
      toast.error("You don't have permission to delete products");
      return;
    }

    setDeleting(true);
    try {
      await productService.deleteProduct(id);
      toast.success('Product deleted successfully');
      router.push('/admin/catalog');
    } catch (err: any) {
      console.error('Failed to delete product:', err);
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to delete product';
      toast.error(message);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }, [id, canDeleteProducts, router]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
      toast.success('Product refreshed');
    } catch {
      // loadData handles its own error state + toast.
    }
  }, [loadData]);

  const handleCopyId = useCallback(() => {
    if (!id) return;
    navigator.clipboard
      .writeText(id)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('Product ID copied');
      })
      .catch(() => toast.error('Failed to copy ID'));
  }, [id]);

  // ============================================
  // VARIANT HANDLERS
  // ============================================

  const handleEditVariant = useCallback((variant: Variant) => {
    setEditingVariant({ ...variant });
    setShowVariantModal(true);
  }, []);

  const handleSaveVariant = useCallback(async () => {
    if (!editingVariant) return;

    setSavingVariant(true);
    try {
      await productService.updateVariant(editingVariant.id, {
        name: editingVariant.name,
        sku: editingVariant.sku,
        price: editingVariant.price,
        costPrice: editingVariant.costPrice,
        stock: editingVariant.stock,
        images: editingVariant.images || [],
        attributes: editingVariant.attributes || {},
        isActive: editingVariant.isActive,
      });
      toast.success('Variant updated successfully');
      setShowVariantModal(false);
      await loadData();
    } catch (err: any) {
      console.error('Failed to update variant:', err);
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to update variant'
      );
    } finally {
      setSavingVariant(false);
    }
  }, [editingVariant, loadData]);

  const handleDeleteVariant = useCallback(
    async (variantId: string) => {
      if (!confirm('Are you sure you want to delete this variant?')) return;

      try {
        await productService.deleteVariant(variantId);
        toast.success('Variant deleted successfully');
        await loadData();
      } catch (err: any) {
        console.error('Failed to delete variant:', err);
        toast.error(
          err?.response?.data?.message ||
            err?.message ||
            'Failed to delete variant'
        );
      }
    },
    [loadData]
  );

  // ============================================
  // TAG / SEO
  // ============================================

  const addTag = useCallback(() => {
    const trimmed = newTag.trim();
    if (trimmed && !formData.tags.includes(trimmed)) {
      setFormData((prev) => ({ ...prev, tags: [...prev.tags, trimmed] }));
      setNewTag('');
    }
  }, [newTag, formData.tags]);

  const removeTag = useCallback((tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  }, []);

  const addSeoKeyword = useCallback(() => {
    const trimmed = newSeoKeyword.trim();
    if (trimmed && !formData.seo.keywords.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        seo: { ...prev.seo, keywords: [...prev.seo.keywords, trimmed] },
      }));
      setNewSeoKeyword('');
    }
  }, [newSeoKeyword, formData.seo.keywords]);

  const removeSeoKeyword = useCallback((keyword: string) => {
    setFormData((prev) => ({
      ...prev,
      seo: {
        ...prev.seo,
        keywords: prev.seo.keywords.filter((k) => k !== keyword),
      },
    }));
  }, []);

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTag();
      }
    },
    [addTag]
  );

  const handleSeoKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addSeoKeyword();
      }
    },
    [addSeoKeyword]
  );

  // ============================================
  // DERIVED
  // ============================================

  const productName = originalProduct?.name || 'Product';
  const productStatus = originalProduct?.isActive ? 'Active' : 'Inactive';
  const productStatusColor = originalProduct?.isActive
    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';

  const mainStock = originalProduct?.inventory?.quantity || 0;
  const variantStock = formData.variants.reduce(
    (sum, v) => sum + (v.stock || 0),
    0
  );
  const totalStock = mainStock + variantStock;

  const idPreview = id ? id.slice(0, 8) : '';

  // ============================================
  // EARLY RETURNS
  // ============================================

  if (!id) {
    // The redirect effect above has already fired. Render a spinner so
    // the transition is smooth instead of returning null mid-render.
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
      </div>
    );
  }

  if (permissionLoading || !isClient || (loading && !originalProduct)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading product...
          </p>
        </div>
      </div>
    );
  }

  if (!canEditProducts) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to edit products. Please contact your
          administrator.
        </p>
        <button
          onClick={() => router.push('/admin/catalog')}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Catalog
        </button>
      </div>
    );
  }

  if (!productExists) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="w-24 h-24 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-12 h-12 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Product Not Found
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          The product you're trying to edit doesn't exist or has been removed.
        </p>
        <button
          onClick={() => router.push('/admin/catalog')}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Catalog
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="w-24 h-24 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-12 h-12 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Error Loading Product
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          {error}
        </p>
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={loadData}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Loader2 className="w-4 h-4" />
            Retry
          </button>
          <button
            onClick={() => router.push('/admin/catalog')}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Back to Catalog
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 transition-colors duration-200">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/catalog')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Back to catalog"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Edit Product
                </h1>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${productStatusColor}`}
                >
                  {productStatus}
                </span>
                {originalProduct?.inventoryId && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 flex items-center gap-1">
                    <Link2 className="w-3 h-3" />
                    Linked to Inventory
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <Package className="w-4 h-4" />
                  {productName}
                </span>
                <span className="flex items-center gap-1">
                  <Tag className="w-4 h-4" />
                  SKU: {originalProduct?.sku || 'N/A'}
                </span>
                <button
                  onClick={handleCopyId}
                  className="flex items-center gap-1 text-xs hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  title="Copy full product ID"
                >
                  ID: {idPreview}
                  {copied ? (
                    <CheckCircle className="w-3 h-3 text-green-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              aria-label="Refresh product"
            >
              <RefreshCw
                className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`}
              />
            </button>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle theme"
            >
              {isDark ? (
                <Sun className="w-5 h-5 text-yellow-500" />
              ) : (
                <Moon className="w-5 h-5 text-gray-600" />
              )}
            </button>

            <Link
              href={`/shop/${id}`}
              target="_blank"
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="View product"
            >
              <Eye className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </Link>

            {canDeleteProducts && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="p-2 rounded-lg border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                aria-label="Delete product"
              >
                <Trash2 className="w-5 h-5 text-red-500" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Price</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              ${parseFloat(formData.unitPrice || '0').toFixed(2)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Total Stock
            </p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              {totalStock}
              {variantStock > 0 && (
                <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">
                  ({mainStock} + {variantStock} variants)
                </span>
              )}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Variants</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              {formData.variants.length}
              {formData.variants.some((v) => hasVariantImages(v)) && (
                <ImageIcon className="w-3 h-3 inline ml-1 text-purple-500" />
              )}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Rating</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              {originalProduct?.rating?.toFixed(1) || 'N/A'}
            </p>
          </div>
        </div>

        {/* Variant Images Summary */}
        {formData.variants.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-500" />
              Variant Images Summary
            </h3>
            <div className="flex flex-wrap gap-3">
              {formData.variants.map((variant) => {
                const variantImages = getVariantImages(variant);
                return (
                  <div
                    key={variant.id}
                    className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2"
                  >
                    <div className="w-10 h-10 rounded-md overflow-hidden bg-gray-200 dark:bg-gray-600 flex-shrink-0">
                      {variantImages.length > 0 ? (
                        <img
                          src={getVariantFirstImage(variant)}
                          alt={variant.name}
                          className="w-full h-full object-cover"
                          onError={() =>
                            handleVariantImageError(variantImages[0])
                          }
                        />
                      ) : (
                        <Layers className="w-full h-full p-2 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {variant.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {variantImages.length} image(s)
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section Navigation */}
        <div className="flex flex-wrap gap-2 mb-6">
          {SECTIONS.map(({ id: sectionId, label, icon: Icon }) => (
            <button
              key={sectionId}
              onClick={() => setActiveSection(sectionId)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeSection === sectionId
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 space-y-6 transition-colors duration-200"
        >
          {/* BASIC */}
          {activeSection === 'basic' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-500" />
                Basic Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Product Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      if (touched.name) {
                        const error = validateField('name', e.target.value);
                        setErrors((prev) => ({ ...prev, name: error }));
                      }
                    }}
                    onBlur={(e) => handleBlur('name', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200 ${
                      errors.name
                        ? 'border-red-500 dark:border-red-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="Enter product name"
                    aria-invalid={!!errors.name}
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    SKU <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="sku"
                    required
                    value={formData.sku}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        sku: e.target.value.toUpperCase(),
                      });
                      if (touched.sku) {
                        const error = validateField('sku', e.target.value);
                        setErrors((prev) => ({ ...prev, sku: error }));
                      }
                    }}
                    onBlur={(e) => handleBlur('sku', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200 ${
                      errors.sku
                        ? 'border-red-500 dark:border-red-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="Enter SKU"
                    aria-invalid={!!errors.sku}
                  />
                  {errors.sku && (
                    <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.sku}
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                    placeholder="Enter product description"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Barcode
                  </label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) =>
                      setFormData({ ...formData, barcode: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                    placeholder="Enter barcode"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                    placeholder="Internal notes about this product"
                  />
                </div>

                <div className="md:col-span-2 flex flex-wrap gap-4 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          isActive: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 transition-colors duration-200"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Active
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.featured}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          featured: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-yellow-500 border-gray-300 dark:border-gray-600 rounded focus:ring-yellow-500 bg-white dark:bg-gray-700 transition-colors duration-200"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Featured
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isDigital}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          isDigital: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-purple-500 border-gray-300 dark:border-gray-600 rounded focus:ring-purple-500 bg-white dark:bg-gray-700 transition-colors duration-200"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Digital Product
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* PRICING */}
          {activeSection === 'pricing' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-500" />
                Pricing
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Unit Price <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                      $
                    </span>
                    <input
                      type="number"
                      name="unitPrice"
                      required
                      step="0.01"
                      min="0"
                      value={formData.unitPrice}
                      onChange={(e) => {
                        setFormData({ ...formData, unitPrice: e.target.value });
                        if (touched.unitPrice) {
                          const error = validateField(
                            'unitPrice',
                            e.target.value
                          );
                          setErrors((prev) => ({
                            ...prev,
                            unitPrice: error,
                          }));
                        }
                      }}
                      onBlur={(e) => handleBlur('unitPrice', e.target.value)}
                      className={`w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200 ${
                        errors.unitPrice
                          ? 'border-red-500 dark:border-red-500'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                      placeholder="0.00"
                      aria-invalid={!!errors.unitPrice}
                    />
                  </div>
                  {errors.unitPrice && (
                    <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.unitPrice}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Cost Price
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.costPrice}
                      onChange={(e) =>
                        setFormData({ ...formData, costPrice: e.target.value })
                      }
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.taxRate}
                    onChange={(e) =>
                      setFormData({ ...formData, taxRate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.weight}
                    onChange={(e) =>
                      setFormData({ ...formData, weight: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                    placeholder="0.00"
                  />
                </div>

                {formData.unitPrice && (
                  <div className="md:col-span-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                    <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                      Price Summary
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">
                          Unit Price:
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white ml-2">
                          ${parseFloat(formData.unitPrice || '0').toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">
                          Cost Price:
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white ml-2">
                          ${parseFloat(formData.costPrice || '0').toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">
                          Tax Rate:
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white ml-2">
                          {formData.taxRate || 0}%
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">
                          Profit Margin:
                        </span>
                        <span className="font-medium text-green-600 dark:text-green-400 ml-2">
                          {formData.costPrice &&
                          parseFloat(formData.costPrice) > 0
                            ? `${(
                                ((parseFloat(formData.unitPrice) -
                                  parseFloat(formData.costPrice)) /
                                  parseFloat(formData.unitPrice)) *
                                100
                              ).toFixed(1)}%`
                            : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* INVENTORY */}
          {activeSection === 'inventory' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-500" />
                Inventory
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Min Stock Level
                  </label>
                  <input
                    type="number"
                    name="minStock"
                    value={formData.minStock}
                    onChange={(e) => {
                      setFormData({ ...formData, minStock: e.target.value });
                      if (touched.minStock) {
                        const error = validateField('minStock', e.target.value);
                        setErrors((prev) => ({ ...prev, minStock: error }));
                      }
                    }}
                    onBlur={(e) => handleBlur('minStock', e.target.value)}
                    min="0"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200 ${
                      errors.minStock
                        ? 'border-red-500 dark:border-red-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    aria-invalid={!!errors.minStock}
                  />
                  {errors.minStock && (
                    <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.minStock}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Max Stock Level
                  </label>
                  <input
                    type="number"
                    name="maxStock"
                    value={formData.maxStock}
                    onChange={(e) => {
                      setFormData({ ...formData, maxStock: e.target.value });
                      if (touched.maxStock) {
                        const error = validateField('maxStock', e.target.value);
                        setErrors((prev) => ({ ...prev, maxStock: error }));
                      }
                    }}
                    onBlur={(e) => handleBlur('maxStock', e.target.value)}
                    min="0"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200 ${
                      errors.maxStock
                        ? 'border-red-500 dark:border-red-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    aria-invalid={!!errors.maxStock}
                  />
                  {errors.maxStock && (
                    <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.maxStock}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-2">
                  Inventory Settings
                </h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Products will be notified when stock falls below{' '}
                  <strong>{formData.minStock || 5}</strong> units.
                  {formData.maxStock &&
                    ` Maximum stock capacity is ${formData.maxStock} units.`}
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Current stock: <strong>{mainStock}</strong> units
                  {variantStock > 0 && (
                    <>
                      {' '}
                      + <strong>{variantStock}</strong> variant units
                    </>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* VARIANTS */}
          {activeSection === 'variants' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Layers className="w-5 h-5 text-orange-500" />
                Variants ({formData.variants.length})
              </h2>

              {formData.variants.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <Layers className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">
                    No variants for this product
                  </p>
                  <Link
                    href={`/admin/catalog/edit/${id}?addVariant=true`}
                    className="mt-4 inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4 inline mr-2" />
                    Add Variants
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.variants.map((variant) => {
                    const variantImages = getVariantImages(variant);
                    return (
                      <div
                        key={variant.id}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                              {variantImages.length > 0 ? (
                                <img
                                  src={getValidVariantImage(variantImages[0])}
                                  alt={variant.name}
                                  className="w-full h-full object-cover"
                                  onError={() =>
                                    handleVariantImageError(variantImages[0])
                                  }
                                />
                              ) : (
                                <Layers className="w-full h-full p-3 text-gray-400" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {variant.name}
                              </p>
                              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                                <span className="font-mono">
                                  SKU: {variant.sku}
                                </span>
                                <span className="font-medium text-gray-900 dark:text-white">
                                  ${variant.price?.toFixed(2) || '0.00'}
                                </span>
                                <span>Stock: {variant.stock}</span>
                                {variant.barcode && (
                                  <span className="text-xs">
                                    Barcode: {variant.barcode}
                                  </span>
                                )}
                                {variant.inventoryId && (
                                  <span className="text-xs text-blue-500 flex items-center gap-1">
                                    <Link2 className="w-3 h-3" />
                                    Inventory Linked
                                  </span>
                                )}
                              </div>
                              {variantImages.length > 1 && (
                                <div className="flex gap-1 mt-2">
                                  {variantImages
                                    .slice(1, 4)
                                    .map((img, idx) => (
                                      <div
                                        key={`${img.slice(0, 24)}-${idx}`}
                                        className="w-10 h-10 rounded-md overflow-hidden border border-gray-200 dark:border-gray-600"
                                      >
                                        <img
                                          src={getValidVariantImage(img)}
                                          alt={`${variant.name} ${idx + 2}`}
                                          className="w-full h-full object-cover"
                                          onError={() =>
                                            handleVariantImageError(img)
                                          }
                                        />
                                      </div>
                                    ))}
                                  {variantImages.length > 4 && (
                                    <div className="w-10 h-10 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-500">
                                      +{variantImages.length - 4}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                variant.isActive
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                              }`}
                            >
                              {variant.isActive ? 'Active' : 'Inactive'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleEditVariant(variant)}
                              className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                              title="Edit variant"
                            >
                              <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteVariant(variant.id)}
                              className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                              title="Delete variant"
                            >
                              <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Edit Variant Modal */}
              {showVariantModal && editingVariant && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div
                    className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
                    onClick={() => setShowVariantModal(false)}
                  />
                  <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => setShowVariantModal(false)}
                      className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      aria-label="Close"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>

                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                      Edit Variant
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Name
                        </label>
                        <input
                          type="text"
                          value={editingVariant.name}
                          onChange={(e) =>
                            setEditingVariant({
                              ...editingVariant,
                              name: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          SKU
                        </label>
                        <input
                          type="text"
                          value={editingVariant.sku}
                          onChange={(e) =>
                            setEditingVariant({
                              ...editingVariant,
                              sku: e.target.value.toUpperCase(),
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Price
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editingVariant.price}
                            onChange={(e) =>
                              setEditingVariant({
                                ...editingVariant,
                                price: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Stock
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={editingVariant.stock}
                            onChange={(e) =>
                              setEditingVariant({
                                ...editingVariant,
                                stock: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingVariant.isActive !== false}
                          onChange={(e) =>
                            setEditingVariant({
                              ...editingVariant,
                              isActive: e.target.checked,
                            })
                          }
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Active
                        </span>
                      </label>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                      <button
                        type="button"
                        onClick={() => setShowVariantModal(false)}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveVariant}
                        disabled={savingVariant}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors"
                      >
                        {savingVariant ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        {savingVariant ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CLASSIFICATION */}
          {activeSection === 'classification' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Tag className="w-5 h-5 text-orange-500" />
                Classification
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) =>
                      setFormData({ ...formData, categoryId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200"
                  >
                    <option value="">Select Category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Supplier
                  </label>
                  <select
                    value={formData.supplierId}
                    onChange={(e) =>
                      setFormData({ ...formData, supplierId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((sup) => (
                      <option key={sup.id} value={sup.id}>
                        {sup.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tags
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2 mb-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={handleTagKeyDown}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                        placeholder="Add a tag"
                      />
                      {newTag && (
                        <button
                          type="button"
                          onClick={() => setNewTag('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          aria-label="Clear tag input"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={addTag}
                      disabled={!newTag.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors whitespace-nowrap flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>
                  {formData.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {formData.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm transition-colors duration-200"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="hover:text-blue-900 dark:hover:text-blue-100 transition-colors"
                            aria-label={`Remove tag ${tag}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No tags added yet
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SEO */}
          {activeSection === 'seo' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5 text-indigo-500" />
                SEO
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    SEO Title
                  </label>
                  <input
                    type="text"
                    value={formData.seo.title}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        seo: { ...prev.seo, title: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                    placeholder="SEO title (max 60 characters)"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {formData.seo.title.length}/60 characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    SEO Description
                  </label>
                  <textarea
                    value={formData.seo.description}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        seo: { ...prev.seo, description: e.target.value },
                      }))
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                    placeholder="SEO description (max 160 characters)"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {formData.seo.description.length}/160 characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    URL Slug
                  </label>
                  <input
                    type="text"
                    value={formData.seo.slug}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        seo: { ...prev.seo, slug: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                    placeholder="custom-url-slug"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {formData.seo.slug
                      ? `https://example.com/products/${formData.seo.slug}`
                      : 'No slug set'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    SEO Keywords
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2 mb-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={newSeoKeyword}
                        onChange={(e) => setNewSeoKeyword(e.target.value)}
                        onKeyDown={handleSeoKeyDown}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                        placeholder="Add a keyword"
                      />
                      {newSeoKeyword && (
                        <button
                          type="button"
                          onClick={() => setNewSeoKeyword('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          aria-label="Clear keyword input"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={addSeoKeyword}
                      disabled={!newSeoKeyword.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors whitespace-nowrap flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.seo.keywords.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No keywords added yet
                      </p>
                    ) : (
                      formData.seo.keywords.map((keyword) => (
                        <span
                          key={keyword}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm transition-colors duration-200"
                        >
                          {keyword}
                          <button
                            type="button"
                            onClick={() => removeSeoKeyword(keyword)}
                            className="hover:text-red-600 transition-colors"
                            aria-label={`Remove keyword ${keyword}`}
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                    Search Engine Preview
                  </h4>
                  <div className="space-y-1">
                    <p className="text-lg text-blue-600 hover:underline cursor-pointer">
                      {formData.seo.title || formData.name || 'Product Title'}
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-400">
                      {formData.seo.slug
                        ? `https://example.com/products/${formData.seo.slug}`
                        : 'https://example.com/products/...'}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                      {formData.seo.description || 'No description provided'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6 flex flex-col sm:flex-row items-center justify-end gap-3">
            <Link
              href="/admin/catalog"
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 w-full sm:w-auto text-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Update Product
                </>
              )}
            </button>
          </div>
        </form>

        {/* Delete Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
              onClick={() => setShowDeleteModal(false)}
            />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Delete Product
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This action cannot be undone
                  </p>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to delete{' '}
                <strong className="text-gray-900 dark:text-white">
                  {productName}
                </strong>
                ? This will permanently remove the product and all associated
                data, including variants, inventory, and sales history.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {deleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  {deleting ? 'Deleting...' : 'Delete Product'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
