// D:\Projects\Kalwanga\packages\web\components\cart\CartNotes.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Loader2, Check, X } from 'lucide-react';
import { toast } from '../../utils/toast-manager';
import { cartService } from '../../services/cartService';

interface CartNotesProps {
  initialNotes?: string;
  onNotesUpdated?: (notes: string) => void;
  disabled?: boolean;
  className?: string;
}

export function CartNotes({
  initialNotes = '',
  onNotesUpdated,
  disabled = false,
  className = '',
}: CartNotesProps) {
  const [notes, setNotes] = useState<string>(initialNotes);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tempNotes, setTempNotes] = useState<string>(initialNotes);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    setNotes(initialNotes);
    setTempNotes(initialNotes);
  }, [initialNotes]);

  const handleEdit = () => {
    setTempNotes(notes);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setTempNotes(notes);
    setIsEditing(false);
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      setIsSuccess(false);
      
      await cartService.updateCartNotes(tempNotes);
      
      setNotes(tempNotes);
      setIsEditing(false);
      setIsSuccess(true);
      toast.success('Cart notes updated successfully');
      
      if (onNotesUpdated) {
        onNotesUpdated(tempNotes);
      }

      setTimeout(() => setIsSuccess(false), 3000);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update notes');
      setTempNotes(notes);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSave();
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-400" />
          <span className="font-medium text-gray-900 dark:text-white">Order Notes</span>
        </div>
        {!isEditing && !disabled && (
          <button
            onClick={handleEdit}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            {notes ? 'Edit' : 'Add Note'}
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={tempNotes}
            onChange={(e) => setTempNotes(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add special instructions, delivery notes, or any other comments..."
            disabled={disabled || isLoading}
            rows={3}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 dark:text-white disabled:opacity-50 resize-none"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={disabled || isLoading}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : isSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved!
                </>
              ) : (
                'Save'
              )}
            </button>
            <button
              onClick={handleCancel}
              disabled={disabled || isLoading}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <span className="text-xs text-gray-400">Ctrl+Enter to save</span>
          </div>
        </div>
      ) : (
        <div
          onClick={!disabled && !isEditing ? handleEdit : undefined}
          className={`p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg min-h-[60px] cursor-${
            !disabled ? 'pointer' : 'default'
          } hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}
        >
          {notes ? (
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{notes}</p>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">
              No notes added. Click to add special instructions...
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default CartNotes;
