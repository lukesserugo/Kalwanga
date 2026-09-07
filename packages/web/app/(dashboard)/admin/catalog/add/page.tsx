// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\catalog\add\page.tsx

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Lock, Upload, X, Image as ImageIcon, Eye, 
  Plus, Trash2, Layers, DollarSign, Tag, Save, 
  Loader2, AlertCircle, CheckCircle, ChevronDown,
  Star, Heart, Truck, Shield, Clock, ArrowLeft,
  Barcode, QrCode, Scan, RefreshCw, Copy, Check,
  Info, AlertTriangle, Search, Link2, Unlink,
  Package, Database, GitBranch, Printer, Download,
  Edit, Trash, EyeOff, Settings, Wand2
} from 'lucide-react';
import { productService } from '../../../../../services/productService';
import { inventoryService } from '../../../../../services/inventoryService';
import { categoryService } from '../../../../../services/categoryService';
import { supplierService } from '../../../../../services/supplierService';
import { barcodeService } from '../../../../../services/barcodeService';
import { toast } from '../../../../../utils/toast-manager';
import { usePermission } from '../../../../../hooks/usePermission';
import { useAuth } from '../../../../../hooks/useAuth';
import { PermissionResource } from '../../../../../types/enums';

// ============================================
// INTERFACES
// ============================================

interface Category {
  id: string;
  name: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  quantity: number;
  reserved: number;
  available: number;
  location: string;
  unitPrice: number;
  costPrice: number;
  category: string;
  categoryId: string | null;
  supplier: string | null;
  supplierId: string | null;
  reorderPoint: number;
  hasProduct: boolean;
  productId: string | null;
  businessUnitId?: string;
}

interface Variant {
  id?: string;
  name: string;
  sku: string;
  price: number;
  costPrice?: number;
  stock: number;
  attributes: Record<string, any>;
  isActive?: boolean;
  barcode?: string;
  inventoryId?: string | null;
  images?: string[];
}

interface FormErrors {
  name?: string;
  sku?: string;
  unitPrice?: string;
  minStock?: string;
  maxStock?: string;
  barcode?: string;
  inventoryId?: string;
  categoryId?: string;
  [key: string]: string | undefined;
}

interface BarcodeDisplayData {
  barcode: string;
  barcodeUrl: string;
  qrCodeUrl: string;
  generatedAt: string;
  format: string;
}

// ============================================
// CONSTANTS
// ============================================

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 3840;
const MAX_IMAGE_DIMENSION_HEIGHT = 2160;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_IMAGES = 10;
const MAX_VARIANTS = 10;
const MAX_VARIANT_IMAGES = 5;

// ============================================
// MAIN COMPONENT
// ============================================

