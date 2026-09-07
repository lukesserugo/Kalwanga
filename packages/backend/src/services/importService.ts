// src/services/importService.ts
import { prisma } from '../lib/prisma.js';
import * as fs from 'fs';
import * as path from 'path';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import { generateSKU } from '../utils/helpers.js';
import * as crypto from 'crypto';
import bcrypt from 'bcrypt';
import { UserRole } from '../generated/prisma/index.js';

// Enhanced types
interface ImportResult {
  total: number;
  succeeded: number;
  failed: number;
  results: Array<{
    success: boolean;
    data?: any;
    error?: string;
    row?: number;
  }>;
  errors: Array<{
    row: number;
    error: string;
    data?: any;
  }>;
}

interface ImportOptions {
  businessUnitId?: string;
  companyId?: string;
  userId: string;
  skipDuplicates?: boolean;
  updateExisting?: boolean;
}

export class ImportService {
  private uploadDir = path.join(process.cwd(), 'uploads', 'imports');
  private maxFileSize = 50 * 1024 * 1024;

  constructor() {
    this.ensureUploadDirectory();
  }

  private ensureUploadDirectory(): void {
    try {
      if (!fs.existsSync(this.uploadDir)) {
        fs.mkdirSync(this.uploadDir, { recursive: true });
      }
    } catch (error) {
      logger.error('Failed to create upload directory:', error);
    }
  }

  private validateFile(file: any): void {
    if (!file) throw new AppError('No file provided', 400);
    if (!file.buffer || file.buffer.length === 0) throw new AppError('File is empty', 400);
    if (file.size > this.maxFileSize) throw new AppError(`File size exceeds maximum allowed (${this.maxFileSize / 1024 / 1024}MB)`, 400);
  }

  /**
   * Parse file based on extension
   */
  private async parseFile(file: any): Promise<any[]> {
    const extension = path.extname(file.originalname || '').toLowerCase();
    
    try {
      switch (extension) {
        case '.csv':
          return this.parseCSV(file.buffer);
        case '.json':
          return this.parseJSON(file.buffer);
        default:
          throw new AppError(`Unsupported file format: ${extension}. Use CSV or JSON`, 400);
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to parse file', 400);
    }
  }

  /**
   * Parse CSV buffer to JSON array
   */
  private parseCSV(buffer: Buffer): any[] {
    try {
      const content = buffer.toString('utf-8');
      const lines = content.split('\n').filter(line => line.trim().length > 0);
      
      if (lines.length < 2) {
        return [];
      }

      // Parse header row
      const headers = this.parseCSVLine(lines[0]);
      
      // Parse data rows
      const records: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i]);
        const record: any = {};
        
        headers.forEach((header: string, index: number) => {
          record[header.trim()] = values[index] !== undefined ? values[index].trim() : '';
        });
        
        records.push(record);
      }

