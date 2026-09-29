import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verify2FASchema,
  verifyEmailSchema,
} from "../../shared/src/schemas/auth";
import {
  bulkActionSchema,
  createUserSchema,
  updatePermissionsSchema,
  updateUserRoleSchema,
  updateUserSchema,
  userSearchSchema,
} from "../../shared/src/schemas/user";
import {
  configureProviderSchema,
  createPaymentMethodConfigSchema,
  createPaymentProviderSchema,
  createProviderCurrencySchema,
  getPaymentProvidersQuerySchema,
  toggleProviderSchema,
  updatePaymentMethodConfigSchema,
  updatePaymentProviderSchema,
  updateProviderHealthSchema,
} from "../../shared/src/schemas/payment-provider";
import {
  flutterwaveVirtualAccountSchema,
  payPalCaptureSchema,
  paystackVerifySchema,
  squareCustomerSchema,
  squarePaymentSchema,
} from "../../shared/src/schemas/provider-specific";
import {
  bulkCreateItemsSchema,
  bulkUpdateStockSchema,
  createInventorySchema,
  createItemSchema,
  issueItemSchema,
  listIssuesQuerySchema,
  listItemsQuerySchema,
  reserveStockSchema,
  restockItemSchema,
  returnItemSchema,
  searchProductsSchema,
  updateInventorySchema,
  updateItemSchema,
  updateStockSchema,
  legacyBulkUpdateSchema,
} from "../../shared/src/schemas/inventory";
import {
  createLocationSchema,
  listLocationsQuerySchema,
  updateLocationSchema,
} from "../../shared/src/schemas/location";
import {
  bulkActivateProductsSchema,
  bulkCreateProductsSchema,
  bulkDeactivateProductsSchema,
  bulkDeleteProductsSchema,
  bulkUpdatePricesSchema,
  createProductReviewSchema,
  createProductSchema,
  updateProductReviewSchema,
  updateProductSchema,
} from "../../shared/src/schemas/product";
import { createSaleSchema } from "../../shared/src/schemas/sale";
import { createPaymentSchema } from "../../shared/src/schemas/payment";
import {
  addCheckoutItemSchema,
  applyDiscountSchema,
  cancelCheckoutSchema,
  createCheckoutSchema,
  emailReceiptSchema,
  exportCheckoutsSchema,
  getCheckoutHistorySchema,
  getCheckoutStatsSchema,
  getCheckoutsSchema,
  processPaymentSchema,
  updateCheckoutItemSchema,
  updateCheckoutSchema,
  updateCheckoutSettingsSchema,
  voidCheckoutSchema,
} from "../../shared/src/schemas/checkout";
import {
  createCustomerSchema,
  updateCustomerSchema,
} from "../../shared/src/schemas/customer";
import {
  bulkDeleteSchema,
  categoryQuerySchema,
  categoryWithProductsQuerySchema,
  createCategorySchema,
  updateCategorySchema,
} from "../../shared/src/schemas/category";
import {
  addOrderItemSchema,
  bulkUpdateOrderStatusSchema,
  cancelOrderSchema,
  createOrderSchema,
  updateOrderItemSchema,
  updateOrderSchema,
  updateOrderStatusSchema,
} from "../../shared/src/schemas/order";
import {
  createBusinessUnitSchema,
  updateBusinessUnitSchema,
} from "../../shared/src/schemas/business-unit";
import {
  createSupplierSchema,
  updateSupplierSchema,
} from "../../shared/src/schemas/supplier";
import {
  createPurchaseOrderSchema,
  receivePurchaseOrderSchema,
} from "../../shared/src/schemas/purchase-order";
import { endShiftSchema, startShiftSchema } from "../../shared/src/schemas/shift";
import { taxSummarySchema } from "../../shared/src/schemas/tax";
import {
  bulkCreateVariantsSchema,
  checkSkuSchema,
  createVariantSchema,
  updateVariantSchema,
  updateVariantStockSchema,
  variantQuerySchema,
} from "../../shared/src/schemas/product";
import {
  abandonedCartsQuerySchema,
  addCartItemSchema,
  addMultipleCartItemsSchema,
  applyCartDiscountSchema,
  applyCartPromotionSchema,
  applyLoyaltyPointsSchema,
  associateCustomerSchema,
  cartCheckoutSchema,
  exportAbandonedSchema,
  exportAnalyticsSchema,
  exportHistorySchema,
  splitCartSchema,
  transferCartSchema,
  updateCartItemQuantitySchema,
  updateCartNotesSchema,
  updateCartSettingsSchema,
} from "../../shared/src/schemas/cart";
import {
  associateBarcodeSchema,
  bulkGenerateBarcodesSchema,
  generateBarcodeImageSchema,
  generateBarcodeSchema,
  generateQRCodeSchema,
  scanBarcodeSchema,
  validateBarcodeSchema,
} from "../../shared/src/schemas/barcode";
import {
  bulkCreateNotificationsSchema,
  createNotificationSchema,
  markReadSchema,
  markUnreadSchema,
  notificationPreferencesSchema,
  notificationPrioritySchema,
  notificationQuerySchema,
  notificationTypeSchema,
  updateNotificationSchema,
  updatePreferencesSchema,
} from "../../shared/src/schemas/notification";
import {
  completeStockCountSchema,
  stockCountSchema,
  updateStockCountSchema,
} from "../../shared/src/schemas/stock-count";
import { valuationQuerySchema } from "../../shared/src/schemas/valuation";
import { auditLogQuerySchema } from "../../shared/src/schemas/audit";
import { createReorderSchema } from "../../shared/src/schemas/reorder";
import {
  exportInventorySchema,
  exportSalesSchema,
  importOptionsSchema,
} from "../../shared/src/schemas/export-import";
import {
  reportParamsSchema,
  searchParamsSchema,
} from "../../shared/src/schemas/report";

