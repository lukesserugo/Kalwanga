// src/services/bookkeepingService.ts
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { AccountType, AccountCategory, Prisma } from '../generated/prisma/index.js';

interface JournalEntry {
  id: string;
  date: Date;
  account: string;
  debit: number;
  credit: number;
  description: string;
  reference: string;
  businessUnitId: string;
}

interface JournalLine {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
}

interface TaxCalculation {
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  taxBreakdown: {
    federal: number;
    state: number;
    local: number;
    vat: number;
    salesTax: number;
  };
}

interface FinancialReport {
  period: { startDate: Date; endDate: Date };
  totalRevenue: number;
  totalTax: number;
  totalDiscount: number;
  netRevenue: number;
  totalTransactions: number;
  averageTransaction: number;
  paymentsByMethod: Record<string, number>;
  expenses?: number;
  grossProfit?: number;
  netProfit?: number;
}

interface BalanceSheet {
  assets: {
    cash: number;
    inventory: number;
    accountsReceivable: number;
    fixedAssets: number;
    totalAssets: number;
  };
  liabilities: {
    accountsPayable: number;
    taxesPayable: number;
    loansPayable: number;
    totalLiabilities: number;
  };
  equity: {
    ownerEquity: number;
    retainedEarnings: number;
    totalEquity: number;
  };
  totalLiabilitiesAndEquity: number;
}

export class BookkeepingService {
  /**
   * Automatically record a sale in the journal
   */
  async recordSale(saleId: string, businessUnitId: string): Promise<JournalEntry[]> {
    try {
      const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        include: { 
          items: {
            include: { product: true },
          },
          payments: true,
        },
      });

      if (!sale) {
        throw new AppError('Sale not found', 404);
      }

      // Check if journal entries already exist for this sale
      const existingEntries = await prisma.journalEntry.findMany({
        where: { reference: sale.receiptNumber },
      });

      if (existingEntries.length > 0) {
        console.log(`Journal entries already exist for sale ${sale.receiptNumber}`);
        return existingEntries.map(entry => ({
          id: entry.id,
          date: entry.date,
          account: '',
          debit: 0,
          credit: 0,
          description: entry.description || '',
          reference: entry.reference || '',
          businessUnitId: entry.businessUnitId,
        }));
      }

      const entries: JournalEntry[] = [];
      const timestamp = Date.now();

      // Find or create accounts
      const accounts = await this.ensureDefaultAccounts(businessUnitId);
      
      // Create journal entry for the sale
      const journalEntry = await prisma.journalEntry.create({
        data: {
          entryNumber: `JE-${sale.receiptNumber}-${timestamp}`,
          date: sale.saleDate,
          description: `Sale ${sale.receiptNumber}`,
          reference: sale.receiptNumber,
          businessUnitId,
          createdBy: sale.userId || 'system',
          lines: {
            create: [
              // Debit: Cash/Accounts Receivable
              {
                accountId: accounts.cash.id,
                debit: sale.total,
                credit: 0,
                description: `Cash received from sale ${sale.receiptNumber}`,
              },
              // Credit: Sales Revenue
              {
                accountId: accounts.salesRevenue.id,
                debit: 0,
                credit: sale.subtotal,
                description: `Revenue from sale ${sale.receiptNumber}`,
              },
              // Credit: Sales Tax Payable (if applicable)
              ...(sale.tax > 0 ? [{
                accountId: accounts.salesTaxPayable.id,
                debit: 0,
                credit: sale.tax,
                description: `Tax collected on sale ${sale.receiptNumber}`,
              }] : []),
              // Debit: Cost of Goods Sold
              ...(sale.items.length > 0 ? [{
                accountId: accounts.cogs.id,
                debit: sale.items.reduce((sum: number, item: any) => 
                  sum + (item.quantity * (item.product.costPrice || 0)), 0),
                credit: 0,
                description: `Cost of goods sold for sale ${sale.receiptNumber}`,
              }] : []),
            ],
          },
        },
        include: {
          lines: {
            include: { account: true },
          },
        },
      });

      // Convert to JournalEntry format
      for (const line of journalEntry.lines) {
        entries.push({
          id: `${journalEntry.id}-${line.id}`,
          date: journalEntry.date,
          account: line.account.code,
          debit: line.debit,
          credit: line.credit,
          description: line.description || journalEntry.description || '',
          reference: journalEntry.reference || '',
          businessUnitId: journalEntry.businessUnitId,
        });
      }

      // Update sale to mark as recorded
      await prisma.sale.update({
        where: { id: saleId },
        data: { journalRecorded: true } as any,
      });

