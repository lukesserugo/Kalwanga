// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\inventory\[id]\edit\page.tsx

'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../../../../hooks/useAuth';
import { inventoryService } from '../../../../../../services/inventoryService';
import { barcodeService } from '../../../../../../services/barcodeService';
import { companyService } from '../../../../../../services/companyService';
import { locationService } from '../../../../../../services/locationService';
import { api } from '../../../../../../services/api';
import { toast } from '../../../../../../utils/toast-manager';
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
  CheckCircle,
  X,
  Plus,
  Minus,
  Building,
  Wand2,
  Building2,
  Database,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Barcode,
  QrCode,
  RefreshCw,
  Copy,
  Check,
  Download,
  Printer,
  Edit3,
  Star,
  Globe,
  Image as ImageIcon,
  Archive,
  Eye,
  AlertTriangle,
} from 'lucide-react';

// ============================================
// BACKEND CONTRACT
// ============================================
//
// `GET  /inventory/items/:id`         → { success, data: FlatInventoryItem }
// `PUT  /inventory/items/:id`         → updates product + inventory rows
// `POST /inventory/:id/generate-barcode` → { success, data: { barcode, barcodeUrl, qrCodeUrl } }
// `POST /inventory/:id/generate-qr`      → { success, data: { qrCodeUrl, qrData } }
//
// `FlatInventoryItem` carries `reorderPoint` and `reorderQuantity` (not
// `minStock` / `maxStock`). `Product.images` on the wire is either
// `ProductImage[]` (`{ url, alt, order, isPrimary }[]`) or `string[]`
// depending on the include. `toImageUrls` flattens both.

const PLACEHOLDER_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// ============================================
// HELPERS
// ============================================

