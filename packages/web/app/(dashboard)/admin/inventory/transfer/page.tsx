// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\inventory\transfer\page.tsx

'use client';

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Truck, Package, Search, X,
  Warehouse, Building, Loader2, AlertCircle,
  ArrowRight, Lock, Info, MapPin, Minus, Plus,
  CheckCircle, Building2, Clock,
  ChevronUp, ChevronDown, History,
} from 'lucide-react';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermission } from '../../../../../hooks/usePermission';
import {
  inventoryService,
  type FlatInventory,
} from '../../../../../services/inventoryService';
import { productService } from '../../../../../services/productService';
import { toast } from '../../../../../utils/toast-manager';
import { formatCurrency, formatDate } from '../../../../../utils/formatters';
import { PermissionResource } from '../../../../../types/enums';

// ============================================
// TYPES
// ============================================
//
// The backend is the single source of truth.
//
//   • `Product` mirrors what `productService.getAllProducts` returns:
//     nullable `category`, `supplier`, `barcode`, `images`, etc.
//   • `Inventory` is a narrow view of the backend's `FlatInventoryItem`
//     — only the fields this page actually renders.
//   • `BusinessUnit` is the local UI view of `usePermission`'s BU list.
//   • `TransferHistoryItem` reflects the shape the backend returns
//     for `GET /inventory/transactions?transactionType=TRANSFER_IN`.

interface Product {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
  costPrice: number;
  barcode: string | null;
  images: string[];
  description: string;
  category: { id: string; name: string } | null;
  supplier: { id: string; name: string } | null;
  weight: number;
  taxRate: number;
  tags: string[];
  isDigital: boolean;
  isActive: boolean;
  featured: boolean;
}

interface Inventory {
  id: string;
  productId: string;
  quantity: number;
  reserved: number;
  location: string;
  available: number;
  reorderPoint: number;
  reorderQuantity: number;
  shelfNumber: string;
  status: string;
  unit: string;
  images: string[];
}

interface BusinessUnit {
  id: string;
  name: string;
  code: string;
  type?: string;
  isActive?: boolean;
  companyName?: string;
}

interface TransferFormData {
  fromLocation: string;
  toLocation: string;
  quantity: number;
  notes: string;
}

interface TransferHistory {
  id: string;
  productName: string;
  fromLocation: string;
  toLocation: string;
  quantity: number;
  createdAt: string;
  user: { firstName: string; lastName: string };
}

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_LOCATIONS = [
  'Warehouse',
  'Storefront',
  'Backroom',
  'Distribution Center',
  'Retail Store',
  'Online Store',
  'Supplier',
  'In Transit',
  'Store A',
  'Store B',
  'Outlet',
];

// ============================================
// HELPERS
// ============================================

function unwrapPayload<T = any>(response: any): T | null {
  if (!response) return null;
  if (typeof response !== 'object') return response as T;
  if ('data' in response && response.data !== undefined) return response.data;
  return response as T;
}

function unwrapArray<T = any>(response: any): T[] {
  if (!response) return [];
  if (Array.isArray(response)) return response as T[];

  if (typeof response === 'object') {
    if (Array.isArray((response as any).data)) return (response as any).data;
    if (Array.isArray((response as any).items)) return (response as any).items;
    if ((response as any).data && Array.isArray((response as any).data.data)) {
      return (response as any).data.data;
    }
    if ((response as any).data && Array.isArray((response as any).data.items)) {
      return (response as any).data.items;
    }
  }
  return [];
}

function isValidBusinessUnitId(id: string | null | undefined): id is string {
  if (!id) return false;
  return !['default', 'default-business-unit', 'undefined', 'null', ''].includes(
    id,
  );
}

/**
 * Map the raw product row from `productService.getAllProducts` into
 * the strict `Product` shape used by this page. Every nullable field
 * gets a defined default so the JSX never has to guard.
 */
