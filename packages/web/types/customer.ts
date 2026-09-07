// D:\Projects\Kalwanga\packages\web\types\customer.ts
import { Company, User } from './user';
import { Sale } from './sale';
import { Order } from './order';

export interface Customer {
  id: string;
  email: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  notes?: string;
  isActive: boolean;
  loyaltyPoints: number;
  totalSpent: number;
  lastPurchaseAt?: string;
  createdAt: string;
  updatedAt: string;
  companyId: string;
  company?: Company;
  orders?: Order[];
  sales?: Sale[];
  giftCards?: GiftCard[];
  loyaltyHistory?: LoyaltyHistory[];
  invoices?: Invoice[];
  carts?: Cart[];
}

export interface GiftCard {
  id: string;
  cardNumber: string;
  pin?: string;
  balance: number;
  initialBalance: number;
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  customerId?: string;
  customer?: Customer;
  companyId: string;
  company?: Company;
  transactions?: GiftCardTransaction[];
}

export interface GiftCardTransaction {
  id: string;
  amount: number;
  type: string;
  notes?: string;
  createdAt: string;
  giftCardId: string;
  giftCard?: GiftCard;
  saleId?: string;
  sale?: Sale;
  userId: string;
  user?: User;
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
