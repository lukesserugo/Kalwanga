'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save, Loader2, X, Plus, Trash2, Barcode, QrCode, Scan,
  RefreshCw, Copy, Check, Download, Printer, AlertCircle,
  CheckCircle, Package, Tag, DollarSign, MapPin, Building,
  Users, Layers, Weight, Ruler, Calendar, Clock,
  Lock, FileText, Eye, Edit, Hash, Globe, Star,
  Archive, Percent, Image as ImageIcon, Link, Minus,
} from 'lucide-react';
import { toast } from '../../utils/toast-manager';
import { inventoryService } from '../../services/inventoryService';
import { barcodeService } from '../../services/barcodeService';
import { useAuth } from '../../hooks/useAuth';
import { usePermission } from '../../hooks/usePermission';
import { PermissionResource } from '../../types/enums';

interface InventoryFormProps {
  mode: 'create' | 'edit';
  inventoryId?: string;
  productId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  businessUnitId?: string;
}

interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
}

interface BarcodeInfo {
  barcode: string;
  barcodeUrl: string;
  qrCodeUrl: string;
  isGenerated: boolean;
}

interface FormData {
  name: string;
  sku: string;
  description: string;
  categoryId: string;
  category: string;
  supplierId: string;
  supplier: string;
  quantity: number;
  reserved: number;
  minStock: number;
  maxStock: number;
  unitPrice: number;
  costPrice: number;
  location: string;
  shelfNumber: string;
  barcode: string;
  notes: string;
  isActive: boolean;
  isDigital: boolean;
  featured: boolean;
  weight: number;
  taxRate: number;
  unit: string;
  tags: string;
  expiryDate: string;
  batchNumber: string;
  images: string[];
}

interface FormErrors {
  name?: string;
  sku?: string;
  category?: string;
  categoryId?: string;
  supplier?: string;
  supplierId?: string;
  quantity?: string;
  unitPrice?: string;
  costPrice?: string;
  location?: string;
  barcode?: string;
  weight?: string;
  taxRate?: string;
  expiryDate?: string;
  batchNumber?: string;
  images?: string;
}

const UNITS = [
  { value: 'each', label: 'Each' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'g', label: 'Gram (g)' },
  { value: 'l', label: 'Liter (L)' },
  { value: 'ml', label: 'Milliliter (mL)' },
  { value: 'box', label: 'Box' },
  { value: 'pack', label: 'Pack' },
  { value: 'piece', label: 'Piece' },
  { value: 'carton', label: 'Carton' },
  { value: 'dozen', label: 'Dozen' },
  { value: 'set', label: 'Set' },
  { value: 'roll', label: 'Roll' },
  { value: 'meter', label: 'Meter' },
  { value: 'square_meter', label: 'Square Meter' },
  { value: 'cubic_meter', label: 'Cubic Meter' },
];

const LOCATIONS = [
  { value: 'Warehouse', label: 'Warehouse' },
  { value: 'Storefront', label: 'Storefront' },
  { value: 'Backroom', label: 'Backroom' },
  { value: 'Supplier', label: 'Supplier' },
  { value: 'In Transit', label: 'In Transit' },
  { value: 'Distribution Center', label: 'Distribution Center' },
  { value: 'Store A', label: 'Store A' },
  { value: 'Store B', label: 'Store B' },
  { value: 'Online Store', label: 'Online Store' },
];

const TAX_RATES = [
  { value: 0, label: '0% (Exempt)' },
  { value: 5, label: '5%' },
  { value: 8, label: '8%' },
  { value: 10, label: '10%' },
  { value: 15, label: '15%' },
  { value: 18, label: '18%' },
  { value: 20, label: '20%' },
  { value: 25, label: '25%' },
];

