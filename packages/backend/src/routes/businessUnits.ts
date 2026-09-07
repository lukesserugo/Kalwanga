// D:\Projects\Kalwanga\packages\backend\src\routes\businessUnits.ts

import { Router, Request, Response, NextFunction } from 'express';
import { businessUnitController } from '../controllers/businessUnitController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Debug logging
console.log('🔄 Loading businessUnits routes...');

// ============================================
// DEBUG ROUTE (No Auth - For Testing)
// ============================================

/**
 * Test route to verify the router is working
 * GET /business-units/test
 */
router.get('/test', (req: Request, res: Response) => {
  console.log('📤 Test route hit!');
  res.json({
    success: true,
    message: 'Business units route is working!',
    timestamp: new Date().toISOString(),
    routes: [
      'GET /business-units/test',
      'GET /business-units',
      'GET /business-units/:id',
      'GET /business-units/:id/stats',
      'GET /business-units/:id/users',
      'GET /business-units/:id/details',
      'GET /business-units/company/:companyId',
      'GET /business-units/default/:companyId',
      'GET /business-units/code/:code',
      'POST /business-units',
      'POST /business-units/bulk-delete',
      'POST /business-units/ensure',
      'POST /business-units/:id/users',
      'PUT /business-units/:id',
      'DELETE /business-units/:id/users/:userId',
      'DELETE /business-units/:id',
    ],
  });
});

// ============================================
// GET ROUTES
// ============================================

/**
 * Get all business units
 * GET /business-units
 */
router.get('/', requireAuth, businessUnitController.getAllBusinessUnits);
console.log('✅ GET / registered');

/**
 * Get business units by company
 * GET /business-units/company/:companyId
 * NOTE: Must be BEFORE /:id route
 */
router.get('/company/:companyId', requireAuth, businessUnitController.getBusinessUnitsByCompany);
console.log('✅ GET /company/:companyId registered');

/**
 * Get default business unit for a company
 * GET /business-units/default/:companyId
 * NOTE: Must be BEFORE /:id route
 */
router.get('/default/:companyId', requireAuth, businessUnitController.getOrCreateDefaultBusinessUnit);
console.log('✅ GET /default/:companyId registered');

/**
 * Get business unit by code
 * GET /business-units/code/:code
 * NOTE: Must be BEFORE /:id route
 */
router.get('/code/:code', requireAuth, businessUnitController.getBusinessUnitByCode);
console.log('✅ GET /code/:code registered');

/**
 * Get business unit statistics
 * GET /business-units/:id/stats
 * NOTE: Must be BEFORE /:id route
 */
router.get('/:id/stats', requireAuth, businessUnitController.getBusinessUnitStats);
console.log('✅ GET /:id/stats registered');

/**
 * Get business unit users
 * GET /business-units/:id/users
 * NOTE: Must be BEFORE /:id route
 */
router.get('/:id/users', requireAuth, businessUnitController.getBusinessUnitUsers);
console.log('✅ GET /:id/users registered');

/**
 * Get business unit with full details
 * GET /business-units/:id/details
 * NOTE: Must be BEFORE /:id route
 */
router.get('/:id/details', requireAuth, businessUnitController.getBusinessUnitWithDetails);
console.log('✅ GET /:id/details registered');

/**
 * Get business unit by ID
 * GET /business-units/:id
 * NOTE: Must be LAST among GET routes
 */
router.get('/:id', requireAuth, businessUnitController.getBusinessUnitById);
console.log('✅ GET /:id registered');

// ============================================
// POST ROUTES
// ============================================

/**
 * Create business unit
 * POST /business-units
 * TEMPORARILY removed requireRole for debugging
 */
router.post('/', requireAuth, businessUnitController.createBusinessUnit);
console.log('✅ POST / registered');

/**
 * Bulk delete business units
 * POST /business-units/bulk-delete
 * NOTE: Must be BEFORE /:id/users route
 */
router.post('/bulk-delete', requireAuth, businessUnitController.bulkDeleteBusinessUnits);
console.log('✅ POST /bulk-delete registered');

/**
 * Ensure user has a business unit
 * POST /business-units/ensure
 * NOTE: Must be BEFORE /:id/users route
 */
router.post('/ensure', requireAuth, businessUnitController.ensureUserBusinessUnit);
console.log('✅ POST /ensure registered');

/**
 * Add user to business unit
 * POST /business-units/:id/users
 * NOTE: Must be AFTER /bulk-delete and /ensure routes
 */
router.post('/:id/users', requireAuth, businessUnitController.addUserToBusinessUnit);
console.log('✅ POST /:id/users registered');

// ============================================
// PUT ROUTES
// ============================================

/**
 * Update business unit
 * PUT /business-units/:id
 */
router.put('/:id', requireAuth, businessUnitController.updateBusinessUnit);
console.log('✅ PUT /:id registered');

// ============================================
// DELETE ROUTES
// ============================================

/**
 * Remove user from business unit
 * DELETE /business-units/:id/users/:userId
 * NOTE: Must be BEFORE /:id route
 */
router.delete('/:id/users/:userId', requireAuth, businessUnitController.removeUserFromBusinessUnit);
console.log('✅ DELETE /:id/users/:userId registered');

/**
 * Delete business unit
 * DELETE /business-units/:id
 * NOTE: Must be LAST among DELETE routes
 */
router.delete('/:id', requireAuth, businessUnitController.deleteBusinessUnit);
console.log('✅ DELETE /:id registered');

console.log('✅ All business unit routes registered successfully');

export default router;
