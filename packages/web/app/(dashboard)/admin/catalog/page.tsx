'use client';

// packages/web/app/(dashboard)/admin/catalog/page.tsx

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Filter, Edit, Trash2, Package,
  Barcode, Grid, List, Download,
  Star, Eye, Copy, RefreshCw, X,
  AlertTriangle, Loader2, Lock,
  QrCode, Scan, Printer,
  ArrowUpDown, ChevronLeft, ChevronRight,
  AlertCircle, Link2, Layers, ImageIcon,
} from 'lucide-react';

import { usePermission } from '../../../../hooks/usePermission';
import { productService } from '../../../../services/productService';
import { categoryService } from '../../../../services/categoryService';
import { toast } from '../../../../utils/toast-manager';
import { formatCurrency } from '../../../../utils/formatters';
import { PermissionResource } from '../../../../types/enums';

// ============================================
// TYPES
// ============================================

interface Category {
  id: string;
  name: string;
}

interface Variant {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  isActive: boolean;
  images?: string[];
  attributes?: Record<string, any>;
  barcode?: string | null;
  inventoryId?: string | null;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  unitPrice: number;
  costPrice?: number | null;
  images?: string[];
  category?: { id: string; name: string } | null;
  categoryId?: string | null;
  inventory?: {
    id: string;
    quantity: number;
    reserved: number;
    available?: number;
  } | null;
  minStock?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  isActive: boolean;
  createdAt: string;
  featured?: boolean;
  tags?: string[];
  variants?: Variant[] | null;
  inventoryId?: string | null;
}

interface BarcodeInfo {
  barcode: string;
  barcodeUrl: string;
  qrCodeUrl: string;
  productId?: string;
  productName?: string;
  sku?: string;
  price?: number;
  format?: string;
  generatedAt?: string;
}

type TriState = 'all' | 'yes' | 'no';
type StatusFilter = 'all' | 'active' | 'inactive';
type SortField = 'name' | 'sku' | 'unitPrice' | 'createdAt' | 'rating';
type SortOrder = 'asc' | 'desc';

interface FilterState {
  categoryId: string;
  status: StatusFilter;
  minPrice: string;
  maxPrice: string;
  hasBarcode: TriState;
  featured: TriState;
  inStock: TriState;
  minRating: string;
  hasVariants: TriState;
  linkedToInventory: TriState;
}

// ============================================
// CONSTANTS
// ============================================

const PLACEHOLDER_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const DEFAULT_FILTERS: FilterState = {
  categoryId: '',
  status: 'all',
  minPrice: '',
  maxPrice: '',
  hasBarcode: 'all',
  featured: 'all',
  inStock: 'all',
  minRating: '',
  hasVariants: 'all',
  linkedToInventory: 'all',
};

const SEARCH_DEBOUNCE_MS = 350;

// ============================================
// PAGE
// ============================================

