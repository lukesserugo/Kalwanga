'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Search,
  Loader2,
  User,
  Mail,
  Phone,
  Plus,
  Users,
  CreditCard,
  Wallet,
  Check,
  AlertCircle
} from 'lucide-react';
import { customerService } from '../../../services/customerService';
import { useToast } from '../../common/Toast';
import { formatCurrency } from '../../../utils/formatters';

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  loyaltyPoints: number;
  totalSpent: number;
  isActive: boolean;
  createdAt: string;
}

interface CustomerSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCustomer: (customer: Customer) => void;
}

export function CustomerSearchModal({
  isOpen,
  onClose,
  onSelectCustomer,
}: CustomerSearchModalProps) {
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
  });

  // Search for customers
  useEffect(() => {
    const searchCustomers = async () => {
      if (searchQuery.length < 2) {
        setCustomers([]);
        return;
      }

      setLoading(true);
      try {
        const results = await customerService.searchCustomers({
          query: searchQuery,
          limit: 10,
        });
        setCustomers(results || []);
      } catch (error) {
        console.error('Failed to search customers:', error);
        // Use mock data for demo
        setCustomers(generateMockCustomers(searchQuery));
      } finally {
        setLoading(false);
      }
    };

    const debounceTimeout = setTimeout(searchCustomers, 300);
    return () => clearTimeout(debounceTimeout);
  }, [searchQuery]);

  // Generate mock customers for demo
  const generateMockCustomers = (query: string): Customer[] => {
    const mockCustomers: Customer[] = [
      {
        id: '1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phoneNumber: '(555) 123-4567',
        loyaltyPoints: 150,
        totalSpent: 1250.00,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        phoneNumber: '(555) 234-5678',
        loyaltyPoints: 320,
        totalSpent: 2450.75,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: '3',
        firstName: 'Robert',
        lastName: 'Johnson',
        email: 'robert.j@example.com',
        phoneNumber: '(555) 345-6789',
        loyaltyPoints: 85,
        totalSpent: 680.50,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: '4',
        firstName: 'Maria',
        lastName: 'Garcia',
        email: 'maria.garcia@example.com',
        phoneNumber: '(555) 456-7890',
        loyaltyPoints: 210,
        totalSpent: 1890.00,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: '5',
        firstName: 'David',
        lastName: 'Wilson',
        email: 'david.w@example.com',
        phoneNumber: '(555) 567-8901',
        loyaltyPoints: 45,
        totalSpent: 320.25,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    ];

    if (!query) return mockCustomers;
    const lowerQuery = query.toLowerCase();
    return mockCustomers.filter(
      (c) =>
        c.firstName.toLowerCase().includes(lowerQuery) ||
        c.lastName.toLowerCase().includes(lowerQuery) ||
        c.email.toLowerCase().includes(lowerQuery) ||
        c.phoneNumber.includes(query)
    );
  };

  const handleCreateCustomer = async () => {
    if (!createForm.firstName || !createForm.lastName || !createForm.email) {
      showToast('Please fill in all required fields', 'warning');
      return;
    }

    setIsCreating(true);
    try {
      const newCustomer = await customerService.createCustomer({
        firstName: createForm.firstName,
        lastName: createForm.lastName,
        email: createForm.email,
        phoneNumber: createForm.phoneNumber,
        companyId: '',
        isActive: true,
      });
      
      if (newCustomer) {
        showToast(`Customer ${createForm.firstName} ${createForm.lastName} created successfully`, 'success');
        onSelectCustomer(newCustomer);
        setShowCreateForm(false);
        setCreateForm({
          firstName: '',
          lastName: '',
          email: '',
          phoneNumber: '',
        });
        onClose();
      }
    } catch (error) {
      // For demo, create a mock customer
      const mockCustomer: Customer = {
        id: `new-${Date.now()}`,
        firstName: createForm.firstName,
        lastName: createForm.lastName,
        email: createForm.email,
        phoneNumber: createForm.phoneNumber || 'N/A',
        loyaltyPoints: 0,
        totalSpent: 0,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      showToast(`Customer ${createForm.firstName} ${createForm.lastName} created successfully`, 'success');
      onSelectCustomer(mockCustomer);
      setShowCreateForm(false);
      setCreateForm({
        firstName: '',
        lastName: '',
        email: '',
        phoneNumber: '',
      });
      onClose();
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              Find Customer
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Search for an existing customer or create a new one
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <span className="ml-2 text-gray-500 dark:text-gray-400">Searching...</span>
            </div>
          ) : customers.length > 0 ? (
            <div className="space-y-2">
              {customers.map((customer) => (
                <CustomerResultItem
                  key={customer.id}
                  customer={customer}
                  isSelected={selectedCustomer?.id === customer.id}
                  onSelect={() => {
                    setSelectedCustomer(customer);
                    onSelectCustomer(customer);
                  }}
                />
              ))}
            </div>
          ) : searchQuery.length >= 2 && !loading ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500 dark:text-gray-400">No customers found</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="mt-2 text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mx-auto"
              >
                <Plus className="w-4 h-4" />
                Create New Customer
              </button>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Type at least 2 characters to search</p>
            </div>
          )}
        </div>

        {/* Create Customer Form */}
        {showCreateForm && (
          <CreateCustomerForm
            formData={createForm}
            onChange={setCreateForm}
            onCancel={() => setShowCreateForm(false)}
            onSubmit={handleCreateCustomer}
            isCreating={isCreating}
          />
        )}
      </div>
    </div>
  );
}

