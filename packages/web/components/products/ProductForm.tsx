'use client';

// packages/web/components/products/ProductForm.tsx

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Save, X, Package, DollarSign, Barcode, Tag, Layers,
  Image as ImageIcon, Plus, Trash2, Loader2, Upload,
  ArrowLeft, AlertCircle, CheckCircle, Lock, Eye,
  Star,
  QrCode, RefreshCw, Copy, Printer, Download,
  AlertTriangle,
  Wand2,
} from 'lucide-react';

import {
  productService,
  type ProductVariant,
} from '../../services/productService';
import { barcodeService } from '../../services/barcodeService';
import { toast } from '../../utils/toast-manager';
import { formatCurrency } from '../../utils/formatters';
import { usePermission } from '../../hooks/usePermission';
import { useAuth } from '../../hooks/useAuth';
import { PermissionResource } from '../../types/enums';
import type { Supplier } from '../../types/supplier';

// ============================================
// TYPES
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

interface Dimensions {
  length: number;
  width: number;
  height: number;
}

interface ProductSEO {
  title: string;
  description: string;
  slug: string;
  keywords: string[];
}

interface ProductFormData {
  name: string;
  description: string;
  sku: string;
  barcode: string;
  unitPrice: number;
  costPrice: number;
  taxRate: number;
  minStock: number;
  maxStock: number;
  categoryId: string;
  supplierId: string;
  weight: number;
  dimensions: Dimensions;
  images: string[];
  attributes: Record<string, any>;
  isActive: boolean;
  isDigital: boolean;
  featured: boolean;
  tags: string[];
  notes: string;
  seo: ProductSEO;
}

interface BarcodeInfo {
  barcode: string;
  barcodeUrl: string;
  qrCodeUrl: string;
  isGenerated: boolean;
}

type PartialProductVariant = Omit<
  ProductVariant,
  'productId' | 'createdAt' | 'updatedAt'
>;

type TabId =
  | 'basic'
  | 'pricing'
  | 'inventory'
  | 'images'
  | 'variants'
  | 'attributes'
  | 'seo';

// ============================================
// CONSTANTS
// ============================================

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'basic', label: 'Basic Info', icon: Package },
  { id: 'pricing', label: 'Pricing', icon: DollarSign },
  { id: 'inventory', label: 'Inventory', icon: Layers },
  { id: 'images', label: 'Images', icon: ImageIcon },
  { id: 'variants', label: 'Variants', icon: Layers },
  { id: 'attributes', label: 'Attributes', icon: Tag },
  { id: 'seo', label: 'SEO', icon: Eye },
];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1920;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_IMAGES = 10;
const MAX_VARIANT_IMAGES = 5;
const MAX_VARIANTS = 10;
const PLACEHOLDER_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const BU_STORAGE_KEYS = [
  'selectedBusinessUnitId',
  'businessUnitId',
] as const;

const PLACEHOLDER_BU_VALUES = new Set([
  '',
  'default',
  'default-business-unit',
  'undefined',
  'null',
]);

const EMPTY_VARIANT: PartialProductVariant = {
  id: '',
  name: '',
  sku: '',
  price: 0,
  costPrice: 0,
  stock: 0,
  attributes: {},
  isActive: true,
  images: [],
};

const EMPTY_FORM: ProductFormData = {
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
  images: [],
  attributes: {},
  isActive: true,
  isDigital: false,
  featured: false,
  tags: [],
  notes: '',
  seo: {
    title: '',
    description: '',
    slug: '',
    keywords: [],
  },
};

// ============================================
// BUSINESS UNIT RESOLUTION
// ============================================
//
// Mirrors the resolver in `productService.ts`. The `businessUnitId`
// prop is only a *hint* — we always validate it against localStorage
// and the persisted user object before trusting it, so a stale prop
// from a parent component can't cause the form to save onto the wrong
// BU.

function isRealBusinessUnitId(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  return !PLACEHOLDER_BU_VALUES.has(trimmed.toLowerCase());
}

function resolveBusinessUnitId(hint?: string): string | null {
  if (typeof window === 'undefined') return null;

  // 1. Explicit hint from props, if real.
  if (isRealBusinessUnitId(hint)) return hint.trim();

  // 2. Canonical localStorage keys.
  for (const key of BU_STORAGE_KEYS) {
    try {
      const value = localStorage.getItem(key);
      if (isRealBusinessUnitId(value)) return value.trim();
    } catch {
      /* ignore */
    }
  }

  // 3. The persisted user object.
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      const fromUser =
        user?.businessUnitId ||
        user?.businessUnits?.[0]?.businessUnitId ||
        user?.businessUnits?.[0]?.id;
      if (isRealBusinessUnitId(fromUser)) return fromUser.trim();
    }
  } catch {
    /* ignore */
  }

  return null;
}

// ============================================
// HELPERS
// ============================================

function generateSKUString(productName?: string, variantName?: string): string {
  const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();

  if (variantName) {
    const basePrefix =
      (productName || 'PRD')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 3)
        .toUpperCase() || 'PRD';
    const variantPrefix =
      variantName
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 3)
        .toUpperCase() || 'VAR';
    return `${basePrefix}-${variantPrefix}-${timestamp}-${random}`;
  }

  const prefix =
    (productName || 'PRD')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 3)
      .toUpperCase() || 'PRD';
  return `${prefix}-${timestamp}-${random}`;
}

function coerceDimensions(input: unknown): Dimensions {
  const fallback: Dimensions = { length: 0, width: 0, height: 0 };
  if (!input) return fallback;

  if (typeof input === 'string') {
    try {
      return coerceDimensions(JSON.parse(input));
    } catch {
      return fallback;
    }
  }

  if (typeof input === 'object') {
    const d = input as Record<string, unknown>;
    return {
      length: typeof d.length === 'number' ? d.length : 0,
      width: typeof d.width === 'number' ? d.width : 0,
      height: typeof d.height === 'number' ? d.height : 0,
    };
  }

  return fallback;
}

