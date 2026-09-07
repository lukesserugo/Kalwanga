// D:\Projects\Kalwanga\packages\backend\src\services\userImportService.ts

import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { UserRole, Prisma } from '../generated/prisma/index.js';
import { logger } from '../lib/logger.js';
import bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// TYPES
// ============================================

interface ImportOptions {
  skipDuplicates?: boolean;
  skipInvalid?: boolean;
  sendWelcomeEmail?: boolean;
  defaultPassword?: string;
  autoActivate?: boolean;
  batchSize?: number;
}

interface ImportResult {
  totalRows: number;
  successCount: number;
  failedCount: number;
  warningCount: number;
  skippedCount: number;
  errors: any[];
  warnings: any[];
  importedUsers: string[];
  failedUsers: string[];
  importDuration: number;
  importId?: string;
}

interface ImportHistoryFilter {
  page?: number;
  limit?: number;
  status?: string;
  fileName?: string;
  dateFrom?: string;
  dateTo?: string;
}

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
// USER IMPORT SERVICE (Using AuditLog for history)
// ============================================

export class UserImportService extends BaseService {
  /**
   * Import users from file
   */
  async importUsers(
    file: Express.Multer.File,
    options: ImportOptions = {},
    currentUserId?: string,
    currentUserEmail?: string
  ): Promise<ImportResult> {
    const startTime = Date.now();

    try {
      if (!file) {
        throw new AppError('No file uploaded', 400);
      }

      const fileExtension = path.extname(file.originalname).toLowerCase();

      if (fileExtension !== '.csv') {
        throw new AppError('Invalid file format. Only CSV files are supported.', 400);
      }

      const content = fs.readFileSync(file.path, 'utf-8');
      const rows = this.parseCSVContentSimple(content);

      fs.unlinkSync(file.path);

      if (rows.length < 2) {
        throw new AppError('File must contain at least a header row and one data row', 400);
      }

      const headers = rows[0];
      const dataRows = rows.slice(1);

      const missingHeaders = REQUIRED_HEADERS.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        throw new AppError(`Missing required headers: ${missingHeaders.join(', ')}`, 400);
      }

      const { users, errors, warnings } = this.validateImportData(dataRows, headers);
      const validUsers = users.filter(u => u.status === 'valid' || u.status === 'warning');
      const invalidUsers = users.filter(u => u.status === 'invalid');

      const importedUsers: string[] = [];
      const failedUsers: string[] = [];
      const importErrors: any[] = [];

      for (const user of validUsers) {
        try {
          if (options.skipDuplicates !== false) {
            const existingUser = await this.prisma.user.findUnique({
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
            user.password || options.defaultPassword || 'DefaultPass123!',
            10
          );

          const newUser = await this.prisma.user.create({
            data: {
              email: user.email.toLowerCase(),
              firstName: user.firstName,
              lastName: user.lastName,
              phoneNumber: user.phoneNumber,
              role: user.role,
              password: hashedPassword,
              isActive: user.isActive !== undefined ? user.isActive : options.autoActivate !== false,
              permissions: user.permissions || [],
              companyId: user.companyId,
              clerkId: `imported_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            },
          });

          importedUsers.push(user.email);

          await this.prisma.auditLog.create({
            data: {
              action: 'IMPORT' as any,
              entityType: 'USER',
              entityId: newUser.id,
              userId: currentUserId || newUser.id,
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
      const importId = `import_${startTime}`;

      // Store import history in AuditLog
      await this.prisma.auditLog.create({
        data: {
          action: 'IMPORT' as any,
          entityType: 'USER_IMPORT',
          entityId: importId,
          userId: currentUserId || 'system',
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
            importedBy: currentUserEmail || 'Unknown',
            importDuration,
            errorSummary: importErrors.length > 0 ? `${importErrors.length} errors` : undefined,
            importedUsers,
            failedUsers,
          },
          severity: status === 'completed' ? 'INFO' : status === 'partial' ? 'LOW' : 'MEDIUM',
        },
      });

      logger.info(`Import completed: ${importedUsers.length} success, ${failedUsers.length} failed`);

      return {
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
        importId,
      };
    } catch (error) {
      if (file && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      this.handleError(error, 'UserImportService.importUsers');
    }
  }

  /**
   * Import users from CSV content
   */
  async importUsersFromCSV(content: string, options: ImportOptions = {}, currentUserId?: string, currentUserEmail?: string): Promise<ImportResult> {
    const startTime = Date.now();

    try {
      const rows = this.parseCSVContentSimple(content);

      if (rows.length < 2) {
        throw new AppError('CSV must contain at least a header row and one data row', 400);
      }

      const headers = rows[0];
      const dataRows = rows.slice(1);

      const missingHeaders = REQUIRED_HEADERS.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        throw new AppError(`Missing required headers: ${missingHeaders.join(', ')}`, 400);
      }

      const { users, errors, warnings } = this.validateImportData(dataRows, headers);
      const validUsers = users.filter(u => u.status === 'valid' || u.status === 'warning');

      const importedUsers: string[] = [];
      const failedUsers: string[] = [];

      for (const user of validUsers) {
        try {
          if (options.skipDuplicates) {
            const existingUser = await this.prisma.user.findUnique({
              where: { email: user.email },
            });

            if (existingUser) {
              failedUsers.push(user.email);
              continue;
            }
          }

          const hashedPassword = await bcrypt.hash(
            user.password || options.defaultPassword || 'DefaultPass123!',
            10
          );

          await this.prisma.user.create({
            data: {
              email: user.email.toLowerCase(),
              firstName: user.firstName,
              lastName: user.lastName,
              phoneNumber: user.phoneNumber,
              role: user.role,
              password: hashedPassword,
              isActive: options.autoActivate !== false,
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

      return {
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
      };
    } catch (error) {
      this.handleError(error, 'UserImportService.importUsersFromCSV');
    }
  }

  /**
   * Import users from JSON data
   */
  async importUsersFromJSON(users: any[], options: ImportOptions = {}): Promise<ImportResult> {
    const startTime = Date.now();

    try {
      const importedUsers: string[] = [];
      const failedUsers: string[] = [];
      const errors: any[] = [];

      for (const userData of users) {
        try {
          if (options.skipDuplicates) {
            const existingUser = await this.prisma.user.findUnique({
              where: { email: userData.email },
            });

            if (existingUser) {
              failedUsers.push(userData.email);
              errors.push({ email: userData.email, error: 'User already exists' });
              continue;
            }
          }

          const hashedPassword = await bcrypt.hash(
            options.defaultPassword || 'DefaultPass123!',
            10
          );

          await this.prisma.user.create({
            data: {
              email: userData.email.toLowerCase(),
              firstName: userData.firstName,
              lastName: userData.lastName,
              phoneNumber: userData.phoneNumber,
              role: userData.role,
              password: hashedPassword,
              isActive: userData.isActive !== undefined ? userData.isActive : options.autoActivate !== false,
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

      return {
        totalRows: users.length,
        successCount: importedUsers.length,
        failedCount: failedUsers.length,
        warningCount: 0,
        skippedCount: 0,
        errors,
        warnings: [],
        importedUsers,
        failedUsers,
        importDuration: Date.now() - startTime,
      };
    } catch (error) {
      this.handleError(error, 'UserImportService.importUsersFromJSON');
    }
  }

  /**
   * Get import history from AuditLog
   */
  async getImportHistory(filters: ImportHistoryFilter = {}) {
    try {
      const page = filters.page || 1;
      const limit = Math.min(200, Math.max(1, filters.limit || 20));
      const skip = (page - 1) * limit;

      const where: Prisma.AuditLogWhereInput = {
        entityType: 'USER_IMPORT',
      };

      if (filters.fileName) {
        where.entityName = { contains: filters.fileName, mode: 'insensitive' };
      }

      if (filters.dateFrom || filters.dateTo) {
        where.createdAt = {};
        if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
        if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
      }

      const [logs, total] = await Promise.all([
        this.prisma.auditLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.auditLog.count({ where }),
      ]);

      // Transform AuditLog entries to ImportHistory format
      const formattedHistory = logs.map(log => ({
        id: log.id,
        fileName: log.entityName,
        fileSize: (log.changes as any)?.fileSize || 0,
        totalRows: (log.changes as any)?.totalRows || 0,
        successCount: (log.changes as any)?.successCount || 0,
        failedCount: (log.changes as any)?.failedCount || 0,
        warningCount: (log.changes as any)?.warningCount || 0,
        skippedCount: (log.changes as any)?.skippedCount || 0,
        status: (log.changes as any)?.status || 'completed',
        importedBy: (log.changes as any)?.importedBy || 'Unknown',
        importDuration: (log.changes as any)?.importDuration || 0,
        errorSummary: (log.changes as any)?.errorSummary,
        importedAt: log.createdAt.toISOString(),
      }));

      return {
        data: formattedHistory,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      };
    } catch (error) {
      this.handleError(error, 'UserImportService.getImportHistory');
    }
  }

  /**
   * Get import statistics
   */
  async getImportStats() {
    try {
      const importLogs = await this.prisma.auditLog.findMany({
        where: { entityType: 'USER_IMPORT' },
        orderBy: { createdAt: 'desc' },
      });

      const totalImports = importLogs.length;
      const totalUsersImported = importLogs.reduce(
        (sum: number, log: any) => sum + ((log.changes as any)?.successCount || 0),
        0
      );

      const byStatus: Record<string, number> = {};
      importLogs.forEach((log: any) => {
        const status = (log.changes as any)?.status || 'unknown';
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

      const lastImport = importLogs.length > 0
        ? {
            id: importLogs[0].id,
            fileName: importLogs[0].entityName,
            importedAt: importLogs[0].createdAt.toISOString(),
            status: (importLogs[0].changes as any)?.status || 'completed',
            successCount: (importLogs[0].changes as any)?.successCount || 0,
            failedCount: (importLogs[0].changes as any)?.failedCount || 0,
          }
        : null;

      return {
        totalImports,
        totalUsersImported,
        successRate: totalImports > 0 ? (totalUsersImported / totalImports) * 100 : 0,
        averageImportTime: 0,
        lastImport,
        byMonth,
        byStatus,
      };
    } catch (error) {
      this.handleError(error, 'UserImportService.getImportStats');
    }
  }

  /**
   * Delete import history entry
   */
  async deleteImportHistory(importId: string) {
    try {
      const log = await this.prisma.auditLog.findUnique({
        where: { id: importId },
      });

      if (!log || log.entityType !== 'USER_IMPORT') {
        throw new AppError('Import history not found', 404);
      }

      await this.prisma.auditLog.delete({
        where: { id: importId },
      });

      return { message: 'Import history deleted successfully' };
    } catch (error) {
      this.handleError(error, 'UserImportService.deleteImportHistory');
    }
  }

  /**
   * Clear all import history
   */
  async clearImportHistory() {
    try {
      const result = await this.prisma.auditLog.deleteMany({
        where: { entityType: 'USER_IMPORT' },
      });

      return {
        cleared: result.count,
        message: `Cleared ${result.count} import history records`,
      };
    } catch (error) {
      this.handleError(error, 'UserImportService.clearImportHistory');
    }
  }

  /**
   * Get import templates
   */
  getImportTemplates() {
    return [
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
  }

  /**
   * Get import template by ID
   */
  getImportTemplate(templateId: string) {
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

    return templates[templateId] || null;
  }

  /**
   * Generate CSV template content
   */
  generateTemplateCSV(templateId: string): string {
    const template = this.getImportTemplate(templateId);

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    let csvContent = template.headers.join(',') + '\n';
    template.exampleData.forEach((row: any) => {
      const values = template.headers.map((h: string) => row[h] || '');
      csvContent += values.join(',') + '\n';
    });

    return csvContent;
  }

  /**
   * Parse CSV content without external library
   */
  private parseCSVContentSimple(content: string): string[][] {
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
        if (currentRow.some(field => field !== '')) {
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
      if (currentRow.some(field => field !== '')) {
        rows.push(currentRow);
      }
    }

    return rows;
  }

  /**
   * Validate import data
   */
  private validateImportData(rows: string[][], headers: string[]) {
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
}

export const userImportService = new UserImportService();
