// D:\Projects\Kalwanga\packages\web\components\cart\CartCustomerSelector.tsx

'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { User, Search, Loader2, X } from 'lucide-react';
import { toast } from '../../utils/toast-manager';
import { cartService } from '../../services/cartService';
import { useAuth } from '../../hooks/useAuth';
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

const SEARCH_DEBOUNCE_MS = 300;
const MIN_SEARCH_LENGTH = 2;

export function CartCustomerSelector({
  selectedCustomerId,
  onCustomerSelected,
  onCustomerCleared,
  disabled = false,
  className = '',
}: CartCustomerSelectorProps) {
  const { isAuthenticated } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] =
    useState<Customer | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isAssociating, setIsAssociating] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ============================================
  // FETCH SELECTED CUSTOMER
  // ============================================

  useEffect(() => {
    if (!selectedCustomerId) {
      setSelectedCustomer(null);
      return;
    }

    let cancelled = false;

    const fetchCustomer = async () => {
      try {
        const response = await api.get<Customer>(
          `/customers/${selectedCustomerId}`,
        );
        if (cancelled || !isMountedRef.current) return;
        // Unwrap `{ data }` if the backend uses the envelope shape.
        const payload =
          response && typeof response === 'object' && 'id' in response
            ? (response as Customer)
            : (response as unknown as { data: Customer })?.data;
        if (payload) setSelectedCustomer(payload);
      } catch (err) {
        if (!cancelled && isMountedRef.current) {
          console.warn('Failed to fetch customer details:', err);
        }
      }
    };

    void fetchCustomer();
    return () => {
      cancelled = true;
    };
  }, [selectedCustomerId]);

  // ============================================
  // SEARCH
  // ============================================

  const searchCustomers = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_SEARCH_LENGTH) {
      setCustomers([]);
      setShowDropdown(false);
      return;
    }

    try {
      setIsSearching(true);
      const response = await api.get<Customer[]>(
        `/customers/search?q=${encodeURIComponent(trimmed)}`,
      );
      if (!isMountedRef.current) return;

      // Unwrap either shape.
      const list = Array.isArray(response)
        ? response
        : Array.isArray((response as unknown as { data: Customer[] })?.data)
        ? (response as unknown as { data: Customer[] }).data
        : [];

      setCustomers(list);
      setShowDropdown(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      console.warn('Failed to search customers:', err);
      setCustomers([]);
    } finally {
      if (isMountedRef.current) setIsSearching(false);
    }
  }, []);

  // Debounce the search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      if (searchTerm) {
        void searchCustomers(searchTerm);
      } else {
        setCustomers([]);
        setShowDropdown(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchTerm, searchCustomers]);

  // ============================================
  // OUTSIDE CLICK
  // ============================================

  useEffect(() => {
    if (!showDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowDropdown(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showDropdown]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleSelectCustomer = useCallback(
    async (customer: Customer) => {
      if (disabled || isAssociating) return;

      // Optimistic UI: show the customer immediately.
      setSelectedCustomer(customer);
      setSearchTerm('');
      setCustomers([]);
      setShowDropdown(false);
      setIsAssociating(true);

      try {
        await cartService.associateCustomer(customer.id);
        toast.success(
          `Customer ${customer.firstName} ${customer.lastName} associated`,
        );
        window.dispatchEvent(new CustomEvent('cart:updated'));
        onCustomerSelected?.(customer.id);
      } catch (err: any) {
        // Rollback on failure.
        setSelectedCustomer(null);
        const message =
          err?.response?.data?.message ||
          err?.message ||
          'Failed to associate customer';
        toast.error(message);
      } finally {
        if (isMountedRef.current) setIsAssociating(false);
      }
    },
    [disabled, isAssociating, onCustomerSelected],
  );

  const handleClearCustomer = useCallback(async () => {
    if (disabled || isAssociating) return;

    const previous = selectedCustomer;
    setSelectedCustomer(null);
    setSearchTerm('');
    setCustomers([]);
    setShowDropdown(false);

    try {
      // Best-effort — the cart service clears the customer on the
      // backend. If it fails, we restore the UI state.
      await cartService.associateCustomer('');
      window.dispatchEvent(new CustomEvent('cart:updated'));
      onCustomerCleared?.();
      toast.info('Customer removed from cart');
    } catch (err) {
      if (previous) setSelectedCustomer(previous);
      toast.error('Failed to remove customer');
    }
  }, [disabled, isAssociating, selectedCustomer, onCustomerCleared]);

  // ============================================
  // GUEST GATE
  // ============================================
  //
  // Guest carts don't support customer association. Return null
  // silently so parent components don't need to gate the render.

  if (!isAuthenticated) {
    return null;
  }

  // ============================================
  // RENDER
  // ============================================

  const showNoResults =
    showDropdown &&
    customers.length === 0 &&
    searchTerm.trim().length >= MIN_SEARCH_LENGTH &&
    !isSearching;

  return (
    <div
      className={`space-y-2 ${className}`}
      ref={containerRef}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-gray-400 shrink-0" />
          <span className="font-medium text-gray-900 dark:text-white">
            Customer
          </span>
          {isAssociating && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" />
          )}
        </div>
      </div>

      {selectedCustomer ? (
        <div className="flex items-center justify-between gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
          <div className="min-w-0">
            <p className="font-medium text-gray-900 dark:text-white truncate">
              {selectedCustomer.firstName} {selectedCustomer.lastName}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {selectedCustomer.email}
              {selectedCustomer.phoneNumber
                ? ` • ${selectedCustomer.phoneNumber}`
                : ''}
            </p>
            {selectedCustomer.loyaltyPoints !== undefined && (
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
                {selectedCustomer.loyaltyPoints} loyalty points
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleClearCustomer}
            disabled={disabled || isAssociating}
            className="shrink-0 p-1.5 rounded-md hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors disabled:opacity-50"
            aria-label="Remove customer from cart"
          >
            <X className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() =>
                searchTerm.trim().length >= MIN_SEARCH_LENGTH &&
                setShowDropdown(true)
              }
              placeholder="Search by name, email, or phone…"
              disabled={disabled || isAssociating}
              autoComplete="off"
              className="w-full pl-9 pr-9 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 transition-colors"
              aria-expanded={showDropdown}
              aria-controls="customer-search-results"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-orange-500" />
            )}
          </div>

          {showDropdown && customers.length > 0 && (
            <div
              id="customer-search-results"
              className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto"
              role="listbox"
            >
              {customers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => handleSelectCustomer(customer)}
                  disabled={isAssociating}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-start gap-3 disabled:opacity-50"
                  role="option"
                >
                  <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/40 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {customer.firstName} {customer.lastName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {customer.email}
                      {customer.phoneNumber
                        ? ` • ${customer.phoneNumber}`
                        : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {showNoResults && (
            <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 text-center text-sm text-gray-500 dark:text-gray-400">
              No customers found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CartCustomerSelector;
