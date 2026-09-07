'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Save, Loader2, X, Plus, Trash2, Barcode, QrCode, Scan, 
  RefreshCw, Copy, Check, Download, Printer, AlertCircle,
  CheckCircle, Package, Tag, DollarSign, MapPin, Building,
  Users, Layers, Weight, Ruler, Calendar, Clock,
  Lock, FileText, Eye, Edit
} from 'lucide-react';
import { toast } from '../../utils/toast-manager';
import { inventoryService } from '../../services/inventoryService';
import { barcodeService } from '../../services/barcodeService';
import { useAuth } from '../../hooks/useAuth';
import { usePermission } from '../../hooks/usePermission';
import { PermissionResource } from '../../types/enums';

// ============================================
// TYPES
// ============================================

interface InventoryFormProps {
  mode: 'create' | 'edit';
  inventoryId?: string;
  productId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface Category {
  id: string;
  name: string;
  description?: string;
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
}

// ============================================
// CONSTANTS
// ============================================

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

// ============================================
// MAIN COMPONENT
// ============================================

export function InventoryForm({ mode, inventoryId, productId, onSuccess, onCancel }: InventoryFormProps) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { canCreate, canEdit, canManage } = usePermission();
  
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
  
  const canEditForm = canEdit?.(`${PermissionResource.INVENTORY}:edit`) || canManage?.(`${PermissionResource.INVENTORY}:manage`) || user?.role === 'SUPER_ADMIN' || false;
  const canCreateForm = canCreate?.(`${PermissionResource.INVENTORY}:create`) || canManage?.(`${PermissionResource.INVENTORY}:manage`) || user?.role === 'SUPER_ADMIN' || false;
  const isDisabled = loading || submitting || (mode === 'edit' && !canEditForm) || (mode === 'create' && !canCreateForm);

  // FIXED: Get business unit ID
  const businessUnitId = useCallback(() => {
    const userAny = user as any;
    const buId = user?.businessUnits?.[0]?.businessUnitId;
    if (buId && buId !== 'default' && buId !== 'default-business-unit') return buId;
    const buIdFromId = (user?.businessUnits?.[0] as any)?.id;
    if (buIdFromId && buIdFromId !== 'default') return buIdFromId;
    if (userAny?.businessUnitId && userAny.businessUnitId !== 'default') return userAny.businessUnitId;
    if (userAny?.businessUnit?.id && userAny.businessUnit.id !== 'default') return userAny.businessUnit.id;
    return undefined;
  }, [user]);

  // FIXED: Get user ID
  const userId = useCallback(() => {
    const userAny = user as any;
    return user?.id || userAny?.userId || userAny?.uid || undefined;
  }, [user]);

  // ============================================
  // DATA LOADING
  // ============================================

  const loadData = useCallback(async () => {
    try {
      setLoadingData(true);
      const buId = businessUnitId();
      
      try {
        const categoriesData = await inventoryService.getCategories(buId);
        if (categoriesData && Array.isArray(categoriesData)) {
          setCategories(categoriesData.map((cat: any) => ({
            id: cat.id || cat.categoryId || cat.category,
            name: cat.name || cat.category || 'Uncategorized',
          })));
        }
      } catch (e) { console.warn('Failed to load categories:', e); }
      
      try {
        const suppliersData = await inventoryService.getSuppliers(buId);
        if (suppliersData && Array.isArray(suppliersData)) {
          setSuppliers(suppliersData.map((sup: any) => ({
            id: sup.id,
            name: sup.name,
            contactPerson: sup.contactPerson,
            phone: sup.phone,
            email: sup.email,
          })));
        }
      } catch (e) { console.warn('Failed to load suppliers:', e); }
    } catch (error) {
      console.error('Failed to load form data:', error);
    } finally {
      setLoadingData(false);
    }
  }, [businessUnitId]);

