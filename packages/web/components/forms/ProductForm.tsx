'use client';

import { useState } from 'react';
import Input from '../common/Input';
import Button from '../common/Button';
import { validateRequired, validatePositiveNumber } from '../../utils/validators';

interface ProductFormData {
  name: string;
  description: string;
  sku: string;
  barcode: string;
  unitPrice: number;
  costPrice: number;
  taxRate: number;
  minStock: number;
  maxStock: number;
  categoryId: string;
  businessUnitId: string;
}

interface ProductFormProps {
  initialData?: Partial<ProductFormData>;
  categories?: Array<{ id: string; name: string }>;
  businessUnits?: Array<{ id: string; name: string }>;
  onSubmit: (data: ProductFormData) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export default function ProductForm({
  initialData = {},
  categories = [],
  businessUnits = [],
  onSubmit,
  onCancel,
  isLoading = false,
}: ProductFormProps) {
  const [formData, setFormData] = useState<ProductFormData>({
    name: initialData.name || '',
    description: initialData.description || '',
    sku: initialData.sku || '',
    barcode: initialData.barcode || '',
    unitPrice: initialData.unitPrice || 0,
    costPrice: initialData.costPrice || 0,
    taxRate: initialData.taxRate || 0,
    minStock: initialData.minStock || 5,
    maxStock: initialData.maxStock || 0,
    categoryId: initialData.categoryId || '',
    businessUnitId: initialData.businessUnitId || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    if (!validateRequired(formData.name)) {
      newErrors.name = 'Product name is required';
    }
    if (!validateRequired(formData.sku)) {
      newErrors.sku = 'SKU is required';
    }
    if (!validatePositiveNumber(formData.unitPrice)) {
      newErrors.unitPrice = 'Unit price must be greater than 0';
    }
    if (!validateRequired(formData.businessUnitId)) {
      newErrors.businessUnitId = 'Business unit is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Product Name *"
          name="name"
          value={formData.name}
          onChange={handleChange}
          error={errors.name}
          disabled={isLoading}
        />
        <Input
          label="SKU *"
          name="sku"
          value={formData.sku}
          onChange={handleChange}
          error={errors.sku}
          disabled={isLoading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Barcode"
          name="barcode"
          value={formData.barcode}
          onChange={handleChange}
          disabled={isLoading}
        />
        <Input
          label="Unit Price *"
          type="number"
          step="0.01"
          name="unitPrice"
          value={formData.unitPrice}
          onChange={handleChange}
          error={errors.unitPrice}
          disabled={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input
          label="Cost Price"
          type="number"
          step="0.01"
          name="costPrice"
          value={formData.costPrice}
          onChange={handleChange}
          disabled={isLoading}
        />
        <Input
          label="Tax Rate (%)"
          type="number"
          step="0.1"
          name="taxRate"
          value={formData.taxRate}
          onChange={handleChange}
          disabled={isLoading}
        />
        <Input
          label="Min Stock"
          type="number"
          name="minStock"
          value={formData.minStock}
          onChange={handleChange}
          disabled={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            name="categoryId"
            value={formData.categoryId}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          >
            <option value="">Select Category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Business Unit *
          </label>
          <select
            name="businessUnitId"
            value={formData.businessUnitId}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.businessUnitId ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={isLoading}
          >
            <option value="">Select Business Unit</option>
            {businessUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
          {errors.businessUnitId && (
            <p className="mt-1 text-sm text-red-600">{errors.businessUnitId}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save Product'}
        </Button>
      </div>
    </form>
  );
}
