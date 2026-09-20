'use client';

// D:\Projects\Kalwanga\packages\web\components\products\ProductVariants.tsx

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  Barcode,
  Layers,
  Loader2,
  ChevronDown,
  AlertTriangle,
  Upload,
  Search,
  Wand2,
  Link2,
  Image as ImageIcon,
} from 'lucide-react';

import {
  productService,
  type ProductVariant,
} from '../../services/productService';
import { toast } from '../../utils/toast-manager';
import { formatCurrency, formatDate } from '../../utils/formatters';

// ============================================
// TYPES
// ============================================

/**
 * The canonical `ProductVariant` type does not expose `barcode` or
 * `inventoryId` — the backend returns both on the wire but the shared
 * type hasn't been widened yet. Rather than edit the shared type
 * (which would ripple into ProductCard, ProductDetail, ProductCompare,
 * and every other consumer), declare a local intersection that adds
 * the two fields as optional.
 */
type ExtendedVariant = ProductVariant & {
  barcode?: string | null;
  inventoryId?: string | null;
};

interface ProductVariantsProps {
  productId: string;
  variants: ProductVariant[];
  onUpdate: (variants: ProductVariant[]) => void;
  canManage?: boolean;
  productName?: string;
  productSku?: string;
}

interface VariantFormData {
  id?: string;
  name: string;
  sku: string;
  price: number;
  costPrice: number;
  stock: number;
  attributes: Record<string, any>;
  images?: string[];
  isActive: boolean;
  barcode?: string;
  inventoryId?: string | null;
}

// ============================================
// CONSTANTS
// ============================================

const MAX_IMAGE_SIZE = 150 * 1024;
const MAX_IMAGE_DIMENSION = 500;
const MAX_FILE_SIZE = 3 * 1024 * 1024;
const MAX_VARIANT_IMAGES = 3;

const DEFAULT_VARIANT_FORM: VariantFormData = {
  name: '',
  sku: '',
  price: 0,
  costPrice: 0,
  stock: 0,
  attributes: {},
  images: [],
  isActive: true,
};

// ============================================
// HELPERS
// ============================================

function compressImage(
  dataUrl: string,
  maxWidth: number = MAX_IMAGE_DIMENSION,
  maxHeight: number = MAX_IMAGE_DIMENSION,
  quality: number = 0.35,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (maxHeight / height) * width;
          height = maxHeight;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

async function processImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const result = reader.result as string;
        let quality = 0.4;
        let compressed = await compressImage(
          result,
          MAX_IMAGE_DIMENSION,
          MAX_IMAGE_DIMENSION,
          quality,
        );

        let attempts = 0;
        while (
          compressed.length > MAX_IMAGE_SIZE &&
          quality > 0.08 &&
          attempts < 12
        ) {
          quality -= 0.03;
          compressed = await compressImage(
            result,
            MAX_IMAGE_DIMENSION,
            MAX_IMAGE_DIMENSION,
            quality,
          );
          attempts++;
        }

        if (compressed.length > MAX_IMAGE_SIZE) {
          compressed = await compressImage(result, 300, 300, 0.25);
        }

        resolve(compressed);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Generate a variant SKU. Includes a monotonic counter so two calls in
 * the same millisecond can't collide. The counter is module-scoped and
 * resets on page reload — SKU uniqueness is still enforced server-side.
 */
let variantSkuCounter = 0;
function generateVariantSkuString(
  productSku?: string,
  productName?: string,
): string {
  const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  const counter = (++variantSkuCounter % 1000).toString(36).toUpperCase();
  const basePrefix =
    (productSku || productName || 'VAR')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 3)
      .toUpperCase() || 'VAR';
  return `${basePrefix}-${timestamp}${counter}-${random}`;
}

function extractErrorMessage(err: any, fallback: string): string {
  if (!err) return fallback;
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.message) return err.message;
  return fallback;
}

/**
 * A form is valid when `name`, `sku`, and `price` are populated.
 * `price` is checked with `>= 0` rather than truthiness — a free
 * variant (`price: 0`) is valid.
 */
