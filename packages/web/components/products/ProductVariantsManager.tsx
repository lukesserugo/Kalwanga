'use client';

// D:\Projects\Kalwanga\packages\web\components\products\ProductVariantsManager.tsx

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
  Layers,
  Copy,
  Loader2,
  Image as ImageIcon,
  Upload,
  Grid,
  List,
  ChevronDown,
  AlertCircle,
  Search,
  Wand2,
  Zap,
  Hash,
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

type ExtendedVariant = ProductVariant & {
  barcode?: string | null;
  inventoryId?: string | null;
};

interface ProductVariantsManagerProps {
  productId: string;
  variants: ProductVariant[];
  onUpdate: (variants: ProductVariant[]) => void;
  canManage?: boolean;
  productName?: string;
  productSku?: string;
}

interface BulkVariantConfig {
  attributes: Record<string, string[]>;
  basePrice: number;
  baseSku: string;
  baseStock: number;
  baseCostPrice?: number;
  isActive?: boolean;
}

interface VariantFormData {
  id?: string;
  name: string;
  sku: string;
  price: number;
  costPrice: number;
  stock: number;
  images: string[];
  attributes: Record<string, any>;
  isActive: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const MAX_IMAGE_SIZE = 150 * 1024;
const MAX_IMAGE_DIMENSION = 500;
const MAX_FILE_SIZE = 3 * 1024 * 1024;
const MAX_VARIANT_IMAGES = 3;
const MAX_BULK_COMBINATIONS = 50;

const DEFAULT_VARIANT_FORM: VariantFormData = {
  name: '',
  sku: '',
  price: 0,
  costPrice: 0,
  stock: 0,
  images: [],
  attributes: {},
  isActive: true,
};

const DEFAULT_BULK_CONFIG: BulkVariantConfig = {
  attributes: {},
  basePrice: 0,
  baseSku: '',
  baseStock: 0,
  baseCostPrice: 0,
  isActive: true,
};

// Locale-aware collator for sort stability on numeric-like names.
const nameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

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
 * Generate a unique variant SKU. Uses a monotonic counter so two calls
 * in the same millisecond can't collide within this browser session.
 * Server-side uniqueness is still enforced at the DB level.
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
 * Cartesian product of attribute values. Uses a clean reducer.
 */
function generateCombinations(
  attributes: Record<string, string[]>,
): string[][] {
  const keys = Object.keys(attributes);
  if (keys.length === 0) return [];

  return keys.reduce<string[][]>(
    (acc, key) => {
      const next: string[][] = [];
      const values = attributes[key];
      for (const combo of acc) {
        for (const value of values) {
          next.push([...combo, value]);
        }
      }
      return next;
    },
    [[]],
  );
}

function countCombinations(attributes: Record<string, string[]>): number {
  const keys = Object.keys(attributes);
  if (keys.length === 0) return 0;
  return keys.reduce((acc, key) => acc * attributes[key].length, 1);
}

/**
 * Slug a value for use in a generated SKU. Preserves more of the
 * original string than `.slice(0, 3)` so `"Large"` and `"Lavender"`
 * don't both collapse to `"LAR"`.
 *
 * "Extra Large" → "EXTRA-LARGE"
 * "Size 10"     → "SIZE-10"
 */
function skuSegment(value: string): string {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toUpperCase() || 'X'
  );
}

