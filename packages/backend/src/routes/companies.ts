// D:\Projects\Kalwanga\packages\backend\src\routes\companies.ts

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
 * GET /companies/:id
 * Get company by ID
 * Access: Authenticated users
 */
router.get('/:id', requireAuth, companyController.getCompanyById);

/**
 * GET /companies/email/:email
 * Get company by email
 * Access: Authenticated users
 */
router.get('/email/:email', requireAuth, companyController.getCompanyByEmail);

/**
 * GET /companies/default
 * Get or create default company
 * Access: Authenticated users
 */
router.get('/default', requireAuth, companyController.getOrCreateDefaultCompany);

/**
 * GET /companies/:id/stats
 * Get company statistics
 * Access: Authenticated users
 */
router.get('/:id/stats', requireAuth, companyController.getCompanyStats);

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
 * POST /companies/ensure-user
 * Ensure a user has a company
 * Access: ADMIN, SUPER_ADMIN
 */
router.post(
  '/ensure-user',
  requireAuth,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  companyController.ensureUserCompany
);

export default router;
