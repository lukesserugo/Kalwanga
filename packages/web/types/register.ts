// D:\Projects\Kalwanga\packages\web\types\register.ts
import { BusinessUnit, User } from './user';
import { Sale } from './sale';
import { Payment } from './payment';

export interface CashRegister {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  cashBalance: number;
  createdAt: string;
  updatedAt: string;
  businessUnitId: string;
  businessUnit?: BusinessUnit;
  sessions?: CashRegisterSession[];
  sales?: Sale[];
  payments?: Payment[];
  cashTransactions?: CashTransaction[];
}

export interface CashRegisterSession {
  id: string;
  openedAt: string;
  closedAt?: string;
  startingBalance: number;
  endingBalance?: number;
  expectedEndingBalance?: number;
  discrepancy?: number;
  discrepancyReason?: string;
  notes?: string;
  status: string;
  cashRegisterId: string;
  cashRegister?: CashRegister;
  userId: string;
  user?: User;
  sales?: Sale[];
  payments?: Payment[];
  cashTransactions?: CashTransaction[];
}

export interface CashTransaction {
  id: string;
  type: string;
  amount: number;
  reason: string;
  notes?: string;
  createdAt: string;
  cashRegisterId: string;
  cashRegister?: CashRegister;
  cashRegisterSessionId?: string;
  cashRegisterSession?: CashRegisterSession;
  userId: string;
  user?: User;
}

export interface ShiftLog {
  id: string;
  shiftStart: string;
  shiftEnd?: string;
  startingCash: number;
  endingCash?: number;
  expectedCash?: number;
  discrepancy?: number;
  discrepancyReason?: string;
  notes?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  user?: User;
  businessUnitId: string;
  businessUnit?: BusinessUnit;
}
