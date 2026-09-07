// D:\Projects\Kalwanga\packages\backend\src\routes\userImport.ts

import { Router, Request, Response, NextFunction } from 'express';
import { userImportController } from '../controllers/userImportController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
// Fix: Import UserRole from the correct path
import { UserRole } from '../generated/prisma/index.js';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

// ============================================
// MULTER CONFIGURATION
// ============================================

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req: any, file: any, cb: any) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'imports');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req: any, file: any, cb: any) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (req: any, file: any, cb: any) => {
    const allowedExtensions = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Only CSV, XLSX, and XLS files are allowed.'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// ============================================
// USER IMPORT ROUTES
// ============================================

// All user import routes require authentication
router.use(requireAuth);

// ============================================
// POST ROUTES (Admin/SuperAdmin only)
// ============================================

// Import users from file (Admin/SuperAdmin only)
router.post(
  '/import',
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  upload.single('file'),
  userImportController.importUsers
);

// Import users from CSV content (Admin/SuperAdmin only)
router.post(
  '/import/csv',
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userImportController.importUsersFromCSV
);

// Import users from JSON data (Admin/SuperAdmin only)
router.post(
  '/import/json',
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userImportController.importUsersFromJSON
);

// Validate import data without importing (Admin/SuperAdmin only)
router.post(
  '/import/validate',
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  upload.single('file'),
  userImportController.validateImportData
);

// ============================================
// GET ROUTES (Authenticated users)
// ============================================

// Get import template by ID (Authenticated users)
router.get(
  '/import/template/:templateId',
  userImportController.getImportTemplate
);

// Get all import templates (Authenticated users)
router.get(
  '/import/templates',
  userImportController.getImportTemplates
);

// Download import template (Authenticated users)
router.get(
  '/import/template/:templateId/download',
  userImportController.downloadImportTemplate
);

// ============================================
// GET ROUTES (Admin/SuperAdmin only)
// ============================================

// Get import history (Admin/SuperAdmin only)
router.get(
  '/import/history',
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userImportController.getImportHistory
);

// Get import history by ID (Admin/SuperAdmin only)
router.get(
  '/import/history/:importId',
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userImportController.getImportHistoryById
);

// Get import statistics (Admin/SuperAdmin only)
router.get(
  '/import/stats',
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userImportController.getImportStats
);

// ============================================
// DELETE ROUTES (Admin/SuperAdmin only)
// ============================================

// Delete import history entry (Admin/SuperAdmin only)
router.delete(
  '/import/history/:importId',
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userImportController.deleteImportHistory
);

// Clear all import history (SuperAdmin only)
router.delete(
  '/import/history',
  requireRole([UserRole.SUPER_ADMIN]),
  userImportController.clearImportHistory
);

export default router;
