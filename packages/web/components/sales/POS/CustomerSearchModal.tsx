// packages/web/components/customers/CustomerSearchModal.tsx
'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  X,
  Search,
  Loader2,
  Mail,
  Phone,
  Plus,
  Users,
  AlertCircle,
} from 'lucide-react';

import { customerService } from '../../../services/customerService';
import type { Customer } from '../../../services/customerService';
import { toast } from '../../../utils/toast-manager';
import { formatCurrency } from '../../../utils/formatters';

// ============================================
// TYPES
// ============================================

export interface CustomerSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCustomer: (customer: Customer) => void;
}

interface CreateFormState {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
}

const EMPTY_CREATE_FORM: CreateFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
};

const MIN_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 300;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ============================================
// HELPERS
// ============================================

function extractErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  const anyErr = error as any;
  const data = anyErr?.response?.data;

  if (data) {
    if (typeof data.error === 'string') return data.error;
    if (data.error?.message) return String(data.error.message);
    if (data.message) return String(data.message);
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors
        .map((e: any) => `${e.field ?? 'field'}: ${e.message ?? 'invalid'}`)
        .join(', ');
    }
  }

  if (anyErr?.message) return String(anyErr.message);
  return fallback;
}

/**
 * The canonical `Customer` from the service types `email` and
 * `phoneNumber` as nullable. This helper formats them for display,
 * returning `null` when there's nothing to show so the caller can
 * hide the row entirely.
 */
function displayOrNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// ============================================
// COMPONENT
// ============================================