      console.log(`Journal entries created for sale ${sale.receiptNumber}`);
      return entries;
    } catch (error) {
      console.error('Record sale error:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to record sale in journal', 500);
    }
  }

  /**
   * Calculate taxes automatically
   */
  async calculateTax(subtotal: number, businessUnitId: string): Promise<TaxCalculation> {
    try {
      if (subtotal < 0) {
        throw new AppError('Subtotal cannot be negative', 400);
      }

      const businessUnit = await prisma.businessUnit.findUnique({
        where: { id: businessUnitId },
        include: { 
          company: {
            include: {
              settings: true,
            },
          },
        },
      });

      if (!businessUnit) {
        throw new AppError('Business unit not found', 404);
      }

      // Fetch company settings
      const companySettings = businessUnit?.company?.settings;
      const taxRate = (companySettings as any)?.taxRate || 0;
      const taxAmount = subtotal * (taxRate / 100);

      // Calculate tax breakdown (simplified for demonstration)
      const breakdown = {
        federal: taxAmount * 0.3,
        state: taxAmount * 0.4,
        local: taxAmount * 0.2,
        vat: taxAmount * 0.1,
        salesTax: taxAmount,
      };

      const calculation: TaxCalculation = {
        subtotal,
        taxRate,
        taxAmount,
        total: subtotal + taxAmount,
        taxBreakdown: breakdown,
      };

      // Skip persistence if taxCalculation model doesn't exist
      console.log('Tax calculation:', calculation);

      return calculation;
    } catch (error) {
      console.error('Calculate tax error:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to calculate tax', 500);
    }
  }

  /**
   * Generate financial reports
   */
  async generateFinancialReport(businessUnitId: string, startDate: Date, endDate: Date): Promise<FinancialReport> {
    try {
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }
      if (startDate > endDate) {
        throw new AppError('Start date must be before end date', 400);
      }

      const sales = await prisma.sale.findMany({
        where: {
          businessUnitId,
          saleDate: { gte: startDate, lte: endDate },
          status: { not: 'CANCELLED' },
        },
        include: { 
          payments: true,
          items: {
            include: { product: true },
          },
        },
      });

      const totalRevenue = sales.reduce((sum: number, s: any) => sum + s.total, 0);
      const totalTax = sales.reduce((sum: number, s: any) => sum + s.tax, 0);
      const totalDiscount = sales.reduce((sum: number, s: any) => sum + s.discount, 0);
      
      // Calculate cost of goods sold
      const totalCOGS = sales.reduce((sum: number, sale: any) => {
        return sum + sale.items.reduce((itemSum: number, item: any) => {
          const costPrice = item.product.costPrice || item.product.unitPrice || 0;
          return itemSum + (costPrice * item.quantity);
        }, 0);
      }, 0);

      const paymentsByMethod = sales.reduce((acc: Record<string, number>, sale: any) => {
        const method = sale.payments[0]?.paymentMethod || 'UNKNOWN';
        acc[method] = (acc[method] || 0) + sale.total;
        return acc;
      }, {});

      // Skip expense tracking if model doesn't exist
      let totalExpenses = 0;
      console.log('Expense tracking skipped');

      const report: FinancialReport = {
        period: { startDate, endDate },
        totalRevenue,
        totalTax,
        totalDiscount,
        netRevenue: totalRevenue - totalTax,
        totalTransactions: sales.length,
        averageTransaction: totalRevenue / (sales.length || 1),
        paymentsByMethod,
        expenses: totalExpenses,
        grossProfit: totalRevenue - totalCOGS,
        netProfit: totalRevenue - totalCOGS - totalExpenses - totalTax,
      };

      // Skip persistence if financialReport model doesn't exist
      console.log('Financial report generated:', report.period);

      return report;
    } catch (error) {
      console.error('Generate financial report error:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to generate financial report', 500);
    }
  }

  /**
   * Generate balance sheet
   */
  async generateBalanceSheet(businessUnitId: string): Promise<BalanceSheet> {
    try {
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      // Get inventory value
      const inventory = await prisma.inventory.findMany({
        where: { businessUnitId },
        include: { product: true },
      });

      const inventoryValue = inventory.reduce((sum: number, inv: any) => {
        return sum + (inv.quantity * (inv.product.costPrice || inv.product.unitPrice || 0));
      }, 0);

      // Get cash balance
      const cashRegisters = await prisma.cashRegister.findMany({
        where: { businessUnitId, isActive: true },
      });

      const totalCash = cashRegisters.reduce((sum: number, cr: any) => sum + cr.cashBalance, 0);

      // Skip accounts receivable/payable if models don't exist
      const accountsReceivable = 0;
      const accountsPayable = 0;

      // Calculate totals
      const totalAssets = totalCash + inventoryValue + accountsReceivable;
      const totalLiabilities = accountsPayable;
      const retainedEarnings = totalAssets - totalLiabilities;

      const balanceSheet: BalanceSheet = {
        assets: {
          cash: totalCash,
          inventory: inventoryValue,
          accountsReceivable,
          fixedAssets: 0,
          totalAssets,
        },
        liabilities: {
          accountsPayable,
          taxesPayable: 0,
          loansPayable: 0,
          totalLiabilities,
        },
        equity: {
          ownerEquity: 0,
          retainedEarnings,
          totalEquity: retainedEarnings,
        },
        totalLiabilitiesAndEquity: totalLiabilities + retainedEarnings,
      };

      // Skip persistence if financialReport model doesn't exist
      console.log('Balance sheet generated');

      return balanceSheet;
    } catch (error) {
      console.error('Generate balance sheet error:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to generate balance sheet', 500);
    }
  }

  /**
   * Generate trial balance
   */
  async generateTrialBalance(businessUnitId: string): Promise<any[]> {
    try {
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const accounts = await prisma.account.findMany({
        where: { businessUnitId },
        include: { 
          lines: true,
        },
      });

      const trialBalance = accounts.map((account: any) => {
        const totalDebit = account.lines.reduce((sum: number, line: any) => sum + line.debit, 0);
        const totalCredit = account.lines.reduce((sum: number, line: any) => sum + line.credit, 0);
        
        return {
          id: account.id,
          code: account.code,
          name: account.name,
          type: account.type,
          debit: totalDebit,
          credit: totalCredit,
          balance: totalDebit - totalCredit,
          balanceType: totalDebit > totalCredit ? 'DEBIT' : totalCredit > totalDebit ? 'CREDIT' : 'BALANCED',
        };
      });

      // Verify trial balance
      const totalDebits = trialBalance.reduce((sum: number, account: any) => sum + account.debit, 0);
      const totalCredits = trialBalance.reduce((sum: number, account: any) => sum + account.credit, 0);
      
      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        console.warn(`Trial balance out of balance: Debits=${totalDebits}, Credits=${totalCredits}`);
      }

      return trialBalance;
    } catch (error) {
      console.error('Generate trial balance error:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to generate trial balance', 500);
    }
  }

  /**
   * Ensure default accounts exist for a business unit
   */
  private async ensureDefaultAccounts(businessUnitId: string): Promise<Record<string, any>> {
    const defaultAccounts = [
      { code: '1000', name: 'Cash', type: 'ASSET' as AccountType, category: 'CURRENT_ASSET' as AccountCategory },
      { code: '4000', name: 'Sales Revenue', type: 'REVENUE' as AccountType, category: 'OPERATING_REVENUE' as AccountCategory },
      { code: '2000', name: 'Sales Tax Payable', type: 'LIABILITY' as AccountType, category: 'CURRENT_LIABILITY' as AccountCategory },
      { code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE' as AccountType, category: 'OPERATING_EXPENSE' as AccountCategory },
      { code: '1100', name: 'Accounts Receivable', type: 'ASSET' as AccountType, category: 'CURRENT_ASSET' as AccountCategory },
      { code: '2100', name: 'Accounts Payable', type: 'LIABILITY' as AccountType, category: 'CURRENT_LIABILITY' as AccountCategory },
    ];

    const accounts: Record<string, any> = {};

    for (const account of defaultAccounts) {
      let dbAccount = await prisma.account.findFirst({
        where: {
          businessUnitId,
          code: account.code,
        },
      });

      if (!dbAccount) {
        dbAccount = await prisma.account.create({
          data: {
            ...account,
            businessUnitId,
            isActive: true,
          },
        });
      }

      // Map to friendly names
      const keyMap: Record<string, string> = {
        '1000': 'cash',
        '4000': 'salesRevenue',
        '2000': 'salesTaxPayable',
        '5000': 'cogs',
        '1100': 'accountsReceivable',
        '2100': 'accountsPayable',
      };

      accounts[keyMap[account.code]] = dbAccount;
    }

    return accounts;
  }

  /**
   * Create a manual journal entry
   */
  async createJournalEntry(data: {
    businessUnitId: string;
    createdBy: string;
    description: string;
    reference?: string;
    date: Date;
    lines: JournalLine[];
  }): Promise<any> {
    try {
      // Validate lines balance
      const totalDebit = data.lines.reduce((sum: number, line: any) => sum + line.debit, 0);
      const totalCredit = data.lines.reduce((sum: number, line: any) => sum + line.credit, 0);
      
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new AppError('Journal entry must balance (debits must equal credits)', 400);
      }

      if (data.lines.length < 2) {
        throw new AppError('Journal entry must have at least 2 lines', 400);
      }

      const entry = await prisma.journalEntry.create({
        data: {
          entryNumber: `JE-MANUAL-${Date.now()}`,
          date: data.date,
          description: data.description,
          reference: data.reference,
          businessUnitId: data.businessUnitId,
          createdBy: data.createdBy,
          lines: {
            create: data.lines,
          },
        },
        include: {
          lines: {
            include: { account: true },
          },
        },
      });

      return entry;
    } catch (error) {
      console.error('Create journal entry error:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create journal entry', 500);
    }
  }
}

export const bookkeepingService = new BookkeepingService();
