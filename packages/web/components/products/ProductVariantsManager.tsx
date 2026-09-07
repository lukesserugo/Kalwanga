// D:\Projects\Kalwanga\packages\web\components\products\ProductVariantsManager.tsx

'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Edit, Save, X, Package,
  DollarSign, Barcode, Tag, Layers, Copy,
  Check, Loader2, Image as ImageIcon,
  Upload, Grid, List, ChevronDown,
  AlertCircle, RefreshCw, Download, Search,
  ChevronRight, Minus, Maximize2, Eye,
  ShoppingCart, Clock, TrendingUp, TrendingDown,
  Filter, ArrowUpDown, Zap, Sparkles, Wand2
} from 'lucide-react';
import { productService, ProductVariant } from '../../services/productService';
import { toast } from '../../utils/toast-manager';
import { formatCurrency, formatDate } from '../../utils/formatters';

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
  name: string;
  sku: string;
  price: number;
  costPrice: number;
  stock: number;
  images: string[];
  attributes: Record<string, any>;
  isActive: boolean;
}

const defaultVariantForm: VariantFormData = {
  name: '',
  sku: '',
  price: 0,
  costPrice: 0,
  stock: 0,
  images: [],
  attributes: {},
  isActive: true,
};

// Image compression constants
const MAX_IMAGE_SIZE = 150 * 1024;
const MAX_IMAGE_DIMENSION = 500;
const MAX_FILE_SIZE = 3 * 1024 * 1024;
const MAX_VARIANT_IMAGES = 3;

