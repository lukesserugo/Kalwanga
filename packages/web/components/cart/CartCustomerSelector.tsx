'use client';

import React, {
  useCallback,
  useEffect,
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
  /**
   * Fired after the user clears the selection.
   *
   * NOTE: the backend has no "unset customer" endpoint. Clearing is a
   * client-side operation only — the cart on the server keeps its
   * `customerId` until a new one is associated or the cart is cleared.
   * Callers that need to truly detach the customer must first clear the
   * cart (DELETE /cart), which drops all line items as well.
   */
  onCustomerCleared?: () => void;
  disabled?: boolean;
  className?: string;
}

const SEARCH_DEBOUNCE_MS = 300;
const MIN_SEARCH_LENGTH = 2;

/**
 * The `api` wrapper may or may not unwrap `response.data`. This helper
 * accepts either and returns the payload.
 */
function unwrapApiResponse<T>(response: unknown): T | null {
  if (response == null) return null;
  if (typeof response === 'object' && 'data' in (response as any)) {
    const inner = (response as any).data;
    if (inner && typeof inner === 'object') return inner as T;
  }
  return response as T;
}

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

  useEffect(() => {
    if (!selectedCustomerId) {
      setSelectedCustomer(null);
      return;
    }

    let cancelled = false;

    const fetchCustomer = async () => {
      try {
        const response = await api.get(`/customers/${selectedCustomerId}`);
        const payload = unwrapApiResponse<Customer>(response);
        if (cancelled || !isMountedRef.current) return;
        if (payload && typeof payload.id === 'string') {
          setSelectedCustomer(payload);
        }
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

  const searchCustomers = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_SEARCH_LENGTH) {
      setCustomers([]);
      setShowDropdown(false);
      return;
    }

    try {
      setIsSearching(true);
      const response = await api.get(
        `/customers/search?q=${encodeURIComponent(trimmed)}`,
      );
      if (!isMountedRef.current) return;

      const payload = unwrapApiResponse<Customer[]>(response);
      const list = Array.isArray(payload) ? payload : [];

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

  const handleSelectCustomer = useCallback(
    async (customer: Customer) => {
      if (disabled || isAssociating) return;

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

  /**
   * Client-side clear only. The backend has no "unset customer" endpoint
   * and `associateCustomerSchema` requires a non-empty `customerId`, so
   * there is no request we could make that would accomplish this.
   *
   * If a backend endpoint is added later (`DELETE /cart/customer`),
   * replace the local state reset below with a real call.
   */
  const handleClearCustomer = useCallback(async () => {
    if (disabled || isAssociating) return;

    setSelectedCustomer(null);
    setSearchTerm('');
    setCustomers([]);
    setShowDropdown(false);

    onCustomerCleared?.();
    toast.info(
      'Customer removed from view. The server cart still references the previous customer until a new one is set.',
    );
  }, [disabled, isAssociating, onCustomerCleared]);

  if (!isAuthenticated) {
    return null;
  }

  const showNoResults =
    showDropdown &&
    customers.length === 0 &&
    searchTerm.trim().length >= MIN_SEARCH_LENGTH &&
    !isSearching;

  return (
    <div className={`space-y-2 ${className}`} ref={containerRef}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-gray-400 shrink-0" />
          <span className="font-medium text-gray-900 dark:text-white">
            Customer
          </span>
          {isAssociating && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-500" />
          )}
        </div>
      </div>

      {selectedCustomer ? (
        <div className="flex items-center justify-between gap-3 p-3 bg-brand-50 dark:bg-brand-900/20 rounded-lg border border-brand-200 dark:border-brand-800">
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
              <p className="text-xs text-secondary-600 dark:text-secondary-400 mt-0.5 tabular-nums">
                {selectedCustomer.loyaltyPoints} loyalty points
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleClearCustomer}
            disabled={disabled || isAssociating}
            className="shrink-0 p-1.5 rounded-md hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors disabled:opacity-50 focus-ring"
            aria-label="Remove customer from view"
          >
            <X className="w-4 h-4 text-brand-600 dark:text-brand-400" />
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
              className="w-full pl-9 pr-9 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 transition-colors"
              aria-expanded={showDropdown}
              aria-controls="customer-search-results"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-brand-500" />
            )}
          </div>

          {showDropdown && customers.length > 0 && (
            <div
              id="customer-search-results"
              className="absolute z-modal w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-card-hover max-h-60 overflow-y-auto custom-scrollbar"
              role="listbox"
            >
              {customers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => handleSelectCustomer(customer)}
                  disabled={isAssociating}
                  className="w-full text-left px-4 py-2.5 hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors flex items-start gap-3 disabled:opacity-50 focus-ring"
                  role="option"
                >
                  <div className="w-8 h-8 bg-brand-100 dark:bg-brand-900/40 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {customer.firstName} {customer.lastName}
                    </p>
                    <p className="text-2xs text-gray-500 dark:text-gray-400 truncate">
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
            <div className="absolute z-modal w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-card-hover p-4 text-center text-sm text-gray-500 dark:text-gray-400">
              No customers found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CartCustomerSelector;