      return records;
    } catch (error) {
      throw new AppError('Failed to parse CSV file', 400);
    }
  }

  /**
   * Parse a single CSV line respecting quotes
   */
  private parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    values.push(current.trim());
    return values;
  }

  /**
   * Parse JSON buffer
   */
  private parseJSON(buffer: Buffer): any[] {
    try {
      const data = JSON.parse(buffer.toString('utf-8'));
      return Array.isArray(data) ? data : [data];
    } catch (error) {
      throw new AppError('Failed to parse JSON file', 400);
    }
  }

  /**
   * Import products from file
   */
  async importProducts(file: any, options: ImportOptions): Promise<ImportResult> {
    this.validateFile(file);
    const records = await this.parseFile(file);
    const results: Array<{ success: boolean; data?: any; error?: string; row?: number }> = [];
    const errors: Array<{ row: number; error: string; data?: any }> = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + 2;

      try {
        if (!record.name || !String(record.name).trim()) {
          throw new Error('Product name is required');
        }

        const sku = String(record.sku || generateSKU()).toUpperCase();
        const existingProduct = await prisma.product.findFirst({
          where: { sku, businessUnitId: options.businessUnitId },
        });

        if (existingProduct) {
          if (options.skipDuplicates) continue;
          if (options.updateExisting) {
            const updated = await prisma.product.update({
              where: { id: existingProduct.id },
              data: {
                name: String(record.name) || existingProduct.name,
                description: record.description ? String(record.description) : existingProduct.description,
                unitPrice: parseFloat(record.unitPrice) || existingProduct.unitPrice,
                costPrice: parseFloat(record.costPrice) || existingProduct.costPrice,
                barcode: record.barcode ? String(record.barcode) : existingProduct.barcode,
              },
            });
            results.push({ success: true, data: updated, row: rowNumber });
            continue;
          }
          throw new Error(`Product with SKU ${sku} already exists`);
        }

        // Find or create category
        let categoryId: string | null = null;
        if (record.category) {
          let category = await prisma.category.findFirst({
            where: {
              name: { equals: String(record.category), mode: 'insensitive' },
              businessUnitId: options.businessUnitId,
            },
          });

          if (!category) {
            category = await prisma.category.create({
              data: {
                name: String(record.category),
                businessUnitId: options.businessUnitId || '',
              },
            });
          }
          categoryId = category.id;
        }

        // Create product
        const product = await prisma.product.create({
          data: {
            name: String(record.name),
            sku,
            barcode: record.barcode ? String(record.barcode) : null,
            description: record.description ? String(record.description) : null,
            unitPrice: parseFloat(record.unitPrice) || 0,
            costPrice: parseFloat(record.costPrice) || 0,
            categoryId,
            businessUnitId: options.businessUnitId || '',
            createdBy: options.userId,
            isActive: record.status !== 'inactive',
          },
        });

        // Create inventory
        const initialStock = parseInt(record.stock) || 0;
        await prisma.inventory.create({
          data: {
            productId: product.id,
            businessUnitId: options.businessUnitId || '',
            quantity: initialStock,
            reserved: 0,
            reorderPoint: parseInt(record.reorderPoint) || 5,
            reorderQuantity: parseInt(record.reorderQuantity) || 10,
            location: record.location ? String(record.location) : 'Warehouse',
          },
        });

        results.push({ success: true, data: product, row: rowNumber });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ row: rowNumber, error: errorMessage, data: record });
        results.push({ success: false, error: errorMessage, row: rowNumber });
      }
    }

    return {
      total: records.length,
      succeeded: results.filter((r: any) => r.success).length,
      failed: errors.length,
      results,
      errors,
    };
  }

  /**
   * Import customers from file
   */
  async importCustomers(file: any, options: ImportOptions): Promise<ImportResult> {
    this.validateFile(file);
    const records = await this.parseFile(file);
    const results: Array<{ success: boolean; data?: any; error?: string; row?: number }> = [];
    const errors: Array<{ row: number; error: string; data?: any }> = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + 2;

      try {
        if (!record.email || !String(record.email).trim()) {
          throw new Error('Email is required');
        }

        const email = String(record.email).toLowerCase();
        const existingCustomer = await prisma.customer.findUnique({
          where: { email },
        });

        if (existingCustomer) {
          if (options.skipDuplicates) continue;
          if (options.updateExisting) {
            const updated = await prisma.customer.update({
              where: { id: existingCustomer.id },
              data: {
                firstName: record.firstName ? String(record.firstName) : existingCustomer.firstName,
                lastName: record.lastName ? String(record.lastName) : existingCustomer.lastName,
                phoneNumber: record.phoneNumber ? String(record.phoneNumber) : existingCustomer.phoneNumber,
                address: record.address ? String(record.address) : existingCustomer.address,
                city: record.city ? String(record.city) : existingCustomer.city,
                country: record.country ? String(record.country) : existingCustomer.country,
              },
            });
            results.push({ success: true, data: updated, row: rowNumber });
            continue;
          }
          throw new Error(`Customer with email ${email} already exists`);
        }

        // FIXED: Ensure required fields are non-null
        const customer = await prisma.customer.create({
          data: {
            email,
            firstName: record.firstName ? String(record.firstName) : '',
            lastName: record.lastName ? String(record.lastName) : '',
            phoneNumber: record.phoneNumber ? String(record.phoneNumber) : '',
            address: record.address ? String(record.address) : null,
            city: record.city ? String(record.city) : null,
            state: record.state ? String(record.state) : null,
            zipCode: record.zipCode ? String(record.zipCode) : null,
            country: record.country ? String(record.country) : 'Uganda',
            companyId: options.companyId || '',
          },
        });

        results.push({ success: true, data: customer, row: rowNumber });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ row: rowNumber, error: errorMessage, data: record });
        results.push({ success: false, error: errorMessage, row: rowNumber });
      }
    }

    return {
      total: records.length,
      succeeded: results.filter((r: any) => r.success).length,
      failed: errors.length,
      results,
      errors,
    };
  }

  /**
   * Import suppliers from file
   */
  async importSuppliers(file: any, options: ImportOptions): Promise<ImportResult> {
    this.validateFile(file);
    const records = await this.parseFile(file);
    const results: Array<{ success: boolean; data?: any; error?: string; row?: number }> = [];
    const errors: Array<{ row: number; error: string; data?: any }> = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + 2;

      try {
        if (!record.name || !String(record.name).trim()) {
          throw new Error('Supplier name is required');
        }

        const existingSupplier = await prisma.supplier.findFirst({
          where: {
            name: { equals: String(record.name), mode: 'insensitive' },
            companyId: options.companyId,
          },
        });

        if (existingSupplier) {
          if (options.skipDuplicates) continue;
          throw new Error(`Supplier with name ${record.name} already exists`);
        }

        // FIXED: Ensure required fields are non-null
        const supplier = await prisma.supplier.create({
          data: {
            name: String(record.name),
            contactPerson: record.contactPerson ? String(record.contactPerson) : null,
            email: record.email ? String(record.email) : '',
            phone: record.phone ? String(record.phone) : '',
            address: record.address ? String(record.address) : null,
            taxId: record.taxId ? String(record.taxId) : null,
            website: record.website ? String(record.website) : null,
            notes: record.notes ? String(record.notes) : null,
            companyId: options.companyId || '',
          },
        });

        results.push({ success: true, data: supplier, row: rowNumber });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ row: rowNumber, error: errorMessage, data: record });
        results.push({ success: false, error: errorMessage, row: rowNumber });
      }
    }

    return {
      total: records.length,
      succeeded: results.filter((r: any) => r.success).length,
      failed: errors.length,
      results,
      errors,
    };
  }

  /**
   * Import inventory updates from file
   */
  async importInventory(file: any, options: ImportOptions): Promise<ImportResult> {
    this.validateFile(file);
    const records = await this.parseFile(file);
    const results: Array<{ success: boolean; data?: any; error?: string; row?: number }> = [];
    const errors: Array<{ row: number; error: string; data?: any }> = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + 2;

      try {
        if (!record.sku) throw new Error('SKU is required');

        const sku = String(record.sku).toUpperCase();
        const product = await prisma.product.findFirst({
          where: { sku, businessUnitId: options.businessUnitId },
        });

        if (!product) throw new Error(`Product with SKU ${sku} not found`);

        const quantity = parseInt(record.quantity) || 0;
        const inventory = await prisma.inventory.findFirst({
          where: { productId: product.id, businessUnitId: options.businessUnitId },
        });

        if (inventory) {
          await prisma.inventory.update({
            where: { id: inventory.id },
            data: {
              quantity,
              reorderPoint: parseInt(record.reorderPoint) || inventory.reorderPoint,
              reorderQuantity: parseInt(record.reorderQuantity) || inventory.reorderQuantity,
              location: record.location ? String(record.location) : inventory.location,
              lastUpdated: new Date(),
            },
          });
        } else {
          await prisma.inventory.create({
            data: {
              productId: product.id,
              businessUnitId: options.businessUnitId || '',
              quantity,
              reserved: 0,
              reorderPoint: parseInt(record.reorderPoint) || 5,
              reorderQuantity: parseInt(record.reorderQuantity) || 10,
              location: record.location ? String(record.location) : 'Warehouse',
            },
          });
        }

        results.push({ success: true, data: { sku, quantity }, row: rowNumber });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ row: rowNumber, error: errorMessage, data: record });
        results.push({ success: false, error: errorMessage, row: rowNumber });
      }
    }

    return {
      total: records.length,
      succeeded: results.filter((r: any) => r.success).length,
      failed: errors.length,
      results,
      errors,
    };
  }

  /**
   * Import users from file
   */
  async importUsers(file: any, options: ImportOptions): Promise<ImportResult> {
    this.validateFile(file);
    const records = await this.parseFile(file);
    const results: Array<{ success: boolean; data?: any; error?: string; row?: number }> = [];
    const errors: Array<{ row: number; error: string; data?: any }> = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + 2;

      try {
        if (!record.email || !String(record.email).trim()) throw new Error('Email is required');
        if (!record.firstName) throw new Error('First name is required');
        if (!record.lastName) throw new Error('Last name is required');

        const email = String(record.email).toLowerCase();
        const existingUser = await prisma.user.findUnique({ where: { email } });

        if (existingUser) {
          if (options.skipDuplicates) continue;
          throw new Error(`User with email ${email} already exists`);
        }

        const defaultPassword = record.password ? String(record.password) : `Temp@${Date.now()}`;
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);

        const user = await prisma.user.create({
          data: {
            email,
            firstName: String(record.firstName),
            lastName: String(record.lastName),
            phoneNumber: record.phoneNumber ? String(record.phoneNumber) : null,
            role: (record.role as UserRole) || 'EMPLOYEE',
            password: hashedPassword,
            clerkId: `user_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
            isActive: true,
          },
        });

        results.push({ success: true, data: user, row: rowNumber });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ row: rowNumber, error: errorMessage, data: record });
        results.push({ success: false, error: errorMessage, row: rowNumber });
      }
    }

    return {
      total: records.length,
      succeeded: results.filter((r: any) => r.success).length,
      failed: errors.length,
      results,
      errors,
    };
  }

  /**
   * Download import template for specified type
   */
  async downloadTemplate(type: string): Promise<string> {
    try {
      const templates: Record<string, any[]> = {
        products: [{
          name: '', sku: '', barcode: '', category: '', unitPrice: '', costPrice: '',
          stock: '', reorderPoint: '', reorderQuantity: '', location: '', description: ''
        }],
        customers: [{
          email: '', firstName: '', lastName: '', phoneNumber: '', address: '',
          city: '', state: '', zipCode: '', country: ''
        }],
        suppliers: [{
          name: '', contactPerson: '', email: '', phone: '', address: '',
          taxId: '', website: '', notes: ''
        }],
        inventory: [{
          sku: '', quantity: '', reorderPoint: '', reorderQuantity: '', location: ''
        }],
        users: [{
          email: '', firstName: '', lastName: '', phoneNumber: '', role: '', password: ''
        }],
      };

      const templateData = templates[type];
      if (!templateData) throw new AppError(`Invalid template type: ${type}`, 400);

      const fileName = `${type}_import_template.csv`;
      const filePath = path.join(this.uploadDir, fileName);

      const headers = Object.keys(templateData[0]);
      const csvContent = [
        headers.join(','),
        ...templateData.map(row => headers.map(h => `"${row[h]}"`).join(',')),
      ].join('\n');

      fs.writeFileSync(filePath, csvContent);
      return filePath;
    } catch (error) {
      logger.error('Download template error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to download template', 500);
    }
  }
}

export const importService = new ImportService();
