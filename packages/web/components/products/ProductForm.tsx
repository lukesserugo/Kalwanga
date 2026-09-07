'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Save, X, Package, DollarSign, Barcode, Tag, Layers,
  Image as ImageIcon, Plus, Trash2, Loader2, Upload, ChevronDown,
  ArrowLeft, AlertCircle, CheckCircle, Lock, Eye,
  Star, Heart, ShoppingCart, Truck, Shield, Clock,
  QrCode, RefreshCw, Copy, Printer, Download, Scan,
  Info, AlertTriangle, ChevronRight, Minus, Maximize2,
  Wand2
} from 'lucide-react';
import { productService, ProductVariant } from '../../services/productService';
import { categoryService } from '../../services/categoryService';
import { supplierService } from '../../services/supplierService';
import { barcodeService } from '../../services/barcodeService';
import { inventoryService } from '../../services/inventoryService';
import { toast } from '../../utils/toast-manager';
import { formatCurrency } from '../../utils/formatters';
import { usePermission } from '../../hooks/usePermission';
import { PermissionResource } from '../../types/enums';

// ============================================
// INTERFACES
// ============================================

interface ProductFormProps {
  mode: 'create' | 'edit';
  productId?: string;
  businessUnitId?: string;
}

interface Category {
  id: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  businessUnitId?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface ExtendedProduct {
  id: string;
  name: string;
  description?: string;
  sku: string;
  barcode?: string;
  unitPrice: number;
  costPrice?: number;
  taxRate?: number;
  minStock?: number;
  maxStock?: number;
  categoryId?: string;
  supplierId?: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  images: string[];
  attributes?: Record<string, any>;
  isActive: boolean;
  isDigital?: boolean;
  featured?: boolean;
  tags?: string[];
  notes?: string;
  variants?: ProductVariant[];
  businessUnitId?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface BarcodeInfo {
  barcode: string;
  barcodeUrl: string;
  qrCodeUrl: string;
  isGenerated: boolean;
}

interface Supplier {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  companyId?: string;
  isActive?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const tabs = [
  { id: 'basic', label: 'Basic Info', icon: Package },
  { id: 'pricing', label: 'Pricing', icon: DollarSign },
  { id: 'inventory', label: 'Inventory', icon: Layers },
  { id: 'images', label: 'Images', icon: ImageIcon },
  { id: 'variants', label: 'Variants', icon: Layers },
  { id: 'attributes', label: 'Attributes', icon: Tag },
  { id: 'seo', label: 'SEO', icon: Eye },
];

// ✅ FIXED: Increased image limits for better quality
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_IMAGE_DIMENSION = 1920; // 4K ready
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_IMAGES = 10;
const MAX_VARIANT_IMAGES = 5;
const MAX_VARIANTS = 10;
const PLACEHOLDER_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// ============================================
// MAIN COMPONENT
// ============================================

export function ProductForm({ mode, productId, businessUnitId = 'default' }: ProductFormProps) {
  const router = useRouter();
  const { canManage } = usePermission();
  const isEdit = mode === 'edit';

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sku: '',
    barcode: '',
    unitPrice: 0,
    costPrice: 0,
    taxRate: 0,
    minStock: 5,
    maxStock: 100,
    categoryId: '',
    supplierId: '',
    weight: 0,
    dimensions: { length: 0, width: 0, height: 0 },
    images: [] as string[],
    attributes: {} as Record<string, any>,
    isActive: true,
    isDigital: false,
    featured: false,
    tags: [] as string[],
    notes: '',
  });
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [newVariant, setNewVariant] = useState<ProductVariant>({
    id: '',
    name: '',
    sku: '',
    price: 0,
    costPrice: 0,
    stock: 0,
    attributes: {},
    isActive: true,
    images: [],
  });
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [newTag, setNewTag] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const variantFileInputRef = useRef<HTMLInputElement>(null);
  const [isClient, setIsClient] = useState(false);
  
  // Auto SKU state
  const [autoGenerateSKU, setAutoGenerateSKU] = useState(true);
  
  // Barcode/QR Code states
  const [generatingBarcode, setGeneratingBarcode] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isBarcodeValid, setIsBarcodeValid] = useState<boolean | null>(null);
  const [checkingBarcode, setCheckingBarcode] = useState(false);
  const [barcodeInfo, setBarcodeInfo] = useState<BarcodeInfo | null>(null);
  const [productIdForBarcode, setProductIdForBarcode] = useState<string | null>(null);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  // ✅ FIXED: Image error states
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [variantImageErrors, setVariantImageErrors] = useState<Record<string, boolean>>({});
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const canManageProducts = canManage(PermissionResource.PRODUCT);

  // ✅ FIXED: Image error handlers
  const handleImageError = useCallback((imageUrl: string) => {
    setImageErrors(prev => ({ ...prev, [imageUrl]: true }));
  }, []);

  const handleVariantImageError = useCallback((imageUrl: string) => {
    setVariantImageErrors(prev => ({ ...prev, [imageUrl]: true }));
  }, []);

  const getValidImage = useCallback((imageUrl: string | undefined): string => {
    if (!imageUrl) return PLACEHOLDER_IMAGE;
    if (imageErrors[imageUrl]) return PLACEHOLDER_IMAGE;
    return imageUrl;
  }, [imageErrors]);

