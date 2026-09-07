// src/routes/import.ts
import { Router } from 'express';
import { importController } from '../controllers/importController.js';
import multer from 'multer';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req: any, file: any, cb: any) => {
    const allowedExts = ['.csv', '.xlsx', '.xls', '.json'];
    const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}`), false);
    }
  },
});

// Import endpoints
router.post(
  '/products',
  upload.single('file'),
  importController.importProducts
);
router.post(
  '/customers',
  upload.single('file'),
  importController.importCustomers
);
router.post(
  '/suppliers',
  upload.single('file'),
  importController.importSuppliers
);
router.post(
  '/inventory',
  upload.single('file'),
  importController.importInventory
);
router.post(
  '/users',
  upload.single('file'),
  importController.importUsers
);

// Template and status
router.get('/template/:type', importController.downloadTemplate);
router.get('/history', importController.getImportHistory);
router.get('/status', importController.getImportStatus);

export default router;
