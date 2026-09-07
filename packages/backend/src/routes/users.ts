// D:\Projects\Kalwanga\packages\backend\src\routes\users.ts

import { Router } from 'express';
import { 
  userController,
  getUserActivityStats,
  getUserActivityTrends,
  getRecentUserActivity,
  getUserActivityById,
  exportUserActivity,
  exportUserAuditTrail,
  cancelInvitation,
  cancelInvitations,
  checkInvitationStatus,
  validateInvitationToken,
  getPendingInvitationsCount,
  sendInvitationReminder,
  clearExpiredInvitations,
  getInvitationTemplates,
  getInvitationTemplate,
  createInvitationTemplate,
  updateInvitationTemplate,
  deleteInvitationTemplate,
  getGroupById,
  getGroupByName,
  createGroups,
  deleteGroups,
  removeUsersFromGroup,
  getGroupMembers,
  updateMemberRole,
  setGroupLead,
  updateGroupPermissions,
  addGroupPermissions,
  removeGroupPermissions,
  getGroupStats,
  getGroupHierarchy,
  getChildGroups,
  getParentGroup,
  moveGroup,
  mergeGroups,
  duplicateGroup,
  activateGroup,
  deactivateGroup,
  archiveGroup,
  exportGroups,
  assignUsersToMultipleGroups
} from '../controllers/userController.js';

// Import the controllers as objects
import { userImportController } from '../controllers/userImportController.js';
import { userInvitationController } from '../controllers/userInvitationController.js';

import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { UserRole } from '../generated/prisma/index.js';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { 
  userSearchSchema
} from '../utils/validators.js';

const router = Router();

// ============================================
// MULTER CONFIGURATION FOR FILE UPLOADS
// ============================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'imports');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const fileFilter = (req: any, file: any, cb: any) => {
  const allowedExtensions = ['.csv', '.xlsx', '.xls'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file format. Only CSV, XLSX, and XLS files are allowed.'));
  }
};

const uploadSingle = (fieldName: string) => {
  return (req: any, res: any, next: any) => {
    const uploadMiddleware = upload.single(fieldName);
    uploadMiddleware(req, res, (err: any) => {
      if (err) return next(err);
      if (req.file) {
        fileFilter(req, req.file, (filterErr: any) => {
          if (filterErr) return next(filterErr);
          next();
        });
      } else {
        next();
      }
    });
  };
};

// ============================================
// USER LOOKUP ROUTES (Must come before /:id)
// ============================================

router.get(
  '/by-clerk/:clerkId',
  requireAuth,
  userController.getUserByClerkId
);

router.get(
  '/identifier/:identifier',
  requireAuth,
  userController.getUserByIdentifier
);

router.get(
  '/email/:email',
  requireAuth,
  userController.getUserByEmail
);

// ============================================
// STANDARD ROUTES
// ============================================

router.get(
  '/me',
  requireAuth,
  userController.getCurrentUser
);

router.get(
  '/',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userController.getAllUsers
);

router.get(
  '/stats',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userController.getUserStatistics
);

// ============================================
// IMPORT ROUTES (Must come before /:id)
// ============================================

router.post(
  '/import',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  uploadSingle('file'),
  userImportController.importUsers
);

router.post(
  '/import/csv',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userImportController.importUsersFromCSV
);

router.post(
  '/import/json',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userImportController.importUsersFromJSON
);

router.post(
  '/import/validate',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  uploadSingle('file'),
  userImportController.validateImportData
);

router.get(
  '/import/template/:templateId',
  requireAuth,
  userImportController.getImportTemplate
);

router.get(
  '/import/templates',
  requireAuth,
  userImportController.getImportTemplates
);

router.get(
  '/import/template/:templateId/download',
  requireAuth,
  userImportController.downloadImportTemplate
);

router.get(
  '/import/history',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userImportController.getImportHistory
);

router.get(
  '/import/history/:importId',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userImportController.getImportHistoryById
);

router.get(
  '/import/stats',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userImportController.getImportStats
);

router.delete(
  '/import/history/:importId',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userImportController.deleteImportHistory
);

router.delete(
  '/import/history',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN]),
  userImportController.clearImportHistory
);

// ============================================
// INVITATION ROUTES (Must come before /:id)
// ============================================

router.post(
  '/invite',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userController.inviteUser
);

router.post(
  '/invite/batch',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userInvitationController.inviteUsers
);

router.post(
  '/invite/:id/resend',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userController.resendInvitation
);

router.post(
  '/invite/:id/cancel',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  cancelInvitation
);

router.post(
  '/invite/accept/:token',
  userInvitationController.acceptInvitation
);

router.post(
  '/invite/decline/:token',
  userInvitationController.declineInvitation
);

router.get(
  '/invite/token/:token',
  userInvitationController.getInvitationByToken
);

router.get(
  '/invite/status/:token',
  checkInvitationStatus
);

router.post(
  '/invite/validate-token',
  validateInvitationToken
);

router.get(
  '/invite/:id',
  requireAuth,
  userInvitationController.getInvitationById
);

router.get(
  '/invitations',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userController.getInvitations
);

router.get(
  '/invitations/stats',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userInvitationController.getInvitationStats
);

router.get(
  '/invitations/pending/count',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  getPendingInvitationsCount
);

router.post(
  '/invite/:id/remind',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  sendInvitationReminder
);

router.delete(
  '/invite/:id',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userController.deleteInvitation
);

router.delete(
  '/invitations/expired',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN]),
  clearExpiredInvitations
);

router.get(
  '/invite/templates',
  requireAuth,
  getInvitationTemplates
);

router.get(
  '/invite/templates/:templateId',
  requireAuth,
  getInvitationTemplate
);