/**
 * Validate a variant form. `price` is checked with `>= 0` rather than
 * truthiness so a free variant (`price: 0`) passes.
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

export function ProductVariantsManager({
  productId,
  variants,
  onUpdate,
  canManage = true,
  productName = '',
  productSku = '',
}: ProductVariantsManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<
    'all' | 'active' | 'inactive'
  >('all');
  const [sortBy, setSortBy] = useState<
    'name' | 'price' | 'stock' | 'createdAt'
  >('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
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
  const [bulkConfig, setBulkConfig] =
    useState<BulkVariantConfig>(DEFAULT_BULK_CONFIG);
  const [newAttributeKey, setNewAttributeKey] = useState('');
  const [newAttributeValues, setNewAttributeValues] = useState('');

  // ✅ Ref instead of `document.getElementById`.
  const bulkStockInputRef = useRef<HTMLInputElement>(null);

  // ============================================
  // DERIVED
  // ============================================

  const variantCount = variants.length;

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

  const bulkCombinationCount = useMemo(
    () => countCombinations(bulkConfig.attributes),
    [bulkConfig.attributes],
  );

  const filteredAndSortedVariants = useMemo<ExtendedVariant[]>(() => {
    let result = variants as ExtendedVariant[];

    if (searchQuery) {
      const term = searchQuery.toLowerCase();
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

    return [...result].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = nameCollator.compare(a.name, b.name);
          break;
        case 'price':
          comparison = (a.price || 0) - (b.price || 0);
          break;
        case 'stock':
          comparison = (a.stock || 0) - (b.stock || 0);
          break;
        case 'createdAt':
          comparison = (a.createdAt || '').localeCompare(
            b.createdAt || '',
          );
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [variants, searchQuery, filterActive, sortBy, sortOrder]);

  // Set of SKUs already in use on this product, for collision checks.
  const existingSkus = useMemo(
    () =>
      new Set(
        variants.map((v) => v.sku.toUpperCase().trim()).filter(Boolean),
      ),
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
  // SORT
  // ============================================

  const toggleSort = useCallback(
    (field: 'name' | 'price' | 'stock' | 'createdAt') => {
      if (sortBy === field) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy(field);
        setSortOrder('asc');
      }
    },
    [sortBy],
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
  // SINGLE CREATE
  // ============================================

  const handleAddVariant = useCallback(async () => {
    // ✅ Validation that permits `price: 0`.
    const validity = isVariantFormValid(newVariant);
    if (!validity.valid) {
      toast.error(validity.message ?? 'Invalid variant data');
      return;
    }

    const normalizedSku = newVariant.sku.toUpperCase().trim();
    if (existingSkus.has(normalizedSku)) {
      toast.error(`SKU "${normalizedSku}" is already used by another variant`);
      return;
    }

    setLoading(true);
    try {
      const result = await productService.addVariant(productId, {
        name: newVariant.name.trim(),
        sku: normalizedSku,
        price: newVariant.price,
        costPrice: newVariant.costPrice || 0,
        stock: newVariant.stock || 0,
        images: newVariant.images || [],
        attributes: newVariant.attributes || {},
        isActive: newVariant.isActive !== false,
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
  }, [newVariant, productId, variants, onUpdate, existingSkus]);

  // ============================================
  // BULK CREATE
  // ============================================

  const handleBulkCreate = useCallback(async () => {
    const attributeKeys = Object.keys(bulkConfig.attributes);
    if (attributeKeys.length === 0) {
      toast.error('Please add at least one attribute');
      return;
    }
    if (!bulkConfig.baseSku) {
      toast.error('Base SKU is required');
      return;
    }
    if (typeof bulkConfig.basePrice !== 'number' || bulkConfig.basePrice < 0) {
      toast.error('Base price must be 0 or greater');
      return;
    }
    if (bulkCombinationCount > MAX_BULK_COMBINATIONS) {
      toast.error(
        `This configuration would create ${bulkCombinationCount} variants. Reduce the number of attribute values (max ${MAX_BULK_COMBINATIONS}).`,
      );
      return;
    }

    const baseSkuUpper = bulkConfig.baseSku.toUpperCase().trim();

    // ✅ Pre-compute combinations and check SKU collisions before
    //    making any network calls.
    const combinations = generateCombinations(bulkConfig.attributes);
    const planned: Array<{
      name: string;
      sku: string;
      attributes: Record<string, string>;
    }> = [];

    const seenSkus = new Set<string>();
    for (const combo of combinations) {
      // ✅ Use the full slug, not a 3-char slice.
      const sku =
        `${baseSkuUpper}-` + combo.map(skuSegment).join('-');
      const name = combo.join(' / ');

      if (existingSkus.has(sku)) {
        toast.error(
          `Generated SKU "${sku}" collides with an existing variant. Rename a value or use a different base SKU.`,
        );
        return;
      }
      if (seenSkus.has(sku)) {
        toast.error(
          `Generated SKU "${sku}" is duplicated within this batch. Values must be unique.`,
        );
        return;
      }
      seenSkus.add(sku);

      const attributes = combo.reduce<Record<string, string>>(
        (acc, value, idx) => {
          acc[attributeKeys[idx]] = value;
          return acc;
        },
        {},
      );

      planned.push({ name, sku, attributes });
    }

    setLoading(true);
    try {
      const created: ProductVariant[] = [];
      const failures: string[] = [];

      for (const item of planned) {
        try {
          const result = await productService.addVariant(productId, {
            name: item.name,
            sku: item.sku,
            price: bulkConfig.basePrice,
            costPrice: bulkConfig.baseCostPrice || 0,
            stock: bulkConfig.baseStock,
            attributes: item.attributes,
            isActive: bulkConfig.isActive !== false,
          });
          created.push(result);
        } catch (err) {
          failures.push(
            `${item.name}: ${extractErrorMessage(err, 'failed')}`,
          );
        }
      }

      if (created.length > 0) {
        onUpdate([...variants, ...created]);
      }
      setShowBulkForm(false);
      setBulkConfig(DEFAULT_BULK_CONFIG);

      if (failures.length === 0) {
        toast.success(
          `${created.length} variant${
            created.length === 1 ? '' : 's'
          } created successfully`,
        );
      } else {
        toast.warning(
          `${created.length} created, ${failures.length} failed`,
        );
        console.warn('Bulk create failures:', failures);
      }
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to create variants'));
    } finally {
      setLoading(false);
    }
  }, [
    bulkConfig,
    bulkCombinationCount,
    productId,
    variants,
    onUpdate,
    existingSkus,
  ]);

  // ============================================
  // EDIT
  // ============================================

  const handleEditVariant = useCallback(async () => {
    if (!editVariant || !editVariant.id) return;

    // ✅ Mirror the single-create validation.
    const validity = isVariantFormValid(editVariant);
    if (!validity.valid) {
      toast.error(validity.message ?? 'Invalid variant data');
      return;
    }

    const normalizedSku = editVariant.sku.toUpperCase().trim();

    // Check collision against *other* variants only.
    const collides = variants.some(
      (v) =>
        v.id !== editVariant.id &&
        v.sku.toUpperCase().trim() === normalizedSku,
    );
    if (collides) {
      toast.error(`SKU "${normalizedSku}" is already used by another variant`);
      return;
    }

    setLoading(true);
    try {
      const result = await productService.updateVariant(editVariant.id, {
        name: editVariant.name.trim(),
        sku: normalizedSku,
        price: editVariant.price,
        costPrice: editVariant.costPrice || 0,
        stock: editVariant.stock || 0,
        images: editVariant.images || [],
        attributes: editVariant.attributes || {},
        isActive: editVariant.isActive !== false,
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

  const beginEdit = useCallback((variant: ExtendedVariant) => {
    if (!variant.id) return;
    setEditingVariantId(variant.id);
    setEditVariant({
      id: variant.id,
      name: variant.name,
      sku: variant.sku,
      price: variant.price,
      costPrice: variant.costPrice ?? 0,
      stock: variant.stock ?? 0,
      images: variant.images ?? [],
      attributes: variant.attributes ?? {},
      isActive: variant.isActive !== false,
    });
  }, []);

  // ============================================
  // DELETE
  // ============================================

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
      const failed = results.length - succeeded;

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
        toast.success(
          `${succeeded} variant${succeeded === 1 ? '' : 's'} deleted successfully`,
        );
      }
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to delete variants'));
    } finally {
      setLoading(false);
    }
  }, [selectedVariants, variants, onUpdate]);

  // ============================================
  // BULK STOCK UPDATE
  // ============================================

  const handleBulkStockUpdate = useCallback(
    async (newStock: number) => {
      if (selectedVariants.length === 0) return;

      // ✅ Confirm bulk mutations.
      const confirmed = confirm(
        `Set stock to ${newStock} for ${selectedVariants.length} variant${
          selectedVariants.length > 1 ? 's' : ''
        }?`,
      );
      if (!confirmed) return;

      setLoading(true);
      try {
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
  // SELECTION / EXPANSION
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
    if (selectedVariants.length === filteredAndSortedVariants.length) {
      setSelectedVariants([]);
    } else {
      setSelectedVariants(
        filteredAndSortedVariants
          .map((v) => v.id!)
          .filter((id): id is string => !!id),
      );
    }
  }, [selectedVariants.length, filteredAndSortedVariants]);

  // ============================================
  // BULK ATTRIBUTES
  // ============================================

  const addAttributeToBulk = useCallback(() => {
    // ✅ Trim the key. Guard against empty.
    const key = newAttributeKey.trim();
    if (!key || !newAttributeValues) {
      toast.error('Please enter both attribute key and values');
      return;
    }

    // ✅ Dedupe and normalise values. "Red, red, RED" → ["Red"].
    const seen = new Set<string>();
    const values: string[] = [];
    for (const raw of newAttributeValues.split(',')) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const lower = trimmed.toLowerCase();
      if (seen.has(lower)) continue;
      seen.add(lower);
      values.push(trimmed);
    }

    if (values.length === 0) {
      toast.error('Please enter at least one value');
      return;
    }

    // If the key already exists (case-insensitive), replace it rather
    // than creating a parallel entry.
    setBulkConfig((prev) => {
      const existingKey = Object.keys(prev.attributes).find(
        (k) => k.toLowerCase() === key.toLowerCase(),
      );
      const next = { ...prev.attributes };
      if (existingKey) delete next[existingKey];
      next[key] = values;
      return { ...prev, attributes: next };
    });

    setNewAttributeKey('');
    setNewAttributeValues('');
    toast.success(
      `Added attribute "${key}" with ${values.length} value${
        values.length === 1 ? '' : 's'
      }`,
    );
  }, [newAttributeKey, newAttributeValues]);

  const removeAttribute = useCallback((key: string) => {
    setBulkConfig((prev) => {
      const next = { ...prev.attributes };
      delete next[key];
      return { ...prev, attributes: next };
    });
  }, []);

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
            'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
        };
      if (stock <= 5)
        return {
          label: 'Low Stock',
          color:
            'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
        };
      return {
        label: 'In Stock',
        color:
          'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300',
      };
    },
    [],
  );

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand-500 dark:text-brand-400" />
            Variants
          </h3>
          <div className="flex flex-wrap items-center gap-3 text-sm tabular-nums text-gray-500 dark:text-gray-400">
            <span>{variantCount} variants</span>
            <span className="w-px h-3 bg-gray-300 dark:bg-gray-600" />
            <span>Total Stock: {totalStock}</span>
            <span className="w-px h-3 bg-gray-300 dark:bg-gray-600" />
            <span>Avg Price: {formatCurrency(averagePrice)}</span>
            {hasAnyVariantImages && (
              <>
                <span className="w-px h-3 bg-gray-300 dark:bg-gray-600" />
                <span className="flex items-center gap-1">
                  <ImageIcon className="w-3 h-3 text-secondary-500" />
                  With Images
                </span>
              </>
            )}
          </div>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setViewMode((m) => (m === 'list' ? 'grid' : 'list'))
              }
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition duration-250 focus-ring"
              title={
                viewMode === 'list'
                  ? 'Switch to Grid View'
                  : 'Switch to List View'
              }
              aria-label="Toggle view mode"
            >
              {viewMode === 'list' ? (
                <Grid className="w-4 h-4" />
              ) : (
                <List className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowBulkForm(true);
                setShowAddForm(false);
              }}
              className="btn-secondary"
            >
              <Copy className="w-4 h-4" />
              Bulk Create
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(true);
                setShowBulkForm(false);
              }}
              className="btn-brand"
            >
              <Plus className="w-4 h-4" />
              Add Variant
            </button>
          </div>
        )}
      </div>

      {/* Filters + Sort */}
      {variantCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-gray-50 dark:bg-gray-700/30 rounded-2xl p-3 animate-slide-down">
          <div className="flex-1 min-w-[150px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search variants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
            />
          </div>
          <select
            value={filterActive}
            onChange={(e) =>
              setFilterActive(
                e.target.value as 'all' | 'active' | 'inactive',
              )
            }
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
          >
            <option value="all">All Variants</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <div className="flex items-center gap-1">
            {(['name', 'price', 'stock'] as const).map((field) => (
              <button
                key={field}
                type="button"
                onClick={() => toggleSort(field)}
                className={`px-2 py-1 text-xs rounded-lg transition duration-250 flex items-center gap-1 capitalize focus-ring ${
                  sortBy === field
                    ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400'
                    : 'hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400'
                }`}
              >
                {field}{' '}
                {sortBy === field && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
            ))}
          </div>
          {selectedVariants.length > 0 && (
            <span className="text-xs tabular-nums text-brand-600 dark:text-brand-400">
              {selectedVariants.length} selected
            </span>
          )}
        </div>
      )}

      {/* Bulk actions — ✅ shows for 1+ selections */}
      {selectedVariants.length >= 1 && canManage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 animate-slide-down"
        >
          <span className="text-sm tabular-nums text-brand-700 dark:text-brand-300">
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
                className="w-16 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
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
                className="px-2 py-1 text-xs btn-brand disabled:opacity-50"
              >
                Apply
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowBulkDeleteConfirm(true)}
              disabled={loading}
              className="px-2 py-1 text-xs bg-danger-600 text-white rounded-lg hover:bg-danger-700 transition duration-250 disabled:opacity-50 focus-ring"
            >
              Delete Selected
            </button>
            <button
              type="button"
              onClick={() => setSelectedVariants([])}
              className="px-2 py-1 text-xs btn-secondary"
            >
              Clear
            </button>
          </div>
        </motion.div>
      )}

      {/* Body */}
      {variantCount === 0 ? (
        <div className="text-center py-12 card-brand shadow-soft">
          <Layers className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            No variants added yet
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Add variants to offer different options for this product
          </p>
          {canManage && (
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="btn-brand"
              >
                <Plus className="w-4 h-4" />
                Add Single Variant
              </button>
              <button
                type="button"
                onClick={() => setShowBulkForm(true)}
                className="btn-secondary"
              >
                <Copy className="w-4 h-4" />
                Bulk Create
              </button>
            </div>
          )}
        </div>
      ) : filteredAndSortedVariants.length === 0 ? (
        <div className="text-center py-8 card-brand shadow-soft">
          <Search className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            No variants match your filters
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setFilterActive('all');
            }}
            className="mt-2 text-sm text-brand-600 hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-300 transition duration-250 focus-ring rounded"
          >
            Clear Filters
          </button>
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-3">
          {filteredAndSortedVariants.map((variant) => {
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
                className={`border rounded-xl overflow-hidden transition duration-250 ${
                  isSelected
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/10'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                {/* Row */}
                <div
                  className={`p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition duration-250 ${
                    isEditing ? 'bg-brand-50 dark:bg-brand-900/10' : ''
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
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500 bg-white dark:bg-gray-700 transition duration-250"
                        aria-label={`Select ${variant.name}`}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => toggleExpand(variantKey)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition duration-250 focus-ring"
                      aria-label={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      <ChevronDown
                        className={`w-4 h-4 text-gray-500 transition-transform duration-250 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    <div className="w-10 h-10 bg-brand-50 dark:bg-brand-900/20 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                      {variant.images?.[0] ? (
                        <img
                          src={variant.images[0]}
                          alt={variant.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Layers className="w-5 h-5 text-brand-500 dark:text-brand-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {variant.name}
                          {variant.isActive === false && (
                            <span className="ml-2 text-2xs text-danger-500">
                              (Inactive)
                            </span>
                          )}
                        </p>
                        {variant.isActive !== undefined && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-2xs font-medium ${
                              variant.isActive
                                ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300'
                                : 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300'
                            }`}
                          >
                            {variant.isActive ? 'Active' : 'Inactive'}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          <span className="font-mono text-2xs tabular-nums">{variant.sku}</span>
                        </span>
                        <span className="font-medium tabular-nums text-gray-900 dark:text-white">
                          {formatCurrency(variant.price)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-2xs font-medium ${stockStatus.color}`}
                        >
                          {stockStatus.label}
                        </span>
                        <span className="text-2xs tabular-nums">
                          Stock: {variant.stock || 0}
                        </span>
                        {variant.costPrice && variant.costPrice > 0 && (
                          <span className="text-2xs tabular-nums text-gray-400 dark:text-gray-500">
                            Cost: {formatCurrency(variant.costPrice)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {canManage && !isEditing && variant.id && (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => beginEdit(variant)}
                        className="p-1.5 hover:bg-brand-100 dark:hover:bg-brand-900/30 rounded transition duration-250 focus-ring"
                        title="Edit variant"
                        aria-label={`Edit ${variant.name}`}
                      >
                        <Edit className="w-4 h-4 text-brand-500 dark:text-brand-400" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteVariant(variant.id!)}
                        className="p-1.5 hover:bg-danger-100 dark:hover:bg-danger-900/30 rounded transition duration-250 focus-ring"
                        title="Delete variant"
                        aria-label={`Delete ${variant.name}`}
                      >
                        <Trash2 className="w-4 h-4 text-danger-500" />
                      </button>
                    </div>
                  )}
                  {isEditing && (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={handleEditVariant}
                        disabled={loading}
                        className="p-1.5 btn-success disabled:opacity-50"
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
                        className="p-1.5 btn-secondary"
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
                            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
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
                              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setEditVariant({
                                  ...editVariant,
                                  sku: generateVariantSku(),
                                })
                              }
                              className="px-2 py-1.5 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition duration-250 focus-ring"
                              title="Generate SKU"
                              aria-label="Generate SKU"
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
                            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
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
                            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
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
                            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
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
                                  className="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-600"
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
                                    className="absolute top-0.5 right-0.5 bg-danger-600 text-white rounded-full p-0.5 focus-ring"
                                    aria-label={`Remove image ${imgIndex + 1}`}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            {(editVariant.images?.length || 0) <
                              MAX_VARIANT_IMAGES && (
                              <label className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-brand-500 cursor-pointer flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:text-brand-500 dark:hover:text-brand-400 transition duration-250 focus-ring">
                                <Upload className="w-4 h-4" />
                                <span className="text-2xs mt-0.5">
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
                  {isExpanded && variant.id && !isEditing && (
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
                          <p className="text-sm tabular-nums text-gray-900 dark:text-white">
                            {variant.createdAt
                              ? formatDate(variant.createdAt)
                              : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Cost Price
                          </p>
                          <p className="text-sm tabular-nums text-gray-900 dark:text-white">
                            {variant.costPrice
                              ? formatCurrency(variant.costPrice)
                              : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Profit Margin
                          </p>
                          <p className="text-sm font-medium tabular-nums text-success-600 dark:text-success-400">
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
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Stock Value
                          </p>
                          <p className="text-sm tabular-nums text-gray-900 dark:text-white">
                            {formatCurrency(
                              (variant.price || 0) * (variant.stock || 0),
                            )}
                          </p>
                        </div>
                        {Object.keys(variant.attributes || {}).length > 0 && (
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
                                  className="px-2 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-2xs"
                                >
                                  {key}: {String(value)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {variant.images && variant.images.length > 0 && (
                          <div className="sm:col-span-2 lg:col-span-3">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                              Images
                            </p>
                            <div className="flex gap-2 flex-wrap">
                              {variant.images.map((img, i) => (
                                <div
                                  key={`${img.slice(0, 16)}-${i}`}
                                  className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 cursor-pointer hover:border-brand-500 transition duration-250"
                                >
                                  <img
                                    src={img}
                                    alt={`${variant.name} ${i}`}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
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
        </div>
      ) : (
        // Grid view
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSortedVariants.map((variant) => {
            const variantKey = variant.id || variant.sku;
            const isEditing = editingVariantId === variant.id;
            const isSelected = variant.id
              ? selectedVariants.includes(variant.id)
              : false;
            const stockStatus = getVariantStockStatus(variant);

            return (
              <motion.div
                key={variantKey}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -4 }}
                className={`card-brand shadow-soft overflow-hidden hover:shadow-card-hover transition duration-350 ${
                  isSelected
                    ? 'ring-2 ring-brand-500/50'
                    : ''
                }`}
              >
                <div className="aspect-square bg-gray-100 dark:bg-gray-700 relative">
                  {variant.images?.[0] ? (
                    <img
                      src={variant.images[0]}
                      alt={variant.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Layers className="w-12 h-12 text-gray-300 dark:text-gray-500" />
                    </div>
                  )}
                  {variant.isActive === false && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-danger-600 text-white text-2xs rounded">
                      Inactive
                    </div>
                  )}
                  {canManage && variant.id && (
                    <div className="absolute top-2 left-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(variant.id!)}
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500 bg-white dark:bg-gray-700 transition duration-250"
                        aria-label={`Select ${variant.name}`}
                      />
                    </div>
                  )}
                  <div
                    className={`absolute bottom-2 right-2 px-2 py-1 rounded text-2xs font-medium ${stockStatus.color}`}
                  >
                    {stockStatus.label}
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {variant.name}
                      </p>
                      <p className="text-2xs text-gray-500 dark:text-gray-400 font-mono tabular-nums truncate">
                        SKU: {variant.sku}
                      </p>
                    </div>
                    <span className="text-lg font-bold tabular-nums text-brand-600 dark:text-brand-400 ml-2">
                      {formatCurrency(variant.price)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="tabular-nums text-gray-500 dark:text-gray-400">
                      Stock: {variant.stock}
                    </span>
                    <span className="tabular-nums text-gray-500 dark:text-gray-400">
                      Value:{' '}
                      {formatCurrency(
                        (variant.price || 0) * (variant.stock || 0),
                      )}
                    </span>
                  </div>
                  {Object.keys(variant.attributes || {}).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {Object.entries(variant.attributes)
                        .slice(0, 3)
                        .map(([key, val]) => (
                          <span
                            key={key}
                            className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-2xs truncate"
                          >
                            {key}: {String(val)}
                          </span>
                        ))}
                      {Object.keys(variant.attributes).length > 3 && (
                        <span className="px-1.5 py-0.5 text-2xs tabular-nums text-gray-400 dark:text-gray-500">
                          +{Object.keys(variant.attributes).length - 3}
                        </span>
                      )}
                    </div>
                  )}
                  {canManage && !isEditing && variant.id && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => beginEdit(variant)}
                        className="p-1.5 hover:bg-brand-100 dark:hover:bg-brand-900/30 rounded transition duration-250 focus-ring"
                        title="Edit"
                        aria-label={`Edit ${variant.name}`}
                      >
                        <Edit className="w-4 h-4 text-brand-500 dark:text-brand-400" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteVariant(variant.id!)}
                        className="p-1.5 hover:bg-danger-100 dark:hover:bg-danger-900/30 rounded transition duration-250 focus-ring"
                        title="Delete"
                        aria-label={`Delete ${variant.name}`}
                      >
                        <Trash2 className="w-4 h-4 text-danger-500" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add variant form */}
      <AnimatePresence>
        {showAddForm && canManage && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border border-brand-200 dark:border-brand-800 rounded-2xl p-4 bg-brand-50 dark:bg-brand-900/10 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-gray-900 dark:text-white">
                Add New Variant
              </h4>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition duration-250 focus-ring"
                aria-label="Close form"
              >
                <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name <span className="text-danger-500">*</span>
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
                  placeholder="e.g., Large, Red"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  SKU <span className="text-danger-500">*</span>
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
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
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
                    className="px-3 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition duration-250 focus-ring"
                    title="Generate SKU"
                    aria-label="Generate SKU"
                  >
                    <Wand2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Price <span className="text-danger-500">*</span>
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cost Price
                </label>
                <input
                  type="number"
                  value={newVariant.costPrice}
                  onChange={(e) =>
                    setNewVariant((prev) => ({
                      ...prev,
                      costPrice: parseFloat(e.target.value) || 0,
                    }))
                  }
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
                  placeholder="0.00"
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
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
                        className="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-600"
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
                          className="absolute top-0.5 right-0.5 bg-danger-600 text-white rounded-full p-0.5 focus-ring"
                          aria-label={`Remove image ${imgIndex + 1}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  {(newVariant.images?.length || 0) <
                    MAX_VARIANT_IMAGES && (
                    <label className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-brand-500 cursor-pointer flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:text-brand-500 dark:hover:text-brand-400 transition duration-250 focus-ring">
                      <Upload className="w-4 h-4" />
                      <span className="text-2xs mt-0.5">Upload</span>
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

            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-brand-200 dark:border-brand-800">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddVariant}
                disabled={loading}
                className="btn-brand disabled:opacity-50"
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

      {/* Bulk create form */}
      <AnimatePresence>
        {showBulkForm && canManage && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border border-secondary-200 dark:border-secondary-800 rounded-2xl p-4 bg-secondary-50 dark:bg-secondary-900/10 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-secondary-500 dark:text-secondary-400" />
                Bulk Create Variants
              </h4>
              <button
                type="button"
                onClick={() => setShowBulkForm(false)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition duration-250 focus-ring"
                aria-label="Close form"
              >
                <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Base SKU <span className="text-danger-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={bulkConfig.baseSku}
                    onChange={(e) =>
                      setBulkConfig({
                        ...bulkConfig,
                        baseSku: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
                    placeholder="e.g., PROD"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Base Price <span className="text-danger-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={bulkConfig.basePrice}
                    onChange={(e) =>
                      setBulkConfig({
                        ...bulkConfig,
                        basePrice: parseFloat(e.target.value) || 0,
                      })
                    }
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Base Stock
                  </label>
                  <input
                    type="number"
                    value={bulkConfig.baseStock}
                    onChange={(e) =>
                      setBulkConfig({
                        ...bulkConfig,
                        baseStock: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Base Cost Price
                  </label>
                  <input
                    type="number"
                    value={bulkConfig.baseCostPrice ?? 0}
                    onChange={(e) =>
                      setBulkConfig({
                        ...bulkConfig,
                        baseCostPrice: parseFloat(e.target.value) || 0,
                      })
                    }
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Attributes
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  <input
                    type="text"
                    value={newAttributeKey}
                    onChange={(e) => setNewAttributeKey(e.target.value)}
                    className="flex-1 min-w-[120px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
                    placeholder="Attribute (e.g., Color)"
                  />
                  <input
                    type="text"
                    value={newAttributeValues}
                    onChange={(e) => setNewAttributeValues(e.target.value)}
                    className="flex-1 min-w-[120px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
                    placeholder="Values (e.g., Red, Blue)"
                  />
                  <button
                    type="button"
                    onClick={addAttributeToBulk}
                    className="btn-brand whitespace-nowrap"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(bulkConfig.attributes).map(
                    ([key, values]) => (
                      <span
                        key={key}
                        className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm"
                      >
                        <span className="font-medium">{key}:</span>
                        <span>{values.join(', ')}</span>
                        <button
                          type="button"
                          onClick={() => removeAttribute(key)}
                          className="ml-1 p-0.5 hover:bg-danger-100 dark:hover:bg-danger-900/30 rounded transition duration-250 focus-ring"
                          aria-label={`Remove ${key}`}
                        >
                          <X className="w-3 h-3 text-danger-500" />
                        </button>
                      </span>
                    ),
                  )}
                  {Object.keys(bulkConfig.attributes).length === 0 && (
                    <span className="text-sm text-gray-400 dark:text-gray-500">
                      No attributes added yet
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-700 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  This will create{' '}
                  <span
                    className={`font-bold tabular-nums ${
                      bulkCombinationCount > MAX_BULK_COMBINATIONS
                        ? 'text-danger-600 dark:text-danger-400'
                        : 'text-secondary-600 dark:text-secondary-400'
                    }`}
                  >
                    {bulkCombinationCount}
                  </span>{' '}
                  variants from all combinations.
                  {bulkCombinationCount > MAX_BULK_COMBINATIONS && (
                    <span className="text-danger-600 dark:text-danger-400 ml-1">
                      (max {MAX_BULK_COMBINATIONS})
                    </span>
                  )}
                </p>
                <label className="flex items-center gap-1 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={bulkConfig.isActive !== false}
                    onChange={(e) =>
                      setBulkConfig({
                        ...bulkConfig,
                        isActive: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500 bg-white dark:bg-gray-700 transition duration-250"
                  />
                  <span className="text-gray-700 dark:text-gray-300">Active</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-secondary-200 dark:border-secondary-800">
                <button
                  type="button"
                  onClick={() => setShowBulkForm(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkCreate}
                  disabled={
                    loading ||
                    Object.keys(bulkConfig.attributes).length === 0 ||
                    bulkCombinationCount > MAX_BULK_COMBINATIONS
                  }
                  className="px-4 py-2 bg-secondary-600 hover:bg-secondary-700 text-white rounded-xl flex items-center gap-2 disabled:opacity-50 transition duration-250 focus-ring"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  Create Variants
                </button>
              </div>
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
            className="fixed inset-0 z-modal flex items-center justify-center p-4"
          >
            <div
              className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
              onClick={() => setShowBulkDeleteConfirm(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6"
            >
              <button
                type="button"
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition duration-250 focus-ring"
                aria-label="Close modal"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-danger-100 dark:bg-danger-900/30 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-danger-600 dark:text-danger-400" />
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
                <strong className="text-gray-900 dark:text-white tabular-nums">
                  {selectedVariants.length}
                </strong>{' '}
                selected variant
                {selectedVariants.length === 1 ? '' : 's'}? This will
                permanently remove them and all associated data.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={loading}
                  className="px-4 py-2 bg-gradient-to-r from-danger-600 to-brand-accent-500 hover:from-danger-700 hover:to-brand-accent-600 text-white rounded-xl flex items-center gap-2 disabled:opacity-50 transition duration-250 focus-ring shadow-brand"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Delete <span className="tabular-nums">{selectedVariants.length}</span> Variant
                  {selectedVariants.length === 1 ? '' : 's'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ProductVariantsManager;