export const validate = {
  // Auth
  register: registerSchema,
  login: loginSchema,
  forgotPassword: forgotPasswordSchema,
  resetPassword: resetPasswordSchema,
  verifyEmail: verifyEmailSchema,
  resendVerification: resendVerificationSchema,
  verify2FA: verify2FASchema,

  // User
  createUser: createUserSchema,
  updateUser: updateUserSchema,
  updateUserRole: updateUserRoleSchema,
  updatePermissions: updatePermissionsSchema,
  bulkAction: bulkActionSchema,
  userSearch: userSearchSchema,

  // Payment Provider
  createPaymentProvider: createPaymentProviderSchema,
  updatePaymentProvider: updatePaymentProviderSchema,
  getPaymentProviders: getPaymentProvidersQuerySchema,
  toggleProvider: toggleProviderSchema,
  configureProvider: configureProviderSchema,
  updateProviderHealth: updateProviderHealthSchema,
  createProviderCurrency: createProviderCurrencySchema,
  createPaymentMethodConfig: createPaymentMethodConfigSchema,
  updatePaymentMethodConfig: updatePaymentMethodConfigSchema,

  // Provider-specific
  payPalCapture: payPalCaptureSchema,
  flutterwaveVirtualAccount: flutterwaveVirtualAccountSchema,
  paystackVerify: paystackVerifySchema,
  squarePayment: squarePaymentSchema,
  squareCustomer: squareCustomerSchema,

  // Inventory
  createItem: createItemSchema,
  updateItem: updateItemSchema,
  issueItem: issueItemSchema,
  returnItem: returnItemSchema,
  restockItem: restockItemSchema,
  listItems: listItemsQuerySchema,
  listIssues: listIssuesQuerySchema,
  bulkCreateItems: bulkCreateItemsSchema,
  bulkUpdateStock: bulkUpdateStockSchema,

  // Location
  createLocation: createLocationSchema,
  updateLocation: updateLocationSchema,
  listLocations: listLocationsQuerySchema,

  // Product
  createProduct: createProductSchema,
  updateProduct: updateProductSchema,
  createInventory: createInventorySchema,
  updateInventory: updateInventorySchema,
  updateStock: updateStockSchema,
  bulkUpdate: legacyBulkUpdateSchema,
  searchProducts: searchProductsSchema,
  reserveStock: reserveStockSchema,

  // Sale
  createSale: createSaleSchema,
  createPayment: createPaymentSchema,

  // Checkout
  createCheckout: createCheckoutSchema,
  getCheckouts: getCheckoutsSchema,
  getCheckoutHistory: getCheckoutHistorySchema,
  updateCheckout: updateCheckoutSchema,
  processPayment: processPaymentSchema,
  cancelCheckout: cancelCheckoutSchema,
  voidCheckout: voidCheckoutSchema,
  addCheckoutItem: addCheckoutItemSchema,
  updateCheckoutItem: updateCheckoutItemSchema,
  applyDiscount: applyDiscountSchema,
  emailReceipt: emailReceiptSchema,
  exportCheckouts: exportCheckoutsSchema,
  getCheckoutStats: getCheckoutStatsSchema,
  updateCheckoutSettings: updateCheckoutSettingsSchema,

  // Customer
  createCustomer: createCustomerSchema,
  updateCustomer: updateCustomerSchema,

  // Category
  createCategory: createCategorySchema,
  updateCategory: updateCategorySchema,
  bulkDelete: bulkDeleteSchema,
  categoryQuery: categoryQuerySchema,
  categoryWithProducts: categoryWithProductsQuerySchema,

  // Order
  createOrder: createOrderSchema,
  updateOrder: updateOrderSchema,
  updateOrderStatus: updateOrderStatusSchema,
  cancelOrder: cancelOrderSchema,
  addOrderItem: addOrderItemSchema,
  updateOrderItem: updateOrderItemSchema,
  bulkUpdateOrderStatus: bulkUpdateOrderStatusSchema,

  // Business Unit
  createBusinessUnit: createBusinessUnitSchema,
  updateBusinessUnit: updateBusinessUnitSchema,

  // Supplier
  createSupplier: createSupplierSchema,
  updateSupplier: updateSupplierSchema,

  // Purchase Order
  createPurchaseOrder: createPurchaseOrderSchema,
  receivePurchaseOrder: receivePurchaseOrderSchema,

  // Shift
  startShift: startShiftSchema,
  endShift: endShiftSchema,

  // Tax
  taxSummary: taxSummarySchema,

  // Product Review
  createProductReview: createProductReviewSchema,
  updateProductReview: updateProductReviewSchema,

  // Bulk Product
  bulkCreateProducts: bulkCreateProductsSchema,
  bulkDeleteProducts: bulkDeleteProductsSchema,
  bulkActivateProducts: bulkActivateProductsSchema,
  bulkDeactivateProducts: bulkDeactivateProductsSchema,
  bulkUpdatePrices: bulkUpdatePricesSchema,

  // Stock Count
  stockCount: stockCountSchema,
  updateStockCount: updateStockCountSchema,
  completeStockCount: completeStockCountSchema,

  // Valuation
  valuationQuery: valuationQuerySchema,

  // Audit Log
  auditLogQuery: auditLogQuerySchema,

  // Reorder
  createReorder: createReorderSchema,

  // Export/Import
  exportSales: exportSalesSchema,
  exportInventory: exportInventorySchema,
  importOptions: importOptionsSchema,

  // Variant
  createVariant: createVariantSchema,
  updateVariant: updateVariantSchema,
  bulkCreateVariants: bulkCreateVariantsSchema,
  updateVariantStock: updateVariantStockSchema,
  variantQuery: variantQuerySchema,

  // SKU
  checkSku: checkSkuSchema,

  // Cart
  addCartItem: addCartItemSchema,
  addMultipleCartItems: addMultipleCartItemsSchema,
  updateCartItemQuantity: updateCartItemQuantitySchema,
  applyCartDiscount: applyCartDiscountSchema,
  applyCartPromotion: applyCartPromotionSchema,
  applyLoyaltyPoints: applyLoyaltyPointsSchema,
  associateCustomer: associateCustomerSchema,
  updateCartNotes: updateCartNotesSchema,
  cartCheckout: cartCheckoutSchema,
  transferCart: transferCartSchema,
  splitCart: splitCartSchema,

  // Barcode
  generateBarcode: generateBarcodeSchema,
  associateBarcode: associateBarcodeSchema,
  validateBarcode: validateBarcodeSchema,
  scanBarcode: scanBarcodeSchema,
  bulkGenerateBarcodes: bulkGenerateBarcodesSchema,
  generateBarcodeImage: generateBarcodeImageSchema,
  generateQRCode: generateQRCodeSchema,

  // Notification
  createNotification: createNotificationSchema,
  updateNotification: updateNotificationSchema,
  bulkCreateNotifications: bulkCreateNotificationsSchema,
  markRead: markReadSchema,
  markUnread: markUnreadSchema,
  notificationPreferences: notificationPreferencesSchema,
  updatePreferences: updatePreferencesSchema,
  notificationQuery: notificationQuerySchema,
  notificationType: notificationTypeSchema,
  notificationPriority: notificationPrioritySchema,

  // Cart Settings
  updateCartSettings: updateCartSettingsSchema,

  // Export
  exportAnalytics: exportAnalyticsSchema,
  exportHistory: exportHistorySchema,
  exportAbandoned: exportAbandonedSchema,

  // Abandoned Cart
  abandonedCartsQuery: abandonedCartsQuerySchema,

  // Search
  searchParams: searchParamsSchema,
  reportParams: reportParamsSchema,
};

export default validate;
