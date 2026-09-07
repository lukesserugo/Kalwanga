// src/services/realtimeService.ts
import { Server } from 'http';
import { EventEmitter } from 'events';

// Extended event type to include all possible events
interface RealtimeEvent {
  type: 
    | 'SALE_CREATED' 
    | 'SALE_REFUNDED'
    | 'SALE_UPDATED'
    | 'SALE_CANCELLED'
    | 'SALE_VOIDED'
    | 'INVENTORY_UPDATED' 
    | 'INVENTORY_SYNCED'
    | 'PRODUCT_UPDATED' 
    | 'PRODUCT_CREATED'
    | 'PRODUCT_DELETED'
    | 'CUSTOMER_UPDATED' 
    | 'SUPPLIER_UPDATED'
    | 'CART_UPDATED'
    | 'SHIFT_STARTED'
    | 'SHIFT_ENDED'
    | 'PURCHASE_ORDER_CREATED'
    | 'PURCHASE_ORDER_RECEIVED'
    | 'LOW_STOCK_ALERT'
    | 'OUT_OF_STOCK_ALERT'
    | 'CASH_REGISTER_UPDATED'
    | 'NOTIFICATION'
    // New sales-related events
    | 'RETURN_CREATED'
    | 'RETURN_UPDATED'
    | 'RETURN_PROCESSED'
    | 'RETURN_APPROVED'
    | 'RETURN_REJECTED'
    | 'REFUND_CREATED'
    | 'REFUND_UPDATED'
    | 'REFUND_PROCESSED'
    | 'REFUND_COMPLETED'
    | 'INVOICE_CREATED'
    | 'INVOICE_UPDATED'
    | 'INVOICE_SENT'
    | 'INVOICE_PAID'
    | 'INVOICE_VOIDED'
    | 'INVOICE_CANCELLED'
    | 'RECEIPT_ISSUED'
    | 'RECEIPT_PRINTED'
    | 'RECEIPT_EMAILED'
    | 'EXPORT_COMPLETED'
    | 'EXPORT_FAILED'
    | 'DASHBOARD_UPDATE'
    | 'RETURN_REJECTED'
    | 'RETURN_APPROVED';
  payload: any;
  businessUnitId?: string;
  timestamp: Date;
}

// In-memory event emitter based RealtimeService (no ws dependency)
class RealtimeService {
  private eventEmitter: EventEmitter = new EventEmitter();
  private clients: Map<string, Set<(event: RealtimeEvent) => void>> = new Map();
  private globalClients: Set<(event: RealtimeEvent) => void> = new Set();
  private eventHistory: RealtimeEvent[] = [];
  private maxHistorySize: number = 1000;
  private isInitialized: boolean = false;

  initialize(server: Server) {
    if (this.isInitialized) {
      console.log('RealtimeService already initialized');
      return;
    }
    this.isInitialized = true;
    console.log('✅ RealtimeService initialized (in-memory event mode)');
    console.log('   Supported events: SALE_CREATED, INVENTORY_UPDATED, RETURN_CREATED, REFUND_CREATED, INVOICE_CREATED, etc.');
    console.log('   For production WebSocket support, run: pnpm add ws');
  }

