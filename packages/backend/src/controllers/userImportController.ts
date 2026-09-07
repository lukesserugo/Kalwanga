// D:\Projects\Kalwanga\packages\backend\src\controllers\userImportController.ts

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';
import { logger } from '../lib/logger.js';
import bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

// Import UserRole from the correct path
import { UserRole } from '../generated/prisma/index.js';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const importUsersSchema = z.object({
  skipDuplicates: z.string().optional().default('true'),
  skipInvalid: z.string().optional().default('true'),
  sendWelcomeEmail: z.string().optional().default('false'),
  defaultPassword: z.string().optional(),
  autoActivate: z.string().optional().default('true'),
  batchSize: z.string().optional().default('100'),
});

const importFromCSVSchema = z.object({
  content: z.string().min(1, 'CSV content is required'),
  skipDuplicates: z.boolean().optional().default(true),
  skipInvalid: z.boolean().optional().default(true),
  sendWelcomeEmail: z.boolean().optional().default(false),
  defaultPassword: z.string().optional(),
  autoActivate: z.boolean().optional().default(true),
});

const importFromJSONSchema = z.object({
  users: z.array(z.object({
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER', 'EMPLOYEE', 'CASHIER', 'USER']),
    phoneNumber: z.string().optional(),
    businessUnitId: z.string().optional(),
    isActive: z.boolean().optional(),
    permissions: z.array(z.string()).optional(),
    companyId: z.string().optional(),
  })).min(1, 'At least one user is required'),
  skipDuplicates: z.boolean().optional().default(true),
  sendWelcomeEmail: z.boolean().optional().default(false),
  defaultPassword: z.string().optional(),
  autoActivate: z.boolean().optional().default(true),
});

const getImportHistorySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  status: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  importedBy: z.string().optional(),
  fileName: z.string().optional(),
});

// ============================================
// CONSTANTS
// ============================================

const REQUIRED_HEADERS = ['email', 'firstName', 'lastName', 'role'];
const OPTIONAL_HEADERS = ['phoneNumber', 'businessUnitId', 'isActive', 'permissions', 'companyId', 'avatar', 'password'];

