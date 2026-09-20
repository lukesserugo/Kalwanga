// src/routes/onboarding.ts

import { Router } from 'express';
import { onboardingController } from '../controllers/onboardingController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// ============================================
// AUTH — every route under /onboarding requires
// an authenticated user.
// ============================================

router.use(requireAuth);

// ============================================
// READ ENDPOINTS
// ============================================

router.get('/status', onboardingController.getStatus);
router.get('/next', onboardingController.getNext);
router.get('/check', onboardingController.checkRoute);

// ============================================
// WRITE ENDPOINTS
// ============================================

router.post('/paginate', onboardingController.paginate);
router.post('/mark-complete', onboardingController.markStepComplete);
router.post('/skip', onboardingController.skipStep);

router.post(
  '/reset',
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  onboardingController.resetProgress
);

export default router;
