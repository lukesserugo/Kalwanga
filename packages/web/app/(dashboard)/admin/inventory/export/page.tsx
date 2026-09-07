// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\inventory\export\page.tsx

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Download, Loader2, FileText, FileSpreadsheet,
  CheckCircle, AlertCircle, Package, Filter, Calendar,
  Building, Tag, Truck, RefreshCw, X, ChevronDown, ChevronUp,
  Info, Shield, Clock, DollarSign
} from 'lucide-react';
import { inventoryService } from '../../../../../services/inventoryService';
import { toast } from '../../../../../utils/toast-manager';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import { useAuth } from '../../../../../hooks/useAuth';
import { formatCurrency, formatDate } from '../../../../../utils/formatters';

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
}

interface ExportItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  location: string;
  supplier: string;
  minStock: number;
  maxStock: number;
  createdAt: string;
  updatedAt: string;
  stock?: number;
  price?: number;
}

interface ExportStats {
  totalItems: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  categories: number;
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
];

// ============================================
// MAIN COMPONENT
// ============================================

export default function InventoryExportPage() {
  const router = useRouter();
  const { hasPermission } = usePermission();
  const { user } = useAuth();
  
  // State
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel'>('csv');
  const [lastExport, setLastExport] = useState<{
    format: string;
    date: string;
    count: number;
    fileName: string;
  } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [filters, setFilters] = useState<ExportFilters>({
    category: '',
    location: '',
    supplier: '',
    status: 'all',
    dateFrom: '',
    dateTo: '',
    includeInactive: false,
    includeLowStock: false,
    includeOutOfStock: false,
  });

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || 'default';
  
  // Fix: hasPermission expects only one argument - the permission string
  // The PermissionResource enum provides the full permission string
  const canExportInventory = hasPermission(`${PermissionResource.INVENTORY}:export`) || 
                             hasPermission(`${PermissionResource.INVENTORY}:manage`);

  // ============================================
  // HELPERS
  // ============================================

  const normalizeInventoryItem = (item: any): ExportItem => {
    return {
      id: item.id || '',
      name: item.name || item.product?.name || 'Unknown',
      sku: item.sku || item.product?.sku || 'N/A',
      category: item.category || item.product?.category?.name || 'Uncategorized',
      quantity: item.quantity || item.stock || 0,
      unit: item.unit || 'each',
      unitPrice: item.unitPrice || item.price || item.product?.unitPrice || 0,
      location: item.location || 'Warehouse',
      supplier: item.supplier || '',
      minStock: item.minStock || item.reorderPoint || 5,
      maxStock: item.maxStock || 100,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString(),
      stock: item.quantity || item.stock || 0,
      price: item.unitPrice || item.price || item.product?.unitPrice || 0,
    };
  };

  const getActiveFilterCount = (): number => {
    let count = 0;
    if (filters.category) count++;
    if (filters.location) count++;
    if (filters.supplier) count++;
    if (filters.status !== 'all') count++;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (filters.includeInactive) count++;
    if (filters.includeLowStock) count++;
    if (filters.includeOutOfStock) count++;
    return count;
  };

  // ============================================
  // EXPORT HANDLERS
  // ============================================

  const handleExport = async () => {
    if (!canExportInventory) {
      toast.error('You don\'t have permission to export inventory');
      return;
    }

    setExporting(true);
    setExportProgress(0);
    
    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setExportProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      // Fix: exportInventory expects only businessUnitId
      const blob = await inventoryService.exportInventory(businessUnitId, exportFormat);
      
      clearInterval(progressInterval);
      setExportProgress(100);
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().split('T')[0];
      const extension = exportFormat === 'csv' ? 'csv' : 'xlsx';
      const fileName = `inventory-export-${timestamp}.${extension}`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setLastExport({
        format: exportFormat.toUpperCase(),
        date: new Date().toLocaleString(),
        count: 0,
        fileName,
      });

      toast.success(`Inventory exported as ${exportFormat.toUpperCase()}`);
    } catch (error: any) {
      console.error('Export failed:', error);
      toast.error(error?.response?.data?.message || 'Failed to export inventory');
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  };

  const handleExportAll = async () => {
    if (!canExportInventory) {
      toast.error('You don\'t have permission to export inventory');
      return;
    }

    setExporting(true);
    setExportProgress(0);
    
    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setExportProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      // Fix: getAllInventory expects only businessUnitId
      const response = await inventoryService.getAllInventory(businessUnitId);
      
      clearInterval(progressInterval);
      setExportProgress(100);
      
      // Normalize the response data - handle various response formats
      let items: ExportItem[] = [];
      
      if (response && typeof response === 'object') {
        // Check if response has items array
        if (Array.isArray(response)) {
          items = response.map(normalizeInventoryItem);
        } else if (Array.isArray(response.items)) {
          items = response.items.map(normalizeInventoryItem);
        } else {
          // Try to find any array in the response
          const possibleArray = Object.values(response).find(val => Array.isArray(val));
          if (possibleArray && Array.isArray(possibleArray)) {
            items = possibleArray.map(normalizeInventoryItem);
          }
        }
      }
      
      // If no items found, try to get from inventoryService.getInventory
      if (items.length === 0) {
        try {
          const inventoryResponse = await inventoryService.getInventory({ 
            businessUnitId, 
            limit: 1000 
          });
          
          // ✅ FIX: InventoryListResponse has 'inventory' and optional 'items', not 'data'
          if (inventoryResponse && Array.isArray(inventoryResponse.inventory)) {
            items = inventoryResponse.inventory.map(normalizeInventoryItem);
          } else if (inventoryResponse && Array.isArray(inventoryResponse.items)) {
            items = inventoryResponse.items.map(normalizeInventoryItem);
          } else if (inventoryResponse && Array.isArray(inventoryResponse)) {
            items = inventoryResponse.map(normalizeInventoryItem);
          }
        } catch (e) {
          console.warn('Could not fetch inventory from getInventory:', e);
        }
      }
      
      let csvContent = '';
      
      if (exportFormat === 'csv') {
        const headers = ['Name', 'SKU', 'Category', 'Quantity', 'Unit', 'Unit Price', 'Location', 'Supplier', 'Min Stock', 'Max Stock', 'Created At'];
        csvContent = headers.join(',') + '\n';
        
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const row = [
            `"${item.name || ''}"`,
            `"${item.sku || ''}"`,
            `"${item.category || ''}"`,
            item.quantity || 0,
            `"${item.unit || 'each'}"`,
            item.unitPrice || 0,
            `"${item.location || ''}"`,
            `"${item.supplier || ''}"`,
            item.minStock || 5,
            item.maxStock || 100,
            `"${item.createdAt || ''}"`,
          ];
          csvContent += row.join(',') + '\n';
        }
      } else {
        // Excel XML format
        csvContent = '<?xml version="1.0"?>\n';
        csvContent += '<?mso-application progid="Excel.Sheet"?>\n';
        csvContent += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
        csvContent += ' xmlns:o="urn:schemas-microsoft-com:office:office"\n';
        csvContent += ' xmlns:x="urn:schemas-microsoft-com:office:excel"\n';
        csvContent += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
        csvContent += ' <Worksheet ss:Name="Inventory">\n';
        csvContent += '  <Table>\n';
        csvContent += '   <Row>\n';
        ['Name', 'SKU', 'Category', 'Quantity', 'Unit', 'Unit Price', 'Location', 'Supplier', 'Min Stock', 'Max Stock'].forEach((header: string) => {
          csvContent += `    <Cell><Data ss:Type="String">${header}</Data></Cell>\n`;
        });
        csvContent += '   </Row>\n';
        
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          csvContent += '   <Row>\n';
          [
            item.name || '', item.sku || '', item.category || '', 
            item.quantity || 0, item.unit || 'each', item.unitPrice || 0,
            item.location || '', item.supplier || '', item.minStock || 5, item.maxStock || 100
          ].forEach((value: any) => {
            const type = typeof value === 'number' ? 'Number' : 'String';
            csvContent += `    <Cell><Data ss:Type="${type}">${value}</Data></Cell>\n`;
          });
          csvContent += '   </Row>\n';
        }
        
        csvContent += '  </Table>\n';
        csvContent += ' </Worksheet>\n';
        csvContent += '</Workbook>';
      }

      const mimeType = exportFormat === 'csv' 
        ? 'text/csv;charset=utf-8;' 
        : 'application/vnd.ms-excel';
      const blob = new Blob([csvContent], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().split('T')[0];
      const extension = exportFormat === 'csv' ? 'csv' : 'xls';
      const fileName = `inventory-full-export-${timestamp}.${extension}`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setLastExport({
        format: exportFormat.toUpperCase(),
        date: new Date().toLocaleString(),
        count: items.length,
        fileName,
      });

      toast.success(`${items.length} items exported as ${exportFormat.toUpperCase()}`);
    } catch (error: any) {
      console.error('Export failed:', error);
      toast.error(error?.message || 'Failed to export inventory');
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  };

  const handleClearFilters = () => {
    setFilters({
      category: '',
      location: '',
      supplier: '',
      status: 'all',
      dateFrom: '',
      dateTo: '',
      includeInactive: false,
      includeLowStock: false,
      includeOutOfStock: false,
    });
  };

  // ============================================
  // RENDER
  // ============================================

  const exportOptions = [
    {
      id: 'csv',
      title: 'CSV Export',
      description: 'Export inventory data as CSV file for spreadsheet applications',
      icon: FileText,
      color: 'blue',
      format: 'csv' as const,
    },
    {
      id: 'excel',
      title: 'Excel Export',
      description: 'Export inventory data as Excel spreadsheet',
      icon: FileSpreadsheet,
      color: 'green',
      format: 'excel' as const,
    },
  ];

  const activeFilterCount = getActiveFilterCount();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        {/* ============================================
            HEADER - Fix: Use button instead of Link
            ============================================ */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Download className="w-6 h-6 text-blue-500" />
                Export Inventory
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Export your inventory data in various formats
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {businessUnitId !== 'default' ? `BU: ${businessUnitId.slice(0, 8)}...` : 'Default BU'}
            </span>
          </div>
        </div>

        {/* ============================================
            EXPORT PROGRESS
            ============================================ */}
        <AnimatePresence>
          {exporting && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                    Exporting inventory...
                  </p>
                  <div className="w-full bg-blue-200 dark:bg-blue-700 rounded-full h-2 mt-1">
                    <motion.div
                      className="bg-blue-600 dark:bg-blue-400 rounded-full h-2"
                      initial={{ width: 0 }}
                      animate={{ width: `${exportProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
                <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                  {exportProgress}%
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============================================
            EXPORT OPTIONS
            ============================================ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {exportOptions.map((option, index) => {
            const Icon = option.icon;
            const isActive = exportFormat === option.format;
            
            return (
              <motion.button
                key={option.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => {
                  setExportFormat(option.format);
                  handleExportAll();
                }}
                disabled={exporting}
                className={`
                  bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 p-6 text-left 
                  transition-all disabled:opacity-50 disabled:cursor-not-allowed
                  transform hover:scale-[1.02] active:scale-[0.98]
                  ${isActive 
                    ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/20' 
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                  }
                `}
              >
                <div className={`p-3 rounded-lg inline-block mb-4 ${
                  isActive 
                    ? 'bg-blue-100 dark:bg-blue-900/30' 
                    : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  <Icon className={`w-6 h-6 ${
                    isActive 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-600 dark:text-gray-400'
                  }`} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {option.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {option.description}
                </p>
                <div className="mt-4 flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400">
                  {exporting && exportFormat === option.format ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Export as {option.format.toUpperCase()}
                    </>
                  )}
                </div>
                {isActive && (
                  <div className="mt-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                      <CheckCircle className="w-3 h-3" />
                      Selected
                    </span>
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* ============================================
            EXPORT FILTERS
            ============================================ */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Export Filters</h3>
              <span className="text-sm text-gray-500">(Optional)</span>
              {activeFilterCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearFilters();
                  }}
                  className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                >
                  Clear All
                </button>
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Category
                      </label>
                      <input
                        type="text"
                        value={filters.category}
                        onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Filter by category"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Location
                      </label>
                      <input
                        type="text"
                        value={filters.location}
                        onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Filter by location"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Supplier
                      </label>
                      <input
                        type="text"
                        value={filters.supplier}
                        onChange={(e) => setFilters({ ...filters, supplier: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Filter by supplier"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Status
                      </label>
                      <select
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {STATUS_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Date From
                      </label>
                      <input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Date To
                      </label>
                      <input
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.includeInactive}
                        onChange={(e) => setFilters({ ...filters, includeInactive: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Include inactive items</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.includeLowStock}
                        onChange={(e) => setFilters({ ...filters, includeLowStock: e.target.checked })}
                        className="w-4 h-4 text-yellow-600 rounded focus:ring-yellow-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Only low stock items</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.includeOutOfStock}
                        onChange={(e) => setFilters({ ...filters, includeOutOfStock: e.target.checked })}
                        className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Only out of stock items</span>
                    </label>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ============================================
            LAST EXPORT INFO
            ============================================ */}
        <AnimatePresence>
          {lastExport && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-6"
            >
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-green-800 dark:text-green-300">Last Export</h4>
                  <p className="text-sm text-green-700 dark:text-green-400">
                    Format: {lastExport.format} • Date: {lastExport.date}
                    {lastExport.count > 0 && ` • Items: ${lastExport.count}`}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-500 mt-1 break-all">
                    File: {lastExport.fileName}
                  </p>
                </div>
                <button
                  onClick={() => setLastExport(null)}
                  className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============================================
            EXPORT HISTORY
            ============================================ */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mt-6">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              Export History
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Recent export activity</p>
          </div>
          <div className="p-6">
            {lastExport ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {lastExport.fileName}
                      </p>
                      <p className="text-xs text-gray-500">{lastExport.date}</p>
                    </div>
                  </div>
                  <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded-full flex-shrink-0">
                    Completed
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No exports yet</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">Exported files will appear here</p>
              </div>
            )}
          </div>
        </div>

        {/* ============================================
            EXPORT TIPS
            ============================================ */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mt-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-800 dark:text-blue-300">Export Tips</h4>
              <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-400 mt-1">
                <li>• CSV format is compatible with Excel, Google Sheets, and most spreadsheet applications</li>
                <li>• Use filters to export specific subsets of your inventory</li>
                <li>• Exports include all item details including pricing and stock levels</li>
                <li>• Large inventories may take a few moments to export</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