function toImageUrls(input: unknown): string[] {
  if (!input) return [];
  if (typeof input === 'string') return [input];
  if (!Array.isArray(input)) return [];
  return input
    .map((v) => {
      if (typeof v === 'string') return v;
      if (v && typeof v === 'object' && typeof (v as any).url === 'string') {
        return (v as any).url as string;
      }
      return null;
    })
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Unwrap a service response that may be a raw payload, a `{ data }`
 * envelope, or a `{ success, data }` envelope.
 */
function unwrapPayload<T = any>(response: any): T | null {
  if (!response) return null;
  if (typeof response !== 'object') return response as T;
  if ('data' in response && response.data !== undefined) return response.data;
  return response as T;
}

/**
 * Only reject literal sentinel strings. Anything else is a legitimate
 * barcode.
 */
function validateBarcodeString(value: unknown): string | null {
  if (value === undefined || value === null) {
    return 'Barcode was not returned by the server';
  }
  if (typeof value !== 'string') return 'Barcode is not a string';
  const trimmed = value.trim();
  if (!trimmed) return 'Barcode is empty';
  if (/^(nan|undefined|null)$/i.test(trimmed)) {
    return `Barcode is invalid: "${trimmed}"`;
  }
  return null;
}

function buildBarcodeUrl(barcode: string): string {
  return `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(
    barcode
  )}&code=EAN-13&dpi=96`;
}

function buildQrCodeUrl(qrData: Record<string, any>): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
    JSON.stringify(qrData)
  )}`;
}

function buildQrDataForItem(args: {
  itemId: string;
  formData: InventoryFormData;
  barcode: string;
}): Record<string, any> {
  const { itemId, formData, barcode } = args;
  return {
    type: 'INVENTORY_ITEM',
    id: itemId,
    productId: itemId,
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

// ============================================
// TYPES
// ============================================

interface InventoryFormData {
  name: string;
  sku: string;
  category: string;
  categoryId?: string;
  quantity: number;
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

const FALLBACK_LOCATIONS = [
  'Warehouse',
  'Storefront',
  'Backroom',
  'In Transit',
  'Distribution Center',
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

const SENTINEL_LOCATION_VALUES = new Set(['', 'undefined', 'null', 'default']);

// ============================================
// LOCAL HELPERS
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
  value: string | null | undefined
): value is string {
  if (!value) return false;
  return !SENTINEL_LOCATION_VALUES.has(value);
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function EditInventoryItemPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated } = useAuth();

  // Guards
  const isLoadingRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const hasLoadedOptionsRef = useRef(false);
  const hasLoadedBusinessUnitsRef = useRef(false);
  const loadedOptionsBuIdRef = useRef<string | null>(null);
  const loadedItemIdRef = useRef<string | null>(null);

  // State
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [itemLoaded, setItemLoaded] = useState(false);

  // Business Unit
  //
  // ⚠️ `loadingBusinessUnits` MUST start `false`, not `true`.
  //    When it started `true`, the guard at the top of
  //    `fetchBusinessUnits` returned immediately on the very first
  //    call, so the fetch never ran, `businessUnits` stayed empty,
  //    and the effect that gates `loadItem` on
  //    `businessUnits.length > 0` never fired. The page hung on
  //    "Loading item data..." forever.
  const [businessUnits, setBusinessUnits] = useState<BusinessUnitOption[]>([]);
  const [selectedBusinessUnitId, setSelectedBusinessUnitId] = useState('');
  const [loadingBusinessUnits, setLoadingBusinessUnits] = useState(false);
  const [showBusinessUnitDropdown, setShowBusinessUnitDropdown] =
    useState(false);
  const [businessUnitError, setBusinessUnitError] = useState<string | null>(
    null
  );

  // Barcode / QR
  const [generatingBarcode, setGeneratingBarcode] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [barcodeInfo, setBarcodeInfo] = useState<BarcodeInfo | null>(null);
  const [isBarcodeValid, setIsBarcodeValid] = useState<boolean | null>(null);
  const [checkingBarcode, setCheckingBarcode] = useState(false);
  const [barcodeSource, setBarcodeSource] = useState<
    'manual' | 'generated' | 'existing' | null
  >(null);

  // Options
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Custom-entry modes
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [isCustomLocation, setIsCustomLocation] = useState(false);

  // Auto SKU
  const [autoGenerateSKU, setAutoGenerateSKU] = useState(false);

  // Images
  const [imageInput, setImageInput] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState<InventoryFormData>({
    name: '',
    sku: '',
    category: '',
    categoryId: '',
    quantity: 0,
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

  // ============================================
  // FETCH BUSINESS UNITS
  // ============================================

  const fetchBusinessUnits = useCallback(async () => {
    // ⚠️ Only guard on the ref, NOT on `loadingBusinessUnits`.
    //    Gating this function on its own loading state made the
    //    very first call return without doing anything, because
    //    the state started as `true` and only flipped to `false`
    //    after this function ran — a chicken-and-egg deadlock.
    if (hasLoadedBusinessUnitsRef.current) return;

    setLoadingBusinessUnits(true);
    setBusinessUnitError(null);

    try {
      let units: BusinessUnitOption[] = [];

      try {
        const response = await api.get('/business-units');
        let data: any = response;

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

          if (units.length > 0) {
            try {
              localStorage.setItem('businessUnits', JSON.stringify(units));
            } catch {
              /* ignore */
            }
            const activeUnit = units.find((bu) => bu.isActive !== false);
            if (activeUnit) {
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
            }
            setBusinessUnits(units);
            setLoadingBusinessUnits(false);
            hasLoadedBusinessUnitsRef.current = true;
            return;
          }
        }
      } catch (apiError) {
        console.warn('/business-units failed:', apiError);
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
          console.warn('companyService failed:', companyError);
        }
      }

      if (units.length === 0) {
        try {
          const userAny = user as any;
          if (userAny?.businessUnits && Array.isArray(userAny.businessUnits)) {
            userAny.businessUnits.forEach((bu: any) => {
              const buId = bu.businessUnitId || bu.id || bu;
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

              if (isValidBusinessUnitId(buId)) {
                units.push({
                  id: buId,
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
          console.warn('user context failed:', userError);
        }
      }

      if (units.length === 0) {
        try {
          const stored = localStorage.getItem('businessUnits');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              units = parsed.filter((bu: any) =>
                isValidBusinessUnitId(bu?.id)
              );
            }
          }
        } catch (storageError) {
          console.warn('localStorage failed:', storageError);
        }
      }

      if (units.length === 0) {
        const defaultBU = localStorage.getItem('businessUnitId');
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
          index === self.findIndex((u) => u.id === unit.id)
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
          'No business units available. Please create a business unit first.'
        );
        toast.warning('No business units available');
      }

      hasLoadedBusinessUnitsRef.current = true;
    } catch (err) {
      console.error('fetchBusinessUnits failed:', err);
      setBusinessUnitError('Failed to load business units. Please refresh.');
      toast.error('Failed to load business units');
    } finally {
      setLoadingBusinessUnits(false);
    }
  }, [user]); // ⚠️ was [user, loadingBusinessUnits]

  // ============================================
  // LOAD OPTIONS (scoped per BU id)
  // ============================================
  //
  // The ref guards by BU id, not by a boolean, so changing the BU
  // re-runs the loader.

  const loadOptions = useCallback(async (buId: string) => {
    if (!isValidBusinessUnitId(buId)) {
      setLoadingOptions(false);
      return;
    }

    if (loadedOptionsBuIdRef.current === buId) return;
    loadedOptionsBuIdRef.current = buId;

    setLoadingOptions(true);

    try {
      // Categories
      let categoriesLoaded = false;
      try {
        const categoriesData = await inventoryService.getCategories(buId);
        if (Array.isArray(categoriesData) && categoriesData.length > 0) {
          setCategories(
            categoriesData.map((cat: any) => ({
              id: cat.id || cat.categoryId || cat.category,
              name: cat.name || cat.category || 'Uncategorized',
            }))
          );
          categoriesLoaded = true;
        }
      } catch (e) {
        console.warn('[inventory/edit] getCategories failed:', e);
      }

      if (!categoriesLoaded) {
        try {
          const inventoryData = await inventoryService.getAllInventory(buId);
          if (inventoryData?.items && inventoryData.items.length > 0) {
            const map = new Map<string, { id: string; name: string }>();
            inventoryData.items.forEach((item: any) => {
              const name =
                item.category ||
                item.product?.category?.name ||
                'Uncategorized';
              const catId =
                item.categoryId || item.product?.category?.id || name;
              if (!map.has(name)) map.set(name, { id: catId, name });
            });
            const result = Array.from(map.values());
            if (result.length > 0) {
              setCategories(result);
              categoriesLoaded = true;
            }
          }
        } catch (e) {
          console.warn(
            '[inventory/edit] extract categories failed:',
            e
          );
        }
      }

      if (!categoriesLoaded) setCategories([]);

      // Suppliers
      let suppliersLoaded = false;
      try {
        const suppliersData = await inventoryService.getSuppliers(buId);
        if (Array.isArray(suppliersData) && suppliersData.length > 0) {
          setSuppliers(
            suppliersData.map((sup: any) => ({
              id: sup.id,
              name: sup.name,
            }))
          );
          suppliersLoaded = true;
        }
      } catch (e) {
        console.warn('[inventory/edit] getSuppliers failed:', e);
      }

      if (!suppliersLoaded) setSuppliers([]);

      // Locations
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
            }))
          );
          locationsLoaded = true;
        }
      } catch (e) {
        console.warn('[inventory/edit] locationService.list failed:', e);
      }

      if (!locationsLoaded) {
        setLocations(FALLBACK_LOCATIONS.map((name) => ({ id: name, name })));
      }
    } catch (err) {
      console.error('[inventory/edit] loadOptions error:', err);
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  // ============================================
  // BUILD BARCODE + QR INFO
  // ============================================
  //
  // Unwraps the barcode service responses and falls back to locally
  // constructed URLs if the service fails. Same helper the add page
  // uses, mirrored here for consistency.

  const buildBarcodeInfo = useCallback(
    async (
      barcode: string,
      formSnapshot: InventoryFormData,
      itemId?: string
    ): Promise<BarcodeInfo> => {
      const qrData = buildQrDataForItem({
        itemId: itemId || id || '',
        formData: formSnapshot,
        barcode,
      });

      try {
        const [barcodeImageRaw, qrCodeRaw] = await Promise.all([
          barcodeService.generateBarcodeImage(barcode),
          barcodeService.generateQRCode(qrData),
        ]);

        const barcodeImage = unwrapPayload<{ barcodeUrl?: string }>(
          barcodeImageRaw
        );
        const qrCode = unwrapPayload<{ qrCodeUrl?: string }>(qrCodeRaw);

        return {
          barcode,
          barcodeUrl:
            barcodeImage?.barcodeUrl || buildBarcodeUrl(barcode),
          qrCodeUrl: qrCode?.qrCodeUrl || buildQrCodeUrl(qrData),
          qrData,
          isGenerated: true,
        };
      } catch (err) {
        console.warn(
          '[inventory/edit] barcode service failed, using fallback URLs:',
          err
        );
        return {
          barcode,
          barcodeUrl: buildBarcodeUrl(barcode),
          qrCodeUrl: buildQrCodeUrl(qrData),
          qrData,
          isGenerated: true,
        };
      }
    },
    [id]
  );

  // ============================================
  // LOAD BARCODE INFO
  // ============================================

  const loadBarcodeInfo = useCallback(
    async (barcode: string) => {
      if (!barcode) return;
      const info = await buildBarcodeInfo(barcode, formData, id);
      setBarcodeInfo(info);
      setBarcodeSource('existing');
    },
    [buildBarcodeInfo, formData, id]
  );

  // ============================================
  // LOAD ITEM
  // ============================================

  const loadItem = useCallback(async () => {
    if (!id) return;
    if (isLoadingRef.current) return;
    // Guard scoped to the current item id so navigating between items
    // re-fetches.
    if (loadedItemIdRef.current === id) return;

    try {
      isLoadingRef.current = true;
      setLoading(true);

      const data = await inventoryService.getInventoryItemById(id);

      if (!data || !data.id) {
        toast.error('Item not found');
        router.push('/admin/inventory');
        return;
      }

      let tagsString = '';
      if (data.tags) {
        if (Array.isArray(data.tags)) tagsString = data.tags.join(', ');
        else if (typeof data.tags === 'string') tagsString = data.tags;
      }

      const businessUnitId =
        data.businessUnitId ||
        localStorage.getItem('businessUnitId') ||
        '';

      const images = toImageUrls(
        data.images && data.images.length > 0
          ? data.images
          : data.product?.images
      );

      // Use ?? instead of || for numeric fields so a legitimate 0 is
      // preserved.
      setFormData({
        name: data.name || data.product?.name || '',
        sku: data.sku || data.product?.sku || '',
        category: data.category || data.product?.category?.name || '',
        categoryId: data.categoryId || data.product?.category?.id || '',
        quantity: data.quantity || data.stock || 0,
        unitPrice:
          data.price || data.unitPrice || data.product?.unitPrice || 0,
        costPrice: data.costPrice || data.product?.costPrice || 0,
        minStock: data.reorderPoint ?? data.minStock ?? 5,
        maxStock: data.reorderQuantity ?? data.maxStock ?? 100,
        location: data.location || 'Warehouse',
        locationId: '',
        supplier: data.supplier || data.product?.supplier?.name || '',
        supplierId: data.supplierId || data.product?.supplier?.id || '',
        notes: data.notes || '',
        description: data.description || data.product?.description || '',
        barcode: data.barcode || '',
        weight: data.weight || 0,
        isActive: data.isActive !== undefined ? data.isActive : true,
        isDigital: data.isDigital || false,
        featured: data.featured || false,
        tags: tagsString,
        taxRate: data.taxRate || 0,
        images,
        businessUnitId,
      });

      setSelectedBusinessUnitId(businessUnitId);

      if (data.barcode) {
        await loadBarcodeInfo(data.barcode);
      }

      loadedItemIdRef.current = id;
      hasLoadedRef.current = true;
      setItemLoaded(true);
    } catch (err: any) {
      console.error('Failed to load item:', err);
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
    if (isAuthenticated && !hasLoadedBusinessUnitsRef.current) {
      fetchBusinessUnits();
    }
  }, [isAuthenticated, fetchBusinessUnits]);

  useEffect(() => {
    if (isValidBusinessUnitId(selectedBusinessUnitId)) {
      loadOptions(selectedBusinessUnitId);
    }
  }, [selectedBusinessUnitId, loadOptions]);

  useEffect(() => {
    if (isAuthenticated && id && businessUnits.length > 0) {
      loadItem();
    }
  }, [isAuthenticated, id, businessUnits.length, loadItem]);

  // Reset guards when id changes.
  useEffect(() => {
    hasLoadedRef.current = false;
    loadedItemIdRef.current = null;
  }, [id]);

  // ?preselectSupplierId=…
  useEffect(() => {
    const preselect = searchParams?.get('preselectSupplierId');
    if (!preselect) return;

    setFormData((prev) => ({ ...prev, supplierId: preselect }));

    if (suppliers.length > 0) {
      const match = suppliers.find((s) => s.id === preselect);
      if (match) {
        setFormData((prev) => ({
          ...prev,
          supplierId: match.id,
          supplier: match.name,
        }));
      }
    }
  }, [searchParams, suppliers.length]);

  // ============================================
  // BARCODE / QR HANDLERS
  // ============================================

  const checkBarcodeUniqueness = useCallback(
    async (barcode: string): Promise<boolean> => {
      if (!barcode || barcode.length < 3) return true;

      setCheckingBarcode(true);
      try {
        const result = await import(
          '../../../../../../services/productService'
        ).then((m) => m.productService.validateBarcode(barcode, id));

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
        console.error('Error checking barcode:', err);
        return true;
      } finally {
        setCheckingBarcode(false);
      }
    },
    [id]
  );

  const handleGenerateBarcode = async () => {
    if (!formData.name) {
      toast.error('Please enter an item name first');
      return;
    }

    // Confirm before overwriting an existing barcode. Any printed
    // labels become invalid.
    if (formData.barcode && barcodeSource !== 'generated') {
      const confirmed = window.confirm(
        `This item already has a barcode (${formData.barcode}). Generating a new one will replace it and invalidate any printed labels. Continue?`
      );
      if (!confirmed) return;
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
      const candidate = payload?.barcode ?? (raw as any)?.barcode ?? null;

      const validationError = validateBarcodeString(candidate);
      let barcode: string;
      if (validationError) {
        console.warn(
          '[inventory/edit] barcode service returned invalid value, falling back:',
          candidate,
          validationError
        );
        barcode = `INV-${Date.now().toString(36)
          .toUpperCase()
          .slice(-8)}-${Math.random()
          .toString(36)
          .substring(2, 5)
          .toUpperCase()}`;
        toast.success('Barcode generated locally');
      } else {
        barcode = candidate as string;
        toast.success('Barcode and QR code generated');
      }

      setFormData((prev) => ({ ...prev, barcode }));
      setIsBarcodeValid(true);

      const info = await buildBarcodeInfo(barcode, formData, id);
      setBarcodeInfo(info);
      setBarcodeSource('generated');
      setShowBarcode(true);
    } catch (err: any) {
      console.error('Failed to generate barcode:', err);
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

    // Escape all user-controlled fields before interpolating.
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
            ${barcodeInfo.barcodeUrl ? `<img src="${barcodeInfo.barcodeUrl}" alt="Barcode" class="barcode-img" />` : ''}
            ${barcodeInfo.qrCodeUrl ? `<img src="${barcodeInfo.qrCodeUrl}" alt="QR Code" class="qr-img" />` : ''}
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
  // IMAGE HANDLERS
  // ============================================

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

  const handleImageError = (url: string) => {
    setBrokenImages((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
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
    [formData.minStock]
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
    if (!formData.location) {
      newErrors.location = 'Location is required';
      isValid = false;
    }

    if (businessUnits.length > 0) {
      if (!isValidBusinessUnitId(selectedBusinessUnitId)) {
        newErrors.businessUnit = 'Please select a valid business unit';
        isValid = false;
      } else {
        const isValidBU = businessUnits.some(
          (bu) => bu.id === selectedBusinessUnitId && bu.isActive !== false
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
    >
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
      setFormData((prev) => ({
        ...prev,
        [name]: parsedValue,
        sku: newSKU,
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: parsedValue }));
    }

    const error = validateField(name, parsedValue);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleBlur = (
    e: React.FocusEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
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
      setFormData((prev) => ({ ...prev, businessUnitId: buId }));
      toast.success(`Selected: ${selected.name}`);
    } else if (selected && selected.isActive === false) {
      toast.error('This business unit is inactive');
    } else {
      toast.error('Invalid business unit selected');
    }
  };

  const handleAddNewSupplier = () => {
    const returnTo =
      typeof window !== 'undefined'
        ? window.location.pathname + window.location.search
        : `/admin/inventory/${id}/edit`;
    router.push(
      `/admin/suppliers/add?returnTo=${encodeURIComponent(returnTo)}`
    );
  };

  const handleAddNewLocation = () => {
    const returnTo =
      typeof window !== 'undefined'
        ? window.location.pathname + window.location.search
        : `/admin/inventory/${id}/edit`;
    router.push(
      `/admin/locations/add?returnTo=${encodeURIComponent(returnTo)}`
    );
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
      (bu) => bu.id === selectedBusinessUnitId
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

    setSubmitting(true);
    try {
      // If the item has no barcode and the user cleared the field,
      // generate one now so the item always has both codes.
      let workingBarcode = formData.barcode;
      let workingInfo = barcodeInfo;

      if (!workingBarcode) {
        try {
          const raw = await barcodeService.generateUniqueBarcode({
            prefix: 'INV',
            length: 12,
            productName: formData.name,
            sku: formData.sku || undefined,
          });
          const payload = unwrapPayload<{ barcode?: string }>(raw);
          const candidate = payload?.barcode ?? (raw as any)?.barcode ?? null;
          const validationError = validateBarcodeString(candidate);
          workingBarcode = validationError
            ? `INV-${Date.now().toString(36)
                .toUpperCase()
                .slice(-8)}-${Math.random()
                .toString(36)
                .substring(2, 5)
                .toUpperCase()}`
            : (candidate as string);
        } catch (genErr) {
          console.warn(
            '[inventory/edit] auto barcode generation failed, using fallback:',
            genErr
          );
          workingBarcode = `INV-${Date.now().toString(36)
            .toUpperCase()
            .slice(-8)}-${Math.random()
            .toString(36)
            .substring(2, 5)
            .toUpperCase()}`;
        }

        workingInfo = await buildBarcodeInfo(workingBarcode, formData, id);
        setBarcodeInfo(workingInfo);
        setFormData((prev) => ({ ...prev, barcode: workingBarcode }));
      } else if (workingBarcode && !barcodeInfo) {
        // User typed a barcode manually. Build the preview so the
        // stored item gets a consistent QR after save.
        workingInfo = await buildBarcodeInfo(workingBarcode, formData, id);
        setBarcodeInfo(workingInfo);
      }

      const payload: any = {
        businessUnitId: selectedBusinessUnitId,
      };

      if (formData.name?.trim()) payload.name = formData.name.trim();
      if (formData.sku?.trim()) payload.sku = formData.sku.trim();
      if (formData.unitPrice !== undefined && formData.unitPrice >= 0)
        payload.unitPrice = formData.unitPrice;
      if (formData.costPrice !== undefined && formData.costPrice >= 0)
        payload.costPrice = formData.costPrice;
      if (formData.quantity !== undefined && formData.quantity >= 0)
        payload.quantity = formData.quantity;
      if (formData.minStock !== undefined && formData.minStock >= 0)
        payload.minStock = formData.minStock;
      if (formData.maxStock !== undefined && formData.maxStock >= 0)
        payload.maxStock = formData.maxStock;
      if (formData.location) payload.location = formData.location;
      if (formData.category?.trim())
        payload.category = formData.category.trim();
      if (formData.categoryId) payload.categoryId = formData.categoryId;
      if (formData.supplier?.trim())
        payload.supplier = formData.supplier.trim();
      if (formData.supplierId) payload.supplierId = formData.supplierId;
      if (formData.notes?.trim()) payload.notes = formData.notes.trim();
      if (formData.description?.trim())
        payload.description = formData.description.trim();
      if (workingBarcode?.trim()) payload.barcode = workingBarcode.trim();
      if (formData.weight !== undefined && formData.weight >= 0)
        payload.weight = formData.weight;
      if (formData.taxRate !== undefined && formData.taxRate >= 0)
        payload.taxRate = formData.taxRate;
      if (formData.tags?.trim()) {
        payload.tags = formData.tags
          .split(',')
          .map((t: string) => t.trim())
          .filter(Boolean);
      }
      if (formData.images && formData.images.length > 0)
        payload.images = formData.images;

      payload.isActive = formData.isActive;
      payload.isDigital = formData.isDigital;
      payload.featured = formData.featured;

      await inventoryService.updateItem(id as string, payload);

      // Regenerate the QR on the server so it reflects the actual
      // inventory row (real id, latest price, latest stock).
      try {
        const qrResponse = await inventoryService.generateInventoryQRCode(
          id as string,
          selectedBusinessUnitId
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
                  barcode: workingBarcode,
                  barcodeUrl: buildBarcodeUrl(workingBarcode),
                  qrCodeUrl: qrPayload.qrCodeUrl!,
                  qrData: qrPayload.qrData,
                  isGenerated: true,
                }
          );
        }
      } catch (qrError) {
        console.warn(
          '[inventory/edit] server-side QR regeneration failed, keeping client-side preview:',
          qrError
        );
      }

      setSuccess(true);
      toast.success('Inventory item updated successfully');

      setTimeout(() => {
        router.push(`/admin/inventory/${id}`);
        router.refresh();
      }, 1500);
    } catch (err: any) {
      console.error('Error updating inventory item:', err);
      let errorMessage = 'Failed to update inventory item';

      if (err?.response?.data) {
        const data = err.response.data;
        if (data.errors && Array.isArray(data.errors)) {
          errorMessage = data.errors
            .map(
              (e: any) => `${e.field || e.path || 'field'}: ${e.message}`
            )
            .join(', ');
        } else if (data.message) errorMessage = data.message;
        else if (data.error) errorMessage = data.error;
      } else if (err?.message) {
        errorMessage = err.message;
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

  const getFieldError = (fieldName: keyof FormErrors): string | undefined =>
    touched[fieldName] ? errors[fieldName] : undefined;

  const getInputClassName = (fieldName: keyof FormErrors): string => {
    const base =
      'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
    return getFieldError(fieldName)
      ? `${base} border-red-500 dark:border-red-500 focus:ring-red-500`
      : `${base} border-gray-300 dark:border-gray-600`;
  };

  const selectedBuName = useMemo(() => {
    const bu = businessUnits.find((b) => b.id === selectedBusinessUnitId);
    return bu?.name || '';
  }, [businessUnits, selectedBusinessUnitId]);

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
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
            Please Login
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            You need to be logged in to edit inventory items.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
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
          <p className="text-gray-600 dark:text-gray-400">
            Loading item data...
          </p>
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
            <button
              onClick={handleCancel}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Go back"
              disabled={submitting}
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-6 h-6 text-blue-500" />
                Edit Inventory Item
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Update item details, stock, barcode, and QR code
              </p>
            </div>
          </div>
          {selectedBuName && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 rounded-lg text-sm text-green-700 dark:text-green-300">
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
                Select Business Unit <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setShowBusinessUnitDropdown(!showBusinessUnitDropdown)
                  }
                  disabled={loadingBusinessUnits || submitting}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
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
                      <span className="text-red-500 truncate">
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
                            className={`w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-between ${
                              isSelected
                                ? 'bg-blue-50 dark:bg-blue-900/20'
                                : ''
                            } ${
                              !isActive
                                ? 'opacity-50 cursor-not-allowed'
                                : 'cursor-pointer'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-sm font-medium truncate ${
                                  isSelected
                                    ? 'text-blue-600 dark:text-blue-400'
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
                                  <span className="text-red-500">
                                    • Inactive
                                  </span>
                                )}
                              </div>
                            </div>
                            {isSelected && (
                              <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0 ml-2" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
              {getFieldError('businessUnit') && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {getFieldError('businessUnit')}
                </p>
              )}
            </div>

            {selectedBuName && (
              <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-700/30 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-600">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Selected Unit
                </p>
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[150px]">
                  {selectedBuName}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Success / Error Banners */}
        {success && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  Success!
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Item updated successfully.
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => router.push(`/admin/inventory/${id}`)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-1"
              >
                <Eye className="w-4 h-4" /> View Item
              </button>
              <button
                onClick={() => router.push('/admin/inventory')}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm flex items-center gap-1"
              >
                <Package className="w-4 h-4" /> View Inventory
              </button>
            </div>
          </div>
        )}

        {error && !success && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                Error
              </p>
              <p className="text-sm text-red-700 dark:text-red-300 break-words">
                {error}
              </p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 dark:text-red-400 p-1"
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
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-500" />
              Basic Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
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
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {getFieldError('sku')}
                  </p>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <div className="flex gap-2">
                  <select
                    name="category"
                    value={
                      isCustomCategory
                        ? '__custom__'
                        : formData.categoryId || formData.category
                    }
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '__custom__') {
                        setIsCustomCategory(true);
                        setFormData((prev) => ({
                          ...prev,
                          category: '',
                          categoryId: '',
                        }));
                      } else {
                        setIsCustomCategory(false);
                        const selected = categories.find(
                          (c) => c.id === value
                        );
                        setFormData((prev) => ({
                          ...prev,
                          category: selected?.name || '',
                          categoryId: selected?.id || '',
                        }));
                      }
                      setTouched((prev) => ({
                        ...prev,
                        category: true,
                      }));
                    }}
                    className={getInputClassName('category')}
                    disabled={submitting || success || loadingOptions}
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                    <option value="__custom__">
                      + Add custom category
                    </option>
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
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {getFieldError('category')}
                  </p>
                )}
              </div>

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
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Unit Price <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    $
                  </span>
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
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {getFieldError('unitPrice')}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cost Price
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    $
                  </span>
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
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {getFieldError('costPrice')}
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
                  onBlur={handleBlur}
                  className={getInputClassName('taxRate')}
                  disabled={submitting || success}
                >
                  {TAX_RATES.map((rate) => (
                    <option key={rate.value} value={rate.value}>
                      {rate.label}
                    </option>
                  ))}
                </select>
                {getFieldError('taxRate') && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {getFieldError('taxRate')}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Quantity <span className="text-red-500">*</span>
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
                    disabled={
                      submitting || success || formData.quantity <= 0
                    }
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
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        quantity: prev.quantity + 1,
                      }))
                    }
                    disabled={submitting || success}
                    className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {getFieldError('quantity') && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
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
                  value={formData.minStock}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  min="0"
                  className={getInputClassName('minStock')}
                  placeholder="5"
                  disabled={submitting || success}
                />
                {getFieldError('minStock') && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
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
                  value={formData.maxStock}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  min="0"
                  className={getInputClassName('maxStock')}
                  placeholder="100"
                  disabled={submitting || success}
                />
                {getFieldError('maxStock') && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {getFieldError('maxStock')}
                  </p>
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
                  value={
                    isCustomLocation ? '__custom__' : formData.location
                  }
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '__custom__') {
                      setIsCustomLocation(true);
                      setFormData((prev) => ({
                        ...prev,
                        location: '',
                        locationId: '',
                      }));
                    } else {
                      setIsCustomLocation(false);
                      const match = locations.find(
                        (l) => l.name === value
                      );
                      setFormData((prev) => ({
                        ...prev,
                        location: value,
                        locationId: match?.id || '',
                      }));
                    }
                  }}
                  className={getInputClassName('location')}
                  disabled={submitting || success || loadingOptions}
                >
                  <option value="">Select Location</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.name}>
                      {loc.name}
                      {loc.isDefault ? ' (default)' : ''}
                    </option>
                  ))}
                  <option value="__custom__">
                    + Add Custom Location
                  </option>
                </select>
                {isCustomLocation && (
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`mt-2 ${getInputClassName('location')}`}
                    placeholder="Enter custom location name"
                    disabled={submitting || success}
                  />
                )}
                <p className="mt-1 text-xs text-gray-400">
                  Need a new location?{' '}
                  <button
                    type="button"
                    onClick={handleAddNewLocation}
                    className="text-blue-500 hover:underline inline-flex items-center gap-1"
                    disabled={submitting || success}
                  >
                    Create one
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </p>
                {getFieldError('location') && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {getFieldError('location')}
                  </p>
                )}
              </div>

              {/* Supplier */}
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
                    setTouched((prev) => ({ ...prev, supplier: true }));
                  }}
                  className={getInputClassName('supplier')}
                  disabled={submitting || success || loadingOptions}
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
                    className="text-blue-500 hover:underline inline-flex items-center gap-1"
                    disabled={submitting || success}
                  >
                    Create one
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </p>
                {getFieldError('supplier') && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {getFieldError('supplier')}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Barcode & QR */}
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Barcode className="w-5 h-5 text-purple-500" />
              Barcode & QR Code
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Barcode
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      name="barcode"
                      value={formData.barcode}
                      onChange={(e) =>
                        handleBarcodeChange(e.target.value)
                      }
                      onBlur={handleBlur}
                      className={getInputClassName('barcode')}
                      placeholder="Enter barcode or generate"
                      disabled={submitting || success}
                    />
                    {checkingBarcode && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateBarcode}
                    disabled={
                      generatingBarcode ||
                      submitting ||
                      success ||
                      !formData.name
                    }
                    className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-1 whitespace-nowrap"
                    title="Generate a new barcode and QR code"
                  >
                    {generatingBarcode ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Wand2 className="w-4 h-4" />
                    )}
                    Generate
                  </button>
                  {formData.barcode && (
                    <>
                      <button
                        type="button"
                        onClick={handleCopyBarcode}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="Copy barcode"
                        disabled={submitting || success}
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowBarcode(!showBarcode)}
                        className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-1"
                        title="Show/hide barcode and QR"
                        disabled={submitting || success}
                      >
                        <QrCode className="w-4 h-4" />
                        <span className="hidden sm:inline">
                          {showBarcode ? 'Hide' : 'Show'}
                        </span>
                      </button>
                    </>
                  )}
                </div>
                {getFieldError('barcode') && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {getFieldError('barcode')}
                  </p>
                )}
                {isBarcodeValid === false && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    Barcode is already in use
                  </p>
                )}
                {isBarcodeValid === true && formData.barcode && (
                  <p className="mt-1 text-sm text-green-600 dark:text-green-400">
                    ✓ Barcode is available
                  </p>
                )}
                {barcodeSource === 'generated' && (
                  <p className="mt-1 text-xs text-purple-600 dark:text-purple-400">
                    Auto-generated. The QR code will be finalized with the
                    inventory id after save.
                  </p>
                )}
                {barcodeSource === 'existing' && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Existing barcode. Generating a new one will replace it
                    and invalidate any printed labels.
                  </p>
                )}
              </div>

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
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {getFieldError('weight')}
                  </p>
                )}
              </div>
            </div>

            {formData.barcode && showBarcode && barcodeInfo && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/30">
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
                      className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
                      disabled={submitting || success}
                    >
                      <Download className="w-3 h-3" /> Barcode
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadQRCode}
                      className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
                      disabled={submitting || success}
                    >
                      <Download className="w-3 h-3" /> QR Code
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintBarcode}
                      className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
                      disabled={submitting || success}
                    >
                      <Printer className="w-3 h-3" /> Print Both
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBarcode(false)}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      disabled={submitting || success}
                    >
                      Hide
                    </button>
                  </div>
                </div>
              </div>
            )}

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
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {getFieldError('tags')}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
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
                onBlur={handleBlur}
                rows={2}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed resize-y"
                placeholder="Additional notes about this item"
                disabled={submitting || success}
              />
            </div>
          </div>

          {/* Images */}
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-indigo-500" />
              Images
            </h3>

            {formData.images.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {formData.images.map((url, index) => (
                  <div key={`${url}-${index}`} className="relative group">
                    <img
                      src={brokenImages.has(url) ? PLACEHOLDER_IMAGE : url}
                      alt={`Item image ${index + 1}`}
                      className="w-20 h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
                      onError={() => handleImageError(url)}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
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
                  className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                  disabled={submitting || success}
                />
                <button
                  type="button"
                  onClick={handleAddImage}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowImageInput(false);
                    setImageInput('');
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowImageInput(true)}
                className="px-4 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex items-center gap-2"
                disabled={submitting || success}
              >
                <Plus className="w-4 h-4" /> Add Image URL
              </button>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Add image URLs to display product images
            </p>
          </div>

          {/* Status Toggles */}
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Archive className="w-5 h-5 text-indigo-500" />
              Status
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Active
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Item is available for sale
                  </p>
                </div>
              </label>

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
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Show in featured section
                  </p>
                </div>
              </label>

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
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Digital product (no shipping)
                  </p>
                </div>
              </label>
            </div>
          </div>

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
              disabled={
                submitting ||
                success ||
                !isValidBusinessUnitId(selectedBusinessUnitId) ||
                businessUnits.length === 0
              }
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

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700">
            <span className="flex items-center gap-2">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isValidBusinessUnitId(selectedBusinessUnitId)
                    ? 'bg-green-500'
                    : 'bg-yellow-500'
                }`}
              />
              {isValidBusinessUnitId(selectedBusinessUnitId)
                ? 'Business unit selected'
                : 'Select business unit'}
            </span>
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
            <span>ID: {id?.slice(0, 8)}...</span>
          </div>
        </form>
      </div>
    </div>
  );
}
