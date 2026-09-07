// D:\Projects\Kalwanga\packages\web\types\category.ts
import { BusinessUnit } from './user';
import { Product } from './product';

export interface Category {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  parent?: Category;
  children?: Category[];
  isActive: boolean;
  businessUnitId: string;
  businessUnit?: BusinessUnit;
  products?: Product[];
  productCount?: number;
  featured?: boolean;
  image?: string;
  icon?: string;
  metadata?: {
    createdBy?: string;
    updatedBy?: string;
    lastUpdated?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CategoryFormData {
  name: string;
  description: string;
  parentId: string;
  isActive: boolean;
  businessUnitId: string;
}

export interface CategoryFilter {
  search?: string;
  status?: 'all' | 'active' | 'inactive';
  parentId?: string | null;
  businessUnitId?: string;
  isFeatured?: boolean;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'productCount';
  sortOrder?: 'asc' | 'desc';
}

export interface CategoryStats {
  total: number;
  active: number;
  inactive: number;
  root: number;
  withChildren: number;
  totalProducts: number;
}