export default function AddProductPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { canCreate, canManage, isLoading: permissionLoading } = usePermission();
  
  // State
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const variantFileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [newVariant, setNewVariant] = useState<Variant>({
    name: '',
    sku: '',
    price: 0,
    costPrice: 0,
    stock: 0,
    attributes: {},
    images: [],
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  
  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  
  // Barcode/QR Code State
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [generatingBarcode, setGeneratingBarcode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [barcodeData, setBarcodeData] = useState<BarcodeDisplayData | null>(null);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [barcodeFormat, setBarcodeFormat] = useState<'EAN-13' | 'UPC-A' | 'CODE128' | 'QR'>('EAN-13');
  const [barcodePrefix, setBarcodePrefix] = useState('PRD');
  const [barcodeLength, setBarcodeLength] = useState(12);
  const [includeQR, setIncludeQR] = useState(true);
  
  // Selected inventory for linking
  const [selectedInventory, setSelectedInventory] = useState<InventoryItem | null>(null);
  const [searchInventoryQuery, setSearchInventoryQuery] = useState('');
  const [showInventoryPicker, setShowInventoryPicker] = useState(true);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [businessUnitId, setBusinessUnitId] = useState<string>('');
  const [inventoryLoadError, setInventoryLoadError] = useState<string | null>(null);
  
  // Auto SKU State
  const [autoGenerateSKU, setAutoGenerateSKU] = useState(true);
  
  // ✅ FIXED: Image state with proper tracking
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  
  // Form data
  const [formData, setFormData] = useState({
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
    tags: [] as string[],
    images: [] as string[],
    notes: '',
    seo: {
      title: '',
      description: '',
      slug: '',
      keywords: [] as string[],
    },
    inventoryId: '',
  });
  const [newTag, setNewTag] = useState('');
  const [newSeoKeyword, setNewSeoKeyword] = useState('');

  const canCreateProducts = canCreate(PermissionResource.PRODUCT) || canManage(PermissionResource.PRODUCT);

  // ============================================
  // IMAGE COMPRESSION FUNCTIONS
  // ============================================

  const compressImage = useCallback((
    dataUrl: string,
    maxWidth: number = MAX_IMAGE_DIMENSION,
    maxHeight: number = MAX_IMAGE_DIMENSION_HEIGHT,
    quality: number = 0.85
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
            
            let result = canvas.toDataURL('image/jpeg', quality);
            
            let currentQuality = quality;
            while (result.length > MAX_IMAGE_SIZE && currentQuality > 0.3) {
              currentQuality -= 0.05;
              result = canvas.toDataURL('image/jpeg', currentQuality);
            }
            
            resolve(result);
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
          let compressed = await compressImage(result, MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION_HEIGHT, 0.85);
          
          let quality = 0.85;
          while (compressed.length > MAX_IMAGE_SIZE && quality > 0.3) {
            quality -= 0.05;
            compressed = await compressImage(result, MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION_HEIGHT, quality);
          }
          
          resolve(compressed);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, [compressImage]);

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

  const handleNameChange = useCallback((value: string) => {
    setFormData(prev => ({
      ...prev,
      name: value,
      sku: autoGenerateSKU && value.trim().length >= 2 
        ? generateSKU(value) 
        : prev.sku
    }));
    
    if (touched.name) {
      const error = validateField('name', value);
      setErrors(prev => ({ ...prev, name: error }));
    }
  }, [autoGenerateSKU, generateSKU, touched.name]);

  const generateVariantSKU = useCallback((variantName: string) => {
    return generateSKU(formData.name || 'PRD', variantName);
  }, [formData.name, generateSKU]);

  const handleVariantNameChange = useCallback((value: string) => {
    setNewVariant(prev => ({
      ...prev,
      name: value,
      sku: value.trim().length >= 2 ? generateVariantSKU(value) : prev.sku
    }));
  }, [generateVariantSKU]);

  // ============================================
  // LOAD PRODUCT FOR EDIT
  // ============================================

  const loadProductForEdit = useCallback(async (id: string) => {
    try {
      setLoadingData(true);
      const product = await productService.getProductById(id);
      
      if (!product || !product.id) {
        toast.error('Product not found');
        router.push('/admin/catalog');
        return;
      }
      
      // Find the linked inventory
      let linkedInventory = null;
      if (product.inventoryId) {
        try {
          const inv = await inventoryService.getInventoryItem(product.inventoryId);
          if (inv) {
            linkedInventory = {
              id: inv.id,
              name: inv.name || inv.product?.name || 'Unknown',
              sku: inv.sku || inv.product?.sku || 'N/A',
              barcode: inv.barcode || inv.product?.barcode || null,
              quantity: inv.quantity || 0,
              reserved: inv.reserved || 0,
              available: (inv.quantity || 0) - (inv.reserved || 0),
              location: inv.location || 'Warehouse',
              unitPrice: inv.unitPrice || inv.product?.unitPrice || 0,
              costPrice: inv.costPrice || inv.product?.costPrice || 0,
              category: inv.category || inv.product?.category?.name || 'Uncategorized',
              categoryId: inv.categoryId || inv.product?.categoryId || null,
              supplier: inv.supplier || inv.product?.supplier?.name || null,
              supplierId: inv.supplierId || inv.product?.supplierId || null,
              reorderPoint: inv.reorderPoint || 5,
              hasProduct: true,
              productId: product.id,
              businessUnitId: inv.businessUnitId || '',
            };
            setSelectedInventory(linkedInventory);
          }
        } catch (e) {
          console.warn('Could not load linked inventory:', e);
        }
      }
      
      // ✅ FIXED: Set images properly from product data
      setFormData({
        name: product.name || '',
        sku: product.sku || '',
        description: product.description || '',
        unitPrice: product.unitPrice?.toString() || '',
        costPrice: product.costPrice?.toString() || '',
        barcode: product.barcode || '',
        categoryId: product.categoryId || '',
        supplierId: product.supplierId || '',
        isActive: product.isActive !== false,
        featured: product.featured || false,
        isDigital: product.isDigital || false,
        taxRate: product.taxRate?.toString() || '',
        weight: product.weight?.toString() || '',
        minStock: product.minStock?.toString() || '5',
        maxStock: product.maxStock?.toString() || '',
        tags: product.tags || [],
        images: product.images || [],
        notes: product.notes || '',
        seo: {
          title: product.seo?.title || '',
          description: product.seo?.description || '',
          slug: product.seo?.slug || '',
          keywords: product.seo?.keywords || [],
        },
        inventoryId: product.inventoryId || '',
      });
      
      // ✅ FIXED: Set preview image
      if (product.images && product.images.length > 0) {
        setPreviewImage(product.images[0]);
      }
      
      if (product.variants) {
        setVariants(product.variants.map((v: any) => ({
          id: v.id,
          name: v.name,
          sku: v.sku,
          price: v.price,
          costPrice: v.costPrice || 0,
          stock: v.stock || 0,
          attributes: v.attributes || {},
          isActive: v.isActive !== false,
          barcode: v.barcode || undefined,
          images: v.images || [],
        })));
      }
    } catch (error: any) {
      console.error('Failed to load product:', error);
      if (error?.response?.status === 404) {
        toast.error('Product not found');
        router.push('/admin/catalog');
      } else {
        toast.error('Failed to load product');
      }
    } finally {
      setLoadingData(false);
    }
  }, [router]);

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && canCreateProducts) {
      const path = window.location.pathname;
      if (path.includes('/edit/')) {
        const id = path.split('/edit/')[1];
        if (id && id !== 'add') {
          setProductId(id);
          setIsEditMode(true);
          loadProductForEdit(id);
          return;
        }
      }
      fetchData();
    } else if (isClient && !canCreateProducts) {
      setLoadingData(false);
    }
  }, [isClient, canCreateProducts]);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchData = useCallback(async () => {
    try {
      setLoadingData(true);
      
      const buId = localStorage.getItem('businessUnitId') || 'default';
      setBusinessUnitId(buId);
      
      await Promise.all([
        fetchCategories(),
        fetchSuppliers(),
        fetchInventoryItems(),
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load form data');
    } finally {
      if (!isEditMode) {
        setLoadingData(false);
      }
    }
  }, [isEditMode]);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await categoryService.getAllCategories({ limit: 100, isActive: true });
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
    }
  }, []);

  const fetchSuppliers = useCallback(async () => {
    try {
      const data = await supplierService.getAllSuppliers({ limit: 100, isActive: true });
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      setSuppliers([]);
    }
  }, []);

  const fetchInventoryItems = useCallback(async (search?: string) => {
    try {
      setInventoryLoading(true);
      setInventoryLoadError(null);
      
      const buId = localStorage.getItem('businessUnitId') || 'default';
      
      const params: any = { 
        page: 1, 
        limit: 100,
        businessUnitId: buId,
      };
      if (search) params.search = search;
      
      console.log('📤 Fetching inventory items with params:', params);
      
      let items: any[] = [];
      
      // Method 1: Try getInventoryItems
      try {
        const response = await inventoryService.getInventoryItems(params);
        console.log('📥 getInventoryItems response:', response);
        
        if (response && response.items && Array.isArray(response.items)) {
          items = response.items;
        } else if (response && Array.isArray(response)) {
          items = response;
        }
        
        if (items.length > 0) {
          console.log(`✅ Found ${items.length} inventory items from getInventoryItems`);
        }
      } catch (e) {
        console.warn('❌ getInventoryItems failed:', e);
      }
      
      // Method 2: Try getAllInventory
      if (items.length === 0) {
        try {
          console.log('🔄 Trying getAllInventory as fallback...');
          const response = await inventoryService.getAllInventory(buId);
          console.log('📥 getAllInventory response:', response);
          
          if (response && response.items && Array.isArray(response.items)) {
            items = response.items;
          } else if (response && Array.isArray(response)) {
            items = response;
          }
          
          if (items.length > 0) {
            console.log(`✅ Found ${items.length} inventory items from getAllInventory`);
          }
        } catch (e) {
          console.warn('❌ getAllInventory failed:', e);
        }
      }
      
      // Method 3: Try getInventory
      if (items.length === 0) {
        try {
          console.log('🔄 Trying getInventory as fallback...');
          const response = await inventoryService.getInventory({ 
            page: 1, 
            limit: 100,
            businessUnitId: buId 
          });
          console.log('📥 getInventory response:', response);
          
          if (response && response.inventory && Array.isArray(response.inventory)) {
            items = response.inventory;
          } else if (response && response.items && Array.isArray(response.items)) {
            items = response.items;
          } else if (response && Array.isArray(response)) {
            items = response;
          }
          
          if (items.length > 0) {
            console.log(`✅ Found ${items.length} inventory items from getInventory`);
          }
        } catch (e) {
          console.warn('❌ getInventory failed:', e);
        }
      }
      
      if (items.length === 0) {
        setInventoryItems([]);
        setInventoryLoadError('No inventory items found. Please create an inventory item first.');
        setInventoryLoading(false);
        return;
      }
      
      // Map items to InventoryItem interface
      const mappedItems: InventoryItem[] = items.map((item: any) => ({
        id: item.id,
        name: item.name || item.product?.name || 'Unnamed',
        sku: item.sku || item.product?.sku || 'N/A',
        barcode: item.barcode || item.product?.barcode || null,
        quantity: item.quantity || 0,
        reserved: item.reserved || 0,
        available: (item.quantity || 0) - (item.reserved || 0),
        location: item.location || 'Warehouse',
        unitPrice: item.unitPrice || item.product?.unitPrice || 0,
        costPrice: item.costPrice || item.product?.costPrice || 0,
        category: item.category || item.product?.category?.name || 'Uncategorized',
        categoryId: item.categoryId || item.product?.categoryId || null,
        supplier: item.supplier || item.product?.supplier?.name || null,
        supplierId: item.supplierId || item.product?.supplierId || null,
        reorderPoint: item.reorderPoint || 5,
        hasProduct: !!item.productId || !!item.hasProduct,
        productId: item.productId || item.product?.id || null,
        businessUnitId: item.businessUnitId || buId,
      }));
      
      setInventoryItems(mappedItems);
      setInventoryLoadError(null);
      
      // Auto-select first inventory item if none selected
      if (mappedItems.length > 0 && !selectedInventory && !isEditMode) {
        const firstItem = mappedItems[0];
        setSelectedInventory(firstItem);
        setFormData(prev => ({
          ...prev,
          inventoryId: firstItem.id,
          name: prev.name || firstItem.name,
          sku: prev.sku || firstItem.sku,
          unitPrice: prev.unitPrice || firstItem.unitPrice?.toString() || '',
          costPrice: prev.costPrice || firstItem.costPrice?.toString() || '',
          barcode: prev.barcode || firstItem.barcode || '',
          categoryId: prev.categoryId || firstItem.categoryId || '',
          supplierId: prev.supplierId || firstItem.supplierId || '',
          minStock: prev.minStock || firstItem.reorderPoint?.toString() || '5',
        }));
        toast.info(`Auto-selected inventory: ${firstItem.name}`);
      }
      
    } catch (error) {
      console.error('❌ Error fetching inventory items:', error);
      setInventoryItems([]);
      setInventoryLoadError('Failed to load inventory items. Please refresh and try again.');
      toast.error('Failed to load inventory items');
    } finally {
      setInventoryLoading(false);
    }
  }, [selectedInventory, isEditMode]);

  // ============================================
  // IMAGE UPLOAD - ✅ FIXED
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
  // VARIANT IMAGE UPLOAD - ✅ FIXED
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
  // BARCODE FUNCTIONS
  // ============================================

  const handleGenerateBarcode = useCallback(async () => {
    if (!formData.name) {
      toast.error('Please enter a product name first');
      return;
    }

    setGeneratingBarcode(true);
    setBarcodeError(null);
    
    try {
      const options = {
        prefix: barcodePrefix,
        length: barcodeLength,
        productName: formData.name,
        format: barcodeFormat,
        includeQR: includeQR,
      };
      
      const result = await barcodeService.generateUniqueBarcode(options);
      
      if (result && result.barcode) {
        setFormData(prev => ({ ...prev, barcode: result.barcode }));
        
        const barcodeUrl = `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(result.barcode)}&code=${barcodeFormat}&dpi=96`;
        const qrCodeUrl = includeQR 
          ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(JSON.stringify({
              product: formData.name,
              sku: formData.sku || 'SKU',
              barcode: result.barcode,
              format: barcodeFormat,
            }))}&size=200x200`
          : '';
        
        setBarcodeData({
          barcode: result.barcode,
          barcodeUrl,
          qrCodeUrl,
          generatedAt: new Date().toISOString(),
          format: barcodeFormat,
        });
        
        setShowBarcodeModal(true);
        toast.success('Barcode generated successfully');
      }
    } catch (error: any) {
      console.error('Failed to generate barcode:', error);
      setBarcodeError(error?.message || 'Failed to generate barcode');
      toast.error(error?.message || 'Failed to generate barcode');
    } finally {
      setGeneratingBarcode(false);
    }
  }, [formData.name, formData.sku, barcodePrefix, barcodeLength, barcodeFormat, includeQR]);

  const handleGenerateVariantBarcode = useCallback(async (index: number) => {
    const variant = variants[index];
    if (!variant) return;
    
    if (!variant.name) {
      toast.error('Please enter a variant name first');
      return;
    }

    setGeneratingBarcode(true);
    
    try {
      const options = {
        prefix: 'VAR',
        length: 10,
        productName: variant.name,
        format: 'CODE128' as const,
        includeQR: true,
      };
      
      const result = await barcodeService.generateUniqueBarcode(options);
      
      if (result && result.barcode) {
        const updatedVariants = [...variants];
        updatedVariants[index] = { 
          ...updatedVariants[index], 
          barcode: result.barcode 
        };
        setVariants(updatedVariants);
        
        toast.success(`Barcode generated for variant: ${variant.name}`);
      }
    } catch (error: any) {
      console.error('Failed to generate variant barcode:', error);
      toast.error(error?.message || 'Failed to generate barcode');
    } finally {
      setGeneratingBarcode(false);
    }
  }, [variants]);

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

  // ============================================
  // INVENTORY SELECTION
  // ============================================

  const handleSelectInventory = useCallback((item: InventoryItem) => {
    setSelectedInventory(item);
    setFormData(prev => ({
      ...prev,
      inventoryId: item.id,
      name: prev.name || item.name,
      sku: prev.sku || item.sku,
      unitPrice: prev.unitPrice || item.unitPrice?.toString() || '',
      costPrice: prev.costPrice || item.costPrice?.toString() || '',
      barcode: prev.barcode || item.barcode || '',
      categoryId: prev.categoryId || item.categoryId || '',
      supplierId: prev.supplierId || item.supplierId || '',
      minStock: prev.minStock || item.reorderPoint?.toString() || '5',
    }));
    setShowInventoryPicker(false);
    toast.success(`Selected inventory: ${item.name}`);
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
      name: '',
      sku: '',
      price: 0,
      costPrice: 0,
      stock: 0,
      attributes: {},
      images: [],
    });
    setShowVariantForm(false);
    toast.success('Variant added successfully');
  }, [newVariant, variants]);

  const removeVariant = useCallback((index: number) => {
    setVariants(prev => prev.filter((_, i) => i !== index));
    toast.info('Variant removed');
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

  const addSeoKeyword = useCallback(() => {
    const trimmed = newSeoKeyword.trim();
    if (trimmed && !formData.seo.keywords.includes(trimmed)) {
      setFormData(prev => ({
        ...prev,
        seo: {
          ...prev.seo,
          keywords: [...prev.seo.keywords, trimmed]
        }
      }));
      setNewSeoKeyword('');
    }
  }, [newSeoKeyword, formData.seo.keywords]);

  const removeSeoKeyword = useCallback((keyword: string) => {
    setFormData(prev => ({
      ...prev,
      seo: {
        ...prev.seo,
        keywords: prev.seo.keywords.filter(k => k !== keyword)
      }
    }));
  }, []);

  // ============================================
  // VALIDATION
  // ============================================

  const validateField = useCallback((name: string, value: any): string => {
    switch (name) {
      case 'name':
        if (!value || !value.trim()) return 'Product name is required';
        if (value.trim().length < 2) return 'Product name must be at least 2 characters';
        return '';
      case 'sku':
        if (!value || !value.trim()) return 'SKU is required';
        if (value.trim().length < 2) return 'SKU must be at least 2 characters';
        return '';
      case 'unitPrice':
        if (!value && value !== 0) return 'Unit price is required';
        if (parseFloat(value) < 0) return 'Unit price must be greater than or equal to 0';
        return '';
      case 'minStock':
        if (value && parseInt(value) < 0) return 'Min stock must be greater than or equal to 0';
        return '';
      case 'maxStock':
        if (value && parseInt(value) < 0) return 'Max stock must be greater than or equal to 0';
        if (value && formData.minStock && parseInt(value) < parseInt(formData.minStock)) {
          return 'Max stock must be greater than min stock';
        }
        return '';
      case 'barcode':
        if (value && value.length < 4) return 'Barcode must be at least 4 characters';
        return '';
      case 'inventoryId':
        if (!value) return 'Please select an inventory item';
        return '';
      case 'categoryId':
        return '';
      default:
        return '';
    }
  }, [formData.minStock]);

  const handleBlur = useCallback((field: string, value: any) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const error = validateField(field, value);
    if (error) {
      setErrors(prev => ({ ...prev, [field]: error }));
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [validateField]);

  // ============================================
  // VALIDATE IMAGE HELPER - ✅ FIXED
  // ============================================

  const validateImage = useCallback((img: any): string | null => {
    const PLACEHOLDER_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    
    if (typeof img !== 'string') return null;
    if (!img || img.length === 0) return null;
    
    // ✅ FIXED: Accept HTTP/HTTPS URLs
    if (img.startsWith('http://') || img.startsWith('https://')) {
      return img;
    }
    
    if (!img.startsWith('data:image/')) return null;
    
    try {
      const parts = img.split(',');
      if (parts.length !== 2) return null;
      if (!parts[1] || parts[1].length < 10) return null;
      
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(parts[1])) return null;
      
      // ✅ FIXED: Allow larger images (5MB)
      const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
      if (img.length > MAX_IMAGE_BYTES) {
        console.warn(`⚠️ Image too large (${Math.round(img.length / 1024 / 1024)}MB), using placeholder`);
        return PLACEHOLDER_IMAGE;
      }
      
      return img;
    } catch {
      return null;
    }
  }, []);

  // ============================================
  // SUBMIT - ALWAYS CREATE FROM INVENTORY
  // ============================================

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    const requiredFields = ['name', 'sku', 'unitPrice', 'inventoryId'];
    const newErrors: FormErrors = {};
    let hasError = false;

    // Validate inventory is selected
    if (!formData.inventoryId || !selectedInventory) {
      newErrors.inventoryId = 'Please select an inventory item';
      hasError = true;
    }

    // Validate required fields
    requiredFields.forEach(field => {
      const value = formData[field as keyof typeof formData];
      const error = validateField(field, value);
      if (error) {
        newErrors[field] = error;
        hasError = true;
      }
    });

    // Validate category if provided
    if (formData.categoryId && formData.categoryId !== '') {
      const categoryExists = categories.some(c => c.id === formData.categoryId);
      if (!categoryExists) {
        newErrors.categoryId = 'Selected category does not exist';
        hasError = true;
      }
    }

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

    setLoading(true);

    try {
      // Process tags
      let tagsArray: string[] = [];
      
      if (Array.isArray(formData.tags)) {
        tagsArray = formData.tags.flatMap((tag: any) => {
          if (typeof tag === 'string') {
            if (tag.includes(',')) {
              return tag.split(',').map((t: string) => t.trim()).filter(Boolean);
            }
            return tag.trim();
          }
          return '';
        }).filter(Boolean);
      }

      // ✅ FIXED: Process images - keep all valid images
      const PLACEHOLDER_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      let processedImages: string[] = [];
      const mainImages = Array.isArray(formData.images) ? formData.images : [];
      
      for (const img of mainImages) {
        const validated = validateImage(img);
        if (validated) {
          processedImages.push(validated);
        }
      }
      
      // Only add placeholder if no images and we have at least one invalid image
      if (processedImages.length === 0 && mainImages.length > 0) {
        processedImages = [PLACEHOLDER_IMAGE];
      }

      // ✅ FIXED: Process variants with images
      const processedVariants = variants.map(v => {
        let cleanVariantImages: string[] = [];
        const variantImages = Array.isArray(v.images) ? v.images : [];
        
        for (const img of variantImages) {
          const validated = validateImage(img);
          if (validated) {
            cleanVariantImages.push(validated);
          }
        }
        
        if (cleanVariantImages.length === 0 && variantImages.length > 0) {
          cleanVariantImages = [PLACEHOLDER_IMAGE];
        }

        return {
          name: v.name.trim(),
          sku: v.sku.trim().toUpperCase(),
          price: v.price || 0,
          costPrice: v.costPrice || 0,
          stock: v.stock || 0,
          attributes: v.attributes || {},
          isActive: true,
          barcode: v.barcode || undefined,
          images: cleanVariantImages.length > 0 ? cleanVariantImages : undefined,
        };
      });

      // Build product data - ALWAYS linked to inventory
      const categoryId = formData.categoryId && formData.categoryId !== '' 
        ? formData.categoryId 
        : undefined;

      const productData = {
        name: formData.name.trim(),
        sku: formData.sku.trim().toUpperCase(),
        description: formData.description.trim() || undefined,
        unitPrice: parseFloat(formData.unitPrice) || 0,
        costPrice: formData.costPrice ? parseFloat(formData.costPrice) : undefined,
        barcode: formData.barcode.trim() || undefined,
        categoryId: categoryId,
        supplierId: formData.supplierId || undefined,
        isActive: formData.isActive,
        featured: formData.featured,
        isDigital: formData.isDigital,
        taxRate: formData.taxRate ? parseFloat(formData.taxRate) : undefined,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        minStock: formData.minStock ? parseInt(formData.minStock) : 5,
        maxStock: formData.maxStock ? parseInt(formData.maxStock) : undefined,
        tags: tagsArray,
        images: processedImages,
        notes: formData.notes.trim() || undefined,
        seo: {
          title: formData.seo.title.trim() || undefined,
          description: formData.seo.description.trim() || undefined,
          slug: formData.seo.slug.trim() || undefined,
          keywords: formData.seo.keywords,
        },
        variants: processedVariants,
        inventoryId: formData.inventoryId,
        businessUnitId: businessUnitId || 'default',
        createdBy: user?.id || 'system',
      };

      console.log('📤 Creating product from inventory:', {
        inventoryId: formData.inventoryId,
        productData: {
          ...productData,
          images: productData.images.map((img, i) => {
            const size = Math.round(img.length / 1024);
            return `[Image ${i + 1}: ${size}KB]`;
          }),
        },
      });

      // ALWAYS create product from inventory
      const result = await productService.createProductFromInventory(
        formData.inventoryId,
        productData
      );
      
      toast.success('Product created and linked to inventory successfully');
      
      // Refresh inventory items to show updated stock
      fetchInventoryItems();
      
      router.push('/admin/catalog');
      router.refresh();
    } catch (error: any) {
      console.error('Error creating product:', error);
      
      let errorMessage = 'Failed to create product from inventory';
      if (error.response) {
        const data = error.response.data;
        console.error('Response data:', data);
        if (data?.message) {
          errorMessage = data.message;
        } else if (data?.error) {
          errorMessage = data.error;
        } else if (data?.errors) {
          const errorMessages = Object.values(data.errors).flat().join(', ');
          errorMessage = errorMessages;
        }
      } else if (error.request) {
        errorMessage = 'No response from server. Please check if backend is running.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [formData, variants, businessUnitId, user, router, validateField, validateImage, categories, selectedInventory, fetchInventoryItems]);

  // ============================================
  // RENDER IMAGE GALLERY - ✅ FIXED
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
              src={previewImage} 
              alt="Product preview" 
              className="w-full h-full object-contain"
              onError={(e) => {
                console.warn('Image failed to load, showing placeholder');
                (e.target as HTMLImageElement).src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
              }}
            />
            <div className="absolute bottom-2 right-2">
              <span className="text-xs bg-black/50 text-white px-2 py-1 rounded">
                Main Image
              </span>
            </div>
          </div>
        )}

        {/* Image Thumbnails */}
        <div className="flex flex-wrap gap-4">
          {formData.images.map((image, index) => (
            <div 
              key={index} 
              className={`relative w-24 h-24 rounded-lg overflow-hidden border-2 ${
                previewImage === image 
                  ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-50' 
                  : 'border-gray-200 dark:border-gray-600'
              } group hover:border-blue-400 transition-all`}
            >
              <img 
                src={image} 
                alt={`Product ${index + 1}`} 
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                }}
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
              <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[8px] px-1 py-0.5 rounded">
                #{index + 1}
              </div>
            </div>
          ))}
          
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

  if (permissionLoading || !isClient) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!canCreateProducts) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to add products. Please contact your administrator.
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

  if (loadingData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading inventory data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 transition-colors duration-200">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/catalog')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Back to catalog"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {isEditMode ? 'Edit Product' : 'Create Product from Inventory'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {isEditMode 
                  ? 'Update existing product information' 
                  : 'Select an inventory item to create a product for sales'}
              </p>
            </div>
          </div>
          <Link
            href="/admin/catalog"
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
          >
            Cancel
          </Link>
        </div>

        {/* Inventory Selection - Required */}
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Select Inventory Item <span className="text-red-500">*</span>
              </label>
              {selectedInventory ? (
                <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <Database className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{selectedInventory.name}</p>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                      <span>SKU: {selectedInventory.sku}</span>
                      <span>•</span>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Stock: {selectedInventory.quantity}</span>
                      <span>•</span>
                      <span>Location: {selectedInventory.location}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedInventory(null);
                      setFormData(prev => ({ ...prev, inventoryId: '' }));
                      setShowInventoryPicker(true);
                      fetchInventoryItems();
                    }}
                    className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowInventoryPicker(true);
                      fetchInventoryItems();
                    }}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Database className="w-4 h-4" />
                    Browse Inventory Items
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push('/admin/inventory/add')}
                    className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    New Inventory
                  </button>
                </div>
              )}
              {errors.inventoryId && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.inventoryId}
                </p>
              )}
              {inventoryLoadError && !selectedInventory && (
                <p className="mt-1 text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  {inventoryLoadError}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-400">
                Products must be linked to inventory for stock tracking and accountability.
              </p>
            </div>
          </div>
        </div>

        {/* Inventory Picker Modal */}
        {showInventoryPicker && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-600" />
                  Select Inventory Item
                </h3>
                <button
                  type="button"
                  onClick={() => setShowInventoryPicker(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search inventory..."
                    value={searchInventoryQuery}
                    onChange={(e) => {
                      setSearchInventoryQuery(e.target.value);
                      fetchInventoryItems(e.target.value);
                    }}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {inventoryLoading ? (
                    <div className="text-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                      <p className="mt-2 text-gray-500 dark:text-gray-400">Loading inventory...</p>
                    </div>
                  ) : inventoryItems.length === 0 ? (
                    <div className="text-center py-8">
                      <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-500 dark:text-gray-400">No inventory items available</p>
                      <p className="text-sm text-gray-400 dark:text-gray-500">
                        Create an inventory item first, then create a product from it.
                      </p>
                      <button
                        type="button"
                        onClick={() => router.push('/admin/inventory/add')}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
                      >
                        <Plus className="w-4 h-4" />
                        Create Inventory Item
                      </button>
                    </div>
                  ) : (
                    inventoryItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectInventory(item)}
                        className={`w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border ${
                          selectedInventory?.id === item.id 
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                            : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-1">
                              <span>SKU: {item.sku}</span>
                              <span>•</span>
                              <span className={`font-medium ${item.quantity > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                Stock: {item.quantity}
                              </span>
                              <span>•</span>
                              <span>Location: {item.location}</span>
                              {item.barcode && (
                                <>
                                  <span>•</span>
                                  <span>Barcode: {item.barcode}</span>
                                </>
                              )}
                            </div>
                          </div>
                          {selectedInventory?.id === item.id ? (
                            <CheckCircle className="w-5 h-5 text-blue-600" />
                          ) : (
                            <span className="text-sm text-blue-600 dark:text-blue-400">Select →</span>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
                {inventoryItems.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400">
                    {inventoryItems.length} inventory item{inventoryItems.length !== 1 ? 's' : ''} available
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Barcode Modal */}
        {showBarcodeModal && barcodeData && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-blue-600" />
                  Barcode / QR Code
                </h3>
                <button
                  type="button"
                  onClick={() => setShowBarcodeModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <div className="flex flex-col items-center space-y-4">
                  <div className="bg-white rounded-lg p-4 border border-gray-200 dark:border-gray-700 w-full">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 text-center">Barcode</p>
                    <img 
                      src={barcodeData.barcodeUrl} 
                      alt="Barcode" 
                      className="w-full max-w-xs mx-auto h-auto"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                      }}
                    />
                    <p className="text-sm font-mono text-center mt-2 text-gray-800 dark:text-gray-200">
                      {barcodeData.barcode}
                    </p>
                    <p className="text-xs text-gray-400 text-center mt-1">
                      Format: {barcodeData.format}
                    </p>
                  </div>
                  
                  {barcodeData.qrCodeUrl && (
                    <div className="bg-white rounded-lg p-4 border border-gray-200 dark:border-gray-700 w-full">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 text-center">QR Code</p>
                      <img 
                        src={barcodeData.qrCodeUrl} 
                        alt="QR Code" 
                        className="w-32 h-32 mx-auto object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                        }}
                      />
                    </div>
                  )}
                  
                  <div className="flex flex-wrap gap-2 justify-center w-full">
                    <button
                      type="button"
                      onClick={handleCopyBarcode}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-2"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.download = `barcode_${barcodeData.barcode}.png`;
                        link.href = barcodeData.barcodeUrl;
                        link.click();
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors duration-200">
          <div className="border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 overflow-x-auto">
            <nav className="flex gap-2 sm:gap-4 py-2">
              {[
                { id: 'basic', label: 'Basic Info', icon: Info },
                { id: 'pricing', label: 'Pricing', icon: DollarSign },
                { id: 'inventory', label: 'Inventory', icon: Package },
                { id: 'images', label: 'Images', icon: ImageIcon },
                { id: 'variants', label: 'Variants', icon: Layers },
                { id: 'seo', label: 'SEO', icon: Search },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize whitespace-nowrap flex items-center gap-2 ${
                    activeTab === id
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </nav>
          </div>

          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
            {/* BASIC INFORMATION */}
            {activeTab === 'basic' && (
              <div className="space-y-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    This product will be linked to inventory: <strong>{selectedInventory?.name || 'None selected'}</strong>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Product Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onBlur={(e) => handleBlur('name', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200 ${
                      errors.name ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="Enter product name"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    SKU <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="sku"
                      required
                      value={formData.sku}
                      onChange={(e) => {
                        setAutoGenerateSKU(false);
                        setFormData({ ...formData, sku: e.target.value.toUpperCase() });
                        if (touched.sku) {
                          const error = validateField('sku', e.target.value);
                          setErrors(prev => ({ ...prev, sku: error }));
                        }
                      }}
                      onBlur={(e) => handleBlur('sku', e.target.value)}
                      className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200 ${
                        errors.sku ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                      }`}
                      placeholder="Auto-generated from product name"
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
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="autoGenerateSKU"
                      checked={autoGenerateSKU}
                      onChange={(e) => setAutoGenerateSKU(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 bg-white dark:bg-gray-700"
                    />
                    <label htmlFor="autoGenerateSKU" className="text-xs text-gray-500 dark:text-gray-400">
                      Auto-generate SKU from product name
                    </label>
                  </div>
                  {errors.sku && (
                    <p className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.sku}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                    placeholder="Enter product description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Barcode
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="barcode"
                      value={formData.barcode}
                      onChange={(e) => {
                        setFormData({ ...formData, barcode: e.target.value });
                        if (touched.barcode) {
                          const error = validateField('barcode', e.target.value);
                          setErrors(prev => ({ ...prev, barcode: error }));
                        }
                      }}
                      onBlur={(e) => handleBlur('barcode', e.target.value)}
                      className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200 ${
                        errors.barcode ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                      }`}
                      placeholder="Enter barcode or generate"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateBarcode}
                      disabled={generatingBarcode}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                      title="Generate barcode"
                    >
                      {generatingBarcode ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Barcode className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {errors.barcode && (
                    <p className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.barcode}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Category
                    </label>
                    <select
                      name="categoryId"
                      value={formData.categoryId}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFormData({ ...formData, categoryId: value });
                        if (value) {
                          const categoryName = categories.find(c => c.id === value)?.name || value;
                          toast.info(`Category selected: ${categoryName}`);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200"
                    >
                      <option value="">Select Category</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    {formData.categoryId && (
                      <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                        ✓ Category selected: {categories.find(c => c.id === formData.categoryId)?.name}
                      </p>
                    )}
                    {errors.categoryId && (
                      <p className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errors.categoryId}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Supplier
                    </label>
                    <select
                      value={formData.supplierId}
                      onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
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
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tags
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                      placeholder="Add a tag (press Enter to add)"
                    />
                    <button
                      type="button"
                      onClick={addTag}
                      disabled={!newTag.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="hover:text-blue-900 dark:hover:text-blue-100"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded dark:bg-gray-700 dark:border-gray-600"
                    />
                    <span className="text-sm">Active</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={formData.featured}
                      onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                      className="w-4 h-4 text-yellow-500 rounded dark:bg-gray-700 dark:border-gray-600"
                    />
                    <span className="text-sm">⭐ Featured</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={formData.isDigital}
                      onChange={(e) => setFormData({ ...formData, isDigital: e.target.checked })}
                      className="w-4 h-4 text-purple-500 rounded dark:bg-gray-700 dark:border-gray-600"
                    />
                    <span className="text-sm">Digital Product</span>
                  </label>
                </div>
              </div>
            )}

            {/* PRICING TAB */}
            {activeTab === 'pricing' && (
              <div className="space-y-6">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Pricing is inherited from the linked inventory item. Changes here will update the inventory price.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Unit Price <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
                      <input
                        type="number"
                        name="unitPrice"
                        required
                        step="0.01"
                        min="0"
                        value={formData.unitPrice}
                        onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                        onBlur={(e) => handleBlur('unitPrice', e.target.value)}
                        className={`w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200 ${
                          errors.unitPrice ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                        }`}
                        placeholder="0.00"
                      />
                    </div>
                    {errors.unitPrice && (
                      <p className="mt-1 text-sm text-red-500 dark:text-red-400">{errors.unitPrice}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Cost Price
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.costPrice}
                        onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                        placeholder="0.00"
                      />
                    </div>
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
                    onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                    placeholder="0.00"
                  />
                </div>

                {formData.unitPrice && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                    <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Price Summary</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Unit Price:</span>
                        <span className="font-medium text-gray-900 dark:text-white ml-2">
                          ${parseFloat(formData.unitPrice || '0').toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Cost Price:</span>
                        <span className="font-medium text-gray-900 dark:text-white ml-2">
                          ${parseFloat(formData.costPrice || '0').toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Profit Margin:</span>
                        <span className="font-medium text-green-600 dark:text-green-400 ml-2">
                          {formData.costPrice && parseFloat(formData.costPrice) > 0
                            ? `${(((parseFloat(formData.unitPrice) - parseFloat(formData.costPrice)) / parseFloat(formData.unitPrice)) * 100).toFixed(1)}%`
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
                )}
              </div>
            )}

            {/* INVENTORY TAB */}
            {activeTab === 'inventory' && (
              <div className="space-y-6">
                {selectedInventory && (
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                    <h4 className="text-sm font-medium text-green-800 dark:text-green-300 flex items-center gap-2 mb-3">
                      <CheckCircle className="w-4 h-4" />
                      Linked Inventory Item
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Name:</span>
                        <span className="font-medium text-gray-900 dark:text-white ml-1 block">{selectedInventory.name}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">SKU:</span>
                        <span className="font-medium text-gray-900 dark:text-white ml-1 block">{selectedInventory.sku}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Stock:</span>
                        <span className={`font-medium ml-1 block ${selectedInventory.quantity > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {selectedInventory.quantity} units
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Location:</span>
                        <span className="font-medium text-gray-900 dark:text-white ml-1 block">{selectedInventory.location}</span>
                      </div>
                      {selectedInventory.barcode && (
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Barcode:</span>
                          <span className="font-medium text-gray-900 dark:text-white ml-1 block font-mono">{selectedInventory.barcode}</span>
                        </div>
                      )}
                      {selectedInventory.category && (
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Category:</span>
                          <span className="font-medium text-gray-900 dark:text-white ml-1 block">{selectedInventory.category}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-700 text-xs text-gray-500 dark:text-gray-400">
                      Stock changes to this product will update the linked inventory.
                    </div>
                  </div>
                )}

                {!selectedInventory && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Please select an inventory item from the top of the page.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Min Stock Level
                    </label>
                    <input
                      type="number"
                      name="minStock"
                      value={formData.minStock}
                      onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                      onBlur={(e) => handleBlur('minStock', e.target.value)}
                      min="0"
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200 ${
                        errors.minStock ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                      }`}
                      placeholder="0"
                    />
                    {errors.minStock && (
                      <p className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center gap-1">
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
                      onChange={(e) => setFormData({ ...formData, maxStock: e.target.value })}
                      onBlur={(e) => handleBlur('maxStock', e.target.value)}
                      min="0"
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200 ${
                        errors.maxStock ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                      }`}
                      placeholder="0"
                    />
                    {errors.maxStock && (
                      <p className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errors.maxStock}
                      </p>
                    )}
                  </div>
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
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}

            {/* IMAGES TAB - ✅ UPDATED WITH FIXED IMAGE DISPLAY */}
            {activeTab === 'images' && (
              <div className="space-y-6">
                {renderImageGallery()}
              </div>
            )}

            {/* VARIANTS TAB */}
            {activeTab === 'variants' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Product Variants</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {variants.length} of {MAX_VARIANTS} variants configured
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowVariantForm(true)}
                    disabled={variants.length >= MAX_VARIANTS}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                      variants.length >= MAX_VARIANTS
                        ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    Add Variant
                  </button>
                </div>

                {variants.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <Layers className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">No variants added yet</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">Variants share the same inventory stock</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {variants.map((variant, index) => (
                      <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{variant.name}</p>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
                              <span>SKU: {variant.sku}</span>
                              <span>Price: ${variant.price.toFixed(2)}</span>
                              <span>Stock: {variant.stock}</span>
                              {variant.barcode && <span>Barcode: {variant.barcode}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleGenerateVariantBarcode(index)}
                              className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                              title="Generate barcode"
                            >
                              <Barcode className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeVariant(index)}
                              className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                            </button>
                          </div>
                        </div>
                        {variant.images && variant.images.length > 0 && (
                          <div className="flex gap-2 mt-3">
                            {variant.images.map((img, imgIndex) => (
                              <div key={imgIndex} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                                <img 
                                  src={img} 
                                  alt={`${variant.name} ${imgIndex + 1}`} 
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {showVariantForm && (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/30">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-4">New Variant</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={newVariant.name}
                          onChange={(e) => handleVariantNameChange(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
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
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
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
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Price <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={newVariant.price}
                            onChange={(e) => setNewVariant({ ...newVariant, price: parseFloat(e.target.value) || 0 })}
                            className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Stock
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={newVariant.stock}
                          onChange={(e) => setNewVariant({ ...newVariant, stock: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Variant Images (Max {MAX_VARIANT_IMAGES})
                      </label>
                      <div className="flex flex-wrap gap-3">
                        {newVariant.images && newVariant.images.map((img, index) => (
                          <div key={index} className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-600">
                            <img 
                              src={img} 
                              alt={`Variant ${index + 1}`} 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => removeVariantImage(index)}
                              className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 hover:bg-red-700 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        {(newVariant.images?.length || 0) < MAX_VARIANT_IMAGES && (
                          <label className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 cursor-pointer flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">
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
                      <p className="text-xs text-gray-400 mt-2">
                        Upload variant images (JPG, PNG, WebP). Max 5MB per image.
                      </p>
                    </div>

                    <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <button
                        type="button"
                        onClick={() => setShowVariantForm(false)}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddVariant}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                      >
                        Add Variant
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SEO TAB */}
            {activeTab === 'seo' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    SEO Title
                  </label>
                  <input
                    type="text"
                    value={formData.seo.title}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      seo: { ...prev.seo, title: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                    placeholder="SEO title"
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {formData.seo.title.length}/60 characters
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    SEO Description
                  </label>
                  <textarea
                    value={formData.seo.description}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      seo: { ...prev.seo, description: e.target.value }
                    }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                    placeholder="SEO description"
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
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
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      seo: { ...prev.seo, slug: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                    placeholder="custom-url-slug"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    SEO Keywords
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newSeoKeyword}
                      onChange={(e) => setNewSeoKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSeoKeyword())}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                      placeholder="Add a keyword"
                    />
                    <button
                      type="button"
                      onClick={addSeoKeyword}
                      disabled={!newSeoKeyword.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.seo.keywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm"
                      >
                        {keyword}
                        <button
                          type="button"
                          onClick={() => removeSeoKeyword(keyword)}
                          className="hover:text-red-600 dark:hover:text-red-400"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ACTIONS */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
              <Link
                href="/admin/catalog"
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 w-full sm:w-auto text-center transition-colors duration-200"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading || !selectedInventory}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 w-full sm:w-auto justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isEditMode ? 'Updating...' : 'Creating Product...'}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {isEditMode ? 'Update Product' : 'Create Product from Inventory'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