router.post(
  '/invite/templates',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  createInvitationTemplate
);

router.put(
  '/invite/templates/:templateId',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  updateInvitationTemplate
);

router.delete(
  '/invite/templates/:templateId',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  deleteInvitationTemplate
);

// ============================================
// GROUP ROUTES (Must come before /:id)
// ============================================

router.get(
  '/groups',
  requireAuth,
  userController.getGroups
);

router.post(
  '/groups',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userController.createGroup
);

router.post(
  '/groups/batch',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  createGroups
);

router.get(
  '/groups/stats',
  requireAuth,
  getGroupStats
);

router.get(
  '/groups/hierarchy',
  requireAuth,
  getGroupHierarchy
);

router.get(
  '/groups/export',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  exportGroups
);

router.post(
  '/groups/merge',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  mergeGroups
);

router.get(
  '/groups/:id',
  requireAuth,
  getGroupById
);

router.get(
  '/groups/by-name/:name',
  requireAuth,
  getGroupByName
);

router.put(
  '/groups/:id',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userController.updateGroup
);

router.delete(
  '/groups/:id',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userController.deleteGroup
);

router.post(
  '/groups/batch/delete',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  deleteGroups
);

router.post(
  '/groups/:id/users',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userController.assignUsersToGroup
);

router.post(
  '/groups/batch/assign-users',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  assignUsersToMultipleGroups
);

router.post(
  '/groups/:id/remove-users',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  removeUsersFromGroup
);

router.get(
  '/groups/:id/members',
  requireAuth,
  getGroupMembers
);

router.put(
  '/groups/:id/members/:userId/role',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  updateMemberRole
);

router.put(
  '/groups/:id/members/:userId/lead',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  setGroupLead
);

router.put(
  '/groups/:id/permissions',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  updateGroupPermissions
);

router.post(
  '/groups/:id/permissions/add',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  addGroupPermissions
);

router.post(
  '/groups/:id/permissions/remove',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  removeGroupPermissions
);

router.get(
  '/groups/:id/children',
  requireAuth,
  getChildGroups
);

router.get(
  '/groups/:id/parent',
  requireAuth,
  getParentGroup
);

router.put(
  '/groups/:id/move',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  moveGroup
);

router.post(
  '/groups/:id/duplicate',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  duplicateGroup
);

router.post(
  '/groups/:id/activate',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  activateGroup
);

router.post(
  '/groups/:id/deactivate',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  deactivateGroup
);

router.post(
  '/groups/:id/archive',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  archiveGroup
);

// ============================================
// USER CRUD ROUTES (Must come after all specific routes)
// ============================================

router.get(
  '/search',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userController.searchUsers
);

router.get(
  '/business/:businessUnitId',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER]),
  userController.getUsersByBusinessUnit
);

router.get(
  '/role/:role',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userController.getUsersByRole
);

router.get(
  '/export',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userController.exportUsers
);

// ✅ FIXED: Removed validateRequest middleware - controller handles validation
router.post(
  '/',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userController.createUser
);

// ✅ FIXED: Removed validateRequest middleware - controller handles validation
router.put(
  '/:id',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userController.updateUser
);

router.delete(
  '/:id',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userController.deleteUser
);

// ✅ FIXED: Removed validateRequest middleware - controller handles validation
router.patch(
  '/:id/role',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userController.updateUserRole
);

// ✅ FIXED: Removed validateRequest middleware - controller handles validation
router.patch(
  '/:id/permissions',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userController.updateUserPermissions
);

router.post(
  '/:id/activate',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userController.activateUser
);

router.post(
  '/:id/deactivate',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userController.deactivateUser
);

router.post(
  '/:userId/business/:businessUnitId',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER]),
  userController.assignBusinessUnit
);

router.delete(
  '/:userId/business/:businessUnitId',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER]),
  userController.removeBusinessUnit
);

// ============================================
// BULK OPERATIONS
// ============================================

// ✅ FIXED: Removed validateRequest middleware - controller handles validation
router.post(
  '/bulk/activate',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userController.bulkActivateUsers
);

// ✅ FIXED: Removed validateRequest middleware - controller handles validation
router.post(
  '/bulk/deactivate',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userController.bulkDeactivateUsers
);

// ✅ FIXED: Removed validateRequest middleware - controller handles validation
router.post(
  '/bulk/delete',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userController.bulkDeleteUsers
);

// ============================================
// PERMISSION ROUTES
// ============================================

router.get(
  '/:id/permissions',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userController.getUserPermissions
);

router.get(
  '/:id/permissions/:permission',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userController.checkUserPermission
);

// ============================================
// ACTIVITY ROUTES (Must come after /:id)
// ============================================

router.get(
  '/:id/activity',
  requireAuth,
  userController.getUserActivity
);

router.get(
  '/:id/activity/stats',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  getUserActivityStats
);

router.get(
  '/:id/activity/summary',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  getUserActivityStats
);

router.get(
  '/:id/activity/trends',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  getUserActivityTrends
);

router.get(
  '/:id/activity/recent',
  requireAuth,
  getRecentUserActivity
);

router.get(
  '/:id/activity/:activityId',
  requireAuth,
  getUserActivityById
);

router.get(
  '/:id/activity/export',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  exportUserActivity
);

router.delete(
  '/:id/activity',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userController.clearUserActivity
);

router.get(
  '/:id/audit-trail',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userController.getUserAuditTrail
);

router.get(
  '/:id/audit-trail/export',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  exportUserAuditTrail
);

// ✅ FIXED: Moved /:id route to the END to avoid conflicts
router.get(
  '/:id',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userController.getUserById
);

export default router;
