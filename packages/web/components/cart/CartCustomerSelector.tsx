// D:\Projects\Kalwanga\packages\web\components\cart\CartCustomerSelector.tsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { User, Search, Loader2, X } from 'lucide-react';
import { toast } from '../../utils/toast-manager';
import { cartService } from '../../services/cartService';
import { api } from '../../services/api';

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  loyaltyPoints?: number;
}

interface CartCustomerSelectorProps {
  selectedCustomerId?: string;
  onCustomerSelected?: (customerId: string) => void;
  onCustomerCleared?: () => void;
  disabled?: boolean;
  className?: string;
}

export function CartCustomerSelector({
  selectedCustomerId,
  onCustomerSelected,
  onCustomerCleared,
  disabled = false,
  className = '',
}: CartCustomerSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Fetch selected customer details
  useEffect(() => {
    if (selectedCustomerId) {
      fetchCustomerDetails(selectedCustomerId);
    } else {
      setSelectedCustomer(null);
    }
  }, [selectedCustomerId]);

  const fetchCustomerDetails = async (customerId: string) => {
    try {
      const response = await api.get(`/customers/${customerId}`);
      // ✅ FIX: response is the data directly, not { data: ... }
      if (response) {
        setSelectedCustomer(response as Customer);
      }
    } catch (error) {
      console.warn('Failed to fetch customer details:', error);
    }
  };

  const searchCustomers = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setCustomers([]);
      return;
    }

    try {
      setIsSearching(true);
      const response = await api.get(`/customers/search?q=${encodeURIComponent(query)}`);
      // ✅ FIX: response is the data directly
      setCustomers(Array.isArray(response) ? response : []);
      setShowDropdown(true);
    } catch (error) {
      console.warn('Failed to search customers:', error);
      setCustomers([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm) {
        searchCustomers(searchTerm);
      } else {
        setCustomers([]);
        setShowDropdown(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, searchCustomers]);

  const handleSelectCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setSearchTerm('');
    setCustomers([]);
    setShowDropdown(false);
    
    try {
      await cartService.associateCustomer(customer.id);
      toast.success(`Customer ${customer.firstName} ${customer.lastName} associated`);
      if (onCustomerSelected) {
        onCustomerSelected(customer.id);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to associate customer');
    }
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setSearchTerm('');
    setCustomers([]);
    setShowDropdown(false);
    if (onCustomerCleared) {
      onCustomerCleared();
    }
    toast.info('Customer removed from cart');
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <User className="w-5 h-5 text-gray-400" />
        <span className="font-medium text-gray-900 dark:text-white">Customer</span>
      </div>

      {selectedCustomer ? (
        <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              {selectedCustomer.firstName} {selectedCustomer.lastName}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {selectedCustomer.email} • {selectedCustomer.phoneNumber}
            </p>
            {selectedCustomer.loyaltyPoints !== undefined && (
              <p className="text-xs text-indigo-600 dark:text-indigo-400">
                {selectedCustomer.loyaltyPoints} loyalty points available
              </p>
            )}
          </div>
          <button
            onClick={handleClearCustomer}
            disabled={disabled}
            className="p-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
              <Search className="w-4 h-4 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => searchTerm.length >= 2 && setShowDropdown(true)}
              placeholder="Search customers by name, email, or phone..."
              disabled={disabled}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 dark:text-white disabled:opacity-50"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            )}
          </div>

          {/* Dropdown */}
          {showDropdown && customers.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {customers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => handleSelectCustomer(customer)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-start gap-3"
                >
                  <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {customer.firstName} {customer.lastName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {customer.email} • {customer.phoneNumber}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {showDropdown && customers.length === 0 && searchTerm.length >= 2 && !isSearching && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 text-center text-gray-500 dark:text-gray-400">
              No customers found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CartCustomerSelector;
