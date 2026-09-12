// D:\Projects\Kalwanga\packages\web\components\sales\POS\POS.tsx

'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { CartItems } from './CartItems';
import { QuickActions } from './QuickActions';
import { ShiftManagerModal } from './ShiftManagerModal';
import { PaymentSection } from '../../checkout/PaymentSection';
import { categoryService } from '../../../services/categoryService';
import {
  ShoppingCart,
  X,
  Search,
  Scan,
  Users,
  DollarSign,
  Percent,
  CreditCard,
  Printer,
  Clock,
  AlertCircle,
  Package,
  User,
  LogOut,
  Settings,
  RefreshCw,
  Plus,
  Minus,
  Trash2,
  Loader2,
  CheckCircle,
  Receipt,
  Mail,
  Phone,
  Eye,
  Layout,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  FileText,
  Grid,
  List,
  Filter,
  Tag,
  BarChart3,
  Lock,
  StopCircle,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';
import { cartService } from '../../../services/cartService';
import { checkoutService } from '../../../services/checkoutService';
import { shiftService } from '../../../services/shiftService';
import { productService } from '../../../services/productService';
import { customerService } from '../../../services/customerService';
import { useAuth } from '../../../hooks/useAuth';
import { usePermission } from '../../../hooks/usePermission';
import { PermissionResource } from '../../../types/enums';
import { toast } from '../../../utils/toast-manager';
import { formatDate, formatTime, formatCurrency } from '../../../utils/formatters';

// ============================================
// TYPES
// ============================================

export interface CartItemType {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
    sku: string;
    images?: string[];
    unitPrice: number;
    barcode?: string;
    taxRate?: number;
    category?: { id: string; name: string };
  };
  variantId?: string;
  variant?: {
    id: string;
    name: string;
    sku: string;
    price: number;
    attributes: Record<string, any>;
  };
  quantity: number;
  unitPrice: number;
  total: number;
  discount?: number;
  discountedTotal?: number;
  notes?: string;
  isVoided?: boolean;
  voidReason?: string;
  availableStock?: number;
}