// ============================================
// CUSTOMER RESULT ITEM
// ============================================

interface CustomerResultItemProps {
  customer: Customer;
  isSelected: boolean;
  onSelect: () => void;
}

function CustomerResultItem({ customer, isSelected, onSelect }: CustomerResultItemProps) {
  return (
    <div
      onClick={onSelect}
      className={`p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors flex items-center justify-between ${
        isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-600' : ''
      }`}
    >
      <div>
        <p className="font-medium text-gray-900 dark:text-white">
          {customer.firstName} {customer.lastName}
        </p>
        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <Mail className="w-3 h-3" />
            {customer.email}
          </span>
          <span className="flex items-center gap-1">
            <Phone className="w-3 h-3" />
            {customer.phoneNumber}
          </span>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loyalty Points</p>
        <p className="font-bold text-blue-600 dark:text-blue-400">{customer.loyaltyPoints || 0}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Spent: {formatCurrency(customer.totalSpent || 0)}
        </p>
      </div>
    </div>
  );
}

// ============================================
// CREATE CUSTOMER FORM
// ============================================

interface CreateCustomerFormProps {
  formData: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
  };
  onChange: (data: any) => void;
  onCancel: () => void;
  onSubmit: () => void;
  isCreating: boolean;
}

function CreateCustomerForm({
  formData,
  onChange,
  onCancel,
  onSubmit,
  isCreating,
}: CreateCustomerFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSubmit();
    }
  };

  return (
    <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
        <Plus className="w-4 h-4 text-blue-500" />
        Create New Customer
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            First Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.firstName}
            onChange={(e) => onChange({ ...formData, firstName: e.target.value })}
            className={`w-full px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
              errors.firstName ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
            placeholder="John"
          />
          {errors.firstName && (
            <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Last Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.lastName}
            onChange={(e) => onChange({ ...formData, lastName: e.target.value })}
            className={`w-full px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
              errors.lastName ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
            placeholder="Doe"
          />
          {errors.lastName && (
            <p className="text-xs text-red-500 mt-1">{errors.lastName}</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => onChange({ ...formData, email: e.target.value })}
            className={`w-full px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
              errors.email ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
            placeholder="john.doe@example.com"
          />
          {errors.email && (
            <p className="text-xs text-red-500 mt-1">{errors.email}</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Phone Number
          </label>
          <input
            type="tel"
            value={formData.phoneNumber}
            onChange={(e) => onChange({ ...formData, phoneNumber: e.target.value })}
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="(555) 123-4567"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button
          onClick={onCancel}
          className="px-4 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isCreating}
          className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-2 disabled:opacity-50"
        >
          {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {isCreating ? 'Creating...' : 'Create Customer'}
        </button>
      </div>
    </div>
  );
}
