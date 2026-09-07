// src/controllers/realtimeController.ts
import { Request, Response, NextFunction } from 'express';
import { realtimeService, RealtimeEvent } from '../services/realtimeService.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { logger } from '../lib/logger.js';

// Validation schemas
const subscribeSchema = z.object({
  businessUnitId: z.string().optional(),
  userId: z.string().optional(),
  eventTypes: z.array(z.string()).optional(),
});

const broadcastSchema = z.object({
  businessUnitId: z.string().optional(),
  eventType: z.string().min(1, 'Event type is required'),
  payload: z.any(),
});

const emitEventSchema = z.object({
  businessUnitId: z.string().min(1, 'Business unit ID is required'),
  eventType: z.enum([
    'SALE_CREATED',
    'SALE_UPDATED',
    'SALE_REFUNDED',
    'SALE_CANCELLED',
    'SALE_VOIDED',
    'INVENTORY_UPDATED',
    'INVENTORY_SYNCED',
    'PRODUCT_UPDATED',
    'PRODUCT_CREATED',
    'PRODUCT_DELETED',
    'CUSTOMER_UPDATED',
    'SUPPLIER_UPDATED',
    'CART_UPDATED',
    'SHIFT_STARTED',
    'SHIFT_ENDED',
    'PURCHASE_ORDER_CREATED',
    'PURCHASE_ORDER_RECEIVED',
    'LOW_STOCK_ALERT',
    'OUT_OF_STOCK_ALERT',
    'CASH_REGISTER_UPDATED',
    'NOTIFICATION',
    'RETURN_CREATED',
    'RETURN_UPDATED',
    'RETURN_PROCESSED',
    'RETURN_APPROVED',
    'RETURN_REJECTED',
    'REFUND_CREATED',
    'REFUND_UPDATED',
    'REFUND_PROCESSED',
    'REFUND_COMPLETED',
    'INVOICE_CREATED',
    'INVOICE_UPDATED',
    'INVOICE_SENT',
    'INVOICE_PAID',
    'INVOICE_VOIDED',
    'INVOICE_CANCELLED',
    'RECEIPT_ISSUED',
    'RECEIPT_PRINTED',
    'RECEIPT_EMAILED',
    'EXPORT_COMPLETED',
    'EXPORT_FAILED',
    'DASHBOARD_UPDATE',
  ]),
  payload: z.any(),
});

