'use client';

// ============================================
// MAIN POS COMPONENT
// ============================================
export { POS } from './POS';

// ============================================
// CART COMPONENTS
// ============================================
export { CartItems } from './CartItems';
export { CheckoutModal } from './CheckoutModal';
export { ProductSearch } from './ProductSearch';

// ============================================
// QUICK ACTIONS COMPONENTS
// ============================================
export { QuickActions } from './QuickActions';
export { CustomerSearchModal } from './CustomerSearchModal';
export { QuickProductModal } from './QuickProductModal';
export { PriceOverrideModal } from './PriceOverrideModal';
export { ShiftManagerModal } from './ShiftManagerModal';
export { ReprintReceiptModal } from './ReprintReceiptModal';
export { HeldOrdersModal } from './HeldOrdersModal';

// ============================================
// DEFAULT EXPORT - Create a components object
// ============================================
import { POS } from './POS';
import { CartItems } from './CartItems';
import { CheckoutModal } from './CheckoutModal';
import { ProductSearch } from './ProductSearch';
import { QuickActions } from './QuickActions';
import { CustomerSearchModal } from './CustomerSearchModal';
import { QuickProductModal } from './QuickProductModal';
import { PriceOverrideModal } from './PriceOverrideModal';
import { ShiftManagerModal } from './ShiftManagerModal';
import { ReprintReceiptModal } from './ReprintReceiptModal';
import { HeldOrdersModal } from './HeldOrdersModal';

const POSComponents = {
  POS,
  CartItems,
  CheckoutModal,
  ProductSearch,
  QuickActions,
  CustomerSearchModal,
  QuickProductModal,
  PriceOverrideModal,
  ShiftManagerModal,
  ReprintReceiptModal,
  HeldOrdersModal,
};

export default POSComponents;
