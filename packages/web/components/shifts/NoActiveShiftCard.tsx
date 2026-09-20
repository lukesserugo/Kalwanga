// D:\Projects\Kalwanga\packages\web\components\shifts\NoActiveShiftCard.tsx
'use client';

import { Clock, Plus } from 'lucide-react';
import Card from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export function NoActiveShiftCard() {
  return (
    <Card className="p-8 text-center card-brand shadow-soft animate-fade-in">
      <div className="flex flex-col items-center">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-full p-4 mb-4">
          <Clock className="h-8 w-8 text-gray-400 dark:text-gray-500" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No Active Shift
        </h3>
        <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-6 line-clamp-2">
          You don't have an active shift. Start a shift from the registers tab to begin tracking transactions.
        </p>
        <Button className="focus-ring">
          <Plus className="h-4 w-4 mr-2" />
          Go to Registers
        </Button>
      </div>
    </Card>
  );
}
