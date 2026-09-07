// D:\Projects\Kalwanga\packages\backend\src\routes\reports.ts

import { Router } from 'express';
import { reportController } from '../controllers/reportController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
// Fix: Import UserRole from the correct path
import { UserRole } from '../generated/prisma/index.js';

const router = Router();

// All report routes require authentication
router.use(requireAuth);

// Report roles
const reportRoles = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER];

// ============================================
// GET endpoints - Report Retrieval
// ============================================

// List all reports
router.get('/', requireRole(reportRoles), reportController.listReports);

// Get report by ID
router.get('/:id', requireRole(reportRoles), reportController.getReportById);

// ============================================
// GET endpoints - Report Generation
// ============================================

// Generate sales report
router.get('/sales', requireRole(reportRoles), reportController.generateSalesReport);

// Generate inventory report
router.get('/inventory', requireRole(reportRoles), reportController.generateInventoryReport);

// Generate customer report
router.get('/customers', requireRole(reportRoles), reportController.generateCustomerReport);

// Generate product report
router.get('/products', requireRole(reportRoles), reportController.generateProductReport);

// Generate employee report
router.get('/employees', requireRole(reportRoles), reportController.generateEmployeeReport);

// Generate payment report
router.get('/payments', requireRole(reportRoles), reportController.generatePaymentReport);

// Generate comprehensive report
router.get('/comprehensive', requireRole(reportRoles), reportController.generateComprehensiveReport);

// Generate tax filing
router.get('/tax-filing', requireRole(reportRoles), reportController.generateTaxFiling);

// Generate financial report
router.get('/financial', requireRole(reportRoles), reportController.generateFinancialReport);

// Generate balance sheet
router.get('/balance-sheet', requireRole(reportRoles), reportController.generateBalanceSheet);

// Generate trial balance
router.get('/trial-balance', requireRole(reportRoles), reportController.generateTrialBalance);

// ============================================
// GET endpoints - Summary & Analytics
// ============================================

// Get report summary
router.get('/summary', requireRole(reportRoles), reportController.getReportSummary);

// Get dashboard summary
router.get('/dashboard-summary', requireRole(reportRoles), reportController.getDashboardSummary);

// ============================================
// GET endpoints - Report Export
// ============================================

// Export sales report
router.get('/export/sales', requireRole(reportRoles), reportController.exportSalesReport);

// Export inventory report
router.get('/export/inventory', requireRole(reportRoles), reportController.exportInventoryReport);

// Export customer report
router.get('/export/customers', requireRole(reportRoles), reportController.exportCustomerReport);

// Download report file
router.get('/download/:id', requireRole(reportRoles), reportController.downloadReport);

// ============================================
// POST endpoints - Report Generation
// ============================================

// Generate report (POST)
router.post('/generate', requireRole(reportRoles), reportController.generateReport);

// ============================================
// DELETE endpoints - Report Management
// ============================================

// Delete report
router.delete(
  '/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  reportController.deleteReport
);

export default router;
