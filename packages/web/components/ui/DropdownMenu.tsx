// D:\Projects\Kalwanga\packages\web\components\ui\DropdownMenu.tsx
'use client';

import { ReactNode, useState, useRef, useEffect, createContext, useContext } from 'react';
import { cn } from '../../lib/utils';

interface DropdownMenuProps {
  children: ReactNode;
}

export function DropdownMenu({ children }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <DropdownMenuContext.Provider value={{ open, setOpen }}>
        {children}
      </DropdownMenuContext.Provider>
    </div>
  );
}

interface DropdownMenuContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DropdownMenuContext = createContext<DropdownMenuContextType | undefined>(undefined);

function useDropdownMenu() {
  const context = useContext(DropdownMenuContext);
  if (!context) {
    throw new Error('DropdownMenu components must be used within a DropdownMenu provider');
  }
  return context;
}

interface DropdownMenuTriggerProps {
  children: ReactNode;
  asChild?: boolean;
}

export function DropdownMenuTrigger({ children, asChild }: DropdownMenuTriggerProps) {
  const { setOpen } = useDropdownMenu();
  
  if (asChild) {
    return (
      <div onClick={() => setOpen(true)}>
        {children}
      </div>
    );
  }
  
  return (
    <button type="button" onClick={() => setOpen(true)}>
      {children}
    </button>
  );
}

interface DropdownMenuContentProps {
  children: ReactNode;
  align?: 'start' | 'end';
  className?: string;
}

export function DropdownMenuContent({ children, align = 'end', className = '' }: DropdownMenuContentProps) {
  const { open, setOpen } = useDropdownMenu();

  if (!open) return null;

  return (
    <div 
      className={cn(
        'absolute z-50 mt-1 bg-white border rounded-lg shadow-lg min-w-[160px] py-1',
        align === 'end' ? 'right-0' : 'left-0',
        className
      )}
      onClick={() => setOpen(false)}
    >
      {children}
    </div>
  );
}

interface DropdownMenuItemProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export function DropdownMenuItem({ children, onClick, className = '', disabled = false }: DropdownMenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {children}
    </button>
  );
}