function coerceSEO(input: unknown): ProductSEO {
  const fallback: ProductSEO = {
    title: '',
    description: '',
    slug: '',
    keywords: [],
  };
  if (!input || typeof input !== 'object') return fallback;

  const s = input as Record<string, unknown>;
  return {
    title: typeof s.title === 'string' ? s.title : '',
    description: typeof s.description === 'string' ? s.description : '',
    slug: typeof s.slug === 'string' ? s.slug : '',
    keywords: Array.isArray(s.keywords)
      ? s.keywords.filter((k): k is string => typeof k === 'string')
      : [],
  };
}

async function compressImage(
  dataUrl: string,
  maxWidth: number = MAX_IMAGE_DIMENSION,
  maxHeight: number = MAX_IMAGE_DIMENSION,
  quality: number = 0.8
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
        let quality = 0.8;
        let compressed = await compressImage(
          result,
          MAX_IMAGE_DIMENSION,
          MAX_IMAGE_DIMENSION,
          quality
        );

        let attempts = 0;
        while (
          compressed.length > MAX_IMAGE_SIZE &&
          quality > 0.2 &&
          attempts < 15
        ) {
          quality -= 0.04;
          compressed = await compressImage(result, 1600, 1600, quality);
          attempts++;
        }

        if (compressed.length > MAX_IMAGE_SIZE) {
          compressed = await compressImage(result, 800, 800, 0.3);
        }

        if (compressed.length > MAX_IMAGE_SIZE) {
          console.warn(
            `Image too large (${Math.round(
              compressed.length / 1024
            )}KB), using placeholder`
          );
          resolve(PLACEHOLDER_IMAGE);
        } else {
          resolve(compressed);
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================
// COMPONENT
// ============================================

export function ProductForm({
  mode,
  productId,
  businessUnitId: businessUnitIdProp,
}: ProductFormProps) {
  const router = useRouter();
  const { canManage } = usePermission();
  const { user } = useAuth();
  const isEdit = mode === 'edit';

  // ✅ Resolve the BU once at mount. Falls back to `user.businessUnitId`
  //    if the prop is missing or a placeholder. Null means we couldn't
  //    find one — the submit handler will refuse to save.
  const resolvedBusinessUnitId = useMemo(() => {
    const fromProp = resolveBusinessUnitId(businessUnitIdProp);
    if (fromProp) return fromProp;

    const fromUser =
      (user as any)?.businessUnitId ||
      (user as any)?.businessUnits?.[0]?.businessUnitId ||
      (user as any)?.businessUnits?.[0]?.id;
    if (isRealBusinessUnitId(fromUser)) return fromUser.trim();

    return null;
  }, [businessUnitIdProp, user]);

  const [formData, setFormData] = useState<ProductFormData>(EMPTY_FORM);
  const [variants, setVariants] = useState<PartialProductVariant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('basic');
  const [newVariant, setNewVariant] =
    useState<PartialProductVariant>(EMPTY_VARIANT);
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [newTag, setNewTag] = useState('');
  const [newSeoKeyword, setNewSeoKeyword] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const variantFileInputRef = useRef<HTMLInputElement>(null);
  const [isClient, setIsClient] = useState(false);

  const [autoGenerateSKU, setAutoGenerateSKU] = useState(true);

  const [generatingBarcode, setGeneratingBarcode] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isBarcodeValid, setIsBarcodeValid] = useState<boolean | null>(null);
  const [checkingBarcode, setCheckingBarcode] = useState(false);
  const [barcodeInfo, setBarcodeInfo] = useState<BarcodeInfo | null>(null);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);

  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [variantImageErrors, setVariantImageErrors] = useState<
    Record<string, boolean>
  >({});
  const [uploadingImages, setUploadingImages] = useState(false);

  const canManageProducts = canManage(PermissionResource.PRODUCT);
  const initialLoadDone = useRef(false);

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
    (imageUrl: string | undefined): string => {
      if (!imageUrl) return PLACEHOLDER_IMAGE;
      if (imageErrors[imageUrl]) return PLACEHOLDER_IMAGE;
      return imageUrl;
    },
    [imageErrors]
  );

  const getValidVariantImage = useCallback(
    (imageUrl: string | undefined): string => {
      if (!imageUrl) return PLACEHOLDER_IMAGE;
      if (variantImageErrors[imageUrl]) return PLACEHOLDER_IMAGE;
      return imageUrl;
    },
    [variantImageErrors]
  );

  // ============================================
  // DATA LOADING
  // ============================================
  //
  // Categories and suppliers both come from `productService` — the
  // legacy `categoryService` / `supplierService` files are not the
  // canonical entry points for the backend's `/products/categories`
  // and `/products/suppliers` routes.

  const loadCategories = useCallback(async () => {
    if (!resolvedBusinessUnitId) {
      setCategories([]);
      return;
    }
    try {
      const data = await productService.getCategories({
        businessUnitId: resolvedBusinessUnitId,
      });
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load categories:', err);
      setCategories([]);
    }
  }, [resolvedBusinessUnitId]);

  const loadSuppliers = useCallback(async () => {
    try {
      const data = await productService.getSuppliers({ isActive: true });
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
      setSuppliers([]);
    }
  }, []);

  const loadProduct = useCallback(async () => {
    if (!productId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setImageErrors({});
      setVariantImageErrors({});

      const product = await productService.getProductById(productId);

      setFormData({
        name: product.name || '',
        description: product.description || '',
        sku: product.sku || '',
        barcode: product.barcode || '',
        unitPrice: product.unitPrice ?? 0,
        costPrice: product.costPrice ?? 0,
        taxRate: product.taxRate ?? 0,
        minStock: product.minStock ?? 5,
        maxStock: product.maxStock ?? 100,
        categoryId: product.categoryId || '',
        supplierId: product.supplierId || '',
        weight: product.weight ?? 0,
        dimensions: coerceDimensions(product.dimensions),
        images: Array.isArray(product.images) ? product.images : [],
        attributes: product.attributes || {},
        isActive: product.isActive !== false,
        isDigital: product.isDigital || false,
        featured: product.featured || false,
        tags: Array.isArray(product.tags) ? product.tags : [],
        notes: product.notes || '',
        seo: coerceSEO(product.seo),
      });

      setVariants(
        (product.variants || []).map(
          (v: any): PartialProductVariant => ({
            id: v.id,
            name: v.name,
            sku: v.sku,
            price: v.price ?? 0,
            costPrice: v.costPrice ?? 0,
            stock: v.stock ?? 0,
            attributes: v.attributes || {},
            isActive: v.isActive !== false,
            images: Array.isArray(v.images) ? v.images : [],
          })
        )
      );

      if (product.images && product.images.length > 0) {
        setPreviewImage(product.images[0]);
      }

      setAutoGenerateSKU(false);

      if (product.barcode) {
        try {
          const barcodeImg = await barcodeService.generateBarcodeImage(
            product.barcode
          );
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
          setIsBarcodeValid(true);
        } catch (err) {
          console.warn('Could not fetch barcode info:', err);
        }
      }
    } catch (err) {
      console.error('Failed to load product:', err);
      toast.error('Failed to load product');
      router.push('/admin/catalog');
    } finally {
      setLoading(false);
    }
  }, [productId, router]);

  // ============================================
  // INITIAL LOAD
  // ============================================

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    loadCategories();
    loadSuppliers();

    if (isEdit && productId) {
      loadProduct();
    } else {
      setFormData((prev) => ({
        ...prev,
        sku: generateSKUString(prev.name),
      }));
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, isEdit, productId]);

  // ============================================
  // SKU GENERATION
  // ============================================

  const regenerateSKU = useCallback(
    (productName?: string) => generateSKUString(productName || formData.name),
    [formData.name]
  );

  const generateVariantSKU = useCallback(
    (variantName: string) =>
      generateSKUString(formData.name || 'PRD', variantName),
    [formData.name]
  );

  // ============================================
  // BARCODE UNIQUENESS
  // ============================================

  const checkBarcodeUniqueness = useCallback(
    async (barcode: string): Promise<boolean> => {
      if (!barcode || barcode.length < 3) return true;

      setCheckingBarcode(true);
      setBarcodeError(null);
      try {
        try {
          const product = await productService.getProductByBarcode(barcode);
          if (product && product.id !== productId) {
            setIsBarcodeValid(false);
            setBarcodeError(
              'This barcode is already assigned to another product'
            );
            setErrors((prev) => ({
              ...prev,
              barcode:
                'This barcode is already assigned to another product',
            }));
            return false;
          }
        } catch (err: any) {
          if (err?.response?.status === 404) {
            setIsBarcodeValid(true);
            setErrors((prev) => {
              const next = { ...prev };
              delete next.barcode;
              return next;
            });
            return true;
          }
          console.warn('Error checking barcode:', err);
        }

        setIsBarcodeValid(true);
        setErrors((prev) => {
          const next = { ...prev };
          delete next.barcode;
          return next;
        });
        return true;
      } catch (err) {
        console.error('Error checking barcode:', err);
        return true;
      } finally {
        setCheckingBarcode(false);
      }
    },
    [productId]
  );

  useEffect(() => {
    const handle = setTimeout(() => {
      if (formData.barcode && formData.barcode.length >= 4) {
        checkBarcodeUniqueness(formData.barcode);
      } else if (formData.barcode && formData.barcode.length < 4) {
        setIsBarcodeValid(null);
        setBarcodeError(null);
      }
    }, 500);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.barcode]);

  // ============================================
  // BARCODE ACTIONS
  // ============================================

  const handleGenerateBarcode = useCallback(async () => {
    if (!formData.name) {
      toast.error('Please enter a product name first');
      return;
    }

    setGeneratingBarcode(true);
    setBarcodeError(null);
    try {
      const barcodeResult = await barcodeService.generateUniqueBarcode({
        prefix: 'PRD',
        length: 12,
        productName: formData.name,
        sku: formData.sku || undefined,
      });

      setFormData((prev) => ({ ...prev, barcode: barcodeResult.barcode }));
      setIsBarcodeValid(true);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.barcode;
        return next;
      });

      const barcodeImage = await barcodeService.generateBarcodeImage(
        barcodeResult.barcode
      );
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
      setShowBarcode(true);
      toast.success('Unique barcode generated successfully');
    } catch (err: any) {
      console.error('Failed to generate barcode:', err);
      setBarcodeError(err?.message || 'Failed to generate barcode');
      toast.error(err?.message || 'Failed to generate barcode');
      setIsBarcodeValid(false);
    } finally {
      setGeneratingBarcode(false);
    }
  }, [formData.name, formData.sku, formData.unitPrice]);

  const handleBarcodeChange = useCallback((value: string) => {
    const newValue = value.toUpperCase().trim();
    setFormData((prev) => ({ ...prev, barcode: newValue }));
    setBarcodeError(null);

    if (newValue.length >= 4) {
      checkBarcodeUniqueness(newValue);
    } else {
      setIsBarcodeValid(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    const escapeHtml = (v: string) =>
      v
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    printWindow.document.write(`
      <html>
        <head>
          <title>Barcode - ${escapeHtml(formData.name)}</title>
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
            <h2 class="product-name">${escapeHtml(formData.name)}</h2>
            <p class="sku">SKU: ${escapeHtml(formData.sku || 'N/A')}</p>
            ${
              barcodeInfo.barcodeUrl
                ? `<img src="${barcodeInfo.barcodeUrl}" alt="Barcode" class="barcode-img" onerror="this.style.display='none'" />`
                : ''
            }
            ${
              barcodeInfo.qrCodeUrl
                ? `<img src="${barcodeInfo.qrCodeUrl}" alt="QR Code" class="qr-img" onerror="this.style.display='none'" />`
                : ''
            }
            <div class="price">${formatCurrency(formData.unitPrice || 0)}</div>
            <div class="info">
              <p><span class="label">Barcode:</span> <span class="value">${escapeHtml(barcodeInfo.barcode)}</span></p>
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
  // IMAGE UPLOAD
  // ============================================

  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
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
          toast.error(
            `${file.name} exceeds the ${MAX_FILE_SIZE / 1024 / 1024}MB limit`
          );
          continue;
        }
        if (formData.images.length + validFiles.length >= MAX_IMAGES) {
          toast.warning(
            `Maximum ${MAX_IMAGES} images allowed, skipping remaining`
          );
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
      for (const file of validFiles) {
        try {
          const compressed = await processImageFile(file);
          newImages.push(compressed);
        } catch (err) {
          console.error('Failed to process image:', err);
          toast.error(`Failed to process ${file.name}`);
        }
      }

      if (newImages.length > 0) {
        setFormData((prev) => ({
          ...prev,
          images: [...prev.images, ...newImages],
        }));
        if (!previewImage) {
          setPreviewImage(newImages[0]);
        }
        toast.success(`${newImages.length} image(s) uploaded successfully`);
      }

      setUploadingImages(false);
      e.target.value = '';
    },
    [formData.images.length, previewImage]
  );

  const removeImage = useCallback(
    (index: number) => {
      const imageToRemove = formData.images[index];
      setFormData((prev) => ({
        ...prev,
        images: prev.images.filter((_, i) => i !== index),
      }));
      if (previewImage === imageToRemove) {
        const remaining = formData.images.filter((_, i) => i !== index);
        setPreviewImage(remaining.length > 0 ? remaining[0] : null);
      }
    },
    [formData.images, previewImage]
  );

  const setMainImage = useCallback(
    (index: number) => {
      const image = formData.images[index];
      if (!image) return;
      setPreviewImage(image);
      const newImages = [...formData.images];
      const [removed] = newImages.splice(index, 1);
      newImages.unshift(removed);
      setFormData((prev) => ({ ...prev, images: newImages }));
    },
    [formData.images]
  );

  // ============================================
  // VARIANT IMAGES
  // ============================================

  const handleVariantImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
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
          toast.error(
            `${file.name} exceeds the ${MAX_FILE_SIZE / 1024 / 1024}MB limit`
          );
          continue;
        }
        if (
          (newVariant.images?.length || 0) + validFiles.length >=
          MAX_VARIANT_IMAGES
        ) {
          toast.warning(
            `Maximum ${MAX_VARIANT_IMAGES} images per variant, skipping remaining`
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
        setNewVariant((prev) => ({
          ...prev,
          images: [...(prev.images || []), ...newImages],
        }));
        toast.success(`${newImages.length} variant image(s) uploaded`);
      }

      e.target.value = '';
    },
    [newVariant.images]
  );

  const removeVariantImage = useCallback((index: number) => {
    setNewVariant((prev) => ({
      ...prev,
      images: (prev.images || []).filter((_, i) => i !== index),
    }));
  }, []);

  // ============================================
  // TAGS
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

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTag();
      }
    },
    [addTag]
  );

  // ============================================
  // SEO KEYWORDS
  // ============================================

  const addSeoKeyword = useCallback(() => {
    const trimmed = newSeoKeyword.trim();
    if (trimmed && !formData.seo.keywords.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        seo: {
          ...prev.seo,
          keywords: [...prev.seo.keywords, trimmed],
        },
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
  // VARIANTS
  // ============================================

  const handleAddVariant = useCallback(() => {
    if (variants.length >= MAX_VARIANTS) {
      toast.error(`Maximum ${MAX_VARIANTS} variants allowed`);
      return;
    }

    if (!newVariant.name?.trim()) {
      toast.error('Variant name is required');
      return;
    }
    if (!newVariant.sku?.trim()) {
      toast.error('Variant SKU is required');
      return;
    }
    if ((newVariant.price ?? 0) <= 0) {
      toast.error('Variant price must be greater than 0');
      return;
    }

    const existingSku = variants.find(
      (v) => (v.sku || '').toUpperCase() === newVariant.sku!.toUpperCase()
    );
    if (existingSku) {
      toast.error('Variant SKU already exists');
      return;
    }

    setVariants((prev) => [
      ...prev,
      {
        ...newVariant,
        sku: newVariant.sku!.toUpperCase(),
        id: `variant_${Date.now()}`,
        images: newVariant.images || [],
      },
    ]);
    setNewVariant(EMPTY_VARIANT);
    setShowVariantForm(false);
    toast.success('Variant added successfully');
  }, [newVariant, variants]);

  const handleRemoveVariant = useCallback((index: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleVariantNameChange = useCallback(
    (value: string) => {
      setNewVariant((prev) => ({
        ...prev,
        name: value,
        sku:
          value.trim().length >= 2 ? generateVariantSKU(value) : prev.sku,
      }));
    },
    [generateVariantSKU]
  );

  // ============================================
  // FORM HANDLERS
  // ============================================

  const handleChange = useCallback(
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => {
      const { name, value, type } = e.target;

      if (name === 'name' && autoGenerateSKU && !isEdit) {
        const newSKU = generateSKUString(value);
        setFormData((prev) => ({ ...prev, name: value, sku: newSKU }));
      } else {
        setFormData((prev) => ({
          ...prev,
          [name]: type === 'number' ? parseFloat(value) || 0 : value,
        }));
      }

      setErrors((prev) => {
        if (!prev[name]) return prev;
        const next = { ...prev };
        delete next[name];
        return next;
      });
    },
    [autoGenerateSKU, isEdit]
  );

  const handleCheckboxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, checked } = e.target;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    },
    []
  );

  const validateForm = useCallback((): Record<string, string> => {
    const newErrors: Record<string, string> = {};
    if (!formData.name) newErrors.name = 'Product name is required';
    if (!formData.sku) newErrors.sku = 'SKU is required';
    if (formData.unitPrice <= 0)
      newErrors.unitPrice = 'Unit price must be greater than 0';

    if (formData.barcode && isBarcodeValid === false) {
      newErrors.barcode =
        barcodeError || 'Barcode is already assigned to another product';
    }

    return newErrors;
  }, [formData, isBarcodeValid, barcodeError]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const nextErrors = validateForm();
      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        toast.error('Please fix the errors before submitting');
        const firstError = Object.keys(nextErrors)[0];
        const element = document.querySelector(`[name="${firstError}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          (element as HTMLElement).focus();
        }
        return;
      }

      // ✅ Guard: refuse to save without a real BU.
      if (!resolvedBusinessUnitId) {
        toast.error(
          'No valid business unit is selected. Please refresh the page and try again.'
        );
        return;
      }

      setSaving(true);
      try {
        const productData: Record<string, any> = {
          ...formData,
          variants: variants.map((v) => ({
            name: v.name,
            sku: v.sku,
            price: v.price ?? 0,
            costPrice: v.costPrice ?? 0,
            stock: v.stock ?? 0,
            attributes: v.attributes || {},
            isActive: v.isActive !== false,
            images: v.images || [],
          })),
          businessUnitId: resolvedBusinessUnitId,
        };

        // The backend already generates a barcode when none is
        // provided, and associates it on create. Only pass the
        // barcode through when the user typed one.
        if (!productData.barcode) {
          delete productData.barcode;
        }

        let product;
        if (isEdit) {
          product = await productService.updateProduct(
            productId!,
            productData
          );
          toast.success('Product updated successfully');
        } else {
          product = await productService.createProduct(productData);
          toast.success('Product created successfully');
        }

        // If the user typed a barcode and we're editing, make sure
        // it's associated. On create, the backend already handles it.
        if (isEdit && formData.barcode) {
          try {
            await barcodeService.associateBarcode(
              product.id,
              formData.barcode
            );
          } catch (err) {
            // Non-fatal — the product itself saved fine.
            console.warn('Barcode association failed:', err);
          }
        }

        router.push('/admin/catalog');
        router.refresh();
      } catch (err: any) {
        console.error('Failed to save product:', err);
        const message =
          err?.response?.data?.message ||
          err?.message ||
          'Failed to save product';
        toast.error(message);
      } finally {
        setSaving(false);
      }
    },
    [
      formData,
      variants,
      resolvedBusinessUnitId,
      isEdit,
      productId,
      router,
      validateForm,
    ]
  );

  // ============================================
  // DERIVED
  // ============================================

  const profitMargin = useMemo(() => {
    if (!formData.unitPrice || !formData.costPrice) return null;
    if (formData.unitPrice <= 0) return null;
    return (
      ((formData.unitPrice - formData.costPrice) / formData.unitPrice) * 100
    );
  }, [formData.unitPrice, formData.costPrice]);

  // ============================================
  // IMAGE GALLERY
  // ============================================

  const renderImageGallery = () => {
    if (formData.images.length === 0) {
      return (
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-12 text-center">
          <ImageIcon className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            No images uploaded yet
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Upload images to see them here
          </p>
          <label className="mt-4 inline-block btn-brand cursor-pointer">
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
        {previewImage && (
          <div className="relative rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 aspect-video max-w-2xl mx-auto">
            <img
              src={getValidImage(previewImage)}
              alt="Product preview"
              className="w-full h-full object-contain"
              onError={() => handleImageError(previewImage)}
            />
            <div className="absolute bottom-2 right-2">
              <span className="text-2xs bg-black/50 text-white px-2 py-1 rounded">
                Main Image
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-4">
          {formData.images.map((image, index) => (
            <div
              key={`${image.slice(0, 32)}-${index}`}
              className={`relative w-24 h-24 rounded-lg overflow-hidden border-2 group transition duration-250 ${
                previewImage === image
                  ? 'border-brand-500 ring-2 ring-brand-500/50'
                  : 'border-gray-200 dark:border-gray-600 hover:border-brand-400'
              }`}
            >
              <img
                src={getValidImage(image)}
                alt={`Product ${index + 1}`}
                className="w-full h-full object-cover"
                onError={() => handleImageError(image)}
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => setMainImage(index)}
                  className="p-1 btn-brand transition duration-250 focus-ring"
                  title="Set as main image"
                  aria-label={`Set image ${index + 1} as main`}
                >
                  <Eye className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="p-1 bg-gradient-to-r from-danger-600 to-brand-accent-500 hover:from-danger-700 hover:to-brand-accent-600 text-white rounded transition duration-250 focus-ring"
                  title="Remove image"
                  aria-label={`Remove image ${index + 1}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              {previewImage === image && (
                <div className="absolute top-1 left-1 bg-brand-500 text-white text-2xs px-1 py-0.5 rounded">
                  MAIN
                </div>
              )}
              <div className="absolute bottom-1 right-1 bg-black/50 text-white text-2xs px-1 py-0.5 rounded tabular-nums">
                #{index + 1}
              </div>
            </div>
          ))}

          {formData.images.length < MAX_IMAGES && (
            <label className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-brand-500 dark:hover:border-brand-400 transition duration-250 cursor-pointer flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:text-brand-500 dark:hover:text-brand-400 focus-ring">
              {uploadingImages ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <Upload className="w-6 h-6" />
                  <span className="text-2xs mt-1">Upload</span>
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

        <div className="text-xs text-gray-500 dark:text-gray-400">
          <p className="tabular-nums">
            {formData.images.length} of {MAX_IMAGES} images uploaded
          </p>
          {uploadingImages && (
            <p className="text-brand-600 dark:text-brand-400 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Processing images...
            </p>
          )}
        </div>
      </div>
    );
  };

  // ============================================
  // RENDER GATES
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="text-center animate-fade-in">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 dark:border-brand-400 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading product...
          </p>
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
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          You don't have permission to manage products.
        </p>
        <button
          onClick={() => router.push('/admin/catalog')}
          className="mt-4 btn-brand"
        >
          Back to Catalog
        </button>
      </div>
    );
  }

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <div className="max-w-container mx-auto p-4 sm:p-6 lg:px-8 xl:px-10 2xl:px-12 bg-gray-50 dark:bg-gray-900 min-h-screen animate-fade-in">
      <div className="card-brand shadow-soft p-0 overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition duration-250 focus-ring"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {isEdit ? 'Edit Product' : 'Create Product'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isEdit
                  ? 'Update product information'
                  : 'Add a new product to your catalog'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition duration-250 focus-ring"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 overflow-x-auto custom-scrollbar">
          <nav className="flex gap-2 sm:gap-4">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-3 border-b-2 font-medium text-sm transition duration-250 capitalize whitespace-nowrap focus-ring ${
                  activeTab === id
                    ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* BU warning */}
        {!resolvedBusinessUnitId && (
          <div className="m-4 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl flex items-center gap-3 animate-slide-down">
            <AlertCircle className="w-5 h-5 text-danger-500 flex-shrink-0" />
            <span className="text-danger-700 dark:text-danger-300 text-sm">
              No valid business unit is selected. Refresh the page before
              saving.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 sm:p-6">
          {/* BASIC */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Product Name <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 dark:bg-gray-700 dark:text-white ${
                    errors.name
                      ? 'border-danger-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  disabled={saving}
                  placeholder="Enter product name"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-danger-600 dark:text-danger-400 flex items-center gap-1">
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
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 dark:bg-gray-700 dark:text-white resize-none"
                  disabled={saving}
                  placeholder="Enter product description"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    SKU <span className="text-danger-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="sku"
                      value={formData.sku}
                      onChange={(e) => {
                        setAutoGenerateSKU(false);
                        setFormData((prev) => ({
                          ...prev,
                          sku: e.target.value.toUpperCase(),
                        }));
                        setErrors((prev) => {
                          if (!prev.sku) return prev;
                          const next = { ...prev };
                          delete next.sku;
                          return next;
                        });
                      }}
                      className={`flex-1 px-4 py-2 border rounded-lg font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 dark:bg-gray-700 dark:text-white ${
                        errors.sku
                          ? 'border-danger-500'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                      disabled={saving}
                      placeholder="Enter SKU"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newSKU = regenerateSKU(formData.name);
                        setFormData((prev) => ({ ...prev, sku: newSKU }));
                        setAutoGenerateSKU(true);
                        toast.success('SKU generated');
                      }}
                      className="btn-brand focus-ring"
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
                        onChange={(e) =>
                          setAutoGenerateSKU(e.target.checked)
                        }
                        className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 transition duration-250"
                      />
                      <label
                        htmlFor="autoGenerateSKU"
                        className="text-xs text-gray-500 dark:text-gray-400"
                      >
                        Auto-generate SKU from product name
                      </label>
                    </div>
                  )}
                  {errors.sku && (
                    <p className="mt-1 text-sm text-danger-600 dark:text-danger-400 flex items-center gap-1">
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
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 dark:bg-gray-700 dark:text-white font-mono tabular-nums ${
                          errors.barcode
                            ? 'border-danger-500'
                            : isBarcodeValid === true
                            ? 'border-success-500'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                        placeholder="Enter barcode or generate"
                        disabled={saving}
                      />
                      {checkingBarcode && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400 dark:text-gray-500" />
                        </div>
                      )}
                      {isBarcodeValid === true && formData.barcode && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <CheckCircle className="w-4 h-4 text-success-500" />
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateBarcode}
                      disabled={generatingBarcode || saving}
                      className="btn-brand disabled:opacity-50"
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
                          className="btn-secondary"
                          title="Copy barcode"
                        >
                          {copied ? (
                            <CheckCircle className="w-4 h-4 text-success-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowBarcode(!showBarcode)}
                          className="btn-secondary"
                          title="Show QR code"
                        >
                          <QrCode className="w-4 h-4" />
                          <span className="hidden sm:inline">QR</span>
                        </button>
                      </>
                    )}
                  </div>
                  {errors.barcode && (
                    <p className="mt-1 text-sm text-danger-600 dark:text-danger-400 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.barcode}
                    </p>
                  )}
                  {barcodeError && (
                    <p className="mt-1 text-sm text-warning-600 dark:text-warning-400 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      {barcodeError}
                    </p>
                  )}
                  {isBarcodeValid === true && formData.barcode && (
                    <p className="mt-1 text-sm text-success-600 dark:text-success-400 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      Barcode is available
                    </p>
                  )}

                  {formData.barcode && showBarcode && barcodeInfo && (
                    <div className="mt-3 border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gray-50 dark:bg-gray-700/30 animate-slide-down">
                      <div className="flex flex-col items-center">
                        <div className="flex flex-wrap items-center justify-center gap-6">
                          <div className="text-center">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                              Barcode
                            </p>
                            {barcodeInfo.barcodeUrl ? (
                              <img
                                src={barcodeInfo.barcodeUrl}
                                alt="Barcode"
                                className="h-12 w-auto"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display =
                                    'none';
                                }}
                              />
                            ) : (
                              <div className="h-12 flex items-center justify-center text-gray-400">
                                No barcode
                              </div>
                            )}
                            <p className="text-xs font-mono tabular-nums text-gray-600 dark:text-gray-400 mt-1 text-center">
                              {formData.barcode}
                            </p>
                          </div>
                          {barcodeInfo.qrCodeUrl && (
                            <div className="text-center">
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                QR Code
                              </p>
                              <img
                                src={barcodeInfo.qrCodeUrl}
                                alt="QR Code"
                                className="w-20 h-20 object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display =
                                    'none';
                                }}
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <button
                            type="button"
                            onClick={handleDownloadBarcode}
                            className="btn-secondary text-xs"
                          >
                            <Download className="w-3 h-3" />
                            Download
                          </button>
                          <button
                            type="button"
                            onClick={handlePrintBarcode}
                            className="btn-secondary text-xs"
                          >
                            <Printer className="w-3 h-3" />
                            Print
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowBarcode(false)}
                            className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition duration-250 focus-ring rounded"
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
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 dark:bg-gray-700 dark:text-white"
                    disabled={saving}
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Supplier
                  </label>
                  <select
                    name="supplierId"
                    value={formData.supplierId}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 dark:bg-gray-700 dark:text-white"
                    disabled={saving}
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((sup) => (
                      <option key={sup.id} value={sup.id}>
                        {sup.name}
                      </option>
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
                    onKeyDown={handleTagKeyDown}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 dark:bg-gray-700 dark:text-white"
                    placeholder="Add a tag"
                    disabled={saving}
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="btn-brand disabled:opacity-50"
                    disabled={!newTag.trim() || saving}
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.tags.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No tags added yet
                    </p>
                  ) : (
                    formData.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-full text-sm"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="hover:text-brand-900 dark:hover:text-brand-100 transition duration-250 focus-ring rounded"
                          disabled={saving}
                          aria-label={`Remove tag ${tag}`}
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
                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 transition duration-250"
                    disabled={saving}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {formData.isActive ? 'Active' : 'Inactive'}
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isDigital"
                    checked={formData.isDigital}
                    onChange={handleCheckboxChange}
                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 transition duration-250"
                    disabled={saving}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Digital Product
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="featured"
                    checked={formData.featured}
                    onChange={handleCheckboxChange}
                    className="w-4 h-4 text-warning-500 rounded focus:ring-warning-500 transition duration-250"
                    disabled={saving}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
                    <Star className="w-3.5 h-3.5" />
                    Featured
                  </span>
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
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 dark:bg-gray-700 dark:text-white resize-none"
                  disabled={saving}
                  placeholder="Internal notes about this product"
                />
              </div>
            </div>
          )}

          {/* PRICING */}
          {activeTab === 'pricing' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Unit Price <span className="text-danger-500">*</span>
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
                    <input
                      type="number"
                      name="unitPrice"
                      value={formData.unitPrice}
                      onChange={handleChange}
                      step="0.01"
                      min="0"
                      className={`w-full pl-10 pr-4 py-2 border rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 dark:bg-gray-700 dark:text-white ${
                        errors.unitPrice
                          ? 'border-danger-500'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                      disabled={saving}
                      placeholder="0.00"
                    />
                  </div>
                  {errors.unitPrice && (
                    <p className="mt-1 text-sm text-danger-600 dark:text-danger-400 flex items-center gap-1">
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
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
                    <input
                      type="number"
                      name="costPrice"
                      value={formData.costPrice}
                      onChange={handleChange}
                      step="0.01"
                      min="0"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 dark:bg-gray-700 dark:text-white"
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
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 dark:bg-gray-700 dark:text-white"
                  disabled={saving}
                  placeholder="0.00"
                />
              </div>

              <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4 border border-primary-200 dark:border-primary-800">
                <h4 className="text-sm font-medium text-primary-800 dark:text-primary-300 mb-2 eyebrow">
                  Price Summary
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">
                      Unit Price:
                    </span>
                    <span className="font-medium tabular-nums text-gray-900 dark:text-white ml-2">
                      {formatCurrency(formData.unitPrice || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">
                      Cost Price:
                    </span>
                    <span className="font-medium tabular-nums text-gray-900 dark:text-white ml-2">
                      {formatCurrency(formData.costPrice || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">
                      Profit Margin:
                    </span>
                    <span
                      className={`font-medium tabular-nums ml-2 ${
                        profitMargin !== null && profitMargin >= 0
                          ? 'text-success-600 dark:text-success-400'
                          : 'text-danger-600 dark:text-danger-400'
                      }`}
                    >
                      {profitMargin !== null
                        ? `${profitMargin.toFixed(1)}%`
                        : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">
                      Tax Rate:
                    </span>
                    <span className="font-medium tabular-nums text-gray-900 dark:text-white ml-2">
                      {formData.taxRate || 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* INVENTORY */}
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
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 dark:bg-gray-700 dark:text-white"
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
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 dark:bg-gray-700 dark:text-white"
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
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 dark:bg-gray-700 dark:text-white"
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
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        dimensions: {
                          ...prev.dimensions,
                          length: parseFloat(e.target.value) || 0,
                        },
                      }))
                    }
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 dark:bg-gray-700 dark:text-white"
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
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        dimensions: {
                          ...prev.dimensions,
                          width: parseFloat(e.target.value) || 0,
                        },
                      }))
                    }
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 dark:bg-gray-700 dark:text-white"
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
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        dimensions: {
                          ...prev.dimensions,
                          height: parseFloat(e.target.value) || 0,
                        },
                      }))
                    }
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 dark:bg-gray-700 dark:text-white"
                    disabled={saving}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="bg-warning-50 dark:bg-warning-900/20 rounded-xl p-4 border border-warning-200 dark:border-warning-800">
                <h4 className="text-sm font-medium text-warning-800 dark:text-warning-300 mb-2 eyebrow">
                  Inventory Settings
                </h4>
                <p className="text-sm text-warning-700 dark:text-warning-300">
                  Low stock alert when below{' '}
                  <strong className="tabular-nums">{formData.minStock || 5}</strong> units. Maximum
                  capacity is <strong className="tabular-nums">{formData.maxStock || 100}</strong> units.
                </p>
              </div>
            </div>
          )}

          {/* IMAGES */}
          {activeTab === 'images' && (
            <div className="space-y-6">{renderImageGallery()}</div>
          )}

          {/* VARIANTS */}
          {activeTab === 'variants' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Product Variants
                  </h3>
                  <p className="text-sm tabular-nums text-gray-500 dark:text-gray-400">
                    {variants.length} of {MAX_VARIANTS} variants configured
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowVariantForm(true)}
                  disabled={variants.length >= MAX_VARIANTS || saving}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl transition duration-250 focus-ring ${
                    variants.length >= MAX_VARIANTS || saving
                      ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                      : 'btn-brand'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  Add Variant
                </button>
              </div>

              {variants.length === 0 ? (
                <div className="text-center py-8 card-brand shadow-soft">
                  <Layers className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">
                    No variants added yet
                  </p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    Add variants for different sizes, colors, or options
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {variants.map((variant, index) => (
                    <div
                      key={variant.id || index}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition duration-250"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                            {variant.images && variant.images.length > 0 ? (
                              <img
                                src={getValidVariantImage(variant.images[0])}
                                alt={variant.name || 'Variant'}
                                className="w-full h-full object-cover"
                                onError={() =>
                                  handleVariantImageError(variant.images![0])
                                }
                              />
                            ) : (
                              <Layers className="w-full h-full p-2 text-gray-400 dark:text-gray-500" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {variant.name}
                            </p>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
                              <span className="tabular-nums">SKU: {variant.sku}</span>
                              <span className="tabular-nums">
                                Price: {formatCurrency(variant.price ?? 0)}
                              </span>
                              <span className="tabular-nums">Stock: {variant.stock ?? 0}</span>
                              {variant.images && variant.images.length > 1 && (
                                <span className="text-xs text-secondary-500 dark:text-secondary-400 tabular-nums">
                                  +{variant.images.length - 1} more image(s)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveVariant(index)}
                          className="p-2 hover:bg-danger-100 dark:hover:bg-danger-900/30 rounded-lg transition duration-250 focus-ring"
                          aria-label={`Remove variant ${
                            variant.name || 'unnamed'
                          }`}
                        >
                          <Trash2 className="w-4 h-4 text-danger-600 dark:text-danger-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <AnimatePresence>
                {showVariantForm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gray-50 dark:bg-gray-700/30 overflow-hidden"
                  >
                    <h4 className="font-medium text-gray-900 dark:text-white mb-4">
                      New Variant
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Name <span className="text-danger-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={newVariant.name || ''}
                          onChange={(e) =>
                            handleVariantNameChange(e.target.value)
                          }
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 dark:bg-gray-700 dark:text-white"
                          placeholder="e.g., Large, Red"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          SKU <span className="text-danger-500">*</span>
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newVariant.sku || ''}
                            onChange={(e) =>
                              setNewVariant((prev) => ({
                                ...prev,
                                sku: e.target.value.toUpperCase(),
                              }))
                            }
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 dark:bg-gray-700 dark:text-white"
                            placeholder="Auto-generated"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newSKU = generateVariantSKU(
                                newVariant.name || 'VAR'
                              );
                              setNewVariant((prev) => ({
                                ...prev,
                                sku: newSKU,
                              }));
                            }}
                            className="btn-brand"
                            title="Generate SKU"
                          >
                            <Wand2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Price <span className="text-danger-500">*</span>
                        </label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
                          <input
                            type="number"
                            value={newVariant.price ?? 0}
                            onChange={(e) =>
                              setNewVariant((prev) => ({
                                ...prev,
                                price: parseFloat(e.target.value) || 0,
                              }))
                            }
                            step="0.01"
                            min="0"
                            className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 dark:bg-gray-700 dark:text-white"
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
                          value={newVariant.stock ?? 0}
                          onChange={(e) =>
                            setNewVariant((prev) => ({
                              ...prev,
                              stock: parseInt(e.target.value) || 0,
                            }))
                          }
                          min="0"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 dark:bg-gray-700 dark:text-white"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Variant Images (Max {MAX_VARIANT_IMAGES})
                      </label>
                      <div className="flex flex-wrap gap-3">
                        {newVariant.images &&
                          newVariant.images.map((img, index) => (
                            <div
                              key={`${img.slice(0, 24)}-${index}`}
                              className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-600"
                            >
                              <img
                                src={getValidVariantImage(img)}
                                alt={`Variant ${index + 1}`}
                                className="w-full h-full object-cover"
                                onError={() => handleVariantImageError(img)}
                              />
                              <button
                                type="button"
                                onClick={() => removeVariantImage(index)}
                                className="absolute top-1 right-1 bg-gradient-to-r from-danger-600 to-brand-accent-500 text-white rounded-full p-0.5 focus-ring"
                                aria-label={`Remove variant image ${
                                  index + 1
                                }`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        {(newVariant.images?.length || 0) <
                          MAX_VARIANT_IMAGES && (
                          <label className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-brand-500 cursor-pointer flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:text-brand-500 transition duration-250 focus-ring">
                            <Upload className="w-5 h-5" />
                            <span className="text-2xs mt-1">Upload</span>
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
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddVariant}
                        className="btn-brand"
                      >
                        Add Variant
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ATTRIBUTES */}
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
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 dark:bg-gray-700 dark:text-white resize-none"
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
                      setFormData((prev) => ({
                        ...prev,
                        attributes: parsed,
                      }));
                    } catch {
                      // Invalid JSON — leave the previous value intact.
                    }
                  }}
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 dark:bg-gray-700 dark:text-white font-mono text-sm resize-none"
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
                  value={formData.seo.title}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      seo: { ...prev.seo, title: e.target.value },
                    }))
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 dark:bg-gray-700 dark:text-white"
                  placeholder="SEO title (max 60 characters)"
                  disabled={saving}
                />
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                  {formData.seo.title.length}/60 characters
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Meta Description
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
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 dark:bg-gray-700 dark:text-white resize-none"
                  placeholder="SEO description (max 160 characters)"
                  disabled={saving}
                />
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                  {formData.seo.description.length}/160 characters
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 dark:bg-gray-700 dark:text-white"
                  placeholder="custom-url-slug"
                  disabled={saving}
                />
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  Leave blank to auto-generate from product name
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  SEO Keywords
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newSeoKeyword}
                    onChange={(e) => setNewSeoKeyword(e.target.value)}
                    onKeyDown={handleSeoKeyDown}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 dark:bg-gray-700 dark:text-white"
                    placeholder="Add a keyword"
                    disabled={saving}
                  />
                  <button
                    type="button"
                    onClick={addSeoKeyword}
                    className="btn-brand disabled:opacity-50"
                    disabled={!newSeoKeyword.trim() || saving}
                  >
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
                        className="inline-flex items-center gap-1 px-3 py-1 bg-success-50 dark:bg-success-900/30 text-success-700 dark:text-success-300 rounded-full text-sm"
                      >
                        {keyword}
                        <button
                          type="button"
                          onClick={() => removeSeoKeyword(keyword)}
                          className="hover:text-danger-600 dark:hover:text-danger-400 transition duration-250 focus-ring rounded"
                          disabled={saving}
                          aria-label={`Remove keyword ${keyword}`}
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4 border border-primary-200 dark:border-primary-800">
                <h4 className="text-sm font-medium text-primary-800 dark:text-primary-300 mb-2 eyebrow">
                  Search Engine Preview
                </h4>
                <div className="space-y-1">
                  <p className="text-lg text-brand-600 hover:underline cursor-pointer">
                    {formData.seo.title ||
                      formData.name ||
                      'Product Title'}
                  </p>
                  <p className="text-sm text-success-700 dark:text-success-400 tabular-nums">
                    {formData.seo.slug
                      ? `https://example.com/products/${formData.seo.slug}`
                      : 'https://example.com/products/...'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                    {formData.seo.description ||
                      formData.description ||
                      'No description provided'}
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
              className="btn-secondary w-full sm:w-auto justify-center"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !resolvedBusinessUnitId}
              className="btn-brand w-full sm:w-auto justify-center disabled:opacity-50"
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

export default ProductForm;
