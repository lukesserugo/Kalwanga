// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\inventory\[id]\edit\page.tsx

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../../../../hooks/useAuth';
import { inventoryService } from '../../../../../../services/inventoryService';
import { barcodeService } from '../../../../../../services/barcodeService';
import { companyService } from '../../../../../../services/companyService';
import { api } from '../../../../../../services/api';
import { toast } from '../../../../../../utils/toast-manager';
import { formatCurrency } from '../../../../../../utils/formatters';
import { 
  ArrowLeft, Package, Save, Loader2, AlertCircle,
  DollarSign, Tag, MapPin, Lock, Info, CheckCircle,
  X, Plus, Minus, Building, User, Calendar,
  Barcode, QrCode, Scan, RefreshCw, Copy, Check,
  Download, Printer, HelpCircle, AlertTriangle,
  ShoppingBag, Layers, Weight, Ruler, Truck, Eye,
  ChevronDown, ChevronUp, Building2, Database, Wand2,
  Edit3, Percent, Archive, Star, Hash, FileText,
  Globe, Link2, Image as ImageIcon
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface InventoryFormData {
  name: string;
  sku: string;
  category: string;
  categoryId?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  costPrice: number;
  minStock: number;
  maxStock: number;
  location: string;
  supplier: string;
  supplierId?: string;
  notes: string;
  description: string;
  barcode: string;
  weight: number;
  isActive: boolean;
  isDigital: boolean;
  featured: boolean;
  tags: string;
  taxRate: number;
  images: string[];
  businessUnitId: string;
}

interface FormErrors {
  name?: string;
  sku?: string;
  category?: string;
  quantity?: string;
  unit?: string;
  unitPrice?: string;
  costPrice?: string;
  minStock?: string;
  maxStock?: string;
  location?: string;
  supplier?: string;
  barcode?: string;
  weight?: string;
  taxRate?: string;
  tags?: string;
  businessUnit?: string;
}

interface BarcodeInfo {
  barcode: string;
  barcodeUrl: string;
  qrCodeUrl: string;
  isGenerated: boolean;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface SupplierOption {
  id: string;
  name: string;
}

interface BusinessUnitOption {
  id: string;
  name: string;
  code: string;
  type?: string;
  isActive?: boolean;
  companyId?: string;
  companyName?: string;
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
// SKU GENERATION FUNCTION
// ============================================

const generateInventorySKU = (itemName: string): string => {
  if (!itemName || itemName.trim().length === 0) {
    return '';
  }
  
  const prefix = itemName
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 3)
    .toUpperCase() || 'INV';
  
  const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  
  return `${prefix}-${timestamp}-${random}`;
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function EditInventoryItemPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  
  // Refs to prevent infinite loops
  const isLoadingRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const hasLoadedOptionsRef = useRef(false);
  const hasLoadedBusinessUnitsRef = useRef(false);
  const initialLoadDoneRef = useRef(false);
  
  // State
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [itemLoaded, setItemLoaded] = useState(false);
  
  // Business Unit selection
  const [businessUnits, setBusinessUnits] = useState<BusinessUnitOption[]>([]);
  const [selectedBusinessUnitId, setSelectedBusinessUnitId] = useState<string>('');
  const [loadingBusinessUnits, setLoadingBusinessUnits] = useState(true);
  const [showBusinessUnitDropdown, setShowBusinessUnitDropdown] = useState(false);
  const [businessUnitError, setBusinessUnitError] = useState<string | null>(null);
  
  // Barcode/QR Code states
  const [generatingBarcode, setGeneratingBarcode] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [barcodeInfo, setBarcodeInfo] = useState<BarcodeInfo | null>(null);
  const [isBarcodeValid, setIsBarcodeValid] = useState<boolean | null>(null);
  const [checkingBarcode, setCheckingBarcode] = useState(false);
  
  // Categories and suppliers
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [isCustomSupplier, setIsCustomSupplier] = useState(false);
  
  // Auto SKU State
  const [autoGenerateSKU, setAutoGenerateSKU] = useState(false);
  
  const [formData, setFormData] = useState<InventoryFormData>({
    name: '',
    sku: '',
    category: '',
    categoryId: '',
    quantity: 0,
    unit: 'each',
    unitPrice: 0,
    costPrice: 0,
    minStock: 5,
    maxStock: 100,
    location: 'Warehouse',
    supplier: '',
    supplierId: '',
    notes: '',
    description: '',
    barcode: '',
    weight: 0,
    isActive: true,
    isDigital: false,
    featured: false,
    tags: '',
    taxRate: 0,
    images: [],
    businessUnitId: '',
  });

  // ============================================
  // FETCH BUSINESS UNITS - IMPROVED
  // ============================================

  const fetchBusinessUnits = useCallback(async () => {
    if (hasLoadedBusinessUnitsRef.current || loadingBusinessUnits) {
      console.log('⏭️ Business units already loaded or loading');
      return;
    }
    
    setLoadingBusinessUnits(true);
    setBusinessUnitError(null);
    
    try {
      console.log('📤 Fetching business units from database...');
      
      let units: BusinessUnitOption[] = [];
      
      // METHOD 1: Get from /business-units endpoint
      try {
        console.log('📤 Method 1: Fetching from /business-units...');
        const response = await api.get('/business-units');
        console.log('📥 Business units response:', response);
        
        let data = response;
        
        if (data && typeof data === 'object') {
          if ('success' in data && data.success && 'data' in data) {
            data = data.data;
          } else if ('data' in data) {
            data = data.data;
          }
        }
        
        console.log('📊 Parsed data type:', Array.isArray(data) ? 'Array' : typeof data);
        
        if (Array.isArray(data) && data.length > 0) {
          units = data
            .filter((bu: any) => bu.id && bu.id !== 'default' && bu.id !== 'default-business-unit')
            .map((bu: any) => ({
              id: bu.id,
              name: bu.name || 'Unnamed Business Unit',
              code: bu.code || '',
              type: bu.type || '',
              isActive: bu.isActive !== false,
              companyId: bu.companyId || bu.company?.id || undefined,
              companyName: bu.company?.name || undefined,
            }));
          console.log(`✅ Fetched ${units.length} business units from /business-units`);
          
          if (units.length > 0) {
            localStorage.setItem('businessUnits', JSON.stringify(units));
            
            const activeUnit = units.find(bu => bu.isActive !== false);
            if (activeUnit) {
              setSelectedBusinessUnitId(activeUnit.id);
              setFormData(prev => ({ ...prev, businessUnitId: activeUnit.id }));
              localStorage.setItem('businessUnitId', activeUnit.id);
              console.log('✅ Auto-selected business unit:', activeUnit.id, activeUnit.name);
            }
            
            setBusinessUnits(units);
            setLoadingBusinessUnits(false);
            hasLoadedBusinessUnitsRef.current = true;
            return;
          }
        } else {
          console.warn('⚠️ No business units found in /business-units response');
        }
      } catch (apiError) {
        console.warn('❌ Failed to fetch from /business-units:', apiError);
      }
      
      // METHOD 2: Try to get from company service
      if (units.length === 0) {
        try {
          console.log('🔄 Method 2: Attempting to fetch from company service...');
          const companies = await companyService.getAll({ limit: 100 });
          console.log('📥 Companies response:', companies);
          
          if (companies && companies.data && Array.isArray(companies.data)) {
            for (const company of companies.data) {
              if (company.businessUnits && Array.isArray(company.businessUnits)) {
                company.businessUnits.forEach((bu: any) => {
                  if (bu.id && bu.id !== 'default' && bu.id !== 'default-business-unit') {
                    units.push({
                      id: bu.id,
                      name: bu.name || `${company.name} - Business Unit`,
                      code: bu.code || '',
                      type: bu.type || '',
                      isActive: bu.isActive !== false,
                      companyId: company.id,
                      companyName: company.name,
                    });
                  }
                });
              }
            }
            console.log(`✅ Fetched ${units.length} business units from companies`);
          }
        } catch (companyError) {
          console.warn('❌ Failed to fetch from company service:', companyError);
        }
      }
      
      // METHOD 3: Try from user's context
      if (units.length === 0) {
        try {
          const userAny = user as any;
          if (userAny?.businessUnits && Array.isArray(userAny.businessUnits)) {
            userAny.businessUnits.forEach((bu: any) => {
              const id = bu.businessUnitId || bu.id || bu;
              const name = bu.businessUnit?.name || bu.name || bu.businessUnitName || 'Unnamed Business Unit';
              const code = bu.businessUnit?.code || bu.code || '';
              const type = bu.businessUnit?.type || bu.type || '';
              const isActive = bu.businessUnit?.isActive !== undefined ? bu.businessUnit.isActive : (bu.isActive !== undefined ? bu.isActive : true);
              
              if (id && id !== 'default' && id !== 'default-business-unit') {
                units.push({
                  id: id,
                  name: name,
                  code: code,
                  type: type,
                  isActive: isActive,
                  companyId: bu.businessUnit?.companyId || undefined,
                  companyName: undefined,
                });
              }
            });
            console.log(`✅ Found ${units.length} business units in user context`);
          }
        } catch (userError) {
          console.warn('❌ Failed to fetch from user context:', userError);
        }
      }
      
      // METHOD 4: Try localStorage
      if (units.length === 0) {
        try {
          const stored = localStorage.getItem('businessUnits');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              units = parsed.filter((bu: any) => bu.id && bu.id !== 'default' && bu.id !== 'default-business-unit');
              console.log(`✅ Found ${units.length} business units in localStorage`);
            }
          }
        } catch (storageError) {
          console.warn('❌ Failed to parse from localStorage:', storageError);
        }
      }
      
      // METHOD 5: Try to get a default one
      if (units.length === 0) {
        const defaultBU = localStorage.getItem('businessUnitId');
        if (defaultBU && defaultBU !== 'default' && defaultBU !== 'default-business-unit') {
          units.push({
            id: defaultBU,
            name: 'Default Business Unit',
            code: 'DEFAULT',
            type: 'STORE',
            isActive: true,
            companyId: undefined,
            companyName: undefined,
          });
          console.log(`✅ Using default business unit from localStorage: ${defaultBU}`);
        }
      }
      
      // Remove duplicates by ID
      const uniqueUnits = units.filter((unit, index, self) => 
        index === self.findIndex((u) => u.id === unit.id)
      );
      
      console.log(`📊 Total unique business units: ${uniqueUnits.length}`);
      setBusinessUnits(uniqueUnits);
      
      // Auto-select the first active business unit
      if (uniqueUnits.length > 0) {
        const activeUnit = uniqueUnits.find(bu => bu.isActive !== false && bu.id !== 'default');
        if (activeUnit) {
          setSelectedBusinessUnitId(activeUnit.id);
          setFormData(prev => ({ ...prev, businessUnitId: activeUnit.id }));
          localStorage.setItem('businessUnitId', activeUnit.id);
          console.log('✅ Auto-selected business unit:', activeUnit.id, activeUnit.name);
        } else if (uniqueUnits[0] && uniqueUnits[0].id !== 'default') {
          setSelectedBusinessUnitId(uniqueUnits[0].id);
          setFormData(prev => ({ ...prev, businessUnitId: uniqueUnits[0].id }));
          localStorage.setItem('businessUnitId', uniqueUnits[0].id);
          console.log('✅ Selected first business unit:', uniqueUnits[0].id, uniqueUnits[0].name);
        }
      } else {
        console.warn('⚠️ No valid business units found');
        setBusinessUnitError('No business units available. Please create a business unit first.');
        toast.warning('No business units available');
      }
      
      hasLoadedBusinessUnitsRef.current = true;
      
    } catch (error) {
      console.error('❌ Error fetching business units:', error);
      setBusinessUnitError('Failed to load business units. Please refresh and try again.');
      toast.error('Failed to load business units');
    } finally {
      setLoadingBusinessUnits(false);
    }
  }, [user]);

  // ============================================
  // LOAD CATEGORIES AND SUPPLIERS - IMPROVED
  // ============================================

  const loadOptions = useCallback(async (buId: string) => {
    if (!buId || buId === 'default' || buId === 'default-business-unit') {
      console.warn('⚠️ Invalid business unit ID, skipping options load');
      setLoadingOptions(false);
      return;
    }
    
    if (hasLoadedOptionsRef.current) {
      console.log('⏭️ Options already loaded');
      return;
    }
    
    console.log('📤 Loading options with businessUnitId:', buId);
    setLoadingOptions(true);
    
    try {
      // Load Categories
      let categoriesLoaded = false;
      
      try {
        console.log('📤 Attempt 1: Fetching categories with getCategories...');
        const categoriesData = await inventoryService.getCategories(buId);
        console.log('📥 getCategories response:', categoriesData);
        
        if (categoriesData && Array.isArray(categoriesData) && categoriesData.length > 0) {
          setCategories(categoriesData.map((cat: any) => ({
            id: cat.id || cat.categoryId || cat.category,
            name: cat.name || cat.category || 'Uncategorized',
          })));
          console.log('✅ Categories loaded from getCategories:', categoriesData.length);
          categoriesLoaded = true;
        } else {
          console.warn('⚠️ getCategories returned empty or invalid data');
        }
      } catch (e) {
        console.warn('❌ getCategories failed:', e);
      }

      // Try 2: getCategorySummary (fallback)
      if (!categoriesLoaded) {
        try {
          console.log('📤 Attempt 2: Fetching categories with getCategorySummary...');
          const summaryData = await inventoryService.getCategorySummary(buId);
          console.log('📥 getCategorySummary response:', summaryData);
          
          if (summaryData && Array.isArray(summaryData) && summaryData.length > 0) {
            setCategories(summaryData.map((cat: any) => ({
              id: cat.id || cat.categoryId || cat.category,
              name: cat.name || cat.category || 'Uncategorized',
            })));
            console.log('✅ Categories loaded from getCategorySummary:', summaryData.length);
            categoriesLoaded = true;
          } else {
            console.warn('⚠️ getCategorySummary returned empty or invalid data');
          }
        } catch (e) {
          console.warn('❌ getCategorySummary failed:', e);
        }
      }

      // Try 3: Extract from inventory data
      if (!categoriesLoaded) {
        try {
          console.log('📤 Attempt 3: Extracting categories from inventory data...');
          const inventoryData = await inventoryService.getAllInventory(buId);
          console.log('📥 getAllInventory response:', inventoryData?.items?.length || 0, 'items');
          
          if (inventoryData && inventoryData.items && inventoryData.items.length > 0) {
            const categoryMap = new Map<string, { id: string; name: string; count: number }>();
            inventoryData.items.forEach((item: any) => {
              const categoryName = item.category || item.product?.category?.name || 'Uncategorized';
              const categoryId = item.categoryId || item.product?.category?.id || categoryName;
              if (!categoryMap.has(categoryName)) {
                categoryMap.set(categoryName, {
                  id: categoryId,
                  name: categoryName,
                  count: 0,
                });
              }
              const existing = categoryMap.get(categoryName)!;
              existing.count += 1;
            });
            const result = Array.from(categoryMap.values());
            if (result.length > 0) {
              setCategories(result.map(cat => ({
                id: cat.id,
                name: cat.name,
              })));
              console.log('✅ Categories extracted from inventory data:', result.length);
              categoriesLoaded = true;
            }
          }
        } catch (e) {
          console.warn('❌ Extracting from inventory data failed:', e);
        }
      }

      // If still no categories, try fetching ALL categories without business unit filter
      if (!categoriesLoaded) {
        try {
          console.log('📤 Attempt 4: Fetching ALL categories (no filter)...');
          const allCategories = await inventoryService.getCategories();
          console.log('📥 All categories response:', allCategories);
          
          if (allCategories && Array.isArray(allCategories) && allCategories.length > 0) {
            setCategories(allCategories.map((cat: any) => ({
              id: cat.id || cat.categoryId || cat.category,
              name: cat.name || cat.category || 'Uncategorized',
            })));
            console.log('✅ Categories loaded from ALL categories:', allCategories.length);
            categoriesLoaded = true;
          }
        } catch (e) {
          console.warn('❌ Fetching ALL categories failed:', e);
        }
      }

      if (!categoriesLoaded) {
        console.warn('⚠️ No categories found from any source');
        setCategories([]);
      }

      // Load Suppliers
      let suppliersLoaded = false;

      try {
        console.log('📤 Fetching suppliers with getSuppliers...');
        const suppliersData = await inventoryService.getSuppliers(buId);
        console.log('📥 getSuppliers response:', suppliersData);
        
        if (suppliersData && Array.isArray(suppliersData) && suppliersData.length > 0) {
          setSuppliers(suppliersData.map((sup: any) => ({
            id: sup.id,
            name: sup.name,
          })));
          console.log('✅ Suppliers loaded:', suppliersData.length);
          suppliersLoaded = true;
        }
      } catch (e) {
        console.warn('❌ getSuppliers failed:', e);
      }

      // Try 2: Extract from inventory data
      if (!suppliersLoaded) {
        try {
          console.log('📤 Attempt 2: Extracting suppliers from inventory data...');
          const inventoryData = await inventoryService.getAllInventory(buId);
          if (inventoryData && inventoryData.items && inventoryData.items.length > 0) {
            const uniqueSuppliers = new Map();
            inventoryData.items.forEach((item: any) => {
              if (item.supplier) {
                uniqueSuppliers.set(item.supplier, { 
                  id: item.supplierId || item.supplier, 
                  name: item.supplier 
                });
              }
            });
            const supplierList = Array.from(uniqueSuppliers.values());
            if (supplierList.length > 0) {
              setSuppliers(supplierList);
              console.log('✅ Suppliers extracted from inventory:', supplierList.length);
              suppliersLoaded = true;
            }
          }
        } catch (e) {
          console.warn('❌ Extracting suppliers from inventory failed:', e);
        }
      }

      if (!suppliersLoaded) {
        console.warn('⚠️ No suppliers found from any source');
        setSuppliers([]);
      }

      hasLoadedOptionsRef.current = true;

    } catch (error) {
      console.error('❌ Error loading options:', error);
    } finally {
      setLoadingOptions(false);
      console.log('✅ Options loading complete. Categories:', categories.length, 'Suppliers:', suppliers.length);
    }
  }, []);

  // ============================================
  // LOAD BARCODE INFO
  // ============================================

  const loadBarcodeInfo = useCallback(async (barcode: string) => {
    if (!barcode) return;
    try {
      const [barcodeImage, qrCode] = await Promise.all([
        barcodeService.generateBarcodeImage(barcode),
        barcodeService.generateQRCode({
          itemName: formData.name || 'Item',
          sku: formData.sku || '',
          barcode: barcode,
          price: formData.unitPrice || 0,
          type: 'INVENTORY_ITEM',
          id: id || '',
        }),
      ]);
      
      setBarcodeInfo({
        barcode: barcode,
        barcodeUrl: barcodeImage.barcodeUrl,
        qrCodeUrl: qrCode.qrCodeUrl,
        isGenerated: true,
      });
    } catch (error) {
      console.warn('Could not generate barcode image:', error);
      setBarcodeInfo({
        barcode: barcode,
        barcodeUrl: `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(barcode)}&code=CODE128&dpi=96`,
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(JSON.stringify({ barcode, item: formData.name }))}&size=200x200`,
        isGenerated: true,
      });
    }
  }, [formData.name, formData.sku, formData.unitPrice, id]);

  // ============================================
  // LOAD ITEM DATA
  // ============================================

  const loadItem = useCallback(async () => {
    if (isLoadingRef.current || hasLoadedRef.current) {
      console.log('⏭️ Skipping load - already loading or loaded');
      return;
    }
    
    if (!id) {
      console.log('⏭️ No ID provided');
      return;
    }
    
    try {
      isLoadingRef.current = true;
      setLoading(true);
      
      console.log('📤 Fetching item for edit:', id);
      
      const data = await inventoryService.getInventoryItemById(id);
      
      console.log('📥 getInventoryItemById response:', data);
      
      if (!data || !data.id) {
        toast.error('Item not found');
        router.push('/admin/inventory');
        return;
      }
      
      setFormData({
        name: data.name || data.product?.name || '',
        sku: data.sku || data.product?.sku || '',
        category: data.category || data.product?.category?.name || '',
        categoryId: data.categoryId || data.product?.category?.id || '',
        quantity: data.quantity || data.stock || 0,
        unit: data.unit || 'each',
        unitPrice: data.price || data.unitPrice || data.product?.unitPrice || 0,
        costPrice: data.costPrice || data.product?.costPrice || 0,
        minStock: data.reorderPoint || data.minStock || 5,
        maxStock: data.reorderQuantity || data.maxStock || 100,
        location: data.location || 'Warehouse',
        supplier: data.supplier || data.product?.supplier?.name || '',
        supplierId: data.supplierId || data.product?.supplier?.id || '',
        notes: data.notes || '',
        description: data.description || data.product?.description || '',
        barcode: data.barcode || '',
        weight: data.weight || 0,
        isActive: data.isActive !== undefined ? data.isActive : true,
        isDigital: data.isDigital || false,
        featured: data.featured || false,
        tags: data.tags ? (Array.isArray(data.tags) ? data.tags.join(', ') : String(data.tags)) : '',
        taxRate: data.taxRate || 0,
        images: data.images || [],
        businessUnitId: data.businessUnitId || localStorage.getItem('businessUnitId') || '',
      });
      
      setSelectedBusinessUnitId(data.businessUnitId || localStorage.getItem('businessUnitId') || '');
      
      if (data.barcode) {
        await loadBarcodeInfo(data.barcode);
      }
      
      hasLoadedRef.current = true;
      setItemLoaded(true);
      initialLoadDoneRef.current = true;
      
    } catch (error: any) {
      console.error('Failed to load item:', error);
      toast.error('Failed to load item data');
      router.push('/admin/inventory');
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [id, router, loadBarcodeInfo]);

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    if (isAuthenticated && !hasLoadedBusinessUnitsRef.current && !loadingBusinessUnits) {
      fetchBusinessUnits();
    }
  }, [isAuthenticated, fetchBusinessUnits, loadingBusinessUnits]);

  useEffect(() => {
    if (selectedBusinessUnitId && selectedBusinessUnitId !== 'default' && !hasLoadedOptionsRef.current && !loadingOptions) {
      loadOptions(selectedBusinessUnitId);
    }
  }, [selectedBusinessUnitId, loadOptions, loadingOptions]);

  useEffect(() => {
    if (
      isAuthenticated && 
      id && 
      businessUnits.length > 0 && 
      !hasLoadedRef.current && 
      !isLoadingRef.current &&
      !initialLoadDoneRef.current
    ) {
      console.log('🔄 Triggering loadItem from useEffect');
      loadItem();
    }
  }, [isAuthenticated, id, businessUnits.length, loadItem]);

  useEffect(() => {
    return () => {
      isLoadingRef.current = false;
      hasLoadedRef.current = false;
      hasLoadedOptionsRef.current = false;
      hasLoadedBusinessUnitsRef.current = false;
      initialLoadDoneRef.current = false;
    };
  }, []);

  // ============================================
  // BARCODE HANDLERS
  // ============================================

  const checkBarcodeUniqueness = useCallback(async (barcode: string): Promise<boolean> => {
    if (!barcode || barcode.length < 3) return true;
    
    setCheckingBarcode(true);
    try {
      const result = await import('../../../../../../services/productService').then(m => m.productService.validateBarcode(barcode, id));
      if (result && !result.valid) {
        setIsBarcodeValid(false);
        setErrors(prev => ({ 
          ...prev, 
          barcode: result.message || 'This barcode is already assigned to another product' 
        }));
        return false;
      }
      setIsBarcodeValid(true);
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.barcode;
        return newErrors;
      });
      return true;
    } catch (error: any) {
      if (error?.response?.status === 404 || error?.status === 404) {
        setIsBarcodeValid(true);
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.barcode;
          return newErrors;
        });
        return true;
      }
      console.error('Error checking barcode:', error);
      return true;
    } finally {
      setCheckingBarcode(false);
    }
  }, [id]);

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
        sku: formData.sku || undefined,
      });

      setFormData(prev => ({ ...prev, barcode: barcode.barcode }));
      setIsBarcodeValid(true);
      
      const [barcodeImage, qrCode] = await Promise.all([
        barcodeService.generateBarcodeImage(barcode.barcode),
        barcodeService.generateQRCode({
          itemName: formData.name,
          sku: formData.sku,
          price: formData.unitPrice,
          barcode: barcode.barcode,
          type: 'INVENTORY_ITEM',
        }),
      ]);
      
      setBarcodeInfo({
        barcode: barcode.barcode,
        barcodeUrl: barcodeImage.barcodeUrl,
        qrCodeUrl: qrCode.qrCodeUrl,
        isGenerated: true,
      });
      setShowBarcode(true);
      toast.success('Unique barcode generated successfully');
    } catch (error: any) {
      console.error('Failed to generate barcode:', error);
      toast.error(error?.message || 'Failed to generate barcode');
      setIsBarcodeValid(false);
    } finally {
      setGeneratingBarcode(false);
    }
  };

  const handleBarcodeChange = async (value: string) => {
    const cleanValue = value.toUpperCase().trim();
    setFormData(prev => ({ ...prev, barcode: cleanValue }));
    
    if (cleanValue.length >= 4) {
      await checkBarcodeUniqueness(cleanValue);
    } else {
      setIsBarcodeValid(null);
    }
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

  const handlePrintBarcode = () => {
    if (!barcodeInfo) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Barcode - ${formData.name}</title>
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
          <script>
            window.onload = function() { window.print(); }
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadBarcode = () => {
    if (!barcodeInfo?.barcodeUrl) return;
    const link = document.createElement('a');
    link.href = barcodeInfo.barcodeUrl;
    link.download = `barcode-${formData.sku || formData.barcode}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Barcode downloaded');
  };

  // ============================================
  // SKU HANDLERS
  // ============================================

  const handleRegenerateSKU = useCallback(() => {
    if (formData.name && formData.name.trim().length >= 2) {
      const newSKU = generateInventorySKU(formData.name);
      setFormData(prev => ({ ...prev, sku: newSKU }));
      setAutoGenerateSKU(true);
      toast.success('SKU regenerated');
    } else {
      toast.warning('Please enter an item name first');
    }
  }, [formData.name]);

  const handleSKUChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setTouched(prev => ({ ...prev, sku: true }));
    
    if (autoGenerateSKU && value.trim().length > 0) {
      setAutoGenerateSKU(false);
    }
    
    setFormData(prev => ({ ...prev, sku: value.toUpperCase() }));
    const error = validateField('sku', value);
    setErrors(prev => ({ ...prev, sku: error }));
  };

  // ============================================
  // VALIDATION
  // ============================================

  const validateField = useCallback((name: string, value: any): string | undefined => {
    switch (name) {
      case 'name':
        if (!value || value.trim() === '') return 'Item name is required';
        if (value.trim().length < 2) return 'Item name must be at least 2 characters';
        if (value.trim().length > 100) return 'Item name must be less than 100 characters';
        return undefined;
      case 'sku':
        if (value && value.trim().length > 50) return 'SKU must be less than 50 characters';
        return undefined;
      case 'category':
        if (value && value.trim().length > 50) return 'Category must be less than 50 characters';
        return undefined;
      case 'quantity':
        const qty = Number(value);
        if (isNaN(qty)) return 'Quantity must be a number';
        if (qty < 0) return 'Quantity cannot be negative';
        if (qty > 999999) return 'Quantity is too large';
        return undefined;
      case 'unitPrice':
        const price = Number(value);
        if (isNaN(price)) return 'Unit price must be a number';
        if (price < 0) return 'Unit price cannot be negative';
        if (price > 999999) return 'Unit price is too large';
        return undefined;
      case 'costPrice':
        const cost = Number(value);
        if (isNaN(cost)) return 'Cost price must be a number';
        if (cost < 0) return 'Cost price cannot be negative';
        if (cost > 999999) return 'Cost price is too large';
        return undefined;
      case 'minStock':
        const min = Number(value);
        if (isNaN(min)) return 'Min stock must be a number';
        if (min < 0) return 'Min stock cannot be negative';
        if (min > 999999) return 'Min stock is too large';
        return undefined;
      case 'maxStock':
        const max = Number(value);
        if (isNaN(max)) return 'Max stock must be a number';
        if (max < 0) return 'Max stock cannot be negative';
        if (max > 999999) return 'Max stock is too large';
        if (max < formData.minStock) return 'Max stock must be greater than min stock';
        return undefined;
      case 'location':
        if (!value) return 'Location is required';
        return undefined;
      case 'supplier':
        if (value && value.trim().length > 100) return 'Supplier name must be less than 100 characters';
        return undefined;
      case 'barcode':
        if (value && value.trim().length > 50) return 'Barcode must be less than 50 characters';
        return undefined;
      case 'weight':
        const weight = Number(value);
        if (isNaN(weight)) return 'Weight must be a number';
        if (weight < 0) return 'Weight cannot be negative';
        return undefined;
      case 'taxRate':
        const tax = Number(value);
        if (isNaN(tax)) return 'Tax rate must be a number';
        if (tax < 0 || tax > 100) return 'Tax rate must be between 0 and 100';
        return undefined;
      default:
        return undefined;
    }
  }, [formData.minStock]);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    let isValid = true;

    if (!formData.name.trim()) {
      newErrors.name = 'Item name is required';
      isValid = false;
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Item name must be at least 2 characters';
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

    if (!formData.location) {
      newErrors.location = 'Location is required';
      isValid = false;
    }

    if (businessUnits.length > 0) {
      if (!selectedBusinessUnitId || selectedBusinessUnitId === 'default') {
        newErrors.businessUnit = 'Please select a valid business unit';
        isValid = false;
      } else {
        const isValidBU = businessUnits.some(bu => bu.id === selectedBusinessUnitId && bu.isActive !== false);
        if (!isValidBU) {
          newErrors.businessUnit = 'Selected business unit is not valid or inactive';
          isValid = false;
        }
      }
    } else {
      newErrors.businessUnit = 'No business units available. Please create one first.';
      isValid = false;
    }

    if (formData.sku && formData.sku.trim().length > 50) {
      newErrors.sku = 'SKU must be less than 50 characters';
      isValid = false;
    }

    if (formData.category && formData.category.trim().length > 50) {
      newErrors.category = 'Category must be less than 50 characters';
      isValid = false;
    }

    if (formData.supplier && formData.supplier.trim().length > 100) {
      newErrors.supplier = 'Supplier name must be less than 100 characters';
      isValid = false;
    }

    if (formData.barcode && isBarcodeValid === false) {
      newErrors.barcode = 'Barcode is already assigned to another product';
      isValid = false;
    }

    if (formData.maxStock && formData.maxStock < formData.minStock) {
      newErrors.maxStock = 'Max stock must be greater than min stock';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  }, [formData, isBarcodeValid, selectedBusinessUnitId, businessUnits]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    
    let parsedValue: any = value;
    if (type === 'number') {
      parsedValue = value === '' ? 0 : parseFloat(value);
    }
    if (type === 'checkbox') {
      parsedValue = (e.target as HTMLInputElement).checked;
    }
    
    if (name === 'name' && autoGenerateSKU && value.trim().length >= 2) {
      const newSKU = generateInventorySKU(value);
      setFormData(prev => ({ 
        ...prev, 
        [name]: parsedValue,
        sku: newSKU
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: parsedValue }));
    }
    
    const error = validateField(name, parsedValue);
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    const error = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const handleBusinessUnitSelect = (buId: string) => {
    const selected = businessUnits.find((bu: BusinessUnitOption) => bu.id === buId);
    if (selected && selected.isActive !== false) {
      setSelectedBusinessUnitId(buId);
      setShowBusinessUnitDropdown(false);
      setErrors((prev: FormErrors) => {
        const newErrors = { ...prev };
        delete newErrors.businessUnit;
        return newErrors;
      });
      setFormData(prev => ({ ...prev, businessUnitId: buId }));
      toast.success(`Selected: ${selected.name}`);
    } else if (selected && selected.isActive === false) {
      toast.error('This business unit is inactive');
    } else {
      toast.error('Invalid business unit selected');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    
    if (!selectedBusinessUnitId || selectedBusinessUnitId === 'default') {
      const errorMsg = 'Please select a valid business unit';
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    const selectedBU = businessUnits.find(bu => bu.id === selectedBusinessUnitId);
    if (!selectedBU || selectedBU.isActive === false) {
      const errorMsg = 'Selected business unit is not valid or inactive';
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    if (!validateForm()) {
      const allTouched: Record<string, boolean> = {};
      Object.keys(formData).forEach(key => { allTouched[key] = true; });
      setTouched(allTouched);
      const firstError = Object.values(errors).find(err => err);
      if (firstError) { toast.error(firstError); } else { toast.error('Please fix all validation errors'); }
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        businessUnitId: selectedBusinessUnitId,
      };
      
      if (formData.name?.trim()) payload.name = formData.name.trim();
      if (formData.sku?.trim()) payload.sku = formData.sku.trim();
      if (formData.unit) payload.unit = formData.unit;
      if (formData.unitPrice !== undefined && formData.unitPrice >= 0) payload.unitPrice = formData.unitPrice;
      if (formData.costPrice !== undefined && formData.costPrice >= 0) payload.costPrice = formData.costPrice;
      if (formData.quantity !== undefined && formData.quantity >= 0) payload.quantity = formData.quantity;
      if (formData.minStock !== undefined && formData.minStock >= 0) payload.minStock = formData.minStock;
      if (formData.maxStock !== undefined && formData.maxStock >= 0) payload.maxStock = formData.maxStock;
      if (formData.location) payload.location = formData.location;
      if (formData.category?.trim()) payload.category = formData.category.trim();
      if (formData.categoryId) payload.categoryId = formData.categoryId;
      if (formData.supplier?.trim()) payload.supplier = formData.supplier.trim();
      if (formData.supplierId) payload.supplierId = formData.supplierId;
      if (formData.notes?.trim()) payload.notes = formData.notes.trim();
      if (formData.description?.trim()) payload.description = formData.description.trim();
      if (formData.barcode?.trim()) payload.barcode = formData.barcode.trim();
      if (formData.weight !== undefined && formData.weight >= 0) payload.weight = formData.weight;
      if (formData.taxRate !== undefined && formData.taxRate >= 0) payload.taxRate = formData.taxRate;
      if (formData.tags?.trim()) {
        payload.tags = formData.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
      }
      if (formData.images && formData.images.length > 0) payload.images = formData.images;
      
      payload.isActive = formData.isActive;
      payload.isDigital = formData.isDigital;
      payload.featured = formData.featured;

      console.log('📤 Updating inventory item:', id, payload);
      
      const result = await inventoryService.updateItem(id as string, payload);
      console.log('✅ Inventory item updated:', result);

      setSuccess(true);
      toast.success('Inventory item updated successfully');
      
      setTimeout(() => {
        router.push(`/admin/inventory/${id}`);
        router.refresh();
      }, 1500);
      
    } catch (error: any) {
      console.error('Error updating inventory item:', error);
      let errorMessage = 'Failed to update inventory item';
      
      if (error?.response?.data) {
        const data = error.response.data;
        if (data.errors && Array.isArray(data.errors)) {
          errorMessage = data.errors.map((err: any) => 
            `${err.field || err.path || 'field'}: ${err.message}`
          ).join(', ');
        } else if (data.message) {
          errorMessage = data.message;
        } else if (data.error) {
          errorMessage = data.error;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => { 
    router.push(`/admin/inventory/${id}`);
  };

  // ============================================
  // HELPERS
  // ============================================

  const getFieldError = (fieldName: keyof FormErrors): string | undefined => {
    return touched[fieldName] ? errors[fieldName] : undefined;
  };

  const getInputClassName = (fieldName: keyof FormErrors): string => {
    const baseClass = "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
    const error = getFieldError(fieldName);
    if (error) return `${baseClass} border-red-500 dark:border-red-500 focus:ring-red-500`;
    return `${baseClass} border-gray-300 dark:border-gray-600`;
  };

  // ============================================
  // RENDER
  // ============================================

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Please Login</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">You need to be logged in to edit inventory items.</p>
          <button onClick={() => router.push('/login')} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading item data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button onClick={handleCancel} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" aria-label="Go back" disabled={submitting}>
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-6 h-6 text-blue-500" />
                Edit Inventory Item
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Update item details and stock information</p>
            </div>
          </div>
          {selectedBusinessUnitId && selectedBusinessUnitId !== 'default' && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 rounded-lg text-sm text-green-700 dark:text-green-300">
              <Building className="w-4 h-4" />
              <span>BU: {businessUnits.find(bu => bu.id === selectedBusinessUnitId)?.name || selectedBusinessUnitId.slice(0, 8)}</span>
            </div>
          )}
        </div>

        {/* BUSINESS UNIT SELECTION */}
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Select Business Unit <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowBusinessUnitDropdown(!showBusinessUnitDropdown)}
                  disabled={loadingBusinessUnits || submitting}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    {loadingBusinessUnits ? (
                      <span className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                      </span>
                    ) : selectedBusinessUnitId && selectedBusinessUnitId !== 'default' ? (
                      <span className="truncate">
                        {businessUnits.find(bu => bu.id === selectedBusinessUnitId)?.name || 'Select Business Unit'}
                      </span>
                    ) : businessUnitError ? (
                      <span className="text-red-500 truncate">{businessUnitError}</span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">Select a business unit</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {selectedBusinessUnitId && selectedBusinessUnitId !== 'default' && (
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                    )}
                    {showBusinessUnitDropdown ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </button>

                {showBusinessUnitDropdown && (
                  <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {loadingBusinessUnits ? (
                      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                        Loading business units...
                      </div>
                    ) : businessUnits.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                        <AlertCircle className="w-5 h-5 mx-auto mb-2 text-yellow-500" />
                        No business units available
                      </div>
                    ) : (
                      businessUnits.map((bu) => {
                        const isActive = bu.isActive !== false;
                        const isSelected = selectedBusinessUnitId === bu.id;
                        
                        return (
                          <button
                            key={bu.id}
                            type="button"
                            onClick={() => handleBusinessUnitSelect(bu.id)}
                            disabled={!isActive}
                            className={`w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-between ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''} ${!isActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium truncate ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                                {bu.name}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                {bu.code && <span>Code: {bu.code}</span>}
                                {bu.type && <span>• {bu.type}</span>}
                                {bu.companyName && <span className="text-indigo-500">• {bu.companyName}</span>}
                                {!isActive && <span className="text-red-500">• Inactive</span>}
                              </div>
                            </div>
                            {isSelected && <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0 ml-2" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
              {getFieldError('businessUnit') && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{getFieldError('businessUnit')}</p>
              )}
            </div>

            {selectedBusinessUnitId && selectedBusinessUnitId !== 'default' && (
              <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-700/30 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-600">
                <p className="text-xs text-gray-500 dark:text-gray-400">Selected Unit</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[150px]">
                  {businessUnits.find(bu => bu.id === selectedBusinessUnitId)?.name || 'Unknown'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Business Unit Warning */}
        {(!selectedBusinessUnitId || selectedBusinessUnitId === 'default') && (
          <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Business Unit Required</p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Please select a business unit from the dropdown above to continue editing inventory items.
              </p>
            </div>
          </div>
        )}

        {/* Success Banner */}
        {success && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-200">Success!</p>
                <p className="text-sm text-green-700 dark:text-green-300">Item updated successfully.</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => router.push(`/admin/inventory/${id}`)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-1">
                <Eye className="w-4 h-4" /> View Item
              </button>
              <button onClick={() => router.push('/admin/inventory')} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm flex items-center gap-1">
                <Package className="w-4 h-4" /> View Inventory
              </button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && !success && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">Error</p>
              <p className="text-sm text-red-700 dark:text-red-300 break-words">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 dark:text-red-400 p-1" aria-label="Dismiss error">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* FORM */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-500" />
              Basic Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Name */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Item Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={getInputClassName('name')}
                  placeholder="Enter item name"
                  disabled={submitting || success}
                />
                {getFieldError('name') && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{getFieldError('name')}</p>
                )}
              </div>

              {/* SKU */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  SKU
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="sku"
                    value={formData.sku}
                    onChange={handleSKUChange}
                    onBlur={handleBlur}
                    className={getInputClassName('sku')}
                    placeholder="Auto-generated"
                    disabled={submitting || success}
                  />
                  <button
                    type="button"
                    onClick={handleRegenerateSKU}
                    disabled={submitting || success || !formData.name}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 flex items-center gap-1"
                    title="Generate SKU from name"
                  >
                    <Wand2 className="w-4 h-4" />
                  </button>
                </div>
                {getFieldError('sku') && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{getFieldError('sku')}</p>
                )}
              </div>

              {/* Unit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Unit <span className="text-red-500">*</span>
                </label>
                <select
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={getInputClassName('unit')}
                  disabled={submitting || success}
                >
                  {UNITS.map(unit => (
                    <option key={unit.value} value={unit.value}>{unit.label}</option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <div className="flex gap-2">
                  <select
                    name="category"
                    value={formData.categoryId || formData.category}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === 'custom') {
                        setIsCustomCategory(true);
                        setFormData(prev => ({ ...prev, category: '', categoryId: '' }));
                      } else {
                        setIsCustomCategory(false);
                        const selected = categories.find(c => c.id === value);
                        setFormData(prev => ({ 
                          ...prev, 
                          category: selected?.name || '', 
                          categoryId: selected?.id || '' 
                        }));
                      }
                      setTouched(prev => ({ ...prev, category: true }));
                    }}
                    className={getInputClassName('category')}
                    disabled={submitting || success || loadingOptions}
                  >
                    <option value="">Select category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                    <option value="custom">+ Add custom category</option>
                  </select>
                  {isCustomCategory && (
                    <input
                      type="text"
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                      placeholder="Enter custom category"
                      disabled={submitting || success}
                    />
                  )}
                </div>
                {getFieldError('category') && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{getFieldError('category')}</p>
                )}
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed resize-y"
                  placeholder="Enter item description"
                  disabled={submitting || success}
                />
              </div>
            </div>
          </div>

          {/* Pricing & Stock */}
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              Pricing & Stock
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Unit Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Unit Price <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    name="unitPrice"
                    value={formData.unitPrice}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    step="0.01"
                    min="0"
                    className={`${getInputClassName('unitPrice')} pl-8`}
                    placeholder="0.00"
                    disabled={submitting || success}
                  />
                </div>
                {getFieldError('unitPrice') && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{getFieldError('unitPrice')}</p>
                )}
              </div>

              {/* Cost Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cost Price
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    name="costPrice"
                    value={formData.costPrice}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    step="0.01"
                    min="0"
                    className={`${getInputClassName('costPrice')} pl-8`}
                    placeholder="0.00"
                    disabled={submitting || success}
                  />
                </div>
                {getFieldError('costPrice') && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{getFieldError('costPrice')}</p>
                )}
              </div>

              {/* Tax Rate */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tax Rate
                </label>
                <select
                  name="taxRate"
                  value={formData.taxRate}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={getInputClassName('taxRate')}
                  disabled={submitting || success}
                >
                  {TAX_RATES.map(rate => (
                    <option key={rate.value} value={rate.value}>{rate.label}</option>
                  ))}
                </select>
                {getFieldError('taxRate') && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{getFieldError('taxRate')}</p>
                )}
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, quantity: Math.max(0, prev.quantity - 1) }))}
                    disabled={submitting || success || formData.quantity <= 0}
                    className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    min="0"
                    className={getInputClassName('quantity')}
                    placeholder="0"
                    disabled={submitting || success}
                  />
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, quantity: prev.quantity + 1 }))}
                    disabled={submitting || success}
                    className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {getFieldError('quantity') && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{getFieldError('quantity')}</p>
                )}
              </div>

              {/* Min Stock */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Min Stock
                </label>
                <input
                  type="number"
                  name="minStock"
                  value={formData.minStock}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  min="0"
                  className={getInputClassName('minStock')}
                  placeholder="5"
                  disabled={submitting || success}
                />
                {getFieldError('minStock') && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{getFieldError('minStock')}</p>
                )}
              </div>

              {/* Max Stock */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Stock
                </label>
                <input
                  type="number"
                  name="maxStock"
                  value={formData.maxStock}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  min="0"
                  className={getInputClassName('maxStock')}
                  placeholder="100"
                  disabled={submitting || success}
                />
                {getFieldError('maxStock') && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{getFieldError('maxStock')}</p>
                )}
              </div>
            </div>
          </div>

          {/* Location & Supplier */}
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-orange-500" />
              Location & Supplier
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Location <span className="text-red-500">*</span>
                </label>
                <select
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={getInputClassName('location')}
                  disabled={submitting || success}
                >
                  {LOCATIONS.map(loc => (
                    <option key={loc.value} value={loc.value}>{loc.label}</option>
                  ))}
                </select>
                {getFieldError('location') && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{getFieldError('location')}</p>
                )}
              </div>

              {/* Supplier */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Supplier
                </label>
                <div className="flex gap-2">
                  <select
                    name="supplier"
                    value={formData.supplierId || formData.supplier}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === 'custom') {
                        setIsCustomSupplier(true);
                        setFormData(prev => ({ ...prev, supplier: '', supplierId: '' }));
                      } else {
                        setIsCustomSupplier(false);
                        const selected = suppliers.find(s => s.id === value);
                        setFormData(prev => ({ 
                          ...prev, 
                          supplier: selected?.name || '', 
                          supplierId: selected?.id || '' 
                        }));
                      }
                      setTouched(prev => ({ ...prev, supplier: true }));
                    }}
                    className={getInputClassName('supplier')}
                    disabled={submitting || success || loadingOptions}
                  >
                    <option value="">Select supplier</option>
                    {suppliers.map(sup => (
                      <option key={sup.id} value={sup.id}>{sup.name}</option>
                    ))}
                    <option value="custom">+ Add custom supplier</option>
                  </select>
                  {isCustomSupplier && (
                    <input
                      type="text"
                      name="supplier"
                      value={formData.supplier}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                      placeholder="Enter custom supplier"
                      disabled={submitting || success}
                    />
                  )}
                </div>
                {getFieldError('supplier') && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{getFieldError('supplier')}</p>
                )}
              </div>
            </div>
          </div>

          {/* Barcode & Additional Info */}
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Barcode className="w-5 h-5 text-purple-500" />
              Barcode & Additional Info
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Barcode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Barcode
                </label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="text"
                      name="barcode"
                      value={formData.barcode}
                      onChange={(e) => handleBarcodeChange(e.target.value)}
                      onBlur={handleBlur}
                      className={getInputClassName('barcode')}
                      placeholder="Enter barcode or generate"
                      disabled={submitting || success}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateBarcode}
                    disabled={generatingBarcode || submitting || success || !formData.name}
                    className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-1 whitespace-nowrap"
                  >
                    {generatingBarcode ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Wand2 className="w-4 h-4" />
                    )}
                    Generate
                  </button>
                </div>
                {getFieldError('barcode') && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{getFieldError('barcode')}</p>
                )}
                {isBarcodeValid === false && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">Barcode is already in use</p>
                )}
                {isBarcodeValid === true && formData.barcode && (
                  <p className="mt-1 text-sm text-green-600 dark:text-green-400">✓ Barcode is available</p>
                )}
                {checkingBarcode && (
                  <p className="mt-1 text-sm text-gray-500 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Checking barcode...
                  </p>
                )}
              </div>

              {/* Weight */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  name="weight"
                  value={formData.weight}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  step="0.01"
                  min="0"
                  className={getInputClassName('weight')}
                  placeholder="0.00"
                  disabled={submitting || success}
                />
                {getFieldError('weight') && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{getFieldError('weight')}</p>
                )}
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tags
              </label>
              <input
                type="text"
                name="tags"
                value={formData.tags}
                onChange={handleChange}
                onBlur={handleBlur}
                className={getInputClassName('tags')}
                placeholder="Enter tags separated by commas (e.g., electronics, new, featured)"
                disabled={submitting || success}
              />
              {getFieldError('tags') && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{getFieldError('tags')}</p>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Separate multiple tags with commas</p>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                onBlur={handleBlur}
                rows={2}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed resize-y"
                placeholder="Additional notes about this item"
                disabled={submitting || success}
              />
            </div>
          </div>

          {/* Status Toggles */}
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Archive className="w-5 h-5 text-indigo-500" />
              Status
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Active */}
              <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600/30 transition-colors">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                  disabled={submitting || success}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Active</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Item is available for sale</p>
                </div>
              </label>

              {/* Featured */}
              <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600/30 transition-colors">
                <input
                  type="checkbox"
                  name="featured"
                  checked={formData.featured}
                  onChange={handleChange}
                  disabled={submitting || success}
                  className="w-4 h-4 text-yellow-500 rounded focus:ring-2 focus:ring-yellow-500 disabled:opacity-50"
                />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-500" /> Featured
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Show in featured section</p>
                </div>
              </label>

              {/* Digital */}
              <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600/30 transition-colors">
                <input
                  type="checkbox"
                  name="isDigital"
                  checked={formData.isDigital}
                  onChange={handleChange}
                  disabled={submitting || success}
                  className="w-4 h-4 text-green-500 rounded focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                    <Globe className="w-4 h-4 text-green-500" /> Digital
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Digital product (no shipping)</p>
                </div>
              </label>
            </div>
          </div>

          {/* Barcode Display */}
          {barcodeInfo && barcodeInfo.isGenerated && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {barcodeInfo.barcodeUrl && (
                      <img src={barcodeInfo.barcodeUrl} alt="Barcode" className="h-12" />
                    )}
                    {barcodeInfo.qrCodeUrl && (
                      <img src={barcodeInfo.qrCodeUrl} alt="QR Code" className="h-12" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Barcode: {barcodeInfo.barcode}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Generated on {new Date().toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCopyBarcode}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadBarcode}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
                    >
                      <Download className="w-4 h-4" /> Download
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintBarcode}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
                    >
                      <Printer className="w-4 h-4" /> Print
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleCancel}
              disabled={submitting || success}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 w-full sm:w-auto text-center disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || success || !selectedBusinessUnitId || selectedBusinessUnitId === 'default' || businessUnits.length === 0}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : success ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Updated!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Update Item
                </>
              )}
            </button>
          </div>

          {/* Form Footer Info */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700">
            <span className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${
                selectedBusinessUnitId && selectedBusinessUnitId !== 'default' ? 'bg-green-500' : 'bg-yellow-500'
              }`} />
              {selectedBusinessUnitId && selectedBusinessUnitId !== 'default' ? 'Business unit selected' : 'Select business unit'}
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle className={`w-3 h-3 ${formData.name ? 'text-green-500' : 'text-gray-400'}`} />
              {formData.name ? 'Name provided' : 'Name required'}
            </span>
            <span>
              ID: {id?.slice(0, 8)}...
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
