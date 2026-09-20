// D:\Projects\Kalwanga\packages\web\components\ui\Card.tsx
import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  title?: string;
  className?: string;
}

export default function Card({ children, title, className = '' }: CardProps) {
  return (
    <div className={`card-brand shadow-soft ${className}`}>
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
