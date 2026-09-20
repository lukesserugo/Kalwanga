// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\inventory\export\page.tsx

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Download, Loader2, FileText, FileSpreadsheet,
  CheckCircle, AlertCircle, AlertTriangle, Package,
  Filter, Calendar, Building, Tag, Truck, RefreshCw,
  X, ChevronDown, ChevronUp, Info, Shield, Clock,
  DollarSign, Lock, Database, BarChart3, PieChart,
  TrendingUp, TrendingDown, Users, Layers, Search,
  Plus, Minus, Edit, Eye, Trash2, Copy, Printer,
  Link2, ExternalLink,
} from 'lucide-react';

import { inventoryService } from '../../../../../services/inventoryService';
import { toast } from '../../../../../utils/toast-manager';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import { useAuth } from '../../../../../hooks/useAuth';
import {
  formatCurrency,
  formatDate,
  formatNumber,
} from '../../../../../utils/formatters';

// ============================================
// TYPES
// ============================================

interface ExportFilters {
  category: string;
  location: string;
  supplier: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  includeInactive: boolean;
  includeLowStock: boolean;
  includeOutOfStock: boolean;
  includeImages: boolean;
  includeTags: boolean;
  includeDescription: boolean;
  includeCostPrice: boolean;
  includeTaxRate: boolean;
  includeWeight: boolean;
}

interface ExportItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  stock?: number;
  unit: string;
  unitPrice: number;
  price?: number;
  costPrice?: number;
  location: string;
  supplier: string;
  minStock: number;
  maxStock: number;
  description?: string;
  tags?: string[];
  images?: string[];
  weight?: number;
  taxRate?: number;
  createdAt: string;
  updatedAt: string;
  isActive?: boolean;
  isDigital?: boolean;
  featured?: boolean;
  expiryDate?: string;
  batchNumber?: string;
}

interface ExportStats {
  totalItems: number;
  totalValue: number;
  totalCost?: number;
  potentialProfit?: number;
  lowStockCount: number;
  outOfStockCount: number;
  categories: number;
  suppliers: number;
  withImages: number;
  withBarcode: number;
}

interface ExportHistory {
  id: string;
  fileName: string;
  format: string;
  date: string;
  count: number;
  status: 'completed' | 'failed' | 'processing';
  size?: string;
}

// ============================================
// CONSTANTS
// ============================================

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'low_stock', label: 'Low Stock' },
  { value: 'out_of_stock', label: 'Out of Stock' },
  { value: 'discontinued', label: 'Discontinued' },
];

const EXPORT_FORMATS = [
  { value: 'csv', label: 'CSV', icon: FileText, color: 'brand' },
  { value: 'excel', label: 'Excel', icon: FileSpreadsheet, color: 'success' },
];

// ============================================
// SUB-COMPONENTS
// ============================================

