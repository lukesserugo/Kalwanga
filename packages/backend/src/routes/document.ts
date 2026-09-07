// src/routes/documentRoutes.ts
import { Router } from 'express';
import { documentController } from '../controllers/documentController.ts';

const router = Router();

// Invoice
router.post('/invoice', documentController.generateInvoice);
router.get('/invoice/:saleId', documentController.viewInvoice);

// Financial reports
router.post('/financial-report', documentController.generateFinancialReport);

// Entity reports
router.post('/reports/sales', documentController.generateSalesReport);
router.post('/reports/inventory', documentController.generateInventoryReport);
router.post('/reports/customers', documentController.generateCustomerReport);
router.post('/reports/products', documentController.generateProductReport);
router.post('/reports/employees', documentController.generateEmployeeReport);
router.post('/reports/payments', documentController.generatePaymentReport);
router.post('/reports/comprehensive', documentController.generateComprehensiveReport);

// Document management
router.get('/', documentController.listDocuments);
router.get('/download/:fileName', documentController.downloadDocument);
router.delete('/:fileName', documentController.deleteDocument);

export default router;
