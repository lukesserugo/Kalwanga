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
        'flex items-center justify-between w-full px-3 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500',
        className
      )}
    >
      {children}
      <ChevronDown className={cn('h-4 w-4 transition-transform', open ? 'rotate-180' : '')} />
    </button>
  );
}

interface SelectValueProps {
  placeholder?: string;
  className?: string;
}

export function SelectValue({ placeholder = 'Select...', className = '' }: SelectValueProps) {
  const { value } = useSelect();
  return <span className={cn('text-sm', className)}>{value || placeholder}</span>;
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
        'absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-auto',
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
        'w-full px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors',
        isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700',
        className
      )}
    >
      {children}
    </button>
  );
}
