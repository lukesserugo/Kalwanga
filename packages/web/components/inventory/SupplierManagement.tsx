// D:\Projects\Kalwanga\packages\web\components\inventory\SupplierManagement.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  Truck, Plus, Edit, Trash2, X, Save, RefreshCw,
  Phone, Mail, MapPin, User, Building, Search,
  Star, StarHalf, StarOff, MoreVertical, Eye
} from 'lucide-react';
import { toast } from '../../utils/toast-manager';
import { useAuth } from '../../hooks/useAuth';

interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address?: string;
  taxId?: string;
  notes?: string;
  rating?: number;
  isActive: boolean;
  businessUnitId: string;
  createdAt: string;
  updatedAt: string;
  productCount?: number;
}

export function SupplierManagement() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    taxId: '',
    notes: '',
    isActive: true,
  });
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || '';

  useEffect(() => {
    loadSuppliers();
  }, [businessUnitId]);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      // Load suppliers from API
      // const data = await inventoryService.getSuppliers(businessUnitId);
      // setSuppliers(data);
      setSuppliers([
        { 
          id: '1', 
          name: 'TechCorp Inc.', 
          contactPerson: 'John Smith',
          email: 'john@techcorp.com',
          phone: '+1 234-567-890',
          address: '123 Tech Street, Silicon Valley, CA',
          isActive: true,
          businessUnitId,
          createdAt: '',
          updatedAt: '',
          rating: 4.5,
          productCount: 45,
        },
        { 
          id: '2', 
          name: 'Global Supplies Ltd.', 
          contactPerson: 'Sarah Johnson',
          email: 'sarah@globalsupplies.com',
          phone: '+1 234-567-891',
          address: '456 Supply Road, New York, NY',
          isActive: true,
          businessUnitId,
          createdAt: '',
          updatedAt: '',
          rating: 3.8,
          productCount: 28,
        },
        { 
          id: '3', 
          name: 'Premium Goods Co.', 
          contactPerson: 'Michael Brown',
          email: 'michael@premiumgoods.com',
          phone: '+1 234-567-892',
          address: '789 Premium Ave, Los Angeles, CA',
          isActive: false,
          businessUnitId,
          createdAt: '',
          updatedAt: '',
          rating: 2.5,
          productCount: 12,
        },
      ]);
    } catch (error) {
      console.error('Failed to load suppliers:', error);
      toast.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.contactPerson || !formData.email || !formData.phone) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      if (editingSupplier) {
        // await inventoryService.updateSupplier(editingSupplier.id, formData);
        toast.success('Supplier updated successfully');
      } else {
        // await inventoryService.createSupplier({ ...formData, businessUnitId });
        toast.success('Supplier created successfully');
      }
      setShowAddModal(false);
      setEditingSupplier(null);
      setFormData({
        name: '',
        contactPerson: '',
        email: '',
        phone: '',
        address: '',
        taxId: '',
        notes: '',
        isActive: true,
      });
      loadSuppliers();
    } catch (error) {
      toast.error('Failed to save supplier');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this supplier?')) return;
    try {
      // await inventoryService.deleteSupplier(id);
      toast.success('Supplier deleted successfully');
      loadSuppliers();
    } catch (error) {
      toast.error('Failed to delete supplier');
    }
  };

  const renderStars = (rating: number = 0) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    return (
      <div className="flex items-center gap-0.5">
        {[...Array(fullStars)].map((_, i) => (
          <Star key={`full-${i}`} className="w-3 h-3 text-yellow-400 fill-yellow-400" />
        ))}
        {hasHalfStar && <StarHalf className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
        {[...Array(emptyStars)].map((_, i) => (
          <Star key={`empty-${i}`} className="w-3 h-3 text-gray-300" />
        ))}
        <span className="text-xs text-gray-500 ml-1">{rating.toFixed(1)}</span>
      </div>
    );
  };

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Truck className="w-6 h-6 text-blue-500" />
                Suppliers
              </h2>
              <p className="text-sm text-gray-500 mt-1">Manage your suppliers and vendor relationships</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={loadSuppliers}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setEditingSupplier(null);
                  setFormData({
                    name: '',
                    contactPerson: '',
                    email: '',
                    phone: '',
                    address: '',
                    taxId: '',
                    notes: '',
                    isActive: true,
                  });
                  setRating(0);
                  setShowAddModal(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Supplier
              </button>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search suppliers by name, contact, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Suppliers Grid */}
        <div className="p-4">
          {filteredSuppliers.length === 0 ? (
            <div className="text-center py-12">
              <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No suppliers found</p>
              <button
                onClick={() => {
                  setEditingSupplier(null);
                  setFormData({
                    name: '',
                    contactPerson: '',
                    email: '',
                    phone: '',
                    address: '',
                    taxId: '',
                    notes: '',
                    isActive: true,
                  });
                  setRating(0);
                  setShowAddModal(true);
                }}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                Add your first supplier →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSuppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Truck className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{supplier.name}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <User className="w-3 h-3" />
                          <span>{supplier.contactPerson}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setSelectedSupplier(supplier);
                          setShowDetailModal(true);
                        }}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <Eye className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingSupplier(supplier);
                          setFormData({
                            name: supplier.name,
                            contactPerson: supplier.contactPerson,
                            email: supplier.email,
                            phone: supplier.phone,
                            address: supplier.address || '',
                            taxId: supplier.taxId || '',
                            notes: supplier.notes || '',
                            isActive: supplier.isActive,
                          });
                          setRating(supplier.rating || 0);
                          setShowAddModal(true);
                        }}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <Edit className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleDelete(supplier.id)}
                        className="p-1 hover:bg-red-100 rounded"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="w-3 h-3" />
                      <span>{supplier.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="w-3 h-3" />
                      <span>{supplier.phone}</span>
                    </div>
                    {supplier.address && (
                      <div className="flex items-start gap-2 text-gray-600">
                        <MapPin className="w-3 h-3 mt-0.5" />
                        <span className="text-xs">{supplier.address}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      {renderStars(supplier.rating)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {supplier.productCount !== undefined && (
                        <span>{supplier.productCount} products</span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full ${
                        supplier.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {supplier.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => {
            setShowAddModal(false);
            setEditingSupplier(null);
          }} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <button
              onClick={() => {
                setShowAddModal(false);
                setEditingSupplier(null);
              }}
              className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold mb-4">
              {editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supplier Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter supplier name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Person *
                </label>
                <input
                  type="text"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter contact person"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tax ID
                </label>
                <input
                  type="text"
                  value={formData.taxId}
                  onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter tax ID"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Additional notes about the supplier"
                />
              </div>
              <div className="md:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingSupplier(null);
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {editingSupplier ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowDetailModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <button
              onClick={() => setShowDetailModal(false)}
              className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <Truck className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold">{selectedSupplier.name}</h3>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>{selectedSupplier.contactPerson}</span>
                  <span className="text-gray-300">|</span>
                  <span>{selectedSupplier.email}</span>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-gray-400" />
                <span>{selectedSupplier.phone}</span>
              </div>
              {selectedSupplier.address && (
                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                  <span>{selectedSupplier.address}</span>
                </div>
              )}
              {selectedSupplier.taxId && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-400">Tax ID:</span>
                  <span>{selectedSupplier.taxId}</span>
                </div>
              )}
              {selectedSupplier.notes && (
                <div className="flex items-start gap-3 text-sm">
                  <span className="text-gray-400">Notes:</span>
                  <span>{selectedSupplier.notes}</span>
                </div>
              )}
              <div className="flex items-center gap-4 pt-3 border-t">
                {renderStars(selectedSupplier.rating)}
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  selectedSupplier.isActive
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {selectedSupplier.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
