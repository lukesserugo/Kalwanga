// src/components/BarcodeScanner.tsx
'use client';

import { useState, useRef, useCallback } from 'react';
import { CameraIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

export default function BarcodeScanner({ onScan, onClose, isOpen }: BarcodeScannerProps) {
  const [manualInput, setManualInput] = useState('');
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('manual');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleManualSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      onScan(manualInput.trim());
      setManualInput('');
    }
  }, [manualInput, onScan]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-modal">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-soft border border-gray-200 dark:border-gray-700 p-6 w-[400px]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Scan Barcode</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-250 focus-ring rounded"
            aria-label="Close scanner"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setScanMode('manual')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors duration-250 focus-ring ${
              scanMode === 'manual'
                ? 'bg-brand-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Manual Entry
          </button>
          <button
            type="button"
            onClick={() => setScanMode('camera')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors duration-250 focus-ring ${
              scanMode === 'camera'
                ? 'bg-brand-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Camera Scan
          </button>
        </div>

        {scanMode === 'manual' ? (
          <form onSubmit={handleManualSubmit}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Enter barcode..."
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-lg text-center bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-transparent transition-colors duration-250 tabular-nums"
              autoFocus
            />
            <button
              type="submit"
              className="btn-brand shadow-brand focus-ring w-full mt-4 py-2"
            >
              Lookup Product
            </button>
          </form>
        ) : (
          <div className="text-center py-8">
            <CameraIcon className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Camera scanning not available in this browser.</p>
            <p className="text-2xs text-gray-400 dark:text-gray-500 mt-2">Please use manual entry or a barcode scanner device.</p>
          </div>
        )}
      </div>
    </div>
  );
}