export function CustomerSearchModal({
  isOpen,
  onClose,
  onSelectCustomer,
}: CustomerSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(
    EMPTY_CREATE_FORM,
  );
  const [isCreating, setIsCreating] = useState(false);

  const mountedRef = useRef(true);
  const searchRequestIdRef = useRef(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Reset on open transition ─────────────────────────────
  //
  // State persists across open/close cycles unless we clear it.
  // Resetting on the false → true transition gives the operator a
  // fresh modal every time, without clobbering the form while the
  // modal is open.

  const wasOpenRef = useRef(false);
  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = isOpen;

    if (isOpen && !wasOpen) {
      setSearchQuery('');
      setCustomers([]);
      setSearchError(null);
      setSearching(false);
      setShowCreateForm(false);
      setCreateForm(EMPTY_CREATE_FORM);
      setIsCreating(false);
    }
  }, [isOpen]);

  // Focus the search input when the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => searchInputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [isOpen]);

  // ── Search ───────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;

    const trimmed = searchQuery.trim();

    if (trimmed.length < MIN_QUERY_LENGTH) {
      setCustomers([]);
      setSearchError(null);
      setSearching(false);
      return;
    }

    const requestId = ++searchRequestIdRef.current;
    setSearching(true);
    setSearchError(null);

    const timer = setTimeout(async () => {
      try {
        const results = await customerService.searchCustomers({
          query: trimmed,
          limit: 10,
        });

        // Drop stale responses — a faster subsequent search may
        // already have resolved.
        if (requestId !== searchRequestIdRef.current) return;
        if (!mountedRef.current) return;

        setCustomers(Array.isArray(results) ? results : []);
        setSearching(false);
      } catch (error) {
        if (requestId !== searchRequestIdRef.current) return;
        if (!mountedRef.current) return;

        const message = extractErrorMessage(
          error,
          'Failed to search customers',
        );
        console.error('[CustomerSearchModal] search failed:', message);
        setSearchError(message);
        setCustomers([]);
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen]);

  // ── Handlers ─────────────────────────────────────────────

  const handleSelectCustomer = useCallback(
    (customer: Customer) => {
      onSelectCustomer(customer);
      // Close the modal after selection — the parent's callback
      // decides what happens next. Matches the create flow.
      onClose();
    },
    [onSelectCustomer, onClose],
  );

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  }, []);

  /**
   * Force the search effect to re-run for the current query. Used by
   * the Retry button in the error state.
   */
  const handleRetrySearch = useCallback(() => {
    setSearchQuery((q) => q);
    // The effect won't re-fire if the string identity is unchanged.
    // Bump a request id by resetting the error and letting the next
    // effect run handle it. The simplest reliable trigger is to
    // briefly clear the error and force a re-render with the same
    // query — the effect's dep is `searchQuery`, so we mutate it
    // minimally.
    setSearchError(null);
    setSearching(true);
    // Kick off the same search directly.
    const trimmed = searchQuery.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) return;
    const requestId = ++searchRequestIdRef.current;
    void customerService
      .searchCustomers({ query: trimmed, limit: 10 })
      .then((results) => {
        if (requestId !== searchRequestIdRef.current) return;
        if (!mountedRef.current) return;
        setCustomers(Array.isArray(results) ? results : []);
        setSearching(false);
      })
      .catch((error) => {
        if (requestId !== searchRequestIdRef.current) return;
        if (!mountedRef.current) return;
        const message = extractErrorMessage(
          error,
          'Failed to search customers',
        );
        console.error('[CustomerSearchModal] search failed:', message);
        setSearchError(message);
        setCustomers([]);
        setSearching(false);
      });
  }, [searchQuery]);

  const handleCreateCustomer = useCallback(async () => {
    const form = {
      firstName: createForm.firstName.trim(),
      lastName: createForm.lastName.trim(),
      email: createForm.email.trim(),
      phoneNumber: createForm.phoneNumber.trim(),
    };

    // Caller-owned validation. The form component does its own
    // check; this is a defensive duplicate in case the callback is
    // invoked directly.
    if (!form.firstName || !form.lastName || !form.email) {
      toast.warning('Please fill in all required fields');
      return;
    }

    setIsCreating(true);
    try {
      const newCustomer = await customerService.createCustomer({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phoneNumber: form.phoneNumber || undefined,
        isActive: true,
      });

      if (!mountedRef.current) return;

      if (!newCustomer || !newCustomer.id) {
        // The service contract is "returns a Customer or throws" —
        // a falsy return is a contract violation, not a success.
        throw new Error('Customer created but no ID was returned');
      }

      toast.success(
        `Customer ${form.firstName} ${form.lastName} created`,
      );
      onSelectCustomer(newCustomer);
      onClose();
    } catch (error) {
      if (!mountedRef.current) return;

      const message = extractErrorMessage(
        error,
        'Failed to create customer',
      );
      console.error('[CustomerSearchModal] create failed:', message);
      toast.error(message);
    } finally {
      if (mountedRef.current) setIsCreating(false);
    }
  }, [createForm, onSelectCustomer, onClose]);

  // ── Render ───────────────────────────────────────────────

  if (!isOpen) return null;

  const trimmedQuery = searchQuery.trim();
  const showEmptySearch = trimmedQuery.length < MIN_QUERY_LENGTH;
  const showNoResults =
    !showEmptySearch && !searching && customers.length === 0 && !searchError;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-search-title"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h2
              id="customer-search-title"
              className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"
            >
              <Users className="w-5 h-5 text-blue-500" aria-hidden="true" />
              Find Customer
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Search for an existing customer or create a new one
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
          >
            <X className="w-5 h-5 text-gray-500" aria-hidden="true" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none"
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
              type="search"
              placeholder="Search by name, email, or phone…"
              aria-label="Search customers"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
              className="w-full pl-10 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus-ring rounded"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Results — flex-1 min-h-0 so it actually shrinks when the
            create form appears. Without min-h-0 the flex item keeps
            its content height and pushes the form off-screen. */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {searching ? (
            <div className="flex items-center justify-center py-12">
              <Loader2
                className="w-8 h-8 text-blue-500 animate-spin"
                aria-hidden="true"
              />
              <span className="ml-2 text-gray-500 dark:text-gray-400">
                Searching…
              </span>
            </div>
          ) : searchError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300"
            >
              <AlertCircle
                className="w-4 h-4 flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="flex-1">
                <p>{searchError}</p>
                <button
                  type="button"
                  onClick={handleRetrySearch}
                  className="mt-1 text-xs font-medium underline focus-ring rounded"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : customers.length > 0 ? (
            <div className="space-y-2" role="list">
              {customers.map((customer) => (
                <CustomerResultItem
                  key={customer.id}
                  customer={customer}
                  onSelect={() => handleSelectCustomer(customer)}
                />
              ))}
            </div>
          ) : showNoResults ? (
            <div className="text-center py-12">
              <Users
                className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2"
                aria-hidden="true"
              />
              <p className="text-gray-500 dark:text-gray-400">
                No customers found
              </p>
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="mt-2 text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mx-auto focus-ring rounded"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                Create New Customer
              </button>
            </div>
          ) : showEmptySearch ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <Users
                className="w-12 h-12 mx-auto mb-2 opacity-50"
                aria-hidden="true"
              />
              <p>
                Type at least {MIN_QUERY_LENGTH} characters to search
              </p>
            </div>
          ) : null}

          {/* Create form — moved inside the scrollable region so it
              scrolls with the results and doesn't push them off. */}
          {showCreateForm && (
            <div className="mt-4">
              <CreateCustomerForm
                formData={createForm}
                onChange={setCreateForm}
                onCancel={() => {
                  setShowCreateForm(false);
                  setCreateForm(EMPTY_CREATE_FORM);
                }}
                onSubmit={() => void handleCreateCustomer()}
                isCreating={isCreating}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// CUSTOMER RESULT ITEM
// ============================================

interface CustomerResultItemProps {
  customer: Customer;
  onSelect: () => void;
}

function CustomerResultItem({ customer, onSelect }: CustomerResultItemProps) {
  const email = displayOrNull(customer.email);
  const phone = displayOrNull(customer.phoneNumber);
  const loyaltyPoints =
    typeof customer.loyaltyPoints === 'number' ? customer.loyaltyPoints : 0;
  const totalSpent =
    typeof customer.totalSpent === 'number' ? customer.totalSpent : 0;

  return (
    <button
      type="button"
      role="listitem"
      onClick={onSelect}
      className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors flex items-center justify-between text-left focus-ring"
    >
      <div className="min-w-0">
        <p className="font-medium text-gray-900 dark:text-white truncate">
          {customer.firstName} {customer.lastName}
        </p>
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
          {email && (
            <span className="flex items-center gap-1 truncate">
              <Mail className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
              <span className="truncate">{email}</span>
            </span>
          )}
          {phone && (
            <span className="flex items-center gap-1 tabular-nums">
              <Phone className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
              {phone}
            </span>
          )}
        </div>
      </div>
      <div className="text-right flex-shrink-0 ml-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Loyalty Points
        </p>
        <p className="font-bold text-blue-600 dark:text-blue-400 tabular-nums">
          {loyaltyPoints}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
          Spent: {formatCurrency(totalSpent)}
        </p>
      </div>
    </button>
  );
}

// ============================================
// CREATE CUSTOMER FORM
// ============================================

interface CreateCustomerFormProps {
  formData: CreateFormState;
  onChange: (data: CreateFormState) => void;
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

  // Clear a field's error the moment the user edits it.
  const updateField = useCallback(
    <K extends keyof CreateFormState>(
      key: K,
      value: CreateFormState[K],
    ) => {
      onChange({ ...formData, [key]: value });
      setErrors((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [formData, onChange],
  );

  const validate = useCallback((): boolean => {
    const next: Record<string, string> = {};

    if (!formData.firstName.trim()) next.firstName = 'First name is required';
    if (!formData.lastName.trim()) next.lastName = 'Last name is required';

    const email = formData.email.trim();
    if (!email) {
      next.email = 'Email is required';
    } else if (!EMAIL_PATTERN.test(email)) {
      next.email = 'Invalid email format';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (isCreating) return;
      if (!validate()) return;
      onSubmit();
    },
    [isCreating, validate, onSubmit],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50"
    >
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
        <Plus className="w-4 h-4 text-blue-500" aria-hidden="true" />
        Create New Customer
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="new-customer-first-name"
            className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            First Name <span className="text-red-500">*</span>
          </label>
          <input
            id="new-customer-first-name"
            type="text"
            value={formData.firstName}
            onChange={(e) => updateField('firstName', e.target.value)}
            disabled={isCreating}
            autoComplete="given-name"
            className={`w-full px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 ${
              errors.firstName
                ? 'border-red-500'
                : 'border-gray-300 dark:border-gray-600'
            }`}
            placeholder="John"
          />
          {errors.firstName && (
            <p className="text-xs text-red-500 mt-1" role="alert">
              {errors.firstName}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="new-customer-last-name"
            className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Last Name <span className="text-red-500">*</span>
          </label>
          <input
            id="new-customer-last-name"
            type="text"
            value={formData.lastName}
            onChange={(e) => updateField('lastName', e.target.value)}
            disabled={isCreating}
            autoComplete="family-name"
            className={`w-full px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 ${
              errors.lastName
                ? 'border-red-500'
                : 'border-gray-300 dark:border-gray-600'
            }`}
            placeholder="Doe"
          />
          {errors.lastName && (
            <p className="text-xs text-red-500 mt-1" role="alert">
              {errors.lastName}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="new-customer-email"
            className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Email <span className="text-red-500">*</span>
          </label>
          <input
            id="new-customer-email"
            type="email"
            value={formData.email}
            onChange={(e) => updateField('email', e.target.value)}
            disabled={isCreating}
            autoComplete="email"
            className={`w-full px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 ${
              errors.email
                ? 'border-red-500'
                : 'border-gray-300 dark:border-gray-600'
            }`}
            placeholder="john.doe@example.com"
          />
          {errors.email && (
            <p className="text-xs text-red-500 mt-1" role="alert">
              {errors.email}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="new-customer-phone"
            className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Phone Number
          </label>
          <input
            id="new-customer-phone"
            type="tel"
            value={formData.phoneNumber}
            onChange={(e) => updateField('phoneNumber', e.target.value)}
            disabled={isCreating}
            autoComplete="tel"
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
            placeholder="(555) 123-4567"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isCreating}
          className="px-4 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm disabled:opacity-50 focus-ring"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isCreating}
          className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
        >
          {isCreating ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="w-4 h-4" aria-hidden="true" />
          )}
          {isCreating ? 'Creating…' : 'Create Customer'}
        </button>
      </div>
    </form>
  );
}

export default CustomerSearchModal;