  const getValidVariantImage = useCallback((imageUrl: string | undefined): string => {
    if (!imageUrl) return PLACEHOLDER_IMAGE;
    if (variantImageErrors[imageUrl]) return PLACEHOLDER_IMAGE;
    return imageUrl;
  }, [variantImageErrors]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load data on mount
  useEffect(() => {
    if (isClient) {
      loadCategories();
      loadSuppliers();
      if (isEdit && productId) {
        loadProduct();
      } else {
        setFormData(prev => ({
          ...prev,
          sku: generateSKU(),
        }));
        setLoading(false);
      }
    }
  }, [isClient, productId, isEdit]);

  // Check barcode uniqueness when it changes
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (formData.barcode && formData.barcode.length >= 4) {
        checkBarcodeUniqueness(formData.barcode);
      } else if (formData.barcode && formData.barcode.length < 4) {
        setIsBarcodeValid(null);
        setBarcodeError(null);
      }
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [formData.barcode]);

  // ============================================
  // SKU GENERATION FUNCTIONS
  // ============================================

  const generateSKU = useCallback((productName?: string, variantName?: string) => {
    const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    
    if (variantName) {
      const basePrefix = (productName || formData.name || 'PRD')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 3)
        .toUpperCase() || 'PRD';
      const variantPrefix = variantName
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 3)
        .toUpperCase() || 'VAR';
      return `${basePrefix}-${variantPrefix}-${timestamp}-${random}`;
    }
    
