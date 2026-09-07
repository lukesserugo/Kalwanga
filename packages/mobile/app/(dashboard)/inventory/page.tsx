'use client';

import { useState, useEffect } from 'react';
import { useToast } from '../../../hooks/useToast';
import { apiService } from '../../../services/api';
import { formatCurrency } from '../../../utils/helpers';
import { Inventory } from '@pos/shared/types';
import Modal from '../../../components/ui/Modal';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';

export default function InventoryPage() {
  const { showToast } = useToast();
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Inventory | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editQuantity, setEditQuantity] = useState('');

  const loadInventory = async () => {
    try {
      const response = await apiService.get('/inventory', {
        params: {
          businessUnitId: 'default',
          lowStock: showLowStock || undefined,
        },
      });
      setInventory(response.data);
    } catch (error) {
      console.error('Error loading inventory:', error);
      showToast('Failed to load inventory', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, [showLowStock]);

  const handleUpdateStock = async () => {
    if (!selectedItem) return;
    const quantity = parseInt(editQuantity);
    if (isNaN(quantity)) {
      showToast('Please enter a valid number', 'warning');
      return;
    }

    try {
      await apiService.put(`/inventory/${selectedItem.productId}/stock`, {
        quantity,
        transactionType: 'ADJUSTMENT',
        notes: 'Manual stock adjustment',
        businessUnitId: selectedItem.businessUnitId,
      });
      showToast('Stock updated successfully', 'success');
      setShowEditModal(false);
      loadInventory();
    } catch (error) {
      console.error('Error updating stock:', error);
      showToast('Failed to update stock', 'error');
    }
  };

  const getStockStatus = (item: Inventory) => {
    if (item.quantity === 0) return { label: 'Out of Stock', color: 'text-red-600 bg-red-50' };
    if (item.quantity <= item.reorderPoint) return { label: 'Low Stock', color: 'text-yellow-600 bg-yellow-50' };
    return { label: 'In Stock', color: 'text-green-600 bg-green-50' };
  };

  const filteredInventory = inventory.filter(item => {
    const search = searchQuery.toLowerCase();
    return (
      item.product.name.toLowerCase().includes(search) ||
      item.product.sku.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-600">Manage your products and stock levels.</p>
        </div>
        <button
          onClick={() => showToast('Add product form coming soon', 'info')}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add Product
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setShowLowStock(!showLowStock)}
            className={`px-4 py-2 rounded-lg border ${
              showLowStock
                ? 'bg-yellow-50 border-yellow-400 text-yellow-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {showLowStock ? 'Showing Low Stock' : 'Show Low Stock'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    No products found
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => {
                  const status = getStockStatus(item);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {item.product.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {item.product.sku}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(item.product.unitPrice)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => {
                            setSelectedItem(item);
                            setEditQuantity(item.quantity.toString());
                            setShowEditModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Update Stock
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Stock Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Update Stock"
      >
        {selectedItem && (
          <div className="space-y-4">
            <div>
              <p className="font-medium text-gray-900">{selectedItem.product.name}</p>
              <p className="text-sm text-gray-500">SKU: {selectedItem.product.sku}</p>
              <p className="text-sm text-gray-600 mt-2">Current Stock: {selectedItem.quantity}</p>
            </div>
            <Input
              label="New Quantity"
              type="number"
              value={editQuantity}
              onChange={(e) => setEditQuantity(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateStock}>
                Update Stock
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
