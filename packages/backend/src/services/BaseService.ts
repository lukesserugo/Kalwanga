// src/services/BaseService.ts
import { PrismaClient, Prisma } from '../generated/prisma/index.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';

// Enhanced Prisma error interface
interface PrismaError {
  code?: string;
  message?: string;
  meta?: Record<string, any>;
  clientVersion?: string;
  name?: string;
  stack?: string;
}

// Pagination interface
interface PaginationParams {
  page?: number;
  limit?: number;
}

interface PaginationResult {
  skip: number;
  take: number;
  page: number;
  limit: number;
}

// Sort interface
interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Filter interface
interface FilterParams {
  search?: string;
  [key: string]: any;
}

export abstract class BaseService {
  protected prisma: PrismaClient;

  constructor() {
    this.prisma = prisma;
  }

  /**
   * Type guard to check if error is a Prisma error
   */
  protected isPrismaError(error: unknown): error is PrismaError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as any).code === 'string'
    );
  }

  /**
   * Type guard to check if error has errors array (validation errors)
   */
  protected hasValidationErrors(error: unknown): error is { errors: any[] } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'errors' in error &&
      Array.isArray((error as any).errors)
    );
  }

  /**
   * Get error message from unknown error
   */
  protected getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (this.isPrismaError(error) && error.message) {
      return error.message;
    }
    return 'Unknown error occurred';
  }

  /**
   * Handle errors with proper AppError wrapping
   */
  protected handleError(error: unknown, context: string): never {
    logger.error(`Error in ${context}:`, error);
    
    // If it's already an AppError, re-throw it
    if (error instanceof AppError) {
      throw error;
    }

    // Handle Prisma-specific errors by checking for code property
    if (this.isPrismaError(error)) {
      const prismaError = error as PrismaError;
      
      switch (prismaError.code) {
        case 'P2000':
          throw new AppError(
            `Value is too long for the field: ${prismaError.meta?.target || 'unknown field'}`,
            400
          );
        case 'P2001':
        case 'P2025':
          throw new AppError('Record not found', 404);
        case 'P2002':
          throw new AppError(
            `A record with this ${prismaError.meta?.target || 'value'} already exists`,
            409
          );
        case 'P2003':
          throw new AppError('Foreign key constraint failed', 400);
        case 'P2004':
          throw new AppError('A constraint failed on the database', 400);
        case 'P2005':
        case 'P2006':
        case 'P2011':
        case 'P2012':
        case 'P2013':
          throw new AppError(
            `Invalid data: ${prismaError.meta?.field_name || 'unknown field'}`,
            400
          );
        case 'P2007':
        case 'P2008':
        case 'P2009':
        case 'P2010':
        case 'P2016':
        case 'P2017':
        case 'P2018':
        case 'P2021':
        case 'P2022':
        case 'P2026':
        case 'P2027':
        case 'P2028':
        case 'P2030':
        case 'P2031':
          throw new AppError(`Database error: ${prismaError.message || 'Unknown database error'}`, 500);
        case 'P2014':
        case 'P2015':
          throw new AppError('A related record could not be found or connected', 400);
        case 'P2019':
          throw new AppError('Input error', 400);
        case 'P2020':
          throw new AppError('Value is out of range for the field', 400);
        case 'P2023':
          throw new AppError('Inconsistent column data', 400);
        case 'P2024':
          throw new AppError('Connection timed out', 503);
        case 'P2033':
          throw new AppError('Number value out of range', 400);
        case 'P2034':
          throw new AppError('Transaction conflict, please retry', 409);
        default:
          throw new AppError(
            `Database error (${prismaError.code}): ${this.getErrorMessage(error)}`,
            500
          );
      }
    }

    // If it's a validation error (Zod or similar)
    if (this.hasValidationErrors(error)) {
      throw new AppError('Validation error', 400, error.errors);
    }

    // If it's a standard Error
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('not found')) {
        throw new AppError(error.message, 404);
      }
      if (message.includes('already exists') || message.includes('duplicate')) {
        throw new AppError(error.message, 409);
      }
      if (message.includes('unauthorized') || message.includes('unauthenticated')) {
        throw new AppError(error.message, 401);
      }
      if (message.includes('forbidden') || message.includes('not allowed')) {
        throw new AppError(error.message, 403);
      }
      if (message.includes('invalid') || message.includes('required')) {
        throw new AppError(error.message, 400);
      }
      if (message.includes('insufficient')) {
        throw new AppError(error.message, 422);
      }
      
      throw new AppError(
        error.message || `An error occurred in ${context}`,
        500
      );
    }

    // Default error
    throw new AppError(
      `An error occurred in ${context}`,
      500
    );
  }

  /**
   * Execute a callback within a database transaction
   */
  protected async executeWithTransaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: {
      timeout?: number;
      maxWait?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    }
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        return await callback(tx);
      }, options);
    } catch (error) {
      return this.handleError(error, 'Transaction');
    }
  }

  /**
   * Execute a callback with retry logic for transient errors
   */
  protected async executeWithRetry<T>(
    callback: () => Promise<T>,
    options?: {
      maxRetries?: number;
      delay?: number;
      retryOn?: string[];
    }
  ): Promise<T> {
    const {
      maxRetries = 3,
      delay = 1000,
      retryOn = ['P2024', 'P2034', 'P2028', 'P2031'],
    } = options || {};

    let lastError: unknown;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await callback();
      } catch (error) {
        lastError = error;
        
        // Check if error is a Prisma error that should be retried
        if (this.isPrismaError(error)) {
          const prismaError = error as PrismaError;
          if (prismaError.code && retryOn.includes(prismaError.code)) {
            const errorMsg = this.getErrorMessage(error);
            logger.warn(
              `Retry attempt ${attempt}/${maxRetries} after error [${prismaError.code}]: ${errorMsg}`
            );
            if (attempt < maxRetries) {
              await this.sleep(delay * attempt);
              continue;
            }
          }
        }
        
        // Check if it's a connection/network error
        const errorMsg = this.getErrorMessage(error).toLowerCase();
        if (
          attempt < maxRetries &&
          (errorMsg.includes('connection') || 
           errorMsg.includes('timeout') || 
           errorMsg.includes('network') ||
           errorMsg.includes('econnrefused') ||
           errorMsg.includes('econnreset'))
        ) {
          logger.warn(`Retry attempt ${attempt}/${maxRetries} after connection error: ${this.getErrorMessage(error)}`);
          await this.sleep(delay * attempt);
          continue;
        }
        
        // If we get here, it's not retryable, so throw the error
        throw error;
      }
    }
    
    // If we exhausted all retries, throw the last error
    if (lastError instanceof Error) {
      throw lastError;
    }
    throw new AppError('Operation failed after multiple retries', 500);
  }

  /**
   * Execute a callback with logging
   */
  protected async executeWithLogging<T>(
    callback: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await callback();
      const duration = Date.now() - startTime;
      
      if (duration > 1000) {
        logger.warn(`⚠️ ${operationName} completed slowly in ${duration}ms`);
      } else {
        logger.info(`✅ ${operationName} completed in ${duration}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`❌ ${operationName} failed after ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Sleep helper for retry logic
   */
  protected async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get pagination parameters
   */
  protected getPagination(page: number = 1, limit: number = 10): PaginationResult {
    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.min(200, Math.max(1, limit));
    const skip = (validatedPage - 1) * validatedLimit;
    
    return {
      skip,
      take: validatedLimit,
      page: validatedPage,
      limit: validatedLimit,
    };
  }

  /**
   * Build search conditions for common fields
   */
  protected buildSearchConditions(
    search: string | undefined,
    fields: string[],
    mode: 'insensitive' | 'sensitive' = 'insensitive'
  ): any[] {
    if (!search || search.trim().length === 0) return [];
    
    const trimmedSearch = search.trim();
    
    return fields.map(field => ({
      [field]: { contains: trimmedSearch, mode },
    }));
  }

  /**
   * Build OR search conditions across multiple fields
   */
  protected buildOrSearch(
    search: string | undefined,
    fields: string[]
  ): any {
    if (!search || search.trim().length === 0) return undefined;
    
    return {
      OR: this.buildSearchConditions(search, fields),
    };
  }

  /**
   * Build filter conditions for boolean fields
   */
  protected buildBooleanFilter(
    value: boolean | string | undefined
  ): boolean | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  }

  /**
   * Build filter conditions for number ranges
   */
  protected buildNumberRange(
    min?: number | string,
    max?: number | string
  ): { gte?: number; lte?: number } | undefined {
    const result: { gte?: number; lte?: number } = {};
    
    if (min !== undefined && min !== null && min !== '') {
      const parsedMin = typeof min === 'string' ? parseFloat(min) : min;
      if (!isNaN(parsedMin)) result.gte = parsedMin;
    }
    if (max !== undefined && max !== null && max !== '') {
      const parsedMax = typeof max === 'string' ? parseFloat(max) : max;
      if (!isNaN(parsedMax)) result.lte = parsedMax;
    }
    
    return Object.keys(result).length > 0 ? result : undefined;
  }

  /**
   * Build date range filter
   */
  protected buildDateRange(
    startDate?: Date | string,
    endDate?: Date | string,
    field: string = 'createdAt'
  ): any {
    const result: any = {};
    
    if (startDate) {
      result.gte = typeof startDate === 'string' ? new Date(startDate) : startDate;
    }
    if (endDate) {
      result.lte = typeof endDate === 'string' ? new Date(endDate) : endDate;
    }
    
    return Object.keys(result).length > 0 ? { [field]: result } : undefined;
  }

  /**
   * Build sort order
   */
  protected buildSortOrder(
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    validFields: string[] = [],
    defaultSort: string = 'createdAt',
    defaultOrder: 'asc' | 'desc' = 'desc'
  ): any {
    const field = validFields.includes(sortBy || '') ? sortBy : defaultSort;
    const order = sortOrder || defaultOrder;
    
    return { [field!]: order };
  }

  /**
   * Soft delete a record
   */
  protected async softDelete(
    model: any,
    id: string,
    userId?: string
  ): Promise<any> {
    return await model.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
        deletedBy: userId || null,
      },
    });
  }

  /**
   * Restore a soft-deleted record
   */
  protected async restore(
    model: any,
    id: string,
    userId?: string
  ): Promise<any> {
    return await model.update({
      where: { id },
      data: {
        isActive: true,
        deletedAt: null,
        deletedBy: null,
        restoredBy: userId || null,
        restoredAt: new Date(),
      },
    });
  }

  /**
   * Check if a record exists
   */
  protected async exists(
    model: any,
    where: any
  ): Promise<boolean> {
    const count = await model.count({ where });
    return count > 0;
  }

  /**
   * Get a record or throw not found error
   */
  protected async getOrThrow(
    model: any,
    where: any,
    include?: any,
    errorMessage?: string
  ): Promise<any> {
    const record = await model.findFirst({
      where,
      include,
    });
    
    if (!record) {
      throw new AppError(errorMessage || 'Record not found', 404);
    }
    
    return record;
  }

  /**
   * Create audit log
   */
  protected async createAuditLog(data: {
    action: string;
    entityType: string;
    entityId: string;
    entityName?: string;
    changes?: any;
    userId?: string;
    severity?: string;
    businessUnitId?: string;
    companyId?: string;
  }): Promise<void> {
    try {
      // Validate user exists if userId is provided
      let userExists = false;
      if (data.userId) {
        try {
          const user = await this.prisma.user.findUnique({
            where: { id: data.userId }
          });
          userExists = !!user;
        } catch (error) {
          logger.warn('Failed to validate user for audit log:', error);
        }
      }

      // Only create audit log if user exists or no userId provided
      if (!data.userId || userExists) {
        await this.prisma.auditLog.create({
          data: {
            action: data.action as any,
            entityType: data.entityType,
            entityId: data.entityId,
            entityName: data.entityName || null,
            changes: data.changes || null,
            userId: data.userId || null,
            severity: (data.severity as any) || 'INFO',
            businessUnitId: data.businessUnitId || null,
            companyId: data.companyId || null,
          } as any,
        });
        logger.debug(`Audit log created: ${data.action} on ${data.entityType} ${data.entityId}`);
      } else {
        logger.warn(`Audit log skipped: User ${data.userId} not found`);
      }
    } catch (error) {
      logger.warn('Failed to create audit log:', error);
      // Don't throw - audit logging should not break main operations
    }
  }

  /**
   * Create notification
   */
  protected async createNotification(data: {
    title: string;
    message: string;
    type: string;
    userId: string;
    businessUnitId?: string;
    companyId?: string;
    priority?: string;
    link?: string;
  }): Promise<void> {
    try {
      // Validate user exists
      const user = await this.prisma.user.findUnique({
        where: { id: data.userId }
      });

      if (!user) {
        logger.warn(`Notification skipped: User ${data.userId} not found`);
        return;
      }

      // Map string type to enum values
      const notificationTypeMap: Record<string, any> = {
        'SALE': 'SALE',
        'INVENTORY': 'INVENTORY',
        'ORDER': 'ORDER',
        'PAYMENT': 'PAYMENT',
        'CUSTOMER': 'CUSTOMER',
        'SYSTEM': 'SYSTEM',
        'ALERT': 'ALERT',
        'SUCCESS': 'SUCCESS',
        'INFO': 'INFO',
        'WARNING': 'WARNING',
        'ERROR': 'ERROR',
        'PROMOTION': 'PROMOTION',
        'REMINDER': 'REMINDER',
      };

      const typeEnum = notificationTypeMap[data.type] || 'INFO';
      const priorityEnum = (data.priority as any) || 'MEDIUM';

      await this.prisma.notification.create({
        data: {
          title: data.title,
          message: data.message,
          type: typeEnum,
          priority: priorityEnum,
          userId: data.userId,
          businessUnitId: data.businessUnitId || null,
          companyId: data.companyId || null,
          link: data.link || null,
          isRead: false,
        } as any,
      });
      
      logger.debug(`Notification created for user ${data.userId}: ${data.title}`);
    } catch (error) {
      logger.warn('Failed to create notification:', error);
      // Don't throw - notification should not break main operations
    }
  }

  /**
   * Generate unique ID
   */
  protected generateId(prefix: string = ''): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `${prefix}${timestamp}${random}`;
  }

  /**
   * Generate unique number
   */
  protected generateNumber(prefix: string = ''): string {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}${timestamp}${random}`;
  }

  /**
   * Parse JSON safely
   */
  protected parseJSON(value: any, defaultValue: any = null): any {
    if (value === null || value === undefined) return defaultValue;
    if (typeof value === 'object') return value;
    
    try {
      return JSON.parse(value);
    } catch {
      return defaultValue;
    }
  }

  /**
   * Stringify JSON safely
   */
  protected stringifyJSON(value: any): string | null {
    if (value === null || value === undefined) return null;
    
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }

  /**
   * Check if value is empty
   */
  protected isEmpty(value: any): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  }

  /**
   * Validate email format
   */
  protected isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone format
   */
  protected isValidPhone(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s-]{10,}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Sanitize string input
   */
  protected sanitizeString(input: string): string {
    return input.trim().replace(/\s+/g, ' ');
  }

  /**
   * Normalize email
   */
  protected normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /**
   * Calculate pagination metadata
   */
  protected getPaginationMeta(total: number, page: number, limit: number) {
    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPreviousPage: page > 1,
    };
  }

  /**
   * Clean up object by removing undefined and null values
   */
  protected cleanObject(obj: any): any {
    const cleaned: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null && value !== '') {
        cleaned[key] = value;
      }
    }
    
    return cleaned;
  }

  /**
   * Remove sensitive fields from object
   */
  protected sanitizeData(data: any, sensitiveFields: string[] = ['password']): any {
    if (!data) return data;
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item, sensitiveFields));
    }
    
    if (typeof data === 'object') {
      const sanitized = { ...data };
      for (const field of sensitiveFields) {
        delete sanitized[field];
      }
      return sanitized;
    }
    
    return data;
  }

  /**
   * Validate user exists and return valid user ID
   */
  protected async validateUser(userId: string): Promise<string> {
    try {
      // Accept CUIDs, UUIDs, and Clerk IDs
      const isValidIdFormat = (id: string): boolean => {
        // CUID pattern
        const cuidRegex = /^c[a-z0-9]{24}$/i;
        // UUID pattern
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        // Clerk ID pattern (usually starts with 'user_')
        const clerkIdRegex = /^user_[a-zA-Z0-9]{20,}$/;
        // Simple alphanumeric
        const simpleIdRegex = /^[a-zA-Z0-9_-]{10,50}$/;
        
        return cuidRegex.test(id) || uuidRegex.test(id) || clerkIdRegex.test(id) || simpleIdRegex.test(id);
      };
      
      if (!isValidIdFormat(userId)) {
        throw new AppError(`Invalid user ID format: "${userId}"`, 400);
      }
      
      // Check by ID
      let user = await this.prisma.user.findUnique({
        where: { id: userId }
      });
      
      if (user) return user.id;
      
      // Check by Clerk ID
      user = await this.prisma.user.findUnique({
        where: { clerkId: userId }
      });
      
      if (user) return user.id;
      
      throw new AppError(`User with ID "${userId}" not found`, 400);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to validate user:', error);
      throw new AppError('Failed to validate user identity', 400);
    }
  }

  /**
   * Check if a record exists by ID and business unit
   */
  protected async recordExists(
    model: any,
    id: string,
    businessUnitId?: string
  ): Promise<boolean> {
    const where: any = { id };
    if (businessUnitId) {
      where.businessUnitId = businessUnitId;
    }
    return await this.exists(model, where);
  }

  /**
   * Validate business unit access
   */
  protected async validateBusinessUnitAccess(
    businessUnitId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const membership = await this.prisma.businessUnitUser.findFirst({
        where: {
          businessUnitId,
          userId,
          isActive: true,
        },
      });
      return !!membership;
    } catch (error) {
      logger.warn('Failed to validate business unit access:', error);
      return false;
    }
  }

  /**
   * Get current timestamp as ISO string
   */
  protected getCurrentTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Format currency value
   */
  protected formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  }

  /**
   * Calculate percentage
   */
  protected calculatePercentage(value: number, total: number): number {
    if (total === 0) return 0;
    return (value / total) * 100;
  }
}

// Export utility types
export type { PaginationParams, PaginationResult, SortParams, FilterParams, PrismaError };
