'use client';

import { useState, useEffect, useCallback } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { bookkeepingService } from '../../../../../services/bookkeepingService';
import { useToast } from '../../../../../hooks/useToast';
import AccountsTable, {
  type AccountRow,
} from '../../../../../components/bookkeeping/AccountsTable';
import CreateAccountModal from '../../../../../components/bookkeeping/CreateAccountModal';
import SummaryCards from '../../../../../components/bookkeeping/SummaryCards';

export default function AccountsPage() {
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AccountRow | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await bookkeepingService.getAccounts({ isActive: true });
      const raw = response as any;
      const arr: any[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
        ? raw.data
        : [];

      setAccounts(
        arr.map((a: any) => {
          const lines = a.lines || [];
          const debit = lines.reduce(
            (s: number, l: any) => s + (l.debit || 0),
            0
          );
          const credit = lines.reduce(
            (s: number, l: any) => s + (l.credit || 0),
            0
          );
          return {
            id: a.id,
            code: a.code,
            name: a.name,
            type: a.type,
            category: a.category,
            isActive: a.isActive,
            debit,
            credit,
            balance: debit - credit,
          };
        })
      );
    } catch (err: any) {
      showToast(err?.message || 'Failed to load accounts', 'error');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleCreate = async (data: any) => {
    try {
      await bookkeepingService.createAccount({
        ...data,
        businessUnitId: '',
      } as any);
      showToast('Account created', 'success');
      await fetchAccounts();
    } catch (err: any) {
      showToast(err?.message || 'Failed to create account', 'error');
      throw err;
    }
  };

  const handleUpdate = async (data: any) => {
    if (!editing) return;
    try {
      await bookkeepingService.updateAccount(editing.id, data);
      showToast('Account updated', 'success');
      await fetchAccounts();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update account', 'error');
      throw err;
    }
  };

  const totalDebit = accounts.reduce((s, a) => s + a.debit, 0);
  const totalCredit = accounts.reduce((s, a) => s + a.credit, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Chart of Accounts
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {accounts.length} account{accounts.length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          New Account
        </button>
      </div>

      <SummaryCards
        cards={[
          { label: 'Total Debits', value: totalDebit, tone: 'positive' },
          { label: 'Total Credits', value: totalCredit, tone: 'negative' },
          {
            label: 'Net',
            value: totalDebit - totalCredit,
            tone: 'default',
          },
        ]}
      />

      <AccountsTable
        accounts={accounts}
        loading={loading}
        onEdit={(account) => {
          setEditing(account);
          setModalOpen(true);
        }}
      />

      <CreateAccountModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={editing ? handleUpdate : handleCreate}
        initial={editing}
      />
    </div>
  );
}
