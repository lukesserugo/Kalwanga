// D:\Projects\Kalwanga\packages\web\types\order.ts
import { Product, ProductVariant } from './product';
import { Customer } from './customer';
import { BusinessUnit, User } from './user';
import { Sale } from './sale';
import { Payment } from './payment';
import { Supplier } from './supplier';
import { OrderStatus } from './enums'; // Import from enums.ts
import { Receipt } from './invoice';
import { InventoryTransaction } from './inventory';

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus; // Uses enum from enums.ts
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  notes?: string;
  customerId?: string;
  customer?: Customer;
  businessUnitId: string;
  businessUnit?: BusinessUnit;
  userId: string;
  user?: User;
  items?: OrderItem[];
  payment?: Payment;
  sale?: Sale;
  receipt?: Receipt;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string;
  orderId: string;
  order?: Order;
  productId: string;
  product?: Product;
  variantId?: string;
  variant?: ProductVariant;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplier?: Supplier;
  status: string;
  total: number;
  notes?: string;
  expectedDelivery?: string;
  receivedAt?: string;
  receivedBy?: string;
  receiver?: User;
  businessUnitId: string;
  businessUnit?: BusinessUnit;
  userId: string;
  user?: User;
  items?: PurchaseOrderItem[];
  inventoryTransactions?: InventoryTransaction[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  total: number;
  receivedQuantity: number;
  notes?: string;
  purchaseOrderId: string;
  purchaseOrder?: PurchaseOrder;
  productId: string;
  product?: Product;
  variantId?: string;
  variant?: ProductVariant;
}
