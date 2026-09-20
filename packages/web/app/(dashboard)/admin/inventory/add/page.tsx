// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\inventory\add\page.tsx

'use client';

import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermission } from '../../../../../hooks/usePermission';
import { inventoryService } from '../../../../../services/inventoryService';
import { barcodeService } from '../../../../../services/barcodeService';
import { companyService } from '../../../../../services/companyService';
import { locationService } from '../../../../../services/locationService';
import { toast } from '../../../../../utils/toast-manager';
import {
  ArrowLeft,
  Package,
  Save,
  Loader2,
  AlertCircle,
  DollarSign,
  Tag,
  MapPin,
  Lock,
  Info,
  CheckCircle,
  X,
  Plus,
  Building,
  Eye,
  Barcode,
  QrCode,
  RefreshCw,
  Copy,
  Check,
  Download,
  Printer,
  AlertTriangle,
  Layers,
  Wand2,
  Database,
  ChevronDown,
  ChevronUp,
  Building2,
  ExternalLink,
  FolderTree,
} from 'lucide-react';
import { api } from '../../../../../services/api';

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
  locationId?: string;
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
  qrData?: Record<string, any>;
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

interface LocationOption {
  id: string;
  name: string;
  isDefault?: boolean;
  isActive?: boolean;
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

const FALLBACK_LOCATIONS = [
  { value: 'Warehouse', label: 'Warehouse' },
  { value: 'Storefront', label: 'Storefront' },
  { value: 'Backroom', label: 'Backroom' },
  { value: 'In Transit', label: 'In Transit' },
  { value: 'Distribution Center', label: 'Distribution Center' },
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

const SENTINEL_BUSINESS_UNIT_IDS = new Set([
  'default',
  'default-business-unit',
  'undefined',
  'null',
  '',
]);

const SENTINEL_LOCATION_VALUES = new Set([
  '',
  'undefined',
  'null',
  'default',
]);

// ----- Canonical admin create-page routes -----
const SUPPLIER_CREATE_ROUTE = '/admin/suppliers/create';
const LOCATION_CREATE_ROUTE = '/admin/locations/create';
const CATEGORY_CREATE_ROUTE = '/admin/categories/create';

// Query-param names used to preselect the newly created entity when
// the user returns from its create page.
const PRESELECT_CATEGORY_PARAM = 'preselectCategoryId';
const PRESELECT_SUPPLIER_PARAM = 'preselectSupplierId';
const PRESELECT_LOCATION_PARAM = 'preselectLocationId';

// ============================================
// HELPERS
// ============================================

function generateInventorySKU(itemName: string): string {
  if (!itemName || itemName.trim().length === 0) return '';

  const prefix =
    itemName
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 3)
      .toUpperCase() || 'INV';

  const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();

  return `${prefix}-${timestamp}-${random}`;
}

function isValidBusinessUnitId(id: string | null | undefined): id is string {
  if (!id) return false;
  return !SENTINEL_BUSINESS_UNIT_IDS.has(id);
}

function isValidLocationValue(
  value: string | null | undefined,
): value is string {
  if (!value) return false;
  return !SENTINEL_LOCATION_VALUES.has(value);
}

/**
 * Unwrap a service response that may come back in any of these shapes:
 *   - the raw payload               { barcode: "..." }
 *   - a data-enveloped payload      { data: { barcode: "..." } }
 *   - a success envelope            { success: true, data: { barcode: "..." } }
 */
function unwrapPayload<T = any>(response: any): T | null {
  if (!response) return null;
  if (typeof response !== 'object') return response as T;
  if ('data' in response && response.data !== undefined) return response.data;
  return response as T;
}

/**
 * Validate a barcode string. Returns the reason it's invalid, or null
 * if it's usable.
 */
function validateBarcodeString(value: unknown): string | null {
  if (value === undefined || value === null) {
    return 'Barcode was not returned by the server';
  }
  if (typeof value !== 'string') {
    return 'Barcode is not a string';
  }
  const trimmed = value.trim();
  if (!trimmed) return 'Barcode is empty';
  if (/^(nan|undefined|null)$/i.test(trimmed)) {
    return `Barcode is invalid: "${trimmed}"`;
  }
  return null;
}

/**
 * Build the QR payload the same way the backend does.
 */
function buildQrData(args: {
  formData: InventoryFormData;
  barcode: string;
  inventoryId?: string;
  productId?: string;
}): Record<string, any> {
  const { formData, barcode, inventoryId, productId } = args;
  return {
    type: 'INVENTORY_ITEM',
    id: inventoryId || '',
    productId: productId || '',
    name: formData.name || 'Unknown',
    sku: formData.sku || 'N/A',
    barcode,
    location: formData.location || 'Warehouse',
    quantity: Number(formData.quantity) || 0,
    minStock: Number(formData.minStock) || 5,
    description: formData.description || '',
    weight: Number(formData.weight) || 0,
    taxRate: Number(formData.taxRate) || 0,
    tags: formData.tags
      ? formData.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [],
    timestamp: new Date().toISOString(),
  };
}

function buildQrCodeUrl(qrData: Record<string, any>): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
    JSON.stringify(qrData),
  )}`;
}

function buildBarcodeUrl(barcode: string): string {
  return `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(
    barcode,
  )}&code=EAN-13&dpi=96`;
}

/**
 * Build a URL to a "create" page carrying a `returnTo` query param so
 * the target page can navigate the user back here after creation.
 */
function buildCreateUrl(basePath: string): string {
  if (typeof window === 'undefined') return basePath;
  const returnTo = window.location.pathname + window.location.search;
  return `${basePath}?returnTo=${encodeURIComponent(returnTo)}`;
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function AddInventoryItemPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const {
    isLoading: permLoading,
    isSuperAdmin,
    canCreateInventory,
    getBusinessUnits: getBusinessUnitsFromHook,
    getCurrentBusinessUnit,
  } = usePermission();

  // ────────────────────────────────────────────────────────────
  // State
  // ────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [createdItemId, setCreatedItemId] = useState<string | null>(null);

  // Business Unit
  const [businessUnits, setBusinessUnits] = useState<BusinessUnitOption[]>([]);
  const [selectedBusinessUnitId, setSelectedBusinessUnitId] = useState('');
  const [loadingBusinessUnits, setLoadingBusinessUnits] = useState(true);
  const [showBusinessUnitDropdown, setShowBusinessUnitDropdown] =
    useState(false);
  const [businessUnitError, setBusinessUnitError] = useState<string | null>(
    null,
  );

  // Barcode / QR
  const [generatingBarcode, setGeneratingBarcode] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [barcodeInfo, setBarcodeInfo] = useState<BarcodeInfo | null>(null);
  const [isBarcodeValid, setIsBarcodeValid] = useState<boolean | null>(null);
  const [checkingBarcode, setCheckingBarcode] = useState(false);
  const [barcodeSource, setBarcodeSource] = useState<
    'manual' | 'generated' | null
  >(null);

  // Options
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const [autoGenerateSKU, setAutoGenerateSKU] = useState(true);
  const [autoGenerateCodes, setAutoGenerateCodes] = useState(true);

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
    locationId: '',
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

  const booting = authLoading || permLoading;

  // Guards against re-applying the preselect effect after the user
  // manually clears a selection. We only consume each preselect param
  // once per mount.
  const consumedPreselectRef = useRef<Set<string>>(new Set());

  // ────────────────────────────────────────────────────────────
  // Seed BU from usePermission
  // ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (booting) return;
    if (!isAuthenticated) return;

    const hookUnits = getBusinessUnitsFromHook();
    const hookCurrent = getCurrentBusinessUnit();

    if (Array.isArray(hookUnits) && hookUnits.length > 0) {
      const mapped: BusinessUnitOption[] = hookUnits
        .filter((bu: any) => isValidBusinessUnitId(bu?.id))
        .map((bu: any) => ({
          id: bu.id,
          name: bu.name || 'Unnamed Business Unit',
          code: bu.code || '',
          type: bu.type || '',
          isActive: bu.isActive !== false,
          companyId: bu.companyId || undefined,
          companyName: bu.companyName || undefined,
        }));

      if (mapped.length > 0) {
        setBusinessUnits(mapped);

        const preferred =
          (hookCurrent && mapped.find((u) => u.id === hookCurrent.id)) ||
          mapped.find((u) => u.isActive !== false) ||
          mapped[0];

        if (preferred) {
          setSelectedBusinessUnitId(preferred.id);
          setFormData((prev) => ({
            ...prev,
            businessUnitId: preferred.id,
          }));
          try {
            localStorage.setItem('businessUnitId', preferred.id);
          } catch {
            /* ignore */
          }
        }

        setLoadingBusinessUnits(false);
        return;
      }
    }

    fetchBusinessUnitsLegacy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booting, isAuthenticated]);

  // ────────────────────────────────────────────────────────────
  // Preselect supplier / location / category on return from
  // their respective create pages.
  //
  // Each param is consumed at most once per mount, so the user can
  // clear their selection without the effect fighting them. The
  // preselect only lands once the options are loaded, because the
  // match needs the option list.
  // ────────────────────────────────────────────────────────────
  useEffect(() => {
    const preselectCategory = searchParams?.get(PRESELECT_CATEGORY_PARAM);
    const preselectSupplier = searchParams?.get(PRESELECT_SUPPLIER_PARAM);
    const preselectLocation = searchParams?.get(PRESELECT_LOCATION_PARAM);

    // Category — needs the categories list to resolve the name.
    if (
      preselectCategory &&
      !consumedPreselectRef.current.has(`cat:${preselectCategory}`) &&
      categories.length > 0
    ) {
      const match = categories.find((c) => c.id === preselectCategory);
      if (match) {
        setFormData((prev) => ({
          ...prev,
          categoryId: match.id,
          category: match.name,
        }));
        consumedPreselectRef.current.add(`cat:${preselectCategory}`);
      }
    }

    // Supplier — same pattern.
    if (
      preselectSupplier &&
      !consumedPreselectRef.current.has(`sup:${preselectSupplier}`) &&
      suppliers.length > 0
    ) {
      const match = suppliers.find((s) => s.id === preselectSupplier);
      if (match) {
        setFormData((prev) => ({
          ...prev,
          supplierId: match.id,
          supplier: match.name,
        }));
        consumedPreselectRef.current.add(`sup:${preselectSupplier}`);
      }
    }

    // Location — match by id, but store name too.
    if (
      preselectLocation &&
      !consumedPreselectRef.current.has(`loc:${preselectLocation}`) &&
      locations.length > 0
    ) {
      const match = locations.find((l) => l.id === preselectLocation);
      if (match) {
        setFormData((prev) => ({
          ...prev,
          locationId: match.id,
          location: match.name,
        }));
        consumedPreselectRef.current.add(`loc:${preselectLocation}`);
      }
    }
  }, [searchParams, categories.length, suppliers.length, locations.length]);

  // ============================================
  // BUSINESS UNIT LOADING
  // ============================================

  const fetchBusinessUnitsLegacy = useCallback(async () => {
    setLoadingBusinessUnits(true);
    setBusinessUnitError(null);

    try {
      let units: BusinessUnitOption[] = [];

      try {
        const response = await api.get('/business-units');
        let data = response;

        if (data && typeof data === 'object') {
          if ('success' in data && (data as any).success && 'data' in data) {
            data = (data as any).data;
          } else if ('data' in data) {
            data = (data as any).data;
          }
        }

        if (Array.isArray(data) && data.length > 0) {
          units = data
            .filter((bu: any) => isValidBusinessUnitId(bu?.id))
            .map((bu: any) => ({
              id: bu.id,
              name: bu.name || 'Unnamed Business Unit',
              code: bu.code || '',
              type: bu.type || '',
              isActive: bu.isActive !== false,
              companyId: bu.companyId || bu.company?.id || undefined,
              companyName: bu.company?.name || undefined,
            }));
        }
      } catch (apiError) {
        console.warn('[inventory/add] /business-units failed:', apiError);
      }

      if (units.length === 0) {
        try {
          const companies = await companyService.getAll({ limit: 100 });
          if (companies && companies.data && Array.isArray(companies.data)) {
            for (const company of companies.data) {
              if (
                company.businessUnits &&
                Array.isArray(company.businessUnits)
              ) {
                company.businessUnits.forEach((bu: any) => {
                  if (isValidBusinessUnitId(bu?.id)) {
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
          }
        } catch (companyError) {
          console.warn('[inventory/add] companyService failed:', companyError);
        }
      }

      if (units.length === 0) {
        try {
          const userAny = user as any;
          if (userAny?.businessUnits && Array.isArray(userAny.businessUnits)) {
            userAny.businessUnits.forEach((bu: any) => {
              const id = bu.businessUnitId || bu.id || bu;
              const name =
                bu.businessUnit?.name ||
                bu.name ||
                bu.businessUnitName ||
                'Unnamed Business Unit';
              const code = bu.businessUnit?.code || bu.code || '';
              const type = bu.businessUnit?.type || bu.type || '';
              const isActive =
                bu.businessUnit?.isActive !== undefined
                  ? bu.businessUnit.isActive
                  : bu.isActive !== undefined
                    ? bu.isActive
                    : true;

              if (isValidBusinessUnitId(id)) {
                units.push({
                  id,
                  name,
                  code,
                  type,
                  isActive,
                  companyId: bu.businessUnit?.companyId || undefined,
                });
              }
            });
          }
        } catch (userError) {
          console.warn('[inventory/add] user context failed:', userError);
        }
      }

      if (units.length === 0) {
        try {
          const stored = localStorage.getItem('businessUnits');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              units = parsed.filter((bu: any) => isValidBusinessUnitId(bu?.id));
            }
          }
        } catch (storageError) {
          console.warn('[inventory/add] localStorage failed:', storageError);
        }
      }

      if (units.length === 0) {
        const defaultBU =
          typeof window !== 'undefined'
            ? localStorage.getItem('businessUnitId')
            : null;
        if (isValidBusinessUnitId(defaultBU)) {
          units.push({
            id: defaultBU,
            name: 'Default Business Unit',
            code: 'DEFAULT',
            type: 'STORE',
            isActive: true,
          });
        }
      }

      const uniqueUnits = units.filter(
        (unit, index, self) =>
          index === self.findIndex((u) => u.id === unit.id),
      );

      setBusinessUnits(uniqueUnits);

      if (uniqueUnits.length > 0) {
        const activeUnit =
          uniqueUnits.find((bu) => bu.isActive !== false) || uniqueUnits[0];
        setSelectedBusinessUnitId(activeUnit.id);
        setFormData((prev) => ({
          ...prev,
          businessUnitId: activeUnit.id,
        }));
        try {
          localStorage.setItem('businessUnitId', activeUnit.id);
        } catch {
          /* ignore */
        }
      } else {
        setBusinessUnitError(
          'No business units available. Please create a business unit first.',
        );
        toast.warning('No business units available');
      }
    } catch (err) {
      console.error('[inventory/add] fetchBusinessUnitsLegacy failed:', err);
      setBusinessUnitError('Failed to load business units. Please refresh.');
      toast.error('Failed to load business units');
    } finally {
      setLoadingBusinessUnits(false);
    }
  }, [user]);

  // ============================================
  // LOAD CATEGORIES / SUPPLIERS / LOCATIONS
  // ============================================

  const loadOptions = useCallback(async (buId: string) => {
    if (!isValidBusinessUnitId(buId)) {
      setLoadingOptions(false);
      return;
    }

    setLoadingOptions(true);

    try {
      let categoriesLoaded = false;

      try {
        const categoriesData = await inventoryService.getCategories(buId);
        if (Array.isArray(categoriesData) && categoriesData.length > 0) {
          setCategories(
            categoriesData.map((cat: any) => ({
              id: cat.id || cat.categoryId || cat.category,
              name: cat.name || cat.category || 'Uncategorized',
            })),
          );
          categoriesLoaded = true;
        }
      } catch (e) {
        console.warn('[inventory/add] getCategories failed:', e);
      }

      if (!categoriesLoaded) {
        try {
          const summaryData = await inventoryService.getCategorySummary(buId);
          if (Array.isArray(summaryData) && summaryData.length > 0) {
            setCategories(
              summaryData.map((cat: any) => ({
                id: cat.id || cat.categoryId || cat.category,
                name: cat.name || cat.category || 'Uncategorized',
              })),
            );
            categoriesLoaded = true;
          }
        } catch (e) {
          console.warn('[inventory/add] getCategorySummary failed:', e);
        }
      }

      if (!categoriesLoaded) setCategories([]);

      let suppliersLoaded = false;

      try {
        const suppliersData = await inventoryService.getSuppliers(buId);
        if (Array.isArray(suppliersData) && suppliersData.length > 0) {
          setSuppliers(
            suppliersData.map((sup: any) => ({
              id: sup.id,
              name: sup.name,
            })),
          );
          suppliersLoaded = true;
        }
      } catch (e) {
        console.warn('[inventory/add] getSuppliers failed:', e);
      }

      if (!suppliersLoaded) setSuppliers([]);

      let locationsLoaded = false;

      try {
        const locationsData = await locationService.list(buId);
        if (Array.isArray(locationsData) && locationsData.length > 0) {
          setLocations(
            locationsData.map((loc: any) => ({
              id: loc.id,
              name: loc.name,
              isDefault: loc.isDefault,
              isActive: loc.isActive !== false,
            })),
          );
          locationsLoaded = true;

          setFormData((prev) => {
            if (
              isValidLocationValue(prev.location) &&
              prev.location !== 'Warehouse'
            ) {
              return prev;
            }
            const def =
              locationsData.find((l: any) => l.isDefault) ||
              locationsData.find((l: any) => l.isActive !== false) ||
              locationsData[0];
            if (!def) return prev;
            return { ...prev, location: def.name, locationId: def.id };
          });
        }
      } catch (e) {
        console.warn('[inventory/add] locationService.list failed:', e);
      }

      if (!locationsLoaded) {
        setLocations(
          FALLBACK_LOCATIONS.map((l) => ({ id: l.value, name: l.value })),
        );
      }
    } catch (err) {
      console.error('[inventory/add] loadOptions error:', err);
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  useEffect(() => {
    if (isValidBusinessUnitId(selectedBusinessUnitId)) {
      setCategories([]);
      setSuppliers([]);
      setLocations([]);
      loadOptions(selectedBusinessUnitId);

      setFormData((prev) => ({
        ...prev,
        businessUnitId: selectedBusinessUnitId,
      }));

      try {
        localStorage.setItem('businessUnitId', selectedBusinessUnitId);
      } catch {
        /* ignore */
      }
    }
  }, [selectedBusinessUnitId, loadOptions]);

  // ============================================
  // BARCODE + QR HELPERS
  // ============================================

  const checkBarcodeUniqueness = useCallback(
    async (barcode: string): Promise<boolean> => {
      if (!barcode || barcode.length < 3) return true;

      setCheckingBarcode(true);
      try {
        const result = await import(
          '../../../../../services/productService'
        ).then((m) => m.productService.validateBarcode(barcode));

        if (result && !result.valid) {
          setIsBarcodeValid(false);
          setErrors((prev) => ({
            ...prev,
            barcode:
              result.message ||
              'This barcode is already assigned to another product',
          }));
          return false;
        }

        setIsBarcodeValid(true);
        setErrors((prev) => {
          const next = { ...prev };
          delete next.barcode;
          return next;
        });
        return true;
      } catch (err: any) {
        if (err?.response?.status === 404 || err?.status === 404) {
          setIsBarcodeValid(true);
          setErrors((prev) => {
            const next = { ...prev };
            delete next.barcode;
            return next;
          });
          return true;
        }
        console.error('[inventory/add] barcode check failed:', err);
        return true;
      } finally {
        setCheckingBarcode(false);
      }
    },
    [],
  );

  const buildBarcodeInfo = useCallback(
    async (
      barcode: string,
      formSnapshot: InventoryFormData,
    ): Promise<BarcodeInfo> => {
      try {
        const [barcodeImageRaw, qrCodeRaw] = await Promise.all([
          barcodeService.generateBarcodeImage(barcode),
          barcodeService.generateQRCode({
            itemName: formSnapshot.name,
            sku: formSnapshot.sku,
            price: formSnapshot.unitPrice,
            barcode,
            type: 'INVENTORY_ITEM',
          }),
        ]);

        const barcodeImage = unwrapPayload<{ barcodeUrl?: string }>(
          barcodeImageRaw,
        );
        const qrCode = unwrapPayload<{ qrCodeUrl?: string }>(qrCodeRaw);

        const barcodeUrl =
          barcodeImage?.barcodeUrl || buildBarcodeUrl(barcode);
        const qrCodeUrl =
          qrCode?.qrCodeUrl ||
          buildQrCodeUrl(buildQrData({ formData: formSnapshot, barcode }));

        return {
          barcode,
          barcodeUrl,
          qrCodeUrl,
          qrData: buildQrData({ formData: formSnapshot, barcode }),
          isGenerated: true,
        };
      } catch (err) {
        console.warn(
          '[inventory/add] barcode service image render failed, using fallback URLs:',
          err,
        );
        return {
          barcode,
          barcodeUrl: buildBarcodeUrl(barcode),
          qrCodeUrl: buildQrCodeUrl(
            buildQrData({ formData: formSnapshot, barcode }),
          ),
          qrData: buildQrData({ formData: formSnapshot, barcode }),
          isGenerated: true,
        };
      }
    },
    [],
  );

  const handleGenerateBarcode = async () => {
    if (!formData.name) {
      toast.error('Please enter an item name first');
      return;
    }

    setGeneratingBarcode(true);
    try {
      const raw = await barcodeService.generateUniqueBarcode({
        prefix: 'INV',
        length: 12,
        productName: formData.name,
        sku: formData.sku || undefined,
      });

      const payload = unwrapPayload<{ barcode?: string }>(raw);
      const candidate =
        payload?.barcode ?? (raw as any)?.barcode ?? null;

      const validationError = validateBarcodeString(candidate);
      if (validationError) {
        console.warn(
          '[inventory/add] barcode service returned invalid value, falling back:',
          candidate,
          validationError,
        );
        const fallback = `INV-${Date.now().toString(36)
          .toUpperCase()
          .slice(-8)}-${Math.random()
          .toString(36)
          .substring(2, 5)
          .toUpperCase()}`;

        const info = await buildBarcodeInfo(fallback, formData);
        setFormData((prev) => ({ ...prev, barcode: fallback }));
        setBarcodeInfo(info);
        setBarcodeSource('generated');
        setIsBarcodeValid(true);
        setShowBarcode(true);
        toast.success(
          'Barcode generated locally (server returned an invalid value)',
        );
        return;
      }

      const barcode = candidate as string;
      const info = await buildBarcodeInfo(barcode, formData);

      setFormData((prev) => ({ ...prev, barcode }));
      setBarcodeInfo(info);
      setBarcodeSource('generated');
      setIsBarcodeValid(true);
      setShowBarcode(true);
      toast.success('Barcode and QR code generated successfully');
    } catch (err: any) {
      console.error('[inventory/add] barcode generation failed:', err);
      toast.error(err?.message || 'Failed to generate barcode');
      setIsBarcodeValid(false);
    } finally {
      setGeneratingBarcode(false);
    }
  };

  const handleBarcodeChange = async (value: string) => {
    const cleanValue = value.toUpperCase().trim();
    setFormData((prev) => ({ ...prev, barcode: cleanValue }));
    setBarcodeSource('manual');

    if (cleanValue.length >= 4) {
      await checkBarcodeUniqueness(cleanValue);
    } else {
      setIsBarcodeValid(null);
    }

    if (!cleanValue) {
      setBarcodeInfo(null);
      setShowBarcode(false);
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

    const escapeHtml = (s: string) =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const safeName = escapeHtml(formData.name || 'Product');
    const safeSku = escapeHtml(formData.sku || 'N/A');
    const safeBarcode = escapeHtml(barcodeInfo.barcode);
    const safeLocation = escapeHtml(formData.location || 'Warehouse');

    printWindow.document.write(`
      <html>
        <head>
          <title>Barcode - ${safeName}</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: white; }
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
            <h2 class="product-name">${safeName}</h2>
            <p class="sku">SKU: ${safeSku}</p>
            ${
              barcodeInfo.barcodeUrl
                ? `<img src="${barcodeInfo.barcodeUrl}" alt="Barcode" class="barcode-img" />`
                : ''
            }
            ${
              barcodeInfo.qrCodeUrl
                ? `<img src="${barcodeInfo.qrCodeUrl}" alt="QR Code" class="qr-img" />`
                : ''
            }
            <div class="info">
              <p><span class="label">Barcode:</span> <span class="value">${safeBarcode}</span></p>
              <p><span class="label">Price:</span> <span class="value">$${formData.unitPrice.toFixed(2)}</span></p>
              <p><span class="label">Stock:</span> <span class="value">${formData.quantity}</span></p>
              <p><span class="label">Location:</span> <span class="value">${safeLocation}</span></p>
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

  const handleDownloadQRCode = () => {
    if (!barcodeInfo?.qrCodeUrl) return;
    const link = document.createElement('a');
    link.href = barcodeInfo.qrCodeUrl;
    link.download = `qrcode-${formData.sku || formData.barcode}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('QR code downloaded');
  };

  // ============================================
  // SKU HANDLERS
  // ============================================

  const handleRegenerateSKU = useCallback(() => {
    if (formData.name && formData.name.trim().length >= 2) {
      const newSKU = generateInventorySKU(formData.name);
      setFormData((prev) => ({ ...prev, sku: newSKU }));
      setAutoGenerateSKU(true);
      toast.success('SKU regenerated');
    } else {
      toast.warning('Please enter an item name first');
    }
  }, [formData.name]);

  const handleSKUChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setTouched((prev) => ({ ...prev, sku: true }));

    if (autoGenerateSKU && value.trim().length > 0) {
      setAutoGenerateSKU(false);
    }

    setFormData((prev) => ({ ...prev, sku: value.toUpperCase() }));
    const error = validateField('sku', value);
    setErrors((prev) => ({ ...prev, sku: error }));
  };

  // ============================================
  // VALIDATION
  // ============================================

  const validateField = useCallback(
    (name: string, value: any): string | undefined => {
      switch (name) {
        case 'name':
          if (!value || value.trim() === '') return 'Item name is required';
          if (value.trim().length < 2)
            return 'Item name must be at least 2 characters';
          if (value.trim().length > 100)
            return 'Item name must be less than 100 characters';
          return undefined;
        case 'sku':
          if (value && value.trim().length > 50)
            return 'SKU must be less than 50 characters';
          return undefined;
        case 'category':
          if (value && value.trim().length > 50)
            return 'Category must be less than 50 characters';
          return undefined;
        case 'quantity': {
          const qty = Number(value);
          if (isNaN(qty)) return 'Quantity must be a number';
          if (qty < 0) return 'Quantity cannot be negative';
          if (qty > 999999) return 'Quantity is too large';
          return undefined;
        }
        case 'unitPrice': {
          const price = Number(value);
          if (isNaN(price)) return 'Unit price must be a number';
          if (price < 0) return 'Unit price cannot be negative';
          if (price > 999999) return 'Unit price is too large';
          return undefined;
        }
        case 'costPrice': {
          const cost = Number(value);
          if (isNaN(cost)) return 'Cost price must be a number';
          if (cost < 0) return 'Cost price cannot be negative';
          if (cost > 999999) return 'Cost price is too large';
          return undefined;
        }
        case 'minStock': {
          const min = Number(value);
          if (isNaN(min)) return 'Min stock must be a number';
          if (min < 0) return 'Min stock cannot be negative';
          if (min > 999999) return 'Min stock is too large';
          return undefined;
        }
        case 'maxStock': {
          const max = Number(value);
          if (isNaN(max)) return 'Max stock must be a number';
          if (max < 0) return 'Max stock cannot be negative';
          if (max > 999999) return 'Max stock is too large';
          if (max < formData.minStock)
            return 'Max stock must be greater than min stock';
          return undefined;
        }
        case 'location':
          if (!value || String(value).trim().length === 0)
            return 'Location is required';
          return undefined;
        case 'supplier':
          if (value && value.trim().length > 100)
            return 'Supplier name must be less than 100 characters';
          return undefined;
        case 'barcode':
          if (value && value.trim().length > 50)
            return 'Barcode must be less than 50 characters';
          return undefined;
        case 'weight': {
          const weight = Number(value);
          if (isNaN(weight)) return 'Weight must be a number';
          if (weight < 0) return 'Weight cannot be negative';
          return undefined;
        }
        case 'taxRate': {
          const tax = Number(value);
          if (isNaN(tax)) return 'Tax rate must be a number';
          if (tax < 0 || tax > 100)
            return 'Tax rate must be between 0 and 100';
          return undefined;
        }
        default:
          return undefined;
      }
    },
    [formData.minStock],
  );

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
    if (!formData.location || formData.location.trim().length === 0) {
      newErrors.location = 'Location is required';
      isValid = false;
    }

    if (businessUnits.length > 0) {
      if (!isValidBusinessUnitId(selectedBusinessUnitId)) {
        newErrors.businessUnit = 'Please select a valid business unit';
        isValid = false;
      } else {
        const isValidBU = businessUnits.some(
          (bu) => bu.id === selectedBusinessUnitId && bu.isActive !== false,
        );
        if (!isValidBU) {
          newErrors.businessUnit =
            'Selected business unit is not valid or inactive';
          isValid = false;
        }
      }
    } else {
      newErrors.businessUnit =
        'No business units available. Please create one first.';
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
  // CHANGE HANDLERS
  // ============================================

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));

    let parsedValue: any = value;
    if (type === 'number') {
      parsedValue = value === '' ? 0 : parseFloat(value);
    }
    if (type === 'checkbox') {
      parsedValue = (e.target as HTMLInputElement).checked;
    }

    if (name === 'name' && autoGenerateSKU && value.trim().length >= 2) {
      const newSKU = generateInventorySKU(value);
      setFormData((prev) => ({ ...prev, [name]: parsedValue, sku: newSKU }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: parsedValue }));
    }

    const error = validateField(name, parsedValue);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleBlur = (
    e: React.FocusEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const error = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleBusinessUnitSelect = (buId: string) => {
    const selected = businessUnits.find((bu) => bu.id === buId);
    if (selected && selected.isActive !== false) {
      setSelectedBusinessUnitId(buId);
      setShowBusinessUnitDropdown(false);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.businessUnit;
        return next;
      });
      toast.success(`Selected: ${selected.name}`);
    } else if (selected && selected.isActive === false) {
      toast.error('This business unit is inactive');
    } else {
      toast.error('Invalid business unit selected');
    }
  };

  // ============================================
  // "ADD NEW" NAVIGATION
  // ============================================
  //
  // These navigate to the canonical create pages. `returnTo` lets the
  // target page send the user back here; the preselect query param
  // lets us auto-select the newly created entity once the user is
  // back and the option list is loaded.

  const handleAddNewSupplier = () => {
    const url = buildCreateUrl(SUPPLIER_CREATE_ROUTE);
    console.log('[inventory/add] Navigating to add supplier:', url);
    router.push(url);
  };

  const handleAddNewLocation = () => {
    const url = buildCreateUrl(LOCATION_CREATE_ROUTE);
    console.log('[inventory/add] Navigating to add location:', url);
    router.push(url);
  };

  /**
   * Navigate to the canonical category create page. The modern form
   * there covers everything the inline "custom category" flow could
   * not: slug, image, icon, color, sortOrder, parent, meta fields.
   * The category-create page is expected to redirect back here with
   * `preselectCategoryId=<newId>` appended to the query string, which
   * the preselect effect above reads.
   */
  const handleAddNewCategory = () => {
    const url = buildCreateUrl(CATEGORY_CREATE_ROUTE);
    console.log('[inventory/add] Navigating to add category:', url);
    router.push(url);
  };

  // ============================================
  // SUBMIT
  // ============================================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!isValidBusinessUnitId(selectedBusinessUnitId)) {
      const msg = 'Please select a valid business unit';
      setError(msg);
      toast.error(msg);
      return;
    }

    const selectedBU = businessUnits.find(
      (bu) => bu.id === selectedBusinessUnitId,
    );
    if (!selectedBU || selectedBU.isActive === false) {
      const msg = 'Selected business unit is not valid or inactive';
      setError(msg);
      toast.error(msg);
      return;
    }

    if (!validateForm()) {
      const allTouched: Record<string, boolean> = {};
      Object.keys(formData).forEach((key) => {
        allTouched[key] = true;
      });
      setTouched(allTouched);
      const firstError = Object.values(errors).find((err) => err);
      if (firstError) toast.error(firstError);
      else toast.error('Please fix all validation errors');
      return;
    }

    setLoading(true);
    try {
      let workingData = { ...formData };

      let localBarcodeInfo: BarcodeInfo | null = barcodeInfo;

      if (autoGenerateCodes && !workingData.barcode) {
        try {
          const raw = await barcodeService.generateUniqueBarcode({
            prefix: 'INV',
            length: 12,
            productName: workingData.name,
            sku: workingData.sku || undefined,
          });
          const payload = unwrapPayload<{ barcode?: string }>(raw);
          const candidate =
            payload?.barcode ?? (raw as any)?.barcode ?? null;

          const validationError = validateBarcodeString(candidate);
          if (!validationError) {
            workingData = { ...workingData, barcode: candidate as string };
          } else {
            const fallback = `INV-${Date.now().toString(36)
              .toUpperCase()
              .slice(-8)}-${Math.random()
              .toString(36)
              .substring(2, 5)
              .toUpperCase()}`;
            workingData = { ...workingData, barcode: fallback };
          }
        } catch (genErr) {
          console.warn(
            '[inventory/add] auto barcode generation failed, using local fallback:',
            genErr,
          );
          const fallback = `INV-${Date.now().toString(36)
            .toUpperCase()
            .slice(-8)}-${Math.random()
            .toString(36)
            .substring(2, 5)
            .toUpperCase()}`;
          workingData = { ...workingData, barcode: fallback };
        }

        localBarcodeInfo = await buildBarcodeInfo(
          workingData.barcode,
          workingData,
        );
        setBarcodeInfo(localBarcodeInfo);
        setFormData((prev) => ({ ...prev, barcode: workingData.barcode }));
      } else if (autoGenerateCodes && workingData.barcode && !barcodeInfo) {
        localBarcodeInfo = await buildBarcodeInfo(
          workingData.barcode,
          workingData,
        );
        setBarcodeInfo(localBarcodeInfo);
      }

      const itemData = {
        name: workingData.name.trim(),
        sku: workingData.sku.trim() || undefined,
        unit: workingData.unit || 'each',
        unitPrice: workingData.unitPrice,
        costPrice: workingData.costPrice || undefined,
        quantity: workingData.quantity,
        minStock: workingData.minStock,
        maxStock: workingData.maxStock || undefined,
        category: workingData.category.trim() || undefined,
        categoryId: workingData.categoryId || undefined,
        location: workingData.location,
        supplier: workingData.supplier.trim() || undefined,
        supplierId: workingData.supplierId || undefined,
        notes: workingData.notes.trim() || undefined,
        description: workingData.description.trim() || undefined,
        barcode: workingData.barcode.trim() || undefined,
        businessUnitId: selectedBusinessUnitId,
        userId:
          user?.id ||
          (user as any)?.userId ||
          (user as any)?.uid ||
          undefined,
        weight: workingData.weight || undefined,
        isActive: workingData.isActive,
        isDigital: workingData.isDigital,
        featured: workingData.featured,
        tags: workingData.tags
          ? workingData.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        taxRate: workingData.taxRate || undefined,
        images: workingData.images || [],
      };

      console.log('📤 [inventory/add] createItem payload:', itemData);
      const result = await inventoryService.createItem(itemData);

      const itemId =
        result?.id ||
        (result as any)?.inventory?.id ||
        (result as any)?.data?.id ||
        null;
      setCreatedItemId(itemId);

      if (itemId) {
        if (workingData.barcode && localBarcodeInfo) {
          try {
            await inventoryService.updateItem(itemId, {
              barcode: workingData.barcode,
              businessUnitId: selectedBusinessUnitId,
            });
          } catch (barcodeError) {
            console.warn(
              '[inventory/add] barcode association failed:',
              barcodeError,
            );
          }
        }

        try {
          const qrResponse = await inventoryService.generateInventoryQRCode(
            itemId,
            selectedBusinessUnitId,
          );
          const qrPayload = unwrapPayload<{
            qrCodeUrl?: string;
            qrData?: Record<string, any>;
          }>(qrResponse);

          if (qrPayload?.qrCodeUrl) {
            setBarcodeInfo((prev) =>
              prev
                ? {
                    ...prev,
                    qrCodeUrl: qrPayload.qrCodeUrl!,
                    qrData: qrPayload.qrData || prev.qrData,
                  }
                : {
                    barcode: workingData.barcode,
                    barcodeUrl: buildBarcodeUrl(workingData.barcode),
                    qrCodeUrl: qrPayload.qrCodeUrl!,
                    qrData: qrPayload.qrData,
                    isGenerated: true,
                  },
            );
          }
        } catch (qrError) {
          console.warn(
            '[inventory/add] server-side QR regeneration failed, keeping client-side preview:',
            qrError,
          );
        }
      }

      setSuccess(true);
      toast.success('Inventory item created successfully');

      setFormData({
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
        locationId: '',
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
        businessUnitId: selectedBusinessUnitId,
      });
      setAutoGenerateSKU(true);
      setTouched({});
      setErrors({});
      setBarcodeInfo(null);
      setBarcodeSource(null);
      setShowBarcode(false);

      if (!barcodeInfo) {
        setTimeout(() => {
          router.push('/admin/inventory');
          router.refresh();
        }, 2000);
      }
    } catch (err: any) {
      console.error('[inventory/add] create failed:', err);

      let errorMessage = 'Failed to create inventory item';
      if (err?.response?.data?.errors) {
        const validationErrors = err.response.data.errors;
        if (Array.isArray(validationErrors)) {
          errorMessage = validationErrors
            .map(
              (e: any) =>
                `${e.field || e.path || 'field'}: ${e.message}`,
            )
            .join(', ');
        }
      } else if (err?.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err?.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err?.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => router.back();

  const handleCreateAnother = () => {
    setSuccess(false);
    setCreatedItemId(null);
    setFormData({
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
      locationId: '',
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
      businessUnitId: selectedBusinessUnitId,
    });
    setAutoGenerateSKU(true);
    setTouched({});
    setErrors({});
    setBarcodeInfo(null);
    setBarcodeSource(null);
    setShowBarcode(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ============================================
  // RENDER HELPERS
  // ============================================

  const getFieldError = (fieldName: keyof FormErrors): string | undefined =>
    touched[fieldName] ? errors[fieldName] : undefined;

  const getInputClassName = (fieldName: keyof FormErrors): string => {
    const base =
      'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
    return getFieldError(fieldName)
      ? `${base} border-brand-accent-500 dark:border-brand-accent-500 focus:ring-brand-accent-500`
      : `${base} border-gray-300 dark:border-gray-600`;
  };

  const selectedBuName = useMemo(() => {
    const bu = businessUnits.find((b) => b.id === selectedBusinessUnitId);
    return bu?.name || '';
  }, [businessUnits, selectedBusinessUnitId]);

  const canSubmit =
    !loading &&
    !success &&
    isValidBusinessUnitId(selectedBusinessUnitId) &&
    businessUnits.length > 0;

  // ============================================
  // AUTH / PERMISSION GATES
  // ============================================

  if (booting) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-brand-600 mx-auto" />
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Checking your session...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
            Please Login
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            You need to be logged in to add inventory items.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="mt-4 px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors shadow-brand focus-ring"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin && !canCreateInventory()) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 bg-brand-accent-100 dark:bg-brand-accent-950/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-12 h-12 text-brand-accent-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
            Access Denied
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            You don't have permission to create inventory items.
          </p>
          <button
            onClick={() => router.push('/admin/inventory')}
            className="mt-4 px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors focus-ring"
          >
            Back to Inventory
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={handleCancel}
              className="p-2 hover:bg-brand-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
              aria-label="Go back"
              disabled={loading}
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Package className="w-6 h-6 text-brand-500" />
                Add Inventory Item
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Create a new inventory item with stock details, barcode,
                and QR code
              </p>
            </div>
          </div>
          {selectedBuName && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-success-100 dark:bg-success-950/30 rounded-lg text-sm text-success-700 dark:text-success-300">
              <Building className="w-4 h-4" />
              <span>BU: {selectedBuName}</span>
            </div>
          )}
        </div>

        {/* BUSINESS UNIT SELECTION */}
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Select Business Unit <span className="text-brand-accent-500">*</span>
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setShowBusinessUnitDropdown(!showBusinessUnitDropdown)
                  }
                  disabled={loadingBusinessUnits || loading}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    {loadingBusinessUnits ? (
                      <span className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />{' '}
                        Loading...
                      </span>
                    ) : selectedBuName ? (
                      <span className="truncate">{selectedBuName}</span>
                    ) : businessUnitError ? (
                      <span className="text-brand-accent-500 truncate">
                        {businessUnitError}
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">
                        Select a business unit
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {isValidBusinessUnitId(selectedBusinessUnitId) && (
                      <span className="w-2 h-2 rounded-full bg-success-500" />
                    )}
                    {showBusinessUnitDropdown ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </button>

                {showBusinessUnitDropdown && (
                  <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto custom-scrollbar">
                    {loadingBusinessUnits ? (
                      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                        Loading business units...
                      </div>
                    ) : businessUnits.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                        <AlertCircle className="w-5 h-5 mx-auto mb-2 text-warning-500" />
                        No business units available
                        <p className="text-xs text-gray-400 mt-1">
                          Please create a company with a business unit first
                        </p>
                      </div>
                    ) : (
                      businessUnits.map((bu) => {
                        const isActive = bu.isActive !== false;
                        const isSelected =
                          selectedBusinessUnitId === bu.id;

                        return (
                          <button
                            key={bu.id}
                            type="button"
                            onClick={() =>
                              handleBusinessUnitSelect(bu.id)
                            }
                            disabled={!isActive}
                            className={`
                              w-full px-4 py-2 text-left hover:bg-brand-50 dark:hover:bg-gray-700
                              transition-colors flex items-center justify-between focus-ring
                              ${
                                isSelected
                                  ? 'bg-brand-50 dark:bg-brand-950/20'
                                  : ''
                              }
                              ${
                                !isActive
                                  ? 'opacity-50 cursor-not-allowed'
                                  : 'cursor-pointer'
                              }
                            `}
                          >
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-sm font-medium truncate ${
                                  isSelected
                                    ? 'text-brand-600 dark:text-brand-400'
                                    : 'text-gray-900 dark:text-white'
                                }`}
                              >
                                {bu.name}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                {bu.code && <span>Code: {bu.code}</span>}
                                {bu.type && <span>• {bu.type}</span>}
                                {bu.companyName && (
                                  <span className="text-indigo-500">
                                    • {bu.companyName}
                                  </span>
                                )}
                                {!isActive && (
                                  <span className="text-brand-accent-500">
                                    • Inactive
                                  </span>
                                )}
                              </div>
                            </div>
                            {isSelected && (
                              <CheckCircle className="w-4 h-4 text-brand-500 flex-shrink-0 ml-2" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
              {getFieldError('businessUnit') && (
                <p className="mt-1 text-sm text-brand-accent-600 dark:text-brand-accent-400">
                  {getFieldError('businessUnit')}
                </p>
              )}
              <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                <Database className="w-3 h-3" />
                {loadingBusinessUnits
                  ? 'Loading business units...'
                  : `${businessUnits.length} business unit${
                      businessUnits.length !== 1 ? 's' : ''
                    } available`}
                {selectedBuName && ` • Selected: ${selectedBuName}`}
              </div>
            </div>

            {selectedBuName && (
              <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-700/30 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-600">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Selected Unit
                </p>
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[150px]">
                  {selectedBuName}
                </p>
                <p className="text-xs text-gray-400 font-mono">
                  {selectedBusinessUnitId.slice(0, 12)}...
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Business Unit Warning */}
        {!isValidBusinessUnitId(selectedBusinessUnitId) && (
          <div className="mb-6 bg-warning-50 dark:bg-warning-950/20 border border-warning-200 dark:border-warning-800 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning-600 dark:text-warning-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-warning-800 dark:text-warning-200">
                Business Unit Required
              </p>
              <p className="text-sm text-warning-700 dark:text-warning-300">
                Please select a business unit from the dropdown above to
                continue creating inventory items.
                {businessUnits.length === 0 &&
                  ' No business units are available. Please create a company with a business unit first.'}
              </p>
            </div>
          </div>
        )}

        {/* Success Banner */}
        {success && (
          <div className="mb-6 bg-success-50 dark:bg-success-950/20 border border-success-200 dark:border-success-800 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-success-600 dark:text-success-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-success-800 dark:text-success-200">
                  Success!
                </p>
                <p className="text-sm text-success-700 dark:text-success-300">
                  Item created successfully with barcode and QR code.
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleCreateAnother}
                className="px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 transition-colors text-sm flex items-center gap-1 shadow-brand focus-ring"
              >
                <Plus className="w-4 h-4" /> Add Another
              </button>
              <button
                onClick={() => router.push('/admin/inventory')}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm flex items-center gap-1 shadow-brand focus-ring"
              >
                <Package className="w-4 h-4" /> View Inventory
              </button>
              {createdItemId && (
                <button
                  onClick={() =>
                    router.push(`/admin/inventory/${createdItemId}`)
                  }
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm flex items-center gap-1 focus-ring"
                >
                  <Eye className="w-4 h-4" /> View Item
                </button>
              )}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && !success && (
          <div className="mb-6 bg-brand-accent-50 dark:bg-brand-accent-950/20 border border-brand-accent-200 dark:border-brand-accent-800 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-brand-accent-600 dark:text-brand-accent-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-brand-accent-800 dark:text-brand-accent-200">
                Error
              </p>
              <p className="text-sm text-brand-accent-700 dark:text-brand-accent-300 break-words">
                {error}
              </p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-brand-accent-600 hover:text-brand-accent-800 dark:text-brand-accent-400 p-1 focus-ring"
              aria-label="Dismiss error"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* FORM */}
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6"
        >
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-brand-500" /> Basic Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Item Name <span className="text-brand-accent-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={getInputClassName('name')}
                  placeholder="Enter item name"
                  disabled={loading || success}
                />
                {getFieldError('name') && (
                  <p className="mt-1 text-sm text-brand-accent-600 dark:text-brand-accent-400">
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
                    onChange={handleSKUChange}
                    onBlur={handleBlur}
                    className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono transition-colors disabled:opacity-50 ${
                      errors.sku
                        ? 'border-brand-accent-500 dark:border-brand-accent-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder={
                      autoGenerateSKU && formData.name
                        ? `Auto: ${generateInventorySKU(formData.name)}`
                        : 'Enter SKU (optional)'
                    }
                    disabled={loading || success}
                  />
                  <button
                    type="button"
                    onClick={handleRegenerateSKU}
                    disabled={!formData.name || loading || success}
                    className="px-3 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center gap-1 shadow-brand focus-ring"
                    title="Generate SKU from item name"
                  >
                    <Wand2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Generate</span>
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    id="autoGenerateSKU"
                    checked={autoGenerateSKU}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setAutoGenerateSKU(checked);
                      if (checked && formData.name) {
                        const newSKU = generateInventorySKU(formData.name);
                        setFormData((prev) => ({ ...prev, sku: newSKU }));
                      }
                    }}
                    className="w-4 h-4 text-brand-600 border-gray-300 dark:border-gray-600 rounded focus:ring-brand-500 bg-white dark:bg-gray-700 transition-colors"
                  />
                  <label
                    htmlFor="autoGenerateSKU"
                    className="text-xs text-gray-500 dark:text-gray-400"
                  >
                    Auto-generate SKU from item name
                  </label>
                </div>
                {getFieldError('sku') && (
                  <p className="mt-1 text-sm text-brand-accent-600 dark:text-brand-accent-400">
                    {getFieldError('sku')}
                  </p>
                )}
                {autoGenerateSKU && formData.sku && (
                  <p className="mt-1 text-xs text-success-600 dark:text-success-400">
                    ✓ Auto-generated:{' '}
                    <span className="font-mono">{formData.sku}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Unit <span className="text-brand-accent-500">*</span>
                </label>
                <select
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 transition-colors"
                  disabled={loading || success}
                  required
                >
                  {UNITS.map((unit) => (
                    <option key={unit.value} value={unit.value}>
                      {unit.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* CATEGORY — same shape as supplier/location.
                  The "Add New" option navigates to the canonical
                  category create page instead of the old inline flow. */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <select
                  name="categoryId"
                  value={formData.categoryId || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '__add_new__') {
                      handleAddNewCategory();
                      return;
                    }
                    const match = categories.find((c) => c.id === value);
                    setFormData((prev) => ({
                      ...prev,
                      categoryId: value,
                      category: match?.name || '',
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 transition-colors"
                  disabled={loading || success || loadingOptions}
                >
                  <option value="">Select Category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                  <option value="__add_new__">+ Add New Category…</option>
                </select>
                <p className="mt-1 text-xs text-gray-400">
                  Need a new category?{' '}
                  <button
                    type="button"
                    onClick={handleAddNewCategory}
                    className="text-brand-500 hover:underline inline-flex items-center gap-1 focus-ring"
                    disabled={loading || success}
                  >
                    Create one
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </p>
                {getFieldError('category') && (
                  <p className="mt-1 text-sm text-brand-accent-600 dark:text-brand-accent-400">
                    {getFieldError('category')}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
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
                  placeholder="Enter tags separated by commas"
                  disabled={loading || success}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Tags help organize and search for items
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors disabled:opacity-50"
                  placeholder="Enter item description"
                  disabled={loading || success}
                />
              </div>
            </div>
          </div>

          {/* Barcode & QR Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Barcode className="w-5 h-5 text-indigo-500" /> Barcode & QR
                Code
              </h3>
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={autoGenerateCodes}
                  onChange={(e) => setAutoGenerateCodes(e.target.checked)}
                  className="w-4 h-4 text-brand-600 border-gray-300 dark:border-gray-600 rounded focus:ring-brand-500 transition-colors"
                  disabled={loading || success}
                />
                Auto-generate on save if empty
              </label>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                <div className="flex-1 min-w-[200px] relative">
                  <input
                    type="text"
                    name="barcode"
                    value={formData.barcode}
                    onChange={(e) => handleBarcodeChange(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200 font-mono disabled:opacity-50 ${
                      errors.barcode
                        ? 'border-brand-accent-500'
                        : isBarcodeValid === true
                          ? 'border-success-500'
                          : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="Enter barcode or click Generate"
                    disabled={loading || success}
                  />
                  {checkingBarcode && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
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
                  disabled={generatingBarcode || loading || success}
                  className="px-3 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center gap-1 shadow-brand focus-ring"
                  title="Generate barcode and QR code"
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
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors disabled:opacity-50 focus-ring"
                      title="Copy barcode"
                      disabled={loading || success}
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
                      className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-1 disabled:opacity-50 focus-ring"
                      title="Show/hide barcode and QR code"
                      disabled={loading || success}
                    >
                      <QrCode className="w-4 h-4" />
                      <span className="hidden sm:inline">
                        {showBarcode ? 'Hide' : 'Show'}
                      </span>
                    </button>
                  </>
                )}
              </div>
              {errors.barcode && (
                <p className="mt-1 text-sm text-brand-accent-500">{errors.barcode}</p>
              )}
              {isBarcodeValid === true && formData.barcode && (
                <p className="mt-1 text-sm text-success-500">
                  ✓ Barcode is available
                </p>
              )}

              {formData.barcode && showBarcode && barcodeInfo && (
                <div className="mt-3 border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/30">
                  <div className="flex flex-col items-center">
                    <div className="flex flex-wrap items-center justify-center gap-6">
                      <div className="text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          Barcode
                        </p>
                        {barcodeInfo.barcodeUrl && (
                          <img
                            src={barcodeInfo.barcodeUrl}
                            alt="Barcode"
                            className="h-12 w-auto bg-white p-1 rounded"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                'none';
                            }}
                          />
                        )}
                        <p className="text-xs font-mono text-gray-600 dark:text-gray-400 mt-1 text-center">
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
                            className="w-24 h-24 object-contain bg-white p-1 rounded"
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
                        className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors flex items-center gap-1 focus-ring"
                        disabled={loading || success}
                      >
                        <Download className="w-3 h-3" /> Barcode
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadQRCode}
                        className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors flex items-center gap-1 focus-ring"
                        disabled={loading || success}
                      >
                        <Download className="w-3 h-3" /> QR Code
                      </button>
                      <button
                        type="button"
                        onClick={handlePrintBarcode}
                        className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors flex items-center gap-1 focus-ring"
                        disabled={loading || success}
                      >
                        <Printer className="w-3 h-3" /> Print Both
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowBarcode(false)}
                        className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 focus-ring"
                        disabled={loading || success}
                      >
                        Hide
                      </button>
                    </div>
                    {barcodeSource === 'generated' && (
                      <p className="text-xs text-success-600 dark:text-success-400 mt-2">
                        ✓ Auto-generated by the server. The QR code will be
                        finalized with the real inventory id after save.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pricing & Stock */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-success-500" /> Pricing &
              Stock
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Unit Price <span className="text-brand-accent-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                    $
                  </span>
                  <input
                    type="number"
                    name="unitPrice"
                    step="0.01"
                    min="0"
                    required
                    value={formData.unitPrice}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`${getInputClassName('unitPrice')} pl-8 tabular-nums`}
                    placeholder="0.00"
                    disabled={loading || success}
                  />
                </div>
                {getFieldError('unitPrice') && (
                  <p className="mt-1 text-sm text-brand-accent-600 dark:text-brand-accent-400">
                    {getFieldError('unitPrice')}
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
                    name="costPrice"
                    step="0.01"
                    min="0"
                    value={formData.costPrice}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`${getInputClassName('costPrice')} pl-8 tabular-nums`}
                    placeholder="0.00"
                    disabled={loading || success}
                  />
                </div>
                {getFieldError('costPrice') && (
                  <p className="mt-1 text-sm text-brand-accent-600 dark:text-brand-accent-400">
                    {getFieldError('costPrice')}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Quantity <span className="text-brand-accent-500">*</span>
                </label>
                <input
                  type="number"
                  name="quantity"
                  min="0"
                  required
                  value={formData.quantity}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`${getInputClassName('quantity')} tabular-nums`}
                  placeholder="0"
                  disabled={loading || success}
                />
                {getFieldError('quantity') && (
                  <p className="mt-1 text-sm text-brand-accent-600 dark:text-brand-accent-400">
                    {getFieldError('quantity')}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tax Rate
                </label>
                <select
                  name="taxRate"
                  value={formData.taxRate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 transition-colors"
                  disabled={loading || success}
                >
                  {TAX_RATES.map((rate) => (
                    <option key={rate.value} value={rate.value}>
                      {rate.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Stock Levels */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Tag className="w-5 h-5 text-brand-500" /> Stock Levels
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Min Stock (Reorder Point)
                </label>
                <input
                  type="number"
                  name="minStock"
                  min="0"
                  value={formData.minStock}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`${getInputClassName('minStock')} tabular-nums`}
                  placeholder="5"
                  disabled={loading || success}
                />
                {getFieldError('minStock') && (
                  <p className="mt-1 text-sm text-brand-accent-600 dark:text-brand-accent-400">
                    {getFieldError('minStock')}
                  </p>
                )}
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
                  onBlur={handleBlur}
                  className={`${getInputClassName('maxStock')} tabular-nums`}
                  placeholder="100"
                  disabled={loading || success}
                />
                {getFieldError('maxStock') && (
                  <p className="mt-1 text-sm text-brand-accent-600 dark:text-brand-accent-400">
                    {getFieldError('maxStock')}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Location & Supplier */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-secondary-500" /> Location &
              Supplier
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Location <span className="text-brand-accent-500">*</span>
                </label>
                <select
                  name="location"
                  value={formData.location}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '__add_new__') {
                      handleAddNewLocation();
                      return;
                    }
                    const match = locations.find((l) => l.name === value);
                    setFormData((prev) => ({
                      ...prev,
                      location: value,
                      locationId: match?.id || '',
                    }));
                  }}
                  className={getInputClassName('location')}
                  disabled={loading || success || loadingOptions}
                  required
                >
                  <option value="">Select Location</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.name}>
                      {loc.name}
                      {loc.isDefault ? ' (default)' : ''}
                    </option>
                  ))}
                  <option value="__add_new__">+ Add New Location…</option>
                </select>
                <p className="mt-1 text-xs text-gray-400">
                  Need a new location?{' '}
                  <button
                    type="button"
                    onClick={handleAddNewLocation}
                    className="text-brand-500 hover:underline inline-flex items-center gap-1 focus-ring"
                    disabled={loading || success}
                  >
                    Create one
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </p>
                {getFieldError('location') && (
                  <p className="mt-1 text-sm text-brand-accent-600 dark:text-brand-accent-400">
                    {getFieldError('location')}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Supplier
                </label>
                <select
                  name="supplierId"
                  value={formData.supplierId || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '__add_new__') {
                      handleAddNewSupplier();
                      return;
                    }
                    const match = suppliers.find((s) => s.id === value);
                    setFormData((prev) => ({
                      ...prev,
                      supplierId: value,
                      supplier: match?.name || '',
                    }));
                  }}
                  className={getInputClassName('supplier')}
                  disabled={loading || success || loadingOptions}
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name}
                    </option>
                  ))}
                  <option value="__add_new__">+ Add New Supplier…</option>
                </select>
                <p className="mt-1 text-xs text-gray-400">
                  Need a new supplier?{' '}
                  <button
                    type="button"
                    onClick={handleAddNewSupplier}
                    className="text-brand-500 hover:underline inline-flex items-center gap-1 focus-ring"
                    disabled={loading || success}
                  >
                    Create one
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </p>
              </div>
            </div>
          </div>

          {/* Additional Details */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-teal-500" /> Additional Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  onBlur={handleBlur}
                  className={`${getInputClassName('weight')} tabular-nums`}
                  placeholder="0.000"
                  disabled={loading || success}
                />
                {getFieldError('weight') && (
                  <p className="mt-1 text-sm text-brand-accent-600 dark:text-brand-accent-400">
                    {getFieldError('weight')}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleChange}
                    className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 transition-colors"
                    disabled={loading || success}
                  />
                  Active
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    name="isDigital"
                    checked={formData.isDigital}
                    onChange={handleChange}
                    className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 transition-colors"
                    disabled={loading || success}
                  />
                  Digital Product
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    name="featured"
                    checked={formData.featured}
                    onChange={handleChange}
                    className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 transition-colors"
                    disabled={loading || success}
                  />
                  Featured
                </label>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                onBlur={handleBlur}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors disabled:opacity-50"
                placeholder="Additional notes"
                disabled={loading || success}
              />
            </div>
          </div>

          {/* Business Unit Info Footer */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400 dark:text-gray-500">
              <span className="flex items-center gap-2">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isValidBusinessUnitId(selectedBusinessUnitId)
                      ? 'bg-success-500'
                      : 'bg-brand-accent-500'
                  }`}
                />
                {isValidBusinessUnitId(selectedBusinessUnitId)
                  ? `Business Unit: ${
                      selectedBuName || selectedBusinessUnitId.slice(0, 8)
                    }...`
                  : '⚠️ No business unit selected'}
              </span>
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                {user?.id
                  ? `User: ${user.id.slice(0, 8)}...`
                  : '⚠️ No user ID'}
              </span>
              <span className="flex items-center gap-2">
                <Database className="w-3 h-3" />
                {businessUnits.length} BU
                {businessUnits.length !== 1 ? 's' : ''} available
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors text-gray-700 dark:text-gray-300 w-full sm:w-auto text-center disabled:opacity-50 focus-ring"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 w-full sm:w-auto justify-center shadow-brand focus-ring"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Creating...
                </>
              ) : success ? (
                <>
                  <CheckCircle className="w-4 h-4" /> Created!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Create Item
                </>
              )}
            </button>
          </div>

          {/* Form Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700">
            <span>* Required fields</span>
            <div className="flex items-center gap-4 flex-wrap">
              {formData.barcode && (
                <span className="flex items-center gap-2">
                  <Barcode className="w-3 h-3" /> Barcode set
                </span>
              )}
              {barcodeInfo?.qrCodeUrl && (
                <span className="flex items-center gap-2 text-indigo-500">
                  <QrCode className="w-3 h-3" /> QR ready
                </span>
              )}
              {formData.tags && (
                <span className="flex items-center gap-2">
                  <Tag className="w-3 h-3" /> {formData.tags.split(',').length}{' '}
                  tags
                </span>
              )}
              {autoGenerateSKU && formData.sku && (
                <span className="flex items-center gap-2 text-success-500">
                  <Wand2 className="w-3 h-3" /> Auto SKU: {formData.sku}
                </span>
              )}
              <span className="flex items-center gap-2">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isValidBusinessUnitId(selectedBusinessUnitId)
                      ? 'bg-success-500'
                      : 'bg-brand-accent-500'
                  }`}
                />
                {isValidBusinessUnitId(selectedBusinessUnitId)
                  ? 'Business unit selected'
                  : '⚠️ Business unit required'}
              </span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