export default function CatalogProductsPage() {
  const router = useRouter();
  const {
    canView,
    canCreate,
    canEdit,
    canDelete,
    canManage,
    isLoading: permissionLoading,
  } = usePermission();

  // ── Data ───────────────────────────────────
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── View ───────────────────────────────────
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [showFilters, setShowFilters] = useState(false);

  // ── Selection ──────────────────────────────
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  // ── Modals ─────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [selectedProductForBarcode, setSelectedProductForBarcode] =
    useState<Product | null>(null);
  const [barcodeInfo, setBarcodeInfo] = useState<BarcodeInfo | null>(null);
  const [loadingBarcode, setLoadingBarcode] = useState(false);

  // ── Query state ────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
  });

  // ── Export ─────────────────────────────────
  const [exporting, setExporting] = useState(false);

  // ── Image errors ───────────────────────────
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [variantImageErrors, setVariantImageErrors] = useState<
    Record<string, boolean>
  >({});

  // ── Permissions ────────────────────────────
  const canViewProducts =
    canView(PermissionResource.PRODUCT) ||
    canManage(PermissionResource.PRODUCT);
  const canCreateProducts =
    canCreate(PermissionResource.PRODUCT) ||
    canManage(PermissionResource.PRODUCT);
  const canEditProducts =
    canEdit(PermissionResource.PRODUCT) ||
    canManage(PermissionResource.PRODUCT);
  const canDeleteProducts =
    canDelete(PermissionResource.PRODUCT) ||
    canManage(PermissionResource.PRODUCT);
  const canExportProducts =
    canManage(PermissionResource.PRODUCT) ||
    canView(PermissionResource.REPORT);
  const canManageBarcodes =
    canEdit(PermissionResource.PRODUCT) ||
    canManage(PermissionResource.PRODUCT);

  // Guards against the double-mount that React Strict Mode does in dev,
  // and against the double-trigger the old code had from two effects.
  const initialLoadDone = useRef(false);
  // Guards against a fetch resolving after the component unmounts.
  const lastFetchId = useRef(0);

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
  // SEARCH DEBOUNCE
  // ============================================

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [searchInput]);

  // ============================================
  // DATA LOADING
  // ============================================

  const loadCategories = useCallback(async () => {
    try {
      const result = await categoryService.getAllCategories();
      if (Array.isArray(result)) {
        setCategories(result);
      } else if (result && typeof result === 'object' && 'data' in result) {
        setCategories((result as any).data || []);
      } else {
        setCategories([]);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
      setCategories([]);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    const fetchId = ++lastFetchId.current;

    try {
      setLoading(true);
      setImageErrors({});
      setVariantImageErrors({});

      const params: Record<string, any> = {
        page: pagination.page,
        limit: pagination.limit,
        sortBy,
        sortOrder,
      };

      if (debouncedSearch) params.search = debouncedSearch;
      if (filters.categoryId) params.categoryId = filters.categoryId;
      if (filters.status === 'active') params.isActive = true;
      if (filters.status === 'inactive') params.isActive = false;
      if (filters.minPrice) params.minPrice = parseFloat(filters.minPrice);
      if (filters.maxPrice) params.maxPrice = parseFloat(filters.maxPrice);
      if (filters.hasBarcode === 'yes') params.hasBarcode = true;
      if (filters.hasBarcode === 'no') params.hasBarcode = false;
      if (filters.featured === 'yes') params.featured = true;
      if (filters.featured === 'no') params.featured = false;
      if (filters.inStock === 'yes') params.inStock = true;
      if (filters.inStock === 'no') params.inStock = false;
      if (filters.minRating) params.minRating = parseFloat(filters.minRating);
      if (filters.hasVariants === 'yes') params.hasVariants = true;
      if (filters.hasVariants === 'no') params.hasVariants = false;
      // NOTE: `linkedToInventory` has no server-side filter (the product
      // service doesn't accept one). It's applied client-side below.

      const result = await productService.getAllProducts(params);

      // If a newer fetch has started since this one was issued, drop
      // the result — the newer fetch's data is authoritative.
      if (fetchId !== lastFetchId.current) return;

      let mappedProducts: Product[] = (result.data || []).map(
        (p: any): Product => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          unitPrice: p.unitPrice,
          costPrice: p.costPrice,
          images: Array.isArray(p.images) ? p.images : [],
          category: p.category ?? null,
          categoryId: p.categoryId ?? null,
          inventory: p.inventory
            ? {
                id: p.inventory.id,
                quantity: p.inventory.quantity || 0,
                reserved: p.inventory.reserved || 0,
                available:
                  (p.inventory.quantity || 0) -
                  (p.inventory.reserved || 0),
              }
            : null,
          minStock: p.minStock ?? null,
          rating: p.rating ?? null,
          reviewCount: p.reviewCount ?? null,
          isActive: p.isActive,
          createdAt: p.createdAt,
          featured: p.featured,
          tags: Array.isArray(p.tags) ? p.tags : [],
          variants: Array.isArray(p.variants)
            ? p.variants.map((v: any): Variant => ({
                id: v.id,
                name: v.name,
                sku: v.sku,
                price: v.price,
                stock: v.stock || 0,
                isActive: v.isActive !== undefined ? v.isActive : true,
                images: Array.isArray(v.images) ? v.images : [],
                attributes: v.attributes || {},
                barcode: v.barcode || null,
                inventoryId: v.inventoryId || null,
              }))
            : null,
          inventoryId: p.inventoryId || null,
        })
      );

      // Client-side `linkedToInventory` filter.
      if (filters.linkedToInventory !== 'all') {
        const want = filters.linkedToInventory === 'yes';
        mappedProducts = mappedProducts.filter(
          (p) => (!!p.inventoryId) === want
        );
      }

      setProducts(mappedProducts);
      setPagination((prev) => ({
        ...prev,
        total: result.total || 0,
        totalPages: result.totalPages || 1,
      }));
    } catch (err) {
      if (fetchId !== lastFetchId.current) return;
      console.error('Failed to load products:', err);
      toast.error('Failed to load products');
    } finally {
      if (fetchId === lastFetchId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [
    pagination.page,
    pagination.limit,
    debouncedSearch,
    filters,
    sortBy,
    sortOrder,
  ]);

  // Initial load: categories and the first page of products.
  useEffect(() => {
    if (!canViewProducts) return;
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewProducts]);

  // Reload whenever the query state changes. `loadProducts` reads the
  // current values via closure, so this fires exactly once per change.
  useEffect(() => {
    if (!canViewProducts) return;
    loadProducts();
  }, [canViewProducts, loadProducts]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadProducts();
      toast.success('Products refreshed');
    } catch {
      // loadProducts handles its own error toast.
    }
  }, [loadProducts]);

  const handleDelete = useCallback(
    (product: Product) => {
      if (!canDeleteProducts) {
        toast.error("You don't have permission to delete products");
        return;
      }
      setProductToDelete(product);
      setShowDeleteModal(true);
    },
    [canDeleteProducts]
  );

  const confirmDelete = useCallback(async () => {
    if (!productToDelete) return;

    setDeleteLoading(true);
    try {
      const result = await productService.deleteProduct(productToDelete.id);

      if (result?.softDeleted) {
        toast.warning(
          result.message ||
            'Product has associated sales/orders and was deactivated instead'
        );
      } else {
        toast.success('Product deleted successfully');
      }

      setShowDeleteModal(false);
      setProductToDelete(null);
      await loadProducts();
    } catch (err: any) {
      console.error('Failed to delete product:', err);
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to delete product';

      if (
        message.toLowerCase().includes('foreign key') ||
        message.toLowerCase().includes('constraint')
      ) {
        toast.error(
          'Cannot delete: product is linked to sales, orders, or inventory records.'
        );
      } else {
        toast.error(message);
      }
    } finally {
      setDeleteLoading(false);
    }
  }, [productToDelete, loadProducts]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedProducts.length === 0) return;
    if (!canDeleteProducts) {
      toast.error("You don't have permission to delete products");
      return;
    }

    setDeleteLoading(true);
    try {
      const results = await Promise.allSettled(
        selectedProducts.map((id) => productService.deleteProduct(id))
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      // Log the first failure reason for diagnostics. The user only
      // needs the summary.
      if (failed > 0) {
        const firstRejection = results.find(
          (r) => r.status === 'rejected'
        ) as PromiseRejectedResult;
        console.warn(
          'Bulk delete: first failure',
          firstRejection?.reason
        );
      }

      if (failed > 0) {
        toast.warning(
          `${succeeded} products deleted, ${failed} failed (some may have associated records)`
        );
      } else {
        toast.success(`${succeeded} products deleted successfully`);
      }

      setSelectedProducts([]);
      setShowBulkDeleteModal(false);
      await loadProducts();
    } catch (err) {
      console.error('Bulk delete failed:', err);
      toast.error('Failed to delete products');
    } finally {
      setDeleteLoading(false);
    }
  }, [selectedProducts, canDeleteProducts, loadProducts]);

  const handleExport = useCallback(async () => {
    if (!canExportProducts) {
      toast.error("You don't have permission to export products");
      return;
    }
    try {
      setExporting(true);
      const blob = await productService.exportProducts('csv');

      // Only build the URL + trigger the download after the network
      // call resolves, so the spinner reflects actual work.
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `products_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Products exported successfully');
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Failed to export products');
    } finally {
      setExporting(false);
    }
  }, [canExportProducts]);

  // ============================================
  // BARCODE HANDLERS
  // ============================================

  const handleGenerateBarcode = useCallback(
    async (product: Product) => {
      if (!canManageBarcodes) {
        toast.error("You don't have permission to manage barcodes");
        return;
      }

      setSelectedProductForBarcode(product);
      setLoadingBarcode(true);
      setShowBarcodeModal(true);

      try {
        let info: BarcodeInfo;

        // `getProductBarcode` throws on 404 (no barcode). Treat that
        // as "generate a new one" rather than an error.
        try {
          if (product.barcode) {
            info = await productService.getProductBarcode(product.id);
          } else {
            info = await productService.generateBarcode(product.id);
            setProducts((prev) =>
              prev.map((p) =>
                p.id === product.id ? { ...p, barcode: info.barcode } : p
              )
            );
            toast.success('Barcode generated successfully');
          }
        } catch (err: any) {
          if (err?.response?.status === 404) {
            info = await productService.generateBarcode(product.id);
            setProducts((prev) =>
              prev.map((p) =>
                p.id === product.id ? { ...p, barcode: info.barcode } : p
              )
            );
            toast.success('Barcode generated successfully');
          } else {
            throw err;
          }
        }

        setBarcodeInfo({
          barcode: info.barcode,
          barcodeUrl: info.barcodeUrl,
          qrCodeUrl: info.qrCodeUrl,
          productId: info.productId,
          productName: info.productName,
          sku: info.sku,
          price: info.price,
          format: info.format,
          generatedAt: info.generatedAt,
        });
      } catch (err: any) {
        console.error('Failed to generate barcode:', err);
        toast.error(err?.message || 'Failed to generate barcode');
        setShowBarcodeModal(false);
      } finally {
        setLoadingBarcode(false);
      }
    },
    [canManageBarcodes]
  );

  const handleBulkGenerateBarcodes = useCallback(async () => {
    if (selectedProducts.length === 0) {
      toast.error('No products selected');
      return;
    }
    if (!canManageBarcodes) {
      toast.error("You don't have permission to manage barcodes");
      return;
    }

    try {
      const result = await productService.bulkGenerateBarcodes(
        selectedProducts
      );
      const successCount = result.results?.length || 0;
      const errorCount = result.errors?.length || 0;

      if (errorCount > 0) {
        toast.warning(
          `${successCount} barcodes generated, ${errorCount} failed`
        );
      } else {
        toast.success(`${successCount} barcodes generated successfully`);
      }

      await loadProducts();
      setSelectedProducts([]);
    } catch (err: any) {
      console.error('Failed to generate barcodes:', err);
      toast.error(err?.message || 'Failed to generate barcodes');
    }
  }, [selectedProducts, canManageBarcodes, loadProducts]);

  const handlePrintBarcode = useCallback(() => {
    if (!barcodeInfo || !selectedProductForBarcode) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const product = selectedProductForBarcode;

    printWindow.document.write(`
      <html>
        <head>
          <title>Barcode - ${product.name}</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: white; }
            .container { text-align: center; padding: 30px; border: 1px solid #ddd; border-radius: 8px; max-width: 400px; }
            .product-name { margin: 0 0 5px 0; font-size: 16px; font-weight: bold; }
            .sku { color: #666; font-size: 12px; margin: 0 0 15px 0; }
            .barcode-img { max-width: 300px; margin: 10px 0; }
            .qr-img { max-width: 120px; margin: 10px 0; }
            .price { font-size: 20px; font-weight: bold; color: #2563eb; margin: 5px 0; }
            .info { margin-top: 10px; font-size: 12px; color: #666; }
            .info span { margin: 0 8px; }
            .linked-badge { display: inline-block; background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 12px; font-size: 10px; margin-top: 5px; }
            @media print {
              .container { border: none; padding: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="product-name">${product.name || 'Product'}</div>
            <div class="sku">SKU: ${product.sku || 'N/A'}</div>
            ${
              product.inventoryId
                ? `<div class="linked-badge">Linked to Inventory</div>`
                : ''
            }
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
            <div class="price">${formatCurrency(product.unitPrice || 0)}</div>
            <div class="info">
              <span>${barcodeInfo.barcode}</span>
              ${
                product.category?.name
                  ? `<span>| ${product.category.name}</span>`
                  : ''
              }
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [barcodeInfo, selectedProductForBarcode]);

  const handleCopyBarcode = useCallback(async () => {
    if (!barcodeInfo?.barcode) return;
    try {
      await navigator.clipboard.writeText(barcodeInfo.barcode);
      toast.success('Barcode copied');
    } catch {
      toast.error('Failed to copy');
    }
  }, [barcodeInfo]);

  const handleDownloadBarcode = useCallback(() => {
    if (!barcodeInfo?.barcodeUrl) return;
    const link = document.createElement('a');
    link.href = barcodeInfo.barcodeUrl;
    link.download = `barcode-${
      selectedProductForBarcode?.sku || selectedProductForBarcode?.id || 'product'
    }.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Barcode downloaded');
  }, [barcodeInfo, selectedProductForBarcode]);

  const handleScanBarcode = useCallback(() => {
    const scanned = prompt('Enter barcode to search:');
    if (scanned !== null && scanned.trim()) {
      setSearchInput(scanned.trim());
      setPagination((prev) => ({ ...prev, page: 1 }));
    }
  }, []);

  // ============================================
  // HELPERS
  // ============================================

  const getStockStatus = useCallback((product: Product) => {
    const quantity = product.inventory?.quantity || 0;
    const reserved = product.inventory?.reserved || 0;
    const available = quantity - reserved;

    const variantAvailable =
      product.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) || 0;

    const totalAvailable = available + variantAvailable;

    if (totalAvailable <= 0) {
      return {
        label: 'Out of Stock',
        color:
          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
        icon: '🔴',
      };
    }
    if (totalAvailable <= (product.minStock || 5)) {
      return {
        label: 'Low Stock',
        color:
          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
        icon: '🟡',
      };
    }
    return {
      label: 'In Stock',
      color:
        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      icon: '🟢',
    };
  }, []);

  const renderStars = useCallback((rating: number = 0) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-3.5 h-3.5 ${
              star <= Math.round(rating)
                ? 'text-yellow-400 fill-current'
                : 'text-gray-300 dark:text-gray-600'
            }`}
          />
        ))}
        {rating > 0 && (
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
            {rating.toFixed(1)}
          </span>
        )}
      </div>
    );
  }, []);

  const hasActiveFilters = useMemo(() => {
    const f = filters;
    return Boolean(
      debouncedSearch ||
        f.categoryId ||
        f.status !== 'all' ||
        f.minPrice ||
        f.maxPrice ||
        f.hasBarcode !== 'all' ||
        f.featured !== 'all' ||
        f.inStock !== 'all' ||
        f.minRating ||
        f.hasVariants !== 'all' ||
        f.linkedToInventory !== 'all'
    );
  }, [debouncedSearch, filters]);

  const activeFilterCount = useMemo(() => {
    const values = Object.values(filters).filter(
      (v) => v && v !== 'all'
    ).length;
    return values + (debouncedSearch ? 1 : 0);
  }, [filters, debouncedSearch]);

  const clearFilters = useCallback(() => {
    setSearchInput('');
    setDebouncedSearch('');
    setFilters(DEFAULT_FILTERS);
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const toggleSort = useCallback(
    (field: SortField) => {
      setSortBy((prevField) => {
        if (prevField === field) {
          setSortOrder((prevOrder) => (prevOrder === 'asc' ? 'desc' : 'asc'));
          return prevField;
        }
        setSortOrder('asc');
        return field;
      });
      setPagination((prev) => ({ ...prev, page: 1 }));
    },
    []
  );

  const barcodeStats = useMemo(() => {
    const total = products.length;
    const withBarcode = products.filter((p) => p.barcode).length;
    const linkedToInventory = products.filter((p) => p.inventoryId).length;
    const withVariants = products.filter(
      (p) => p.variants && p.variants.length > 0
    ).length;
    return {
      total,
      withBarcode,
      withoutBarcode: total - withBarcode,
      linkedToInventory,
      withVariants,
    };
  }, [products]);

  const allVisibleSelected =
    products.length > 0 && selectedProducts.length === products.length;

  // ============================================
  // RENDER GATES
  // ============================================

  if (permissionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!canViewProducts) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to view products. Please contact your
          administrator.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  if (loading && products.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading products...
          </p>
        </div>
      </div>
    );
  }

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 transition-colors duration-200">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Package className="w-8 h-8 text-blue-500" />
              Catalog
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <p className="text-gray-500 dark:text-gray-400">
                {pagination.total} products • Manage your product catalog
              </p>
              <div className="flex items-center gap-2 text-sm">
                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                  {barcodeStats.withBarcode} with barcode
                </span>
                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                  {barcodeStats.withoutBarcode} without barcode
                </span>
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                  <Link2 className="w-3 h-3 inline" />{' '}
                  {barcodeStats.linkedToInventory} linked
                </span>
                <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
                  <Layers className="w-3 h-3 inline" />{' '}
                  {barcodeStats.withVariants} with variants
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              title="Refresh"
              aria-label="Refresh products"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
              />
            </button>
            <button
              type="button"
              onClick={handleScanBarcode}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              title="Scan Barcode"
              aria-label="Scan barcode"
            >
              <Scan className="w-4 h-4" />
            </button>
            {canExportProducts && (
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {exporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Export
              </button>
            )}
            {canCreateProducts && (
              <Link
                href="/admin/catalog/add"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Product
              </Link>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 transition-colors duration-200">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, SKU, or barcode..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                showFilters || hasActiveFilters
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
                aria-label="Table view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
                aria-label="Grid view"
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>

          {/* Expanded Filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <FilterSelect
                    label="Category"
                    value={filters.categoryId}
                    onChange={(v) => setFilters({ ...filters, categoryId: v })}
                  >
                    <option value="">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </FilterSelect>

                  <FilterSelect
                    label="Status"
                    value={filters.status}
                    onChange={(v) =>
                      setFilters({ ...filters, status: v as StatusFilter })
                    }
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </FilterSelect>

                  <FilterSelect
                    label="Barcode"
                    value={filters.hasBarcode}
                    onChange={(v) =>
                      setFilters({ ...filters, hasBarcode: v as TriState })
                    }
                  >
                    <option value="all">All Products</option>
                    <option value="yes">Has Barcode</option>
                    <option value="no">No Barcode</option>
                  </FilterSelect>

                  <FilterSelect
                    label="Featured"
                    value={filters.featured}
                    onChange={(v) =>
                      setFilters({ ...filters, featured: v as TriState })
                    }
                  >
                    <option value="all">All</option>
                    <option value="yes">Featured</option>
                    <option value="no">Not Featured</option>
                  </FilterSelect>

                  <FilterSelect
                    label="In Stock"
                    value={filters.inStock}
                    onChange={(v) =>
                      setFilters({ ...filters, inStock: v as TriState })
                    }
                  >
                    <option value="all">All</option>
                    <option value="yes">In Stock</option>
                    <option value="no">Out of Stock</option>
                  </FilterSelect>

                  <FilterSelect
                    label="Has Variants"
                    value={filters.hasVariants}
                    onChange={(v) =>
                      setFilters({ ...filters, hasVariants: v as TriState })
                    }
                  >
                    <option value="all">All</option>
                    <option value="yes">Has Variants</option>
                    <option value="no">No Variants</option>
                  </FilterSelect>

                  <FilterSelect
                    label="Linked to Inventory"
                    value={filters.linkedToInventory}
                    onChange={(v) =>
                      setFilters({
                        ...filters,
                        linkedToInventory: v as TriState,
                      })
                    }
                  >
                    <option value="all">All</option>
                    <option value="yes">Linked</option>
                    <option value="no">Not Linked</option>
                  </FilterSelect>

                  <FilterSelect
                    label="Min Rating"
                    value={filters.minRating}
                    onChange={(v) => setFilters({ ...filters, minRating: v })}
                  >
                    <option value="">All Ratings</option>
                    <option value="1">1+ Stars</option>
                    <option value="2">2+ Stars</option>
                    <option value="3">3+ Stars</option>
                    <option value="4">4+ Stars</option>
                  </FilterSelect>
                </div>

                {/* Price range */}
                <div className="mt-4 grid grid-cols-2 gap-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Min Price
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={filters.minPrice}
                      onChange={(e) =>
                        setFilters({ ...filters, minPrice: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Max Price
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={filters.maxPrice}
                      onChange={(e) =>
                        setFilters({ ...filters, maxPrice: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bulk actions bar */}
        <AnimatePresence>
          {selectedProducts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2"
            >
              <span className="text-sm text-blue-700 dark:text-blue-300">
                {selectedProducts.length} products selected
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {canManageBarcodes && (
                  <button
                    type="button"
                    onClick={handleBulkGenerateBarcodes}
                    className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors flex items-center gap-1"
                  >
                    <Barcode className="w-4 h-4" />
                    Generate Barcodes
                  </button>
                )}
                {canDeleteProducts && (
                  <button
                    type="button"
                    onClick={() => setShowBulkDeleteModal(true)}
                    className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Selected
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedProducts([])}
                  className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-300 transition-colors"
                >
                  <X className="w-4 h-4 inline mr-1" />
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Products */}
        {products.length === 0 ? (
          <EmptyState
            hasActiveFilters={hasActiveFilters}
            canCreateProducts={canCreateProducts}
            onClearFilters={clearFilters}
          />
        ) : viewMode === 'table' ? (
          <ProductTable
            products={products}
            pagination={pagination}
            canDeleteProducts={canDeleteProducts}
            canEditProducts={canEditProducts}
            canManageBarcodes={canManageBarcodes}
            selectedProducts={selectedProducts}
            setSelectedProducts={setSelectedProducts}
            allVisibleSelected={allVisibleSelected}
            sortBy={sortBy}
            toggleSort={toggleSort}
            getStockStatus={getStockStatus}
            renderStars={renderStars}
            getValidImage={getValidImage}
            handleImageError={handleImageError}
            onView={(p) => router.push(`/admin/catalog/${p.id}`)}
            onEdit={(p) => router.push(`/admin/catalog/edit/${p.id}`)}
            onDelete={handleDelete}
            onGenerateBarcode={handleGenerateBarcode}
            onPageChange={(page) =>
              setPagination((prev) => ({ ...prev, page }))
            }
          />
        ) : (
          <ProductGrid
            products={products}
            canDeleteProducts={canDeleteProducts}
            canEditProducts={canEditProducts}
            canManageBarcodes={canManageBarcodes}
            selectedProducts={selectedProducts}
            setSelectedProducts={setSelectedProducts}
            getStockStatus={getStockStatus}
            renderStars={renderStars}
            getValidImage={getValidImage}
            handleImageError={handleImageError}
            onView={(p) => router.push(`/admin/catalog/${p.id}`)}
            onEdit={(p) => router.push(`/admin/catalog/edit/${p.id}`)}
            onDelete={handleDelete}
            onGenerateBarcode={handleGenerateBarcode}
          />
        )}

        {/* Barcode Modal */}
        {showBarcodeModal && selectedProductForBarcode && (
          <BarcodeModal
            product={selectedProductForBarcode}
            barcodeInfo={barcodeInfo}
            loading={loadingBarcode}
            onClose={() => setShowBarcodeModal(false)}
            onCopy={handleCopyBarcode}
            onDownload={handleDownloadBarcode}
            onPrint={handlePrintBarcode}
            onGenerate={() =>
              handleGenerateBarcode(selectedProductForBarcode)
            }
          />
        )}

        {/* Delete Modal */}
        {showDeleteModal && productToDelete && (
          <DeleteModal
            variant="single"
            title="Delete Product"
            confirmLabel="Delete Product"
            loading={deleteLoading}
            onClose={() => setShowDeleteModal(false)}
            onConfirm={confirmDelete}
            warning={
              productToDelete.inventoryId
                ? 'This product is linked to inventory. Deleting it will unlink the inventory.'
                : undefined
            }
          >
            <>
              Are you sure you want to delete{' '}
              <strong className="text-gray-900 dark:text-white">
                {productToDelete.name}
              </strong>
              ?
            </>
          </DeleteModal>
        )}

        {/* Bulk Delete Modal */}
        {showBulkDeleteModal && (
          <DeleteModal
            variant="bulk"
            title="Delete Selected Products"
            confirmLabel={`Delete ${selectedProducts.length} Products`}
            loading={deleteLoading}
            onClose={() => setShowBulkDeleteModal(false)}
            onConfirm={handleBulkDelete}
          >
            <>
              Are you sure you want to delete{' '}
              <strong className="text-gray-900 dark:text-white">
                {selectedProducts.length}
              </strong>{' '}
              selected products? Products linked to sales or orders will be
              deactivated instead of deleted.
            </>
          </DeleteModal>
        )}
      </div>
    </div>
  );
}

// ============================================
// PRESENTATIONAL SUB-COMPONENTS
// ============================================

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}

function FilterSelect({ label, value, onChange, children }: FilterSelectProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
      >
        {children}
      </select>
    </div>
  );
}

interface EmptyStateProps {
  hasActiveFilters: boolean;
  canCreateProducts: boolean;
  onClearFilters: () => void;
}

function EmptyState({
  hasActiveFilters,
  canCreateProducts,
  onClearFilters,
}: EmptyStateProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center transition-colors duration-200">
      <Package className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        No products found
      </h3>
      <p className="text-gray-500 dark:text-gray-400 mt-2">
        {hasActiveFilters
          ? 'Try adjusting your filters'
          : 'Add your first product to get started'}
      </p>
      {canCreateProducts && !hasActiveFilters && (
        <Link
          href="/admin/catalog/add"
          className="mt-4 inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4 inline mr-2" />
          Add Product
        </Link>
      )}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-4 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Clear Filters
        </button>
      )}
    </div>
  );
}

interface ProductTableProps {
  products: Product[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  canDeleteProducts: boolean;
  canEditProducts: boolean;
  canManageBarcodes: boolean;
  selectedProducts: string[];
  setSelectedProducts: React.Dispatch<React.SetStateAction<string[]>>;
  allVisibleSelected: boolean;
  sortBy: SortField;
  toggleSort: (field: SortField) => void;
  getStockStatus: (p: Product) => {
    label: string;
    color: string;
    icon: string;
  };
  renderStars: (rating?: number) => React.ReactNode;
  getValidImage: (url: string | undefined) => string;
  handleImageError: (url: string) => void;
  onView: (p: Product) => void;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
  onGenerateBarcode: (p: Product) => void;
  onPageChange: (page: number) => void;
}

function ProductTable({
  products,
  pagination,
  canDeleteProducts,
  canEditProducts,
  canManageBarcodes,
  selectedProducts,
  setSelectedProducts,
  allVisibleSelected,
  sortBy,
  toggleSort,
  getStockStatus,
  renderStars,
  getValidImage,
  handleImageError,
  onView,
  onEdit,
  onDelete,
  onGenerateBarcode,
  onPageChange,
}: ProductTableProps) {
  const toggleSelection = (id: string) => {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (allVisibleSelected) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(products.map((p) => p.id));
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors duration-200">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
            <tr>
              {canDeleteProducts && (
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    aria-label="Select all products"
                  />
                </th>
              )}
              <SortableHeader
                label="Product"
                active={sortBy === 'name'}
                onClick={() => toggleSort('name')}
              />
              <SortableHeader
                label="SKU"
                active={sortBy === 'sku'}
                onClick={() => toggleSort('sku')}
              />
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Barcode
              </th>
              <SortableHeader
                label="Price"
                active={sortBy === 'unitPrice'}
                onClick={() => toggleSort('unitPrice')}
                align="right"
              />
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Stock
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {products.map((product) => {
              const stockStatus = getStockStatus(product);
              const isSelected = selectedProducts.includes(product.id);

              return (
                <tr
                  key={product.id}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${
                    isSelected ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                  }`}
                  onClick={() => onView(product)}
                >
                  {canDeleteProducts && (
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(product.id)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        aria-label={`Select ${product.name}`}
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                        {product.images?.[0] ? (
                          <img
                            src={getValidImage(product.images[0])}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={() =>
                              handleImageError(product.images![0])
                            }
                          />
                        ) : (
                          <Package className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {product.name}
                        </p>
                        <div className="flex flex-wrap items-center gap-1">
                          {product.category && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {product.category.name}
                            </span>
                          )}
                          {product.featured && (
                            <span className="text-xs text-yellow-500 flex items-center gap-0.5">
                              <Star className="w-3 h-3 fill-current" />
                              Featured
                            </span>
                          )}
                          {product.variants &&
                            product.variants.length > 0 && (
                              <span className="text-xs text-blue-500 flex items-center gap-0.5">
                                <Layers className="w-3 h-3" />
                                {product.variants.length} variants
                                {product.variants.some(
                                  (v) => v.images && v.images.length > 0
                                ) && (
                                  <ImageIcon className="w-3 h-3 text-purple-500 ml-0.5" />
                                )}
                              </span>
                            )}
                          {product.inventoryId && (
                            <span className="text-xs text-blue-500 flex items-center gap-0.5">
                              <Link2 className="w-3 h-3" />
                              Inventory
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono">
                    {product.sku}
                  </td>
                  <td className="px-4 py-3">
                    {product.barcode ? (
                      <div className="flex items-center gap-1">
                        <Barcode className="w-4 h-4 text-green-500" />
                        <span className="text-xs font-mono text-gray-600 dark:text-gray-300">
                          {product.barcode}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">
                        No barcode
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                    {formatCurrency(product.unitPrice)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {product.inventory?.quantity || 0}
                      </p>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${stockStatus.color}`}
                      >
                        {stockStatus.label}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          product.isActive
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        }`}
                      >
                        {product.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {product.rating && product.rating > 0 && (
                        <div>{renderStars(product.rating)}</div>
                      )}
                    </div>
                  </td>
                  <td
                    className="px-4 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      {canManageBarcodes && !product.barcode && (
                        <button
                          type="button"
                          onClick={() => onGenerateBarcode(product)}
                          className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                          title="Generate Barcode"
                          aria-label={`Generate barcode for ${product.name}`}
                        >
                          <Barcode className="w-4 h-4 text-green-500" />
                        </button>
                      )}
                      {product.barcode && (
                        <button
                          type="button"
                          onClick={() => onGenerateBarcode(product)}
                          className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                          title="View Barcode"
                          aria-label={`View barcode for ${product.name}`}
                        >
                          <QrCode className="w-4 h-4 text-blue-500" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onView(product)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        title="View Details"
                        aria-label={`View details for ${product.name}`}
                      >
                        <Eye className="w-4 h-4 text-gray-500" />
                      </button>
                      {canEditProducts && (
                        <button
                          type="button"
                          onClick={() => onEdit(product)}
                          className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                          title="Edit"
                          aria-label={`Edit ${product.name}`}
                        >
                          <Edit className="w-4 h-4 text-blue-500" />
                        </button>
                      )}
                      {canDeleteProducts && (
                        <button
                          type="button"
                          onClick={() => onDelete(product)}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                          title="Delete"
                          aria-label={`Delete ${product.name}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Showing {products.length} of {pagination.total} products
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
              disabled={pagination.page <= 1}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              onClick={() =>
                onPageChange(
                  Math.min(pagination.totalPages, pagination.page + 1)
                )
              }
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface SortableHeaderProps {
  label: string;
  active: boolean;
  onClick: () => void;
  align?: 'left' | 'right';
}

function SortableHeader({
  label,
  active,
  onClick,
  align = 'left',
}: SortableHeaderProps) {
  return (
    <th
      className={`px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
      onClick={onClick}
    >
      <div
        className={`flex items-center gap-1 ${
          align === 'right' ? 'justify-end' : ''
        }`}
      >
        {label}
        {active && <ArrowUpDown className="w-3 h-3" />}
      </div>
    </th>
  );
}

interface ProductGridProps {
  products: Product[];
  canDeleteProducts: boolean;
  canEditProducts: boolean;
  canManageBarcodes: boolean;
  selectedProducts: string[];
  setSelectedProducts: React.Dispatch<React.SetStateAction<string[]>>;
  getStockStatus: (p: Product) => {
    label: string;
    color: string;
    icon: string;
  };
  renderStars: (rating?: number) => React.ReactNode;
  getValidImage: (url: string | undefined) => string;
  handleImageError: (url: string) => void;
  onView: (p: Product) => void;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
  onGenerateBarcode: (p: Product) => void;
}

function ProductGrid({
  products,
  canDeleteProducts,
  canEditProducts,
  canManageBarcodes,
  selectedProducts,
  setSelectedProducts,
  getStockStatus,
  renderStars,
  getValidImage,
  handleImageError,
  onView,
  onEdit,
  onDelete,
  onGenerateBarcode,
}: ProductGridProps) {
  const toggleSelection = (id: string) => {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map((product) => {
        const stockStatus = getStockStatus(product);
        const isSelected = selectedProducts.includes(product.id);

        return (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -4 }}
            className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border transition-all ${
              isSelected
                ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-50'
                : 'border-gray-200 dark:border-gray-700 hover:shadow-md'
            }`}
          >
            <div
              className="relative aspect-square bg-gray-100 dark:bg-gray-700 rounded-t-xl overflow-hidden cursor-pointer"
              onClick={() => onView(product)}
            >
              {product.images?.[0] ? (
                <img
                  src={getValidImage(product.images[0])}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  onError={() => handleImageError(product.images![0])}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Package className="w-16 h-16 text-gray-300 dark:text-gray-500" />
                </div>
              )}
              <div className="absolute top-2 left-2 flex gap-1">
                {canDeleteProducts && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelection(product.id)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select ${product.name}`}
                  />
                )}
                {product.barcode && (
                  <span className="px-1.5 py-0.5 bg-green-500/80 text-white text-[8px] rounded flex items-center gap-0.5">
                    <Barcode className="w-3 h-3" />
                  </span>
                )}
                {product.inventoryId && (
                  <span className="px-1.5 py-0.5 bg-blue-500/80 text-white text-[8px] rounded flex items-center gap-0.5">
                    <Link2 className="w-3 h-3" />
                  </span>
                )}
              </div>
              {!product.isActive && (
                <div className="absolute top-2 right-2 px-2 py-1 bg-red-600 text-white text-xs rounded">
                  Inactive
                </div>
              )}
              {product.featured && (
                <div className="absolute top-2 right-2 px-2 py-1 bg-yellow-500 text-white text-xs rounded">
                  <Star className="w-3 h-3 fill-current" />
                </div>
              )}
              <div className="absolute bottom-2 left-2 px-2 py-1 rounded text-xs font-medium bg-black/50 text-white">
                {stockStatus.icon} {stockStatus.label}
              </div>
              {product.variants && product.variants.length > 0 && (
                <div className="absolute bottom-2 right-2 px-2 py-1 bg-blue-500/80 text-white text-xs rounded flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  {product.variants.length}
                  {product.variants.some(
                    (v) => v.images && v.images.length > 0
                  ) && (
                    <ImageIcon className="w-3 h-3 text-purple-300" />
                  )}
                </div>
              )}
            </div>

            <div className="p-4">
              <div className="flex items-start justify-between mb-1">
                <h3 className="font-medium text-gray-900 dark:text-white truncate">
                  {product.name}
                </h3>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(product.unitPrice)}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                SKU: {product.sku}
              </p>
              {product.category && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {product.category.name}
                </span>
              )}
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1 text-sm">
                  <Package className="w-4 h-4 text-gray-400" />
                  <span>{product.inventory?.quantity || 0} in stock</span>
                </div>
                {product.rating && product.rating > 0 && (
                  <div>{renderStars(product.rating)}</div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-1">
                {canManageBarcodes && !product.barcode && (
                  <button
                    type="button"
                    onClick={() => onGenerateBarcode(product)}
                    className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                    title="Generate Barcode"
                    aria-label={`Generate barcode for ${product.name}`}
                  >
                    <Barcode className="w-4 h-4 text-green-500" />
                  </button>
                )}
                {product.barcode && (
                  <button
                    type="button"
                    onClick={() => onGenerateBarcode(product)}
                    className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                    title="View Barcode"
                    aria-label={`View barcode for ${product.name}`}
                  >
                    <QrCode className="w-4 h-4 text-blue-500" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onView(product)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title="View Details"
                  aria-label={`View details for ${product.name}`}
                >
                  <Eye className="w-4 h-4 text-gray-500" />
                </button>
                {canEditProducts && (
                  <button
                    type="button"
                    onClick={() => onEdit(product)}
                    className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                    title="Edit"
                    aria-label={`Edit ${product.name}`}
                  >
                    <Edit className="w-4 h-4 text-blue-500" />
                  </button>
                )}
                {canDeleteProducts && (
                  <button
                    type="button"
                    onClick={() => onDelete(product)}
                    className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                    title="Delete"
                    aria-label={`Delete ${product.name}`}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

interface BarcodeModalProps {
  product: Product;
  barcodeInfo: BarcodeInfo | null;
  loading: boolean;
  onClose: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onPrint: () => void;
  onGenerate: () => void;
}

function BarcodeModal({
  product,
  barcodeInfo,
  loading,
  onClose,
  onCopy,
  onDownload,
  onPrint,
  onGenerate,
}: BarcodeModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            {product.barcode ? (
              <QrCode className="w-6 h-6 text-blue-600" />
            ) : (
              <Barcode className="w-6 h-6 text-blue-600" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {product.barcode ? 'Product Barcode' : 'Generate Barcode'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {product.name}
            </p>
            {product.inventoryId && (
              <span className="text-xs text-blue-500 flex items-center gap-0.5">
                <Link2 className="w-3 h-3" /> Linked to Inventory
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Generating barcode...
            </p>
          </div>
        ) : barcodeInfo ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
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
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="h-12 flex items-center justify-center text-gray-400">
                      No barcode
                    </div>
                  )}
                  <p className="text-xs font-mono text-gray-600 dark:text-gray-400 mt-1 text-center">
                    {barcodeInfo.barcode}
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
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={onCopy}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-sm"
              >
                <Copy className="w-4 h-4" />
                Copy
              </button>
              <button
                type="button"
                onClick={onDownload}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-sm"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <button
                type="button"
                onClick={onPrint}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Barcode className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              No barcode available
            </p>
            <button
              type="button"
              onClick={onGenerate}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Generate Barcode
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface DeleteModalProps {
  variant: 'single' | 'bulk';
  title: string;
  confirmLabel: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
  warning?: string;
  children: React.ReactNode;
}

function DeleteModal({
  title,
  confirmLabel,
  loading,
  onClose,
  onConfirm,
  warning,
  children,
}: DeleteModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {title}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              This action cannot be undone
            </p>
          </div>
        </div>

        <p className="text-gray-600 dark:text-gray-300 mb-4">{children}</p>

        {warning && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {warning}
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {loading ? 'Deleting...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
