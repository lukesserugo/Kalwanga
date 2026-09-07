// D:\Projects\Kalwanga\packages\backend\src\routes\backup.ts

import { Router } from 'express';
import { backupController } from '../controllers/backupController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
// Fix: Import UserRole from the correct path
import { UserRole } from '../generated/prisma/index.js';

const router = Router();

// All backup routes require authentication
router.use(requireAuth);

// ============================================
// GET endpoints - Backup Retrieval
// ============================================

// List all backups
router.get(
  '/list',
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  backupController.listBackups
);

// Get backup status
router.get(
  '/status',
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  backupController.getBackupStatus
);

// Download a backup file
router.get(
  '/:fileName/download',
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  backupController.downloadBackup
);

// ============================================
// POST endpoints - Backup Creation
// ============================================

// Create a new backup
router.post(
  '/create',
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  backupController.createBackup
);

// Export all data
router.post(
  '/export',
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  backupController.exportData
);

// Restore from backup
router.post(
  '/:fileName/restore',
  requireRole([UserRole.SUPER_ADMIN]),
  backupController.restoreBackup
);

// Trigger automatic backup scheduling
router.post(
  '/schedule',
  requireRole([UserRole.SUPER_ADMIN]),
  backupController.scheduleBackups
);

// ============================================
// DELETE endpoints - Backup Removal
// ============================================

// Delete a backup
router.delete(
  '/:fileName',
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  backupController.deleteBackup
);

export default router;
