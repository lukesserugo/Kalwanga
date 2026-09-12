// D:\Projects\Kalwanga\packages\web\components\shifts\NoActiveShiftCard.tsx
'use client';

import { Clock, Plus } from 'lucide-react';
import Card from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export function NoActiveShiftCard() {
  return (
    <Card className="p-8 text-center">
      <div className="flex flex-col items-center">
        <div className="bg-gray-50 rounded-full p-4 mb-4">
          <Clock className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No Active Shift
        </h3>
        <p className="text-gray-500 max-w-sm mb-6">
          You don't have an active shift. Start a shift from the registers tab to begin tracking transactions.
        </p>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Go to Registers
        </Button>
      </div>
    </Card>
  );
}