export interface CustomerType {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  loyaltyPoints: number;
  totalSpent: number;
  loyaltyLevel?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export interface ShiftType {
  id: string;
  cashRegisterId: string;
  cashRegister: {
    id: string;
    name: string;
    code: string;
  };
  openedAt: string;
  closedAt?: string;
  startingBalance: number;
  endingBalance?: number;
  expectedEndingBalance?: number;
  discrepancy?: number;
  status: 'OPEN' | 'CLOSED' | 'VOID' | 'PENDING';
  userId: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface RegisterStatusType {
  id: string;
  name: string;
  balance: number;
  status: 'OPEN' | 'CLOSED' | 'PENDING' | 'SUSPENDED';
  transactions: number;
  cashIn: number;
  cashOut: number;
  sessionId?: string;
  openedAt?: string;
}

export interface HeldOrderType {
  id: string;
  items: CartItemType[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  customer: CustomerType | null;
  notes: string;
  createdAt: string;
  customerId?: string;
}

export interface ProductType {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  unitPrice: number;
  costPrice?: number;
  images?: string[];
  description?: string;
  category?: { id: string; name: string };
  inventory?: {
    quantity: number;
    reserved: number;
    available: number;
  };
  variants?: Array<{
    id: string;
    name: string;
    sku: string;
    price: number;
    stock: number;
    attributes: Record<string, any>;
  }>;
  taxRate?: number;
  weight?: number;
  isActive?: boolean;
  isDigital?: boolean;
}

export interface CategoryType {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

// ============================================
// TYPE GUARDS & HELPERS
// ============================================

function normalizeProduct(product: any): ProductType {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku || 'N/A',
    barcode: product.barcode || undefined,
    unitPrice: product.unitPrice || product.price || 0,
    costPrice: product.costPrice,
    images: product.images || [],
    description: product.description,
    category: product.category,
    inventory: product.inventory,
    variants: product.variants,
    taxRate: product.taxRate,
    weight: product.weight,
    isActive: product.isActive,
    isDigital: product.isDigital,
  };
}

function normalizeCustomer(customer: any): CustomerType {
  return {
    id: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    phoneNumber: customer.phoneNumber,
    loyaltyPoints: customer.loyaltyPoints || 0,
    totalSpent: customer.totalSpent || 0,
    loyaltyLevel: customer.loyaltyLevel || 'BRONZE',
    address: customer.address,
    city: customer.city,
    state: customer.state,
    zipCode: customer.zipCode,
    country: customer.country,
  };
}

function extractReceiptNumber(result: any): string | undefined {
  if (!result) return undefined;
  return (
    result.receiptNumber ||
    result.receipt?.receiptNumber ||
    result.data?.receiptNumber ||
    result.data?.receipt?.receiptNumber ||
    undefined
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function POS() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { canView, canCreate, canEdit, canManage } = usePermission();

  const canProcessSales =
    canManage?.(`${PermissionResource.SALE}:manage`) ||
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'ADMIN' ||
    user?.role === 'CASHIER' ||
    false;
  const canViewCustomers =
    canView?.(`${PermissionResource.CUSTOMER}:view`) ||
    user?.role === 'SUPER_ADMIN' ||
    false;
  const canCreateCustomers =
    canCreate?.(`${PermissionResource.CUSTOMER}:create`) ||
    user?.role === 'SUPER_ADMIN' ||
    false;
  const canViewInventory =
    canView?.(`${PermissionResource.INVENTORY}:view`) ||
    user?.role === 'SUPER_ADMIN' ||
    false;

  // ============================================
  // STATE
  // ============================================

  const [cart, setCart] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [processing, setProcessing] = useState<boolean>(false);

  // Modal / UI state
  const [showPayment, setShowPayment] = useState<boolean>(false);
  const [showCustomerSearch, setShowCustomerSearch] = useState<boolean>(false);
  const [showDiscount, setShowDiscount] = useState<boolean>(false);
  const [showReceipt, setShowReceipt] = useState<boolean>(false);
  const [showShiftManager, setShowShiftManager] = useState<boolean>(false);
  const [showProductDetail, setShowProductDetail] = useState<boolean>(false);
  const [showQuickAdd, setShowQuickAdd] = useState<boolean>(false);
  const [showHeldOrders, setShowHeldOrders] = useState<boolean>(false);

  // Discount state
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<ProductType[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [scanning, setScanning] = useState<boolean>(false);

  // Shift state
  const [currentShift, setCurrentShift] = useState<ShiftType | null>(null);
  const [registerStatus, setRegisterStatus] = useState<RegisterStatusType | null>(null);
  const [registers, setRegisters] = useState<any[]>([]);

  // Customer state
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerType | null>(null);
  const [customers, setCustomers] = useState<CustomerType[]>([]);
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [isCustomerSearching, setIsCustomerSearching] = useState<boolean>(false);

  // Product state
  const [selectedProduct, setSelectedProduct] = useState<ProductType | null>(null);
  const [categories, setCategories] = useState<CategoryType[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [quickAddQuantity, setQuickAddQuantity] = useState<number>(1);

  // Receipt state
  const [receiptData, setReceiptData] = useState<any>(null);

  // Held orders
  const [holdOrders, setHoldOrders] = useState<HeldOrderType[]>([]);
  const [notes, setNotes] = useState<string>('');

  // UI prefs
  const [taxRate, setTaxRate] = useState<number>(0.08);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // ============================================
  // NAVIGATION HANDLERS
  // ============================================

  const goToSalesList = useCallback(() => {
    router.push('/admin/sales');
  }, [router]);

  const goToSalesDashboard = useCallback(() => {
    router.push('/admin/sales/dashboard');
  }, [router]);

  const goToShiftsDashboard = useCallback(() => {
    setShowShiftManager(false);
    router.push('/admin/shifts');
  }, [router]);

  const goToRegisters = useCallback(() => {
    setShowShiftManager(false);
    router.push('/admin/shifts/registers');
  }, [router]);

  // ============================================
  // INITIALIZATION
  // ============================================

  useEffect(() => {
    if (canProcessSales) {
      initializePOS();
    }
    document.addEventListener('keydown', handleKeyboardShortcuts);
    if (inputRef.current) {
      inputRef.current.focus();
    }
    return () => {
      document.removeEventListener('keydown', handleKeyboardShortcuts);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canProcessSales]);

  const initializePOS = async () => {
    try {
      await Promise.all([
        loadCart(),
        checkShiftStatus(),
        loadRegisterStatus(),
        loadCategories(),
      ]);
      const savedTheme =
        (localStorage.getItem('pos-theme') as 'light' | 'dark') || 'light';
      setTheme(savedTheme);
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      }
    } catch (error) {
      console.error('Failed to initialize POS:', error);
      toast.error('Failed to initialize POS');
    }
  };

  // ============================================
  // CART OPERATIONS
  // ============================================

  const loadCart = async () => {
    try {
      setLoading(true);
      const cartData = await cartService.getCart();
      setCart(cartData);
      if (cartData?.customer) {
        setSelectedCustomer(normalizeCustomer(cartData.customer));
      }
    } catch (error) {
      console.error('Failed to load cart:', error);
      toast.error('Failed to load cart');
    } finally {
      setLoading(false);
    }
  };

  const refreshCart = useCallback(async () => {
    await loadCart();
    toast.info('Cart refreshed');
  }, []);

  // ============================================
  // SHIFT OPERATIONS
  // ============================================

  const checkShiftStatus = async () => {
    try {
      const status = await shiftService.getCurrentShift();
      if (status) {
        const mappedShift: ShiftType = {
          id: status.id,
          cashRegisterId: status.cashRegisterId,
          cashRegister: {
            id: status.cashRegister?.id || status.cashRegisterId,
            name: status.cashRegister?.name || 'Unknown Register',
            code: status.cashRegister?.code || 'N/A',
          },
          openedAt: status.openedAt,
          startingBalance: status.startingBalance,
          status: status.status as 'OPEN' | 'CLOSED' | 'VOID' | 'PENDING',
          userId: status.userId,
          user: status.user,
        };
        setCurrentShift(mappedShift);
      } else {
        setCurrentShift(null);
      }
    } catch (error) {
      console.error('Failed to check shift:', error);
    }
  };

  const loadRegisterStatus = async () => {
    try {
      const registerData = await shiftService.getRegisters();
      if (registerData && registerData.length > 0) {
        setRegisters(registerData);
        const register = registerData[0];
        setRegisterStatus({
          id: register.id,
          name: register.name || 'Main Register',
          balance: register.cashBalance || 0,
          status:
            ((register as any).status as
              | 'OPEN'
              | 'CLOSED'
              | 'PENDING'
              | 'SUSPENDED') || 'CLOSED',
          transactions: 0,
          cashIn: 0,
          cashOut: 0,
        });
      } else {
        setRegisters([]);
        setRegisterStatus(null);
      }
    } catch (error) {
      console.error('Failed to load register status:', error);
      setRegisters([]);
      setRegisterStatus(null);
    }
  };

  /**
   * Called by the standalone ShiftManagerModal after start/end.
   * Re-syncs the current shift and register status with the server.
   */
  const handleShiftChanged = useCallback(async () => {
    await Promise.all([checkShiftStatus(), loadRegisterStatus()]);
  }, []);

  // ============================================
  // CATEGORIES
  // ============================================

const loadCategories = async () => {
  try {
    const data = await categoryService.getAllCategories({
      limit: 100,
      isActive: true,
    });
    setCategories(data || []);
  } catch (error) {
    console.error('Failed to load categories:', error);
    setCategories([]);
  }
};

  // ============================================
  // KEYBOARD SHORTCUTS
  // ============================================

  const handleKeyboardShortcuts = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      if (cart?.items?.length > 0) {
        setShowPayment(true);
      }
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'H') {
      e.preventDefault();
      handleHoldOrder();
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      setShowDiscount(true);
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      setShowShiftManager(true);
    }
    if (e.key === 'Escape') {
      setShowPayment(false);
      setShowDiscount(false);
      setShowCustomerSearch(false);
      setShowReceipt(false);
      setShowProductDetail(false);
      setShowHeldOrders(false);
      setShowQuickAdd(false);
      setShowShiftManager(false);
    }
    if (e.key === 'F11') {
      e.preventDefault();
      toggleFullscreen();
    }
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      refreshCart();
    }
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }
    if (e.key === 'Enter' && searchQuery.length >= 2) {
      handleProductSearch(searchQuery);
    }
  };

  // ============================================
  // UI HELPERS
  // ============================================

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error('Error enabling fullscreen:', err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.error('Error exiting fullscreen:', err);
      });
    }
    setIsFullscreen(!isFullscreen);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    localStorage.setItem('pos-theme', newTheme);
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  // ============================================
  // PRODUCT SEARCH
  // ============================================