const ROLE_MAPPING: Record<string, UserRole> = {
  'SUPER_ADMIN': UserRole.SUPER_ADMIN,
  'ADMIN': UserRole.ADMIN,
  'MANAGER': UserRole.MANAGER,
  'EDITOR': UserRole.EDITOR,
  'VIEWER': UserRole.VIEWER,
  'EMPLOYEE': UserRole.EMPLOYEE,
  'CASHIER': UserRole.CASHIER,
  'USER': UserRole.USER,
  'super_admin': UserRole.SUPER_ADMIN,
  'admin': UserRole.ADMIN,
  'manager': UserRole.MANAGER,
  'editor': UserRole.EDITOR,
  'viewer': UserRole.VIEWER,
  'employee': UserRole.EMPLOYEE,
  'cashier': UserRole.CASHIER,
  'user': UserRole.USER,
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function handleValidationError(error: z.ZodError, res: Response) {
  return res.status(400).json({
    success: false,
    message: 'Validation error',
    errors: error.errors.map((err: z.ZodIssue) => ({
      field: err.path.join('.'),
      message: err.message,
    })),
  });
}

function handleError(error: any, res: Response, next: NextFunction) {
  if (error instanceof AppError) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }
  
  if (error instanceof Error) {
    logger.error('UserImportController error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
  
  next(error);
}

/**
 * Helper function to safely access audit log changes
 */
function getAuditLogChanges(log: any): any {
  return log.changes || {};
}

/**
 * Helper function to get status from audit log changes
 */
function getAuditLogStatus(log: any): string {
  const changes = getAuditLogChanges(log);
  return changes.status || 'completed';
}

/**
 * Helper function to get success count from audit log changes
 */
function getAuditLogSuccessCount(log: any): number {
  const changes = getAuditLogChanges(log);
  return changes.successCount || 0;
}

/**
 * Helper function to get failed count from audit log changes
 */
function getAuditLogFailedCount(log: any): number {
  const changes = getAuditLogChanges(log);
  return changes.failedCount || 0;
}

/**
 * Helper function to get warning count from audit log changes
 */
function getAuditLogWarningCount(log: any): number {
  const changes = getAuditLogChanges(log);
  return changes.warningCount || 0;
}

/**
 * Helper function to get skipped count from audit log changes
 */
function getAuditLogSkippedCount(log: any): number {
  const changes = getAuditLogChanges(log);
  return changes.skippedCount || 0;
}

/**
 * Helper function to get file size from audit log changes
 */
function getAuditLogFileSize(log: any): number {
  const changes = getAuditLogChanges(log);
  return changes.fileSize || 0;
}

/**
 * Helper function to get total rows from audit log changes
 */
function getAuditLogTotalRows(log: any): number {
  const changes = getAuditLogChanges(log);
  return changes.totalRows || 0;
}

/**
 * Helper function to get imported by from audit log changes
 */
function getAuditLogImportedBy(log: any): string {
  const changes = getAuditLogChanges(log);
  return changes.importedBy || 'Unknown';
}

/**
 * Helper function to get import duration from audit log changes
 */
function getAuditLogImportDuration(log: any): number {
  const changes = getAuditLogChanges(log);
  return changes.importDuration || 0;
}

/**
 * Helper function to get error summary from audit log changes
 */
function getAuditLogErrorSummary(log: any): string | undefined {
  const changes = getAuditLogChanges(log);
  return changes.errorSummary;
}

/**
 * Parse CSV content without external library
 */
function parseCSVContentSimple(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (char === '"') {
      if (inQuotes && content[i + 1] === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if (char === '\n' && !inQuotes) {
      currentRow.push(currentField.trim());
      if (currentRow.some((field: string) => field !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else if (char === '\r') {
      // Skip carriage return
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((field: string) => field !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Validate import data
 */
function validateImportData(rows: string[][], headers: string[]) {
  const users: any[] = [];
  const errors: any[] = [];
  const warnings: any[] = [];
  const emailSet = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const userData: Record<string, any> = {};
    const rowErrors: string[] = [];
    const rowWarnings: string[] = [];

    headers.forEach((header, index) => {
      if (row[index] !== undefined) {
        userData[header] = row[index];
      }
    });

    const email = userData.email || '';
    if (!email) {
      rowErrors.push('Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      rowErrors.push(`Invalid email format: ${email}`);
    } else if (emailSet.has(email.toLowerCase())) {
      rowErrors.push(`Duplicate email in file: ${email}`);
    }

    if (email && !emailSet.has(email.toLowerCase())) {
      emailSet.add(email.toLowerCase());
    }

    if (!userData.firstName) rowErrors.push('First name is required');
    if (!userData.lastName) rowErrors.push('Last name is required');

    const role = ROLE_MAPPING[userData.role] || null;
    if (!userData.role) {
      rowErrors.push('Role is required');
    } else if (!role) {
      rowErrors.push(`Invalid role: ${userData.role}`);
      rowWarnings.push(`Role "${userData.role}" not recognized, defaulting to USER`);
    }

    let status = 'valid';
    if (rowErrors.length > 0) {
      status = 'invalid';
    } else if (rowWarnings.length > 0) {
      status = 'warning';
    }

    users.push({
      id: `import_${i}_${Date.now()}`,
      email,
      firstName: userData.firstName || '',
      lastName: userData.lastName || '',
      phoneNumber: userData.phoneNumber,
      role: role || UserRole.USER,
      businessUnitId: userData.businessUnitId,
      isActive: userData.isActive ? userData.isActive.toLowerCase() === 'true' : true,
      password: userData.password,
      permissions: userData.permissions ? userData.permissions.split(';').map((p: string) => p.trim()) : [],
      companyId: userData.companyId,
      avatar: userData.avatar,
      status,
      errors: rowErrors,
      warnings: rowWarnings,
      originalData: userData,
      rowNumber: i + 2,
    });

    if (rowErrors.length > 0) {
      errors.push({ rowNumber: i + 2, email, errors: rowErrors });
    }
    if (rowWarnings.length > 0) {
      warnings.push({ rowNumber: i + 2, email, warnings: rowWarnings });
    }
  }

  return { users, errors, warnings };
}

// ============================================
// USER IMPORT CONTROLLER
// ============================================

export const userImportController = {
  /**
   * POST /users/import
   * Import users from file
   */
  async importUsers(req: Request & { file?: Express.Multer.File }, res: Response, next: NextFunction) {
    const startTime = Date.now();

    try {
      if (!req.file) {
        throw new AppError('No file uploaded', 400);
      }

      const params = importUsersSchema.parse(req.body);
      const file = req.file;
      const fileExtension = path.extname(file.originalname).toLowerCase();

      let rows: string[][] = [];
      if (fileExtension === '.csv') {
        const content = fs.readFileSync(file.path, 'utf-8');
        rows = parseCSVContentSimple(content);
      } else {
        fs.unlinkSync(file.path);
        throw new AppError('Invalid file format. Only CSV files are supported.', 400);
      }

      fs.unlinkSync(file.path);

      if (rows.length < 2) {
        throw new AppError('File must contain at least a header row and one data row', 400);
      }

      const headers = rows[0];
      const dataRows = rows.slice(1);

      const missingHeaders = REQUIRED_HEADERS.filter((h: string) => !headers.includes(h));
      if (missingHeaders.length > 0) {
        throw new AppError(`Missing required headers: ${missingHeaders.join(', ')}`, 400);
      }

      const { users, errors, warnings } = validateImportData(dataRows, headers);
      const validUsers = users.filter((u: any) => u.status === 'valid' || u.status === 'warning');
      const invalidUsers = users.filter((u: any) => u.status === 'invalid');

      const importedUsers: string[] = [];
      const failedUsers: string[] = [];
      const importErrors: any[] = [];

      for (const user of validUsers) {
        try {
          if (params.skipDuplicates === 'true') {
            const existingUser = await prisma.user.findUnique({
              where: { email: user.email },
            });

            if (existingUser) {
              failedUsers.push(user.email);
              importErrors.push({
                rowNumber: user.rowNumber,
                email: user.email,
                error: 'User already exists',
              });
              continue;
            }
          }

          const hashedPassword = await bcrypt.hash(
            user.password || params.defaultPassword || 'DefaultPass123!',
            10
          );

          const newUser = await prisma.user.create({
            data: {
              email: user.email.toLowerCase(),
              firstName: user.firstName,
              lastName: user.lastName,
              phoneNumber: user.phoneNumber,
              role: user.role,
              password: hashedPassword,
              isActive: user.isActive !== undefined ? user.isActive : params.autoActivate === 'true',
              permissions: user.permissions || [],
              companyId: user.companyId,
              clerkId: `imported_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            },
          });

          importedUsers.push(user.email);

          await prisma.auditLog.create({
            data: {
              action: 'IMPORT',
              entityType: 'USER',
              entityId: newUser.id,
              userId: (req as any).user?.id || newUser.id,
              entityName: `${newUser.firstName} ${newUser.lastName}`,
              changes: {
                email: newUser.email,
                role: newUser.role,
                source: 'file_import',
                fileName: file.originalname,
                importDate: new Date().toISOString(),
                importSuccess: true,
              },
              severity: 'INFO',
            },
          });

          logger.info(`Imported user: ${newUser.email}`);
        } catch (error: any) {
          failedUsers.push(user.email);
          importErrors.push({
            rowNumber: user.rowNumber,
            email: user.email,
            error: error?.message || 'Failed to import user',
          });
        }
      }

      const importDuration = Date.now() - startTime;
      const status = failedUsers.length === 0 ? 'completed' : failedUsers.length < validUsers.length ? 'partial' : 'failed';

      await prisma.auditLog.create({
        data: {
          action: 'IMPORT',
          entityType: 'USER_IMPORT',
          entityId: `import_${Date.now()}`,
          userId: (req as any).user?.id || 'system',
          entityName: file.originalname,
          changes: {
            fileName: file.originalname,
            fileSize: file.size,
            totalRows: users.length,
            successCount: importedUsers.length,
            failedCount: failedUsers.length,
            warningCount: warnings.length,
            skippedCount: invalidUsers.length,
            status,
            importedBy: (req as any).user?.email || 'Unknown',
            importDuration,
            errorSummary: importErrors.length > 0 ? `${importErrors.length} errors` : undefined,
            importedUsers,
            failedUsers,
          },
          severity: status === 'completed' ? 'INFO' : status === 'partial' ? 'LOW' : 'MEDIUM',
        },
      });

      logger.info(`Import completed: ${importedUsers.length} success, ${failedUsers.length} failed`);

      return res.json({
        success: true,
        data: {
          totalRows: users.length,
          successCount: importedUsers.length,
          failedCount: failedUsers.length,
          warningCount: warnings.length,
          skippedCount: invalidUsers.length,
          errors: importErrors,
          warnings,
          importedUsers,
          failedUsers,
          importDuration,
          importId: `import_${startTime}`,
        },
        message: `Imported ${importedUsers.length} users successfully`,
      });
    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  /**
   * POST /users/import/csv
   * Import users from CSV content
   */
  async importUsersFromCSV(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();

    try {
      const params = importFromCSVSchema.parse(req.body);
      const rows = parseCSVContentSimple(params.content);

      if (rows.length < 2) {
        throw new AppError('CSV must contain at least a header row and one data row', 400);
      }

      const headers = rows[0];
      const dataRows = rows.slice(1);

      const missingHeaders = REQUIRED_HEADERS.filter((h: string) => !headers.includes(h));
      if (missingHeaders.length > 0) {
        throw new AppError(`Missing required headers: ${missingHeaders.join(', ')}`, 400);
      }

      const { users, errors, warnings } = validateImportData(dataRows, headers);
      const validUsers = users.filter((u: any) => u.status === 'valid' || u.status === 'warning');

      const importedUsers: string[] = [];
      const failedUsers: string[] = [];

      for (const user of validUsers) {
        try {
          if (params.skipDuplicates) {
            const existingUser = await prisma.user.findUnique({
              where: { email: user.email },
            });

            if (existingUser) {
              failedUsers.push(user.email);
              continue;
            }
          }

          const hashedPassword = await bcrypt.hash(
            user.password || params.defaultPassword || 'DefaultPass123!',
            10
          );

          await prisma.user.create({
            data: {
              email: user.email.toLowerCase(),
              firstName: user.firstName,
              lastName: user.lastName,
              phoneNumber: user.phoneNumber,
              role: user.role,
              password: hashedPassword,
              isActive: params.autoActivate,
              permissions: user.permissions || [],
              companyId: user.companyId,
              clerkId: `imported_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            },
          });

          importedUsers.push(user.email);
        } catch (error) {
          failedUsers.push(user.email);
        }
      }

      return res.json({
        success: true,
        data: {
          totalRows: users.length,
          successCount: importedUsers.length,
          failedCount: failedUsers.length,
          warningCount: warnings.length,
          skippedCount: users.length - validUsers.length,
          errors,
          warnings,
          importedUsers,
          failedUsers,
          importDuration: Date.now() - startTime,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  /**
   * POST /users/import/json
   * Import users from JSON data
   */
  async importUsersFromJSON(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();

    try {
      const params = importFromJSONSchema.parse(req.body);

      const importedUsers: string[] = [];
      const failedUsers: string[] = [];
      const errors: any[] = [];

      for (const userData of params.users) {
        try {
          if (params.skipDuplicates) {
            const existingUser = await prisma.user.findUnique({
              where: { email: userData.email },
            });

            if (existingUser) {
              failedUsers.push(userData.email);
              errors.push({ email: userData.email, error: 'User already exists' });
              continue;
            }
          }

          const hashedPassword = await bcrypt.hash(
            params.defaultPassword || 'DefaultPass123!',
            10
          );

          await prisma.user.create({
            data: {
              email: userData.email.toLowerCase(),
              firstName: userData.firstName,
              lastName: userData.lastName,
              phoneNumber: userData.phoneNumber,
              role: userData.role,
              password: hashedPassword,
              isActive: userData.isActive !== undefined ? userData.isActive : params.autoActivate,
              permissions: userData.permissions || [],
              companyId: userData.companyId,
              clerkId: `imported_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            },
          });

          importedUsers.push(userData.email);
        } catch (error: any) {
          failedUsers.push(userData.email);
          errors.push({ email: userData.email, error: error?.message || 'Failed to import user' });
        }
      }

      return res.json({
        success: true,
        data: {
          totalRows: params.users.length,
          successCount: importedUsers.length,
          failedCount: failedUsers.length,
          warningCount: 0,
          skippedCount: 0,
          errors,
          warnings: [],
          importedUsers,
          failedUsers,
          importDuration: Date.now() - startTime,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  /**
   * POST /users/import/validate
   * Validate import data without importing
   */
  async validateImportData(req: Request & { file?: Express.Multer.File }, res: Response, next: NextFunction) {
    try {
      let rows: string[][] = [];

      if (req.file) {
        const content = fs.readFileSync(req.file.path, 'utf-8');
        rows = parseCSVContentSimple(content);
        fs.unlinkSync(req.file.path);
      } else if (req.body.content) {
        rows = parseCSVContentSimple(req.body.content);
      } else if (req.body.users) {
        const users = req.body.users;
        const validationErrors: any[] = [];
        const validationWarnings: any[] = [];

        users.forEach((user: any, index: number) => {
          const rowErrors: string[] = [];
          const rowWarnings: string[] = [];

          if (!user.email) rowErrors.push('Email is required');
          else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) rowErrors.push(`Invalid email format: ${user.email}`);
          if (!user.firstName) rowErrors.push('First name is required');
          if (!user.lastName) rowErrors.push('Last name is required');
          if (!user.role) rowErrors.push('Role is required');
          else if (!ROLE_MAPPING[user.role]) rowErrors.push(`Invalid role: ${user.role}`);

          if (rowErrors.length > 0) {
            validationErrors.push({ rowNumber: index + 1, email: user.email || '', errors: rowErrors });
          }
          if (rowWarnings.length > 0) {
            validationWarnings.push({ rowNumber: index + 1, email: user.email || '', warnings: rowWarnings });
          }
        });

        return res.json({
          success: true,
          data: {
            valid: validationErrors.length === 0,
            errors: validationErrors,
            warnings: validationWarnings,
            summary: {
              total: users.length,
              valid: users.length - validationErrors.length,
              invalid: validationErrors.length,
              warnings: validationWarnings.length,
              duplicates: 0,
              readyToImport: users.length - validationErrors.length,
            },
          },
        });
      } else {
        throw new AppError('No data to validate', 400);
      }

      if (rows.length < 2) {
        throw new AppError('File must contain at least a header row and one data row', 400);
      }

      const headers = rows[0];
      const dataRows = rows.slice(1);

      const missingHeaders = REQUIRED_HEADERS.filter((h: string) => !headers.includes(h));
      if (missingHeaders.length > 0) {
        return res.json({
          success: true,
          data: {
            valid: false,
            errors: [{ rowNumber: 0, email: '', errors: [`Missing required headers: ${missingHeaders.join(', ')}`] }],
            warnings: [],
            summary: { total: 0, valid: 0, invalid: 0, warnings: 0, duplicates: 0, readyToImport: 0 },
          },
        });
      }

      const { users, errors, warnings } = validateImportData(dataRows, headers);
      const validUsers = users.filter((u: any) => u.status === 'valid' || u.status === 'warning');
      const invalidUsers = users.filter((u: any) => u.status === 'invalid');

      return res.json({
        success: true,
        data: {
          valid: invalidUsers.length === 0,
          errors,
          warnings,
          validUsers,
          invalidUsers,
          duplicateEmails: [],
          summary: {
            total: users.length,
            valid: users.filter((u: any) => u.status === 'valid').length,
            invalid: invalidUsers.length,
            warnings: users.filter((u: any) => u.status === 'warning').length,
            duplicates: 0,
            readyToImport: validUsers.length,
          },
        },
      });
    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return handleError(error, res, next);
    }
  },

  /**
   * GET /users/import/template/:templateId
   * Get import template
   */
  async getImportTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { templateId } = req.params;

      const templates: Record<string, any> = {
        standard: {
          id: 'standard',
          name: 'Standard Template',
          description: 'Basic user import with essential fields',
          format: 'csv',
          headers: [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS],
          requiredHeaders: REQUIRED_HEADERS,
          optionalHeaders: OPTIONAL_HEADERS,
          exampleData: [
            { email: 'john.doe@example.com', firstName: 'John', lastName: 'Doe', role: 'EMPLOYEE', phoneNumber: '+1234567890', isActive: 'true' },
          ],
        },
        minimal: {
          id: 'minimal',
          name: 'Minimal Template',
          description: 'Only required fields',
          format: 'csv',
          headers: REQUIRED_HEADERS,
          requiredHeaders: REQUIRED_HEADERS,
          optionalHeaders: [],
          exampleData: [
            { email: 'john.doe@example.com', firstName: 'John', lastName: 'Doe', role: 'USER' },
          ],
        },
        full: {
          id: 'full',
          name: 'Full Template',
          description: 'All available fields including permissions',
          format: 'csv',
          headers: [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS],
          requiredHeaders: REQUIRED_HEADERS,
          optionalHeaders: OPTIONAL_HEADERS,
          exampleData: [
            { email: 'john.doe@example.com', firstName: 'John', lastName: 'Doe', role: 'MANAGER', phoneNumber: '+1234567890', businessUnitId: '1', isActive: 'true', permissions: 'user:view,inventory:view,product:view', companyId: '1' },
          ],
        },
      };

      const template = templates[templateId];

      if (!template) {
        throw new AppError('Template not found', 404);
      }

      return res.json({
        success: true,
        data: template,
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  /**
   * GET /users/import/templates
   * Get all import templates
   */
  async getImportTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const templates = [
        {
          id: 'standard',
          name: 'Standard Template',
          description: 'Basic user import with essential fields',
          format: 'csv',
          headers: [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS],
          requiredHeaders: REQUIRED_HEADERS,
          optionalHeaders: OPTIONAL_HEADERS,
        },
        {
          id: 'minimal',
          name: 'Minimal Template',
          description: 'Only required fields',
          format: 'csv',
          headers: REQUIRED_HEADERS,
          requiredHeaders: REQUIRED_HEADERS,
          optionalHeaders: [],
        },
        {
          id: 'full',
          name: 'Full Template',
          description: 'All available fields including permissions',
          format: 'csv',
          headers: [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS],
          requiredHeaders: REQUIRED_HEADERS,
          optionalHeaders: OPTIONAL_HEADERS,
        },
      ];

      return res.json({
        success: true,
        data: templates,
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  /**
   * GET /users/import/template/:templateId/download
   * Download import template
   */
  async downloadImportTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { templateId } = req.params;

      const templates: Record<string, any> = {
        standard: {
          headers: [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS],
          exampleData: [
            { email: 'john.doe@example.com', firstName: 'John', lastName: 'Doe', role: 'EMPLOYEE', phoneNumber: '+1234567890', isActive: 'true' },
          ],
        },
        minimal: {
          headers: REQUIRED_HEADERS,
          exampleData: [
            { email: 'john.doe@example.com', firstName: 'John', lastName: 'Doe', role: 'USER' },
          ],
        },
        full: {
          headers: [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS],
          exampleData: [
            { email: 'john.doe@example.com', firstName: 'John', lastName: 'Doe', role: 'MANAGER', phoneNumber: '+1234567890', businessUnitId: '1', isActive: 'true', permissions: 'user:view,inventory:view,product:view', companyId: '1' },
          ],
        },
      };

      const template = templates[templateId];

      if (!template) {
        throw new AppError('Template not found', 404);
      }

      let csvContent = template.headers.join(',') + '\n';
      template.exampleData.forEach((row: any) => {
        const values = template.headers.map((h: string) => row[h] || '');
        csvContent += values.join(',') + '\n';
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=user_import_${templateId}_template.csv`);
      return res.send(csvContent);
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  /**
   * GET /users/import/history
   * Get import history from AuditLog
   */
  async getImportHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const params = getImportHistorySchema.parse(req.query);
      const page = parseInt(params.page);
      const limit = parseInt(params.limit);
      const skip = (page - 1) * limit;

      const where: any = {
        entityType: 'USER_IMPORT',
      };

      if (params.status) {
        where.changes = { path: ['status'], equals: params.status };
      }

      if (params.fileName) {
        where.entityName = { contains: params.fileName, mode: 'insensitive' };
      }

      if (params.dateFrom || params.dateTo) {
        where.createdAt = {};
        if (params.dateFrom) where.createdAt.gte = new Date(params.dateFrom);
        if (params.dateTo) where.createdAt.lte = new Date(params.dateTo);
      }

      const [history, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.auditLog.count({ where }),
      ]);

      // Transform AuditLog entries to ImportHistory format using helper functions
      const formattedHistory = history.map((log: any) => ({
        id: log.id,
        fileName: log.entityName,
        fileSize: getAuditLogFileSize(log),
        totalRows: getAuditLogTotalRows(log),
        successCount: getAuditLogSuccessCount(log),
        failedCount: getAuditLogFailedCount(log),
        warningCount: getAuditLogWarningCount(log),
        skippedCount: getAuditLogSkippedCount(log),
        status: getAuditLogStatus(log),
        importedBy: getAuditLogImportedBy(log),
        importDuration: getAuditLogImportDuration(log),
        errorSummary: getAuditLogErrorSummary(log),
        importedAt: log.createdAt.toISOString(),
      }));

      return res.json({
        success: true,
        data: formattedHistory,
        pagination: {
          total,
          page,
          totalPages: Math.ceil(total / limit),
          limit,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  /**
   * GET /users/import/history/:importId
   * Get import history by ID
   */
  async getImportHistoryById(req: Request, res: Response, next: NextFunction) {
    try {
      const { importId } = req.params;

      const log = await prisma.auditLog.findUnique({
        where: { id: importId },
      });

      if (!log || log.entityType !== 'USER_IMPORT') {
        throw new AppError('Import history not found', 404);
      }

      const formattedHistory = {
        id: log.id,
        fileName: log.entityName,
        fileSize: getAuditLogFileSize(log),
        totalRows: getAuditLogTotalRows(log),
        successCount: getAuditLogSuccessCount(log),
        failedCount: getAuditLogFailedCount(log),
        warningCount: getAuditLogWarningCount(log),
        skippedCount: getAuditLogSkippedCount(log),
        status: getAuditLogStatus(log),
        importedBy: getAuditLogImportedBy(log),
        importDuration: getAuditLogImportDuration(log),
        errorSummary: getAuditLogErrorSummary(log),
        importedAt: log.createdAt.toISOString(),
        details: log.changes,
      };

      return res.json({
        success: true,
        data: formattedHistory,
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  /**
   * GET /users/import/stats
   * Get import statistics
   */
  async getImportStats(req: Request, res: Response, next: NextFunction) {
    try {
      const importLogs = await prisma.auditLog.findMany({
        where: { entityType: 'USER_IMPORT' },
        orderBy: { createdAt: 'desc' },
      });

      const totalImports = importLogs.length;
      const totalUsersImported = importLogs.reduce(
        (sum: number, log: any) => sum + getAuditLogSuccessCount(log),
        0
      );

      const byStatus: Record<string, number> = {};
      importLogs.forEach((log: any) => {
        const status = getAuditLogStatus(log);
        byStatus[status] = (byStatus[status] || 0) + 1;
      });

      const byMonth: Array<{ month: string; count: number }> = [];
      const monthMap: Record<string, number> = {};
      importLogs.forEach((log: any) => {
        const month = log.createdAt.toISOString().slice(0, 7);
        monthMap[month] = (monthMap[month] || 0) + 1;
      });
      Object.entries(monthMap).forEach(([month, count]) => {
        byMonth.push({ month, count });
      });

      const lastImport = importLogs.length > 0 ? {
        id: importLogs[0].id,
        fileName: importLogs[0].entityName,
        importedAt: importLogs[0].createdAt.toISOString(),
        status: getAuditLogStatus(importLogs[0]),
        successCount: getAuditLogSuccessCount(importLogs[0]),
        failedCount: getAuditLogFailedCount(importLogs[0]),
      } : null;

      return res.json({
        success: true,
        data: {
          totalImports,
          totalUsersImported,
          successRate: totalImports > 0 ? (totalUsersImported / totalImports) * 100 : 0,
          averageImportTime: 0,
          lastImport,
          byMonth,
          byStatus,
        },
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  /**
   * DELETE /users/import/history/:importId
   * Delete import history entry
   */
  async deleteImportHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { importId } = req.params;

      const log = await prisma.auditLog.findUnique({
        where: { id: importId },
      });

      if (!log || log.entityType !== 'USER_IMPORT') {
        throw new AppError('Import history not found', 404);
      }

      await prisma.auditLog.delete({
        where: { id: importId },
      });

      return res.json({
        success: true,
        message: 'Import history deleted successfully',
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  /**
   * DELETE /users/import/history
   * Clear all import history
   */
  async clearImportHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await prisma.auditLog.deleteMany({
        where: { entityType: 'USER_IMPORT' },
      });

      return res.json({
        success: true,
        message: `Cleared ${result.count} import history records`,
        cleared: result.count,
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },
};

export default userImportController;