export function ProductVariantsManager({ 
  productId, 
  variants, 
  onUpdate, 
  canManage = true,
  productName = '',
  productSku = ''
}: ProductVariantsManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'stock' | 'createdAt'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [newVariant, setNewVariant] = useState<VariantFormData>(defaultVariantForm);
  const [editVariant, setEditVariant] = useState<VariantFormData | null>(null);
  const [expandedVariants, setExpandedVariants] = useState<Set<string>>(new Set());
  const [selectedVariants, setSelectedVariants] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkConfig, setBulkConfig] = useState<BulkVariantConfig>({
    attributes: {},
    basePrice: 0,
    baseSku: '',
    baseStock: 0,
    baseCostPrice: 0,
    isActive: true,
  });
  const [newAttributeKey, setNewAttributeKey] = useState('');
  const [newAttributeValues, setNewAttributeValues] = useState('');
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null);
  const variantFileInputRef = useRef<HTMLInputElement>(null);

  // 🔥 NEW: Image compression function
  const compressImage = (
    dataUrl: string,
    maxWidth: number = MAX_IMAGE_DIMENSION,
    maxHeight: number = MAX_IMAGE_DIMENSION,
    quality: number = 0.35
  ): Promise<string> => {
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
          
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
          } else {
            reject(new Error('Could not get canvas context'));
          }
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  };

  const processImageFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const result = reader.result as string;
          let quality = 0.4;
          let compressed = await compressImage(result, MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, quality);
          
          let attempts = 0;
          while (compressed.length > MAX_IMAGE_SIZE && quality > 0.08 && attempts < 12) {
            quality -= 0.03;
            compressed = await compressImage(result, MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, quality);
            attempts++;
          }
          
          if (compressed.length > MAX_IMAGE_SIZE) {
            compressed = await compressImage(result, 300, 300, 0.25);
          }
          
          resolve(compressed);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // 🔥 NEW: Auto-generate variant SKU
  const generateVariantSku = () => {
    const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    const basePrefix = (productSku || productName || 'VAR')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 3)
      .toUpperCase() || 'VAR';
    return `${basePrefix}-${timestamp}-${random}`;
  };

  // 🔥 NEW: Handle variant image upload
  const handleVariantImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'new' | 'edit') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const currentImages = target === 'new' ? (newVariant.images || []) : (editVariant?.images || []);
    
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
        toast.error(`${file.name} exceeds the ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
        continue;
      }
      if (currentImages.length + validFiles.length >= MAX_VARIANT_IMAGES) {
        toast.warning(`Maximum ${MAX_VARIANT_IMAGES} images per variant, skipping remaining`);
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
      } catch (error) {
        console.error('Failed to process variant image:', error);
        toast.error(`Failed to process ${file.name}`);
      }
    }

    if (newImages.length > 0) {
      if (target === 'new') {
        setNewVariant(prev => ({
          ...prev,
          images: [...(prev.images || []), ...newImages]
        }));
      } else if (editVariant) {
        setEditVariant(prev => prev ? {
          ...prev,
          images: [...(prev.images || []), ...newImages]
        } : null);
      }
      toast.success(`${newImages.length} variant image(s) uploaded`);
    }

    e.target.value = '';
  };

  const removeVariantImage = (index: number, target: 'new' | 'edit') => {
    if (target === 'new') {
      setNewVariant(prev => ({
        ...prev,
        images: (prev.images || []).filter((_, i) => i !== index)
      }));
    } else if (editVariant) {
      setEditVariant(prev => prev ? {
        ...prev,
        images: (prev.images || []).filter((_, i) => i !== index)
      } : null);
    }
  };

  const filteredAndSortedVariants = useMemo(() => {
    let result = variants;
    
    // Filter
    if (searchQuery) {
      const term = searchQuery.toLowerCase();
      result = result.filter(v => 
        v.name.toLowerCase().includes(term) ||
        v.sku.toLowerCase().includes(term)
      );
    }
    
    if (filterActive !== 'all') {
      result = result.filter(v => 
        filterActive === 'active' ? v.isActive !== false : v.isActive === false
      );
    }
    
    // Sort
    result = [...result].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'price':
          comparison = (a.price || 0) - (b.price || 0);
          break;
        case 'stock':
          comparison = (a.stock || 0) - (b.stock || 0);
          break;
        case 'createdAt':
          comparison = (a.createdAt || '').localeCompare(b.createdAt || '');
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [variants, searchQuery, filterActive, sortBy, sortOrder]);

  const toggleSort = (field: 'name' | 'price' | 'stock' | 'createdAt') => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // 🔥 UPDATED: Add variant with images
  const handleAddVariant = async () => {
    if (!newVariant.name || !newVariant.sku || !newVariant.price) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const result = await productService.addVariant(productId, {
        name: newVariant.name,
        sku: newVariant.sku.toUpperCase(),
        price: newVariant.price,
        costPrice: newVariant.costPrice || 0,
        stock: newVariant.stock || 0,
        images: newVariant.images || [],
        attributes: newVariant.attributes || {},
        isActive: newVariant.isActive !== false,
      });
      const updatedVariants = [...variants, result];
      onUpdate(updatedVariants);
      setNewVariant(defaultVariantForm);
      setShowAddForm(false);
      toast.success('Variant added successfully');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add variant');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkCreate = async () => {
    const attributeKeys = Object.keys(bulkConfig.attributes);
    if (attributeKeys.length === 0) {
      toast.error('Please add at least one attribute');
      return;
    }
    if (!bulkConfig.baseSku) {
      toast.error('Base SKU is required');
      return;
    }
    if (bulkConfig.basePrice <= 0) {
      toast.error('Base price must be greater than 0');
      return;
    }

    setLoading(true);
    try {
      const combinations = generateCombinations(bulkConfig.attributes);
      const createdVariants = [];

      for (const combo of combinations) {
        const sku = `${bulkConfig.baseSku}-${combo.map(v => v.substring(0, 3).toUpperCase()).join('-')}`;
        const name = combo.join(' / ');
        const price = bulkConfig.basePrice;
        const costPrice = bulkConfig.baseCostPrice || 0;

        const result = await productService.addVariant(productId, {
          name,
          sku,
          price,
          costPrice,
          stock: bulkConfig.baseStock,
          attributes: combo.reduce((acc, val, idx) => ({
            ...acc,
            [attributeKeys[idx]]: val
          }), {}),
          isActive: bulkConfig.isActive !== false,
        });
        createdVariants.push(result);
      }

      const updatedVariants = [...variants, ...createdVariants];
      onUpdate(updatedVariants);
      setShowBulkForm(false);
      setBulkConfig({ attributes: {}, basePrice: 0, baseSku: '', baseStock: 0, baseCostPrice: 0, isActive: true });
      toast.success(`${createdVariants.length} variants created successfully`);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create variants');
    } finally {
      setLoading(false);
    }
  };

  const generateCombinations = (attributes: Record<string, string[]>): string[][] => {
    const keys = Object.keys(attributes);
    if (keys.length === 0) return [];
    
    const values = keys.map(key => attributes[key]);
    const combinations: string[][] = [[]];
    
    for (const valueSet of values) {
      const newCombinations: string[][] = [];
      for (const combo of combinations) {
        for (const value of valueSet) {
          newCombinations.push([...combo, value]);
        }
      }
      combinations.length = 0;
      combinations.push(...newCombinations);
    }
    
    return combinations;
  };

  // 🔥 UPDATED: Edit variant with images
  const handleEditVariant = async (index: number) => {
    if (!editVariant) return;
    setLoading(true);
    try {
      const result = await productService.updateVariant(editVariant.id!, {
        name: editVariant.name,
        sku: editVariant.sku.toUpperCase(),
        price: editVariant.price,
        costPrice: editVariant.costPrice || 0,
        stock: editVariant.stock || 0,
        images: editVariant.images || [],
        attributes: editVariant.attributes || {},
        isActive: editVariant.isActive !== false,
      });
      const updatedVariants = variants.map((v, i) => i === index ? result : v);
      onUpdate(updatedVariants);
      setEditingIndex(null);
      setEditVariant(null);
      toast.success('Variant updated successfully');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update variant');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVariant = async (index: number) => {
    const variant = variants[index];
    if (!variant.id) return;
    if (!confirm(`Are you sure you want to delete variant "${variant.name}"?`)) return;

    setLoading(true);
    try {
      await productService.deleteVariant(variant.id);
      const updatedVariants = variants.filter((_, i) => i !== index);
      onUpdate(updatedVariants);
      toast.success('Variant deleted successfully');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete variant');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedVariants.length === 0) return;
    
    setLoading(true);
    try {
      const results = await Promise.all(
        selectedVariants.map(async (id) => {
          try {
            await productService.deleteVariant(id);
            return true;
          } catch {
            return false;
          }
        })
      );
      
      const successCount = results.filter(Boolean).length;
      const updatedVariants = variants.filter(v => !selectedVariants.includes(v.id!));
      onUpdate(updatedVariants);
      setSelectedVariants([]);
      setShowBulkDeleteConfirm(false);
      toast.success(`${successCount} variants deleted successfully`);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete variants');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkStockUpdate = async (newStock: number) => {
    if (selectedVariants.length === 0) return;
    
    setLoading(true);
    try {
      const results = await Promise.all(
        selectedVariants.map(async (id) => {
          try {
            const variant = variants.find(v => v.id === id);
            if (!variant) return null;
            const result = await productService.updateVariant(id, { 
              stock: newStock,
              name: variant.name,
              sku: variant.sku,
              price: variant.price,
              costPrice: variant.costPrice || 0,
              attributes: variant.attributes || {},
              isActive: variant.isActive !== false,
              images: variant.images || [],
            });
            return result;
          } catch {
            return null;
          }
        })
      );
      
      const successResults = results.filter(Boolean);
      const updatedVariants = variants.map(v => {
        const updated = successResults.find(r => r && r.id === v.id);
        return updated || v;
      });
      onUpdate(updatedVariants);
      setSelectedVariants([]);
      toast.success(`${successResults.length} variants updated`);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update stock');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedVariants);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedVariants(newExpanded);
  };

  const toggleSelect = (id: string) => {
    setSelectedVariants(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedVariants.length === filteredAndSortedVariants.length) {
      setSelectedVariants([]);
    } else {
      setSelectedVariants(filteredAndSortedVariants.map(v => v.id!).filter(Boolean));
    }
  };

  const generateSku = () => {
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    setNewVariant({ ...newVariant, sku: `${productSku || 'VAR'}-${random}` });
  };

  const addAttributeToBulk = () => {
    if (!newAttributeKey || !newAttributeValues) {
      toast.error('Please enter both attribute key and values');
      return;
    }
    const values = newAttributeValues.split(',').map(v => v.trim()).filter(Boolean);
    if (values.length === 0) {
      toast.error('Please enter at least one value');
      return;
    }
    setBulkConfig({
      ...bulkConfig,
      attributes: {
        ...bulkConfig.attributes,
        [newAttributeKey]: values
      }
    });
    setNewAttributeKey('');
    setNewAttributeValues('');
    toast.success(`Added attribute "${newAttributeKey}" with ${values.length} values`);
  };

  const removeAttribute = (key: string) => {
    const newAttributes = { ...bulkConfig.attributes };
    delete newAttributes[key];
    setBulkConfig({ ...bulkConfig, attributes: newAttributes });
  };

  const getVariantStockStatus = (variant: ProductVariant) => {
    const stock = variant.stock || 0;
    if (stock <= 0) return { label: 'Out of Stock', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
    if (stock <= 5) return { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' };
    return { label: 'In Stock', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' };
  };

  const totalStock = useMemo(() => {
    return variants.reduce((sum, v) => sum + (v.stock || 0), 0);
  }, [variants]);

  const averagePrice = useMemo(() => {
    if (variants.length === 0) return 0;
    const total = variants.reduce((sum, v) => sum + v.price, 0);
    return total / variants.length;
  }, [variants]);

  const variantCount = variants.length;

  return (
    <div className="space-y-4">
      {/* Header with Stats */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-500" />
            Variants
          </h3>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <span>{variantCount} variants</span>
            <span className="w-px h-3 bg-gray-300 dark:bg-gray-600" />
            <span>Total Stock: {totalStock}</span>
            <span className="w-px h-3 bg-gray-300 dark:bg-gray-600" />
            <span>Avg Price: {formatCurrency(averagePrice)}</span>
            {variants.some(v => v.images && v.images.length > 0) && (
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
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              title={viewMode === 'list' ? 'Switch to Grid View' : 'Switch to List View'}
            >
              {viewMode === 'list' ? <Grid className="w-4 h-4" /> : <List className="w-4 h-4" />}
            </button>
            <button
              onClick={() => {
                setShowBulkForm(true);
                setShowAddForm(false);
              }}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
            >
              <Copy className="w-4 h-4" />
              Bulk Create
            </button>
            <button
              onClick={() => {
                setShowAddForm(true);
                setShowBulkForm(false);
              }}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Add Variant
            </button>
          </div>
        )}
      </div>

      {/* Filters & Search */}
      {variantCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
          <div className="flex-1 min-w-[150px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search variants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value as 'all' | 'active' | 'inactive')}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Variants</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <div className="flex items-center gap-1">
            <button
              onClick={() => toggleSort('name')}
              className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                sortBy === 'name' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button
              onClick={() => toggleSort('price')}
              className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                sortBy === 'price' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Price {sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button
              onClick={() => toggleSort('stock')}
              className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                sortBy === 'stock' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Stock {sortBy === 'stock' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
          </div>
          {selectedVariants.length > 0 && (
            <span className="text-xs text-blue-600 dark:text-blue-400">
              {selectedVariants.length} selected
            </span>
          )}
        </div>
      )}

      {/* Bulk Actions */}
      {selectedVariants.length > 1 && canManage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2"
        >
          <span className="text-sm text-blue-700 dark:text-blue-300">
            {selectedVariants.length} variants selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <label className="text-xs text-gray-600 dark:text-gray-400">Set Stock:</label>
              <input
                type="number"
                min="0"
                className="w-16 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="0"
                id="bulk-stock-input-manager"
              />
              <button
                onClick={() => {
                  const input = document.getElementById('bulk-stock-input-manager') as HTMLInputElement;
                  const value = parseInt(input.value);
                  if (!isNaN(value) && value >= 0) {
                    handleBulkStockUpdate(value);
                  } else {
                    toast.error('Please enter a valid stock number');
                  }
                }}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Apply
              </button>
            </div>
            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Delete Selected
            </button>
            <button
              onClick={() => setSelectedVariants([])}
              className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Clear
            </button>
          </div>
        </motion.div>
      )}

      {/* Variants Display */}
      {variantCount === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <Layers className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No variants added yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">Add variants to offer different options for this product</p>
          {canManage && (
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => setShowAddForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Single Variant
              </button>
              <button
                onClick={() => setShowBulkForm(true)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Bulk Create
              </button>
            </div>
          )}
        </div>
      ) : filteredAndSortedVariants.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <Search className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No variants match your filters</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setFilterActive('all');
            }}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Clear Filters
          </button>
        </div>
      ) : viewMode === 'list' ? (
        // List View
        <div className="space-y-3">
          {filteredAndSortedVariants.map((variant, index) => {
            const isEditing = editingIndex === index;
            const isExpanded = expandedVariants.has(variant.id || `var-${index}`);
            const isSelected = selectedVariants.includes(variant.id!);
            const stockStatus = getVariantStockStatus(variant);
            const actualIndex = variants.indexOf(variant);

            return (
              <motion.div
                key={variant.id || index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`border rounded-lg overflow-hidden transition-colors ${
                  isSelected 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10' 
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className={`p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${isEditing ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                  <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                    {canManage && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => variant.id && toggleSelect(variant.id)}
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                      />
                    )}
                    <button
                      onClick={() => variant.id && toggleExpand(variant.id)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                      aria-label={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                      {variant.images?.[0] ? (
                        <img src={variant.images[0]} alt={variant.name} className="w-full h-full object-cover" />
                      ) : (
                        <Layers className="w-5 h-5 text-blue-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {variant.name}
                          {variant.isActive === false && (
                            <span className="ml-2 text-xs text-red-500">(Inactive)</span>
                          )}
                        </p>
                        {variant.isActive !== undefined && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            variant.isActive
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          }`}>
                            {variant.isActive ? 'Active' : 'Inactive'}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          <span className="font-mono">{variant.sku}</span>
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatCurrency(variant.price)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stockStatus.color}`}>
                          {stockStatus.label}
                        </span>
                        <span className="text-xs">Stock: {variant.stock || 0}</span>
                        {variant.costPrice && variant.costPrice > 0 && (
                          <span className="text-xs text-gray-400">Cost: {formatCurrency(variant.costPrice)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {canManage && !isEditing && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          const originalIndex = variants.indexOf(variant);
                          setEditingIndex(originalIndex);
                          setEditVariant({ ...variant, id: variant.id, images: variant.images || [] });
                        }}
                        className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                        title="Edit variant"
                      >
                        <Edit className="w-4 h-4 text-blue-500" />
                      </button>
                      <button
                        onClick={() => handleDeleteVariant(actualIndex)}
                        className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                        title="Delete variant"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  )}
                  {isEditing && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEditVariant(actualIndex)}
                        disabled={loading}
                        className="p-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                        title="Save changes"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingIndex(null);
                          setEditVariant(null);
                        }}
                        className="p-1.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Edit Form */}
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
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                          <input
                            type="text"
                            value={editVariant.name}
                            onChange={(e) => setEditVariant({ ...editVariant, name: e.target.value })}
                            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">SKU</label>
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={editVariant.sku}
                              onChange={(e) => setEditVariant({ ...editVariant, sku: e.target.value.toUpperCase() })}
                              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => setEditVariant({ ...editVariant, sku: generateVariantSku() })}
                              className="px-2 py-1.5 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                              title="Generate SKU"
                            >
                              <Wand2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Price</label>
                          <input
                            type="number"
                            value={editVariant.price}
                            onChange={(e) => setEditVariant({ ...editVariant, price: parseFloat(e.target.value) || 0 })}
                            step="0.01"
                            min="0"
                            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Stock</label>
                          <input
                            type="number"
                            value={editVariant.stock}
                            onChange={(e) => setEditVariant({ ...editVariant, stock: parseInt(e.target.value) || 0 })}
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
                            value={JSON.stringify(editVariant.attributes || {})}
                            onChange={(e) => {
                              try {
                                const parsed = JSON.parse(e.target.value);
                                setEditVariant({ ...editVariant, attributes: parsed });
                              } catch {
                                // Invalid JSON, ignore
                              }
                            }}
                            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono"
                            placeholder='{"size": "large"}'
                          />
                        </div>
                        
                        {/* 🔥 NEW: Edit Variant Images Upload */}
                        <div className="sm:col-span-2 lg:col-span-4">
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Images (Max {MAX_VARIANT_IMAGES})
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {editVariant.images && editVariant.images.map((img, imgIndex) => (
                              <div key={imgIndex} className="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-200">
                                <img src={img} alt={`Variant ${imgIndex + 1}`} className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => removeVariantImage(imgIndex, 'edit')}
                                  className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full p-0.5"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                            {(editVariant.images?.length || 0) < MAX_VARIANT_IMAGES && (
                              <label className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-500 cursor-pointer flex flex-col items-center justify-center text-gray-400">
                                <Upload className="w-4 h-4" />
                                <span className="text-[8px] mt-0.5">Upload</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  onChange={(e) => handleVariantImageUpload(e, 'edit')}
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

                {/* Expanded Details */}
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
                          <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
                          <p className="text-sm text-gray-900 dark:text-white">
                            {variant.createdAt ? formatDate(variant.createdAt) : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Cost Price</p>
                          <p className="text-sm text-gray-900 dark:text-white">
                            {variant.costPrice ? formatCurrency(variant.costPrice) : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Profit Margin</p>
                          <p className="text-sm font-medium text-green-600 dark:text-green-400">
                            {variant.costPrice && variant.costPrice > 0
                              ? `${(((variant.price - variant.costPrice) / variant.price) * 100).toFixed(1)}%`
                              : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Stock Value</p>
                          <p className="text-sm text-gray-900 dark:text-white">
                            {formatCurrency((variant.price || 0) * (variant.stock || 0))}
                          </p>
                        </div>
                        {Object.keys(variant.attributes || {}).length > 0 && (
                          <div className="sm:col-span-2 lg:col-span-3">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Attributes</p>
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(variant.attributes || {}).map(([key, value]) => (
                                <span key={key} className="px-2 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-xs">
                                  {key}: {String(value)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {variant.images && variant.images.length > 0 && (
                          <div className="sm:col-span-2 lg:col-span-3">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Images</p>
                            <div className="flex gap-2 flex-wrap">
                              {variant.images.map((img, i) => (
                                <div key={i} className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 cursor-pointer hover:border-blue-500 transition-colors">
                                  <img src={img} alt={`${variant.name} ${i}`} className="w-full h-full object-cover" />
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
        // Grid View
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSortedVariants.map((variant, index) => {
            const isEditing = editingIndex === index;
            const isSelected = selectedVariants.includes(variant.id!);
            const stockStatus = getVariantStockStatus(variant);
            const actualIndex = variants.indexOf(variant);

            return (
              <motion.div
                key={variant.id || index}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -4 }}
                className={`border rounded-lg overflow-hidden hover:shadow-md transition-all ${
                  isSelected 
                    ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-50' 
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="aspect-square bg-gray-100 dark:bg-gray-700 relative">
                  {variant.images?.[0] ? (
                    <img src={variant.images[0]} alt={variant.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Layers className="w-12 h-12 text-gray-300 dark:text-gray-500" />
                    </div>
                  )}
                  {!variant.isActive && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-red-600 text-white text-xs rounded">
                      Inactive
                    </div>
                  )}
                  {canManage && (
                    <div className="absolute top-2 left-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => variant.id && toggleSelect(variant.id)}
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700"
                      />
                    </div>
                  )}
                  <div className={`absolute bottom-2 right-2 px-2 py-1 rounded text-xs font-medium ${stockStatus.color}`}>
                    {stockStatus.label}
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 dark:text-white truncate">{variant.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-mono truncate">SKU: {variant.sku}</p>
                    </div>
                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400 ml-2">
                      {formatCurrency(variant.price)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Stock: {variant.stock}</span>
                    <span className="text-gray-500 dark:text-gray-400">
                      Value: {formatCurrency((variant.price || 0) * (variant.stock || 0))}
                    </span>
                  </div>
                  {Object.keys(variant.attributes || {}).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {Object.entries(variant.attributes).slice(0, 3).map(([key, val]) => (
                        <span key={key} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs truncate">
                          {key}: {val}
                        </span>
                      ))}
                      {Object.keys(variant.attributes).length > 3 && (
                        <span className="px-1.5 py-0.5 text-xs text-gray-400">+{Object.keys(variant.attributes).length - 3}</span>
                      )}
                    </div>
                  )}
                  {canManage && !isEditing && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-1">
                      <button
                        onClick={() => {
                          const originalIndex = variants.indexOf(variant);
                          setEditingIndex(originalIndex);
                          setEditVariant({ ...variant, id: variant.id, images: variant.images || [] });
                        }}
                        className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4 text-blue-500" />
                      </button>
                      <button
                        onClick={() => handleDeleteVariant(actualIndex)}
                        className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add Variant Form */}
      <AnimatePresence>
        {showAddForm && canManage && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/10 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-gray-900 dark:text-white">Add New Variant</h4>
              <button
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
                    setNewVariant({ 
                      ...newVariant, 
                      name: value,
                      sku: !newVariant.sku && value.trim().length >= 2 ? generateVariantSku() : newVariant.sku
                    });
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
                    onChange={(e) => setNewVariant({ ...newVariant, sku: e.target.value.toUpperCase() })}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono"
                    placeholder="Enter SKU"
                  />
                  <button
                    type="button"
                    onClick={() => setNewVariant({ ...newVariant, sku: generateVariantSku() })}
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
                  onChange={(e) => setNewVariant({ ...newVariant, price: parseFloat(e.target.value) || 0 })}
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
                  onChange={(e) => setNewVariant({ ...newVariant, stock: parseInt(e.target.value) || 0 })}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
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
                  onChange={(e) => setNewVariant({ ...newVariant, costPrice: parseFloat(e.target.value) || 0 })}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
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
                      setNewVariant({ ...newVariant, attributes: parsed });
                    } catch {
                      // Invalid JSON, ignore
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
                  placeholder='{"size": "large", "color": "red"}'
                />
              </div>

              {/* 🔥 NEW: Variant Images Upload */}
              <div className="sm:col-span-2 lg:col-span-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Images (Max {MAX_VARIANT_IMAGES})
                </label>
                <div className="flex flex-wrap gap-2">
                  {newVariant.images && newVariant.images.map((img, imgIndex) => (
                    <div key={imgIndex} className="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-200">
                      <img src={img} alt={`Variant ${imgIndex + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeVariantImage(imgIndex, 'new')}
                        className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {(newVariant.images?.length || 0) < MAX_VARIANT_IMAGES && (
                    <label className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-500 cursor-pointer flex flex-col items-center justify-center text-gray-400">
                      <Upload className="w-4 h-4" />
                      <span className="text-[8px] mt-0.5">Upload</span>
                      <input
                        type="file"
                        ref={variantFileInputRef}
                        accept="image/*"
                        multiple
                        onChange={(e) => handleVariantImageUpload(e, 'new')}
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

      {/* Bulk Create Form */}
      <AnimatePresence>
        {showBulkForm && canManage && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border border-purple-200 dark:border-purple-800 rounded-lg p-4 bg-purple-50 dark:bg-purple-900/10 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-500" />
                Bulk Create Variants
              </h4>
              <button
                onClick={() => setShowBulkForm(false)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                aria-label="Close form"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Base SKU <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={bulkConfig.baseSku}
                    onChange={(e) => setBulkConfig({ ...bulkConfig, baseSku: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono"
                    placeholder="e.g., PROD"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Base Price <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={bulkConfig.basePrice}
                    onChange={(e) => setBulkConfig({ ...bulkConfig, basePrice: parseFloat(e.target.value) || 0 })}
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
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
                    onChange={(e) => setBulkConfig({ ...bulkConfig, baseStock: parseInt(e.target.value) || 0 })}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Base Cost Price
                  </label>
                  <input
                    type="number"
                    value={bulkConfig.baseCostPrice}
                    onChange={(e) => setBulkConfig({ ...bulkConfig, baseCostPrice: parseFloat(e.target.value) || 0 })}
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
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
                    className="flex-1 min-w-[120px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Attribute (e.g., Color)"
                  />
                  <input
                    type="text"
                    value={newAttributeValues}
                    onChange={(e) => setNewAttributeValues(e.target.value)}
                    className="flex-1 min-w-[120px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Values (e.g., Red, Blue)"
                  />
                  <button
                    type="button"
                    onClick={addAttributeToBulk}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(bulkConfig.attributes).map(([key, values]) => (
                    <span key={key} className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm">
                      <span className="font-medium">{key}:</span>
                      <span>{values.join(', ')}</span>
                      <button
                        type="button"
                        onClick={() => removeAttribute(key)}
                        className="ml-1 p-0.5 hover:bg-red-100 rounded transition-colors"
                        aria-label={`Remove ${key}`}
                      >
                        <X className="w-3 h-3 text-red-500" />
                      </button>
                    </span>
                  ))}
                  {Object.keys(bulkConfig.attributes).length === 0 && (
                    <span className="text-sm text-gray-400">No attributes added yet</span>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-700 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  This will create <span className="font-bold text-purple-600">
                    {Object.keys(bulkConfig.attributes).length > 0 
                      ? Object.values(bulkConfig.attributes).reduce((acc, val) => acc * val.length, 1)
                      : 0}
                  </span> variants from all combinations.
                </p>
                <div className="flex items-center gap-3 text-sm">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bulkConfig.isActive !== false}
                      onChange={(e) => setBulkConfig({ ...bulkConfig, isActive: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                    Active
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-purple-200 dark:border-purple-800">
                <button
                  type="button"
                  onClick={() => setShowBulkForm(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkCreate}
                  disabled={loading || Object.keys(bulkConfig.attributes).length === 0}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 disabled:opacity-50 transition-colors"
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

      {/* Bulk Delete Confirmation Modal */}
      <AnimatePresence>
        {showBulkDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" onClick={() => setShowBulkDeleteConfirm(false)} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
            >
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete Variants</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to delete <strong className="text-gray-900 dark:text-white">{selectedVariants.length}</strong> selected variants?
                This will permanently remove them and all associated data.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Delete {selectedVariants.length} Variants
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
