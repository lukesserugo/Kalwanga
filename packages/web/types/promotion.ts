// D:\Projects\Kalwanga\packages\web\types\promotion.ts
import { Company } from './user';
import { Product } from './product';

export interface Promotion {
  id: string;
  name: string;
  description?: string;
  type: PromotionType;
  value: number;
  minPurchase?: number;
  maxDiscount?: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isStackable: boolean;
  applicableProducts?: any;
  excludedProducts?: any;
  applicableCategories?: any;
  createdAt: string;
  updatedAt: string;
  companyId: string;
  company?: Company;
  productPromotions?: ProductPromotion[];
}

export enum PromotionType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
  BUY_X_GET_Y = 'BUY_X_GET_Y',
  FREE_SHIPPING = 'FREE_SHIPPING',
  BOGO = 'BOGO'
}

export interface ProductPromotion {
  id: string;
  promotionId: string;
  promotion?: Promotion;
  productId: string;
  product?: Product;
}