export const realtimeController = {
  /**
   * Get realtime service status
   * GET /realtime/status
   */
  async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const status = {
        initialized: realtimeService.isInitializedService(),
        totalClients: realtimeService.getClientCount(),
        connectedBusinessUnits: realtimeService.getConnectedBusinessUnits(),
        eventHistorySize: realtimeService.getEventHistory(1000).length,
        supportedEvents: [
          'SALE_CREATED', 'SALE_UPDATED', 'SALE_REFUNDED', 'SALE_CANCELLED', 'SALE_VOIDED',
          'INVENTORY_UPDATED', 'INVENTORY_SYNCED',
          'PRODUCT_UPDATED', 'PRODUCT_CREATED', 'PRODUCT_DELETED',
          'CUSTOMER_UPDATED', 'SUPPLIER_UPDATED', 'CART_UPDATED',
          'SHIFT_STARTED', 'SHIFT_ENDED',
          'PURCHASE_ORDER_CREATED', 'PURCHASE_ORDER_RECEIVED',
          'LOW_STOCK_ALERT', 'OUT_OF_STOCK_ALERT',
          'CASH_REGISTER_UPDATED', 'NOTIFICATION',
          'RETURN_CREATED', 'RETURN_UPDATED', 'RETURN_PROCESSED', 'RETURN_APPROVED', 'RETURN_REJECTED',
          'REFUND_CREATED', 'REFUND_UPDATED', 'REFUND_PROCESSED', 'REFUND_COMPLETED',
          'INVOICE_CREATED', 'INVOICE_UPDATED', 'INVOICE_SENT', 'INVOICE_PAID', 'INVOICE_VOIDED', 'INVOICE_CANCELLED',
          'RECEIPT_ISSUED', 'RECEIPT_PRINTED', 'RECEIPT_EMAILED',
          'EXPORT_COMPLETED', 'EXPORT_FAILED', 'DASHBOARD_UPDATE',
        ],
        timestamp: new Date(),
        uptime: process.uptime(),
      };

      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get realtime event history
   * GET /realtime/history
   */
  async getEventHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { limit = 50, businessUnitId, eventType } = req.query;

      let events = realtimeService.getEventHistory(
        Number(limit),
        businessUnitId as string
      );

      // Filter by event type if provided
      if (eventType) {
        events = events.filter(event => event.type === eventType);
      }

      res.status(200).json({
        success: true,
        data: events,
        count: events.length,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Clear realtime event history
   * DELETE /realtime/history
   */
  async clearHistory(req: Request, res: Response, next: NextFunction) {
    try {
      realtimeService.clearHistory();

      res.status(200).json({
        success: true,
        message: 'Event history cleared',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get connected clients count
   * GET /realtime/clients/count
   */
  async getClientCount(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = req.query;

      const count = realtimeService.getClientCount(businessUnitId as string);

      res.status(200).json({
        success: true,
        data: { count },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get connected business units
   * GET /realtime/business-units
   */
  async getConnectedBusinessUnits(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnits = realtimeService.getConnectedBusinessUnits();

      // Get business unit details from database
      const details = await prisma.businessUnit.findMany({
        where: {
          id: { in: businessUnits },
        },
        select: {
          id: true,
          name: true,
          code: true,
          isActive: true,
        },
      });

      res.status(200).json({
        success: true,
        data: details,
        count: details.length,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Emit custom event
   * POST /realtime/emit
   */
  async emitEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = emitEventSchema.parse(req.body);

      // Map event type to appropriate emit method
      const eventHandlers: Record<string, (payload: any, businessUnitId: string) => void> = {
        'SALE_CREATED': realtimeService.emitSaleCreated.bind(realtimeService),
        'SALE_UPDATED': realtimeService.emitSaleUpdated.bind(realtimeService),
        'SALE_REFUNDED': realtimeService.emitSaleRefunded.bind(realtimeService),
        'SALE_CANCELLED': realtimeService.emitSaleCancelled.bind(realtimeService),
        'SALE_VOIDED': realtimeService.emitSaleVoided.bind(realtimeService),
        'INVENTORY_UPDATED': realtimeService.emitInventoryUpdated.bind(realtimeService),
        'INVENTORY_SYNCED': realtimeService.emitInventorySynced.bind(realtimeService),
        'PRODUCT_UPDATED': realtimeService.emitProductUpdated.bind(realtimeService),
        'PRODUCT_CREATED': realtimeService.emitProductCreated.bind(realtimeService),
        'PRODUCT_DELETED': realtimeService.emitProductDeleted.bind(realtimeService),
        'CUSTOMER_UPDATED': realtimeService.emitCustomerUpdated.bind(realtimeService),
        'SUPPLIER_UPDATED': realtimeService.emitSupplierUpdated.bind(realtimeService),
        'CART_UPDATED': realtimeService.emitCartUpdated.bind(realtimeService),
        'SHIFT_STARTED': realtimeService.emitShiftStarted.bind(realtimeService),
        'SHIFT_ENDED': realtimeService.emitShiftEnded.bind(realtimeService),
        'PURCHASE_ORDER_CREATED': realtimeService.emitPurchaseOrderCreated.bind(realtimeService),
        'PURCHASE_ORDER_RECEIVED': realtimeService.emitPurchaseOrderReceived.bind(realtimeService),
        'LOW_STOCK_ALERT': realtimeService.emitLowStockAlert.bind(realtimeService),
        'OUT_OF_STOCK_ALERT': realtimeService.emitOutOfStockAlert.bind(realtimeService),
        'CASH_REGISTER_UPDATED': realtimeService.emitCashRegisterUpdated.bind(realtimeService),
        'NOTIFICATION': realtimeService.emitNotification.bind(realtimeService),
        'RETURN_CREATED': realtimeService.emitReturnCreated.bind(realtimeService),
        'RETURN_UPDATED': realtimeService.emitReturnUpdated.bind(realtimeService),
        'RETURN_PROCESSED': realtimeService.emitReturnProcessed.bind(realtimeService),
        'RETURN_APPROVED': realtimeService.emitReturnApproved.bind(realtimeService),
        'RETURN_REJECTED': realtimeService.emitReturnRejected.bind(realtimeService),
        'REFUND_CREATED': realtimeService.emitRefundCreated.bind(realtimeService),
        'REFUND_UPDATED': realtimeService.emitRefundUpdated.bind(realtimeService),
        'REFUND_PROCESSED': realtimeService.emitRefundProcessed.bind(realtimeService),
        'REFUND_COMPLETED': realtimeService.emitRefundCompleted.bind(realtimeService),
        'INVOICE_CREATED': realtimeService.emitInvoiceCreated.bind(realtimeService),
        'INVOICE_UPDATED': realtimeService.emitInvoiceUpdated.bind(realtimeService),
        'INVOICE_SENT': realtimeService.emitInvoiceSent.bind(realtimeService),
        'INVOICE_PAID': realtimeService.emitInvoicePaid.bind(realtimeService),
        'INVOICE_VOIDED': realtimeService.emitInvoiceVoided.bind(realtimeService),
        'INVOICE_CANCELLED': realtimeService.emitInvoiceCancelled.bind(realtimeService),
        'RECEIPT_ISSUED': realtimeService.emitReceiptIssued.bind(realtimeService),
        'RECEIPT_PRINTED': realtimeService.emitReceiptPrinted.bind(realtimeService),
        'RECEIPT_EMAILED': realtimeService.emitReceiptEmailed.bind(realtimeService),
        'EXPORT_COMPLETED': realtimeService.emitExportCompleted.bind(realtimeService),
        'EXPORT_FAILED': realtimeService.emitExportFailed.bind(realtimeService),
        'DASHBOARD_UPDATE': realtimeService.emitDashboardUpdate.bind(realtimeService),
      };

      const handler = eventHandlers[validatedData.eventType];
      if (!handler) {
        throw new AppError(`Unsupported event type: ${validatedData.eventType}`, 400);
      }

      // Special handling for PRODUCT_DELETED which takes productId as payload
      if (validatedData.eventType === 'PRODUCT_DELETED') {
        realtimeService.emitProductDeleted(
          validatedData.payload?.id || validatedData.payload,
          validatedData.businessUnitId
        );
      } else {
        handler(validatedData.payload, validatedData.businessUnitId);
      }

      // Log the event
      logger.info(`Event emitted: ${validatedData.eventType} for BU: ${validatedData.businessUnitId}`);

      res.status(200).json({
        success: true,
        message: `Event ${validatedData.eventType} emitted successfully`,
        data: {
          eventType: validatedData.eventType,
          businessUnitId: validatedData.businessUnitId,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * Broadcast custom event
   * POST /realtime/broadcast
   */
  async broadcastEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId, eventType, payload } = broadcastSchema.parse(req.body);

      // Create custom event
      const event: RealtimeEvent = {
        type: eventType as any,
        payload,
        businessUnitId,
        timestamp: new Date(),
      };

      // Access private broadcast method through any cast
      (realtimeService as any).broadcast(event);

      res.status(200).json({
        success: true,
        message: 'Event broadcasted successfully',
        data: event,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * Emit sale created event
   * POST /realtime/sale/created
   */
  async emitSaleCreated(req: Request, res: Response, next: NextFunction) {
    try {
      const { sale, businessUnitId } = req.body;

      if (!sale || !businessUnitId) {
        throw new AppError('Sale and businessUnitId are required', 400);
      }

      realtimeService.emitSaleCreated(sale, businessUnitId);

      res.status(200).json({
        success: true,
        message: 'Sale created event emitted',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Emit inventory updated event
   * POST /realtime/inventory/updated
   */
  async emitInventoryUpdated(req: Request, res: Response, next: NextFunction) {
    try {
      const { inventory, businessUnitId } = req.body;

      if (!inventory || !businessUnitId) {
        throw new AppError('Inventory and businessUnitId are required', 400);
      }

      realtimeService.emitInventoryUpdated(inventory, businessUnitId);

      res.status(200).json({
        success: true,
        message: 'Inventory updated event emitted',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Emit low stock alert event
   * POST /realtime/inventory/low-stock
   */
  async emitLowStockAlert(req: Request, res: Response, next: NextFunction) {
    try {
      const { product, businessUnitId } = req.body;

      if (!product || !businessUnitId) {
        throw new AppError('Product and businessUnitId are required', 400);
      }

      realtimeService.emitLowStockAlert(product, businessUnitId);

      res.status(200).json({
        success: true,
        message: 'Low stock alert emitted',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Emit notification event
   * POST /realtime/notification
   */
  async emitNotification(req: Request, res: Response, next: NextFunction) {
    try {
      const { notification, businessUnitId } = req.body;

      if (!notification || !businessUnitId) {
        throw new AppError('Notification and businessUnitId are required', 400);
      }

      realtimeService.emitNotification(notification, businessUnitId);

      res.status(200).json({
        success: true,
        message: 'Notification event emitted',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Emit dashboard update event
   * POST /realtime/dashboard/update
   */
  async emitDashboardUpdate(req: Request, res: Response, next: NextFunction) {
    try {
      const { data, businessUnitId } = req.body;

      if (!data || !businessUnitId) {
        throw new AppError('Data and businessUnitId are required', 400);
      }

      realtimeService.emitDashboardUpdate(data, businessUnitId);

      res.status(200).json({
        success: true,
        message: 'Dashboard update event emitted',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get realtime statistics
   * GET /realtime/stats
   */
  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = req.query;

      const stats = {
        totalClients: realtimeService.getClientCount(),
        businessUnitClients: businessUnitId 
          ? realtimeService.getClientCount(businessUnitId as string) 
          : undefined,
        connectedBusinessUnits: realtimeService.getConnectedBusinessUnits(),
        eventHistorySize: realtimeService.getEventHistory(1000).length,
        recentEvents: realtimeService.getEventHistory(10, businessUnitId as string),
        timestamp: new Date(),
        uptime: process.uptime(),
        memory: {
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
        },
      };

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Subscribe to events (SSE endpoint)
   * GET /realtime/subscribe
   */
  async subscribe(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = req.query;

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      // Send initial connection message
      res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date() })}\n\n`);

      // Subscribe to events
      const unsubscribe = realtimeService.subscribe(
        businessUnitId as string,
        (event: RealtimeEvent) => {
          try {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
          } catch (error) {
            logger.error('Error sending SSE event:', error);
          }
        }
      );

      // Handle client disconnect
      req.on('close', () => {
        unsubscribe();
        logger.info(`SSE client disconnected for BU: ${businessUnitId || 'all'}`);
      });

      // Keep connection alive
      const heartbeat = setInterval(() => {
        res.write(`: heartbeat ${Date.now()}\n\n`);
      }, 30000);

      req.on('close', () => {
        clearInterval(heartbeat);
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get supported event types
   * GET /realtime/event-types
   */
  async getEventTypes(req: Request, res: Response, next: NextFunction) {
    try {
      const eventTypes = [
        // Sales
        'SALE_CREATED', 'SALE_UPDATED', 'SALE_REFUNDED', 'SALE_CANCELLED', 'SALE_VOIDED',
        // Inventory
        'INVENTORY_UPDATED', 'INVENTORY_SYNCED', 'LOW_STOCK_ALERT', 'OUT_OF_STOCK_ALERT',
        // Products
        'PRODUCT_UPDATED', 'PRODUCT_CREATED', 'PRODUCT_DELETED',
        // Customer & Supplier
        'CUSTOMER_UPDATED', 'SUPPLIER_UPDATED',
        // Cart
        'CART_UPDATED',
        // Shifts
        'SHIFT_STARTED', 'SHIFT_ENDED',
        // Purchase Orders
        'PURCHASE_ORDER_CREATED', 'PURCHASE_ORDER_RECEIVED',
        // Cash Register
        'CASH_REGISTER_UPDATED',
        // Notifications
        'NOTIFICATION',
        // Returns
        'RETURN_CREATED', 'RETURN_UPDATED', 'RETURN_PROCESSED', 'RETURN_APPROVED', 'RETURN_REJECTED',
        // Refunds
        'REFUND_CREATED', 'REFUND_UPDATED', 'REFUND_PROCESSED', 'REFUND_COMPLETED',
        // Invoices
        'INVOICE_CREATED', 'INVOICE_UPDATED', 'INVOICE_SENT', 'INVOICE_PAID', 'INVOICE_VOIDED', 'INVOICE_CANCELLED',
        // Receipts
        'RECEIPT_ISSUED', 'RECEIPT_PRINTED', 'RECEIPT_EMAILED',
        // Exports
        'EXPORT_COMPLETED', 'EXPORT_FAILED',
        // Dashboard
        'DASHBOARD_UPDATE',
      ];

      // Group by category
      const groupedEvents = {
        sales: eventTypes.filter(e => e.startsWith('SALE')),
        inventory: eventTypes.filter(e => e.startsWith('INVENTORY') || e.includes('STOCK')),
        products: eventTypes.filter(e => e.startsWith('PRODUCT')),
        customers: eventTypes.filter(e => e.startsWith('CUSTOMER')),
        suppliers: eventTypes.filter(e => e.startsWith('SUPPLIER')),
        cart: eventTypes.filter(e => e.startsWith('CART')),
        shifts: eventTypes.filter(e => e.startsWith('SHIFT')),
        purchaseOrders: eventTypes.filter(e => e.startsWith('PURCHASE_ORDER')),
        cashRegister: eventTypes.filter(e => e.startsWith('CASH_REGISTER')),
        notifications: eventTypes.filter(e => e.startsWith('NOTIFICATION')),
        returns: eventTypes.filter(e => e.startsWith('RETURN')),
        refunds: eventTypes.filter(e => e.startsWith('REFUND')),
        invoices: eventTypes.filter(e => e.startsWith('INVOICE')),
        receipts: eventTypes.filter(e => e.startsWith('RECEIPT')),
        exports: eventTypes.filter(e => e.startsWith('EXPORT')),
        dashboard: eventTypes.filter(e => e.startsWith('DASHBOARD')),
      };

      res.status(200).json({
        success: true,
        data: {
          total: eventTypes.length,
          grouped: groupedEvents,
        },
      });
    } catch (error) {
      next(error);
    }
  },
};
