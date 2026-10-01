// D:\Projects\Kalwanga\packages\web\components\cart\index.ts

// ✅ Main cart components - using default exports
export { default as CartPage } from './CartPage';
export { default as CartItemCard } from './CartItemCard';
export { default as CartSummary } from './CartSummary';
export { default as CartSkeleton } from './CartSkeleton';
export { default as EmptyCart } from './EmptyCart';
export { default as AddToCartButton } from './AddToCartButton';
export { default as CartCountBadge } from './CartCountBadge';
export { default as MiniCart } from './MiniCart';

// ✅ Additional cart components - using default exports
export { default as CartActions } from './CartActions';
export { default as CartTotals } from './CartTotals';
export { default as CartItemList } from './CartItemList';
export { default as CartDiscountInput } from './CartDiscountInput';
export { default as CartPromotionInput } from './CartPromotionInput';
export { default as CartLoyaltyPoints } from './CartLoyaltyPoints';
export { default as CartCustomerSelector } from './CartCustomerSelector';
export { default as CartNotes } from './CartNotes';
export { default as CartCheckoutButton } from './CartCheckoutButton';

// ✅ Export types for consumers
export type { CartActionsProps } from './CartActions';
export type { CartTotalsProps } from './CartTotals';
export type { CartItemListProps } from './CartItemList';
export type { CartCheckoutButtonProps } from './CartCheckoutButton';

// ── Phase 2: prop types for currency-aware components ──────────
//
// The following components now carry a `currency` (and in two
// cases `currencySymbol`) prop that is either REQUIRED or newly
// added. Exporting their prop types through the barrel lets
// consumers discover the new prop signatures without digging
// into the component files, and lets TypeScript surface a
// missing-required-prop error at the call site.
//
// ⚠ Only `CartItemCardProps.currency` is REQUIRED. The others
//   accept `currency` optionally for backward compatibility.
//   See each component's JSDoc for the exact contract.
export type { CartItemCardProps } from './CartItemCard';