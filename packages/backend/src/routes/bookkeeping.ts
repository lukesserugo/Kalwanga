// src/routes/bookkeepingRoutes.ts

import { Router } from 'express';
import { bookkeepingController } from '../controllers/bookkeepingController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// All bookkeeping routes require authentication
router.use(requireAuth);

// ============================================
// JOURNAL ENTRY ROUTES
// ============================================

// Get all journal entries (with pagination and filters)
router.get('/journal-entries', bookkeepingController.getJournalEntries);

// Get journal entry by ID
router.get('/journal-entries/:id', bookkeepingController.getJournalEntryById);

// Create a new journal entry
router.post('/journal-entries', bookkeepingController.createJournalEntry);

// Void a journal entry
router.post('/journal-entries/:id/void', bookkeepingController.voidJournalEntry);

// ============================================
// ACCOUNT ROUTES
// ============================================

// Get all accounts
router.get('/accounts', bookkeepingController.getAccounts);

// Get account by ID
router.get('/accounts/:id', bookkeepingController.getAccountById);

// Get account balance
router.get('/accounts/:id/balance', bookkeepingController.getAccountBalance);

// ============================================
// FINANCIAL REPORT ROUTES
// ============================================

// Generate balance sheet
router.get('/reports/balance-sheet', bookkeepingController.generateBalanceSheet);

// Generate income statement (profit & loss)
router.get('/reports/income-statement', bookkeepingController.generateIncomeStatement);

// Generate trial balance
router.get('/reports/trial-balance', bookkeepingController.generateTrialBalance);

// Alias for backward compatibility (without /reports prefix)
router.get('/balance-sheet', bookkeepingController.generateBalanceSheet);
router.get('/income-statement', bookkeepingController.generateIncomeStatement);
router.get('/trial-balance', bookkeepingController.generateTrialBalance);

// ============================================
// SALE RECORDING ROUTES
// ============================================

// Record a sale in the journal
router.post('/record-sale/:saleId', bookkeepingController.recordSale);

// ============================================
// TAX ROUTES
// ============================================

// Calculate tax
router.post('/calculate-tax', bookkeepingController.calculateTax);

export default router;
