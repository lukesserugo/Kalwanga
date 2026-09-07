import { Router } from 'express';
import { customerController } from '../controllers/customerController.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', customerController.getAllCustomers);
router.get('/:id', customerController.getCustomerById);
router.get('/:id/stats', customerController.getCustomerStats);

router.post('/', requireRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), customerController.createCustomer);
router.put('/:id', requireRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), customerController.updateCustomer);
router.delete('/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), customerController.deleteCustomer);

router.post('/:id/loyalty/add', requireRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), customerController.addLoyaltyPoints);
router.post('/:id/loyalty/redeem', requireRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), customerController.redeemLoyaltyPoints);

export default router;
