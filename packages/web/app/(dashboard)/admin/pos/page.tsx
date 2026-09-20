'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Loader2, ShoppingCart, Search, Package, User, CreditCard, Banknote, Wallet, Smartphone, Gift, Building, X, Plus, Minus, Trash2, RefreshCw, Users, Clock, DollarSign, FileText, Printer, Settings, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../../../hooks/useAuth';
import { api } from '../../../../services/api';
import { toast } from '../../../../utils/toast-manager';
import { formatCurrency } from '../../../../utils/formatters';
import {
  QuickActions,
  CustomerSearchModal,
  QuickProductModal,
  PriceOverrideModal,
  ShiftManagerModal,
  ReprintReceiptModal,
  HeldOrdersModal
} from '../../../../components/sales/POS';

// ============================================
// INTERFACES
// ============================================

interface CartItem {
  id: string;
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
  availableStock: number;
}

interface Cart {
  id: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  customerId?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
  images?: string[];
  inventory?: Array<{
    quantity: number;
    reserved: number;
  }>;
}

interface ProductsResponse {
  data: Product[];
  pagination?: {
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  };
}

interface HeldOrder {
  id: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  customerName?: string;
  total: number;
  createdAt: string;
  notes?: string;
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function POSPage() {
  const { isLoaded, isSignedIn } = useUser();
  const { user: authUser } = useAuth();
  const router = useRouter();

  // State
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paidAmount, setPaidAmount] = useState(0);
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [searching, setSearching] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [showHeldOrders, setShowHeldOrders] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Modal States
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Check user permissions
  const userRole = authUser?.role as string || 'EMPLOYEE';
  const canManagePos = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER'].includes(userRole);