function isVariantFormValid(form: VariantFormData): {
  valid: boolean;
  message?: string;
} {
  if (!form.name?.trim()) return { valid: false, message: 'Name is required' };
  if (!form.sku?.trim()) return { valid: false, message: 'SKU is required' };
  if (typeof form.price !== 'number' || form.price < 0) {
    return { valid: false, message: 'Price must be 0 or greater' };
  }
  return { valid: true };
}

// ============================================
// COMPONENT
// ============================================

export function ProductVariants({
  productId,
  variants,
  onUpdate,
  canManage = true,
  productName = '',
  productSku = '',
}: ProductVariantsProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  // Track which variant is being edited by id, not by array index.
  // Filtering by search or active state re-orders the visible list, so
  // an index would target the wrong row.
  const [editingVariantId, setEditingVariantId] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [newVariant, setNewVariant] =
    useState<VariantFormData>(DEFAULT_VARIANT_FORM);
  const [editVariant, setEditVariant] = useState<VariantFormData | null>(
    null,
  );
  const [expandedVariants, setExpandedVariants] = useState<Set<string>>(
    new Set(),
  );
  const [selectedVariants, setSelectedVariants] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<
    'all' | 'active' | 'inactive'
  >('all');

  // ✅ Refs instead of `document.getElementById`.
  const bulkStockInputRef = useRef<HTMLInputElement>(null);

  // ============================================
  // FILTERING
  // ============================================

  const filteredVariants = useMemo<ExtendedVariant[]>(() => {
    let result = variants as ExtendedVariant[];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (v) =>
          v.name.toLowerCase().includes(term) ||
          v.sku.toLowerCase().includes(term),
      );
    }

    if (filterActive !== 'all') {
      result = result.filter((v) =>
        filterActive === 'active'
          ? v.isActive !== false
          : v.isActive === false,
      );
    }

    return result;
  }, [variants, searchTerm, filterActive]);

  const totalStock = useMemo(
    () => variants.reduce((sum, v) => sum + (v.stock || 0), 0),
    [variants],
  );

  const averagePrice = useMemo(() => {
    if (variants.length === 0) return 0;
    return variants.reduce((sum, v) => sum + v.price, 0) / variants.length;
  }, [variants]);

  const hasAnyVariantImages = useMemo(
    () => variants.some((v) => v.images && v.images.length > 0),
    [variants],
  );

  // ============================================
  // SKU GENERATOR
  // ============================================

  const generateVariantSku = useCallback(
    () => generateVariantSkuString(productSku, productName),
    [productSku, productName],
  );

  // ============================================
  // IMAGE UPLOAD
  // ============================================

  const handleVariantImageUpload = useCallback(
    async (
      e: React.ChangeEvent<HTMLInputElement>,
      target: 'new' | 'edit',
    ) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const currentImages =
        target === 'new'
          ? newVariant.images || []
          : editVariant?.images || [];

      if (currentImages.length >= MAX_VARIANT_IMAGES) {
        toast.error(`Maximum ${MAX_VARIANT_IMAGES} images per variant`);
        e.target.value = '';
        return;
      }

      const validFiles: File[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} is not an image file`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          toast.error(
            `${file.name} exceeds the ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
          );
          continue;
        }
        if (
          currentImages.length + validFiles.length >=
          MAX_VARIANT_IMAGES
        ) {
          toast.warning(
            `Maximum ${MAX_VARIANT_IMAGES} images per variant, skipping remaining`,
          );
          break;
        }
        validFiles.push(file);
      }

      if (validFiles.length === 0) {
        e.target.value = '';
        return;
      }

      const newImages: string[] = [];
      for (const file of validFiles) {
        try {
          const compressed = await processImageFile(file);
          newImages.push(compressed);
        } catch (err) {
          console.error('Failed to process variant image:', err);
          toast.error(`Failed to process ${file.name}`);
        }
      }

      if (newImages.length > 0) {
        if (target === 'new') {
          setNewVariant((prev) => ({
            ...prev,
            images: [...(prev.images || []), ...newImages],
          }));
        } else {
          setEditVariant((prev) =>
            prev
              ? {
                  ...prev,
                  images: [...(prev.images || []), ...newImages],
                }
              : null,
          );
        }
        toast.success(`${newImages.length} variant image(s) uploaded`);
      }

      e.target.value = '';
    },
    [newVariant.images, editVariant?.images],
  );

  const removeVariantImage = useCallback(
    (index: number, target: 'new' | 'edit') => {
      if (target === 'new') {
        setNewVariant((prev) => ({
          ...prev,
          images: (prev.images || []).filter((_, i) => i !== index),
        }));
      } else {
        setEditVariant((prev) =>
          prev
            ? {
                ...prev,
                images: (prev.images || []).filter((_, i) => i !== index),
              }
            : null,
        );
      }
    },
    [],
  );

  // ============================================
  // CRUD
  // ============================================

  const handleAddVariant = useCallback(async () => {
    // ✅ Explicit validity check — `price: 0` (free variant) is valid.
    const validity = isVariantFormValid(newVariant);
    if (!validity.valid) {
      toast.error(validity.message ?? 'Invalid variant data');
      return;
    }

    setLoading(true);
    try {
      const result = await productService.addVariant(productId, {
        name: newVariant.name.trim(),
        sku: newVariant.sku.toUpperCase().trim(),
        price: newVariant.price,
        costPrice: newVariant.costPrice || 0,
        stock: newVariant.stock || 0,
        attributes: newVariant.attributes || {},
        isActive: newVariant.isActive !== false,
        images: newVariant.images || [],
      });

      onUpdate([...variants, result]);
      setNewVariant(DEFAULT_VARIANT_FORM);
      setShowAddForm(false);
      toast.success('Variant added successfully');
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to add variant'));
    } finally {
      setLoading(false);
    }
  }, [newVariant, productId, variants, onUpdate]);

  const handleEditVariant = useCallback(async () => {
    if (!editVariant || !editVariant.id) return;

    // ✅ Mirror the validation from `handleAddVariant`.
    const validity = isVariantFormValid(editVariant);
    if (!validity.valid) {
      toast.error(validity.message ?? 'Invalid variant data');
      return;
    }

    setLoading(true);
    try {
      const result = await productService.updateVariant(editVariant.id, {
        name: editVariant.name.trim(),
        sku: editVariant.sku.toUpperCase().trim(),
        price: editVariant.price,
        costPrice: editVariant.costPrice || 0,
        stock: editVariant.stock || 0,
        attributes: editVariant.attributes || {},
        isActive: editVariant.isActive !== false,
        images: editVariant.images || [],
      });

      onUpdate(variants.map((v) => (v.id === result.id ? result : v)));
      setEditingVariantId(null);
      setEditVariant(null);
      toast.success('Variant updated successfully');
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to update variant'));
    } finally {
      setLoading(false);
    }
  }, [editVariant, variants, onUpdate]);

  const handleDeleteVariant = useCallback(
    async (variantId: string) => {
      const variant = variants.find((v) => v.id === variantId);
      if (!variant) return;
      if (
        !confirm(
          `Are you sure you want to delete variant "${variant.name}"?`,
        )
      ) {
        return;
      }

      setLoading(true);
      try {
        await productService.deleteVariant(variantId);
        onUpdate(variants.filter((v) => v.id !== variantId));
        toast.success('Variant deleted successfully');
      } catch (err) {
        toast.error(extractErrorMessage(err, 'Failed to delete variant'));
      } finally {
        setLoading(false);
      }
    },
    [variants, onUpdate],
  );

  const handleBulkDelete = useCallback(async () => {
    if (selectedVariants.length === 0) return;

    setLoading(true);
    try {
      const results = await Promise.allSettled(
        selectedVariants.map((id) => productService.deleteVariant(id)),
      );

      const succeeded = results.filter(
        (r) => r.status === 'fulfilled',
      ).length;
      const failed = results.filter(
        (r) => r.status === 'rejected',
      ).length;

      // Only drop the ones that actually succeeded.
      const successfulIds = new Set(
        results
          .map((r, i) =>
            r.status === 'fulfilled' ? selectedVariants[i] : null,
          )
          .filter((id): id is string => id !== null),
      );

      onUpdate(variants.filter((v) => !successfulIds.has(v.id!)));
      setSelectedVariants([]);
      setShowBulkDeleteConfirm(false);

      if (failed > 0) {
        toast.warning(`${succeeded} deleted, ${failed} failed`);
      } else {
        toast.success(`${succeeded} variants deleted successfully`);
      }
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to delete variants'));
    } finally {
      setLoading(false);
    }
  }, [selectedVariants, variants, onUpdate]);

  const handleBulkStockUpdate = useCallback(
    async (newStock: number) => {
      if (selectedVariants.length === 0) return;

      // ✅ Confirm before mutating. Bulk operations are hard to reverse.
      const confirmed = confirm(
        `Set stock to ${newStock} for ${selectedVariants.length} variant(s)?`,
      );
      if (!confirmed) return;

      setLoading(true);
      try {
        // Send only the fields being changed. Overwriting name/sku/price
        // from a possibly-stale snapshot risks clobbering a concurrent
        // edit on the server.
        const results = await Promise.allSettled(
          selectedVariants.map((id) =>
            productService.updateVariant(id, { stock: newStock }),
          ),
        );

        const successes = results
          .filter(
            (r): r is PromiseFulfilledResult<ProductVariant> =>
              r.status === 'fulfilled',
          )
          .map((r) => r.value);

        const updatedById = new Map(successes.map((v) => [v.id, v]));
        onUpdate(variants.map((v) => updatedById.get(v.id) ?? v));
        setSelectedVariants([]);

        const failed = results.length - successes.length;
        if (failed > 0) {
          toast.warning(`${successes.length} updated, ${failed} failed`);
        } else {
          toast.success(`${successes.length} variants updated`);
        }
      } catch (err) {
        toast.error(extractErrorMessage(err, 'Failed to update stock'));
      } finally {
        setLoading(false);
      }
    },
    [selectedVariants, variants, onUpdate],
  );

  // ============================================
  // SELECTION
  // ============================================

  const toggleExpand = useCallback((id: string) => {
    setExpandedVariants((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedVariants((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedVariants.length === filteredVariants.length) {
      setSelectedVariants([]);
    } else {
      setSelectedVariants(
        filteredVariants
          .map((v) => v.id!)
          .filter((id): id is string => !!id),
      );
    }
  }, [selectedVariants.length, filteredVariants]);

  // ============================================
  // STOCK STATUS HELPER
  // ============================================

  const getVariantStockStatus = useCallback(
    (variant: ExtendedVariant) => {
      const stock = variant.stock || 0;
      if (stock <= 0)
        return {
          label: 'Out of Stock',
          color:
            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
        };
      if (stock <= 5)
        return {
          label: 'Low Stock',
          color:
            'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
        };
      return {
        label: 'In Stock',
        color:
          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      };
    },
    [],
  );

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Variants
          </h3>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <span>{variants.length} variants</span>
            <span className="w-px h-3 bg-gray-300 dark:bg-gray-600" />
            <span>Total Stock: {totalStock}</span>
            <span className="w-px h-3 bg-gray-300 dark:bg-gray-600" />
            <span>Avg Price: {formatCurrency(averagePrice)}</span>
            {hasAnyVariantImages && (
              <>
                <span className="w-px h-3 bg-gray-300 dark:bg-gray-600" />
                <span className="flex items-center gap-1">
                  <ImageIcon className="w-3 h-3 text-purple-500" />
                  With Images
                </span>
              </>
            )}
          </div>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Variant
          </button>
        )}
      </div>

      {/* Filters */}
      {variants.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
          <div className="flex-1 min-w-[150px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search variants..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>
          <select
            value={filterActive}
            onChange={(e) =>
              setFilterActive(
                e.target.value as 'all' | 'active' | 'inactive',
              )
            }
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Variants</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          {selectedVariants.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-600 dark:text-blue-400">
                {selectedVariants.length} selected
              </span>
              <button
                type="button"
                onClick={() => setSelectedVariants([])}
                className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bulk actions — ✅ shows for 1+ selections, not just 2+ */}
      {selectedVariants.length >= 1 && canManage && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-blue-700 dark:text-blue-300">
            {selectedVariants.length} variant
            {selectedVariants.length > 1 ? 's' : ''} selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <label className="text-xs text-gray-600 dark:text-gray-400">
                Set Stock:
              </label>
              <input
                ref={bulkStockInputRef}
                type="number"
                min="0"
                className="w-16 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="0"
              />
              <button
                type="button"
                onClick={() => {
                  const value = parseInt(
                    bulkStockInputRef.current?.value ?? '',
                    10,
                  );
                  if (!Number.isNaN(value) && value >= 0) {
                    handleBulkStockUpdate(value);
                  } else {
                    toast.error('Please enter a valid stock number');
                  }
                }}
                disabled={loading}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Apply
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowBulkDeleteConfirm(true)}
              disabled={loading}
              className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Variant list */}
      <div className="space-y-3">
        {variants.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <Layers className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              No variants added yet
            </p>
            {canManage && (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Add your first variant
              </button>
            )}
          </div>
        ) : filteredVariants.length === 0 ? (
          <div className="text-center py-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400">
              No variants match your filters
            </p>
          </div>
        ) : (
          <>
            {/* Select all row */}
            {canManage && filteredVariants.length > 1 && (
              <div className="flex items-center gap-2 px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={
                    selectedVariants.length === filteredVariants.length &&
                    filteredVariants.length > 0
                  }
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  aria-label="Select all variants"
                />
                <span>Select all ({filteredVariants.length})</span>
              </div>
            )}

            {filteredVariants.map((variant) => {
              const variantKey = variant.id || variant.sku;
              const isEditing = editingVariantId === variant.id;
              const isExpanded = expandedVariants.has(variantKey);
              const isSelected = variant.id
                ? selectedVariants.includes(variant.id)
                : false;
              const stockStatus = getVariantStockStatus(variant);

              return (
                <motion.div
                  key={variantKey}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`border rounded-lg overflow-hidden transition-colors ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {/* Row */}
                  <div
                    className={`p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      isEditing ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                      {canManage && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() =>
                            variant.id && toggleSelect(variant.id)
                          }
                          disabled={!variant.id}
                          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          aria-label={`Select ${variant.name}`}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => toggleExpand(variantKey)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        <ChevronDown
                          className={`w-4 h-4 text-gray-500 transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {variant.images && variant.images.length > 0 ? (
                          <img
                            src={variant.images[0]}
                            alt={variant.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Layers className="w-4 h-4 text-blue-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {variant.name}
                          {variant.isActive === false && (
                            <span className="ml-2 text-xs text-red-500">
                              (Inactive)
                            </span>
                          )}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                          <span className="font-mono text-xs">
                            SKU: {variant.sku}
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {formatCurrency(variant.price)}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${stockStatus.color}`}
                          >
                            {stockStatus.label}
                          </span>
                          <span className="text-xs">
                            Stock: {variant.stock || 0}
                          </span>
                          {variant.barcode && (
                            <span className="text-xs flex items-center gap-0.5">
                              <Barcode className="w-3 h-3" />
                              {variant.barcode}
                            </span>
                          )}
                          {variant.inventoryId && (
                            <span className="text-xs text-blue-500 flex items-center gap-0.5">
                              <Link2 className="w-3 h-3" />
                              Inventory
                            </span>
                          )}
                        </div>
                        {variant.images && variant.images.length > 1 && (
                          <div className="flex gap-1 mt-1">
                            {variant.images
                              .slice(1, 4)
                              .map((img, idx) => (
                                <div
                                  key={`${img.slice(0, 16)}-${idx}`}
                                  className="w-8 h-8 rounded-md overflow-hidden border border-gray-200 dark:border-gray-600"
                                >
                                  <img
                                    src={img}
                                    alt={`${variant.name} ${idx + 2}`}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ))}
                            {variant.images.length > 4 && (
                              <div className="w-8 h-8 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-500">
                                +{variant.images.length - 4}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {canManage && !isEditing && variant.id && (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVariantId(variant.id!);
                            setEditVariant({
                              id: variant.id!,
                              name: variant.name,
                              sku: variant.sku,
                              price: variant.price,
                              costPrice: variant.costPrice ?? 0,
                              stock: variant.stock ?? 0,
                              attributes: variant.attributes ?? {},
                              images: variant.images ?? [],
                              isActive: variant.isActive !== false,
                              barcode: variant.barcode ?? undefined,
                              inventoryId: variant.inventoryId ?? null,
                            });
                          }}
                          className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                          title="Edit variant"
                          aria-label={`Edit ${variant.name}`}
                        >
                          <Edit className="w-4 h-4 text-blue-500" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteVariant(variant.id!)}
                          className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                          title="Delete variant"
                          aria-label={`Delete ${variant.name}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    )}

                    {isEditing && (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={handleEditVariant}
                          disabled={loading}
                          className="p-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                          title="Save changes"
                          aria-label="Save changes"
                        >
                          {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVariantId(null);
                            setEditVariant(null);
                          }}
                          className="p-1.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                          title="Cancel"
                          aria-label="Cancel edit"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Edit form */}
                  <AnimatePresence>
                    {isEditing && editVariant && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-700/30 overflow-hidden"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Name
                            </label>
                            <input
                              type="text"
                              value={editVariant.name}
                              onChange={(e) =>
                                setEditVariant({
                                  ...editVariant,
                                  name: e.target.value,
                                })
                              }
                              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              SKU
                            </label>
                            <div className="flex gap-1">
                              <input
                                type="text"
                                value={editVariant.sku}
                                onChange={(e) =>
                                  setEditVariant({
                                    ...editVariant,
                                    sku: e.target.value.toUpperCase(),
                                  })
                                }
                                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setEditVariant({
                                    ...editVariant,
                                    sku: generateVariantSku(),
                                  })
                                }
                                className="px-2 py-1.5 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                                title="Generate SKU"
                              >
                                <Wand2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Price
                            </label>
                            <input
                              type="number"
                              value={editVariant.price}
                              onChange={(e) =>
                                setEditVariant({
                                  ...editVariant,
                                  price: parseFloat(e.target.value) || 0,
                                })
                              }
                              step="0.01"
                              min="0"
                              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Stock
                            </label>
                            <input
                              type="number"
                              value={editVariant.stock}
                              onChange={(e) =>
                                setEditVariant({
                                  ...editVariant,
                                  stock: parseInt(e.target.value, 10) || 0,
                                })
                              }
                              min="0"
                              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            />
                          </div>
                          <div className="sm:col-span-2 lg:col-span-4">
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Attributes (JSON)
                            </label>
                            <input
                              type="text"
                              value={JSON.stringify(
                                editVariant.attributes || {},
                              )}
                              onChange={(e) => {
                                try {
                                  const parsed = JSON.parse(e.target.value);
                                  setEditVariant({
                                    ...editVariant,
                                    attributes: parsed,
                                  });
                                } catch {
                                  /* invalid JSON — ignore until it parses */
                                }
                              }}
                              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono"
                              placeholder='{"size": "large"}'
                            />
                          </div>

                          <div className="sm:col-span-2 lg:col-span-4">
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Images (Max {MAX_VARIANT_IMAGES})
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {editVariant.images &&
                                editVariant.images.map((img, imgIndex) => (
                                  <div
                                    key={`${img.slice(0, 16)}-${imgIndex}`}
                                    className="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-200"
                                  >
                                    <img
                                      src={img}
                                      alt={`Variant ${imgIndex + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeVariantImage(imgIndex, 'edit')
                                      }
                                      className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full p-0.5"
                                      aria-label={`Remove image ${imgIndex + 1}`}
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              {(editVariant.images?.length || 0) <
                                MAX_VARIANT_IMAGES && (
                                <label className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-500 cursor-pointer flex flex-col items-center justify-center text-gray-400">
                                  <Upload className="w-4 h-4" />
                                  <span className="text-[8px] mt-0.5">
                                    Upload
                                  </span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={(e) =>
                                      handleVariantImageUpload(e, 'edit')
                                    }
                                    className="hidden"
                                  />
                                </label>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {isExpanded && !isEditing && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-700/30 overflow-hidden"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Created
                            </p>
                            <p className="text-sm text-gray-900 dark:text-white">
                              {variant.createdAt
                                ? formatDate(variant.createdAt)
                                : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Cost Price
                            </p>
                            <p className="text-sm text-gray-900 dark:text-white">
                              {variant.costPrice
                                ? formatCurrency(variant.costPrice)
                                : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Profit Margin
                            </p>
                            <p className="text-sm font-medium text-green-600 dark:text-green-400">
                              {variant.costPrice &&
                              variant.costPrice > 0 &&
                              variant.price > 0
                                ? `${(
                                    ((variant.price - variant.costPrice) /
                                      variant.price) *
                                    100
                                  ).toFixed(1)}%`
                                : 'N/A'}
                            </p>
                          </div>
                          {Object.keys(variant.attributes || {}).length >
                            0 && (
                            <div className="sm:col-span-2 lg:col-span-3">
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                Attributes
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(
                                  variant.attributes || {},
                                ).map(([key, value]) => (
                                  <span
                                    key={key}
                                    className="px-2 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-xs"
                                  >
                                    {key}: {String(value)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </>
        )}
      </div>

      {/* Add variant form */}
      <AnimatePresence>
        {showAddForm && canManage && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/10 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-gray-900 dark:text-white">
                Add New Variant
              </h4>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                aria-label="Close form"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newVariant.name}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNewVariant((prev) => ({
                      ...prev,
                      name: value,
                      sku:
                        !prev.sku && value.trim().length >= 2
                          ? generateVariantSku()
                          : prev.sku,
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="e.g., Large, Red"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  SKU <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newVariant.sku}
                    onChange={(e) =>
                      setNewVariant((prev) => ({
                        ...prev,
                        sku: e.target.value.toUpperCase(),
                      }))
                    }
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono"
                    placeholder="Enter SKU"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setNewVariant((prev) => ({
                        ...prev,
                        sku: generateVariantSku(),
                      }))
                    }
                    className="px-3 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                    title="Generate SKU"
                  >
                    <Wand2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Price <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={newVariant.price}
                  onChange={(e) =>
                    setNewVariant((prev) => ({
                      ...prev,
                      price: parseFloat(e.target.value) || 0,
                    }))
                  }
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Stock
                </label>
                <input
                  type="number"
                  value={newVariant.stock}
                  onChange={(e) =>
                    setNewVariant((prev) => ({
                      ...prev,
                      stock: parseInt(e.target.value, 10) || 0,
                    }))
                  }
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="0"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Attributes (JSON)
                </label>
                <input
                  type="text"
                  value={JSON.stringify(newVariant.attributes)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setNewVariant((prev) => ({
                        ...prev,
                        attributes: parsed,
                      }));
                    } catch {
                      /* invalid JSON — ignore until it parses */
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
                  placeholder='{"size": "large", "color": "red"}'
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Images (Max {MAX_VARIANT_IMAGES})
                </label>
                <div className="flex flex-wrap gap-2">
                  {newVariant.images &&
                    newVariant.images.map((img, imgIndex) => (
                      <div
                        key={`${img.slice(0, 16)}-${imgIndex}`}
                        className="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-200"
                      >
                        <img
                          src={img}
                          alt={`Variant ${imgIndex + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            removeVariantImage(imgIndex, 'new')
                          }
                          className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full p-0.5"
                          aria-label={`Remove image ${imgIndex + 1}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  {(newVariant.images?.length || 0) <
                    MAX_VARIANT_IMAGES && (
                    <label className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-500 cursor-pointer flex flex-col items-center justify-center text-gray-400">
                      <Upload className="w-4 h-4" />
                      <span className="text-[8px] mt-0.5">Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) =>
                          handleVariantImageUpload(e, 'new')
                        }
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddVariant}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 transition-colors"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Add Variant
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk delete modal */}
      <AnimatePresence>
        {showBulkDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
              onClick={() => setShowBulkDeleteConfirm(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
            >
              <button
                type="button"
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Delete Variants
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This action cannot be undone
                  </p>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to delete{' '}
                <strong className="text-gray-900 dark:text-white">
                  {selectedVariants.length}
                </strong>{' '}
                selected variant
                {selectedVariants.length !== 1 ? 's' : ''}? This will
                permanently remove them and all associated data.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Delete {selectedVariants.length} Variant
                  {selectedVariants.length !== 1 ? 's' : ''}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ProductVariants;
