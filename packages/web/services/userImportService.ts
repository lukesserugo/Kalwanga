// D:\Projects\Kalwanga\packages\web\services\userImportService.ts

import { api } from './api';
import { UserRole } from '../types/enums';
import { User, CreateUserData, BulkActionResponse } from '../types/user';

// Import-related type definitions
export interface ImportUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  role: UserRole;
  businessUnitId?: string;
  isActive: boolean;
  password?: string;
  permissions?: string[];
  companyId?: string;
  avatar?: string;
  status: 'valid' | 'invalid' | 'warning' | 'duplicate';
  errors: string[];
  warnings: string[];
  originalData: Record<string, any>;
  rowNumber: number;
}

export interface ImportResult {
  totalRows: number;
  successCount: number;
  failedCount: number;
  warningCount: number;
  skippedCount: number;
  errors: ImportError[];
  warnings: ImportWarning[];
  importedUsers: string[];
  failedUsers: string[];
  importId?: string;
  importedAt?: string;
}

export interface ImportError {
  rowNumber: number;
  email: string;
  error: string;
  field?: string;
  value?: string;
}

export interface ImportWarning {
  rowNumber: number;
  email: string;
  warning: string;
  field?: string;
  value?: string;
}

export interface ImportTemplate {
  id: string;
  name: string;
  description: string;
  format: 'csv' | 'excel';
  headers: string[];
  requiredHeaders: string[];
  optionalHeaders: string[];
  exampleData: Record<string, any>[];
  downloadUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ImportHistory {
  id: string;
  fileName: string;
  fileSize: number;
  importedAt: string;
  totalRows: number;
  successCount: number;
  failedCount: number;
  warningCount: number;
  skippedCount: number;
  status: 'completed' | 'partial' | 'failed' | 'cancelled';
  importedBy: string;
  importDuration: number;
  errorSummary?: string;
  details?: ImportResult;
}

export interface ImportValidationResult {
  valid: boolean;
  errors: ImportError[];
  warnings: ImportWarning[];
  validUsers: ImportUser[];
  invalidUsers: ImportUser[];
  duplicateEmails: string[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    warnings: number;
    duplicates: number;
    readyToImport: number;
  };
}

export interface ImportOptions {
  skipDuplicates?: boolean;
  skipInvalid?: boolean;
  sendWelcomeEmail?: boolean;
  defaultPassword?: string;
  autoActivate?: boolean;
  batchSize?: number;
}

export interface ImportProgress {
  current: number;
  total: number;
  percentage: number;
  status: 'idle' | 'parsing' | 'validating' | 'importing' | 'completed' | 'failed';
  message: string;
  batchNumber?: number;
  totalBatches?: number;
}

export interface BatchImportResult {
  batchNumber: number;
  totalBatches: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  duration: number;
}

// Response types for API calls
export interface ImportHistoryResponse {
  data: ImportHistory[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface ImportStatsResponse {
  totalImports: number;
  totalUsersImported: number;
  successRate: number;
  averageImportTime: number;
  lastImport?: ImportHistory;
  byMonth: Array<{ month: string; count: number }>;
  byStatus: Record<string, number>;
}

// Constants
export const REQUIRED_HEADERS = ['email', 'firstName', 'lastName', 'role'];
export const OPTIONAL_HEADERS = [
  'phoneNumber', 'businessUnitId', 'isActive', 'permissions',
  'companyId', 'avatar', 'password'
];

export const ROLE_MAPPING: Record<string, UserRole> = {
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

export const userImportService = {
  /**
   * Import users from file
   * @param file - File to import (CSV, Excel)
   * @param options - Import options
   * @returns Import result
   */
  async importUsers(
    file: File,
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      if (options.skipDuplicates !== undefined) {
        formData.append('skipDuplicates', String(options.skipDuplicates));
      }
      if (options.skipInvalid !== undefined) {
        formData.append('skipInvalid', String(options.skipInvalid));
      }
      if (options.sendWelcomeEmail !== undefined) {
        formData.append('sendWelcomeEmail', String(options.sendWelcomeEmail));
      }
      if (options.defaultPassword) {
        formData.append('defaultPassword', options.defaultPassword);
      }
      if (options.autoActivate !== undefined) {
        formData.append('autoActivate', String(options.autoActivate));
      }
      if (options.batchSize) {
        formData.append('batchSize', String(options.batchSize));
      }

      const response = await api.post<ImportResult>(
        '/users/import',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return response;
    } catch (error: any) {
      console.error('❌ Failed to import users:', error);
      throw error;
    }
  },

  /**
   * Import users from CSV string
   * @param csvContent - CSV content string
   * @param options - Import options
   * @returns Import result
   */
  async importUsersFromCSV(
    csvContent: string,
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    try {
      const response = await api.post<ImportResult>(
        '/users/import/csv',
        {
          content: csvContent,
          ...options,
        }
      );
      return response;
    } catch (error: any) {
      console.error('❌ Failed to import users from CSV:', error);
      throw error;
    }
  },

  /**
   * Import users from JSON data
   * @param users - Array of user data
   * @param options - Import options
   * @returns Import result
   */
  async importUsersFromJSON(
    users: Partial<CreateUserData>[],
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    try {
      const response = await api.post<ImportResult>(
        '/users/import/json',
        {
          users,
          ...options,
        }
      );
      return response;
    } catch (error: any) {
      console.error('❌ Failed to import users from JSON:', error);
      throw error;
    }
  },

  /**
   * Validate import data
   * @param data - Import data (file or array)
   * @returns Validation result
   */
  async validateImportData(
    data: File | string | Record<string, any>[]
  ): Promise<ImportValidationResult> {
    try {
      if (data instanceof File) {
        const formData = new FormData();
        formData.append('file', data);
        
        const response = await api.post<ImportValidationResult>(
          '/users/import/validate',
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );
        return response;
      } else if (typeof data === 'string') {
        const response = await api.post<ImportValidationResult>(
          '/users/import/validate',
          { content: data }
        );
        return response;
      } else {
        const response = await api.post<ImportValidationResult>(
          '/users/import/validate',
          { users: data }
        );
        return response;
      }
    } catch (error: any) {
      console.error('❌ Failed to validate import data:', error);
      throw error;
    }
  },

  /**
   * Get import template
   * @param templateId - Template ID (optional)
   * @returns Import template
   */
  async getImportTemplate(
    templateId: string = 'standard'
  ): Promise<ImportTemplate> {
    try {
      const response = await api.get<ImportTemplate>(
        `/users/import/template/${templateId}`
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get import template ${templateId}:`, error);
      throw error;
    }
  },

  /**
   * Get all import templates
   * @returns Array of import templates
   */
  async getImportTemplates(): Promise<ImportTemplate[]> {
    try {
      const response = await api.get<ImportTemplate[]>(
        '/users/import/templates'
      );
      return response;
    } catch (error: any) {
      console.error('❌ Failed to get import templates:', error);
      throw error;
    }
  },

  /**
   * Download import template
   * @param templateId - Template ID
   * @param format - Template format
   * @returns Template file
   */
  async downloadImportTemplate(
    templateId: string = 'standard',
    format: 'csv' | 'excel' = 'csv'
  ): Promise<Blob> {
    try {
      const response = await api.download(
        `/users/import/template/${templateId}/download`,
        { params: { format } }
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to download template ${templateId}:`, error);
      throw error;
    }
  },

  /**
   * Get import template content
   * @param templateId - Template ID
   * @returns Template content as string
   */
  async getImportTemplateContent(
    templateId: string = 'standard'
  ): Promise<string> {
    try {
      const response = await api.get<string>(
        `/users/import/template/${templateId}/content`
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get template content:`, error);
      throw error;
    }
  },

  /**
   * Get import history
   * @param filters - History filters
   * @returns Import history entries
   */
  async getImportHistory(
    filters: {
      page?: number;
      limit?: number;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
      importedBy?: string;
      fileName?: string;
    } = {}
  ): Promise<ImportHistoryResponse> {
    try {
      const params: Record<string, any> = {
        page: filters.page || 1,
        limit: filters.limit || 20,
      };

      if (filters.status) params.status = filters.status;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      if (filters.importedBy) params.importedBy = filters.importedBy;
      if (filters.fileName) params.fileName = filters.fileName;

      const response = await api.get<ImportHistoryResponse>(
        '/users/import/history',
        { params }
      );
      return response;
    } catch (error: any) {
      console.error('❌ Failed to get import history:', error);
      throw error;
    }
  },

  /**
   * Get import history by ID
   * @param importId - Import ID
   * @returns Import history entry
   */
  async getImportHistoryById(importId: string): Promise<ImportHistory> {
    try {
      const response = await api.get<ImportHistory>(
        `/users/import/history/${importId}`
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get import history ${importId}:`, error);
      throw error;
    }
  },

  /**
   * Cancel ongoing import
   * @param importId - Import ID
   * @returns Cancel result
   */
  async cancelImport(importId: string): Promise<{ message: string }> {
    try {
      const response = await api.post<{ message: string }>(
        `/users/import/${importId}/cancel`
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to cancel import ${importId}:`, error);
      throw error;
    }
  },

  /**
   * Retry failed import
   * @param importId - Import ID
   * @param options - Retry options
   * @returns Import result
   */
  async retryImport(
    importId: string,
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    try {
      const response = await api.post<ImportResult>(
        `/users/import/${importId}/retry`,
        options
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to retry import ${importId}:`, error);
      throw error;
    }
  },

  /**
   * Get import statistics
   * @returns Import statistics
   */
  async getImportStats(): Promise<ImportStatsResponse> {
    try {
      const response = await api.get<ImportStatsResponse>('/users/import/stats');
      return response;
    } catch (error: any) {
      console.error('❌ Failed to get import stats:', error);
      throw error;
    }
  },

  /**
   * Export import history
   * @param format - Export format
   * @param filters - Export filters
   * @returns Export response
   */
  async exportImportHistory(
    format: 'csv' | 'json' = 'json',
    filters: {
      dateFrom?: string;
      dateTo?: string;
      status?: string;
    } = {}
  ): Promise<any> {
    try {
      const params: Record<string, any> = { format };
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      if (filters.status) params.status = filters.status;

      if (format === 'json') {
        return await api.get('/users/import/history/export', { params });
      } else {
        return await api.download('/users/import/history/export', { params });
      }
    } catch (error: any) {
      console.error('❌ Failed to export import history:', error);
      throw error;
    }
  },

  /**
   * Delete import history entry
   * @param importId - Import ID
   * @returns Delete result
   */
  async deleteImportHistory(importId: string): Promise<{ message: string }> {
    try {
      const response = await api.delete<{ message: string }>(
        `/users/import/history/${importId}`
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to delete import history ${importId}:`, error);
      throw error;
    }
  },

  /**
   * Clear all import history
   * @returns Clear result
   */
  async clearImportHistory(): Promise<{ cleared: number; message: string }> {
    try {
      const response = await api.delete<{ cleared: number; message: string }>(
        '/users/import/history'
      );
      return response;
    } catch (error: any) {
      console.error('❌ Failed to clear import history:', error);
      throw error;
    }
  },

  /**
   * Get file extension
   * @param fileName - File name
   * @returns File extension
   */
  getFileExtension(fileName: string): string {
    return fileName.split('.').pop()?.toLowerCase() || '';
  },

  /**
   * Check if file is valid for import
   * @param file - File to check
   * @returns Validation result
   */
  isValidImportFile(file: File): { valid: boolean; error?: string } {
    const extension = this.getFileExtension(file.name);
    const validExtensions = ['csv', 'xlsx', 'xls'];
    
    if (!validExtensions.includes(extension)) {
      return {
        valid: false,
        error: `Invalid file format. Supported: ${validExtensions.join(', ')}`,
      };
    }
    
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size exceeds ${Math.round(maxSize / (1024 * 1024))}MB limit`,
      };
    }
    
    return { valid: true };
  },

  /**
   * Validate CSV content locally (client-side validation)
   * @param csvContent - CSV content
   * @param headers - Expected headers (optional)
   * @returns Validation result with parsed data
   */
  validateCSVLocally(
    csvContent: string,
    headers?: string[]
  ): {
    valid: boolean;
    errors: ImportError[];
    warnings: ImportWarning[];
    parsedData: Record<string, any>[];
    summary: {
      total: number;
      valid: number;
      invalid: number;
      warnings: number;
    };
  } {
    try {
      const rows = this.parseCSV(csvContent);
      const parsedHeaders = rows.length > 0 ? rows[0] : [];
      const dataRows = rows.slice(1);
      
      const usedHeaders = headers || parsedHeaders;
      const missingHeaders = REQUIRED_HEADERS.filter((h: string) => !usedHeaders.includes(h));
      
      const errors: ImportError[] = [];
      const warnings: ImportWarning[] = [];
      const parsedData: Record<string, any>[] = [];
      let invalidCount = 0;
      let warningCount = 0;
      
      if (missingHeaders.length > 0) {
        errors.push({
          rowNumber: 0,
          email: '',
          error: `Missing required headers: ${missingHeaders.join(', ')}`,
        });
        return {
          valid: false,
          errors,
          warnings: [],
          parsedData: [],
          summary: { total: 0, valid: 0, invalid: 0, warnings: 0 },
        };
      }

      dataRows.forEach((row, index) => {
        const rowData: Record<string, any> = {};
        usedHeaders.forEach((header, colIndex) => {
          if (row[colIndex] !== undefined) {
            rowData[header] = row[colIndex];
          }
        });
        
        // Validate email
        const email = rowData.email || '';
        if (!email) {
          errors.push({
            rowNumber: index + 2,
            email: '',
            error: 'Email is required',
          });
          invalidCount++;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push({
            rowNumber: index + 2,
            email,
            error: `Invalid email format: ${email}`,
          });
          invalidCount++;
        }
        
        // Validate first name
        if (!rowData.firstName) {
          errors.push({
            rowNumber: index + 2,
            email: email || '',
            error: 'First name is required',
          });
          invalidCount++;
        }
        
        // Validate last name
        if (!rowData.lastName) {
          errors.push({
            rowNumber: index + 2,
            email: email || '',
            error: 'Last name is required',
          });
          invalidCount++;
        }
        
        // Validate role
        if (!rowData.role) {
          errors.push({
            rowNumber: index + 2,
            email: email || '',
            error: 'Role is required',
          });
          invalidCount++;
        } else if (!ROLE_MAPPING[rowData.role]) {
          warnings.push({
            rowNumber: index + 2,
            email: email || '',
            warning: `Role "${rowData.role}" not recognized, will be mapped to default`,
          });
          warningCount++;
        }
        
        parsedData.push(rowData);
      });

      return {
        valid: errors.filter(e => e.rowNumber > 0).length === 0,
        errors: errors.filter(e => e.rowNumber > 0),
        warnings,
        parsedData,
        summary: {
          total: dataRows.length,
          valid: dataRows.length - invalidCount,
          invalid: invalidCount,
          warnings: warningCount,
        },
      };
    } catch (error: any) {
      console.error('❌ Failed to validate CSV locally:', error);
      throw error;
    }
  },

  /**
   * Parse CSV content
   * @param content - CSV content
   * @returns Parsed rows
   */
  parseCSV(content: string): string[][] {
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
  },
};

export default userImportService;
