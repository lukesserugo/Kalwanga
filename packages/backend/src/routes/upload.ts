// src/routes/upload.ts
import { Router } from 'express';
import { uploadController } from '../controllers/uploadController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UserRole } from '../generated/prisma/enums.js';
import { upload } from '../middleware/upload.js';

const router = Router();
router.use(requireAuth);

// Product images
router.post(
  '/product/:productId',
  upload.single('file'),
  uploadController.uploadProductImage
);
router.post(
  '/product/:productId/multiple',
  upload.array('files', 10),
  uploadController.uploadMultipleProductImages
);
router.get(
  '/product/:productId/images',
  uploadController.getProductImages
);
router.put(
  '/product/:productId/images/reorder',
  uploadController.reorderImages
);

// Supplier images
router.post(
  '/supplier/:supplierId',
  upload.single('file'),
  uploadController.uploadSupplierImage
);

// User avatar
router.post(
  '/user/:userId/avatar',
  upload.single('file'),
  uploadController.uploadUserAvatar
);

// Company logo
router.post(
  '/company/:companyId/logo',
  upload.single('file'),
  uploadController.uploadCompanyLogo
);

// Business unit logo
router.post(
  '/business-unit/:businessUnitId/logo',
  upload.single('file'),
  uploadController.uploadBusinessUnitLogo
);

// Category image
router.post(
  '/category/:categoryId',
  upload.single('file'),
  uploadController.uploadCategoryImage
);

// Image management
router.delete('/image/:imageId', uploadController.deleteImage);
router.patch('/image/:imageId/primary', uploadController.setPrimaryImage);

// Stats
router.get('/stats', uploadController.getUploadStats);

export default router;
