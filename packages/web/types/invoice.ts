// D:\Projects\Kalwanga\packages\web\types\invoice.ts
import { Company, User } from './user';
import { Customer } from './customer';
import { Sale } from './sale';
import { Order } from './order';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  total: number;
  tax: number;
  subtotal: number;
  status: string;
  dueDate?: string;
  paidAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  companyId: string;
  company?: Company;
  saleId?: string;
  sale?: Sale;
  customerId: string;
  customer?: Customer;
  userId: string;
  user?: User;
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  content?: string;
  format: string;
  sentAt?: string;
  printedAt?: string;
  printCount: number;
  lastPrintedBy?: string;
  lastPrinter?: User;
  createdAt: string;
  companyId: string;
  company?: Company;
  saleId?: string;
  sale?: Sale;
  orderId?: string;
  order?: Order;
}