    const prefix = (productName || formData.name || 'PRD')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 3)
      .toUpperCase() || 'PRD';
    return `${prefix}-${timestamp}-${random}`;
  }, [formData.name]);

  const generateVariantSKU = useCallback((variantName: string) => {
    return generateSKU(formData.name || 'PRD', variantName);
  }, [formData.name, generateSKU]);

  // ============================================
  // ✅ FIXED: IMAGE COMPRESSION FUNCTIONS with better quality
  // ============================================

  const compressImage = useCallback((
    dataUrl: string,
    maxWidth: number = MAX_IMAGE_DIMENSION,
    maxHeight: number = MAX_IMAGE_DIMENSION,
    quality: number = 0.8
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
  }, []);

  const processImageFile = useCallback(async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const result = reader.result as string;
          // ✅ FIXED: Better quality settings
          let quality = 0.8;
          let compressed = await compressImage(result, MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, quality);
          
          // ✅ FIXED: Reduce quality gradually if needed
          let attempts = 0;
          while (compressed.length > MAX_IMAGE_SIZE && quality > 0.2 && attempts < 15) {
            quality -= 0.04;
            compressed = await compressImage(result, Math.min(MAX_IMAGE_DIMENSION, 1600), Math.min(MAX_IMAGE_DIMENSION, 1600), quality);
            attempts++;
          }
          
          // ✅ FIXED: Final fallback - use placeholder if still too large
          if (compressed.length > MAX_IMAGE_SIZE) {
            compressed = await compressImage(result, 800, 800, 0.3);
          }
          
          if (compressed.length > MAX_IMAGE_SIZE) {
            console.warn(`Image too large (${Math.round(compressed.length / 1024)}KB), using placeholder`);
            resolve(PLACEHOLDER_IMAGE);
          } else {
            resolve(compressed);
          }
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, [compressImage]);

  // ============================================
  // DATA LOADING FUNCTIONS
  // ============================================

  const loadCategories = useCallback(async () => {
    try {
      const data = await categoryService.getAllCategories({ 
        businessUnitId: businessUnitId || 'default',
        isActive: true,
        limit: 100 
      });
      setCategories(data || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
      setCategories([]);
    }
  }, [businessUnitId]);

  const loadSuppliers = useCallback(async () => {
    try {
      const data = await supplierService.getAllSuppliers({ 
        companyId: businessUnitId || 'default',
        isActive: true,
        limit: 100 
      });
      setSuppliers(data || []);
    } catch (error) {
      console.error('Failed to load suppliers:', error);
      setSuppliers([]);
    }
  }, [businessUnitId]);

  const loadProduct = useCallback(async () => {
    try {
      setLoading(true);
      // Reset image errors on load
      setImageErrors({});
      setVariantImageErrors({});
      
      const product = await productService.getProductById(productId!) as ExtendedProduct;
      setFormData({
        name: product.name,
        description: product.description || '',
        sku: product.sku,
        barcode: product.barcode || '',
        unitPrice: product.unitPrice,
        costPrice: product.costPrice || 0,
        taxRate: product.taxRate || 0,
        minStock: product.minStock || 5,
        maxStock: product.maxStock || 100,
        categoryId: product.categoryId || '',
        supplierId: product.supplierId || '',
        weight: product.weight || 0,
        dimensions: product.dimensions || { length: 0, width: 0, height: 0 },
        images: product.images || [],
        attributes: product.attributes || {},
        isActive: product.isActive,
        isDigital: product.isDigital || false,
        featured: product.featured || false,
        tags: product.tags || [],
        notes: product.notes || '',
      });
      setVariants((product.variants || []).map((v: any) => ({
        ...v,
        images: v.images || [],
        attributes: v.attributes || {},
      })));
      if (product.images && product.images.length > 0) {
        setPreviewImage(product.images[0]);
      }
      
      setProductIdForBarcode(product.id);
      
      if (product.barcode) {
        try {
          const barcodeImg = await barcodeService.generateBarcodeImage(product.barcode);
          const qrData = await barcodeService.generateQRCode({
            product: product.name,
            sku: product.sku,
            barcode: product.barcode,
            price: product.unitPrice,
          });
          setBarcodeInfo({
            barcode: product.barcode,
            barcodeUrl: barcodeImg.barcodeUrl,
            qrCodeUrl: qrData.qrCodeUrl || '',
            isGenerated: true,
          });
          setQrCodeUrl(qrData.qrCodeUrl || null);
          setIsBarcodeValid(true);
        } catch (error) {
          console.warn('Could not fetch barcode info:', error);
        }
      }
    } catch (error) {
      console.error('Failed to load product:', error);
      toast.error('Failed to load product');
      router.push('/admin/catalog');
    } finally {
      setLoading(false);
    }
  }, [productId, router]);

  // ============================================
  // BARCODE FUNCTIONS
  // ============================================

  const checkBarcodeUniqueness = useCallback(async (barcode: string): Promise<boolean> => {
    if (!barcode || barcode.length < 3) return true;
    
    setCheckingBarcode(true);
    setBarcodeError(null);
    try {
      try {
        const product = await productService.getProductByBarcode(barcode);
        if (product && product.id !== productId) {
          setIsBarcodeValid(false);
          setBarcodeError('This barcode is already assigned to another product');
          setErrors(prev => ({ 
            ...prev, 
            barcode: 'This barcode is already assigned to another product'
          }));
          return false;
        }
      } catch (error: any) {
        if (error?.response?.status === 404) {
          setIsBarcodeValid(true);
          setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors.barcode;
            return newErrors;
          });
          return true;
        }
        console.warn('Error checking barcode:', error);
      }
      
      setIsBarcodeValid(true);
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.barcode;
        return newErrors;
      });
      return true;
    } catch (error: any) {
      console.error('Error checking barcode:', error);
      return true;
    } finally {
      setCheckingBarcode(false);
    }
  }, [isEdit, productId]);

  const handleGenerateBarcode = useCallback(async () => {
    if (!formData.name) {
      toast.error('Please enter a product name first');
      return;
    }

    setGeneratingBarcode(true);
    setBarcodeError(null);
    try {
      const targetProductId = productId || `temp_${Date.now()}`;
      
      const barcodeResult = await barcodeService.generateUniqueBarcode({
        prefix: 'PRD',
        length: 12,
        productName: formData.name,
        sku: formData.sku || undefined,
      });

      setFormData(prev => ({ ...prev, barcode: barcodeResult.barcode }));
      setIsBarcodeValid(true);
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.barcode;
        return newErrors;
      });
      
      const barcodeImage = await barcodeService.generateBarcodeImage(barcodeResult.barcode);
      
      const qrData = await barcodeService.generateQRCode({
        product: formData.name,
        sku: formData.sku,
        barcode: barcodeResult.barcode,
        price: formData.unitPrice,
      });
      
      setBarcodeInfo({
        barcode: barcodeResult.barcode,
        barcodeUrl: barcodeImage.barcodeUrl,
        qrCodeUrl: qrData.qrCodeUrl || '',
        isGenerated: true,
      });
      setQrCodeUrl(qrData.qrCodeUrl || null);
      setShowBarcode(true);
      toast.success('Unique barcode generated successfully');
    } catch (error: any) {
      console.error('Failed to generate barcode:', error);
      setBarcodeError(error?.message || 'Failed to generate barcode');
      toast.error(error?.message || 'Failed to generate barcode');
      setIsBarcodeValid(false);
    } finally {
      setGeneratingBarcode(false);
    }
  }, [formData.name, formData.sku, formData.unitPrice, productId]);

  const handleBarcodeChange = useCallback((value: string) => {
    const newValue = value.toUpperCase().trim();
    setFormData(prev => ({ ...prev, barcode: newValue }));
    setBarcodeError(null);
    
    if (newValue.length >= 4) {
      checkBarcodeUniqueness(newValue);
    } else {
      setIsBarcodeValid(null);
    }
  }, [checkBarcodeUniqueness]);

  const handleCopyBarcode = useCallback(async () => {
    if (!formData.barcode) return;
    try {
      await navigator.clipboard.writeText(formData.barcode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Barcode copied');
    } catch {
      toast.error('Failed to copy');
    }
  }, [formData.barcode]);

  const handlePrintBarcode = useCallback(() => {
    if (!barcodeInfo || !formData.name) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Barcode - ${formData.name}</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: white; }
            .container { text-align: center; padding: 30px; border: 1px solid #ddd; border-radius: 8px; max-width: 400px; }
            .barcode-img { max-width: 300px; margin: 15px 0; }
            .qr-img { max-width: 150px; margin: 10px 0; }
            .info { margin-top: 15px; }
            .info p { margin: 5px 0; font-size: 14px; }
            .info .label { color: #666; }
            .info .value { font-weight: bold; }
            .product-name { margin: 0 0 5px 0; color: #1a1a1a; }
            .sku { color: #666; font-size: 12px; margin: 0 0 15px 0; }
            .price { font-size: 18px; font-weight: bold; color: #2563eb; margin: 5px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2 class="product-name">${formData.name}</h2>
            <p class="sku">SKU: ${formData.sku || 'N/A'}</p>
            ${barcodeInfo.barcodeUrl ? `<img src="${barcodeInfo.barcodeUrl}" alt="Barcode" class="barcode-img" onerror="this.style.display='none'" />` : ''}
            ${barcodeInfo.qrCodeUrl ? `<img src="${barcodeInfo.qrCodeUrl}" alt="QR Code" class="qr-img" onerror="this.style.display='none'" />` : ''}
            <div class="price">${formatCurrency(formData.unitPrice || 0)}</div>
            <div class="info">
              <p><span class="label">Barcode:</span> <span class="value">${barcodeInfo.barcode}</span></p>
              <p><span class="label">Min Stock:</span> <span class="value">${formData.minStock}</span></p>
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [barcodeInfo, formData]);

  const handleDownloadBarcode = useCallback(() => {
    if (!barcodeInfo?.barcodeUrl) return;
    const link = document.createElement('a');
    link.href = barcodeInfo.barcodeUrl;
    link.download = `barcode-${formData.sku || formData.barcode}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Barcode downloaded');
  }, [barcodeInfo, formData.sku, formData.barcode]);

  // ============================================
  // ✅ FIXED: IMAGE FUNCTIONS with error handling
  // ============================================

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (formData.images.length >= MAX_IMAGES) {
      toast.error(`Maximum ${MAX_IMAGES} images allowed`);
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
      if (formData.images.length + validFiles.length >= MAX_IMAGES) {
        toast.warning(`Maximum ${MAX_IMAGES} images allowed, skipping remaining`);
        break;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      e.target.value = '';
      return;
    }

    setUploadingImages(true);
    toast.info(`Processing ${validFiles.length} image(s)...`);

    const newImages: string[] = [];
    
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      try {
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
        const compressed = await processImageFile(file);
        newImages.push(compressed);
        setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
      } catch (error) {
        console.error('Failed to process image:', error);
        toast.error(`Failed to process ${file.name}`);
      }
    }

    if (newImages.length > 0) {
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...newImages]
      }));
      if (!previewImage) {
        setPreviewImage(newImages[0]);
      }
      toast.success(`${newImages.length} image(s) uploaded successfully`);
    }

    setUploadingImages(false);
    setUploadProgress({});
    e.target.value = '';
  }, [formData.images.length, previewImage, processImageFile]);

  const removeImage = useCallback((index: number) => {
    const imageToRemove = formData.images[index];
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
    if (previewImage === imageToRemove) {
      const remaining = formData.images.filter((_, i) => i !== index);
      setPreviewImage(remaining.length > 0 ? remaining[0] : null);
    }
  }, [formData.images, previewImage]);

  const setMainImage = useCallback((index: number) => {
    const image = formData.images[index];
    if (image) {
      setPreviewImage(image);
      const newImages = [...formData.images];
      const [removed] = newImages.splice(index, 1);
      newImages.unshift(removed);
      setFormData(prev => ({
        ...prev,
        images: newImages
      }));
    }
  }, [formData.images]);

  // ============================================
  // ✅ FIXED: VARIANT IMAGE FUNCTIONS with error handling
  // ============================================

  const handleVariantImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if ((newVariant.images?.length || 0) >= MAX_VARIANT_IMAGES) {
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
      if ((newVariant.images?.length || 0) + validFiles.length >= MAX_VARIANT_IMAGES) {
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
      setNewVariant(prev => ({
        ...prev,
        images: [...(prev.images || []), ...newImages]
      }));
      toast.success(`${newImages.length} variant image(s) uploaded`);
    }

    e.target.value = '';
  }, [newVariant.images, processImageFile]);

  const removeVariantImage = useCallback((index: number) => {
    setNewVariant(prev => ({
      ...prev,
      images: (prev.images || []).filter((_, i) => i !== index)
    }));
  }, []);

  // ============================================
  // TAG FUNCTIONS
  // ============================================

  const addTag = useCallback(() => {
    const trimmed = newTag.trim();
    if (trimmed && !formData.tags.includes(trimmed)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, trimmed]
      }));
      setNewTag('');
    }
  }, [newTag, formData.tags]);

  const removeTag = useCallback((tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  }, []);

  // ============================================
  // VARIANT FUNCTIONS
  // ============================================

  const handleAddVariant = useCallback(() => {
    if (variants.length >= MAX_VARIANTS) {
      toast.error(`Maximum ${MAX_VARIANTS} variants allowed`);
      return;
    }

    const variantErrors: Record<string, string> = {};
    if (!newVariant.name.trim()) variantErrors.variantName = 'Variant name is required';
    if (!newVariant.sku.trim()) variantErrors.variantSku = 'SKU is required';
    if (newVariant.price <= 0) variantErrors.variantPrice = 'Price must be greater than 0';
    
    if (Object.keys(variantErrors).length > 0) {
      const firstError = Object.values(variantErrors)[0];
      toast.error(firstError);
      return;
    }

    const existingSku = variants.find(v => v.sku === newVariant.sku.toUpperCase());
    if (existingSku) {
      toast.error('Variant SKU already exists');
      return;
    }

    setVariants(prev => [...prev, { 
      ...newVariant, 
      sku: newVariant.sku.toUpperCase(),
      id: `variant_${Date.now()}`,
      images: newVariant.images || [],
    }]);
    setNewVariant({ 
      id: '',
      name: '', 
      sku: '', 
      price: 0, 
      costPrice: 0, 
      stock: 0, 
      attributes: {},
      isActive: true,
      images: [],
    });
    setShowVariantForm(false);
    toast.success('Variant added successfully');
  }, [newVariant, variants]);

  const handleRemoveVariant = useCallback((index: number) => {
    setVariants(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleVariantNameChange = useCallback((value: string) => {
    setNewVariant(prev => ({
      ...prev,
      name: value,
      sku: value.trim().length >= 2 ? generateVariantSKU(value) : prev.sku
    }));
  }, [generateVariantSKU]);

  // ============================================
  // FORM FUNCTIONS
  // ============================================

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (name === 'name' && autoGenerateSKU && !isEdit) {
      const newSKU = generateSKU(value);
      setFormData(prev => ({
        ...prev,
        name: value,
        sku: newSKU,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'number' ? parseFloat(value) || 0 : value,
      }));
    }
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  }, [autoGenerateSKU, isEdit, generateSKU, errors]);

  const handleCheckboxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  }, [addTag]);

  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};
    if (!formData.name) newErrors.name = 'Product name is required';
    if (!formData.sku) newErrors.sku = 'SKU is required';
    if (formData.unitPrice <= 0) newErrors.unitPrice = 'Unit price must be greater than 0';
    
    if (formData.barcode && isBarcodeValid === false) {
      newErrors.barcode = barcodeError || 'Barcode is already assigned to another product';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, isBarcodeValid, barcodeError]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Please fix the errors before submitting');
      const firstError = Object.keys(errors)[0];
      const element = document.querySelector(`[name="${firstError}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        (element as HTMLElement).focus();
      }
      return;
    }

    setSaving(true);
    try {
      const productData: any = {
        ...formData,
        variants: variants.map(v => ({
          name: v.name,
          sku: v.sku,
          price: v.price,
          costPrice: v.costPrice || 0,
          stock: v.stock || 0,
          attributes: v.attributes || {},
          isActive: true,
          images: v.images || [],
        })),
        businessUnitId: businessUnitId || 'default',
      };

      let product;
      if (isEdit) {
        product = await productService.updateProduct(productId!, productData);
        toast.success('Product updated successfully');
      } else {
        product = await productService.createProduct(productData);
        toast.success('Product created successfully');
      }

      const actualProductId = product.id;
      let finalBarcode = formData.barcode;
      
      if (!finalBarcode) {
        const generated = await barcodeService.generateUniqueBarcode({
          prefix: 'PRD',
          length: 12,
          productName: formData.name,
          sku: formData.sku,
        });
        finalBarcode = generated.barcode;
      }
      
      await barcodeService.associateBarcode(actualProductId, finalBarcode);
      
      await productService.updateProduct(actualProductId, {
        barcode: finalBarcode
      });

      router.push('/admin/catalog');
      router.refresh();
    } catch (error: any) {
      console.error('Failed to save product:', error);
      let errorMessage = 'Failed to save product';
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  }, [formData, variants, businessUnitId, isEdit, productId, router, validateForm]);

  // ============================================
  // ✅ FIXED: RENDER IMAGE GALLERY with error handling
  // ============================================

  const renderImageGallery = () => {
    if (formData.images.length === 0) {
      return (
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center">
          <ImageIcon className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No images uploaded yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Upload images to see them here
          </p>
          <label className="mt-4 inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors">
            <Upload className="w-4 h-4 inline mr-2" />
            Upload Images
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="hidden"
            />
          </label>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Main Preview */}
        {previewImage && (
          <div className="relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 aspect-video max-w-2xl mx-auto">
            <img 
              src={getValidImage(previewImage)} 
              alt="Product preview" 
              className="w-full h-full object-contain"
              onError={() => handleImageError(previewImage)}
            />
            <div className="absolute bottom-2 right-2">
              <span className="text-xs bg-black/50 text-white px-2 py-1 rounded">
                Main Image
              </span>
            </div>
          </div>
        )}

        {/* Image Thumbnails with error handling */}
        <div className="flex flex-wrap gap-4">
          {formData.images.map((image, index) => {
            const validImage = getValidImage(image);
            return (
              <div 
                key={index} 
                className={`relative w-24 h-24 rounded-lg overflow-hidden border-2 ${
                  previewImage === image 
                    ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-50' 
                    : 'border-gray-200 dark:border-gray-600'
                } group hover:border-blue-400 transition-all`}
              >
                <img 
                  src={validImage} 
                  alt={`Product ${index + 1}`} 
                  className="w-full h-full object-cover"
                  onError={() => handleImageError(image)}
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => setMainImage(index)}
                    className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    title="Set as main image"
                  >
                    <Eye className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="p-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                    title="Remove image"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                {previewImage === image && (
                  <div className="absolute top-1 left-1 bg-blue-500 text-white text-[8px] px-1 py-0.5 rounded">
                    MAIN
                  </div>
                )}
                <div className="absolute bottom-1 right-1 bg-black/50 text-white text-[8px] px-1 py-0.5 rounded">
                  #{index + 1}
                </div>
              </div>
            );
          })}
          
          {/* Upload Button */}
          {formData.images.length < MAX_IMAGES && (
            <label className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400">
              {uploadingImages ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <Upload className="w-6 h-6" />
                  <span className="text-[10px] mt-1">Upload</span>
                </>
              )}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
                disabled={uploadingImages}
              />
            </label>
          )}
        </div>

        {/* Image Info */}
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <p>{formData.images.length} of {MAX_IMAGES} images uploaded</p>
          {uploadingImages && (
            <p className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Processing images...
            </p>
          )}
        </div>
      </div>
    );
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!canManageProducts) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">You don't have permission to manage products.</p>
        <button
          onClick={() => router.push('/admin/catalog')}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Back to Catalog
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {isEdit ? 'Edit Product' : 'Create Product'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isEdit ? 'Update product information' : 'Add a new product to your catalog'}
              </p>
            </div>
          </div>
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 overflow-x-auto">
          <nav className="flex gap-2 sm:gap-4">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-3 border-b-2 font-medium text-sm transition-colors capitalize whitespace-nowrap ${
                  activeTab === id
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6">
          {/* Basic Information */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
                    errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  disabled={saving}
                  placeholder="Enter product name"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.name}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  disabled={saving}
                  placeholder="Enter product description"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    SKU <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="sku"
                      value={formData.sku}
                      onChange={(e) => {
                        setAutoGenerateSKU(false);
                        setFormData(prev => ({ ...prev, sku: e.target.value.toUpperCase() }));
                        if (errors.sku) {
                          setErrors(prev => ({ ...prev, sku: '' }));
                        }
                      }}
                      className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
                        errors.sku ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                      }`}
                      disabled={saving}
                      placeholder="Enter SKU"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newSKU = generateSKU(formData.name);
                        setFormData(prev => ({ ...prev, sku: newSKU }));
                        setAutoGenerateSKU(true);
                        toast.success('SKU generated');
                      }}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                      title="Generate SKU"
                    >
                      <Wand2 className="w-4 h-4" />
                    </button>
                  </div>
                  {!isEdit && (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        id="autoGenerateSKU"
                        checked={autoGenerateSKU}
                        onChange={(e) => setAutoGenerateSKU(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <label htmlFor="autoGenerateSKU" className="text-xs text-gray-500 dark:text-gray-400">
                        Auto-generate SKU from product name
                      </label>
                    </div>
                  )}
                  {errors.sku && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.sku}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Barcode
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    <div className="flex-1 min-w-[150px] relative">
                      <input
                        type="text"
                        value={formData.barcode}
                        onChange={(e) => handleBarcodeChange(e.target.value)}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono ${
                          errors.barcode ? 'border-red-500' : 
                          isBarcodeValid === true ? 'border-green-500' : 
                          'border-gray-300 dark:border-gray-600'
                        }`}
                        placeholder="Enter barcode or generate"
                        disabled={saving}
                      />
                      {checkingBarcode && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        </div>
                      )}
                      {isBarcodeValid === true && formData.barcode && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateBarcode}
                      disabled={generatingBarcode || saving}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1 text-sm"
                      title="Generate barcode"
                    >
                      {generatingBarcode ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      <span className="hidden sm:inline">Generate</span>
                    </button>
                    {formData.barcode && (
                      <>
                        <button
                          type="button"
                          onClick={handleCopyBarcode}
                          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          title="Copy barcode"
                        >
                          {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowBarcode(!showBarcode)}
                          className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-1 text-sm"
                          title="Show QR code"
                        >
                          <QrCode className="w-4 h-4" />
                          <span className="hidden sm:inline">QR</span>
                        </button>
                      </>
                    )}
                  </div>
                  {errors.barcode && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.barcode}
                    </p>
                  )}
                  {barcodeError && (
                    <p className="mt-1 text-sm text-yellow-600 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      {barcodeError}
                    </p>
                  )}
                  {isBarcodeValid === true && formData.barcode && (
                    <p className="mt-1 text-sm text-green-600 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      ✓ Barcode is available
                    </p>
                  )}
                  
                  {/* Barcode/QR Display */}
                  {formData.barcode && showBarcode && barcodeInfo && (
                    <div className="mt-3 border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/30">
                      <div className="flex flex-col items-center">
                        <div className="flex flex-wrap items-center justify-center gap-6">
                          <div className="text-center">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Barcode</p>
                            {barcodeInfo.barcodeUrl ? (
                              <img 
                                src={barcodeInfo.barcodeUrl} 
                                alt="Barcode" 
                                className="h-12 w-auto"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="h-12 flex items-center justify-center text-gray-400">No barcode</div>
                            )}
                            <p className="text-xs font-mono text-gray-600 dark:text-gray-400 mt-1 text-center">
                              {formData.barcode}
                            </p>
                          </div>
                          {barcodeInfo.qrCodeUrl && (
                            <div className="text-center">
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">QR Code</p>
                              <img 
                                src={barcodeInfo.qrCodeUrl} 
                                alt="QR Code" 
                                className="w-20 h-20 object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <button
                            type="button"
                            onClick={handleDownloadBarcode}
                            className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            Download
                          </button>
                          <button
                            type="button"
                            onClick={handlePrintBarcode}
                            className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
                          >
                            <Printer className="w-3 h-3" />
                            Print
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowBarcode(false)}
                            className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                          >
                            Hide
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Category
                  </label>
                  <select
                    name="categoryId"
                    value={formData.categoryId}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    disabled={saving}
                  >
                    <option value="">Select Category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Supplier
                  </label>
                  <select
                    name="supplierId"
                    value={formData.supplierId}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    disabled={saving}
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((sup) => (
                      <option key={sup.id} value={sup.id}>{sup.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tags
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Add a tag"
                    disabled={saving}
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    disabled={!newTag.trim() || saving}
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.tags.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No tags added yet</p>
                  ) : (
                    formData.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="hover:text-blue-900 dark:hover:text-blue-100"
                          disabled={saving}
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleCheckboxChange}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    disabled={saving}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {formData.isActive ? (
                      <span className="text-green-600">Active</span>
                    ) : (
                      <span className="text-gray-400">Inactive</span>
                    )}
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isDigital"
                    checked={formData.isDigital}
                    onChange={handleCheckboxChange}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    disabled={saving}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Digital Product</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="featured"
                    checked={formData.featured}
                    onChange={handleCheckboxChange}
                    className="w-4 h-4 text-yellow-500 rounded focus:ring-yellow-500"
                    disabled={saving}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">⭐ Featured</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  disabled={saving}
                  placeholder="Internal notes about this product"
                />
              </div>
            </div>
          )}

          {/* Pricing */}
          {activeTab === 'pricing' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Unit Price <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="number"
                      name="unitPrice"
                      value={formData.unitPrice}
                      onChange={handleChange}
                      step="0.01"
                      min="0"
                      className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
                        errors.unitPrice ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                      }`}
                      disabled={saving}
                      placeholder="0.00"
                    />
                  </div>
                  {errors.unitPrice && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.unitPrice}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Cost Price
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="number"
                      name="costPrice"
                      value={formData.costPrice}
                      onChange={handleChange}
                      step="0.01"
                      min="0"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      disabled={saving}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tax Rate (%)
                </label>
                <input
                  type="number"
                  name="taxRate"
                  value={formData.taxRate}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  max="100"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  disabled={saving}
                  placeholder="0.00"
                />
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Price Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Unit Price:</span>
                    <span className="font-medium text-gray-900 dark:text-white ml-2">
                      {formatCurrency(formData.unitPrice || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Cost Price:</span>
                    <span className="font-medium text-gray-900 dark:text-white ml-2">
                      {formatCurrency(formData.costPrice || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Profit Margin:</span>
                    <span className={`font-medium ml-2 ${
                      formData.costPrice && formData.unitPrice > 0 && formData.unitPrice > formData.costPrice
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {formData.costPrice && formData.unitPrice > 0
                        ? `${(((formData.unitPrice - formData.costPrice) / formData.unitPrice) * 100).toFixed(1)}%`
                        : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Tax Rate:</span>
                    <span className="font-medium text-gray-900 dark:text-white ml-2">
                      {formData.taxRate || 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Inventory */}
          {activeTab === 'inventory' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Min Stock Level
                  </label>
                  <input
                    type="number"
                    name="minStock"
                    value={formData.minStock}
                    onChange={handleChange}
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Max Stock Level
                  </label>
                  <input
                    type="number"
                    name="maxStock"
                    value={formData.maxStock}
                    onChange={handleChange}
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    disabled={saving}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  name="weight"
                  value={formData.weight}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  disabled={saving}
                  placeholder="0.00"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Length (cm)
                  </label>
                  <input
                    type="number"
                    value={formData.dimensions.length}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      dimensions: { ...prev.dimensions, length: parseFloat(e.target.value) || 0 }
                    }))}
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    disabled={saving}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Width (cm)
                  </label>
                  <input
                    type="number"
                    value={formData.dimensions.width}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      dimensions: { ...prev.dimensions, width: parseFloat(e.target.value) || 0 }
                    }))}
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    disabled={saving}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Height (cm)
                  </label>
                  <input
                    type="number"
                    value={formData.dimensions.height}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      dimensions: { ...prev.dimensions, height: parseFloat(e.target.value) || 0 }
                    }))}
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    disabled={saving}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-2">Inventory Settings</h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Low stock alert when below <strong>{formData.minStock || 5}</strong> units.
                  Maximum capacity is <strong>{formData.maxStock || 100}</strong> units.
                </p>
              </div>
            </div>
          )}

          {/* ✅ FIXED: Images Tab with proper gallery */}
          {activeTab === 'images' && (
            <div className="space-y-6">
              {renderImageGallery()}
            </div>
          )}

          {/* Variants with Image Support */}
          {activeTab === 'variants' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Product Variants</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {variants.length} of {MAX_VARIANTS} variants configured
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowVariantForm(true)}
                  disabled={variants.length >= MAX_VARIANTS || saving}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                    variants.length >= MAX_VARIANTS || saving
                      ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  Add Variant
                </button>
              </div>

              {variants.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
                  <Layers className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No variants added yet</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">Add variants for different sizes, colors, or options</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {variants.map((variant, index) => (
                    <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          {/* ✅ FIXED: Variant image with error handling */}
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                            {variant.images && variant.images.length > 0 ? (
                              <img 
                                src={getValidVariantImage(variant.images[0])} 
                                alt={variant.name} 
                                className="w-full h-full object-cover"
                                onError={() => handleVariantImageError(variant.images[0])}
                              />
                            ) : (
                              <Layers className="w-full h-full p-2 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{variant.name}</p>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
                              <span>SKU: {variant.sku}</span>
                              <span>Price: {formatCurrency(variant.price)}</span>
                              <span>Stock: {variant.stock}</span>
                              {variant.images && variant.images.length > 1 && (
                                <span className="text-xs text-purple-500">
                                  +{variant.images.length - 1} more image(s)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveVariant(index)}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Variant Form with Image Upload */}
              <AnimatePresence>
                {showVariantForm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/30 overflow-hidden"
                  >
                    <h4 className="font-medium text-gray-900 dark:text-white mb-4">New Variant</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={newVariant.name}
                          onChange={(e) => handleVariantNameChange(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="e.g., Large, Red"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          SKU <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newVariant.sku}
                            onChange={(e) => setNewVariant({ ...newVariant, sku: e.target.value.toUpperCase() })}
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            placeholder="Auto-generated"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newSKU = generateVariantSKU(newVariant.name || 'VAR');
                              setNewVariant(prev => ({ ...prev, sku: newSKU }));
                            }}
                            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            title="Generate SKU"
                          >
                            <Wand2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Price <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <input
                            type="number"
                            value={newVariant.price}
                            onChange={(e) => setNewVariant({ ...newVariant, price: parseFloat(e.target.value) || 0 })}
                            step="0.01"
                            min="0"
                            className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Stock
                        </label>
                        <input
                          type="number"
                          value={newVariant.stock}
                          onChange={(e) => setNewVariant({ ...newVariant, stock: parseInt(e.target.value) || 0 })}
                          min="0"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    {/* Variant Images */}
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Variant Images (Max {MAX_VARIANT_IMAGES})
                      </label>
                      <div className="flex flex-wrap gap-3">
                        {newVariant.images && newVariant.images.map((img, index) => (
                          <div key={index} className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-gray-200">
                            <img 
                              src={getValidVariantImage(img)} 
                              alt={`Variant ${index + 1}`} 
                              className="w-full h-full object-cover"
                              onError={() => handleVariantImageError(img)}
                            />
                            <button
                              type="button"
                              onClick={() => removeVariantImage(index)}
                              className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        {(newVariant.images?.length || 0) < MAX_VARIANT_IMAGES && (
                          <label className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-500 cursor-pointer flex flex-col items-center justify-center text-gray-400">
                            <Upload className="w-5 h-5" />
                            <span className="text-[10px] mt-1">Upload</span>
                            <input
                              type="file"
                              ref={variantFileInputRef}
                              accept="image/*"
                              multiple
                              onChange={handleVariantImageUpload}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <button
                        type="button"
                        onClick={() => setShowVariantForm(false)}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddVariant}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Add Variant
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Attributes */}
          {activeTab === 'attributes' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  disabled={saving}
                  placeholder="Internal notes about this product"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Attributes (JSON)
                </label>
                <textarea
                  value={JSON.stringify(formData.attributes, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setFormData(prev => ({ ...prev, attributes: parsed }));
                    } catch {
                      // Invalid JSON, ignore
                    }
                  }}
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
                  disabled={saving}
                  placeholder='{"color": "red", "size": "large"}'
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Enter valid JSON format
                </p>
              </div>
            </div>
          )}

          {/* SEO */}
          {activeTab === 'seo' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Meta Title
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="SEO title (max 60 characters)"
                  disabled={saving}
                />
                <p className="mt-1 text-xs text-gray-400">0/60 characters</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Meta Description
                </label>
                <textarea
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="SEO description (max 160 characters)"
                  disabled={saving}
                />
                <p className="mt-1 text-xs text-gray-400">0/160 characters</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  URL Slug
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="custom-url-slug"
                  disabled={saving}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Leave blank to auto-generate from product name
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Search Engine Preview</h4>
                <div className="space-y-1">
                  <p className="text-lg text-blue-600 hover:underline cursor-pointer">
                    {formData.name || 'Product Title'}
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-400">
                    https://example.com/products/...
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                    {formData.description || 'No description provided'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700 mt-6">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors w-full sm:w-auto text-center"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 w-full sm:w-auto justify-center"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isEdit ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {isEdit ? 'Update Product' : 'Create Product'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
