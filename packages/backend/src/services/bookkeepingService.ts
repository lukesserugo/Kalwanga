// src/services/bookkeepingService.ts

import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  AccountType,
  AccountCategory,
  Prisma,
} from '../generated/prisma/index.js';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface JournalLine {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface CreateJournalEntryData {
  businessUnitId: string;
  createdBy: string;
  description: string;
  reference?: string;
  date: Date;
  lines: JournalLine[];
}

export interface TaxCalculation {
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

export interface FinancialReport {
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

export interface BalanceSheet {
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

export interface TrialBalanceItem {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  debit: number;
  credit: number;
  balance: number;
  balanceType: 'DEBIT' | 'CREDIT' | 'BALANCED';
}

export interface AccountBalance {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  balance: number;
}

// ============================================
// SERVICE
// ============================================

export class BookkeepingService {
  /**
   * Automatically record a sale in the journal
   */
  async recordSale(saleId: string, businessUnitId: string): Promise<any[]> {
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
        include: {
          lines: {
            include: { account: true },
          },
        },
      });

      if (existingEntries.length > 0) {
        console.log(
          `Journal entries already exist for sale ${sale.receiptNumber}`
        );
        return existingEntries;
      }

      // Find or create accounts
      const accounts = await this.ensureDefaultAccounts(businessUnitId);

      // Create journal entry for the sale
      const journalEntry = await prisma.journalEntry.create({
        data: {
          entryNumber: `JE-${sale.receiptNumber}-${Date.now()}`,
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
              ...(sale.tax && sale.tax > 0
                ? [
                    {
                      accountId: accounts.salesTaxPayable.id,
                      debit: 0,
                      credit: sale.tax,
                      description: `Tax collected on sale ${sale.receiptNumber}`,
                    },
                  ]
                : []),
              // Debit: Cost of Goods Sold
              ...(sale.items && sale.items.length > 0
                ? [
                    {
                      accountId: accounts.cogs.id,
                      debit: sale.items.reduce(
                        (sum: number, item: any) =>
                          sum +
                          item.quantity * (item.product.costPrice || 0),
                        0
                      ),
                      credit: 0,
                      description: `Cost of goods sold for sale ${sale.receiptNumber}`,
                    },
                  ]
                : []),
            ],
          },
        },
        include: {
          lines: {
            include: { account: true },
          },
        },
      });

      // Try to update sale with journalRecorded flag (if field exists)
      try {
        await prisma.sale.update({
          where: { id: saleId },
          data: { journalRecorded: true } as any,
        });
      } catch (updateError) {
        console.log(
          'Could not update journalRecorded field (may not exist in schema)'
        );
      }

      console.log(`Journal entries created for sale ${sale.receiptNumber}`);
      return [journalEntry];
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
  async calculateTax(
    subtotal: number,
    businessUnitId: string
  ): Promise<TaxCalculation> {
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
  async generateFinancialReport(
    businessUnitId: string,
    startDate: Date,
    endDate: Date
  ): Promise<FinancialReport> {
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

      const totalRevenue = sales.reduce(
        (sum: number, s: any) => sum + (s.total || 0),
        0
      );
      const totalTax = sales.reduce(
        (sum: number, s: any) => sum + (s.tax || 0),
        0
      );
      const totalDiscount = sales.reduce(
        (sum: number, s: any) => sum + (s.discount || 0),
        0
      );

      // Calculate cost of goods sold
      const totalCOGS = sales.reduce((sum: number, sale: any) => {
        return (
          sum +
          (sale.items || []).reduce((itemSum: number, item: any) => {
            const costPrice =
              item.product?.costPrice || item.product?.unitPrice || 0;
            return itemSum + costPrice * (item.quantity || 0);
          }, 0)
        );
      }, 0);

      const paymentsByMethod = sales.reduce(
        (acc: Record<string, number>, sale: any) => {
          const method = sale.payments?.[0]?.paymentMethod || 'UNKNOWN';
          acc[method] = (acc[method] || 0) + (sale.total || 0);
          return acc;
        },
        {}
      );

      const report: FinancialReport = {
        period: { startDate, endDate },
        totalRevenue,
        totalTax,
        totalDiscount,
        netRevenue: totalRevenue - totalTax,
        totalTransactions: sales.length,
        averageTransaction: totalRevenue / (sales.length || 1),
        paymentsByMethod,
        expenses: 0,
        grossProfit: totalRevenue - totalCOGS,
        netProfit: totalRevenue - totalCOGS - totalTax,
      };

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
        return (
          sum +
          (inv.quantity || 0) *
            (inv.product?.costPrice || inv.product?.unitPrice || 0)
        );
      }, 0);

      // Get cash balance
      const cashRegisters = await prisma.cashRegister.findMany({
        where: { businessUnitId, isActive: true },
      });

      const totalCash = cashRegisters.reduce(
        (sum: number, cr: any) => sum + (cr.cashBalance || 0),
        0
      );

      // Calculate totals
      const totalAssets = totalCash + inventoryValue;
      const totalLiabilities = 0;
      const retainedEarnings = totalAssets - totalLiabilities;

      const balanceSheet: BalanceSheet = {
        assets: {
          cash: totalCash,
          inventory: inventoryValue,
          accountsReceivable: 0,
          fixedAssets: 0,
          totalAssets,
        },
        liabilities: {
          accountsPayable: 0,
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
  async generateTrialBalance(
    businessUnitId: string
  ): Promise<TrialBalanceItem[]> {
    try {
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const accounts = await prisma.account.findMany({
        where: {
          businessUnitId,
          isActive: true,
        },
        include: {
          lines: true,
        },
      });

      const trialBalance: TrialBalanceItem[] = accounts.map((account: any) => {
        const totalDebit = (account.lines || []).reduce(
          (sum: number, line: any) => sum + (line.debit || 0),
          0
        );
        const totalCredit = (account.lines || []).reduce(
          (sum: number, line: any) => sum + (line.credit || 0),
          0
        );
        const balance = totalDebit - totalCredit;

        return {
          id: account.id,
          code: account.code,
          name: account.name,
          type: account.type,
          debit: totalDebit,
          credit: totalCredit,
          balance: balance,
          balanceType:
            balance > 0 ? 'DEBIT' : balance < 0 ? 'CREDIT' : 'BALANCED',
        };
      });

      // Verify trial balance
      const totalDebits = trialBalance.reduce(
        (sum: number, account: any) => sum + account.debit,
        0
      );
      const totalCredits = trialBalance.reduce(
        (sum: number, account: any) => sum + account.credit,
        0
      );

      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        console.warn(
          `Trial balance out of balance: Debits=${totalDebits}, Credits=${totalCredits}`
        );
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
   * Get account balance
   */
  async getAccountBalance(
    accountId: string,
    businessUnitId: string
  ): Promise<AccountBalance> {
    try {
      if (!accountId) {
        throw new AppError('Account ID is required', 400);
      }
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const account = await prisma.account.findFirst({
        where: {
          id: accountId,
          businessUnitId,
        },
        include: {
          lines: true,
        },
      });

      if (!account) {
        throw new AppError('Account not found', 404);
      }

      const totalDebit = (account.lines || []).reduce(
        (sum: number, line: any) => sum + (line.debit || 0),
        0
      );
      const totalCredit = (account.lines || []).reduce(
        (sum: number, line: any) => sum + (line.credit || 0),
        0
      );

      return {
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        debit: totalDebit,
        credit: totalCredit,
        balance: totalDebit - totalCredit,
      };
    } catch (error) {
      console.error('Get account balance error:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to get account balance', 500);
    }
  }

  /**
   * Void journal entry
   */
  async voidJournalEntry(
    entryId: string,
    businessUnitId: string,
    userId: string
  ): Promise<any> {
    try {
      if (!entryId) {
        throw new AppError('Journal entry ID is required', 400);
      }
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const entry = await prisma.journalEntry.findFirst({
        where: {
          id: entryId,
          businessUnitId,
        },
        include: {
          lines: true,
        },
      });

      if (!entry) {
        throw new AppError('Journal entry not found', 404);
      }

      // Create reversing entry
      const reversingLines = (entry.lines || []).map((line: any) => ({
        accountId: line.accountId,
        debit: line.credit, // Reverse debit and credit
        credit: line.debit,
        description: `Reversal of ${entry.entryNumber}: ${line.description || ''}`,
      }));

      const reversingEntry = await prisma.journalEntry.create({
        data: {
          entryNumber: `JE-REV-${entry.entryNumber}-${Date.now()}`,
          date: new Date(),
          description: `Reversal of ${entry.entryNumber}: ${entry.description}`,
          reference: entry.reference ? `REV-${entry.reference}` : undefined,
          businessUnitId,
          createdBy: userId || 'system',
          lines: {
            create: reversingLines,
          },
        },
        include: {
          lines: {
            include: { account: true },
          },
        },
      });

      // Try to update original entry as voided (if field exists)
      try {
        await prisma.journalEntry.update({
          where: { id: entryId },
          data: { status: 'VOIDED' } as any,
        });
      } catch (updateError) {
        console.log(
          'Could not update journal entry status (field may not exist)'
        );
      }

      return reversingEntry;
    } catch (error) {
      console.error('Void journal entry error:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to void journal entry', 500);
    }
  }

  /**
   * Create a manual journal entry
   */
  async createJournalEntry(data: CreateJournalEntryData): Promise<any> {
    try {
      // Validate lines balance
      const totalDebit = data.lines.reduce(
        (sum: number, line: any) => sum + (line.debit || 0),
        0
      );
      const totalCredit = data.lines.reduce(
        (sum: number, line: any) => sum + (line.credit || 0),
        0
      );

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new AppError(
          'Journal entry must balance (debits must equal credits)',
          400
        );
      }

      if (data.lines.length < 2) {
        throw new AppError('Journal entry must have at least 2 lines', 400);
      }

      // Validate all accounts exist
      const accountIds = data.lines.map((line) => line.accountId);
      const accounts = await prisma.account.findMany({
        where: {
          id: { in: accountIds },
          businessUnitId: data.businessUnitId,
          isActive: true,
        },
        select: { id: true },
      });

      if (accounts.length !== accountIds.length) {
        throw new AppError('One or more accounts not found or inactive', 400);
      }

      const entry = await prisma.journalEntry.create({
        data: {
          entryNumber: `JE-MANUAL-${Date.now()}`,
          date: data.date || new Date(),
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

  /**
   * Ensure default accounts exist for a business unit.
   *
   * ⭐ CRITICAL FIX: Uses valid AccountCategory enum values from
   * the schema. The previous version used `CURRENT_ASSET`,
   * `OPERATING_REVENUE`, and `CURRENT_LIABILITY` — none of which
   * exist in the enum, so every call threw a Prisma validation
   * error at runtime.
   *
   * Also `public` now (was `private`), so the controller can call
   * it for seeding on first visit to the accounts page.
   *
   * Idempotent: findFirst + create per account, scoped by the
   * compound unique [businessUnitId, code]. Safe to call
   * repeatedly.
   */
  async ensureDefaultAccounts(
    businessUnitId: string
  ): Promise<Record<string, any>> {
    const defaultAccounts: Array<{
      code: string;
      name: string;
      type: AccountType;
      category: AccountCategory;
      key: string;
    }> = [
      {
        code: '1000',
        name: 'Cash',
        type: 'ASSET' as AccountType,
        category: 'CASH' as AccountCategory,
        key: 'cash',
      },
      {
        code: '1100',
        name: 'Accounts Receivable',
        type: 'ASSET' as AccountType,
        category: 'ACCOUNTS_RECEIVABLE' as AccountCategory,
        key: 'accountsReceivable',
      },
      {
        code: '1200',
        name: 'Inventory',
        type: 'ASSET' as AccountType,
        category: 'INVENTORY' as AccountCategory,
        key: 'inventory',
      },
      {
        code: '2000',
        name: 'Sales Tax Payable',
        type: 'LIABILITY' as AccountType,
        category: 'SALES_TAX_PAYABLE' as AccountCategory,
        key: 'salesTaxPayable',
      },
      {
        code: '2100',
        name: 'Accounts Payable',
        type: 'LIABILITY' as AccountType,
        category: 'ACCOUNTS_PAYABLE' as AccountCategory,
        key: 'accountsPayable',
      },
      {
        code: '4000',
        name: 'Sales Revenue',
        type: 'REVENUE' as AccountType,
        category: 'SALES_REVENUE' as AccountCategory,
        key: 'salesRevenue',
      },
      {
        code: '5000',
        name: 'Cost of Goods Sold',
        type: 'EXPENSE' as AccountType,
        category: 'COST_OF_GOODS_SOLD' as AccountCategory,
        key: 'cogs',
      },
    ];

    const accounts: Record<string, any> = {};

    for (const def of defaultAccounts) {
      let dbAccount = await prisma.account.findFirst({
        where: { businessUnitId, code: def.code },
      });

      if (!dbAccount) {
        dbAccount = await prisma.account.create({
          data: {
            code: def.code,
            name: def.name,
            type: def.type,
            category: def.category,
            businessUnitId,
            isActive: true,
          },
        });
      }

      accounts[def.key] = dbAccount;
    }

    return accounts;
  }
}

export const bookkeepingService = new BookkeepingService();
