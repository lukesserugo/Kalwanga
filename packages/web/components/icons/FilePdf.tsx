// D:\Projects\Kalwanga\packages\web\components\icons\FilePdf.tsx
import React from 'react';

interface FilePdfProps {
  className?: string;
  size?: number;
}

export const FilePdf: React.FC<FilePdfProps> = ({ className, size = 24 }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M9 15v-4" />
      <path d="M12 15v-4" />
      <path d="M15 15v-4" />
      <path d="M9 12h6" />
    </svg>
  );
};

export default FilePdf;