  const handleProductSearch = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await productService.searchProducts({
        query,
        category: filterCategory !== 'all' ? filterCategory : undefined,
      });
      const normalizedResults = results.map(normalizeProduct);
      setSearchResults(normalizedResults);
    } catch (error) {
      console.error('Product search failed:', error);
      toast.error('Failed to search products');
    } finally {
      setIsSearching(false);
    }
  };

  // ============================================
  // BARCODE SCANNING
  // ============================================

  const handleBarcodeScan = async (barcode: string) => {
    if (!barcode) return;
    if (!currentShift) {
      toast.warning('Please open a shift first');
      return;
    }

    setScanning(true);
    try {
      const product = await productService.getProductByBarcode(barcode);
      if (product) {
        const normalizedProduct = normalizeProduct(product);
        await handleAddItem(normalizedProduct);
        toast.success(`${normalizedProduct.name} added via barcode`);
      } else {
        toast.error('Product not found with this barcode');
      }
    } catch (error) {
      console.error('Barcode scan failed:', error);
      toast.error('Failed to scan barcode');
    } finally {
      setScanning(false);
    }
  };

  const handleBarcodeInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const barcode = (e.target as HTMLInputElement).value.trim();
      if (barcode) {
        handleBarcodeScan(barcode);
        (e.target as HTMLInputElement).value = '';
      }
    }
  };

  // ============================================
  // CART ITEM OPERATIONS
  // ============================================

  const handleAddItem = async (
    product: ProductType,
    quantity: number = 1,
    variantId?: string
  ) => {
    if (!currentShift) {
      toast.warning('Please open a shift first');
      return;
    }

    try {
      setProcessing(true);
      const updatedCart = await cartService.addItem({
        productId: product.id,
        variantId,
        quantity,
      });
      setCart(updatedCart);
      toast.success(`${product.name} added to cart`);
      setSearchQuery('');
      setSearchResults([]);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    } catch (error: any) {
      console.error('Failed to add item:', error);
      toast.error(error.message || 'Failed to add item to cart');
    } finally {
      setProcessing(false);
    }
  };

  const handleAddMultipleItems = async (
    items: Array<{ productId: string; quantity: number; variantId?: string }>
  ) => {
    if (!currentShift) {
      toast.warning('Please open a shift first');
      return;
    }

    try {
      setProcessing(true);
      const updatedCart = await cartService.addMultipleItems(items);
      setCart(updatedCart);
      toast.success(`${items.length} items added to cart`);
    } catch (error: any) {
      console.error('Failed to add items:', error);
      toast.error(error.message || 'Failed to add items to cart');
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateQuantity = async (itemId: string, quantity: number) => {
    try {
      setProcessing(true);
      const updatedCart = await cartService.updateItemQuantity(itemId, quantity);
      setCart(updatedCart);
    } catch (error: any) {
      console.error('Failed to update quantity:', error);
      toast.error(error.message || 'Failed to update quantity');
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      setProcessing(true);
      const updatedCart = await cartService.removeItem(itemId);
      setCart(updatedCart);
      toast.success('Item removed from cart');
    } catch (error: any) {
      console.error('Failed to remove item:', error);
      toast.error(error.message || 'Failed to remove item');
    } finally {
      setProcessing(false);
    }
  };

  const handleVoidItem = async (itemId: string, reason?: string) => {
    try {
      setProcessing(true);

      const anyCartService = cartService as any;
      let updatedCart: any;

      if (typeof anyCartService.voidItem === 'function') {
        updatedCart = await anyCartService.voidItem(itemId, reason);
      } else if (typeof anyCartService.updateItem === 'function') {
        updatedCart = await anyCartService.updateItem(itemId, {
          isVoided: true,
          voidReason: reason || 'Voided by cashier',
        });
      } else {
        updatedCart = await cartService.removeItem(itemId);
      }

      setCart(updatedCart);
      toast.success('Item voided');
    } catch (error: any) {
      console.error('Failed to void item:', error);
      toast.error(error.message || 'Failed to void item');
    } finally {
      setProcessing(false);
    }
  };

  const handleClearCart = async () => {
    if (!cart?.items?.length) {
      toast.warning('Cart is already empty');
      return;
    }
    if (!confirm('Are you sure you want to clear all items from the cart?')) {
      return;
    }

    try {
      setProcessing(true);
      await cartService.clearCart();
      await loadCart();
      toast.info('Cart cleared');
      if (inputRef.current) {
        inputRef.current.focus();
      }
    } catch (error: any) {
      console.error('Failed to clear cart:', error);
      toast.error(error.message || 'Failed to clear cart');
    } finally {
      setProcessing(false);
    }
  };

  // ============================================
  // DISCOUNT OPERATIONS
  // ============================================

  const handleApplyDiscount = async () => {
    if (!cart?.items?.length) {
      toast.warning('Cart is empty');
      return;
    }
    if (discountAmount <= 0) {
      toast.warning('Please enter a valid discount amount');
      return;
    }

    try {
      setProcessing(true);
      let discount = discountAmount;
      if (discountType === 'percentage') {
        const subtotal =
          cart.items?.reduce((sum: number, item: any) => sum + item.total, 0) || 0;
        discount = (discountAmount / 100) * subtotal;
      }
      const updatedCart = await cartService.applyDiscount(discount);
      setCart(updatedCart);
      setShowDiscount(false);
      setDiscountAmount(0);
      toast.success(
        `Discount of ${
          discountType === 'percentage'
            ? discountAmount + '%'
            : formatCurrency(discountAmount)
        } applied`
      );
    } catch (error: any) {
      console.error('Failed to apply discount:', error);
      toast.error(error.message || 'Failed to apply discount');
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveDiscount = async () => {
    try {
      setProcessing(true);
      const updatedCart = await cartService.applyDiscount(0);
      setCart(updatedCart);
      toast.info('Discount removed');
    } catch (error: any) {
      console.error('Failed to remove discount:', error);
      toast.error(error.message || 'Failed to remove discount');
    } finally {
      setProcessing(false);
    }
  };

  // ============================================
  // HOLD ORDER OPERATIONS
  // ============================================

  const handleHoldOrder = async () => {
    if (!cart?.items?.length) {
      toast.warning('Cart is empty');
      return;
    }

    try {
      setProcessing(true);
      const heldOrder: HeldOrderType = {
        id: `hold_${Date.now()}`,
        items: cart.items,
        subtotal: cart.subtotal || 0,
        tax: cart.tax || 0,
        discount: cart.discount || 0,
        total: cart.total || 0,
        customer: selectedCustomer,
        notes: notes,
        createdAt: new Date().toISOString(),
        customerId: selectedCustomer?.id,
      };
      setHoldOrders([...holdOrders, heldOrder]);
      await cartService.clearCart();
      await loadCart();
      setSelectedCustomer(null);
      setNotes('');
      toast.success('Order held successfully');
    } catch (error: any) {
      console.error('Failed to hold order:', error);
      toast.error(error.message || 'Failed to hold order');
    } finally {
      setProcessing(false);
    }
  };

  const handleRestoreHeldOrder = async (heldOrder: HeldOrderType) => {
    try {
      setProcessing(true);
      await cartService.clearCart();
      const items = heldOrder.items.map((item: CartItemType) => ({
        productId: item.productId || item.product.id,
        variantId: item.variantId,
        quantity: item.quantity,
      }));
      await cartService.addMultipleItems(items);
      await loadCart();
      if (heldOrder.customer) {
        setSelectedCustomer(heldOrder.customer);
        await cartService.associateCustomer(heldOrder.customer.id);
      }
      setNotes(heldOrder.notes || '');
      setHoldOrders(holdOrders.filter((h) => h.id !== heldOrder.id));
      toast.success('Order restored');
      setShowHeldOrders(false);
    } catch (error: any) {
      console.error('Failed to restore held order:', error);
      toast.error(error.message || 'Failed to restore held order');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteHeldOrder = (id: string) => {
    if (!confirm('Delete this held order?')) return;
    setHoldOrders(holdOrders.filter((h) => h.id !== id));
    toast.info('Held order deleted');
  };

  // ============================================
  // CUSTOMER OPERATIONS
  // ============================================

  const handleSelectCustomer = async (customer: CustomerType | null) => {
    try {
      setProcessing(true);
      if (customer) {
        await cartService.associateCustomer(customer.id);
        setSelectedCustomer(customer);
        toast.success(
          `Customer ${customer.firstName} ${customer.lastName} selected`
        );
      } else {
        await cartService.associateCustomer('');
        setSelectedCustomer(null);
        toast.info('Customer removed');
      }
      await loadCart();
      setShowCustomerSearch(false);
      setCustomerSearchQuery('');
      setCustomers([]);
    } catch (error: any) {
      console.error('Failed to select customer:', error);
      toast.error(error.message || 'Failed to select customer');
    } finally {
      setProcessing(false);
    }
  };

  const handleCustomerSearch = async (query: string) => {
    setCustomerSearchQuery(query);
    if (query.length < 2) {
      setCustomers([]);
      setIsCustomerSearching(false);
      return;
    }

    setIsCustomerSearching(true);
    try {
      const results = await customerService.searchCustomers({
        query,
        limit: 10,
      });
      const normalizedResults = results.map(normalizeCustomer);
      setCustomers(normalizedResults);
    } catch (error) {
      console.error('Customer search failed:', error);
      toast.error('Failed to search customers');
    } finally {
      setIsCustomerSearching(false);
    }
  };

  const handleCreateCustomer = async (customerData: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
  }) => {
    try {
      setProcessing(true);
      const customer = await customerService.createCustomer({
        ...customerData,
        companyId: user?.companyId || '',
      });
      const normalizedCustomer = normalizeCustomer(customer);
      await handleSelectCustomer(normalizedCustomer);
      toast.success('Customer created successfully');
    } catch (error: any) {
      console.error('Failed to create customer:', error);
      toast.error(error.message || 'Failed to create customer');
    } finally {
      setProcessing(false);
    }
  };

  // ============================================
  // CHECKOUT OPERATIONS (using PaymentSection)
  // ============================================

  /**
   * Called by PaymentSection when the user completes payment.
   * Signature: (paymentMethod: string, details: PaymentDetails) => void
   */
  const handlePaymentComplete = async (paymentMethod: string, details: any) => {
    if (!currentShift) {
      toast.warning('Please open a shift first');
      throw new Error('No active shift');
    }
    if (!cart?.items?.length) {
      toast.warning('Cart is empty');
      throw new Error('Cart is empty');
    }

    // For CASH payments, PaymentSection may not provide a paid amount — fall back to cart total.
    const paidAmount =
      paymentMethod === 'CASH'
        ? Number(details?.paidAmount) || cart.total || 0
        : cart.total || 0;

    try {
      setProcessing(true);

      const result = await checkoutService.processCheckout({
        cartId: cart.id,
        customerId: selectedCustomer?.id,
        paymentMethod,
        paidAmount,
        discount: cart.discount || 0,
        notes: notes || details?.notes || '',
        cashRegisterId: currentShift.cashRegisterId,
        cashRegisterSessionId: currentShift.id,
        applyLoyaltyPoints: paymentMethod === 'LOYALTY_POINTS',
      });

      setReceiptData(result);
      setShowPayment(false);
      toast.success('Checkout completed successfully!');

      const receiptNumber = extractReceiptNumber(result);
      if (receiptNumber) {
        printReceipt(result);
      }

      await loadCart();
      setSelectedCustomer(null);
      setNotes('');
      setShowReceipt(true);
    } catch (error: any) {
      console.error('Checkout failed:', error);
      toast.error(error.message || 'Checkout failed');
      // Re-throw so PaymentSection can revert to the details step
      throw error;
    } finally {
      setProcessing(false);
    }
  };

  const handlePaymentCancel = () => {
    setShowPayment(false);
  };

  // ============================================
  // RECEIPT OPERATIONS
  // ============================================

  const printReceipt = (sale: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.warning('Please allow popups to print receipts');
      return;
    }

    const receiptHTML = generateReceiptHTML(sale);
    printWindow.document.write(receiptHTML);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const generateReceiptHTML = (sale: any): string => {
    const businessUnit = sale.businessUnit || {};

    const receiptNumber =
      sale.receiptNumber ||
      sale.receipt?.receiptNumber ||
      sale.data?.receiptNumber ||
      'N/A';

    const saleDate =
      sale.saleDate || sale.createdAt || new Date().toISOString();

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt #${receiptNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Courier New', monospace;
              padding: 20px;
              max-width: 300px;
              margin: 0 auto;
              background: white;
              color: black;
              font-size: 12px;
              line-height: 1.4;
            }
            .header { text-align: center; border-bottom: 2px dashed #333; padding-bottom: 10px; margin-bottom: 10px; }
            .header h3 { font-size: 16px; margin-bottom: 4px; }
            .header .store-info { font-size: 11px; color: #666; }
            .divider { border-top: 1px dashed #ccc; margin: 8px 0; }
            .items { margin: 10px 0; }
            .item { display: flex; justify-content: space-between; padding: 2px 0; }
            .item .name { flex: 1; }
            .item .qty { margin: 0 8px; color: #666; }
            .item .price { font-weight: bold; white-space: nowrap; }
            .totals { border-top: 2px dashed #333; padding-top: 10px; margin-top: 10px; }
            .totals .row { display: flex; justify-content: space-between; padding: 2px 0; }
            .totals .grand-total { font-size: 16px; font-weight: bold; border-top: 1px solid #333; padding-top: 8px; margin-top: 4px; }
            .footer { text-align: center; border-top: 2px dashed #333; padding-top: 10px; margin-top: 10px; font-size: 11px; color: #666; }
            .footer .thankyou { font-size: 14px; font-weight: bold; color: #333; margin-bottom: 4px; }
            .payment-info { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #ccc; }
            .loyalty { margin-top: 8px; padding: 4px 8px; background: #f5f5f5; border-radius: 4px; font-size: 11px; }
            .discount-line { color: #e74c3c; }
            @media print { body { padding: 10px; } .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h3>${businessUnit.name || 'Store'}</h3>
            <div class="store-info">
              ${businessUnit.address || ''}<br>
              ${businessUnit.phone || ''}<br>
              ${businessUnit.email || ''}
            </div>
            <div class="divider"></div>
            <div><strong>RECEIPT #${receiptNumber}</strong></div>
            <div>${formatDate(saleDate)} ${formatTime(saleDate)}</div>
            <div>Cashier: ${sale.user?.firstName || ''} ${sale.user?.lastName || ''}</div>
            ${sale.customer ? `<div>Customer: ${sale.customer.firstName} ${sale.customer.lastName}</div>` : ''}
          </div>

          <div class="items">
            ${(sale.items || []).map((item: any) => `
              <div class="item">
                <span class="name">${item.product?.name || 'Item'}</span>
                <span class="qty">x${item.quantity}</span>
                <span class="price">$${(item.total || 0).toFixed(2)}</span>
              </div>
              ${item.notes ? `<div style="font-size:10px;color:#666;padding-left:8px;">${item.notes}</div>` : ''}
            `).join('')}
          </div>

          <div class="totals">
            <div class="row"><span>Subtotal</span><span>$${(sale.subtotal || 0).toFixed(2)}</span></div>
            <div class="row"><span>Tax (${sale.taxRate || 0}%)</span><span>$${(sale.tax || 0).toFixed(2)}</span></div>
            ${sale.discount > 0 ? `<div class="row discount-line"><span>Discount</span><span>-$${sale.discount.toFixed(2)}</span></div>` : ''}
            <div class="row grand-total">
              <span>TOTAL</span>
              <span>$${(sale.total || 0).toFixed(2)}</span>
            </div>
            ${sale.paidAmount > 0 ? `
              <div class="payment-info">
                <div class="row"><span>Paid</span><span>$${sale.paidAmount.toFixed(2)}</span></div>
                <div class="row"><span>Change</span><span>$${(sale.changeAmount || 0).toFixed(2)}</span></div>
                <div class="row"><span>Payment</span><span>${sale.payments?.[0]?.paymentMethod || 'N/A'}</span></div>
              </div>
            ` : ''}
            ${sale.applyLoyaltyPoints ? `
              <div class="loyalty">
                ✦ Loyalty Points Earned: ${Math.floor((sale.total || 0) / 10)}
              </div>
            ` : ''}
          </div>

          <div class="footer">
            <div class="thankyou">Thank You!</div>
            <div>We appreciate your business</div>
            <div class="divider"></div>
            <div style="font-size:10px;color:#999;">
              Items: ${(sale.items || []).length} | ${new Date().toLocaleDateString()}
            </div>
            <div style="font-size:10px;color:#999;margin-top:4px;">
              ${receiptNumber}
            </div>
          </div>

          <div class="no-print" style="margin-top:20px;text-align:center;">
            <button onclick="window.print()" style="padding:10px 20px;font-size:14px;cursor:pointer;">🖨️ Print</button>
            <button onclick="window.close()" style="padding:10px 20px;font-size:14px;cursor:pointer;margin-left:10px;">✕ Close</button>
          </div>
        </body>
      </html>
    `;
  };

  const handleEmailReceipt = async (sale: any, email: string) => {
    if (!email) {
      toast.warning('Please enter an email address');
      return;
    }

    try {
      setProcessing(true);
      await checkoutService.sendReceiptEmail?.(email);
      toast.success(`Receipt sent to ${email}`);
    } catch (error: any) {
      console.error('Failed to send receipt:', error);
      toast.error(error.message || 'Failed to send receipt');
    } finally {
      setProcessing(false);
    }
  };

  // ============================================
  // PRODUCT DETAIL
  // ============================================

  const handleShowProductDetail = (product: ProductType) => {
    setSelectedProduct(product);
    setShowProductDetail(true);
  };

  // ============================================
  // CALCULATIONS
  // ============================================

  const calculateTotals = useMemo(() => {
    if (!cart)
      return {
        subtotal: 0,
        tax: 0,
        discount: 0,
        total: 0,
        itemCount: 0,
        totalItems: 0,
      };

    const subtotal =
      cart.items?.reduce((sum: number, item: any) => sum + item.total, 0) || 0;
    const tax = subtotal * taxRate;
    const discount = cart.discount || 0;
    const total = subtotal + tax - discount;
    const itemCount = cart.items?.length || 0;
    const totalItems =
      cart.items?.reduce((sum: number, item: any) => sum + item.quantity, 0) ||
      0;

    return { subtotal, tax, discount, total, itemCount, totalItems };
  }, [cart, taxRate]);

  // ============================================
  // RENDER HELPERS
  // ============================================

  const renderShiftStatus = () => {
    if (!currentShift) {
      return (
        <button
          onClick={() => setShowShiftManager(true)}
          className="px-2 py-0.5 sm:py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-full text-xs font-medium flex items-center gap-1 whitespace-nowrap hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
        >
          <X className="w-3 h-3" />
          <span className="hidden sm:inline">No Shift</span>
        </button>
      );
    }

    return (
      <button
        onClick={() => setShowShiftManager(true)}
        className="px-2 py-0.5 sm:py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full text-xs font-medium flex items-center gap-1 whitespace-nowrap hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
      >
        <CheckCircle className="w-3 h-3" />
        <span className="hidden sm:inline">Shift Open</span>
      </button>
    );
  };

  // ============================================
  // AUTHENTICATION & PERMISSION CHECKS
  // ============================================

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-center max-w-md p-8">
          <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
            Please Login
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            You need to be logged in to use the POS system.
          </p>
          <button
            onClick={() => (window.location.href = '/login')}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (!canProcessSales) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-center max-w-md p-8">
          <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
            Access Denied
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            You don't have permission to access the POS system.
          </p>
          <button
            onClick={() => (window.location.href = '/dashboard')}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading POS...</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Please wait while we prepare your workspace
          </p>
        </div>
      </div>
    );
  }

  const totals = calculateTotals;

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <div
      className={`h-screen flex flex-col bg-gray-100 dark:bg-gray-900 transition-colors duration-300 ${
        theme === 'dark' ? 'dark' : ''
      }`}
    >
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm px-4 sm:px-6 py-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button
            onClick={toggleSidebar}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
            title="Toggle Sidebar"
          >
            <Layout className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white whitespace-nowrap">
            Point of Sale
          </h1>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            <Clock className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">{formatTime(new Date())}</span>
          </div>
          {renderShiftStatus()}
        </div>

        <div className="flex items-center gap-1 sm:gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Toggle Theme"
          >
            {theme === 'light' ? (
              <Moon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            ) : (
              <Sun className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            )}
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors hidden sm:block"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? (
              <Minimize2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            ) : (
              <Maximize2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            )}
          </button>
          {holdOrders.length > 0 && (
            <button
              onClick={() => setShowHeldOrders(!showHeldOrders)}
              className="relative px-2 sm:px-3 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-800 text-xs sm:text-sm flex items-center gap-1 sm:gap-2 transition-colors whitespace-nowrap"
            >
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">Held</span>
              <span className="inline sm:hidden">{holdOrders.length}</span>
              <span className="hidden sm:inline">({holdOrders.length})</span>
            </button>
          )}
          <div className="flex items-center gap-2 text-sm">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-medium flex-shrink-0">
              {user?.firstName?.[0] || 'U'}
              {user?.lastName?.[0] || ''}
            </div>
            <span className="text-gray-700 dark:text-gray-300 hidden md:inline">
              {user?.firstName} {user?.lastName}
            </span>
          </div>
          <button
            onClick={() => setShowShiftManager(true)}
            className="px-2 sm:px-3 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-xs sm:text-sm flex items-center gap-1 sm:gap-2 transition-colors text-gray-700 dark:text-gray-300 whitespace-nowrap"
            title="Open Shift Manager (Ctrl+Shift+S)"
          >
            <Clock className="w-4 h-4" />
            <span className="hidden sm:inline">
              {currentShift ? 'Shift' : 'No Shift'}
            </span>
          </button>
          <button
            onClick={() => (window.location.href = '/logout')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors hidden sm:block"
            title="Logout"
          >
            <LogOut className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </header>

      {/* Held Orders Panel */}
      {showHeldOrders && holdOrders.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 max-h-60 overflow-y-auto shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Held Orders
            </h3>
            <button
              onClick={() => setShowHeldOrders(false)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <div className="space-y-2">
            {holdOrders.map((order, index) => (
              <div
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white">
                    Order #{index + 1}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {order.items.length} items · {formatCurrency(order.total)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatDate(order.createdAt)} {formatTime(order.createdAt)}
                  </p>
                  {order.customer && (
                    <p className="text-xs text-gray-400">
                      Customer: {order.customer.firstName}{' '}
                      {order.customer.lastName}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => handleRestoreHeldOrder(order)}
                    className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 text-sm"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => handleDeleteHeldOrder(order.id)}
                    className="px-3 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <div
          className={`flex-1 flex flex-col transition-all duration-300 ${
            sidebarCollapsed ? 'ml-0' : 'ml-0'
          }`}
        >
          {/* Search Bar */}
          <div className="bg-white dark:bg-gray-800 shadow-sm p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search by name, SKU, or barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleBarcodeInput}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  disabled={processing}
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                  </div>
                )}
                {searchQuery && !isSearching && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                      if (inputRef.current) inputRef.current.focus();
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setScanning(!scanning)}
                  className={`px-3 sm:px-4 py-3 rounded-lg flex items-center gap-2 transition-colors ${
                    scanning
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  disabled={processing}
                >
                  <Scan className="w-5 h-5" />
                  <span className="hidden sm:inline">Scan</span>
                </button>
                {filterCategory !== 'all' && (
                  <button
                    onClick={() => setFilterCategory('all')}
                    className="px-3 py-2 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 text-sm flex items-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    <span className="hidden sm:inline">Clear Filter</span>
                  </button>
                )}
              </div>
            </div>

            {scanning && (
              <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>
                  Scanning mode active - use barcode scanner to add products
                </span>
                <button
                  onClick={() => setScanning(false)}
                  className="ml-auto p-1 hover:bg-blue-100 dark:hover:bg-blue-800 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="mt-2 flex flex-wrap gap-1 overflow-x-auto pb-1">
              <button
                onClick={() => setFilterCategory('all')}
                className={`px-2 py-1 text-xs rounded-full transition-colors whitespace-nowrap ${
                  filterCategory === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                All
              </button>
              {categories.slice(0, 10).map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setFilterCategory(cat.id)}
                  className={`px-2 py-1 text-xs rounded-full transition-colors whitespace-nowrap ${
                    filterCategory === cat.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Search Results */}
          {searchQuery && searchResults.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 max-h-60 overflow-y-auto shadow-lg flex-shrink-0">
              <div className="sticky top-0 bg-gray-50 dark:bg-gray-700 px-4 py-2 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  {searchResults.length} results found
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1 rounded ${
                      viewMode === 'grid'
                        ? 'bg-gray-200 dark:bg-gray-600'
                        : ''
                    }`}
                  >
                    <Grid className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1 rounded ${
                      viewMode === 'list'
                        ? 'bg-gray-200 dark:bg-gray-600'
                        : ''
                    }`}
                  >
                    <List className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                      if (inputRef.current) inputRef.current.focus();
                    }}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>
              <div
                className={
                  viewMode === 'grid'
                    ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-2'
                    : 'divide-y divide-gray-100 dark:divide-gray-700'
                }
              >
                {searchResults.map((product) => (
                  <div
                    key={product.id}
                    className={`${
                      viewMode === 'grid'
                        ? 'p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow cursor-pointer'
                        : 'px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-4 cursor-pointer transition-colors'
                    }`}
                    onClick={() => handleShowProductDetail(product)}
                  >
                    {viewMode === 'grid' ? (
                      <>
                        <div className="w-full h-24 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden">
                          {product.images?.[0] ? (
                            <img
                              src={product.images[0]}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                          )}
                        </div>
                        <div className="mt-2">
                          <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                            {product.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            SKU: {product.sku}
                          </p>
                          <p className="font-bold text-gray-900 dark:text-white">
                            ${product.unitPrice.toFixed(2)}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded ${
                                (product.inventory?.available ||
                                  product.inventory?.quantity ||
                                  0) > 10
                                  ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                                  : (product.inventory?.available ||
                                      product.inventory?.quantity ||
                                      0) > 0
                                  ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
                                  : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                              }`}
                            >
                              {product.inventory?.available ||
                                product.inventory?.quantity ||
                                0}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddItem(product, 1);
                              }}
                              className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                              disabled={processing}
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                          {product.images?.[0] ? (
                            <img
                              src={product.images[0]}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {product.name}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <span>SKU: {product.sku}</span>
                            {product.barcode && (
                              <span>| Barcode: {product.barcode}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span
                              className={`px-1.5 py-0.5 rounded ${
                                (product.inventory?.available ||
                                  product.inventory?.quantity ||
                                  0) > 10
                                  ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                                  : (product.inventory?.available ||
                                      product.inventory?.quantity ||
                                      0) > 0
                                  ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
                                  : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                              }`}
                            >
                              {product.inventory?.available ||
                                product.inventory?.quantity ||
                                0}{' '}
                              in stock
                            </span>
                            {product.category && (
                              <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                                {product.category.name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-gray-900 dark:text-white">
                            ${product.unitPrice.toFixed(2)}
                          </p>
                          <div className="flex gap-1 mt-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddItem(product, 1);
                              }}
                              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm transition-colors flex items-center gap-1"
                              disabled={processing}
                            >
                              <Plus className="w-3 h-3" /> Add
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShowProductDetail(product);
                              }}
                              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4 text-gray-500" />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Results */}
          {searchQuery &&
            searchResults.length === 0 &&
            !isSearching &&
            searchQuery.length >= 2 && (
              <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-8 text-center flex-shrink-0">
                <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400">
                  No products found
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  Try searching with a different term
                </p>
                <button
                  onClick={() => setShowQuickAdd(true)}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Quick Add Product
                </button>
              </div>
            )}

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-gray-50 dark:bg-gray-900/50">
            {cart?.items?.length > 0 ? (
              <div className="space-y-2">
                <CartItems
                  items={cart.items}
                  onUpdateQuantity={handleUpdateQuantity}
                  onRemoveItem={handleRemoveItem}
                  onVoidItem={handleVoidItem}
                  isProcessing={processing}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
                <ShoppingCart className="w-24 h-24 mb-4 opacity-50" />
                <p className="text-xl font-medium text-gray-500 dark:text-gray-400">
                  Cart is empty
                </p>
                <p className="text-sm">Search and add products to get started</p>
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono">
                    Ctrl+F
                  </kbd>
                  <span className="text-xs text-gray-400">Focus search</span>
                  <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono">
                    Ctrl+Shift+C
                  </kbd>
                  <span className="text-xs text-gray-400">Checkout</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer / Totals */}
          <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="space-y-1 w-full sm:w-auto">
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Items:
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {totals.itemCount}
                  </span>
                  <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">
                    |
                  </span>
                  <span className="text-gray-600 dark:text-gray-400 hidden sm:inline">
                    Subtotal:
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white hidden sm:inline">
                    {formatCurrency(totals.subtotal)}
                  </span>
                  <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">
                    |
                  </span>
                  <span className="text-gray-600 dark:text-gray-400 hidden sm:inline">
                    Tax:
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white hidden sm:inline">
                    {formatCurrency(totals.tax)}
                  </span>
                  {totals.discount > 0 && (
                    <>
                      <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">
                        |
                      </span>
                      <span className="text-green-600 dark:text-green-400 hidden sm:inline">
                        Discount:
                      </span>
                      <span className="font-medium text-green-600 dark:text-green-400 hidden sm:inline">
                        -{formatCurrency(totals.discount)}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 sm:gap-4 text-base sm:text-lg font-bold">
                  <span className="text-gray-700 dark:text-gray-300">
                    Total:
                  </span>
                  <span className="text-xl sm:text-2xl text-blue-600 dark:text-blue-400">
                    {formatCurrency(totals.total)}
                  </span>
                </div>
                {selectedCustomer && (
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-blue-600 dark:text-blue-400">
                    <User className="w-4 h-4" />
                    <span>
                      {selectedCustomer.firstName} {selectedCustomer.lastName}
                    </span>
                    <span className="text-gray-400 dark:text-gray-500">|</span>
                    <span>Points: {selectedCustomer.loyaltyPoints || 0}</span>
                    <button
                      onClick={() => handleSelectCustomer(null)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <button
                  onClick={() => setShowCustomerSearch(true)}
                  className="px-3 sm:px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-2 transition-colors text-sm"
                  disabled={processing}
                >
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">Customer</span>
                </button>
                <button
                  onClick={() => setShowDiscount(true)}
                  className="px-3 sm:px-4 py-2 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-800 flex items-center gap-2 transition-colors text-sm"
                  disabled={cart?.items?.length === 0 || processing}
                >
                  <Percent className="w-4 h-4" />
                  <span className="hidden sm:inline">Discount</span>
                  {cart?.discount > 0 && (
                    <span className="px-1.5 py-0.5 bg-yellow-200 dark:bg-yellow-800 rounded text-xs">
                      {formatCurrency(cart.discount)}
                    </span>
                  )}
                </button>
                <button
                  onClick={handleHoldOrder}
                  className="px-3 sm:px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-2 transition-colors text-sm"
                  disabled={cart?.items?.length === 0 || processing}
                >
                  <Clock className="w-4 h-4" />
                  <span className="hidden sm:inline">Hold</span>
                </button>
                <button
                  onClick={handleClearCart}
                  className="px-3 sm:px-4 py-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 flex items-center gap-2 transition-colors text-sm"
                  disabled={cart?.items?.length === 0 || processing}
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
                <button
                  onClick={() => setShowPayment(true)}
                  className="px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium transition-colors text-sm"
                  disabled={
                    cart?.items?.length === 0 || processing || !currentShift
                  }
                >
                  {processing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CreditCard className="w-4 h-4" />
                  )}
                  Checkout
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Sidebar */}
        <div
          className={`w-56 sm:w-64 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-4 overflow-y-auto flex-shrink-0 transition-all duration-300 ${
            sidebarCollapsed ? 'hidden' : ''
          }`}
        >
          <QuickActions
            onRefresh={refreshCart}
            onViewSales={goToSalesList}
            onAddCustomer={(customer: any) =>
              handleSelectCustomer({
                ...customer,
                loyaltyPoints: customer?.loyaltyPoints ?? 0,
                totalSpent: customer?.totalSpent ?? 0,
              })
            }
            onAddProduct={(product: ProductType) => handleAddItem(product, 1)}
            heldOrdersCount={holdOrders.length}
          />
        </div>
      </div>

      {/* ============================================ */}
      {/* SHIFT MANAGER (standalone component)          */}
      {/* ============================================ */}
      <ShiftManagerModal
        isOpen={showShiftManager}
        onClose={() => setShowShiftManager(false)}
        onShiftChanged={handleShiftChanged}
      />

      {/* ============================================ */}
      {/* PAYMENT MODAL (using PaymentSection)          */}
      {/* ============================================ */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700">
            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePaymentCancel}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Back"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-blue-500" />
                    Complete Payment
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {cart?.items?.length || 0} item
                    {(cart?.items?.length || 0) !== 1 ? 's' : ''} ·{' '}
                    {formatCurrency(totals.total)}
                  </p>
                </div>
              </div>
              <button
                onClick={handlePaymentCancel}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Payment Section */}
            <div className="p-6">
              <PaymentSection
                total={totals.total}
                currency="USD"
                onPaymentComplete={handlePaymentComplete}
                onPaymentCancel={handlePaymentCancel}
                isProcessing={processing}
                customerLoyaltyPoints={selectedCustomer?.loyaltyPoints || 0}
              />
            </div>
          </div>
        </div>
      )}

      {/* Discount Modal */}
      {showDiscount && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Apply Discount
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Add a discount to the current cart
                </p>
              </div>
              <button
                onClick={() => setShowDiscount(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Discount Type
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDiscountType('percentage')}
                    className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                      discountType === 'percentage'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    Percentage
                  </button>
                  <button
                    onClick={() => setDiscountType('fixed')}
                    className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                      discountType === 'fixed'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    Fixed Amount
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {discountType === 'percentage'
                    ? 'Percentage (%)'
                    : 'Amount ($)'}
                </label>
                <input
                  type="number"
                  value={discountAmount}
                  onChange={(e) =>
                    setDiscountAmount(parseFloat(e.target.value) || 0)
                  }
                  min="0"
                  max={discountType === 'percentage' ? 100 : totals.subtotal}
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder={discountType === 'percentage' ? '10' : '5.00'}
                  autoFocus
                />
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Subtotal
                  </span>
                  <span className="text-gray-900 dark:text-white">
                    {formatCurrency(totals.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-gray-600 dark:text-gray-400">
                    New Total
                  </span>
                  <span className="text-blue-600 dark:text-blue-400">
                    {formatCurrency(
                      discountType === 'percentage'
                        ? totals.subtotal -
                            (discountAmount / 100) * totals.subtotal +
                            totals.tax
                        : totals.subtotal - discountAmount + totals.tax
                    )}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-3 mt-6">
              {cart?.discount > 0 && (
                <button
                  onClick={handleRemoveDiscount}
                  className="px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm"
                >
                  Remove Discount
                </button>
              )}
              <button
                onClick={() => setShowDiscount(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyDiscount}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                disabled={discountAmount <= 0}
              >
                Apply Discount
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Search Modal */}
      {showCustomerSearch && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Find Customer
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Search for an existing customer or create a new one
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCustomerSearch(false);
                  setCustomerSearchQuery('');
                  setCustomers([]);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by name, email, or phone..."
                  value={customerSearchQuery}
                  onChange={(e) => handleCustomerSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  autoFocus
                />
                {isCustomerSearching && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                  </div>
                )}
              </div>
              {customers.length > 0 ? (
                <div className="space-y-2">
                  {customers.map((customer) => (
                    <div
                      key={customer.id}
                      className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors flex flex-wrap items-center justify-between gap-2"
                      onClick={() => handleSelectCustomer(customer)}
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {customer.firstName} {customer.lastName}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {customer.email}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />{' '}
                            {customer.phoneNumber}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Loyalty Points
                        </p>
                        <p className="font-bold text-blue-600 dark:text-blue-400">
                          {customer.loyaltyPoints || 0}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          Spent: {formatCurrency(customer.totalSpent || 0)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : customerSearchQuery.length >= 2 &&
                !isCustomerSearching ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400">
                    No customers found
                  </p>
                  {canCreateCustomers && (
                    <button
                      className="mt-2 text-blue-600 dark:text-blue-400 hover:underline"
                      onClick={() => {
                        const firstName = prompt('Enter first name:');
                        const lastName = prompt('Enter last name:');
                        const email = prompt('Enter email:');
                        const phoneNumber = prompt('Enter phone number:');
                        if (firstName && lastName && email && phoneNumber) {
                          handleCreateCustomer({
                            firstName,
                            lastName,
                            email,
                            phoneNumber,
                          });
                        }
                      }}
                    >
                      Create New Customer
                    </button>
                  )}
                </div>
              ) : !customerSearchQuery ? (
                <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Type at least 2 characters to search</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
      {showProductDetail && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white dark:bg-gray-800 p-6 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between z-10">
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                  {selectedProduct.name}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  SKU: {selectedProduct.sku}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowProductDetail(false);
                  setSelectedProduct(null);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="w-full sm:w-48 h-48 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                  {selectedProduct.images?.[0] ? (
                    <img
                      src={selectedProduct.images[0]}
                      alt={selectedProduct.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-16 h-16 text-gray-400 dark:text-gray-500" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Price</p>
                      <p className="font-bold text-lg text-gray-900 dark:text-white">
                        {formatCurrency(selectedProduct.unitPrice)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Cost</p>
                      <p className="text-gray-900 dark:text-white">
                        {selectedProduct.costPrice
                          ? formatCurrency(selectedProduct.costPrice)
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Stock</p>
                      <p
                        className={`font-medium ${
                          (selectedProduct.inventory?.available ||
                            selectedProduct.inventory?.quantity ||
                            0) > 10
                            ? 'text-green-600 dark:text-green-400'
                            : (selectedProduct.inventory?.available ||
                                selectedProduct.inventory?.quantity ||
                                0) > 0
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {selectedProduct.inventory?.available ||
                          selectedProduct.inventory?.quantity ||
                          0}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">
                        Category
                      </p>
                      <p className="text-gray-900 dark:text-white">
                        {selectedProduct.category?.name || 'Uncategorized'}
                      </p>
                    </div>
                    {selectedProduct.taxRate !== undefined && (
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">
                          Tax Rate
                        </p>
                        <p className="text-gray-900 dark:text-white">
                          {selectedProduct.taxRate}%
                        </p>
                      </div>
                    )}
                    {selectedProduct.weight !== undefined && (
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">
                          Weight
                        </p>
                        <p className="text-gray-900 dark:text-white">
                          {selectedProduct.weight} kg
                        </p>
                      </div>
                    )}
                  </div>
                  {selectedProduct.description && (
                    <div>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">
                        Description
                      </p>
                      <p className="text-gray-700 dark:text-gray-300 text-sm">
                        {selectedProduct.description}
                      </p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-4">
                    <button
                      onClick={() => {
                        handleAddItem(selectedProduct, 1);
                        setShowProductDetail(false);
                      }}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Add to Cart
                    </button>
                    <button
                      onClick={() => {
                        const qty = prompt('Enter quantity:', '1');
                        if (qty) {
                          handleAddItem(selectedProduct, parseInt(qty) || 1);
                          setShowProductDetail(false);
                        }
                      }}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      Custom Qty
                    </button>
                  </div>
                </div>
              </div>
              {selectedProduct.variants &&
                selectedProduct.variants.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Variants
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {selectedProduct.variants.map((variant: any) => (
                        <button
                          key={variant.id}
                          onClick={() => {
                            handleAddItem(selectedProduct, 1, variant.id);
                            setShowProductDetail(false);
                          }}
                          className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-left"
                        >
                          <p className="font-medium text-gray-900 dark:text-white">
                            {variant.name}
                          </p>
                          <p className="text-gray-500 dark:text-gray-400">
                            {formatCurrency(variant.price)}
                          </p>
                          <p className="text-xs text-gray-400">
                            Stock: {variant.stock}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && receiptData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h2 className="font-bold text-gray-900 dark:text-white">
                  Receipt
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowReceipt(false);
                  setReceiptData(null);
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Receipt #{extractReceiptNumber(receiptData) || 'N/A'}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(receiptData.total)}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(receiptData.saleDate)}{' '}
                  {formatTime(receiptData.saleDate)}
                </p>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {receiptData.items?.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">
                      {item.product.name} × {item.quantity}
                    </span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {formatCurrency(item.total)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 pt-2 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    Subtotal
                  </span>
                  <span className="text-gray-900 dark:text-white">
                    {formatCurrency(receiptData.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Tax</span>
                  <span className="text-gray-900 dark:text-white">
                    {formatCurrency(receiptData.tax)}
                  </span>
                </div>
                {receiptData.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600 dark:text-green-400">
                      Discount
                    </span>
                    <span className="text-green-600 dark:text-green-400">
                      -{formatCurrency(receiptData.discount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-1 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-gray-900 dark:text-white">Total</span>
                  <span className="text-blue-600 dark:text-blue-400">
                    {formatCurrency(receiptData.total)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Paid</span>
                  <span className="text-gray-900 dark:text-white">
                    {formatCurrency(receiptData.paidAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    Change
                  </span>
                  <span className="text-gray-900 dark:text-white">
                    {formatCurrency(receiptData.changeAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    Payment
                  </span>
                  <span className="text-gray-900 dark:text-white">
                    {receiptData.payments?.[0]?.paymentMethod || 'N/A'}
                  </span>
                </div>
                {receiptData.customer && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      Customer
                    </span>
                    <span className="text-gray-900 dark:text-white">
                      {receiptData.customer.firstName}{' '}
                      {receiptData.customer.lastName}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => printReceipt(receiptData)}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm"
                >
                  <Printer className="w-4 h-4" /> Print
                </button>
                {receiptData.customer?.email && (
                  <button
                    onClick={() => {
                      const email = receiptData.customer?.email || '';
                      if (email) handleEmailReceipt(receiptData, email);
                    }}
                    className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 text-sm"
                  >
                    <Mail className="w-4 h-4" /> Email
                  </button>
                )}
                <button
                  onClick={() => {
                    router.push(`/admin/sales/${receiptData.id}`);
                    setShowReceipt(false);
                  }}
                  className="flex-1 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center justify-center gap-2 text-sm"
                >
                  <Eye className="w-4 h-4" /> View
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Modal */}
      {showQuickAdd && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Quick Add Product
              </h2>
              <button
                onClick={() => setShowQuickAdd(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Enter product name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  SKU
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Enter SKU"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={quickAddQuantity}
                    onChange={(e) =>
                      setQuickAddQuantity(parseInt(e.target.value) || 1)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    min="1"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowQuickAdd(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  toast.success('Quick add feature coming soon');
                  setShowQuickAdd(false);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4 inline mr-1" /> Add Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default POS;
