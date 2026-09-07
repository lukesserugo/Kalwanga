// src/routes/reorderRoutes.ts
import { Router } from 'express';
import { reorderController } from '../controllers/reorderController.ts';

const router = Router();

// Reorder checks
router.post('/check', reorderController.checkAndCreateReorderOrders);

// Inventory monitor
router.post('/monitor/start', reorderController.startInventoryMonitor);
router.post('/monitor/stop', reorderController.stopInventoryMonitor);
router.get('/monitor/status', reorderController.getMonitorStatus);

// Stock status
router.get('/low-stock', reorderController.getLowStockItems);
router.get('/out-of-stock', reorderController.getOutOfStockItems);

// Recommendations
router.get('/recommendations', reorderController.getReorderRecommendations);

// Manual reorder
router.post('/create', reorderController.createReorderOrder);

// History and stats
router.get('/history', reorderController.getReorderHistory);
router.get('/stats', reorderController.getReorderStats);

export default router;
