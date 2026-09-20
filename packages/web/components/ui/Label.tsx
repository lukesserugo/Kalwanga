// D:\Projects\Kalwanga\packages\web\components\ui\Label.tsx
'use client';

import { forwardRef, LabelHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, required, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          'text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1.5',
          className
        )}
        {...props}
      >
        {children}
        {required && (
          <span className="text-danger-500 dark:text-danger-400 ml-0.5">*</span>
        )}
      </label>
    );
  }
);

Label.displayName = 'Label';

export default Label;