function normalizeProduct(raw: any): Product | null {
  if (!raw || !raw.id) return null;
  return {
    id: String(raw.id),
    name: String(raw.name ?? 'Unknown Product'),
    sku: String(raw.sku ?? 'N/A'),
    unitPrice: typeof raw.unitPrice === 'number' ? raw.unitPrice : 0,
    costPrice: typeof raw.costPrice === 'number' ? raw.costPrice : 0,
    barcode: raw.barcode ?? null,
    images: Array.isArray(raw.images) ? raw.images : [],
    description: String(raw.description ?? ''),
    category:
      raw.category && typeof raw.category === 'object'
        ? { id: String(raw.category.id), name: String(raw.category.name) }
        : null,
    supplier:
      raw.supplier && typeof raw.supplier === 'object'
        ? { id: String(raw.supplier.id), name: String(raw.supplier.name) }
        : null,
    weight: typeof raw.weight === 'number' ? raw.weight : 0,
    taxRate: typeof raw.taxRate === 'number' ? raw.taxRate : 0,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    isDigital: raw.isDigital === true,
    isActive: raw.isActive !== false,
    featured: raw.featured === true,
  };
}

/**
 * Map the backend's `FlatInventoryItem` into this page's narrow
 * `Inventory`. The backend normalizes `quantity`, `reserved`,
 * `available`, `location`, and `reorderPoint` — we just pick the
 * fields the UI uses and coerce nullable ones to safe defaults.
 */
function normalizeInventory(raw: FlatInventory | null): Inventory | null {
  if (!raw) return null;
  const quantity = typeof raw.quantity === 'number' ? raw.quantity : 0;
  const reserved = typeof raw.reserved === 'number' ? raw.reserved : 0;
  const available =
    typeof raw.available === 'number' ? raw.available : quantity - reserved;

  return {
    id: String(raw.id ?? ''),
    productId: String(raw.productId ?? ''),
    quantity,
    reserved,
    location: raw.location ?? 'Warehouse',
    available,
    reorderPoint:
      typeof raw.reorderPoint === 'number' ? raw.reorderPoint : 5,
    reorderQuantity:
      typeof raw.reorderQuantity === 'number' ? raw.reorderQuantity : 10,
    shelfNumber: '',
    status: raw.status ?? 'ACTIVE',
    unit: 'each',
    images: Array.isArray(raw.images) ? raw.images : [],
  };
}

// ============================================
// SUB-COMPONENTS
// ============================================

