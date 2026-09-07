// D:\Projects\Kalwanga\packages\web\types\bookkeeping.ts
import { BusinessUnit, User } from './user';
import { Sale } from './sale';

export interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  category: string;
  isActive: boolean;
  businessUnitId: string;
  businessUnit?: BusinessUnit;
  lines?: JournalLine[];
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  reference?: string;
  status: string;
  businessUnitId: string;
  businessUnit?: BusinessUnit;
  createdBy: string;
  creator?: User;
  lines?: JournalLine[];
  createdAt: string;
  updatedAt: string;
}

export interface JournalLine {
  id: string;
  journalEntryId: string;
  journalEntry?: JournalEntry;
  accountId: string;
  account?: Account;
  debit: number;
  credit: number;
  description?: string;
}

export interface TaxRecord {
  id: string;
  saleId: string;
  sale?: Sale;
  taxType: string;
  taxRate: number;
  taxAmount: number;
  taxableAmount: number;
  businessUnitId: string;
  businessUnit?: BusinessUnit;
  period: string;
  filingStatus: string;
  filedAt?: string;
  createdAt: string;
}

export interface FinancialReport {
  id: string;
  reportType: string;
  period: string;
  startDate: string;
  endDate: string;
  data: any;
  format: string;
  fileUrl?: string;
  generatedBy: string;
  user?: User;
  businessUnitId: string;
  businessUnit?: BusinessUnit;
  createdAt: string;
}

export interface TrialBalance {
  accounts: Array<{
    code: string;
    name: string;
    type: string;
    debit: number;
    credit: number;
  }>;
  totalDebits: number;
  totalCredits: number;
}

export interface BalanceSheet {
  assets: {
    currentAssets: Array<{ name: string; amount: number }>;
    fixedAssets: Array<{ name: string; amount: number }>;
    totalAssets: number;
  };
  liabilities: {
    currentLiabilities: Array<{ name: string; amount: number }>;
    longTermLiabilities: Array<{ name: string; amount: number }>;
    totalLiabilities: number;
  };
  equity: {
    ownersEquity: Array<{ name: string; amount: number }>;
    totalEquity: number;
  };
  totalLiabilitiesEquity: number;
}

export interface IncomeStatement {
  revenue: {
    salesRevenue: Array<{ name: string; amount: number }>;
    otherRevenue: Array<{ name: string; amount: number }>;
    totalRevenue: number;
  };
  expenses: {
    cogs: Array<{ name: string; amount: number }>;
    operatingExpenses: Array<{ name: string; amount: number }>;
    otherExpenses: Array<{ name: string; amount: number }>;
    totalExpenses: number;
  };
  netIncome: number;
  grossProfit: number;
}