const generateSKU = (name: string): string => {
  if (!name || name.trim().length === 0) return '';
  const prefix =
    name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'INV';
  const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

export function InventoryForm({
  mode,
  inventoryId,
  productId,
  onSuccess,
  onCancel,
  className = '',
}: InventoryFormProps) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { canCreate, canEdit, canManage } = usePermission();

  const initialLoadRef = useRef(false);

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    sku: '',
    description: '',
    categoryId: '',
    category: '',
    supplierId: '',
    supplier: '',
    quantity: 0,
    reserved: 0,
    minStock: 5,
    maxStock: 100,
    unitPrice: 0,
    costPrice: 0,
    location: 'Warehouse',
    shelfNumber: '',
    barcode: '',
    notes: '',
    isActive: true,
    isDigital: false,
    featured: false,
    weight: 0,
    taxRate: 0,
    unit: 'each',
    tags: '',
    expiryDate: '',
    batchNumber: '',
    images: [],
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const [generatingBarcode, setGeneratingBarcode] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [barcodeInfo, setBarcodeInfo] = useState<BarcodeInfo | null>(null);
  const [isBarcodeValid, setIsBarcodeValid] = useState<boolean | null>(null);
  const [checkingBarcode, setCheckingBarcode] = useState(false);

  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [isCustomSupplier, setIsCustomSupplier] = useState(false);

  const [imageInput, setImageInput] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);

  const canEditForm =
    canEdit?.('INVENTORY:edit') ||
    canManage?.('INVENTORY:manage') ||
    user?.role === 'SUPER_ADMIN' ||
    false;
  const canCreateForm =
    canCreate?.('INVENTORY:create') ||
    canManage?.('INVENTORY:manage') ||
    user?.role === 'SUPER_ADMIN' ||
    false;
  const isDisabled =
    loading ||
    submitting ||
    (mode === 'edit' && !canEditForm) ||
    (mode === 'create' && !canCreateForm);

  const businessUnitId = useCallback(() => {
    const userAny = user as any;
    const buId = user?.businessUnits?.[0]?.businessUnitId;
    if (buId && buId !== 'default' && buId !== 'default-business-unit')
      return buId;
    const buIdFromId = (user?.businessUnits?.[0] as any)?.id;
    if (buIdFromId && buIdFromId !== 'default') return buIdFromId;
    if (userAny?.businessUnitId && userAny.businessUnitId !== 'default')
      return userAny.businessUnitId;
    if (userAny?.businessUnit?.id && userAny.businessUnit.id !== 'default')
      return userAny.businessUnit.id;
    return localStorage.getItem('businessUnitId') || undefined;
  }, [user]);

  const userId = useCallback(() => {
    const userAny = user as any;
    return user?.id || userAny?.userId || userAny?.uid || undefined;
  }, [user]);

  const loadData = useCallback(async () => {
    try {
      setLoadingData(true);
      const buId = businessUnitId();

      try {
        const categoriesData = await inventoryService.getCategories(buId);
        if (categoriesData && Array.isArray(categoriesData)) {
          setCategories(
            categoriesData.map((cat: any) => ({
              id: cat.id || cat.categoryId || cat.category,
              name: cat.name || cat.category || 'Uncategorized',
              businessUnitId: cat.businessUnitId,
            }))
          );
        }
      } catch (e) {
        console.warn('Failed to load categories:', e);
      }

      try {
        const suppliersData = await inventoryService.getSuppliers(buId);
        if (suppliersData && Array.isArray(suppliersData)) {
          setSuppliers(
            suppliersData.map((sup: any) => ({
              id: sup.id,
              name: sup.name,
              contactPerson: sup.contactPerson,
              phone: sup.phone,
              email: sup.email,
            }))
          );
        }
      } catch (e) {
        console.warn('Failed to load suppliers:', e);
      }
    } catch (error) {
      console.error('Failed to load form data:', error);
    } finally {
      setLoadingData(false);
    }
  }, [businessUnitId]);

  const loadInventory = useCallback(async () => {
    if (!inventoryId) return;
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;

    try {
      setLoadingData(true);
      const item: any = await inventoryService.getInventoryItemById(
        inventoryId
      );

      if (item) {
        const product = item.product || item;
        const inventory = (item as any).inventory || item;

        const categoryId =
          product.categoryId ||
          (typeof product.category === 'string'
            ? ''
            : product.category?.id) ||
          inventory.categoryId ||
          '';

        const categoryName =
          (typeof product.category === 'string'
            ? product.category
            : product.category?.name) ||
          inventory.category ||
          '';

        const supplierId =
          (inventory as any).supplierId ||
          (item as any).supplierId ||
          product.supplierId ||
          '';
        const supplierName =
          (inventory as any).supplier ||
          (item as any).supplier ||
          (typeof product.supplier === 'string'
            ? product.supplier
            : product.supplier?.name) ||
          '';

        let tagsString = '';
        const tagsData =
          (inventory as any).tags || product.tags || (item as any).tags;
        if (tagsData) {
          if (Array.isArray(tagsData)) {
            tagsString = tagsData.join(', ');
          } else if (typeof tagsData === 'string') {
            tagsString = tagsData;
          }
        }

        setFormData({
          name: product.name || inventory.name || item.name || '',
          sku: product.sku || inventory.sku || item.sku || '',
          description:
            product.description || inventory.description || item.description || '',
          categoryId: categoryId,
          category: categoryName,
          supplierId: supplierId,
          supplier: supplierName,
          quantity:
            (inventory as any).quantity ||
            (item as any).quantity ||
            (item as any).stock ||
            0,
          reserved: (inventory as any).reserved || (item as any).reserved || 0,
          minStock:
            (inventory as any).reorderPoint ||
            (item as any).minStock ||
            (item as any).reorderPoint ||
            5,
          maxStock:
            (inventory as any).reorderQuantity ||
            (item as any).maxStock ||
            (item as any).reorderQuantity ||
            100,
          unitPrice:
            product.unitPrice ||
            (inventory as any).unitPrice ||
            (item as any).unitPrice ||
            (item as any).price ||
            0,
          costPrice:
            product.costPrice ||
            (inventory as any).costPrice ||
            (item as any).costPrice ||
            0,
          location:
            (inventory as any).location || (item as any).location || 'Warehouse',
          shelfNumber:
            (inventory as any).shelfNumber || (item as any).shelfNumber || '',
          barcode:
            product.barcode || (inventory as any).barcode || (item as any).barcode || '',
          notes: (inventory as any).notes || (item as any).notes || '',
          isActive:
            (inventory as any).isActive !== undefined
              ? (inventory as any).isActive
              : product.isActive !== undefined
              ? product.isActive
              : true,
          isDigital:
            (inventory as any).isDigital || product.isDigital || false,
          featured: (inventory as any).featured || product.featured || false,
          weight:
            (inventory as any).weight || product.weight || (item as any).weight || 0,
          taxRate:
            (inventory as any).taxRate ||
            product.taxRate ||
            (item as any).taxRate ||
            0,
          unit:
            (inventory as any).unit ||
            (product as any).unit ||
            (item as any).unit ||
            'each',
          tags: tagsString,
          expiryDate:
            (inventory as any).expiryDate || (item as any).expiryDate || '',
          batchNumber:
            (inventory as any).batchNumber || (item as any).batchNumber || '',
          images:
            (inventory as any).images || product.images || (item as any).images || [],
        });

        const barcode =
          product.barcode || (inventory as any).barcode || (item as any).barcode;
        if (barcode) {
          await loadBarcodeInfo(barcode);
        }
      }
    } catch (error) {
      console.error('Failed to load inventory:', error);
      toast.error('Failed to load inventory data');
    } finally {
      setLoadingData(false);
    }
  }, [inventoryId]);

  useEffect(() => {
    loadData();
    if (mode === 'edit' && inventoryId) {
      loadInventory();
    }
  }, [mode, inventoryId, loadData, loadInventory]);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (formData.barcode && formData.barcode.length >= 4) {
        checkBarcodeUniqueness(formData.barcode);
      } else if (formData.barcode && formData.barcode.length < 4) {
        setIsBarcodeValid(null);
      }
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [formData.barcode]);

  const validateField = useCallback(
    (name: string, value: any): string | undefined => {
      switch (name) {
        case 'name':
          if (!value || value.trim() === '') return 'Product name is required';
          if (value.trim().length < 2)
            return 'Name must be at least 2 characters';
          if (value.trim().length > 100)
            return 'Name must be less than 100 characters';
          return undefined;
        case 'quantity': {
          const qty = Number(value);
          if (isNaN(qty)) return 'Must be a number';
          if (qty < 0) return 'Cannot be negative';
          if (qty > 999999) return 'Quantity too large';
          return undefined;
        }
        case 'unitPrice':
        case 'costPrice': {
          const price = Number(value);
          if (isNaN(price)) return 'Must be a number';
          if (price < 0) return 'Cannot be negative';
          if (price > 999999) return 'Price too large';
          return undefined;
        }
        case 'location':
          if (!value) return 'Location is required';
          return undefined;
        case 'weight': {
          const weight = Number(value);
          if (isNaN(weight)) return 'Must be a number';
          if (weight < 0) return 'Cannot be negative';
          return undefined;
        }
        case 'taxRate': {
          const tax = Number(value);
          if (isNaN(tax)) return 'Must be a number';
          if (tax < 0 || tax > 100) return 'Must be 0-100';
          return undefined;
        }
        case 'expiryDate':
          if (value && new Date(value) < new Date())
            return 'Expiry date cannot be in the past';
          return undefined;
        case 'batchNumber':
          if (value && value.trim().length > 50) return 'Batch number too long';
          return undefined;
        default:
          return undefined;
      }
    },
    []
  );

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    let isValid = true;

    if (!formData.name.trim()) {
      newErrors.name = 'Product name is required';
      isValid = false;
    }
    if (!formData.location) {
      newErrors.location = 'Location is required';
      isValid = false;
    }
    if (formData.quantity < 0) {
      newErrors.quantity = 'Quantity cannot be negative';
      isValid = false;
    }
    if (formData.unitPrice < 0) {
      newErrors.unitPrice = 'Unit price cannot be negative';
      isValid = false;
    }
    if (formData.barcode && isBarcodeValid === false) {
      newErrors.barcode = 'Barcode is already in use';
      isValid = false;
    }
    if (formData.expiryDate && new Date(formData.expiryDate) < new Date()) {
      newErrors.expiryDate = 'Expiry date cannot be in the past';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  }, [formData, isBarcodeValid]);

  const loadBarcodeInfo = async (barcode: string) => {
    try {
      const [bi, qr] = await Promise.all([
        barcodeService.generateBarcodeImage(barcode),
        barcodeService.generateQRCode({
          itemName: formData.name || 'Item',
          sku: formData.sku,
          barcode,
          type: 'INVENTORY_ITEM',
          price: formData.unitPrice,
        }),
      ]);
      setBarcodeInfo({
        barcode,
        barcodeUrl: bi.barcodeUrl,
        qrCodeUrl: qr.qrCodeUrl,
        isGenerated: true,
      });
      setIsBarcodeValid(true);
    } catch {
      setBarcodeInfo({
        barcode,
        barcodeUrl: `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(
          barcode
        )}&code=CODE128&dpi=96`,
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
          JSON.stringify({ barcode })
        )}&size=200x200`,
        isGenerated: true,
      });
    }
  };

  const checkBarcodeUniqueness = async (barcode: string): Promise<boolean> => {
    if (!barcode || barcode.length < 3) return true;
    setCheckingBarcode(true);
    try {
      const existing = await barcodeService.getProductByBarcode(barcode);
      if (existing && existing.productId && existing.productId !== inventoryId) {
        setIsBarcodeValid(false);
        setErrors((prev) => ({ ...prev, barcode: 'Barcode is already in use' }));
        return false;
      }
      setIsBarcodeValid(true);
      setErrors((prev) => {
        const e = { ...prev };
        delete e.barcode;
        return e;
      });
      return true;
    } catch (error: any) {
      if (error?.response?.status === 404 || error?.status === 404) {
        setIsBarcodeValid(true);
        setErrors((prev) => {
          const e = { ...prev };
          delete e.barcode;
          return e;
        });
        return true;
      }
      return true;
    } finally {
      setCheckingBarcode(false);
    }
  };

  const handleGenerateBarcode = async () => {
    if (!formData.name) {
      toast.error('Please enter an item name first');
      return;
    }
    setGeneratingBarcode(true);
    try {
      const barcode = await barcodeService.generateUniqueBarcode({
        prefix: 'INV',
        length: 12,
        productName: formData.name,
        sku: formData.sku,
      });
      setFormData((prev) => ({ ...prev, barcode: barcode.barcode }));
      setIsBarcodeValid(true);
      const [bi, qr] = await Promise.all([
        barcodeService.generateBarcodeImage(barcode.barcode),
        barcodeService.generateQRCode({
          itemName: formData.name,
          sku: formData.sku,
          barcode: barcode.barcode,
          type: 'INVENTORY_ITEM',
          price: formData.unitPrice,
        }),
      ]);
      setBarcodeInfo({
        barcode: barcode.barcode,
        barcodeUrl: bi.barcodeUrl,
        qrCodeUrl: qr.qrCodeUrl,
        isGenerated: true,
      });
      setShowBarcode(true);
      toast.success('Barcode generated successfully');
    } catch {
      const fallback = `INV${Date.now().toString().slice(-8)}`;
      setFormData((prev) => ({ ...prev, barcode: fallback }));
      setIsBarcodeValid(true);
      setBarcodeInfo({
        barcode: fallback,
        barcodeUrl: `https://barcode.tec-it.com/barcode.ashx?data=${fallback}&code=CODE128&dpi=96`,
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?data=${fallback}&size=200x200`,
        isGenerated: true,
      });
      setShowBarcode(true);
      toast.warning('Barcode generated locally');
    } finally {
      setGeneratingBarcode(false);
    }
  };

  const handleBarcodeChange = async (value: string) => {
    const clean = value.toUpperCase().trim();
    setFormData((prev) => ({ ...prev, barcode: clean }));
    setTouched((prev) => ({ ...prev, barcode: true }));
    if (clean.length >= 4) await checkBarcodeUniqueness(clean);
    else setIsBarcodeValid(null);
  };

  const handleCopyBarcode = async () => {
    if (!formData.barcode) return;
    try {
      await navigator.clipboard.writeText(formData.barcode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Barcode copied');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleDownloadBarcode = () => {
    if (!barcodeInfo?.barcodeUrl) return;
    const link = document.createElement('a');
    link.href = barcodeInfo.barcodeUrl;
    link.download = `barcode-${formData.sku || formData.barcode}.png`;
    link.click();
    toast.success('Barcode downloaded');
  };

  const handlePrintBarcode = () => {
    if (!barcodeInfo) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head><title>Barcode - ${formData.name}</title>
        <style>
          body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: white; }
          .container { text-align: center; padding: 20px; border: 1px solid #ddd; border-radius: 8px; max-width: 400px; }
          .barcode-img { max-width: 300px; margin: 10px 0; }
          .qr-img { max-width: 150px; margin: 10px 0; }
          .info { margin-top: 15px; }
          .info p { margin: 5px 0; font-size: 14px; }
          .info .label { color: #666; }
          .info .value { font-weight: bold; }
          .product-name { margin: 0 0 5px 0; color: #1a1a1a; }
          .sku { color: #666; font-size: 12px; margin: 0 0 15px 0; }
        </style>
        </head>
        <body>
          <div class="container">
            <h2 class="product-name">${formData.name}</h2>
            <p class="sku">SKU: ${formData.sku || 'N/A'}</p>
            ${barcodeInfo.barcodeUrl ? `<img src="${barcodeInfo.barcodeUrl}" alt="Barcode" class="barcode-img" />` : ''}
            ${barcodeInfo.qrCodeUrl ? `<img src="${barcodeInfo.qrCodeUrl}" alt="QR Code" class="qr-img" />` : ''}
            <div class="info">
              <p><span class="label">Barcode:</span> <span class="value">${barcodeInfo.barcode}</span></p>
              <p><span class="label">Price:</span> <span class="value">$${formData.unitPrice.toFixed(2)}</span></p>
              <p><span class="label">Stock:</span> <span class="value">${formData.quantity}</span></p>
              <p><span class="label">Location:</span> <span class="value">${formData.location}</span></p>
            </div>
          </div>
          <script>window.onload = function() { window.print(); }<\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleAddImage = () => {
    if (!imageInput.trim()) {
      toast.warning('Please enter a valid image URL');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      images: [...prev.images, imageInput.trim()],
    }));
    setImageInput('');
    setShowImageInput(false);
    toast.success('Image added');
  };

  const handleRemoveImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
    toast.success('Image removed');
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    let parsed: any = value;
    if (type === 'number') parsed = value === '' ? 0 : parseFloat(value);
    if (type === 'checkbox') parsed = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({ ...prev, [name]: parsed }));
    setErrors((prev) => ({ ...prev, [name]: validateField(name, parsed) }));
  };

  const handleBlur = (
    e: React.FocusEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '__custom__') {
      setIsCustomCategory(true);
      setFormData((prev) => ({ ...prev, categoryId: '', category: '' }));
    } else {
      setIsCustomCategory(false);
      const selected = categories.find((c) => c.id === value);
      setFormData((prev) => ({
        ...prev,
        categoryId: value,
        category: selected?.name || '',
      }));
    }
    setTouched((prev) => ({ ...prev, category: true }));
  };

  const handleSupplierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '__custom__') {
      setIsCustomSupplier(true);
      setFormData((prev) => ({ ...prev, supplierId: '', supplier: '' }));
    } else {
      setIsCustomSupplier(false);
      const selected = suppliers.find((s) => s.id === value);
      setFormData((prev) => ({
        ...prev,
        supplierId: value,
        supplier: selected?.name || '',
      }));
    }
    setTouched((prev) => ({ ...prev, supplier: true }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const buId = businessUnitId();
    const uid = userId();

    if (!buId) {
      toast.error('Business unit is required. Please select one.');
      return;
    }
    if (!uid) {
      toast.error('User ID is required. Please log in again.');
      return;
    }
    if (!validateForm()) {
      toast.error('Please fix all validation errors');
      return;
    }

    setSubmitting(true);
    try {
      const data: any = {
        name: formData.name.trim(),
        sku: formData.sku.trim() || undefined,
        category: formData.category.trim() || undefined,
        categoryId: formData.categoryId || undefined,
        quantity: formData.quantity || 0,
        unit: formData.unit || 'each',
        minStock: formData.minStock || 5,
        maxStock: formData.maxStock || 100,
        location: formData.location || 'Warehouse',
        supplier: formData.supplier.trim() || undefined,
        supplierId: formData.supplierId || undefined,
        unitPrice: formData.unitPrice || 0,
        costPrice: formData.costPrice || 0,
        notes: formData.notes.trim() || undefined,
        description: formData.description.trim() || undefined,
        barcode: formData.barcode || undefined,
        weight: formData.weight || undefined,
        taxRate: formData.taxRate || undefined,
        tags: formData.tags
          ? formData.tags
              .split(',')
              .map((t: string) => t.trim())
              .filter(Boolean)
          : [],
        isActive: formData.isActive,
        isDigital: formData.isDigital,
        featured: formData.featured,
        images: formData.images || [],
        businessUnitId: buId,
        userId: uid,
      };

      if (formData.expiryDate)
        data.expiryDate = new Date(formData.expiryDate).toISOString();
      if (formData.batchNumber.trim())
        data.batchNumber = formData.batchNumber.trim();

      Object.keys(data).forEach((k) => {
        if (data[k] === undefined) delete data[k];
      });

      let result;
      if (mode === 'edit' && inventoryId) {
        result = await inventoryService.updateItem(inventoryId, {
          ...data,
          businessUnitId: buId,
        });
        toast.success('Inventory item updated successfully');
      } else {
        result = await inventoryService.createItem(data);
        toast.success('Inventory item created successfully');
      }

      console.log('✅ Form submitted successfully:', result);

      if (onSuccess) onSuccess();
      else {
        if (mode === 'edit' && inventoryId) {
          router.push(`/admin/inventory/${inventoryId}`);
        } else {
          router.push('/admin/inventory');
        }
        router.refresh();
      }
    } catch (error: any) {
      console.error('Failed to save:', error);

      let errorMessage = 'Failed to save inventory item';
      if (error?.response?.data) {
        const data = error.response.data;
        if (data.errors && Array.isArray(data.errors)) {
          errorMessage = data.errors
            .map(
              (err: any) =>
                `${err.field || err.path || 'field'}: ${err.message}`
            )
            .join(', ');
        } else if (data.message) {
          errorMessage = data.message;
        } else if (data.error) {
          errorMessage = data.error;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
          Please Login
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          You need to be logged in to manage inventory
        </p>
        <button
          onClick={() => router.push('/login')}
          className="mt-4 px-4 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg transition-all focus-ring"
        >
          Go to Login
        </button>
      </div>
    );
  }

  if (
    (mode === 'edit' && !canEditForm) ||
    (mode === 'create' && !canCreateForm)
  ) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
          Access Denied
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          You don't have permission to {mode === 'edit' ? 'edit' : 'create'}{' '}
          inventory items
        </p>
        <button
          onClick={() => router.push('/admin/inventory')}
          className="mt-4 px-4 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg transition-all focus-ring"
        >
          Back to Inventory
        </button>
      </div>
    );
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">
          Loading...
        </span>
      </div>
    );
  }

  const getFieldError = (fieldName: keyof FormErrors): string | undefined => {
    return touched[fieldName] ? errors[fieldName] : undefined;
  };

  const getInputClassName = (fieldName: keyof FormErrors): string => {
    const base =
      'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
    return getFieldError(fieldName)
      ? `${base} border-danger-500 dark:border-danger-500 focus:ring-danger-500`
      : `${base} border-gray-300 dark:border-gray-600`;
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-6 ${className}`}>
      <div className="card-brand space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Package className="w-5 h-5 text-brand-500" />
          Basic Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Product Name <span className="text-danger-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              onBlur={handleBlur}
              className={getInputClassName('name')}
              placeholder="Enter product name"
              disabled={isDisabled}
              required
            />
            {getFieldError('name') && (
              <p className="mt-1 text-sm text-danger-600 dark:text-danger-400">
                {getFieldError('name')}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              SKU
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                className={getInputClassName('sku')}
                placeholder="Auto-generated"
                disabled={isDisabled}
              />
              <button
                type="button"
                onClick={() => {
                  if (formData.name) {
                    const newSKU = generateSKU(formData.name);
                    setFormData((prev) => ({ ...prev, sku: newSKU }));
                    toast.success('SKU generated');
                  } else {
                    toast.warning('Enter a name first');
                  }
                }}
                disabled={isDisabled || !formData.name}
                className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 flex items-center gap-1 focus-ring"
                title="Generate SKU from name"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Unit <span className="text-danger-500">*</span>
            </label>
            <select
              name="unit"
              value={formData.unit}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:opacity-50"
              disabled={isDisabled}
            >
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:opacity-50 resize-y"
            placeholder="Enter product description"
            disabled={isDisabled}
          />
        </div>
      </div>

      <div className="card-brand space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Tag className="w-5 h-5 text-brand-500" />
          Classification
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category
            </label>
            <select
              value={isCustomCategory ? '__custom__' : formData.categoryId}
              onChange={handleCategoryChange}
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:opacity-50"
              disabled={isDisabled}
            >
              <option value="">Select Category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="__custom__">+ Add Custom Category</option>
            </select>
            {isCustomCategory && (
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className={`mt-2 ${getInputClassName('category')}`}
                placeholder="Enter custom category"
                disabled={isDisabled}
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Supplier
            </label>
            <select
              value={isCustomSupplier ? '__custom__' : formData.supplierId}
              onChange={handleSupplierChange}
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:opacity-50"
              disabled={isDisabled}
            >
              <option value="">Select Supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value="__custom__">+ Add Custom Supplier</option>
            </select>
            {isCustomSupplier && (
              <input
                type="text"
                name="supplier"
                value={formData.supplier}
                onChange={handleChange}
                className={`mt-2 ${getInputClassName('supplier')}`}
                placeholder="Enter custom supplier"
                disabled={isDisabled}
              />
            )}
          </div>
        </div>
      </div>

      <div className="card-brand space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-success-500" />
          Inventory Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Quantity <span className="text-danger-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    quantity: Math.max(0, prev.quantity - 1),
                  }))
                }
                disabled={isDisabled || formData.quantity <= 0}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 focus-ring"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                type="number"
                name="quantity"
                min="0"
                value={formData.quantity}
                onChange={handleChange}
                onBlur={handleBlur}
                className={getInputClassName('quantity')}
                disabled={isDisabled}
                required
              />
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    quantity: prev.quantity + 1,
                  }))
                }
                disabled={isDisabled}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 focus-ring"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {getFieldError('quantity') && (
              <p className="mt-1 text-sm text-danger-600 dark:text-danger-400">
                {getFieldError('quantity')}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Min Stock
            </label>
            <input
              type="number"
              name="minStock"
              min="0"
              value={formData.minStock}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:opacity-50 tabular-nums"
              disabled={isDisabled}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Max Stock
            </label>
            <input
              type="number"
              name="maxStock"
              min="0"
              value={formData.maxStock}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:opacity-50 tabular-nums"
              disabled={isDisabled}
            />
          </div>
        </div>
      </div>

      <div className="card-brand space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-success-500" />
          Pricing
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Unit Price ($) <span className="text-danger-500">*</span>
            </label>
            <input
              type="number"
              name="unitPrice"
              step="0.01"
              min="0"
              value={formData.unitPrice}
              onChange={handleChange}
              onBlur={handleBlur}
              className={getInputClassName('unitPrice')}
              disabled={isDisabled}
              required
            />
            {getFieldError('unitPrice') && (
              <p className="mt-1 text-sm text-danger-600 dark:text-danger-400">
                {getFieldError('unitPrice')}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cost Price ($)
            </label>
            <input
              type="number"
              name="costPrice"
              step="0.01"
              min="0"
              value={formData.costPrice}
              onChange={handleChange}
              onBlur={handleBlur}
              className={getInputClassName('costPrice')}
              disabled={isDisabled}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tax Rate
            </label>
            <select
              name="taxRate"
              value={formData.taxRate}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:opacity-50"
              disabled={isDisabled}
            >
              {TAX_RATES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card-brand space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <MapPin className="w-5 h-5 text-secondary-500" />
          Location & Additional Info
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Location <span className="text-danger-500">*</span>
            </label>
            <select
              name="location"
              value={formData.location}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:opacity-50"
              disabled={isDisabled}
              required
            >
              {LOCATIONS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Shelf Number
            </label>
            <input
              type="text"
              name="shelfNumber"
              value={formData.shelfNumber}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:opacity-50"
              disabled={isDisabled}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Weight (kg)
            </label>
            <input
              type="number"
              name="weight"
              step="0.001"
              min="0"
              value={formData.weight}
              onChange={handleChange}
              className={getInputClassName('weight')}
              disabled={isDisabled}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Expiry Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="date"
                name="expiryDate"
                value={formData.expiryDate}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`${getInputClassName('expiryDate')} pl-10`}
                disabled={isDisabled}
              />
            </div>
            {getFieldError('expiryDate') && (
              <p className="mt-1 text-sm text-danger-600 dark:text-danger-400">
                {getFieldError('expiryDate')}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Batch Number
            </label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                name="batchNumber"
                value={formData.batchNumber}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`${getInputClassName('batchNumber')} pl-10`}
                placeholder="Enter batch number"
                disabled={isDisabled}
              />
            </div>
            {getFieldError('batchNumber') && (
              <p className="mt-1 text-sm text-danger-600 dark:text-danger-400">
                {getFieldError('batchNumber')}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="card-brand space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Barcode className="w-5 h-5 text-secondary-500" />
          Barcode
        </h3>
        <div className="flex gap-2 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <input
              type="text"
              name="barcode"
              value={formData.barcode}
              onChange={(e) => handleBarcodeChange(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none transition-colors disabled:opacity-50 tabular-nums ${
                errors.barcode
                  ? 'border-danger-500 dark:border-danger-500'
                  : isBarcodeValid === true && formData.barcode
                  ? 'border-success-500 dark:border-success-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="Enter barcode or generate"
              disabled={isDisabled}
            />
            {checkingBarcode && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
            )}
          </div>
          <button
            type="button"
            onClick={handleGenerateBarcode}
            disabled={generatingBarcode || isDisabled || !formData.name}
            className="px-3 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg transition-all disabled:opacity-50 flex items-center gap-1 focus-ring"
          >
            {generatingBarcode ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Generate
          </button>
          {formData.barcode && (
            <>
              <button
                type="button"
                onClick={handleCopyBarcode}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors focus-ring"
                title="Copy barcode"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-success-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowBarcode(!showBarcode)}
                className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-1 focus-ring"
              >
                <QrCode className="w-4 h-4" />
                {showBarcode ? 'Hide' : 'Show'}
              </button>
              <button
                type="button"
                onClick={handleDownloadBarcode}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors focus-ring"
                title="Download barcode"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handlePrintBarcode}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors focus-ring"
                title="Print barcode"
              >
                <Printer className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
        {getFieldError('barcode') && (
          <p className="text-sm text-danger-600 dark:text-danger-400">
            {getFieldError('barcode')}
          </p>
        )}
        {isBarcodeValid === false && (
          <p className="text-sm text-danger-600 dark:text-danger-400">
            Barcode is already in use
          </p>
        )}
        {isBarcodeValid === true && formData.barcode && (
          <p className="text-sm text-success-600 dark:text-success-400">
            ✓ Barcode is available
          </p>
        )}

        {showBarcode && barcodeInfo && (
          <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 flex flex-wrap items-center gap-4 bg-gray-50 dark:bg-gray-700/30">
            {barcodeInfo.barcodeUrl && (
              <img
                src={barcodeInfo.barcodeUrl}
                alt="Barcode"
                className="h-12"
              />
            )}
            {barcodeInfo.qrCodeUrl && (
              <img
                src={barcodeInfo.qrCodeUrl}
                alt="QR Code"
                className="w-20 h-20"
              />
            )}
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white font-mono tabular-nums">
                {barcodeInfo.barcode}
              </p>
              <p className="text-2xs text-gray-500 dark:text-gray-400">
                Generated barcode
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="card-brand space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-brand-accent-500" />
          Images
        </h3>

        {formData.images.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {formData.images.map((url, index) => (
              <div key={index} className="relative group">
                <img
                  src={url}
                  alt={`Product image ${index + 1}`}
                  className="w-20 h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder-image.png';
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(index)}
                  disabled={isDisabled}
                  className="absolute -top-2 -right-2 p-1 bg-danger-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger-600 disabled:opacity-0 focus-ring"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {showImageInput ? (
          <div className="flex gap-2">
            <input
              type="url"
              value={imageInput}
              onChange={(e) => setImageInput(e.target.value)}
              placeholder="Enter image URL"
              className="flex-1 px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:opacity-50"
              disabled={isDisabled}
            />
            <button
              type="button"
              onClick={handleAddImage}
              disabled={isDisabled || !imageInput.trim()}
              className="px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 transition-colors disabled:opacity-50 flex items-center gap-1 focus-ring"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
            <button
              type="button"
              onClick={() => {
                setShowImageInput(false);
                setImageInput('');
              }}
              className="btn-secondary focus-ring"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowImageInput(true)}
            disabled={isDisabled}
            className="px-4 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700/50 transition-colors flex items-center gap-2 disabled:opacity-50 focus-ring"
          >
            <Plus className="w-4 h-4" /> Add Image URL
          </button>
        )}
        <p className="text-2xs text-gray-500 dark:text-gray-400">
          Add image URLs to display product images
        </p>
      </div>

      <div className="card-brand space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Tag className="w-5 h-5 text-warning-500" />
          Tags & Notes
        </h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Tags
          </label>
          <input
            type="text"
            name="tags"
            value={formData.tags}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:opacity-50"
            placeholder="Enter tags separated by commas"
            disabled={isDisabled}
          />
          <p className="mt-1 text-2xs text-gray-500 dark:text-gray-400">
            Separate multiple tags with commas
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notes
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:opacity-50 resize-y"
            placeholder="Additional notes"
            disabled={isDisabled}
          />
        </div>
      </div>

      <div className="card-brand space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Archive className="w-5 h-5 text-secondary-500" />
          Status
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-orange-50 dark:hover:bg-gray-600/30 transition-colors">
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
              disabled={isDisabled}
              className="w-4 h-4 text-brand-600 rounded focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
            />
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Active
              </p>
              <p className="text-2xs text-gray-500 dark:text-gray-400">
                Item is available for sale
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-orange-50 dark:hover:bg-gray-600/30 transition-colors">
            <input
              type="checkbox"
              name="featured"
              checked={formData.featured}
              onChange={handleChange}
              disabled={isDisabled}
              className="w-4 h-4 text-warning-500 rounded focus:ring-2 focus:ring-warning-500 disabled:opacity-50"
            />
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                <Star className="w-4 h-4 text-warning-500" /> Featured
              </p>
              <p className="text-2xs text-gray-500 dark:text-gray-400">
                Show in featured section
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-orange-50 dark:hover:bg-gray-600/30 transition-colors">
            <input
              type="checkbox"
              name="isDigital"
              checked={formData.isDigital}
              onChange={handleChange}
              disabled={isDisabled}
              className="w-4 h-4 text-success-500 rounded focus:ring-2 focus:ring-success-500 disabled:opacity-50"
            />
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                <Globe className="w-4 h-4 text-success-500" /> Digital
              </p>
              <p className="text-2xs text-gray-500 dark:text-gray-400">
                Digital product (no shipping)
              </p>
            </div>
          </label>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary w-full sm:w-auto disabled:opacity-50"
            disabled={submitting}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isDisabled || submitting || !businessUnitId()}
          className="px-6 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 w-full sm:w-auto justify-center focus-ring"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {mode === 'edit' ? 'Update Item' : 'Create Item'}
        </button>
      </div>
    </form>
  );
}

export default InventoryForm;