  /**
   * Subscribe to events for a specific business unit
   */
  subscribe(businessUnitId: string, callback: (event: RealtimeEvent) => void): () => void {
    if (!this.clients.has(businessUnitId)) {
      this.clients.set(businessUnitId, new Set());
    }
    this.clients.get(businessUnitId)!.add(callback);
    
    // Send recent events for this business unit
    const recentEvents = this.eventHistory.filter(
      e => e.businessUnitId === businessUnitId || !e.businessUnitId
    ).slice(-50);
    recentEvents.forEach(callback);
    
    // Return unsubscribe function
    return () => {
      this.clients.get(businessUnitId)?.delete(callback);
    };
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(businessUnitId: string, callback: (event: RealtimeEvent) => void) {
    this.clients.get(businessUnitId)?.delete(callback);
  }

  /**
   * Subscribe to all events
   */
  subscribeToAll(callback: (event: RealtimeEvent) => void): () => void {
    this.globalClients.add(callback);
    this.eventEmitter.on('event', callback);
    
    // Send recent events
    const recentEvents = this.eventHistory.slice(-50);
    recentEvents.forEach(callback);
    
    return () => {
      this.globalClients.delete(callback);
      this.eventEmitter.off('event', callback);
    };
  }

  /**
   * Broadcast event to specific business unit and all clients
   */
  private broadcast(event: RealtimeEvent) {
    // Store in history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }

    // Emit to global listeners
    this.eventEmitter.emit('event', event);
    
    // Emit to global clients directly
    this.globalClients.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in realtime global callback:', error);
      }
    });
    
    // Emit to business unit specific listeners
    if (event.businessUnitId && this.clients.has(event.businessUnitId)) {
      this.clients.get(event.businessUnitId)!.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('Error in realtime callback:', error);
        }
      });
    }
    
    // Emit to all clients (wildcard) - excluding the one already notified
    this.clients.forEach((callbacks, businessUnitId) => {
      if (businessUnitId !== event.businessUnitId) {
        callbacks.forEach(callback => {
          try {
            callback(event);
          } catch (error) {
            console.error('Error in realtime callback:', error);
          }
        });
      }
    });
  }

  // ============================================
  // SALE EVENTS
  // ============================================

  emitSaleCreated(sale: any, businessUnitId: string) {
    this.broadcast({
      type: 'SALE_CREATED',
      payload: sale,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  emitSaleRefunded(sale: any, businessUnitId: string) {
    this.broadcast({
      type: 'SALE_REFUNDED',
      payload: sale,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  emitSaleUpdated(sale: any, businessUnitId: string) {
    this.broadcast({
      type: 'SALE_UPDATED',
      payload: sale,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  emitSaleCancelled(sale: any, businessUnitId: string) {
    this.broadcast({
      type: 'SALE_CANCELLED',
      payload: sale,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  emitSaleVoided(sale: any, businessUnitId: string) {
    this.broadcast({
      type: 'SALE_VOIDED',
      payload: sale,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  // ============================================
  // INVENTORY EVENTS
  // ============================================

  emitInventoryUpdated(inventory: any, businessUnitId: string) {
    this.broadcast({
      type: 'INVENTORY_UPDATED',
      payload: inventory,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  emitInventorySynced(inventory: any, businessUnitId: string) {
    this.broadcast({
      type: 'INVENTORY_SYNCED',
      payload: inventory,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  // ============================================
  // PRODUCT EVENTS
  // ============================================

  emitProductUpdated(product: any, businessUnitId: string) {
    this.broadcast({
      type: 'PRODUCT_UPDATED',
      payload: product,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  emitProductCreated(product: any, businessUnitId: string) {
    this.broadcast({
      type: 'PRODUCT_CREATED',
      payload: product,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  emitProductDeleted(productId: string, businessUnitId: string) {
    this.broadcast({
      type: 'PRODUCT_DELETED',
      payload: { id: productId },
      businessUnitId,
      timestamp: new Date(),
    });
  }

  // ============================================
  // CUSTOMER EVENTS
  // ============================================

  emitCustomerUpdated(customer: any, businessUnitId: string) {
    this.broadcast({
      type: 'CUSTOMER_UPDATED',
      payload: customer,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  // ============================================
  // SUPPLIER EVENTS
  // ============================================

  emitSupplierUpdated(supplier: any, businessUnitId: string) {
    this.broadcast({
      type: 'SUPPLIER_UPDATED',
      payload: supplier,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  // ============================================
  // CART EVENTS
  // ============================================

  emitCartUpdated(cart: any, businessUnitId: string) {
    this.broadcast({
      type: 'CART_UPDATED',
      payload: cart,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  // ============================================
  // SHIFT EVENTS
  // ============================================

  emitShiftStarted(shift: any, businessUnitId: string) {
    this.broadcast({
      type: 'SHIFT_STARTED',
      payload: shift,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  emitShiftEnded(shift: any, businessUnitId: string) {
    this.broadcast({
      type: 'SHIFT_ENDED',
      payload: shift,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  // ============================================
  // PURCHASE ORDER EVENTS
  // ============================================

  emitPurchaseOrderCreated(po: any, businessUnitId: string) {
    this.broadcast({
      type: 'PURCHASE_ORDER_CREATED',
      payload: po,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  emitPurchaseOrderReceived(po: any, businessUnitId: string) {
    this.broadcast({
      type: 'PURCHASE_ORDER_RECEIVED',
      payload: po,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  // ============================================
  // INVENTORY ALERT EVENTS
  // ============================================

  emitLowStockAlert(product: any, businessUnitId: string) {
    this.broadcast({
      type: 'LOW_STOCK_ALERT',
      payload: product,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  emitOutOfStockAlert(product: any, businessUnitId: string) {
    this.broadcast({
      type: 'OUT_OF_STOCK_ALERT',
      payload: product,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  // ============================================
  // CASH REGISTER EVENTS
  // ============================================

  emitCashRegisterUpdated(register: any, businessUnitId: string) {
    this.broadcast({
      type: 'CASH_REGISTER_UPDATED',
      payload: register,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  // ============================================
  // NOTIFICATION EVENTS
  // ============================================

  emitNotification(notification: any, businessUnitId: string) {
    this.broadcast({
      type: 'NOTIFICATION',
      payload: notification,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  // ============================================
  // RETURN EVENTS (NEW)
  // ============================================

  emitReturnCreated(returnData: any, businessUnitId: string) {
    this.broadcast({
      type: 'RETURN_CREATED',
      payload: returnData,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  emitReturnUpdated(returnData: any, businessUnitId: string) {
    this.broadcast({
      type: 'RETURN_UPDATED',
      payload: returnData,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  emitReturnProcessed(returnData: any, businessUnitId: string) {
    this.broadcast({
      type: 'RETURN_PROCESSED',
      payload: returnData,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  emitReturnApproved(returnData: any, businessUnitId: string) {
    this.broadcast({
      type: 'RETURN_APPROVED',
      payload: returnData,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  emitReturnRejected(returnData: any, businessUnitId: string) {
    this.broadcast({
      type: 'RETURN_REJECTED',
      payload: returnData,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  // ============================================
  // REFUND EVENTS (NEW)
  // ============================================

  emitRefundCreated(refund: any, businessUnitId: string) {
    this.broadcast({
      type: 'REFUND_CREATED',
      payload: refund,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  emitRefundUpdated(refund: any, businessUnitId: string) {
    this.broadcast({
      type: 'REFUND_UPDATED',
      payload: refund,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  emitRefundProcessed(refund: any, businessUnitId: string) {
    this.broadcast({
      type: 'REFUND_PROCESSED',
      payload: refund,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  emitRefundCompleted(refund: any, businessUnitId: string) {
    this.broadcast({
      type: 'REFUND_COMPLETED',
      payload: refund,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  // ============================================
  // INVOICE EVENTS (NEW)
  // ============================================

  emitInvoiceCreated(invoice: any, businessUnitId: string) {
    this.broadcast({
      type: 'INVOICE_CREATED',
      payload: invoice,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  emitInvoiceUpdated(invoice: any, businessUnitId: string) {
    this.broadcast({
      type: 'INVOICE_UPDATED',
      payload: invoice,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  emitInvoiceSent(invoice: any, businessUnitId: string) {
    this.broadcast({
      type: 'INVOICE_SENT',
      payload: invoice,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  emitInvoicePaid(invoice: any, businessUnitId: string) {
    this.broadcast({
      type: 'INVOICE_PAID',
      payload: invoice,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  emitInvoiceVoided(invoice: any, businessUnitId: string) {
    this.broadcast({
      type: 'INVOICE_VOIDED',
      payload: invoice,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  emitInvoiceCancelled(invoice: any, businessUnitId: string) {
    this.broadcast({
      type: 'INVOICE_CANCELLED',
      payload: invoice,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  // ============================================
  // RECEIPT EVENTS (NEW)
  // ============================================

  emitReceiptIssued(receipt: any, businessUnitId: string) {
    this.broadcast({
      type: 'RECEIPT_ISSUED',
      payload: receipt,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  emitReceiptPrinted(receipt: any, businessUnitId: string) {
    this.broadcast({
      type: 'RECEIPT_PRINTED',
      payload: receipt,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  emitReceiptEmailed(receipt: any, businessUnitId: string) {
    this.broadcast({
      type: 'RECEIPT_EMAILED',
      payload: receipt,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  // ============================================
  // EXPORT EVENTS (NEW)
  // ============================================

  emitExportCompleted(exportData: any, businessUnitId: string) {
    this.broadcast({
      type: 'EXPORT_COMPLETED',
      payload: exportData,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  emitExportFailed(exportData: any, businessUnitId: string) {
    this.broadcast({
      type: 'EXPORT_FAILED',
      payload: exportData,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  // ============================================
  // DASHBOARD EVENTS (NEW)
  // ============================================

  emitDashboardUpdate(data: any, businessUnitId: string) {
    this.broadcast({
      type: 'DASHBOARD_UPDATE',
      payload: data,
      businessUnitId,
      timestamp: new Date(),
    });
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Get number of subscribed clients
   */
  getClientCount(businessUnitId?: string): number {
    if (businessUnitId) {
      return this.clients.get(businessUnitId)?.size || 0;
    }
    let total = this.globalClients.size;
    this.clients.forEach(callbacks => { total += callbacks.size; });
    return total;
  }

  /**
   * Get event history
   */
  getEventHistory(limit: number = 50, businessUnitId?: string): RealtimeEvent[] {
    let events = this.eventHistory;
    if (businessUnitId) {
      events = events.filter(e => e.businessUnitId === businessUnitId || !e.businessUnitId);
    }
    return events.slice(-limit);
  }

  /**
   * Clear event history
   */
  clearHistory() {
    this.eventHistory = [];
  }

  /**
   * Get connected business units
   */
  getConnectedBusinessUnits(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Check if service is initialized
   */
  isInitializedService(): boolean {
    return this.isInitialized;
  }
}

export const realtimeService = new RealtimeService();

// Export types for use in other files
export type { RealtimeEvent };
