'use client';

import React from 'react';
import { formatCurrency } from '../../utils/helpers';

interface Card {
  label: string;
  value: number | string;
  tone?: 'default' | 'positive' | 'negative' | 'warning';
  subtitle?: string;
}

interface Props {
  cards: Card[];
  columns?: 2 | 3 | 4;
}

export default function SummaryCards({ cards, columns = 3 }: Props) {
  const colClass =
    columns === 4
      ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
      : columns === 3
      ? 'grid-cols-1 md:grid-cols-3'
      : 'grid-cols-1 md:grid-cols-2';

  const toneClass = (tone?: Card['tone']) => {
    switch (tone) {
      case 'positive':
        return 'text-success-600 dark:text-success-400';
      case 'negative':
        return 'text-danger-600 dark:text-danger-400';
      case 'warning':
        return 'text-warning-600 dark:text-warning-400';
      default:
        return 'text-gray-900 dark:text-white';
    }
  };

  return (
    <div className={`grid ${colClass} gap-4`}>
      {cards.map((card, i) => (
        <div key={i} className="card-brand !p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {card.label}
          </p>
          <p
            className={`text-2xl font-bold mt-1 tabular-nums ${toneClass(
              card.tone
            )}`}
          >
            {typeof card.value === 'number'
              ? formatCurrency(card.value)
              : card.value}
          </p>
          {card.subtitle && (
            <p className="text-2xs text-gray-500 dark:text-gray-400 mt-1">
              {card.subtitle}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
