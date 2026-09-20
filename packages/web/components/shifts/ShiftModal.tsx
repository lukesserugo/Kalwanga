// D:\Projects\Kalwanga\packages\web\components\shifts\ShiftModal.tsx
'use client';

import { useState, ChangeEvent, FormEvent } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/Dialog';
import { Alert, AlertDescription } from '../ui/Alert';
import { formatCurrency } from '../../utils/formatters';

interface ShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  register: any;
}

interface FormData {
  startingBalance: string;
  notes: string;
}

export function ShiftModal({ isOpen, onClose, onSubmit, register }: ShiftModalProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    startingBalance: '',
    notes: '',
  });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const amount = parseFloat(formData.startingBalance);
      if (isNaN(amount) || amount < 0) {
        throw new Error('Please enter a valid starting balance');
      }

      await onSubmit({
        cashRegisterId: register.id,
        startingBalance: amount,
        notes: formData.notes || undefined,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to start shift');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id === 'startingBalance' ? 'startingBalance' : 'notes']: value,
    }));
  };

  if (!register) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-white">
            Start Shift
          </DialogTitle>
          <DialogDescription className="text-gray-500 dark:text-gray-400">
            Open a new shift for <strong>{register.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            {error && (
              <Alert
                variant="destructive"
                className="bg-danger-50 dark:bg-danger-950/30 border-danger-200 dark:border-danger-900"
              >
                <AlertCircle className="h-4 w-4 text-danger-600 dark:text-danger-400" />
                <AlertDescription className="text-danger-700 dark:text-danger-300">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-2 border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between text-sm">
                <span className="text-2xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Register
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {register.name}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-2xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Current Balance
                </span>
                <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                  {formatCurrency(register.cashBalance || 0)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="startingBalance"
                required
                className="text-gray-700 dark:text-gray-300"
              >
                Starting Balance
              </Label>
              <Input
                id="startingBalance"
                type="number"
                placeholder="0.00"
                value={formData.startingBalance}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                required
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:ring-brand-500 tabular-nums"
              />
              <p className="text-2xs text-gray-500 dark:text-gray-400">
                Initial cash amount in the register at shift start
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="notes"
                className="text-gray-700 dark:text-gray-300"
              >
                Notes (optional)
              </Label>
              <Input
                id="notes"
                placeholder="Any notes about this shift"
                value={formData.notes}
                onChange={handleInputChange}
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:ring-brand-500"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="focus-ring"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="btn-brand shadow-brand focus-ring"
            >
              {loading ? 'Starting...' : 'Start Shift'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
