// D:\Projects\Kalwanga\packages\web\services\checkoutService.ts

import { api } from './api';
import type { Sale } from '../types/sale';
import { paymentService } from './paymentService';
import type { Payment } from '../types/payment';

// ============================================
// TYPES FOR CHECKOUT OPERATIONS
// ============================================

export interface CheckoutItem {
  productId: string;
  variantId?: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface CheckoutData {
  cartId: string;
  customerId?: string;
  paymentMethod: string;
  paidAmount: number;
  discount?: number;
  notes?: string;
  cashRegisterId?: string;
  cashRegisterSessionId?: string;
  applyLoyaltyPoints?: boolean;
  businessUnitId?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  customerAddress?: string;
  savePaymentMethod?: boolean; // ✅ ADDED
}

export interface CheckoutResponse {
  sale: Sale;
  payment: any;
  receipt: {
    receiptNumber: string;
    items: CheckoutItem[];
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    paidAmount: number;
    changeAmount: number;
    customerId?: string;
    businessUnitId: string;
    createdAt: string;
    paymentMethod: string;
  };
  loyaltyPointsEarned: number;
  loyaltyPointsUsed: number;
  changeAmount: number;
}

export interface CheckoutWithPaymentResponse {
  checkout: CheckoutResponse;
  payment: Payment;
}

export interface CheckoutSummary {
  items: any[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  loyaltyPointsAvailable: number;
  loyaltyPointsRedeemable: number;
  maxLoyaltyDiscount: number;
  customerId?: string;
}

export interface CheckoutStats {
  summary: {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    totalCustomers: number;
    conversionRate: number;
    abandonedCarts: number;
    recoveredCarts: number;
  };
  trends: {
    daily: Array<{ date: string; revenue: number; orders: number }>;
    weekly: Array<{ week: string; revenue: number; orders: number }>;
    monthly: Array<{ month: string; revenue: number; orders: number }>;
  };
  topProducts: Array<{ id: string; name: string; quantity: number; revenue: number }>;
  topCustomers: Array<{ id: string; name: string; email: string; totalSpent: number; orderCount: number }>;
  paymentMethods: Array<{ method: string; count: number; total: number }>;
  checkoutSteps: Array<{ step: string; completed: number; dropped: number }>;
  performance: {
    averageCheckoutTime: number;
    pageLoadTime: number;
    successRate: number;
    errorRate: number;
  };
}

export interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  icon?: string;
  enabled: boolean;
  description?: string;
}

export interface CheckoutSettings {
  allowPartialPayment: boolean;
  requireCustomer: boolean;
  requireSignature: boolean;
  maxDiscount: number;
  taxInclusive: boolean;
  defaultPaymentMethod: string;
  receiptFooter: string;
  loyaltyPointsEnabled: boolean;
  pointsPerDollar: number;
  allowGuestCheckout: boolean;
  maxCartItems: number;
  cartExpiryHours: number;
  discountEnabled: boolean;
  maxDiscountPercentage: number;
  autoApplyPromotions: boolean;
  reserveStockOnAdd: boolean;
  reserveStockMinutes: number;
  lowStockThreshold: number;
  freeShippingThreshold: number;
  shippingCost: number;
  taxRate: number;
  notifyOnAbandonedCart: boolean;
  abandonedCartHours: number;
  currencyCode: string;
  currencySymbol: string;
  showStockBadge: boolean;
  showVariantImages: boolean;
}

export interface CheckoutHistoryResponse {
  data: Sale[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface CalculateTotalsRequest {
  items: Array<{ productId: string; variantId?: string; quantity: number; unitPrice: number }>;
  discount?: number;
  taxRate?: number;
}

export interface CalculateTotalsResponse {
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}

export interface ValidateCheckoutRequest {
  cartId: string;
  paymentMethod: string;
  paidAmount: number;
}

export interface ValidateCheckoutResponse {
  valid: boolean;
  errors?: Array<{ field: string; message: string }>;
  warnings?: Array<{ field: string; message: string }>;
}

export interface ProcessPaymentRequest {
  paymentMethod: string;
  amount: number;
  paymentDetails?: Record<string, any>;
}

export interface CancelCheckoutRequest {
  reason?: string;
}

export interface EmailReceiptRequest {
  email?: string;
}

export interface ExportCheckoutsParams {
  format?: 'csv' | 'json' | 'excel' | 'pdf';
  dateFrom?: string;
  dateTo?: string;
  businessUnitId?: string;
  status?: string;
}

export interface CheckoutHistoryParams {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
  customerId?: string;
  search?: string;
}

export interface CheckoutStatsParams {
  range?: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  startDate?: string;
  endDate?: string;
  businessUnitId?: string;
}

export interface CheckoutSettingsUpdate {
  allowPartialPayment?: boolean;
  requireCustomer?: boolean;
  requireSignature?: boolean;
  maxDiscount?: number;
  taxInclusive?: boolean;
  defaultPaymentMethod?: string;
  receiptFooter?: string;
  loyaltyPointsEnabled?: boolean;
  pointsPerDollar?: number;
  allowGuestCheckout?: boolean;
  maxCartItems?: number;
  cartExpiryHours?: number;
  discountEnabled?: boolean;
  maxDiscountPercentage?: number;
  autoApplyPromotions?: boolean;
  reserveStockOnAdd?: boolean;
  reserveStockMinutes?: number;
  lowStockThreshold?: number;
  freeShippingThreshold?: number;
  shippingCost?: number;
  taxRate?: number;
  notifyOnAbandonedCart?: boolean;
  abandonedCartHours?: number;
  currencyCode?: string;
  currencySymbol?: string;
  showStockBadge?: boolean;
  showVariantImages?: boolean;
}

// ============================================
// CHECKOUT SERVICE
// ============================================

export const checkoutService = {
  // ============================================
  // CORE CHECKOUT OPERATIONS
  // ============================================

  /**
   * Create a new checkout from cart
   * POST /checkout
   */
  async createCheckout(data: CheckoutData): Promise<CheckoutResponse> {
    const response = await api.post<CheckoutResponse>('/checkout', data);
    return response;
  },

  /**
   * Process checkout (legacy alias for createCheckout)
   * POST /checkout
   */
  async processCheckout(data: CheckoutData): Promise<CheckoutResponse> {
    const response = await api.post<CheckoutResponse>('/checkout', data);
    return response;
  },

  /**
   * Process checkout with integrated payment
   * POST /checkout/process-with-payment
   */
  async processCheckoutWithPayment(data: CheckoutData): Promise<CheckoutWithPaymentResponse> {
    try {
      // 1. Process the checkout
      const checkoutResult = await this.processCheckout({
        cartId: data.cartId,
        customerId: data.customerId,
        paymentMethod: data.paymentMethod,
        paidAmount: data.paidAmount,
        discount: data.discount,
        notes: data.notes,
        cashRegisterId: data.cashRegisterId,
        cashRegisterSessionId: data.cashRegisterSessionId,
        applyLoyaltyPoints: data.applyLoyaltyPoints,
        businessUnitId: data.businessUnitId,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        customerName: data.customerName,
        customerAddress: data.customerAddress,
      });

      // 2. Process the payment
      const payment = await paymentService.processPayment({
        amount: checkoutResult.receipt.total,
        paymentMethod: data.paymentMethod,
        saleId: checkoutResult.sale.id,
        businessUnitId: data.businessUnitId,
        cashRegisterId: data.cashRegisterId,
        cashRegisterSessionId: data.cashRegisterSessionId,
        customerId: data.customerId,
        savePaymentMethod: data.savePaymentMethod,
        metadata: {
          receiptNumber: checkoutResult.receipt.receiptNumber,
          cartId: data.cartId,
        },
        description: `Payment for order ${checkoutResult.receipt.receiptNumber}`,
      });

      return {
        checkout: checkoutResult,
        payment,
      };
    } catch (error) {
      console.error('Checkout with payment failed:', error);
      throw error;
    }
  },

  /**
   * Get all checkouts with pagination (Admin/SuperAdmin only)
   * GET /checkout
   */
  async getCheckouts(params?: {
    page?: number;
    limit?: number;
    status?: string;
    paymentStatus?: string;
    customerId?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    data: Sale[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  }> {
    const response = await api.get<{
      data: Sale[];
      total: number;
      page: number;
      totalPages: number;
      limit: number;
    }>('/checkout', { params });
    return response;
  },

  /**
   * Get checkout by ID
   * GET /checkout/:id
   */
  async getCheckoutById(id: string): Promise<Sale> {
    const response = await api.get<Sale>(`/checkout/${id}`);
    return response;
  },

  /**
   * Get checkout by receipt number
   * GET /checkout/receipt/:receiptNumber
   */
  async getCheckoutByReceiptNumber(receiptNumber: string): Promise<Sale> {
    const response = await api.get<Sale>(`/checkout/receipt/${receiptNumber}`);
    return response;
  },

  /**
   * Update checkout (Admin/SuperAdmin only)
   * PUT /checkout/:id
   */
  async updateCheckout(
    id: string,
    data: {
      status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED' | 'VOIDED';
      paymentStatus?: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'PARTIAL';
      notes?: string;
    }
  ): Promise<Sale> {
    const response = await api.put<Sale>(`/checkout/${id}`, data);
    return response;
  },

  /**
   * Delete checkout (Admin/SuperAdmin only)
   * DELETE /checkout/:id
   */
  async deleteCheckout(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(`/checkout/${id}`);
    return response;
  },

  /**
   * Void checkout (Admin/SuperAdmin only)
   * POST /checkout/:saleId/void
   */
  async voidCheckout(
    saleId: string,
    data?: CancelCheckoutRequest
  ): Promise<Sale> {
    const response = await api.post<Sale>(`/checkout/${saleId}/void`, data || {});
    return response;
  },

  /**
   * Cancel checkout
   * POST /checkout/:id/cancel
   */
  async cancelCheckout(id: string, data?: CancelCheckoutRequest): Promise<Sale> {
    const response = await api.post<Sale>(`/checkout/${id}/cancel`, data || {});
    return response;
  },

  /**
   * Complete checkout
   * POST /checkout/:id/complete
   */
  async completeCheckout(id: string): Promise<Sale> {
    const response = await api.post<Sale>(`/checkout/${id}/complete`);
    return response;
  },

  // ============================================
  // CHECKOUT ITEMS OPERATIONS
  // ============================================

  /**
   * Get checkout items
   * GET /checkout/:id/items
   */
  async getCheckoutItems(id: string): Promise<any[]> {
    const response = await api.get<any[]>(`/checkout/${id}/items`);
    return response;
  },

  /**
   * Add item to checkout
   * POST /checkout/:id/items
   */
  async addCheckoutItem(
    id: string,
    data: {
      productId: string;
      variantId?: string;
      quantity: number;
      unitPrice: number;
    }
  ): Promise<any> {
    const response = await api.post<any>(`/checkout/${id}/items`, data);
    return response;
  },

  /**
   * Update checkout item quantity
   * PUT /checkout/:id/items/:itemId
   */
  async updateCheckoutItem(
    id: string,
    itemId: string,
    data: { quantity: number }
  ): Promise<any> {
    const response = await api.put<any>(`/checkout/${id}/items/${itemId}`, data);
    return response;
  },

  /**
   * Remove item from checkout
   * DELETE /checkout/:id/items/:itemId
   */
  async removeCheckoutItem(id: string, itemId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(
      `/checkout/${id}/items/${itemId}`
    );
    return response;
  },

  // ============================================
  // CHECKOUT PAYMENT OPERATIONS
  // ============================================

  /**
   * Process payment for checkout
   * POST /checkout/:id/pay
   */
  async processPayment(
    id: string,
    data: ProcessPaymentRequest
  ): Promise<any> {
    const response = await api.post<any>(`/checkout/${id}/pay`, data);
    return response;
  },

  /**
   * Get payment methods
   * GET /checkout/payment-methods
   */
  async getPaymentMethods(): Promise<{
    success: boolean;
    data: PaymentMethod[];
  }> {
    const response = await api.get<{
      success: boolean;
      data: PaymentMethod[];
    }>('/checkout/payment-methods');
    return response;
  },

  // ============================================
  // CHECKOUT DISCOUNT OPERATIONS
  // ============================================

  /**
   * Apply discount to checkout
   * POST /checkout/:id/discount
   */
  async applyDiscount(id: string, data: { code: string }): Promise<Sale> {
    const response = await api.post<Sale>(`/checkout/${id}/discount`, data);
    return response;
  },

  /**
   * Remove discount from checkout
   * DELETE /checkout/:id/discount
   */
  async removeDiscount(id: string): Promise<Sale> {
    const response = await api.delete<Sale>(`/checkout/${id}/discount`);
    return response;
  },

  // ============================================
  // CHECKOUT RECEIPT OPERATIONS
  // ============================================

  /**
   * Get checkout receipt
   * GET /checkout/:id/receipt
   */
  async getCheckoutReceipt(id: string): Promise<Sale> {
    const response = await api.get<Sale>(`/checkout/${id}/receipt`);
    return response;
  },

  /**
   * Get checkout summary
   * GET /checkout/:id/summary
   */
  async getCheckoutSummary(id: string): Promise<CheckoutSummary> {
    const response = await api.get<CheckoutSummary>(`/checkout/${id}/summary`);
    return response;
  },

  /**
   * Get checkout summary by cart ID
   * GET /checkout/summary/:cartId
   */
  async getCheckoutSummaryByCart(cartId: string): Promise<{
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    items: any[];
    customer?: any;
    loyaltyPoints?: number;
  }> {
    const response = await api.get<{
      subtotal: number;
      tax: number;
      discount: number;
      total: number;
      items: any[];
      customer?: any;
      loyaltyPoints?: number;
    }>(`/checkout/summary/${cartId}`);
    return response;
  },

  /**
   * Send checkout receipt via email
   * POST /checkout/:id/email-receipt
   */
  async sendReceiptEmail(
    id: string,
    data?: EmailReceiptRequest
  ): Promise<{ success: boolean; message: string; email: string }> {
    const response = await api.post<{
      success: boolean;
      message: string;
      email: string;
    }>(`/checkout/${id}/email-receipt`, data || {});
    return response;
  },

  // ============================================
  // CHECKOUT HISTORY OPERATIONS
  // ============================================

  /**
   * Get checkout history with filters
   * GET /checkout/history
   */
  async getCheckoutHistory(params?: CheckoutHistoryParams): Promise<{
    data: Sale[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  }> {
    const response = await api.get<{
      data: Sale[];
      total: number;
      page: number;
      totalPages: number;
      limit: number;
    }>('/checkout/history', { params });
    return response;
  },

  /**
   * Get customer checkout history
   * GET /checkout/customer/:customerId/history
   */
  async getCustomerCheckoutHistory(
    customerId: string,
    params?: { page?: number; limit?: number }
  ): Promise<{
    history: Sale[];
    total: number;
    page: number;
    limit: number;
  }> {
    const response = await api.get<{
      history: Sale[];
      total: number;
      page: number;
      limit: number;
    }>(`/checkout/customer/${customerId}/history`, { params });
    return response;
  },

  // ============================================
  // CHECKOUT STATISTICS OPERATIONS
  // ============================================

  /**
   * Get checkout statistics (Admin/SuperAdmin only)
   * GET /checkout/stats/summary
   */
  async getCheckoutStats(params?: {
    dateFrom?: string;
    dateTo?: string;
    businessUnitId?: string;
  }): Promise<CheckoutStats> {
    const response = await api.get<CheckoutStats>('/checkout/stats/summary', { params });
    return response;
  },

  /**
   * Get checkout statistics with filters
   * GET /checkout/stats
   */
  async getStats(params?: CheckoutStatsParams): Promise<{
    success: boolean;
    data: CheckoutStats;
    message?: string;
  }> {
    try {
      const response = await api.get<{
        success: boolean;
        data: CheckoutStats;
        message?: string;
      }>('/checkout/stats', { params });
      return response;
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      throw error;
    }
  },

  /**
   * Export statistics
   * GET /checkout/stats/export
   */
  async exportStats(params?: {
    range?: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
    startDate?: string;
    endDate?: string;
    format?: 'csv' | 'pdf' | 'excel';
  }): Promise<{ data: string }> {
    try {
      const response = await api.get<{ data: string }>('/checkout/stats/export', {
        params,
        responseType: 'blob',
      });
      return response;
    } catch (error) {
      console.error('Failed to export stats:', error);
      throw error;
    }
  },

  // ============================================
  // CHECKOUT SETTINGS OPERATIONS
  // ============================================

  /**
   * Get checkout settings
   * GET /checkout/settings
   */
  async getCheckoutSettings(): Promise<{
    success: boolean;
    data: CheckoutSettings;
  }> {
    const response = await api.get<{
      success: boolean;
      data: CheckoutSettings;
    }>('/checkout/settings');
    return response;
  },

  /**
   * Update checkout settings
   * PUT /checkout/settings
   */
  async updateCheckoutSettings(settings: CheckoutSettingsUpdate): Promise<{
    success: boolean;
    data: CheckoutSettings;
    message: string;
  }> {
    const response = await api.put<{
      success: boolean;
      data: CheckoutSettings;
      message: string;
    }>('/checkout/settings', settings);
    return response;
  },

  // ============================================
  // CHECKOUT EXPORT OPERATIONS
  // ============================================

  /**
   * Export checkouts (Admin/SuperAdmin only)
   * GET /checkout/export/all
   */
  async exportCheckouts(params?: ExportCheckoutsParams): Promise<any> {
    const response = await api.get('/checkout/export/all', { 
      params,
      responseType: 'blob',
    });
    return response;
  },

  /**
   * Export checkout data
   * GET /checkout/export
   */
  async exportCheckoutData(params?: {
    format?: 'csv' | 'json' | 'excel' | 'pdf';
    dateFrom?: string;
    dateTo?: string;
    status?: string;
    includeItems?: boolean;
    includeCustomer?: boolean;
  }): Promise<any> {
    const response = await api.get('/checkout/export', { 
      params,
      responseType: 'blob',
    });
    return response;
  },

  // ============================================
  // CHECKOUT VALIDATION OPERATIONS
  // ============================================

  /**
   * Validate checkout
   * POST /checkout/validate
   */
  async validateCheckout(data: ValidateCheckoutRequest): Promise<ValidateCheckoutResponse> {
    const response = await api.post<ValidateCheckoutResponse>('/checkout/validate', data);
    return response;
  },

  /**
   * Calculate checkout totals
   * POST /checkout/calculate
   */
  async calculateTotals(data: CalculateTotalsRequest): Promise<CalculateTotalsResponse> {
    const response = await api.post<CalculateTotalsResponse>('/checkout/calculate', data);
    return response;
  },

  // ============================================
  // PAYMENT INTEGRATION METHODS ✅ NEW
  // ============================================

  /**
   * Get payment status for a checkout
   * GET /checkout/:id/payment-status
   */
  async getCheckoutPaymentStatus(checkoutId: string): Promise<{
    success: boolean;
    data: {
      paymentStatus: string;
      amountPaid: number;
      amountDue: number;
      payments: any[];
    };
  }> {
    const response = await api.get<{
      success: boolean;
      data: {
        paymentStatus: string;
        amountPaid: number;
        amountDue: number;
        payments: any[];
      };
    }>(`/checkout/${checkoutId}/payment-status`);
    return response;
  },

  /**
   * Get all payments for a checkout
   * GET /checkout/:id/payments
   */
  async getCheckoutPayments(checkoutId: string): Promise<{
    success: boolean;
    data: any[];
  }> {
    const response = await api.get<{
      success: boolean;
      data: any[];
    }>(`/checkout/${checkoutId}/payments`);
    return response;
  },

  /**
   * Process refund for a checkout payment
   * POST /checkout/:id/refund
   */
  async refundCheckoutPayment(
    checkoutId: string,
    data: {
      paymentId: string;
      amount?: number;
      reason?: string;
    }
  ): Promise<{
    success: boolean;
    data: any;
    message: string;
  }> {
    const response = await api.post<{
      success: boolean;
      data: any;
      message: string;
    }>(`/checkout/${checkoutId}/refund`, data);
    return response;
  },

  // ============================================
  // LEGACY/COMPATIBILITY METHODS
  // ============================================

  /**
   * Get receipt by sale ID (legacy)
   * GET /checkout/receipt/:saleId
   * @deprecated Use getCheckoutReceipt with checkout ID instead
   */
  async getReceipt(saleId: string): Promise<Sale> {
    const response = await api.get<Sale>(`/checkout/receipt/${saleId}`);
    return response;
  },

  /**
   * Get receipt by receipt number (legacy)
   * GET /checkout/receipt/number/:receiptNumber
   * @deprecated Use getCheckoutByReceiptNumber instead
   */
  async getReceiptByNumber(receiptNumber: string): Promise<Sale> {
    const response = await api.get<Sale>(`/checkout/receipt/number/${receiptNumber}`);
    return response;
  },

  /**
   * Get all checkouts (admin) (legacy)
   * GET /checkout/admin/all
   * @deprecated Use getCheckouts with pagination params instead
   */
  async getAllCheckouts(params?: { limit?: number; offset?: number }): Promise<Sale[]> {
    const response = await api.get<Sale[]>('/checkout/admin/all', { params });
    return response;
  },

  /**
   * Send receipt email (legacy)
   * POST /checkout/receipt/email
   * @deprecated Use sendReceiptEmail with checkout ID instead
   */
  async sendReceiptEmailLegacy(saleId: string, email: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post<{ success: boolean; message: string }>(
      '/checkout/receipt/email',
      { saleId, email }
    );
    return response;
  },

  /**
   * Print receipt (legacy)
   * GET /checkout/receipt/print/:saleId
   * @deprecated Use getCheckoutReceipt with checkout ID instead
   */
  async printReceipt(saleId: string): Promise<{ printUrl: string; receiptData: Sale }> {
    const response = await api.get<{ printUrl: string; receiptData: Sale }>(
      `/checkout/receipt/print/${saleId}`
    );
    return response;
  },

  /**
   * Get receipt PDF (legacy)
   * GET /checkout/receipt/pdf/:saleId
   * @deprecated Use getCheckoutReceipt with checkout ID instead
   */
  async getReceiptPdf(saleId: string): Promise<Blob> {
    const response = await api.download(`/checkout/receipt/pdf/${saleId}`);
    return response;
  },

  /**
   * Resend receipt email (legacy)
   * POST /checkout/receipt/resend
   * @deprecated Use sendReceiptEmail with checkout ID instead
   */
  async resendReceiptEmail(saleId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post<{ success: boolean; message: string }>(
      '/checkout/receipt/resend',
      { saleId }
    );
    return response;
  },

  /**
   * Cancel checkout (legacy)
   * POST /checkout/cancel/:saleId
   * @deprecated Use cancelCheckout with checkout ID instead
   */
  async cancelCheckoutLegacy(saleId: string, reason?: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post<{ success: boolean; message: string }>(
      `/checkout/cancel/${saleId}`,
      { reason }
    );
    return response;
  },

  /**
   * Get checkout by cart ID (legacy)
   * GET /checkout/cart/:cartId
   * @deprecated Use getCheckoutByCart instead
   */
  async getCheckoutByCart(cartId: string): Promise<{
    id: string;
    status: string;
    items: any[];
    total: number;
    createdAt: string;
  }> {
    const response = await api.get<{
      id: string;
      status: string;
      items: any[];
      total: number;
      createdAt: string;
    }>(`/checkout/cart/${cartId}`);
    return response;
  },
};

// Export types for use in other files
export type { Sale };
export default checkoutService;
