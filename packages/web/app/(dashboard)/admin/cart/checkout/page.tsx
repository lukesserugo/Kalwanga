// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\cart\checkout\page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, CreditCard, Wallet, Truck, Shield, Lock,
  Loader2, CheckCircle, AlertCircle, X, User,
  Package, ShoppingBag, DollarSign, Receipt,
  Printer, Download, Send, Clock, Calendar,
  Banknote, Smartphone, Building2,
  ChevronRight, Sparkles, Zap, Crown, BadgeCheck,
  QrCode, Copy, Check, Eye, Hash,
  MapPin, Phone, Mail, Building, Globe,
  Info, AlertTriangle, ShoppingCart, Plus, Minus,
  Gift
} from 'lucide-react';
import { toast } from '../../../../../utils/toast-manager';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import { api } from '../../../../../services/api';
import { cartService, Cart, CartItem } from '../../../../../services/cartService';
import { formatCurrency, formatDate } from '../../../../../utils/formatters';
import { CartSummary, CartItemList, CartSkeleton, EmptyCart } from '../../../../../components/cart';

// ============================================
// INTERFACES
// ============================================

interface CheckoutData {
  customerId?: string;
  paymentMethod: string;
  paidAmount: number;
  cashRegisterId?: string;
  cashRegisterSessionId?: string;
  notes?: string;
  tipAmount?: number;
}

interface CheckoutResult {
  sale: {
    id: string;
    receiptNumber: string;
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    paidAmount: number;
    changeAmount: number;
    status: string;
    saleDate: string;
    businessUnitId: string;
    userId: string;
    customerId?: string;
    cashRegisterId?: string;
    cashRegisterSessionId?: string;
  };
  cart: Cart;
  message: string;
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  loyaltyPoints?: number;
}

