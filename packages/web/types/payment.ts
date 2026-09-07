// D:\Projects\Kalwanga\packages\web\types\payment.ts

import { Sale } from './sale';
import { Order } from './order';
import { User, Company, BusinessUnit } from './user';
import { PaymentMethod, PaymentStatus } from './enums';
import { CashRegister, CashRegisterSession, CashTransaction } from './register';

export interface Payment {
  id: string;
  amount: number;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string;
  reference?: string;
  notes?: string;
  processedAt: string;
  refundedAt?: string;
  refundReason?: string;
  refundedBy?: string;
  saleId?: string;
  sale?: Sale;
  orderId?: string;
  order?: Order;
  cashRegisterId?: string;
  cashRegister?: CashRegister;
  cashRegisterSessionId?: string;
  cashRegisterSession?: CashRegisterSession;
  userId: string;
  user?: User;
  gatewayId?: string;
  paymentGateway?: PaymentGateway;
  businessUnitId?: string;
  businessUnit?: BusinessUnit;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentGateway {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  credentials: any;
  testMode: boolean;
  createdAt: string;
  updatedAt: string;
  companyId: string;
  company?: Company;
  payments?: Payment[];
}

export interface PaymentSummary {
  totalAmount: number;
  byMethod: Record<string, number>;
  count: number;
  averageAmount: number;
  totalRefunds: number;
  refundCount: number;
  netAmount: number;
}

export interface PaymentFilters {
  startDate?: string;
  endDate?: string;
  businessUnitId?: string;
  status?: string;
  paymentMethod?: string;
  userId?: string;
  saleId?: string;
  orderId?: string;
  page?: number;
  limit?: number;
}

export interface ProcessPaymentRequest {
  amount: number;
  paymentMethod: string;
  saleId?: string;
  orderId?: string;
  cashRegisterId?: string;
  cashRegisterSessionId?: string;
  currency?: string;
  source?: string;
  customerId?: string;
  metadata?: Record<string, any>;
  description?: string;
  tipAmount?: number;
  savePaymentMethod?: boolean;
  businessUnitId?: string;
}

export interface RefundPaymentRequest {
  amount?: number;
  reason?: string;
}

export interface CheckoutSessionRequest {
  items: Array<{
    name: string;
    price: number;
    quantity: number;
    currency?: string;
    description?: string;
    images?: string[];
  }>;
  customerId?: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, any>;
}

export interface PaymentSearchParams {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  businessUnitId?: string;
  status?: string;
  paymentMethod?: string;
  userId?: string;
  saleId?: string;
  orderId?: string;
}

export interface PaginatedPaymentResponse {
  data: Payment[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}
