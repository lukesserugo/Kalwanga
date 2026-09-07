// src/routes/realtimeRoutes.ts
import { Router } from 'express';
import { realtimeController } from '../controllers/realtimeController.ts';

const router = Router();

// Status and monitoring
router.get('/status', realtimeController.getStatus);
router.get('/stats', realtimeController.getStats);
router.get('/event-types', realtimeController.getEventTypes);
router.get('/clients/count', realtimeController.getClientCount);
router.get('/business-units', realtimeController.getConnectedBusinessUnits);

// Event history
router.get('/history', realtimeController.getEventHistory);
router.delete('/history', realtimeController.clearHistory);

// Event emission
router.post('/emit', realtimeController.emitEvent);
router.post('/broadcast', realtimeController.broadcastEvent);

// Specific events
router.post('/sale/created', realtimeController.emitSaleCreated);
router.post('/inventory/updated', realtimeController.emitInventoryUpdated);
router.post('/inventory/low-stock', realtimeController.emitLowStockAlert);
router.post('/notification', realtimeController.emitNotification);
router.post('/dashboard/update', realtimeController.emitDashboardUpdate);

// SSE subscription
router.get('/subscribe', realtimeController.subscribe);

export default router;
