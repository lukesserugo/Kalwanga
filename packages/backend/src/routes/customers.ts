// packages/backend/src/routes/customers.ts
import { Router } from 'express';
import { customerController } from '../controllers/customerController.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = Router();

// ✅ Apply auth to ALL customer routes
router.use(authMiddleware);

// ── Read routes (any authenticated user with customer:view) ──
router.get('/', customerController.getAllCustomers);

// ⚠️ IMPORTANT: `/search` MUST come before `/:id`, otherwise Express
// treats "search" as an id. Add it here if you have a search endpoint:
// router.get('/search', customerController.searchCustomers);

router.get('/:id', customerController.getCustomerById);
router.get('/:id/stats', customerController.getCustomerStats);
router.get('/:id/purchases', customerController.getCustomerPurchaseHistory);

// ── Write routes (restricted by role) ──
router.post(
  '/',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER']),
  customerController.createCustomer
);

router.put(
  '/:id',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER']),
  customerController.updateCustomer
);

router.delete(
  '/:id',
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  customerController.deleteCustomer
);

// ── Loyalty routes ──
// ⚠️ These paths must match the backend controller AND the frontend service.
// Backend controller exposes: /:id/loyalty-points/add  and  /:id/loyalty-points/redeem
router.post(
  '/:id/loyalty-points/add',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER']),
  customerController.addLoyaltyPoints
);

router.post(
  '/:id/loyalty-points/redeem',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER']),
  customerController.redeemLoyaltyPoints
);

export default router;