  // FIXED: loadInventory with proper type handling
  const loadInventory = useCallback(async () => {
    if (!inventoryId) return;
    try {
      setLoadingData(true);
      const item: any = await inventoryService.getInventoryItemById(inventoryId);
      
      if (item) {
        const product = item.product || item;
        const inventory = (item as any).inventory || item;
        
        const categoryId = product.categoryId || 
          (typeof product.category === 'string' ? '' : product.category?.id) || 
          inventory.categoryId || '';
          
        const categoryName = (typeof product.category === 'string' ? product.category : product.category?.name) || 
          inventory.category || '';
        
        const supplierId = (inventory as any).supplierId || (item as any).supplierId || product.supplierId || '';
        const supplierName = (inventory as any).supplier || (item as any).supplier || 
          (typeof product.supplier === 'string' ? product.supplier : product.supplier?.name) || '';
        
        setFormData({
          name: product.name || inventory.name || item.name || '',
          sku: product.sku || inventory.sku || item.sku || '',
          description: product.description || inventory.description || item.description || '',
          categoryId: categoryId,
          category: categoryName,
          supplierId: supplierId,
          supplier: supplierName,
          quantity: (inventory as any).quantity || (item as any).quantity || (item as any).stock || 0,
          reserved: (inventory as any).reserved || (item as any).reserved || 0,
          minStock: (inventory as any).reorderPoint || (item as any).minStock || (item as any).reorderPoint || 5,
          maxStock: (inventory as any).reorderQuantity || (item as any).maxStock || (item as any).reorderQuantity || 100,
          unitPrice: product.unitPrice || (inventory as any).unitPrice || (item as any).unitPrice || (item as any).price || 0,
          costPrice: product.costPrice || (inventory as any).costPrice || (item as any).costPrice || 0,
          location: (inventory as any).location || (item as any).location || 'Warehouse',
          shelfNumber: (inventory as any).shelfNumber || (item as any).shelfNumber || '',
          barcode: product.barcode || (inventory as any).barcode || (item as any).barcode || '',
          notes: (inventory as any).notes || (item as any).notes || '',
          isActive: (inventory as any).isActive !== undefined ? (inventory as any).isActive : (product.isActive !== undefined ? product.isActive : true),
          isDigital: (inventory as any).isDigital || product.isDigital || false,
          featured: (inventory as any).featured || product.featured || false,
          weight: (inventory as any).weight || product.weight || (item as any).weight || 0,
          taxRate: (inventory as any).taxRate || product.taxRate || (item as any).taxRate || 0,
          unit: (inventory as any).unit || (product as any).unit || (item as any).unit || 'each',
          tags: (inventory as any).tags ? (Array.isArray((inventory as any).tags) ? (inventory as any).tags.join(', ') : (inventory as any).tags) : 
                (product.tags ? (Array.isArray(product.tags) ? product.tags.join(', ') : product.tags) : ''),
        });
        
        const barcode = product.barcode || (inventory as any).barcode || (item as any).barcode;
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

  // ============================================
  // VALIDATION
  // ============================================

  const validateField = useCallback((name: string, value: any): string | undefined => {
    switch (name) {
      case 'name':
        if (!value || value.trim() === '') return 'Product name is required';
        if (value.trim().length < 2) return 'Name must be at least 2 characters';
        return undefined;
      case 'quantity':
        const qty = Number(value);
        if (isNaN(qty)) return 'Must be a number';
        if (qty < 0) return 'Cannot be negative';
        return undefined;
      case 'unitPrice':
      case 'costPrice':
        const price = Number(value);
        if (isNaN(price)) return 'Must be a number';
        if (price < 0) return 'Cannot be negative';
        return undefined;
      case 'location':
        if (!value) return 'Location is required';
        return undefined;
      case 'weight':
        const weight = Number(value);
        if (isNaN(weight)) return 'Must be a number';
        if (weight < 0) return 'Cannot be negative';
        return undefined;
      case 'taxRate':
        const tax = Number(value);
        if (isNaN(tax)) return 'Must be a number';
        if (tax < 0 || tax > 100) return 'Must be 0-100';
        return undefined;
      default:
        return undefined;
    }
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    let isValid = true;
    if (!formData.name.trim()) { newErrors.name = 'Required'; isValid = false; }
    if (!formData.location) { newErrors.location = 'Required'; isValid = false; }
    if (formData.barcode && isBarcodeValid === false) { newErrors.barcode = 'Already in use'; isValid = false; }
    setErrors(newErrors);
    return isValid;
  }, [formData, isBarcodeValid]);

  // ============================================
  // BARCODE HANDLERS
  // ============================================

  const loadBarcodeInfo = async (barcode: string) => {
    try {
      const [bi, qr] = await Promise.all([
        barcodeService.generateBarcodeImage(barcode),
        barcodeService.generateQRCode({ itemName: formData.name || 'Item', sku: formData.sku, barcode, type: 'INVENTORY_ITEM' }),
      ]);
      setBarcodeInfo({ barcode, barcodeUrl: bi.barcodeUrl, qrCodeUrl: qr.qrCodeUrl, isGenerated: true });
      setIsBarcodeValid(true);
    } catch {
      setBarcodeInfo({
        barcode,
        barcodeUrl: `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(barcode)}&code=CODE128&dpi=96`,
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(JSON.stringify({ barcode }))}&size=200x200`,
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
        setErrors(prev => ({ ...prev, barcode: 'Already in use' }));
        return false;
      }
      setIsBarcodeValid(true);
      setErrors(prev => { const e = { ...prev }; delete e.barcode; return e; });
      return true;
    } catch (error: any) {
      if (error?.response?.status === 404 || error?.status === 404) {
        setIsBarcodeValid(true);
        setErrors(prev => { const e = { ...prev }; delete e.barcode; return e; });
        return true;
      }
      return true;
    } finally {
      setCheckingBarcode(false);
    }
  };

  const handleGenerateBarcode = async () => {
    if (!formData.name) { toast.error('Enter name first'); return; }
    setGeneratingBarcode(true);
    try {
      const barcode = await barcodeService.generateUniqueBarcode({ prefix: 'INV', length: 12, productName: formData.name, sku: formData.sku });
      setFormData(prev => ({ ...prev, barcode: barcode.barcode }));
      setIsBarcodeValid(true);
      const [bi, qr] = await Promise.all([
        barcodeService.generateBarcodeImage(barcode.barcode),
        barcodeService.generateQRCode({ itemName: formData.name, sku: formData.sku, barcode: barcode.barcode, type: 'INVENTORY_ITEM' }),
      ]);
      setBarcodeInfo({ barcode: barcode.barcode, barcodeUrl: bi.barcodeUrl, qrCodeUrl: qr.qrCodeUrl, isGenerated: true });
      setShowBarcode(true);
      toast.success('Barcode generated');
    } catch {
      const fallback = `INV${Date.now().toString().slice(-8)}`;
      setFormData(prev => ({ ...prev, barcode: fallback }));
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
    setFormData(prev => ({ ...prev, barcode: clean }));
    setTouched(prev => ({ ...prev, barcode: true }));
    if (clean.length >= 4) await checkBarcodeUniqueness(clean);
    else setIsBarcodeValid(null);
  };

  const handleCopyBarcode = async () => {
    if (!formData.barcode) return;
    try { await navigator.clipboard.writeText(formData.barcode); setCopied(true); setTimeout(() => setCopied(false), 2000); toast.success('Copied'); } catch { toast.error('Failed'); }
  };

  const handleDownloadBarcode = () => {
    if (!barcodeInfo?.barcodeUrl) return;
    const link = document.createElement('a');
    link.href = barcodeInfo.barcodeUrl;
    link.download = `barcode-${formData.sku || formData.barcode}.png`;
    link.click();
    toast.success('Downloaded');
  };

  // ============================================
  // FORM HANDLERS
  // ============================================

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    let parsed: any = value;
    if (type === 'number') parsed = value === '' ? 0 : parseFloat(value);
    if (type === 'checkbox') parsed = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({ ...prev, [name]: parsed }));
    setErrors(prev => ({ ...prev, [name]: validateField(name, parsed) }));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    setErrors(prev => ({ ...prev, [name]: validateField(name, value) }));
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '__custom__') {
      setIsCustomCategory(true);
      setFormData(prev => ({ ...prev, categoryId: '', category: '' }));
    } else {
      setIsCustomCategory(false);
      const selected = categories.find(c => c.id === value);
      setFormData(prev => ({ ...prev, categoryId: value, category: selected?.name || '' }));
    }
  };

  const handleSupplierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '__custom__') {
      setIsCustomSupplier(true);
      setFormData(prev => ({ ...prev, supplierId: '', supplier: '' }));
    } else {
      setIsCustomSupplier(false);
      const selected = suppliers.find(s => s.id === value);
      setFormData(prev => ({ ...prev, supplierId: value, supplier: selected?.name || '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const buId = businessUnitId();
    const uid = userId();
    if (!buId) { toast.error('Business unit required'); return; }
    if (!uid) { toast.error('User ID required'); return; }
    if (!validateForm()) { toast.error('Fix errors first'); return; }

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
        notes: formData.notes.trim() || undefined,
        description: formData.description.trim() || undefined,
        barcode: formData.barcode || undefined,
        weight: formData.weight || undefined,
        taxRate: formData.taxRate || undefined,
        tags: formData.tags ? formData.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
        isActive: formData.isActive,
        isDigital: formData.isDigital,
        featured: formData.featured,
        businessUnitId: buId,
        userId: uid,
      };
      Object.keys(data).forEach(k => { if (data[k] === undefined) delete data[k]; });

      if (mode === 'edit' && inventoryId) {
        await inventoryService.updateItem(inventoryId, { ...data, businessUnitId: buId });
        toast.success('Updated successfully');
      } else {
        await inventoryService.createItem(data);
        toast.success('Created successfully');
      }
      if (onSuccess) onSuccess();
      else { router.push('/admin/inventory'); router.refresh(); }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================
  // GUARDS
  // ============================================

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4"><Lock className="w-8 h-8 text-gray-400" /></div>
        <h3 className="text-lg font-semibold">Please Login</h3>
        <button onClick={() => router.push('/login')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">Go to Login</button>
      </div>
    );
  }

  if ((mode === 'edit' && !canEditForm) || (mode === 'create' && !canCreateForm)) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4"><Lock className="w-8 h-8 text-gray-400" /></div>
        <h3 className="text-lg font-semibold">Access Denied</h3>
        <button onClick={() => router.push('/admin/inventory')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">Back</button>
      </div>
    );
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3">Loading...</span>
      </div>
    );
  }

  const getFieldError = (fieldName: keyof FormErrors): string | undefined => {
    return touched[fieldName] ? errors[fieldName] : undefined;
  };

  const getInputClassName = (fieldName: keyof FormErrors): string => {
    const base = "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors disabled:opacity-50";
    return getFieldError(fieldName) ? `${base} border-red-500 focus:ring-red-500` : `${base} border-gray-300 dark:border-gray-600`;
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2"><Package className="w-5 h-5 text-blue-500" /> Basic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Product Name <span className="text-red-500">*</span></label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} onBlur={handleBlur} className={getInputClassName('name')} placeholder="Enter name" disabled={isDisabled} required />
            {getFieldError('name') && <p className="mt-1 text-sm text-red-600">{getFieldError('name')}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">SKU</label>
            <input type="text" name="sku" value={formData.sku} onChange={handleChange} className={getInputClassName('sku')} placeholder="Auto-generated if empty" disabled={isDisabled} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Unit <span className="text-red-500">*</span></label>
            <select name="unit" value={formData.unit} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" disabled={isDisabled}>
              {UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea name="description" value={formData.description} onChange={handleChange} rows={3} className="w-full px-3 py-2 border rounded-lg" disabled={isDisabled} />
        </div>
      </div>

      {/* Classification */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-6 space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2"><Tag className="w-5 h-5 text-orange-500" /> Classification</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select value={isCustomCategory ? '__custom__' : formData.categoryId} onChange={handleCategoryChange} className="w-full px-3 py-2 border rounded-lg" disabled={isDisabled}>
              <option value="">Select Category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="__custom__">+ Custom</option>
            </select>
            {isCustomCategory && <input type="text" name="category" value={formData.category} onChange={handleChange} className={`mt-2 ${getInputClassName('category')}`} placeholder="Custom category" disabled={isDisabled} />}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Supplier</label>
            <select value={isCustomSupplier ? '__custom__' : formData.supplierId} onChange={handleSupplierChange} className="w-full px-3 py-2 border rounded-lg" disabled={isDisabled}>
              <option value="">Select Supplier</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              <option value="__custom__">+ Custom</option>
            </select>
            {isCustomSupplier && <input type="text" name="supplier" value={formData.supplier} onChange={handleChange} className={`mt-2 ${getInputClassName('supplier')}`} placeholder="Custom supplier" disabled={isDisabled} />}
          </div>
        </div>
      </div>

      {/* Inventory Details */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-6 space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2"><Layers className="w-5 h-5 text-teal-500" /> Inventory Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Quantity <span className="text-red-500">*</span></label>
            <input type="number" name="quantity" min="0" value={formData.quantity} onChange={handleChange} onBlur={handleBlur} className={getInputClassName('quantity')} disabled={isDisabled} required />
            {getFieldError('quantity') && <p className="mt-1 text-sm text-red-600">{getFieldError('quantity')}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Reserved</label>
            <input type="number" name="reserved" value={formData.reserved} className="w-full px-3 py-2 border rounded-lg opacity-50" disabled />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Min Stock</label>
            <input type="number" name="minStock" min="0" value={formData.minStock} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" disabled={isDisabled} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Max Stock</label>
            <input type="number" name="maxStock" min="0" value={formData.maxStock} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" disabled={isDisabled} />
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-6 space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2"><DollarSign className="w-5 h-5 text-green-500" /> Pricing</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Unit Price ($) <span className="text-red-500">*</span></label>
            <input type="number" name="unitPrice" step="0.01" min="0" value={formData.unitPrice} onChange={handleChange} onBlur={handleBlur} className={getInputClassName('unitPrice')} disabled={isDisabled} required />
            {getFieldError('unitPrice') && <p className="mt-1 text-sm text-red-600">{getFieldError('unitPrice')}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Cost Price ($)</label>
            <input type="number" name="costPrice" step="0.01" min="0" value={formData.costPrice} onChange={handleChange} onBlur={handleBlur} className={getInputClassName('costPrice')} disabled={isDisabled} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tax Rate</label>
            <select name="taxRate" value={formData.taxRate} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" disabled={isDisabled}>
              {TAX_RATES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-6 space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2"><MapPin className="w-5 h-5 text-purple-500" /> Location</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Location <span className="text-red-500">*</span></label>
            <select name="location" value={formData.location} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" disabled={isDisabled} required>
              {LOCATIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Shelf Number</label>
            <input type="text" name="shelfNumber" value={formData.shelfNumber} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" disabled={isDisabled} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Weight (kg)</label>
            <input type="number" name="weight" step="0.001" min="0" value={formData.weight} onChange={handleChange} className={getInputClassName('weight')} disabled={isDisabled} />
          </div>
        </div>
      </div>

      {/* Barcode */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-6 space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2"><Barcode className="w-5 h-5 text-indigo-500" /> Barcode</h3>
        <div className="flex gap-2 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <input type="text" name="barcode" value={formData.barcode} onChange={(e) => handleBarcodeChange(e.target.value)} className={`w-full px-3 py-2 border rounded-lg font-mono ${errors.barcode ? 'border-red-500' : isBarcodeValid === true && formData.barcode ? 'border-green-500' : 'border-gray-300'}`} placeholder="Barcode" disabled={isDisabled} />
            {checkingBarcode && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin" />}
          </div>
          <button type="button" onClick={handleGenerateBarcode} disabled={generatingBarcode || isDisabled} className="px-3 py-2 bg-blue-600 text-white rounded-lg">
            {generatingBarcode ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Generate
          </button>
          {formData.barcode && (
            <>
              <button type="button" onClick={handleCopyBarcode} className="px-3 py-2 border rounded-lg">{copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}</button>
              <button type="button" onClick={() => setShowBarcode(!showBarcode)} className="px-3 py-2 bg-gray-600 text-white rounded-lg"><QrCode className="w-4 h-4" /></button>
            </>
          )}
        </div>
        {showBarcode && barcodeInfo && (
          <div className="border rounded-lg p-4">
            {barcodeInfo.barcodeUrl && <img src={barcodeInfo.barcodeUrl} alt="Barcode" className="h-12" />}
            {barcodeInfo.qrCodeUrl && <img src={barcodeInfo.qrCodeUrl} alt="QR" className="w-20 h-20" />}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-3">Notes</h3>
        <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} className="w-full px-3 py-2 border rounded-lg" disabled={isDisabled} />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        {onCancel && <button type="button" onClick={onCancel} className="px-4 py-2 border rounded-lg" disabled={submitting}>Cancel</button>}
        <button type="submit" disabled={isDisabled || submitting || !businessUnitId()} className="px-6 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {mode === 'edit' ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}
