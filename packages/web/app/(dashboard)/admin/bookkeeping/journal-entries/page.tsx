'use client';

import { useState, useEffect, useCallback } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { bookkeepingService } from '../../../../../services/bookkeepingService';
import { useToast } from '../../../../../hooks/useToast';
import JournalEntryTable, {
  type JournalEntryRow,
} from '../../../../../components/bookkeeping/JournalEntryTable';
import JournalEntryForm from '../../../../../components/bookkeeping/JournalEntryForm';

export default function JournalEntriesPage() {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<JournalEntryRow[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [entriesRes, accountsRes] = await Promise.all([
        bookkeepingService.getJournalEntries({ page: 1, limit: 50 }),
        bookkeepingService.getAccounts({ isActive: true }),
      ]);

      const rawE = entriesRes as any;
      setEntries(
        Array.isArray(rawE?.data)
          ? rawE.data
          : Array.isArray(rawE)
          ? rawE
          : []
      );

      const rawA = accountsRes as any;
      setAccounts(
        Array.isArray(rawA?.data)
          ? rawA.data
          : Array.isArray(rawA)
          ? rawA
          : []
      );
    } catch (err: any) {
      showToast(err?.message || 'Failed to load', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (data: any) => {
    try {
      await bookkeepingService.createJournalEntry(data);
      showToast('Journal entry created', 'success');
      await load();
    } catch (err: any) {
      showToast(err?.message || 'Failed to create entry', 'error');
      throw err;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Journal Entries
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Double-entry transactions
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          <PlusIcon className="w-4 h-4" />
          New Entry
        </button>
      </div>

      <JournalEntryTable entries={entries} loading={loading} />

      <JournalEntryForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreate}
        accounts={accounts}
      />
    </div>
  );
}
