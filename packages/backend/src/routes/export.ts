// src/routes/exportRoutes.ts
import { Router } from 'express';
import { exportController } from '../controllers/exportController.ts';

const router = Router();

// Export endpoints
router.post('/sales', exportController.exportSales);
router.get('/sales', exportController.exportSalesGet);
router.post('/inventory', exportController.exportInventory);
router.post('/customers', exportController.exportCustomers);
router.post('/products', exportController.exportProducts);
router.post('/suppliers', exportController.exportSuppliers);
router.post('/payments', exportController.exportPayments);
router.post('/purchase-orders', exportController.exportPurchaseOrders);

// History and file management
router.get('/history', exportController.getExportHistory);
router.get('/download/:fileName', exportController.downloadExport);
router.delete('/:fileName', exportController.deleteExport);

export default router;