const ProductCard: React.FC<{
  product: Product;
  inventory: Inventory | null;
  onSelect: () => void;
  onClear: () => void;
  loading?: boolean;
}> = ({ product, inventory, onClear, loading }) => {
  const availableStock = inventory
    ? inventory.available
    : 0;
  const hasImage = product.images.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 p-4 bg-brand-50 dark:bg-brand-950/20 rounded-lg border border-brand-200 dark:border-brand-800"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
            {hasImage ? (
              <img
                src={product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <Package className="w-6 h-6 text-gray-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
              {product.name}
              {product.isDigital && (
                <span className="text-xs bg-brand-100 dark:bg-brand-950/30 text-brand-600 dark:text-brand-400 px-1.5 py-0.5 rounded-full">
                  Digital
                </span>
              )}
              {product.featured && (
                <span className="text-xs bg-warning-100 dark:bg-warning-950/30 text-warning-600 dark:text-warning-400 px-1.5 py-0.5 rounded-full">
                  ★ Featured
                </span>
              )}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
              SKU: {product.sku}
            </p>
            {product.barcode && (
              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                Barcode: {product.barcode}
              </p>
            )}
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 tabular-nums">
              Price: {formatCurrency(product.unitPrice)}
            </p>
            {product.category && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Category: {product.category.name}
              </p>
            )}
            {product.supplier && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Supplier: {product.supplier.name}
              </p>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0 ml-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Available Stock
          </p>
          <p
            className={`text-lg font-bold tabular-nums ${
              availableStock === 0
                ? 'text-danger-600 dark:text-danger-400'
                : availableStock <= (inventory?.reorderPoint || 5)
                  ? 'text-warning-600 dark:text-warning-400'
                  : 'text-success-600 dark:text-success-400'
            }`}
          >
            {availableStock} {inventory?.unit || 'units'}
          </p>
          {inventory && inventory.reserved > 0 && (
            <p className="text-xs text-gray-400 tabular-nums">
              ({inventory.reserved} reserved)
            </p>
          )}
          {inventory && (
            <p className="text-xs text-gray-400 tabular-nums">
              Reorder at {inventory.reorderPoint}
            </p>
          )}
        </div>
      </div>
      {inventory && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            Location: {inventory.location || 'Warehouse'}
          </span>
          {inventory.status && (
            <span
              className={`px-1.5 py-0.5 rounded-full ${
                inventory.status === 'ACTIVE'
                  ? 'bg-success-100 dark:bg-success-950/30 text-success-700 dark:text-success-300'
                  : 'bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400'
              }`}
            >
              {inventory.status}
            </span>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={onClear}
        disabled={loading}
        className="mt-3 text-sm text-brand-accent-600 dark:text-brand-accent-400 hover:text-brand-accent-800 dark:hover:text-brand-accent-300 transition-colors flex items-center gap-1 focus-ring disabled:opacity-50"
      >
        <X className="w-4 h-4" />
        Remove Selection
      </button>
    </motion.div>
  );
};

const TransferHistoryItem: React.FC<{ transfer: TransferHistory }> = ({
  transfer,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 py-3 hover:bg-brand-50/50 dark:hover:bg-brand-950/10 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
            {transfer.productName}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-0.5">
              <Warehouse className="w-3 h-3" />
              {transfer.fromLocation}
            </span>
            <ArrowRight className="w-3 h-3 flex-shrink-0 text-brand-500" />
            <span className="flex items-center gap-0.5">
              <Building className="w-3 h-3" />
              {transfer.toLocation}
            </span>
            <span className="font-medium text-gray-700 dark:text-gray-300 tabular-nums">
              Qty: {transfer.quantity}
            </span>
          </div>
        </div>
        <div className="text-right text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
          <div className="flex items-center gap-1 justify-end">
            <Clock className="w-3 h-3" />
            {formatDate(transfer.createdAt)}
          </div>
          <div className="flex items-center gap-1 justify-end mt-0.5">
            {transfer.user.firstName} {transfer.user.lastName}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function TransferPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { hasPermission, getBusinessUnits, getCurrentBusinessUnit } =
    usePermission();

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const businessUnitsLoadedRef = useRef(false);

  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [searching, setSearching] = useState(false);
  const [formData, setFormData] = useState<TransferFormData>({
    fromLocation: '',
    toLocation: '',
    quantity: 1,
    notes: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [transferHistory, setTransferHistory] = useState<TransferHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [selectedBusinessUnitId, setSelectedBusinessUnitId] =
    useState<string>('');
  const [loadingBusinessUnits, setLoadingBusinessUnits] = useState(true);
  const [businessUnitError, setBusinessUnitError] = useState<string | null>(
    null,
  );

  const [locations, setLocations] = useState<string[]>(DEFAULT_LOCATIONS);
  const [loadingLocations, setLoadingLocations] = useState(false);

  const canTransferInventory =
    hasPermission(`${PermissionResource.INVENTORY}:create`) ||
    hasPermission(`${PermissionResource.INVENTORY}:manage`) ||
    hasPermission(`${PermissionResource.INVENTORY}:transfer`) ||
    user?.role === 'SUPER_ADMIN';

  // ============================================
  // BUSINESS UNITS
  // ============================================

  const fetchBusinessUnits = useCallback(async () => {
    if (businessUnitsLoadedRef.current) return;

    setLoadingBusinessUnits(true);
    setBusinessUnitError(null);
    try {
      // Primary source: usePermission hook (which is populated from
      // the auth/sync payload — the same source the backend trusts).
      const hookUnits = getBusinessUnits();
      const hookCurrent = getCurrentBusinessUnit();

      const mapped: BusinessUnit[] = Array.isArray(hookUnits)
        ? hookUnits
            .filter((bu: any) => isValidBusinessUnitId(bu?.id))
            .map((bu: any) => ({
              id: String(bu.id),
              name: bu.name || 'Unnamed Business Unit',
              code: bu.code || '',
              type: bu.type || 'STORE',
              isActive: bu.isActive !== false,
              companyName: bu.companyName,
            }))
        : [];

      setBusinessUnits(mapped);

      if (mapped.length > 0) {
        const preferred =
          (hookCurrent && mapped.find((u) => u.id === hookCurrent.id)) ||
          mapped.find((u) => u.isActive !== false) ||
          mapped[0];

        if (preferred) {
          setSelectedBusinessUnitId(preferred.id);
        }
      } else {
        setBusinessUnitError(
          'No business units available. Please create one first.',
        );
      }
    } catch (err) {
      console.error('[inventory/transfer] fetchBusinessUnits failed:', err);
      setBusinessUnitError('Failed to load business units. Please refresh.');
      toast.error('Failed to load business units');
    } finally {
      businessUnitsLoadedRef.current = true;
      setLoadingBusinessUnits(false);
    }
  }, [getBusinessUnits, getCurrentBusinessUnit]);

  // ============================================
  // LOCATIONS
  // ============================================

  const fetchLocations = useCallback(async (businessUnitId: string) => {
    if (!isValidBusinessUnitId(businessUnitId)) {
      setLocations(DEFAULT_LOCATIONS);
      return;
    }

    setLoadingLocations(true);
    try {
      // Pull every inventory row for the resolved BU and collect
      // distinct location names. The backend resolves the BU itself
      // when we pass an explicit id, which we do here.
      const inventoryData = await inventoryService.getAllInventory(
        businessUnitId,
      );

      const items = Array.isArray(inventoryData?.items)
        ? inventoryData.items
        : [];
      const unique = new Set<string>();
      for (const item of items) {
        const loc = (item as any).location;
        if (typeof loc === 'string' && loc.trim()) unique.add(loc.trim());
      }

      const list = unique.size > 0 ? Array.from(unique) : DEFAULT_LOCATIONS;
      setLocations(list);
    } catch (err) {
      console.warn('[inventory/transfer] fetchLocations failed:', err);
      setLocations(DEFAULT_LOCATIONS);
    } finally {
      setLoadingLocations(false);
    }
  }, []);

  // ============================================
  // TRANSFER HISTORY
  // ============================================

  const fetchTransferHistory = useCallback(async () => {
    if (!isValidBusinessUnitId(selectedBusinessUnitId)) return;

    setLoadingHistory(true);
    try {
      const response = await inventoryService.getInventoryTransactions({
        transactionType: 'TRANSFER_IN',
        limit: 20,
      });

      const rows = unwrapArray<any>(response);
      const history: TransferHistory[] = rows.map((tx: any) => ({
        id: String(tx.id ?? ''),
        productName: tx.product?.name || 'Unknown Product',
        fromLocation:
          tx.fromLocation || tx.inventory?.location || 'Unknown',
        toLocation: tx.toLocation || 'Unknown',
        quantity: Math.abs(tx.quantity || 0),
        createdAt: tx.createdAt || new Date().toISOString(),
        user: {
          firstName: tx.user?.firstName || 'System',
          lastName: tx.user?.lastName || '',
        },
      }));

      setTransferHistory(history);
    } catch (err) {
      console.warn('[inventory/transfer] fetchTransferHistory failed:', err);
      setTransferHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [selectedBusinessUnitId]);

  // ============================================
  // PRODUCT SEARCH
  // ============================================

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      setSearchResults([]);

      if (query.length < 2) return;

      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

      searchTimeoutRef.current = setTimeout(async () => {
        setSearching(true);
        setError(null);
        try {
          const results = await productService.getAllProducts({
            search: query,
            limit: 10,
            businessUnitId: selectedBusinessUnitId || undefined,
          });

          const raw = unwrapArray<any>(results);
          const products = raw
            .map(normalizeProduct)
            .filter((p): p is Product => p !== null);

          setSearchResults(products);
        } catch (err: any) {
          console.error('[inventory/transfer] search failed:', err);
          setError(
            err?.response?.data?.message ||
              err?.message ||
              'Failed to search products',
          );
          setSearchResults([]);
        } finally {
          setSearching(false);
        }
      }, 300);
    },
    [selectedBusinessUnitId],
  );

  // ============================================
  // SELECT PRODUCT
  // ============================================

  const handleSelectProduct = useCallback(
    async (product: Product) => {
      if (!isValidBusinessUnitId(selectedBusinessUnitId)) {
        toast.error('Please select a business unit first');
        return;
      }

      setSelectedProduct(product);
      setSearchQuery('');
      setSearchResults([]);
      setError(null);

      try {
        const inv = await inventoryService.getInventoryByProduct(
          product.id,
          selectedBusinessUnitId,
        );

        const mapped = normalizeInventory(inv);

        if (mapped) {
          setInventory(mapped);
          if (mapped.location) {
            setFormData((prev) => ({
              ...prev,
              fromLocation: mapped.location,
            }));
          }
          toast.success(`Product ${product.name} loaded successfully`);
        } else {
          setInventory(null);
          toast.warning('Product not found in inventory');
        }
      } catch (err) {
        console.error('[inventory/transfer] load inventory failed:', err);
        setInventory(null);
        toast.warning('Could not load inventory for this product');
      }
    },
    [selectedBusinessUnitId],
  );

  // ============================================
  // SUBMIT TRANSFER
  // ============================================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedProduct) {
      toast.error('Please select a product');
      return;
    }

    if (!isValidBusinessUnitId(selectedBusinessUnitId)) {
      toast.error('Please select a valid business unit');
      return;
    }

    if (!formData.fromLocation || !formData.toLocation) {
      toast.error('Please specify both locations');
      return;
    }

    if (formData.fromLocation === formData.toLocation) {
      toast.error('Source and destination must be different');
      return;
    }

    if (formData.quantity <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    const availableStock = inventory?.available ?? 0;
    if (formData.quantity > availableStock) {
      toast.error(`Not enough stock. Available: ${availableStock}`);
      return;
    }

    setLoading(true);
    try {
      // Backend resolves the BU from req.user, but we still send the
      // explicit selection so multi-BU users target the right one.
      await inventoryService.transferStock({
        productId: selectedProduct.id,
        fromLocation: formData.fromLocation,
        toLocation: formData.toLocation,
        quantity: formData.quantity,
        notes: formData.notes || undefined,
        businessUnitId: selectedBusinessUnitId,
      });

      toast.success('Stock transferred successfully');
      router.push('/admin/inventory');
      router.refresh();
    } catch (err: any) {
      console.error('[inventory/transfer] submit failed:', err);
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to transfer stock';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearSelection = () => {
    setSelectedProduct(null);
    setInventory(null);
    setSearchQuery('');
    setSearchResults([]);
    setFormData({
      fromLocation: '',
      toLocation: '',
      quantity: 1,
      notes: '',
    });
    setError(null);
  };

  const handleLocationChange = (
    field: 'fromLocation' | 'toLocation',
    value: string,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleBusinessUnitSelect = (businessUnitId: string) => {
    const selected = businessUnits.find((bu) => bu.id === businessUnitId);
    if (selected && selected.isActive !== false) {
      setSelectedBusinessUnitId(businessUnitId);
      toast.success(`Switched to ${selected.name}`);
      handleClearSelection();
      fetchLocations(businessUnitId);
    } else if (selected && selected.isActive === false) {
      toast.error('This business unit is inactive');
    } else {
      toast.error('Invalid business unit selected');
    }
  };

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    if (isAuthenticated) {
      fetchBusinessUnits();
    }
  }, [isAuthenticated, fetchBusinessUnits]);

  useEffect(() => {
    if (isValidBusinessUnitId(selectedBusinessUnitId)) {
      fetchLocations(selectedBusinessUnitId);
      if (showHistory) {
        fetchTransferHistory();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBusinessUnitId, fetchLocations]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  const availableStock = inventory?.available ?? 0;
  const selectedBU = useMemo(
    () => businessUnits.find((bu) => bu.id === selectedBusinessUnitId),
    [businessUnits, selectedBusinessUnitId],
  );

  // ============================================
  // SEARCH RESULTS RENDERER
  // ============================================

  const renderSearchResults = () => {
    if (searching) {
      return (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 p-4 text-center">
          <Loader2 className="w-5 h-5 animate-spin text-brand-600 mx-auto" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Searching...
          </p>
        </div>
      );
    }

    if (searchResults.length === 0 && searchQuery.length >= 2) {
      return (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 p-4 text-center">
          <Package className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No products found
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Try a different search term
          </p>
        </div>
      );
    }

    if (searchResults.length > 0 && !selectedProduct) {
      return (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto custom-scrollbar">
          {searchResults.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => handleSelectProduct(product)}
              className="w-full px-4 py-3 text-left hover:bg-brand-50 dark:hover:bg-brand-950/20 flex items-center justify-between transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                  {product.images.length > 0 ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Package className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {product.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    SKU: {product.sku}
                  </p>
                  {product.category && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {product.category.name}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-4">
                <span className="text-sm font-medium text-gray-900 dark:text-white tabular-nums">
                  {formatCurrency(product.unitPrice)}
                </span>
                {product.isDigital && (
                  <p className="text-xs text-brand-500">Digital</p>
                )}
              </div>
            </button>
          ))}
        </div>
      );
    }

    return null;
  };

  // ============================================
  // AUTH / PERMISSION GATES
  // ============================================

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Please Login
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          You need to be logged in to transfer stock.
        </p>
      </div>
    );
  }

  if (!canTransferInventory) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
            Access Restricted
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            You don't have permission to transfer stock.
          </p>
          <button
            onClick={() => router.push('/admin/inventory')}
            className="mt-4 px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors shadow-brand focus-ring"
          >
            Back to Inventory
          </button>
        </motion.div>
      </div>
    );
  }

  if (loadingBusinessUnits) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-brand-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            Loading business units...
          </p>
        </div>
      </div>
    );
  }

  if (businessUnits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="text-center">
          <Building2 className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
            No Business Units
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {businessUnitError || 'Please create a business unit first.'}
          </p>
          <button
            onClick={() => router.push('/admin/settings')}
            className="mt-4 px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors shadow-brand focus-ring"
          >
            Go to Settings
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  const canSubmit =
    !loading &&
    !!selectedProduct &&
    isValidBusinessUnitId(selectedBusinessUnitId) &&
    formData.quantity > 0 &&
    formData.fromLocation !== formData.toLocation &&
    formData.quantity <= availableStock;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-brand-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Truck className="w-6 h-6 text-brand-500" />
              Transfer Stock
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Move inventory between locations
            </p>
          </div>
        </div>
        {selectedBU && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-success-100 dark:bg-success-950/30 rounded-lg text-sm text-success-700 dark:text-success-300">
            <Building2 className="w-4 h-4" />
            <span>{selectedBU.name}</span>
          </div>
        )}
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div className="mb-6 p-4 bg-brand-accent-50 dark:bg-brand-accent-950/20 border border-brand-accent-200 dark:border-brand-accent-800 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-brand-accent-600 dark:text-brand-accent-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-brand-accent-700 dark:text-brand-accent-300">
              {error}
            </p>
          </div>
          <button
            onClick={() => setError(null)}
            className="p-1 hover:bg-brand-accent-100 dark:hover:bg-brand-accent-800/30 rounded transition focus-ring"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4 text-brand-accent-600 dark:text-brand-accent-400" />
          </button>
        </div>
      )}

      {/* BUSINESS UNIT SELECTOR */}
      {businessUnits.length > 1 && (
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Business Unit <span className="text-brand-accent-500">*</span>
          </label>
          <select
            value={selectedBusinessUnitId}
            onChange={(e) => handleBusinessUnitSelect(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none dark:bg-gray-700 dark:text-white transition-colors"
          >
            <option value="">Select a business unit</option>
            {businessUnits.map((bu) => (
              <option key={bu.id} value={bu.id}>
                {bu.name} {bu.code ? `(${bu.code})` : ''}{' '}
                {bu.isActive === false ? '(Inactive)' : ''}
              </option>
            ))}
          </select>
          {businessUnitError && (
            <p className="mt-1 text-sm text-brand-accent-600 dark:text-brand-accent-400">
              {businessUnitError}
            </p>
          )}
        </div>
      )}

      {/* FORM */}
      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6"
      >
        {/* PRODUCT SELECTION */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Product <span className="text-brand-accent-500">*</span>
          </label>
          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or SKU..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  disabled={
                    loading ||
                    !!selectedProduct ||
                    !isValidBusinessUnitId(selectedBusinessUnitId)
                  }
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none dark:bg-gray-700 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                />
              </div>
              {selectedProduct && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="px-3 py-2.5 bg-brand-accent-100 dark:bg-brand-accent-950/20 text-brand-accent-600 dark:text-brand-accent-400 rounded-lg hover:bg-brand-accent-200 dark:hover:bg-brand-accent-950/30 transition-colors focus-ring"
                  aria-label="Clear selection"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <AnimatePresence>{renderSearchResults()}</AnimatePresence>
          </div>

          <AnimatePresence>
            {selectedProduct && (
              <ProductCard
                product={selectedProduct}
                inventory={inventory}
                onSelect={() => {}}
                onClear={handleClearSelection}
                loading={loading}
              />
            )}
          </AnimatePresence>

          {!isValidBusinessUnitId(selectedBusinessUnitId) && (
            <p className="mt-2 text-sm text-warning-600 dark:text-warning-400 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              Please select a business unit first
            </p>
          )}
        </div>

        {/* LOCATIONS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              From Location <span className="text-brand-accent-500">*</span>
            </label>
            <div className="relative">
              <Warehouse className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={formData.fromLocation}
                onChange={(e) =>
                  handleLocationChange('fromLocation', e.target.value)
                }
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none dark:bg-gray-700 dark:text-white transition-colors"
                placeholder="Enter source location"
                list="locationList"
                required
                disabled={loading || loadingLocations}
              />
              <datalist id="locationList">
                {locations.map((loc) => (
                  <option key={loc} value={loc} />
                ))}
              </datalist>
            </div>
            {loadingLocations && (
              <p className="mt-1 text-xs text-gray-400 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading locations...
              </p>
            )}
            {inventory &&
              inventory.location &&
              formData.fromLocation !== inventory.location && (
                <p className="mt-1 text-xs text-warning-600 dark:text-warning-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Current location is "{inventory.location}"
                </p>
              )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              To Location <span className="text-brand-accent-500">*</span>
            </label>
            <div className="relative">
              <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={formData.toLocation}
                onChange={(e) =>
                  handleLocationChange('toLocation', e.target.value)
                }
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none dark:bg-gray-700 dark:text-white transition-colors"
                placeholder="Enter destination location"
                list="locationList"
                required
                disabled={loading || loadingLocations}
              />
            </div>
            {formData.fromLocation &&
              formData.toLocation &&
              formData.fromLocation === formData.toLocation && (
                <p className="mt-1 text-xs text-brand-accent-600 dark:text-brand-accent-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Source and destination must be different
                </p>
              )}
          </div>
        </div>

        {/* QUANTITY */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Quantity to Transfer{' '}
            <span className="text-brand-accent-500">*</span>
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    quantity: Math.max(1, prev.quantity - 1),
                  }))
                }
                className="p-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors disabled:opacity-50 focus-ring"
                disabled={loading || !selectedProduct || formData.quantity <= 1}
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    quantity: Math.max(0, parseInt(e.target.value) || 0),
                  })
                }
                min="1"
                max={availableStock || 0}
                className="w-20 px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none dark:bg-gray-700 dark:text-white text-center tabular-nums transition-colors"
                required
                disabled={loading || !selectedProduct}
              />
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    quantity: Math.min(
                      availableStock || 1,
                      prev.quantity + 1,
                    ),
                  }))
                }
                className="p-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors disabled:opacity-50 focus-ring"
                disabled={
                  loading ||
                  !selectedProduct ||
                  formData.quantity >= availableStock
                }
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {inventory && (
              <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                Max: {availableStock}
              </span>
            )}
            {inventory && availableStock > 0 && (
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    quantity: availableStock,
                  }))
                }
                className="text-sm text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 transition-colors focus-ring"
                disabled={loading || !selectedProduct}
              >
                Max
              </button>
            )}
          </div>
          {inventory && formData.quantity > availableStock && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-1 text-sm text-brand-accent-600 dark:text-brand-accent-400 flex items-center gap-1"
            >
              <AlertCircle className="w-4 h-4" />
              Not enough stock available. Available: {availableStock}
            </motion.p>
          )}
        </div>

        {/* NOTES */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value })
            }
            rows={3}
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none dark:bg-gray-700 dark:text-white resize-y transition-colors"
            placeholder="Reason for transfer..."
            disabled={loading}
          />
        </div>

        {/* ACTIONS */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Info className="w-4 h-4 text-brand-500" />
            <span>
              Stock will be deducted from source and added to destination
            </span>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors flex-1 sm:flex-none focus-ring"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-1 sm:flex-none transition-colors shadow-brand focus-ring"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Transferring...
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" />
                  Transfer Stock
                </>
              )}
            </button>
          </div>
        </div>

        {/* FOOTER STATUS */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700">
          <span className="flex items-center gap-2">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                selectedProduct &&
                isValidBusinessUnitId(selectedBusinessUnitId)
                  ? 'bg-success-500'
                  : 'bg-warning-500'
              }`}
            />
            {selectedProduct
              ? 'Product selected'
              : 'Select a product to transfer'}
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle
              className={`w-3 h-3 ${
                isValidBusinessUnitId(selectedBusinessUnitId)
                  ? 'text-success-500'
                  : 'text-gray-400'
              }`}
            />
            {isValidBusinessUnitId(selectedBusinessUnitId)
              ? 'Business unit selected'
              : 'Select business unit'}
          </span>
          <span className="tabular-nums">
            {locations.length} location{locations.length !== 1 ? 's' : ''}{' '}
            available
          </span>
        </div>
      </motion.form>

      {/* TRANSFER HISTORY */}
      <button
        onClick={() => {
          setShowHistory(!showHistory);
          if (!showHistory) fetchTransferHistory();
        }}
        className="mt-6 w-full px-4 py-2 bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-600/30 hover:border-brand-300 dark:hover:border-brand-700 transition-colors flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 focus-ring"
      >
        <span className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Transfer History ({transferHistory.length})
        </span>
        {showHistory ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              {loadingHistory ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-500" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Loading history...
                  </p>
                </div>
              ) : transferHistory.length === 0 ? (
                <div className="p-8 text-center">
                  <History className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No transfer history yet
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Transfers will appear here
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-60 overflow-y-auto custom-scrollbar">
                  {transferHistory.map((transfer) => (
                    <TransferHistoryItem
                      key={transfer.id}
                      transfer={transfer}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