// ============================================
// CONSTANTS
// ============================================

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash', icon: Banknote },
  { value: 'CREDIT_CARD', label: 'Credit Card', icon: CreditCard },
  { value: 'DEBIT_CARD', label: 'Debit Card', icon: CreditCard },
  { value: 'MOBILE_MONEY', label: 'Mobile Money', icon: Smartphone },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer', icon: Building2 },
  { value: 'GIFT_CARD', label: 'Gift Card', icon: Gift },
  { value: 'LOYALTY_POINTS', label: 'Loyalty Points', icon: Wallet },
];

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminCartCheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canManage, isLoading: permissionLoading } = usePermission();
  
  const cartId = searchParams.get('cartId');
  
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null);
  
  // Form state
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [customerId, setCustomerId] = useState<string>('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [notes, setNotes] = useState('');
  const [tipAmount, setTipAmount] = useState<string>('');
  const [cashRegisterId, setCashRegisterId] = useState<string>('');
  const [cashRegisterSessionId, setCashRegisterSessionId] = useState<string>('');
  const [cashRegisters, setCashRegisters] = useState<Array<{ id: string; name: string }>>([]);

  const canCheckout = canManage(PermissionResource.CART_CHECKOUT) || canManage(PermissionResource.CART_MANAGE);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchCart = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      let cartData: Cart;
      
      if (cartId) {
        cartData = await cartService.getCartById(cartId);
      } else {
        cartData = await cartService.getCart();
      }
      
      setCart(cartData);
      
      // Set default paid amount to total
      setPaidAmount(cartData.total.toString());
      
      // Fetch cash registers
      try {
        const response = await api.get('/cash-registers');
        // ✅ FIX: response is the data directly, not { data: ... }
        if (response && Array.isArray(response)) {
          setCashRegisters(response);
        }
      } catch (error) {
        console.warn('Failed to fetch cash registers:', error);
      }
      
      // If cart has customer, fetch customer details
      if (cartData.customerId) {
        try {
          const customer = await api.get(`/customers/${cartData.customerId}`);
          // ✅ FIX: customer is the data directly
          if (customer) {
            setSelectedCustomer(customer as Customer);
            setCustomerId((customer as Customer).id);
          }
        } catch (error) {
          console.warn('Failed to fetch customer details:', error);
        }
      }
    } catch (error: any) {
      console.error('Failed to fetch cart:', error);
      setError(error?.message || 'Failed to load cart');
      toast.error('Failed to load cart');
    } finally {
      setLoading(false);
    }
  }, [cartId]);

  useEffect(() => {
    if (canCheckout) {
      fetchCart();
    } else {
      setLoading(false);
    }
  }, [canCheckout, fetchCart]);

  // ============================================
  // CUSTOMER SEARCH
  // ============================================

  useEffect(() => {
    const timer = setTimeout(() => {
      if (customerSearch.length >= 2) {
        searchCustomers(customerSearch);
      } else {
        setCustomers([]);
        setShowCustomerDropdown(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [customerSearch]);

  const searchCustomers = async (query: string) => {
    try {
      setIsSearchingCustomers(true);
      const response = await api.get(`/customers/search?q=${encodeURIComponent(query)}`);
      // ✅ FIX: response is the data directly
      setCustomers(Array.isArray(response) ? response : []);
      setShowCustomerDropdown(true);
    } catch (error) {
      console.warn('Failed to search customers:', error);
      setCustomers([]);
    } finally {
      setIsSearchingCustomers(false);
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerId(customer.id);
    setCustomerSearch(`${customer.firstName} ${customer.lastName}`);
    setShowCustomerDropdown(false);
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerId('');
    setCustomerSearch('');
    setCustomers([]);
    setShowCustomerDropdown(false);
  };

  // ============================================
  // CHECKOUT HANDLERS
  // ============================================

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!cart || cart.items.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    const paidAmountNum = parseFloat(paidAmount);
    if (isNaN(paidAmountNum) || paidAmountNum <= 0) {
      toast.error('Please enter a valid paid amount');
      return;
    }

    if (paidAmountNum < cart.total) {
      toast.error(`Paid amount (${formatCurrency(paidAmountNum)}) is less than total (${formatCurrency(cart.total)})`);
      return;
    }

    const tipAmountNum = tipAmount ? parseFloat(tipAmount) : 0;
    if (isNaN(tipAmountNum) || tipAmountNum < 0) {
      toast.error('Please enter a valid tip amount');
      return;
    }

    setCheckingOut(true);
    setError(null);

    try {
      const checkoutData: CheckoutData = {
        paymentMethod,
        paidAmount: paidAmountNum,
        notes: notes || undefined,
        tipAmount: tipAmountNum > 0 ? tipAmountNum : undefined,
        customerId: customerId || undefined,
        cashRegisterId: cashRegisterId || undefined,
        cashRegisterSessionId: cashRegisterSessionId || undefined,
      };

      console.log('📤 Checkout data:', checkoutData);

      const result = await cartService.checkoutCart(checkoutData);
      console.log('✅ Checkout result:', result);

      setCheckoutResult(result);
      setSuccess(true);
      toast.success('Checkout completed successfully!');
      
      // Dispatch cart update event
      window.dispatchEvent(new CustomEvent('cart:updated'));
      
      // Print receipt after short delay
      setTimeout(() => {
        if (result.sale) {
          handlePrintReceipt(result.sale.receiptNumber);
        }
      }, 1000);
    } catch (error: any) {
      console.error('❌ Checkout failed:', error);
      setError(error?.message || 'Failed to complete checkout');
      toast.error(error?.message || 'Failed to complete checkout');
    } finally {
      setCheckingOut(false);
    }
  };

  const handlePrintReceipt = (receiptNumber: string) => {
    const printWindow = window.open(`/receipts/${receiptNumber}/print`, '_blank');
    if (printWindow) {
      printWindow.focus();
    } else {
      toast.info('Please allow popups to print receipts');
    }
  };

  const handleViewSale = (saleId: string) => {
    router.push(`/admin/sales/${saleId}`);
  };

  const handleNewSale = () => {
    setSuccess(false);
    setCheckoutResult(null);
    setPaymentMethod('CASH');
    setPaidAmount('');
    setNotes('');
    setTipAmount('');
    setCustomerId('');
    setSelectedCustomer(null);
    setCustomerSearch('');
    fetchCart();
  };

  // ============================================
  // HELPERS
  // ============================================

  const getPaymentMethodLabel = (value: string) => {
    const method = PAYMENT_METHODS.find(m => m.value === value);
    return method?.label || value;
  };

  const getPaymentMethodIcon = (value: string) => {
    const method = PAYMENT_METHODS.find(m => m.value === value);
    const Icon = method?.icon || CreditCard;
    return <Icon className="w-5 h-5" />;
  };

  const calculateChange = () => {
    if (!cart) return 0;
    const paid = parseFloat(paidAmount) || 0;
    return Math.max(0, paid - cart.total);
  };

  // ============================================
  // PERMISSION GUARD
  // ============================================

  if (permissionLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 dark:text-blue-400 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading checkout...</p>
        </div>
      </div>
    );
  }

  if (!canCheckout) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to checkout carts. Please contact your administrator.
        </p>
        <button
          onClick={() => router.push('/admin')}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  // ============================================
  // RENDER - SUCCESS
  // ============================================

  if (success && checkoutResult) {
    const { sale, cart: cartData } = checkoutResult;
    
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => router.push('/admin/cart')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Checkout Complete
            </h1>
          </div>

          {/* Success Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-green-200 dark:border-green-800 p-8 text-center"
          >
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Checkout Successful!
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              Sale #{sale.receiptNumber} has been completed successfully.
            </p>
            
            {/* Sale Summary */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Receipt</p>
                <p className="font-semibold text-gray-900 dark:text-white">{sale.receiptNumber}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(sale.total)}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Payment</p>
                <p className="font-semibold text-gray-900 dark:text-white">{getPaymentMethodLabel(paymentMethod)}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Change</p>
                <p className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(sale.changeAmount || 0)}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => handlePrintReceipt(sale.receiptNumber)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
              >
                <Printer className="w-5 h-5" />
                Print Receipt
              </button>
              <button
                onClick={() => handleViewSale(sale.id)}
                className="px-6 py-3 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl font-medium transition-colors flex items-center gap-2"
              >
                <Eye className="w-5 h-5" />
                View Sale
              </button>
              <button
                onClick={handleNewSale}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
              >
                <ShoppingCart className="w-5 h-5" />
                New Sale
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER - EMPTY CART
  // ============================================

  if (!cart || cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => router.push('/admin/cart')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Checkout
            </h1>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <ShoppingCart className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Cart is Empty</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">There are no items to checkout.</p>
            <Link
              href="/admin/cart"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Cart
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER - MAIN CHECKOUT
  // ============================================

  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const changeAmount = calculateChange();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/cart')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Back to cart"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                Checkout
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {itemCount} {itemCount === 1 ? 'item' : 'items'} ready for checkout
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm">
              <Shield className="w-4 h-4" />
              Secure Checkout
            </span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">Error</p>
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 dark:text-red-400 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Content */}
        <form onSubmit={handleCheckout} className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Checkout Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Cart Items Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-500" />
                  Cart Items ({itemCount})
                </h3>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[300px] overflow-y-auto">
                {cart.items.map((item) => (
                  <div key={item.id} className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                      {item.product.images?.[0] ? (
                        <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-6 h-6 text-gray-400 mx-auto mt-3" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">{item.product.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {item.quantity} × {formatCurrency(item.unitPrice)}
                      </p>
                      {item.variant && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">Variant: {item.variant.name}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(item.total)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Customer Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-blue-500" />
                Customer
              </h3>
              
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
                    type="button"
                    onClick={handleClearCustomer}
                    className="p-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded transition-colors"
                  >
                    <X className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                      <User className="w-4 h-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      onFocus={() => customerSearch.length >= 2 && setShowCustomerDropdown(true)}
                      placeholder="Search customer by name, email, or phone..."
                      className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 dark:text-white"
                    />
                    {isSearchingCustomers && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                      </div>
                    )}
                  </div>

                  {showCustomerDropdown && customers.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {customers.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
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
                </div>
              )}
            </div>

            {/* Cash Register */}
            {cashRegisters.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                  <Building2 className="w-5 h-5 text-blue-500" />
                  Cash Register
                </h3>
                <select
                  value={cashRegisterId}
                  onChange={(e) => setCashRegisterId(e.target.value)}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 dark:text-white"
                >
                  <option value="">Select Cash Register</option>
                  {cashRegisters.map((register) => (
                    <option key={register.id} value={register.id}>{register.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Notes */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <Info className="w-5 h-5 text-blue-500" />
                Notes
              </h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add special instructions or notes..."
                rows={2}
                className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 dark:text-white resize-none"
              />
            </div>
          </div>

          {/* Payment Summary */}
          <div className="lg:col-span-1 space-y-6">
            {/* Cart Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 sticky top-24">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <Receipt className="w-5 h-5 text-blue-500" />
                Payment Summary
              </h3>

              <div className="space-y-2 border-b border-gray-200 dark:border-gray-700 pb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                  <span className="font-medium">{formatCurrency(cart.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Tax</span>
                  <span className="font-medium">{formatCurrency(cart.tax)}</span>
                </div>
                {cart.discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(cart.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-gray-900 dark:text-white">Total</span>
                  <span className="text-blue-600 dark:text-blue-400">{formatCurrency(cart.total)}</span>
                </div>
              </div>

              {/* Payment Method */}
              <div className="mt-4 space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((method) => {
                    const Icon = method.icon;
                    return (
                      <button
                        key={method.value}
                        type="button"
                        onClick={() => setPaymentMethod(method.value)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all duration-200 ${
                          paymentMethod === method.value
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                            : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-300'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {method.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Paid Amount */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Paid Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min={cart.total}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              {/* Tip Amount */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tip Amount (Optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={tipAmount}
                    onChange={(e) => setTipAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Change */}
              {parseFloat(paidAmount) > 0 && changeAmount > 0 && (
                <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-700 dark:text-green-300">Change Due</span>
                    <span className="font-bold text-green-700 dark:text-green-300">{formatCurrency(changeAmount)}</span>
                  </div>
                </div>
              )}

              {/* Checkout Button */}
              <button
                type="submit"
                disabled={checkingOut || !cart || cart.items.length === 0}
                className="w-full mt-6 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {checkingOut ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Complete Checkout
                  </>
                )}
              </button>

              {/* Trust Badges */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1">
                  <Shield className="w-3 h-3 text-emerald-500" />
                  Secure
                </span>
                <span className="inline-flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-500" />
                  Encrypted
                </span>
                <span className="inline-flex items-center gap-1">
                  <BadgeCheck className="w-3 h-3 text-blue-500" />
                  Verified
                </span>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
