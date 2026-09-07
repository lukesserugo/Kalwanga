// D:\Projects\Kalwanga\packages\web\types\loyalty.ts
import { Company } from './user';
import { Customer } from './customer';
import { Sale } from './sale';
import { User } from './user';

export interface LoyaltyProgram {
  id: string;
  name: string;
  description?: string;
  pointsPerDollar: number;
  minPointsForRedeem: number;
  isActive: boolean;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
  companyId: string;
  company?: Company;
  rewards?: LoyaltyReward[];
}

export interface LoyaltyReward {
  id: string;
  name: string;
  description?: string;
  pointsRequired: number;
  discountValue?: number;
  freeProductId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  loyaltyProgramId: string;
  loyaltyProgram?: LoyaltyProgram;
  redemptions?: LoyaltyHistory[];
}

export interface LoyaltyHistory {
  id: string;
  points: number;
  type: string;
  notes?: string;
  createdAt: string;
  customerId: string;
  customer?: Customer;
  saleId?: string;
  sale?: Sale;
  rewardId?: string;
  reward?: LoyaltyReward;
  userId: string;
  user?: User;
}