const FormatOption: React.FC<{
  format: {
    value: string;
    label: string;
    icon: React.ElementType;
    color: string;
  };
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}> = ({ format, isSelected, onClick, disabled, loading }) => {
  const Icon = format.icon;

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className={`
        bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 p-6 text-left
        transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-1
        transform hover:scale-[1.02] active:scale-[0.98] focus-ring
        ${
          isSelected
            ? 'border-brand-500 dark:border-brand-400 ring-2 ring-brand-500/20'
            : 'border-gray-200 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-600'
        }
      `}
    >
      <div
        className={`p-3 rounded-lg inline-block mb-3 ${
          isSelected
            ? 'bg-brand-100 dark:bg-brand-950/30'
            : 'bg-gray-100 dark:bg-gray-700'
        }`}
      >
        <Icon
          className={`w-6 h-6 ${
            isSelected
              ? 'text-brand-600 dark:text-brand-400'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        />
      </div>

      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        {format.label}
      </h3>

      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Export as {format.label} file
      </p>

      <div className="mt-4 flex items-center gap-2 text-sm font-medium text-brand-600 dark:text-brand-400">
        {loading && isSelected ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            Export {format.label}
          </>
        )}
      </div>

      {isSelected && (
        <div className="mt-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-100 dark:bg-brand-950/30 text-brand-700 dark:text-brand-300 text-xs rounded-full">
            <CheckCircle className="w-3 h-3" />
            Selected
          </span>
        </div>
      )}
    </motion.button>
  );
};

const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  subtext?: string;
}> = ({ label, value, icon: Icon, color, subtext }) => {
  const colorClasses: Record<string, string> = {
    brand: 'bg-brand-50 dark:bg-brand-950/20 text-brand-600 dark:text-brand-400',
    success: 'bg-success-50 dark:bg-success-950/20 text-success-600 dark:text-success-400',
    warning: 'bg-warning-50 dark:bg-warning-950/20 text-warning-600 dark:text-warning-400',
    danger: 'bg-brand-accent-50 dark:bg-brand-accent-950/20 text-brand-accent-600 dark:text-brand-accent-400',
    secondary: 'bg-secondary-50 dark:bg-secondary-950/20 text-secondary-600 dark:text-secondary-400',
    indigo: 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400',
    teal: 'bg-teal-50 dark:bg-teal-950/20 text-teal-600 dark:text-teal-400',
    orange: 'bg-brand-50 dark:bg-brand-950/20 text-brand-600 dark:text-brand-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${colorClasses[color] || colorClasses.brand} rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {label}
          </p>

          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">
            {value}
          </p>

          {subtext && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {subtext}
            </p>
          )}
        </div>

        <div className="p-2 rounded-lg bg-white dark:bg-gray-700/50">
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </motion.div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function InventoryExportPage() {
  const router = useRouter();
  const { hasPermission } = usePermission();
  const { user, isAuthenticated } = useAuth();

  const [isExporting, setIsExporting] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'excel'>('csv');
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [exportHistory, setExportHistory] = useState<ExportHistory[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [lastExport, setLastExport] = useState<{
    format: string;
    date: string;
    count: number;
    fileName: string;
  } | null>(null);

  const [stats, setStats] = useState<ExportStats>({
    totalItems: 0,
    totalValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    categories: 0,
    suppliers: 0,
    withImages: 0,
    withBarcode: 0,
  });

  const [filterState, setFilterState] = useState<ExportFilters>({
    category: '',
    location: '',
    supplier: '',
    status: 'all',
    dateFrom: '',
    dateTo: '',
    includeInactive: false,
    includeLowStock: false,
    includeOutOfStock: false,
    includeImages: false,
    includeTags: false,
    includeDescription: false,
    includeCostPrice: false,
    includeTaxRate: false,
    includeWeight: false,
  });

  const businessUnitId =
    user?.businessUnits?.[0]?.businessUnitId ||
    (user?.businessUnits?.[0] as { id?: string } | undefined)?.id ||
    (typeof window !== 'undefined'
      ? window.localStorage.getItem('businessUnitId')
      : null) ||
    '';

  const canExportInventory =
    hasPermission(`${PermissionResource.INVENTORY}:export`) ||
    hasPermission(`${PermissionResource.INVENTORY}:manage`) ||
    user?.role === 'SUPER_ADMIN';

  const normalizeInventoryItem = useCallback(
    (item: any): ExportItem => {
      return {
        id: item?.id || '',
        name: item?.name || item?.product?.name || 'Unknown',
        sku: item?.sku || item?.product?.sku || 'N/A',
        category:
          item?.category ||
          item?.product?.category?.name ||
          'Uncategorized',
        quantity: item?.quantity ?? item?.stock ?? 0,
        stock: item?.quantity ?? item?.stock ?? 0,
        unit: item?.unit || 'each',
        unitPrice:
          item?.unitPrice ??
          item?.price ??
          item?.product?.unitPrice ??
          0,
        price:
          item?.unitPrice ??
          item?.price ??
          item?.product?.unitPrice ??
          0,
        costPrice:
          item?.costPrice ??
          item?.product?.costPrice ??
          0,
        location: item?.location || 'Warehouse',
        supplier:
          item?.supplier ||
          item?.product?.supplier?.name ||
          '',
        minStock:
          item?.minStock ??
          item?.reorderPoint ??
          5,
        maxStock:
          item?.maxStock ??
          item?.reorderQuantity ??
          100,
        description:
          item?.description ||
          item?.product?.description ||
          '',
        tags:
          Array.isArray(item?.tags)
            ? item.tags
            : Array.isArray(item?.product?.tags)
              ? item.product.tags
              : [],
        images:
          Array.isArray(item?.images)
            ? item.images
            : Array.isArray(item?.product?.images)
              ? item.product.images
              : [],
        weight:
          item?.weight ??
          item?.product?.weight ??
          0,
        taxRate:
          item?.taxRate ??
          item?.product?.taxRate ??
          0,
        createdAt:
          item?.createdAt ||
          new Date().toISOString(),
        updatedAt:
          item?.updatedAt ||
          new Date().toISOString(),
        isActive:
          item?.isActive !== undefined
            ? item.isActive
            : true,
        isDigital: item?.isDigital || false,
        featured: item?.featured || false,
        expiryDate: item?.expiryDate || '',
        batchNumber: item?.batchNumber || '',
      };
    },
    [],
  );

  const getActiveFilterCount = useCallback((): number => {
    let count = 0;

    if (filterState.category) count++;
    if (filterState.location) count++;
    if (filterState.supplier) count++;
    if (filterState.status !== 'all') count++;
    if (filterState.dateFrom) count++;
    if (filterState.dateTo) count++;
    if (filterState.includeInactive) count++;
    if (filterState.includeLowStock) count++;
    if (filterState.includeOutOfStock) count++;
    if (filterState.includeImages) count++;
    if (filterState.includeTags) count++;
    if (filterState.includeDescription) count++;
    if (filterState.includeCostPrice) count++;
    if (filterState.includeTaxRate) count++;
    if (filterState.includeWeight) count++;

    return count;
  }, [filterState]);

  const loadStats = useCallback(async () => {
    if (!businessUnitId) {
      setLoadingStats(false);
      return;
    }

    setLoadingStats(true);

    try {
      const summary = await inventoryService.getInventorySummary(businessUnitId);
      const lowStockItems = await inventoryService.getLowStockItems(businessUnitId);
      const outOfStockItems = await inventoryService.getOutOfStockItems(businessUnitId);

      setStats({
        totalItems: summary?.totalItems || 0,
        totalValue: summary?.totalValue || 0,
        totalCost: summary?.totalCost || 0,
        potentialProfit: (summary?.totalValue || 0) - (summary?.totalCost || 0),
        lowStockCount: lowStockItems?.length || 0,
        outOfStockCount: outOfStockItems?.length || 0,
        categories: summary?.categories?.length || 0,
        suppliers: 0,
        withImages: 0,
        withBarcode: 0,
      });
    } catch (error) {
      console.warn('Failed to load inventory statistics:', error);
    } finally {
      setLoadingStats(false);
    }
  }, [businessUnitId]);

  useEffect(() => {
    if (isAuthenticated && businessUnitId) {
      void loadStats();
    }
  }, [isAuthenticated, businessUnitId, loadStats]);

  const handleExport = useCallback(async () => {
    if (!canExportInventory) {
      toast.error("You don't have permission to export inventory");
      return;
    }

    if (!businessUnitId) {
      const message = 'No business unit is available for export.';
      setExportError(message);
      toast.error(message);
      return;
    }

    setIsExporting(true);
    setExportProgress(0);
    setExportError(null);
    setExportSuccess(false);

    let progressInterval: ReturnType<typeof setInterval> | null = null;

    try {
      progressInterval = setInterval(() => {
        setExportProgress((previous) => Math.min(previous + 8, 90));
      }, 200);

      const response = await inventoryService.getAllInventory(businessUnitId);

      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }

      setExportProgress(95);

      let items: ExportItem[] = [];

      if (Array.isArray(response)) {
        items = response.map(normalizeInventoryItem);
      } else if (
        response &&
        typeof response === 'object' &&
        Array.isArray((response as { items?: unknown[] }).items)
      ) {
        items = (response as { items: unknown[] }).items.map(normalizeInventoryItem);
      } else if (response && typeof response === 'object') {
        const possibleArray = Object.values(response as unknown as Record<string, unknown>).find((value) => Array.isArray(value));

        if (Array.isArray(possibleArray)) {
          items = possibleArray.map(normalizeInventoryItem);
        }
      }

      let filteredItems = [...items];

      if (filterState.category) {
        const category = filterState.category.toLowerCase();
        filteredItems = filteredItems.filter((item) => item.category.toLowerCase().includes(category));
      }

      if (filterState.location) {
        const location = filterState.location.toLowerCase();
        filteredItems = filteredItems.filter((item) => item.location.toLowerCase().includes(location));
      }

      if (filterState.supplier) {
        const supplier = filterState.supplier.toLowerCase();
        filteredItems = filteredItems.filter((item) => item.supplier.toLowerCase().includes(supplier));
      }

      if (filterState.status === 'active') {
        filteredItems = filteredItems.filter((item) => item.isActive !== false);
      } else if (filterState.status === 'inactive') {
        filteredItems = filteredItems.filter((item) => item.isActive === false);
      } else if (filterState.status === 'low_stock') {
        filteredItems = filteredItems.filter((item) => {
          const quantity = item.quantity || 0;
          const reorderPoint = item.minStock || 5;
          return quantity > 0 && quantity <= reorderPoint;
        });
      } else if (filterState.status === 'out_of_stock') {
        filteredItems = filteredItems.filter((item) => (item.quantity || 0) === 0);
      }

      if (filterState.includeLowStock) {
        filteredItems = filteredItems.filter((item) => {
          const quantity = item.quantity || 0;
          const reorderPoint = item.minStock || 5;
          return quantity > 0 && quantity <= reorderPoint;
        });
      }

      if (filterState.includeOutOfStock) {
        filteredItems = filteredItems.filter((item) => (item.quantity || 0) === 0);
      }

      if (!filterState.includeInactive) {
        filteredItems = filteredItems.filter((item) => item.isActive !== false);
      }

      setExportProgress(100);

      const headers: string[] = ['ID', 'Name', 'SKU', 'Category', 'Quantity', 'Unit', 'Unit Price'];

      if (filterState.includeCostPrice) headers.push('Cost Price');
      if (filterState.includeTaxRate) headers.push('Tax Rate');
      if (filterState.includeWeight) headers.push('Weight (kg)');
      if (filterState.includeDescription) headers.push('Description');
      if (filterState.includeTags) headers.push('Tags');
      if (filterState.includeImages) headers.push('Images');

      headers.push('Location', 'Supplier', 'Min Stock', 'Max Stock', 'Created At', 'Updated At', 'Status');

      let exportContent = '';

      const escapeCsv = (value: unknown): string => {
        const stringValue = value == null ? '' : String(value);
        return `"${stringValue.replace(/"/g, '""')}"`;
      };

      const escapeXml = (value: unknown): string => {
        return String(value ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
      };

      if (selectedFormat === 'csv') {
        exportContent = headers.map(escapeCsv).join(',') + '\n';

        for (const item of filteredItems) {
          const row: string[] = [
            escapeCsv(item.id),
            escapeCsv(item.name),
            escapeCsv(item.sku),
            escapeCsv(item.category),
            String(item.quantity || 0),
            escapeCsv(item.unit),
            String(item.unitPrice || 0),
          ];

          if (filterState.includeCostPrice) row.push(String(item.costPrice || 0));
          if (filterState.includeTaxRate) row.push(String(item.taxRate || 0));
          if (filterState.includeWeight) row.push(String(item.weight || 0));
          if (filterState.includeDescription) row.push(escapeCsv(item.description || ''));
          if (filterState.includeTags) row.push(escapeCsv((item.tags || []).join(', ')));
          if (filterState.includeImages) row.push(escapeCsv((item.images || []).join(', ')));

          row.push(
            escapeCsv(item.location),
            escapeCsv(item.supplier),
            String(item.minStock || 5),
            String(item.maxStock || 100),
            escapeCsv(item.createdAt),
            escapeCsv(item.updatedAt),
            escapeCsv(item.isActive !== false ? 'Active' : 'Inactive'),
          );

          exportContent += row.join(',') + '\n';
        }
      } else {
        exportContent = '<?xml version="1.0"?>\n';
        exportContent += '<?mso-application progid="Excel.Sheet"?>\n';
        exportContent += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
        exportContent += ' xmlns:o="urn:schemas-microsoft-com:office:office"\n';
        exportContent += ' xmlns:x="urn:schemas-microsoft-com:office:excel"\n';
        exportContent += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
        exportContent += ' <Worksheet ss:Name="Inventory">\n';
        exportContent += '  <Table>\n';
        exportContent += '   <Row>\n';

        for (const header of headers) {
          exportContent += `    <Cell><Data ss:Type="String">${escapeXml(header)}</Data></Cell>\n`;
        }

        exportContent += '   </Row>\n';

        for (const item of filteredItems) {
          exportContent += '   <Row>\n';

          const values: Array<string | number> = [
            item.id,
            item.name,
            item.sku,
            item.category,
            item.quantity || 0,
            item.unit,
            item.unitPrice || 0,
          ];

          if (filterState.includeCostPrice) values.push(item.costPrice || 0);
          if (filterState.includeTaxRate) values.push(item.taxRate || 0);
          if (filterState.includeWeight) values.push(item.weight || 0);
          if (filterState.includeDescription) values.push(item.description || '');
          if (filterState.includeTags) values.push((item.tags || []).join(', '));
          if (filterState.includeImages) values.push((item.images || []).join(', '));

          values.push(
            item.location,
            item.supplier,
            item.minStock || 5,
            item.maxStock || 100,
            item.createdAt,
            item.updatedAt,
            item.isActive !== false ? 'Active' : 'Inactive',
          );

          for (const value of values) {
            const type = typeof value === 'number' ? 'Number' : 'String';
            exportContent += `    <Cell><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>\n`;
          }

          exportContent += '   </Row>\n';
        }

        exportContent += '  </Table>\n';
        exportContent += ' </Worksheet>\n';
        exportContent += '</Workbook>';
      }

      const mimeType = selectedFormat === 'csv' ? 'text/csv;charset=utf-8;' : 'application/vnd.ms-excel';

      const blob = new Blob([exportContent], { type: mimeType });

      const url = window.URL.createObjectURL(blob);

      const timestamp = new Date().toISOString().split('T')[0];

      const extension = selectedFormat === 'csv' ? 'csv' : 'xls';

      const fileName = `inventory-export-${timestamp}.${extension}`;

      const link = document.createElement('a');

      link.href = url;
      link.setAttribute('download', fileName);

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);

      const historyEntry: ExportHistory = {
        id: `export-${Date.now()}`,
        fileName,
        format: selectedFormat.toUpperCase(),
        date: new Date().toLocaleString(),
        count: filteredItems.length,
        status: 'completed',
      };

      setExportHistory((previous) => [historyEntry, ...previous]);

      setLastExport({
        format: selectedFormat.toUpperCase(),
        date: new Date().toLocaleString(),
        count: filteredItems.length,
        fileName,
      });

      setExportSuccess(true);

      toast.success(`${filteredItems.length} items exported as ${selectedFormat.toUpperCase()}`);

      window.setTimeout(() => setExportSuccess(false), 5000);
    } catch (error: unknown) {
      console.error('Export failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'Failed to export inventory';

      setExportError(errorMessage);
      toast.error(errorMessage);

      const historyEntry: ExportHistory = {
        id: `export-${Date.now()}`,
        fileName: `export-failed-${new Date().toISOString().split('T')[0]}`,
        format: selectedFormat.toUpperCase(),
        date: new Date().toLocaleString(),
        count: 0,
        status: 'failed',
      };

      setExportHistory((previous) => [historyEntry, ...previous]);
    } finally {
      if (progressInterval) {
        clearInterval(progressInterval);
      }

      setIsExporting(false);
      setExportProgress(0);
    }
  }, [businessUnitId, selectedFormat, filterState, canExportInventory, normalizeInventoryItem]);

  const handleClearFilters = useCallback(() => {
    setFilterState({
      category: '',
      location: '',
      supplier: '',
      status: 'all',
      dateFrom: '',
      dateTo: '',
      includeInactive: false,
      includeLowStock: false,
      includeOutOfStock: false,
      includeImages: false,
      includeTags: false,
      includeDescription: false,
      includeCostPrice: false,
      includeTaxRate: false,
      includeWeight: false,
    });
  }, []);

  const activeFilterCount = getActiveFilterCount();

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Please Login</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">You need to be logged in to export inventory.</p>
      </div>
    );
  }

  if (!canExportInventory) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Shield className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Denied</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">You don't have permission to export inventory.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="p-2 hover:bg-brand-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>

            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Download className="w-7 h-7 sm:w-8 sm:h-8 text-brand-500" />
                Export Inventory
              </h1>

              <p className="text-sm text-gray-500 dark:text-gray-400">
                Export your inventory data in various formats
              </p>
            </div>
          </div>

          <span className="text-xs text-gray-400 dark:text-gray-500">
            {businessUnitId ? `BU: ${businessUnitId.slice(0, 8)}...` : 'No BU'}
          </span>
        </div>

        {exportError && (
          <div className="mb-6 p-4 bg-brand-accent-50 dark:bg-brand-accent-950/20 border border-brand-accent-200 dark:border-brand-accent-800 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-brand-accent-600 dark:text-brand-accent-400 flex-shrink-0 mt-0.5" />

            <div className="flex-1">
              <p className="text-sm text-brand-accent-700 dark:text-brand-accent-300">
                {exportError}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setExportError(null)}
              className="p-1 hover:bg-brand-accent-100 dark:hover:bg-brand-accent-800/30 rounded transition focus-ring"
              aria-label="Dismiss error"
            >
              <X className="w-4 h-4 text-brand-accent-600 dark:text-brand-accent-400" />
            </button>
          </div>
        )}

        {exportSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-success-50 dark:bg-success-950/20 border border-success-200 dark:border-success-800 rounded-xl flex items-center gap-3"
          >
            <CheckCircle className="w-5 h-5 text-success-600 dark:text-success-400" />

            <p className="text-sm text-success-700 dark:text-success-300">
              Export completed successfully!
            </p>
          </motion.div>
        )}

        <AnimatePresence>
          {isExporting && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 bg-brand-50 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-800 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-brand-600 dark:text-brand-400 animate-spin" />

                <div className="flex-1">
                  <p className="text-sm font-medium text-brand-800 dark:text-brand-300">
                    Exporting inventory...
                  </p>

                  <div className="w-full bg-brand-200 dark:bg-brand-700 rounded-full h-2 mt-1">
                    <motion.div
                      className="bg-brand-600 dark:bg-brand-400 rounded-full h-2"
                      initial={{ width: 0 }}
                      animate={{ width: `${exportProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>

                <span className="text-sm text-brand-600 dark:text-brand-400 font-medium tabular-nums">
                  {exportProgress}%
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Items" value={formatNumber(stats.totalItems)} icon={Package} color="brand" />
          <StatCard label="Total Value" value={formatCurrency(stats.totalValue)} icon={DollarSign} color="success" />
          <StatCard label="Low Stock" value={stats.lowStockCount} icon={AlertTriangle} color="warning" />
          <StatCard label="Out of Stock" value={stats.outOfStockCount} icon={AlertCircle} color="danger" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {EXPORT_FORMATS.map((format) => (
            <FormatOption
              key={format.value}
              format={format}
              isSelected={selectedFormat === format.value}
              onClick={() => setSelectedFormat(format.value as 'csv' | 'excel')}
              disabled={isExporting}
              loading={isExporting}
            />
          ))}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
          <button
            type="button"
            onClick={() => setShowFilters((previous) => !previous)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-brand-50/50 dark:hover:bg-gray-700 transition-colors focus-ring"
          >
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Export Filters</h3>
              <span className="text-sm text-gray-500">(Optional)</span>
              {activeFilterCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-brand-600 text-white text-xs rounded-full tabular-nums">
                  {activeFilterCount}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleClearFilters();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      event.stopPropagation();
                      handleClearFilters();
                    }
                  }}
                  className="text-xs text-brand-accent-600 hover:text-brand-accent-800 dark:text-brand-accent-400 dark:hover:text-brand-accent-300 focus-ring"
                >
                  Clear All
                </span>
              )}

              <span className="text-gray-400">
                {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </span>
            </div>
          </button>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="p-6 pt-0 border-t border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                      <input
                        type="text"
                        value={filterState.category}
                        onChange={(event) =>
                          setFilterState((previous) => ({
                            ...previous,
                            category: event.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                        placeholder="Filter by category"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                      <input
                        type="text"
                        value={filterState.location}
                        onChange={(event) =>
                          setFilterState((previous) => ({
                            ...previous,
                            location: event.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                        placeholder="Filter by location"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Supplier</label>
                      <input
                        type="text"
                        value={filterState.supplier}
                        onChange={(event) =>
                          setFilterState((previous) => ({
                            ...previous,
                            supplier: event.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                        placeholder="Filter by supplier"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                      <select
                        value={filterState.status}
                        onChange={(event) =>
                          setFilterState((previous) => ({
                            ...previous,
                            status: event.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date From</label>
                      <input
                        type="date"
                        value={filterState.dateFrom}
                        onChange={(event) =>
                          setFilterState((previous) => ({
                            ...previous,
                            dateFrom: event.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date To</label>
                      <input
                        type="date"
                        value={filterState.dateTo}
                        onChange={(event) =>
                          setFilterState((previous) => ({
                            ...previous,
                            dateTo: event.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filterState.includeInactive}
                        onChange={(event) =>
                          setFilterState((previous) => ({
                            ...previous,
                            includeInactive: event.target.checked,
                          }))
                        }
                        className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 transition-colors"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Include inactive items</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filterState.includeLowStock}
                        onChange={(event) =>
                          setFilterState((previous) => ({
                            ...previous,
                            includeLowStock: event.target.checked,
                          }))
                        }
                        className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 transition-colors"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Only low stock items</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filterState.includeOutOfStock}
                        onChange={(event) =>
                          setFilterState((previous) => ({
                            ...previous,
                            includeOutOfStock: event.target.checked,
                          }))
                        }
                        className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 transition-colors"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Only out of stock items</span>
                    </label>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Include Additional Fields</p>

                    <div className="flex flex-wrap gap-4">
                      {[
                        ['includeImages', 'Images'],
                        ['includeTags', 'Tags'],
                        ['includeDescription', 'Description'],
                        ['includeCostPrice', 'Cost Price'],
                        ['includeTaxRate', 'Tax Rate'],
                        ['includeWeight', 'Weight'],
                      ].map(([field, label]) => (
                        <label key={field} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(filterState[field as keyof ExportFilters])}
                            onChange={(event) =>
                              setFilterState((previous) => ({
                                ...previous,
                                [field]: event.target.checked,
                              }))
                            }
                            className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 transition-colors"
                          />

                          <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
            {stats.totalItems > 0 ? `${formatNumber(stats.totalItems)} items available` : 'No items to export'}
          </div>

          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting || stats.totalItems === 0}
            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-brand focus-ring"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isExporting ? 'Exporting...' : `Export ${selectedFormat.toUpperCase()}`}
          </button>
        </div>

        {exportHistory.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mt-6">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                Export History
              </h3>
            </div>

            <div className="p-4 space-y-2">
              {exportHistory.slice(0, 10).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-3 min-w-0">
                    {entry.format === 'CSV' ? (
                      <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    ) : (
                      <FileSpreadsheet className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )}

                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{entry.fileName}</p>

                      <p className="text-xs text-gray-500 tabular-nums">
                        {entry.date} • {entry.count} items
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      entry.status === 'completed'
                        ? 'bg-success-100 dark:bg-success-950/30 text-success-700 dark:text-success-300'
                        : entry.status === 'failed'
                          ? 'bg-brand-accent-100 dark:bg-brand-accent-950/30 text-brand-accent-700 dark:text-brand-accent-300'
                          : 'bg-warning-100 dark:bg-warning-950/30 text-warning-700 dark:text-warning-300'
                    }`}
                  >
                    {entry.status === 'completed' ? '✓ Done' : entry.status === 'failed' ? 'Failed' : 'Processing'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-brand-50 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-800 rounded-xl p-4 mt-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-brand-600 dark:text-brand-400 flex-shrink-0 mt-0.5" />

            <div>
              <h4 className="font-medium text-brand-800 dark:text-brand-300">Export Tips</h4>

              <ul className="space-y-1 text-sm text-brand-700 dark:text-brand-400 mt-1">
                <li>• CSV format is compatible with Excel, Google Sheets, and most spreadsheet applications</li>
                <li>• Use filters to export specific subsets of your inventory</li>
                <li>• Select additional fields to include more details in your export</li>
                <li>• Large inventories may take a few moments to export</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
