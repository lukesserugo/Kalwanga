import { Router } from 'express';
import { healthController } from '../controllers/healthController.js';

const router = Router();

// Public health check
router.get('/', healthController.getHealth);
router.get('/detailed', healthController.getDetailedHealth);
router.get('/database', healthController.getDatabaseStatus);

export default router;
