import { Router } from 'express';
import { analyticsController } from '../controllers/analyticsController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/sales-trends', analyticsController.getSalesTrends);
router.get('/top-products', analyticsController.getTopProducts);
router.get('/customer-insights', analyticsController.getCustomerInsights);
router.get('/inventory-analytics', analyticsController.getInventoryAnalytics);
router.get('/dashboard', analyticsController.getDashboardAnalytics);

export default router;
