// packages/web/types/customer.ts

// Use `import type` for type-only imports to match the convention in
// `types/sale.ts` and avoid accidental runtime dependency cycles.
import type { Company, User } from './user';
import type { Sale } from './sale';
import type { Order } from './order';

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

  // ⚠ `invoices` and `carts` were REMOVED from this interface.
  //
  //   The backend's `CustomerResponse` (see
  //   `packages/backend/src/services/customerService.ts`) does not
  //   declare either relation, and none of the customer endpoints
  //   (`getAllCustomers`, `getCustomerById`, `createCustomer`,
  //   `updateCustomer`, `searchCustomers`, `deleteCustomer`) include
  //   them. Reading `customer.invoices` or `customer.carts` on a
  //   payload from any of those endpoints returned `undefined`.
  //
  //   Declaring them here only made the type lie about the wire
  //   shape. If a future endpoint adds one of these relations, add
  //   the field back AND include the corresponding relation on the
  //   backend's `CustomerResponse`.
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
  pointsPerEarn: number;
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
