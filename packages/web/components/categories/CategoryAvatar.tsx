'use client';

import { useState } from 'react';
import type { Category } from '../../types/category';

interface CategoryAvatarProps {
  category: Pick<Category, 'id' | 'name' | 'image' | 'icon' | 'color'>;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  rounded?: 'full' | 'lg' | 'xl';
  className?: string;
}

const SIZES: Record<NonNullable<CategoryAvatarProps['size']>, string> = {
  xs: 'w-6 h-6 text-2xs',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
};

const ROUNDED: Record<NonNullable<CategoryAvatarProps['rounded']>, string> = {
  full: 'rounded-full',
  lg: 'rounded-lg',
  xl: 'rounded-2xl',
};

const FALLBACK_COLORS = [
  '#F97316',
  '#EF4444',
  '#EC4899',
  '#8B5CF6',
  '#3B82F6',
  '#06B6D4',
  '#10B981',
  '#84CC16',
  '#EAB308',
  '#F59E0B',
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickColor(seed: string): string {
  return FALLBACK_COLORS[hashString(seed) % FALLBACK_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export function CategoryAvatar({
  category,
  size = 'md',
  rounded = 'xl',
  className = '',
}: CategoryAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const sizeClass = SIZES[size];
  const roundedClass = ROUNDED[rounded];
  const accent = category.color || pickColor(category.id || category.name);

  const base = `inline-flex items-center justify-center overflow-hidden shrink-0 font-semibold ${sizeClass} ${roundedClass} ${className}`;

  if (category.image && !imgFailed) {
    return (
      <span className={base} style={{ backgroundColor: accent }}>
        <img
          src={category.image}
          alt={category.name}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      </span>
    );
  }

  if (category.icon) {
    return (
      <span
        className={base}
        style={{ backgroundColor: `${accent}1A`, color: accent }}
        aria-label={category.name}
      >
        {category.icon}
      </span>
    );
  }

  return (
    <span
      className={base}
      style={{ backgroundColor: accent, color: '#fff' }}
      aria-label={category.name}
    >
      {initials(category.name)}
    </span>
  );
}

export default CategoryAvatar;
