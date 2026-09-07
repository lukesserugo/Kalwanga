import { Router } from 'express';
import { dashboardController } from '../controllers/dashboardController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/stats', dashboardController.getStats);
router.get('/realtime', dashboardController.getRealtimeData);
router.get('/live', dashboardController.getLiveDashboard);

export default router;