  // Redirect if not authorized
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/login?redirect=/admin/sales/pos');
      return;
    }
    if (isLoaded && isSignedIn && !canManagePos) {
      router.push('/admin/sales');
      toast.error('You do not have permission to access POS');
    }
  }, [isLoaded, isSignedIn, router, canManagePos]);

  // ============================================
  // API CALLS
  // ============================================

  const fetchCart = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<ApiResponse<Cart>>('/cart');
      setCart(response.data || { id: '', items: [], subtotal: 0, tax: 0, discount: 0, total: 0 });
    } catch (error: any) {
      console.error('Error fetching cart:', error);
      setCart({
        id: '',
        items: [],
        subtotal: 0,
        tax: 0,
        discount: 0,
        total: 0
      });
      toast.error('Failed to load cart');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      setProductsLoading(true);
      const response = await api.get<ApiResponse<ProductsResponse>>('/products', {
        params: { limit: 50, isActive: true }
      });
      const productsData = response?.data?.data || [];
      setProducts(productsData);
    } catch (error: any) {
      console.error('Error fetching products:', error);
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCart();
    fetchProducts();
  }, [fetchCart, fetchProducts]);

  // ============================================
  // SEARCH
  // ============================================

  const searchProducts = async (query?: string) => {
    const searchTerm = query || searchQuery;
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const response = await api.get<ApiResponse<ProductsResponse>>('/products', {
        params: { search: searchTerm, limit: 10, isActive: true }
      });

      const results = response?.data?.data || [];
      setSearchResults(results);
    } catch (error: any) {
      console.error('Search error:', error);
      toast.error(error.response?.data?.message || 'Failed to search products');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        searchProducts(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ============================================
  // CART OPERATIONS
  // ============================================

  const addItemToCart = async (productId: string, quantity: number = 1) => {
    try {
      const response = await api.post<ApiResponse<Cart>>('/cart/items', { productId, quantity });
      setCart(response.data || null);
      toast.success('Item added to cart');
      setSearchQuery('');
      setSearchResults([]);
    } catch (error: any) {
      if (error.response?.status === 401) {
        toast.error('Please login to add items to cart');
      } else {
        toast.error(error.response?.data?.message || 'Failed to add item');
      }
    }
  };

  const updateItemQuantity = async (itemId: string, quantity: number) => {
    try {
      if (quantity <= 0) {
        await removeItem(itemId);
        return;
      }
      const response = await api.put<ApiResponse<Cart>>(`/cart/items/${itemId}`, { quantity });
      setCart(response.data || null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update item');
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      const response = await api.delete<ApiResponse<Cart>>(`/cart/items/${itemId}`);
      setCart(response.data || null);
      toast.success('Item removed');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to remove item');
    }
  };

  const clearCart = async () => {
    if (!confirm('Are you sure you want to clear the cart?')) return;

    try {
      const response = await api.delete<ApiResponse<Cart>>('/cart');
      setCart(response.data || null);
      toast.success('Cart cleared');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to clear cart');
    }
  };

  // ============================================
  // CHECKOUT
  // ============================================

  const handleCheckout = async () => {
    if (!cart || cart.items.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    if (paidAmount < cart.total) {
      toast.error('Insufficient payment amount');
      return;
    }

    try {
      setIsCheckingOut(true);
      const response = await api.post<ApiResponse<any>>('/checkout', {
        cartId: cart.id,
        paymentMethod,
        paidAmount,
        customerId: customerId || undefined,
      });

      if (response.success) {
        toast.success('Checkout completed successfully!');
        setCart({
          id: '',
          items: [],
          subtotal: 0,
          tax: 0,
          discount: 0,
          total: 0
        });
        setPaidAmount(0);
        setCustomerId('');
        setCustomerName('');
        await fetchCart();
      } else {
        toast.error(response.message || 'Checkout failed');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Checkout failed');
    } finally {
      setIsCheckingOut(false);
    }
  };

  // ============================================
  // HELD ORDERS
  // ============================================

  const holdOrder = async () => {
    if (!cart || cart.items.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    const heldOrder: HeldOrder = {
      id: `hold_${Date.now()}`,
      items: cart.items.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.unitPrice,
        total: item.total
      })),
      customerName: customerName || undefined,
      total: cart.total,
      createdAt: new Date().toISOString(),
    };

    setHeldOrders([...heldOrders, heldOrder]);
    await clearCart();
    toast.success('Order held successfully');
  };

  const restoreHeldOrder = async (orderId: string) => {
    const order = heldOrders.find(h => h.id === orderId);
    if (!order) return;

    // Add items back to cart
    for (const item of order.items) {
      await addItemToCart(item.id, item.quantity);
    }

    if (order.customerName) {
      setCustomerName(order.customerName);
    }

    setHeldOrders(heldOrders.filter(h => h.id !== orderId));
    toast.success('Order restored');
    setShowHeldOrders(false);
  };

  const deleteHeldOrder = (orderId: string) => {
    setHeldOrders(heldOrders.filter(h => h.id !== orderId));
    toast.info('Held order deleted');
  };

  // ============================================
  // QUICK ACTIONS HANDLERS
  // ============================================

  const handleAddCustomer = (customer: any) => {
    setCustomerId(customer.id);
    setCustomerName(`${customer.firstName} ${customer.lastName}`);
    toast.success(`Customer ${customerName} selected`);
  };

  const handleQuickProduct = (product: any) => {
    addItemToCart(product.id, product.quantity || 1);
  };

  const handlePriceOverride = (data: any) => {
    toast.info(`Price override applied to ${data.productName}`);
    // Here you would update the cart item price
  };

  const handleShiftAction = (action: string, data: any) => {
    if (action === 'start_shift') {
      toast.success(`Shift started with ${formatCurrency(data.startingBalance)}`);
    } else if (action === 'close_shift') {
      toast.success(`Shift closed with ${formatCurrency(data.endingBalance)}`);
    }
  };

  const handleReprintReceipt = (receiptNumber: string) => {
    toast.info(`Reprinting receipt #${receiptNumber}`);
    // Here you would trigger the reprint
  };

  const handleViewSales = () => {
    window.open('/admin/sales', '_blank');
  };

  // ============================================
  // HELPERS
  // ============================================

  const getAvailableStock = (product: Product) => {
    const inventory = product.inventory?.[0];
    if (!inventory) return 0;
    return Math.max(0, inventory.quantity - inventory.reserved);
  };

  const changeAmount = paidAmount >= (cart?.total || 0) ? paidAmount - (cart?.total || 0) : 0;

  // ============================================
  // LOADING & PERMISSION CHECK
  // ============================================

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center animate-fade-in">
          <Loader2 className="w-12 h-12 animate-spin text-brand-600 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading POS...</p>
        </div>
      </div>
    );
  }

  if (!authUser || !canManagePos) {
    return null;
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex h-screen overflow-hidden">
        {/* Main POS Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 shadow-soft px-6 py-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Point of Sale</h1>
              <span className="px-2 py-1 bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300 rounded-full text-2xs font-medium flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Shift Open
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition duration-250 focus-ring"
                title="Toggle Sidebar"
                aria-label="Toggle sidebar"
              >
                <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left - Products */}
            <div className="flex-1 flex flex-col">
              {/* Search Bar */}
              <div className="bg-white dark:bg-gray-800 shadow-soft p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search by name, SKU, or barcode..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition duration-250"
                    />
                    {searching && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Product Grid */}
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {searchQuery ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {searchResults.length > 0 ? (
                      searchResults.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          onAdd={() => addItemToCart(product.id)}
                          availableStock={getAvailableStock(product)}
                        />
                      ))
                    ) : (
                      <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
                        <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No products found</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {productsLoading ? (
                      <div className="col-span-full text-center py-12">
                        <Loader2 className="w-8 h-8 text-brand-500 animate-spin mx-auto" />
                        <p className="mt-2 text-gray-500 dark:text-gray-400">Loading products...</p>
                      </div>
                    ) : products.length > 0 ? (
                      products.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          onAdd={() => addItemToCart(product.id)}
                          availableStock={getAvailableStock(product)}
                        />
                      ))
                    ) : (
                      <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
                        <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No products available</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Cart Summary Footer */}
              {cart && cart.items.length > 0 && (
                <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-3 flex-shrink-0">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Items: <span className="font-medium tabular-nums text-gray-900 dark:text-white">{cart.items.length}</span>
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Total: <span className="font-bold tabular-nums text-brand-600 dark:text-brand-400">{formatCurrency(cart.total)}</span>
                      </span>
                    </div>
                    <button
                      onClick={() => document.getElementById('cart-section')?.scrollIntoView({ behavior: 'smooth' })}
                      className="btn-brand"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      View Cart
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right - Cart */}
            <div className="w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col" id="cart-section">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Cart
                  {cart && cart.items.length > 0 && (
                    <span className="badge-brand tabular-nums animate-badge-pop">
                      {cart.items.length}
                    </span>
                  )}
                </h2>
                {cart && cart.items.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-sm text-danger-600 hover:text-danger-800 dark:text-danger-400 dark:hover:text-danger-300 transition duration-250 focus-ring"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Cart Items */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                {!cart || cart.items.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Cart is empty</p>
                    <p className="text-sm">Search and add products</p>
                  </div>
                ) : (
                  cart.items.map((item) => (
                    <CartItemCard
                      key={item.id}
                      item={item}
                      onUpdateQuantity={(qty) => updateItemQuantity(item.id, qty)}
                      onRemove={() => removeItem(item.id)}
                    />
                  ))
                )}
              </div>

              {/* Cart Summary */}
              {cart && cart.items.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex-shrink-0">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                      <span className="tabular-nums text-gray-900 dark:text-white">{formatCurrency(cart.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Tax</span>
                      <span className="tabular-nums text-gray-900 dark:text-white">{formatCurrency(cart.tax)}</span>
                    </div>
                    {cart.discount > 0 && (
                      <div className="flex justify-between text-sm text-success-600 dark:text-success-400">
                        <span>Discount</span>
                        <span className="tabular-nums">-{formatCurrency(cart.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-gray-900 dark:text-white">Total</span>
                      <span className="tabular-nums text-brand-600 dark:text-brand-400">{formatCurrency(cart.total)}</span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {customerName && (
                      <div className="flex items-center gap-2 text-sm text-brand-600 dark:text-brand-400">
                        <User className="w-4 h-4" />
                        <span>{customerName}</span>
                        <button
                          onClick={() => {
                            setCustomerId('');
                            setCustomerName('');
                          }}
                          className="text-danger-500 hover:text-danger-700 transition duration-250 focus-ring rounded"
                          aria-label="Remove customer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition duration-250"
                    >
                      <option value="CASH">Cash</option>
                      <option value="CREDIT_CARD">Credit Card</option>
                      <option value="DEBIT_CARD">Debit Card</option>
                      <option value="MOBILE_MONEY">Mobile Money</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="GIFT_CARD">Gift Card</option>
                    </select>
                    <input
                      type="number"
                      placeholder="Amount Paid"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition duration-250 tabular-nums"
                      step="0.01"
                      min="0"
                    />
                    {paidAmount > 0 && paidAmount < (cart?.total || 0) && (
                      <p className="text-danger-500 text-sm tabular-nums">
                        Insufficient amount. Remaining: {formatCurrency((cart?.total || 0) - paidAmount)}
                      </p>
                    )}
                    {paidAmount >= (cart?.total || 0) && cart?.total > 0 && (
                      <p className="text-success-600 dark:text-success-400 text-sm tabular-nums">
                        Change: {formatCurrency(changeAmount)}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={handleCheckout}
                      disabled={isCheckingOut || paidAmount < (cart?.total || 0) || cart.items.length === 0}
                      className="flex-1 btn-success disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCheckingOut ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CreditCard className="w-4 h-4" />
                      )}
                      {isCheckingOut ? 'Processing...' : 'Checkout'}
                    </button>
                    <button
                      onClick={holdOrder}
                      disabled={cart.items.length === 0}
                      className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Hold order"
                      aria-label="Hold order"
                    >
                      <Clock className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar - Quick Actions */}
        <div className={`w-64 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-4 overflow-y-auto custom-scrollbar flex-shrink-0 transition-all duration-350 ${sidebarCollapsed ? 'hidden' : ''}`}>
          <QuickActions
            onRefresh={fetchCart}
            onViewSales={handleViewSales}
            onAddCustomer={() => setIsCustomerModalOpen(true)}
            onAddProduct={() => setIsProductModalOpen(true)}
            onPriceOverride={() => setIsPriceModalOpen(true)}
            onShiftAction={handleShiftAction}
            onReprintReceipt={handleReprintReceipt}
            heldOrdersCount={heldOrders.length}
          />
        </div>
      </div>

      {/* Modals */}
      <CustomerSearchModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSelectCustomer={handleAddCustomer}
      />

      <QuickProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSelectProduct={handleQuickProduct}
      />

      <PriceOverrideModal
        isOpen={isPriceModalOpen}
        onClose={() => setIsPriceModalOpen(false)}
        onConfirm={handlePriceOverride}
      />

      <ShiftManagerModal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        onAction={handleShiftAction}
      />

      <ReprintReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        onReprint={handleReprintReceipt}
      />

      <HeldOrdersModal
        isOpen={showHeldOrders}
        onClose={() => setShowHeldOrders(false)}
        orders={heldOrders}
        onRestore={restoreHeldOrder}
        onDelete={deleteHeldOrder}
      />
    </div>
  );
}

// ============================================
// PRODUCT CARD COMPONENT
// ============================================

interface ProductCardProps {
  product: Product;
  onAdd: () => void;
  availableStock: number;
}

function ProductCard({ product, onAdd, availableStock }: ProductCardProps) {
  const isOutOfStock = availableStock <= 0;

  return (
    <div
      onClick={isOutOfStock ? undefined : onAdd}
      className={`border rounded-xl p-3 transition-all duration-250 ${
        isOutOfStock
          ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-700'
          : 'cursor-pointer hover:shadow-card-hover hover:border-brand-300 dark:hover:border-brand-500/50 border-gray-200 dark:border-gray-700'
      } bg-white dark:bg-gray-800 focus-ring`}
      role="button"
      tabIndex={isOutOfStock ? -1 : 0}
      aria-label={isOutOfStock ? `${product.name} out of stock` : `Add ${product.name} to cart`}
    >
      <div className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
        {product.images?.[0] ? (
          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover rounded-lg" />
        ) : (
          <Package className="w-8 h-8 text-gray-400 dark:text-gray-500" />
        )}
      </div>
      <h3 className="font-medium text-sm truncate text-gray-900 dark:text-white">{product.name}</h3>
      <p className="text-2xs font-mono text-gray-500 dark:text-gray-400 truncate">{product.sku}</p>
      <p className="text-sm font-bold tabular-nums text-brand-600 dark:text-brand-400">{formatCurrency(product.unitPrice)}</p>
      <p className={`text-2xs tabular-nums ${availableStock <= 5 ? 'text-danger-500' : 'text-gray-500 dark:text-gray-400'}`}>
        Stock: {availableStock}
      </p>
      {isOutOfStock && (
        <span className="text-2xs text-danger-500 font-medium">Out of Stock</span>
      )}
    </div>
  );
}

// ============================================
// CART ITEM CARD COMPONENT
// ============================================

interface CartItemCardProps {
  item: CartItem;
  onUpdateQuantity: (quantity: number) => void;
  onRemove: () => void;
}

function CartItemCard({ item, onUpdateQuantity, onRemove }: CartItemCardProps) {
  return (
    <div className="border rounded-xl p-3 bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 transition duration-250">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="font-medium text-gray-900 dark:text-white">{item.name}</h3>
          <p className="text-sm tabular-nums text-gray-600 dark:text-gray-400">{formatCurrency(item.unitPrice)}</p>
        </div>
        <button
          onClick={onRemove}
          className="text-danger-500 hover:text-danger-700 text-xl leading-none transition duration-250 focus-ring rounded p-1"
          title="Remove item"
          aria-label="Remove item from cart"
        >
          ×
        </button>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={() => onUpdateQuantity(Math.max(0, item.quantity - 1))}
          className="w-8 h-8 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center justify-center text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 transition duration-250 focus-ring"
          aria-label="Decrease quantity"
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className="w-12 text-center tabular-nums text-gray-900 dark:text-white">{item.quantity}</span>
        <button
          onClick={() => onUpdateQuantity(item.quantity + 1)}
          className="w-8 h-8 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center justify-center text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 transition duration-250 focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={item.quantity >= item.availableStock}
          aria-label="Increase quantity"
        >
          <Plus className="w-3 h-3" />
        </button>
        <span className="text-sm tabular-nums text-gray-600 dark:text-gray-400 ml-auto">
          {formatCurrency(item.total)}
        </span>
      </div>
      {item.quantity >= item.availableStock && item.availableStock > 0 && (
        <p className="text-2xs text-danger-500 mt-1 tabular-nums">Max stock: {item.availableStock}</p>
      )}
    </div>
  );
}
