// src/components/common/Select.tsx
import React, { forwardRef } from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className = '', ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={`
              w-full px-4 py-2 border rounded-lg appearance-none
              bg-white dark:bg-gray-800 text-gray-900 dark:text-white
              focus:outline-none focus:ring-2 focus:border-transparent
              disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed
              transition-shadow
              ${
                error
                  ? 'border-danger-500 focus:ring-danger-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-brand-500'
              }
              ${className}
            `}
            {...props}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
        </div>
        {error && (
          <div className="flex items-center gap-1 text-sm text-danger-600 dark:text-danger-400">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
      </div>
    );
  },
);

Select.displayName = 'Select';

export default Select;
