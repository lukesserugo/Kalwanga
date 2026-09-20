import { Router } from 'express';
import { companyController } from '../controllers/companyController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// ============================================
// PUBLIC ROUTES (Authentication required)
// ============================================

/**
 * GET /companies
 * Get all companies with pagination
 * Access: Authenticated users
 */
router.get('/', requireAuth, companyController.getAllCompanies);

/**
 * GET /companies/default
 * Get or create default company
 * Access: Authenticated users
 * IMPORTANT: Must be defined BEFORE /:id
 */
router.get('/default', requireAuth, companyController.getOrCreateDefaultCompany);

/**
 * GET /companies/search
 * Search companies
 * Access: Authenticated users
 * IMPORTANT: Must be defined BEFORE /:id
 */
router.get('/search', requireAuth, companyController.searchCompanies);

/**
 * GET /companies/reports
 * Aggregate reports across companies
 * Access: Authenticated users
 * IMPORTANT: Must be defined BEFORE /:id
 */
router.get('/reports', requireAuth, companyController.getCompanyReports);

/**
 * GET /companies/email/:email
 * Get company by email
 * Access: Authenticated users
 * IMPORTANT: Must be defined BEFORE /:id
 */
router.get('/email/:email', requireAuth, companyController.getCompanyByEmail);

/**
 * GET /companies/by-business-unit/:businessUnitId
 * Get company by business unit ID
 * Access: Authenticated users
 * IMPORTANT: Must be defined BEFORE /:id
 */
router.get(
  '/by-business-unit/:businessUnitId',
  requireAuth,
  companyController.getCompanyByBusinessUnitId
);

/**
 * POST /companies/ensure-user
 * Ensure a user has a company
 * Access: ADMIN, SUPER_ADMIN
 * IMPORTANT: Must be defined BEFORE /:id routes
 */
router.post(
  '/ensure-user',
  requireAuth,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  companyController.ensureUserCompany
);

/**
 * GET /companies/:id/stats
 * Get company statistics
 * Access: Authenticated users
 */
router.get('/:id/stats', requireAuth, companyController.getCompanyStats);

/**
 * GET /companies/:id/settings
 * Get company settings
 * Access: Authenticated users
 */
router.get('/:id/settings', requireAuth, companyController.getCompanySettings);

/**
 * PUT /companies/:id/settings
 * Update company settings
 * Access: ADMIN, SUPER_ADMIN
 */
router.put(
  '/:id/settings',
  requireAuth,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  companyController.updateCompanySettings
);

/**
 * GET /companies/:id/default-business-unit
 * Get default business unit for a company
 * Access: Authenticated users
 */
router.get(
  '/:id/default-business-unit',
  requireAuth,
  companyController.getDefaultBusinessUnit
);

/**
 * GET /companies/:id/activity
 * Get company activity feed
 * Access: Authenticated users
 */
router.get('/:id/activity', requireAuth, companyController.getCompanyActivity);

/**
 * GET /companies/:id/export
 * Export company data
 * Access: Authenticated users
 */
router.get('/:id/export', requireAuth, companyController.exportCompanyData);

/**
 * GET /companies/:id
 * Get company by ID
 * Access: Authenticated users
 * IMPORTANT: Must be defined AFTER all specific routes
 */
router.get('/:id', requireAuth, companyController.getCompanyById);

// ============================================
// ADMIN ROUTES (Require ADMIN or SUPER_ADMIN)
// ============================================

/**
 * POST /companies
 * Create a new company
 * Access: ADMIN, SUPER_ADMIN
 */
router.post(
  '/',
  requireAuth,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  companyController.createCompany
);

/**
 * POST /companies/bulk
 * Bulk create companies
 * Access: SUPER_ADMIN only
 */
router.post(
  '/bulk',
  requireAuth,
  requireRole(['SUPER_ADMIN']),
  companyController.bulkCreateCompanies
);

/**
 * PUT /companies/:id
 * Update a company
 * Access: ADMIN, SUPER_ADMIN
 */
router.put(
  '/:id',
  requireAuth,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  companyController.updateCompany
);

/**
 * DELETE /companies/:id
 * Delete a company
 * Access: SUPER_ADMIN only
 */
router.delete(
  '/:id',
  requireAuth,
  requireRole(['SUPER_ADMIN']),
  companyController.deleteCompany
);

/**
 * POST /companies/:id/business-units
 * Add a business unit to a company
 * Access: ADMIN, SUPER_ADMIN
 */
router.post(
  '/:id/business-units',
  requireAuth,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  companyController.addBusinessUnit
);

export default router;
