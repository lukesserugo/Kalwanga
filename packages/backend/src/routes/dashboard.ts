// src/routes/dashboardRoutes.ts
import { Router } from 'express';
import { dashboardController } from '../controllers/dashboardController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Every dashboard route requires a logged-in user.
router.use(requireAuth);

// ── Core ───────────────────────────────────────────────────────────────
router.get('/stats', dashboardController.getStats);
router.get('/realtime', dashboardController.getRealtimeData);
router.get('/live', dashboardController.getLiveDashboard);

// ── Widgets ────────────────────────────────────────────────────────────
router.get('/activity', dashboardController.getActivity);
router.get('/trends', dashboardController.getTrends);
router.get('/top-products', dashboardController.getTopProducts);
router.get('/low-stock', dashboardController.getLowStockAlerts);

// ── Reporting ─────────────────────────────────────────────────────────
router.get('/sales-summary', dashboardController.getSalesSummary);

export default router;
