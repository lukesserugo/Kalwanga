// D:\Projects\Kalwanga\packages\web\components\inventory\InventoryList.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Filter, Package, AlertTriangle, CheckCircle,
  TrendingUp, TrendingDown, Edit, Eye, MoreVertical,
  RefreshCw, Download, Upload, Plus, X
} from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import { productService } from '../../services/productService';
import { Table } from '../common/Table';
import { Pagination } from '../common/Pagination';
import { Modal } from '../common/Modal';
import { toast } from '../../utils/toast-manager';
import { useAuth } from '../../hooks/useAuth';
import { InventoryPermissionGuard } from './InventoryPermissionGuard';
import { INVENTORY_PERMISSIONS } from '../../types/inventoryPermissions';

// Define Inventory type
interface Inventory {
  id: string;
  productId: string;
  product?: {
    id: string;
    name: string;
    sku: string;
    images?: string[];
    unitPrice: number;
  };
  variantId?: string;
  businessUnitId: string;
  quantity: number;
  reserved: number;
  reorderPoint: number;
  reorderQuantity: number;
  location?: string;
  shelfNumber?: string;
  supplier?: string;
  notes?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export function InventoryList() {
  const { 
    user,
    can
  } = useAuth();
  
  // Compute permission flags using the can function
  const canViewInventory = can(INVENTORY_PERMISSIONS.VIEW);
  const canCreateInventory = can(INVENTORY_PERMISSIONS.CREATE);
  const canEditInventory = can(INVENTORY_PERMISSIONS.EDIT);
  const canDeleteInventory = can(INVENTORY_PERMISSIONS.DELETE);
  const canExportInventory = can(INVENTORY_PERMISSIONS.EXPORT);
  const canAdjustInventory = can(INVENTORY_PERMISSIONS.ADJUST);
  const canTransferInventory = can(INVENTORY_PERMISSIONS.TRANSFER);
  const canIssueInventory = can(INVENTORY_PERMISSIONS.ISSUE);
  const canRestockInventory = can(INVENTORY_PERMISSIONS.RESTOCK);
  
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    location: '',
    status: '',
    lowStock: false,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    limit: 20,
  });
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [adjustmentData, setAdjustmentData] = useState({
    quantity: 0,
    type: 'ADJUSTMENT_IN',
    notes: '',
  });
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferData, setTransferData] = useState({
    fromLocation: '',
    toLocation: '',
    quantity: 0,
    notes: '',
  });
  const [stats, setStats] = useState({
    totalItems: 0,
    totalValue: 0,
    lowStock: 0,
    outOfStock: 0,
  });

  // Get businessUnitId from user's first business unit
  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || '';

  useEffect(() => {
    if (canViewInventory) {
      loadInventory();
      loadStats();
    }
  }, [filters, pagination.page, canViewInventory]);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const result = await inventoryService.getInventory({
        page: pagination.page,
        limit: pagination.limit,
        ...filters,
        businessUnitId: businessUnitId,
      });
      
      // Handle both array and paginated response
      if (Array.isArray(result)) {
        setInventory(result);
        setPagination({
          ...pagination,
          total: result.length,
          totalPages: 1,
        });
      } else if (result && typeof result === 'object') {
        const data = result as any;
        setInventory(data.data || data.items || []);
        setPagination({
          ...pagination,
          total: data.total || 0,
          totalPages: data.totalPages || 1,
        });
      }
    } catch (error) {
      console.error('Failed to load inventory:', error);
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!businessUnitId) return;
    try {
      const result = await inventoryService.getInventorySummary(businessUnitId);
      setStats({
        totalItems: result.totalItems || 0,
        totalValue: result.totalValue || 0,
        lowStock: result.lowStockItems || 0,
        outOfStock: result.outOfStockItems || 0,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleAdjustment = async () => {
    if (!selectedItem) return;
    try {
      await inventoryService.updateStock(selectedItem.id, {
        quantity: adjustmentData.quantity,
        notes: adjustmentData.notes,
        transactionType: adjustmentData.type === 'ADJUSTMENT_IN' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
      });
      toast.success('Stock adjusted successfully');
      setShowAdjustmentModal(false);
      loadInventory();
      loadStats();
    } catch (error) {
      toast.error('Failed to adjust stock');
    }
  };

  const handleTransfer = async () => {
    if (!selectedItem) return;
    try {
      await inventoryService.transferStock({
        productId: selectedItem.productId,
        fromLocation: transferData.fromLocation,
        toLocation: transferData.toLocation,
        quantity: transferData.quantity,
        notes: transferData.notes,
      });
      toast.success('Stock transferred successfully');
      setShowTransferModal(false);
      loadInventory();
      loadStats();
    } catch (error) {
      toast.error('Failed to transfer stock');
    }
  };

  const handleExport = async () => {
    if (!businessUnitId) {
      toast.error('Business unit not found');
      return;
    }
    try {
      await inventoryService.exportInventory(businessUnitId, 'csv');
      toast.success('Inventory exported successfully');
    } catch (error) {
      toast.error('Failed to export inventory');
    }
  };

  const columns = [
    {
      key: 'product',
      header: 'Product',
      render: (item: Inventory) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            {item.product?.images?.[0] ? (
              <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover rounded-lg" />
            ) : (
              <Package className="w-5 h-5 text-gray-400" />
            )}
          </div>
          <div>
            <p className="font-medium text-gray-900">{item.product?.name}</p>
            <p className="text-sm text-gray-500">SKU: {item.product?.sku}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (item: Inventory) => (
        <span className="px-2 py-1 bg-gray-100 rounded-full text-xs">
          {item.location || 'Warehouse'}
        </span>
      ),
    },
    {
      key: 'quantity',
      header: 'Stock',
      render: (item: Inventory) => {
        const quantity = item.quantity || 0;
        const status = quantity <= 0 ? 'Out of Stock' :
                      quantity <= item.reorderPoint ? 'Low Stock' :
                      'In Stock';
        const statusColor = quantity <= 0 ? 'red' :
                           quantity <= item.reorderPoint ? 'yellow' :
                           'green';
        return (
          <div>
            <p className="font-medium">{quantity}</p>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-${statusColor}-100 text-${statusColor}-700`}>
              {status}
            </span>
          </div>
        );
      },
    },
    {
      key: 'reserved',
      header: 'Reserved',
      render: (item: Inventory) => (
        <span className="text-gray-600">{item.reserved || 0}</span>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      render: (item: Inventory) => (
        <span className="font-medium">
          ${((item.quantity || 0) * (item.product?.unitPrice || 0)).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'reorderPoint',
      header: 'Reorder',
      render: (item: Inventory) => (
        <div>
          <p className="text-sm">Min: {item.reorderPoint}</p>
          <p className="text-sm text-gray-500">Qty: {item.reorderQuantity}</p>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: Inventory) => (
        <div className="flex items-center gap-2">
          {/* View - Everyone with view permission can see */}
          <Link
            to={`/inventory/${item.id}`}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4 text-gray-600" />
          </Link>

          {/* Edit - Only for users with edit permission */}
          <InventoryPermissionGuard permission={INVENTORY_PERMISSIONS.EDIT}>
            <button
              onClick={() => {
                // Handle edit
                toast.info('Edit functionality coming soon');
              }}
              className="p-1 hover:bg-blue-100 rounded transition-colors"
              title="Edit Product"
            >
              <Edit className="w-4 h-4 text-blue-600" />
            </button>
          </InventoryPermissionGuard>

          {/* Adjust Stock - Only for users with adjust permission */}
          <InventoryPermissionGuard permission={INVENTORY_PERMISSIONS.ADJUST}>
            <button
              onClick={() => {
                setSelectedItem(item);
                setShowAdjustmentModal(true);
              }}
              className="p-1 hover:bg-yellow-100 rounded transition-colors"
              title="Adjust Stock"
            >
              <RefreshCw className="w-4 h-4 text-yellow-600" />
            </button>
          </InventoryPermissionGuard>

          {/* Transfer - Only for users with transfer permission */}
          <InventoryPermissionGuard permission={INVENTORY_PERMISSIONS.TRANSFER}>
            <button
              onClick={() => {
                setSelectedItem(item);
                setShowTransferModal(true);
              }}
              className="p-1 hover:bg-green-100 rounded transition-colors"
              title="Transfer Stock"
            >
              <RefreshCw className="w-4 h-4 text-green-600" />
            </button>
          </InventoryPermissionGuard>

          {/* Delete - Only for users with delete permission */}
          <InventoryPermissionGuard permission={INVENTORY_PERMISSIONS.DELETE}>
            <button
              onClick={() => {
                if (confirm(`Are you sure you want to delete ${item.product?.name}?`)) {
                  toast.info('Delete functionality coming soon');
                }
              }}
              className="p-1 hover:bg-red-100 rounded transition-colors"
              title="Delete Product"
            >
              <X className="w-4 h-4 text-red-600" />
            </button>
          </InventoryPermissionGuard>
        </div>
      ),
    },
  ];

  // If user doesn't have view permission, show access denied
  if (!canViewInventory) {
    return (
      <div className="p-6 text-center">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-xl font-semibold text-gray-700">Access Restricted</h2>
        <p className="text-gray-500 mt-2">You don't have permission to view inventory.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-600 mt-1">Track and manage your stock across all locations</p>
        </div>
        <div className="flex gap-2">
          {/* Export - Only for users with export permission */}
          <InventoryPermissionGuard permission={INVENTORY_PERMISSIONS.EXPORT}>
            <button
              onClick={handleExport}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </InventoryPermissionGuard>

          {/* Add Stock - Only for users with create permission */}
          <InventoryPermissionGuard permission={INVENTORY_PERMISSIONS.CREATE}>
            <button
              onClick={() => toast.info('Add stock functionality coming soon')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Stock
            </button>
          </InventoryPermissionGuard>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Items</p>
              <p className="text-2xl font-bold">{stats.totalItems}</p>
            </div>
            <Package className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Value</p>
              <p className="text-2xl font-bold">${stats.totalValue?.toFixed(2) || '0.00'}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Low Stock</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.lowStock}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Out of Stock</p>
              <p className="text-2xl font-bold text-red-600">{stats.outOfStock}</p>
            </div>
            <X className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search products..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <select
            value={filters.location}
            onChange={(e) => setFilters({ ...filters, location: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Locations</option>
            <option value="Warehouse">Warehouse</option>
            <option value="Store">Store</option>
            <option value="Online">Online</option>
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.lowStock}
              onChange={(e) => setFilters({ ...filters, lowStock: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm text-gray-700">Low Stock Only</span>
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <Table
          columns={columns}
          data={inventory}
          loading={loading}
        />
        <div className="border-t border-gray-200 p-4">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={(page) => setPagination({ ...pagination, page })}
          />
        </div>
      </div>

      {/* Adjustment Modal - Only for users with adjust permission */}
      <InventoryPermissionGuard permission={INVENTORY_PERMISSIONS.ADJUST}>
        <Modal
          isOpen={showAdjustmentModal}
          onClose={() => setShowAdjustmentModal(false)}
          title="Adjust Stock"
        >
          <div className="p-6">
            {selectedItem && (
              <div className="mb-4">
                <p className="font-medium">{selectedItem.product?.name}</p>
                <p className="text-sm text-gray-500">Current Stock: {selectedItem.quantity}</p>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adjustment Type
                </label>
                <select
                  value={adjustmentData.type}
                  onChange={(e) => setAdjustmentData({ ...adjustmentData, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ADJUSTMENT_IN">Add Stock</option>
                  <option value="ADJUSTMENT_OUT">Remove Stock</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  value={adjustmentData.quantity}
                  onChange={(e) => setAdjustmentData({ ...adjustmentData, quantity: parseInt(e.target.value) || 0 })}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={adjustmentData.notes}
                  onChange={(e) => setAdjustmentData({ ...adjustmentData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Reason for adjustment..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAdjustmentModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAdjustment}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Apply Adjustment
              </button>
            </div>
          </div>
        </Modal>
      </InventoryPermissionGuard>

      {/* Transfer Modal - Only for users with transfer permission */}
      <InventoryPermissionGuard permission={INVENTORY_PERMISSIONS.TRANSFER}>
        <Modal
          isOpen={showTransferModal}
          onClose={() => setShowTransferModal(false)}
          title="Transfer Stock"
        >
          <div className="p-6">
            {selectedItem && (
              <div className="mb-4">
                <p className="font-medium">{selectedItem.product?.name}</p>
                <p className="text-sm text-gray-500">Current Stock: {selectedItem.quantity}</p>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  From Location
                </label>
                <input
                  type="text"
                  value={transferData.fromLocation}
                  onChange={(e) => setTransferData({ ...transferData, fromLocation: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Warehouse A"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  To Location
                </label>
                <input
                  type="text"
                  value={transferData.toLocation}
                  onChange={(e) => setTransferData({ ...transferData, toLocation: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Store B"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  value={transferData.quantity}
                  onChange={(e) => setTransferData({ ...transferData, quantity: parseInt(e.target.value) || 0 })}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={transferData.notes}
                  onChange={(e) => setTransferData({ ...transferData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Reason for transfer..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Transfer Stock
              </button>
            </div>
          </div>
        </Modal>
      </InventoryPermissionGuard>
    </div>
  );
}
