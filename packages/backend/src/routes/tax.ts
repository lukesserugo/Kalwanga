import { Router } from 'express';
import { taxController } from '../controllers/taxController.ts';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UserRole } from '../generated/prisma/enums.js';

const router = Router();
router.use(requireAuth);

// Tax summary and records
router.get('/summary', taxController.getTaxSummary);
router.get('/records', taxController.getTaxRecords);
router.get('/filing-status', taxController.getFilingStatus);

// Tax filing
router.post('/file', taxController.fileTaxReturn);

// Tax settings
router.get('/settings', taxController.getTaxSettings);
router.put('/settings', taxController.updateTaxSettings);

// Tax calculation
router.post('/calculate', taxController.calculateTax);
router.post('/record/:saleId', taxController.recordSaleTax);

// Tax report and export
router.get('/report', taxController.generateTaxReport);
router.get('/export', taxController.exportTaxRecords);

export default router;

