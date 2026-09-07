import { Router } from 'express';
import { bookkeepingController } from '../controllers/bookkeepingController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/journal-entries', bookkeepingController.getJournalEntries);
router.post('/journal-entries', bookkeepingController.createJournalEntry);
router.get('/accounts', bookkeepingController.getAccounts);
router.get('/accounts/:id', bookkeepingController.getAccountById);
router.get('/balance-sheet', bookkeepingController.generateBalanceSheet);
router.get('/income-statement', bookkeepingController.generateIncomeStatement);
router.get('/trial-balance', bookkeepingController.generateTrialBalance);

export default router;
