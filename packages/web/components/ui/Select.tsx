// D:\Projects\Kalwanga\packages\web\components\ui\Select.tsx
'use client';

import { ReactNode, createContext, useContext, useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SelectContextType {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SelectContext = createContext<SelectContextType | undefined>(undefined);

function useSelect() {
  const context = useContext(SelectContext);
  if (!context) {
    throw new Error('Select components must be used within a Select provider');
  }
  return context;
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
}

export function Select({ value, onValueChange, children }: SelectProps) {
  const [open, setOpen] = useState(false);
  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  );
}

interface SelectTriggerProps {
  children: ReactNode;
  className?: string;
}

export function SelectTrigger({ children, className = '' }: SelectTriggerProps) {
  const { open, setOpen } = useSelect();
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={cn(
        'flex items-center justify-between w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors duration-250',
        className
      )}
    >
      {children}
      <ChevronDown
        className={cn(
          'h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform duration-250',
          open ? 'rotate-180' : ''
        )}
      />
    </button>
  );
}

interface SelectValueProps {
  placeholder?: string;
  className?: string;
}

export function SelectValue({ placeholder = 'Select...', className = '' }: SelectValueProps) {
  const { value } = useSelect();
  return (
    <span className={cn('text-sm', className)}>
      {value || placeholder}
    </span>
  );
}

interface SelectContentProps {
  children: ReactNode;
  className?: string;
}

export function SelectContent({ children, className = '' }: SelectContentProps) {
  const { open, setOpen } = useSelect();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className={cn(
        'absolute z-modal w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-soft max-h-60 overflow-auto transition-colors duration-250',
        className
      )}
    >
      {children}
    </div>
  );
}

interface SelectItemProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function SelectItem({ value, children, className = '' }: SelectItemProps) {
  const { value: selectedValue, onValueChange, setOpen } = useSelect();
  const isSelected = selectedValue === value;

  return (
    <button
      type="button"
      onClick={() => {
        onValueChange(value);
        setOpen(false);
      }}
      className={cn(
        'w-full px-3 py-2 text-sm text-left transition-colors duration-250 focus-ring',
        isSelected
          ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300'
          : 'text-gray-700 dark:text-gray-200 hover:bg-brand-50 dark:hover:bg-gray-700/60',
        className
      )}
    >
      {children}
    </button>
  );
}
