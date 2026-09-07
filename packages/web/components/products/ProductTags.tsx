// D:\Projects\Kalwanga\packages\web\components\products\ProductTags.tsx
'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tag, Plus, X, Check, RefreshCw, Search,
  Edit, Trash2, Save, Loader2, AlertCircle
} from 'lucide-react';
import { toast } from '../../utils/toast-manager';

interface ProductTagsProps {
  tags: string[];
  onUpdate: (tags: string[]) => void;
  canManage?: boolean;
  suggestions?: string[];
}

export function ProductTags({ tags, onUpdate, canManage = true, suggestions = [] }: ProductTagsProps) {
  const [newTag, setNewTag] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (!trimmed) {
      toast.error('Please enter a tag');
      return;
    }
    if (tags.includes(trimmed)) {
      toast.warning('Tag already exists');
      return;
    }
    const updatedTags = [...tags, trimmed];
    onUpdate(updatedTags);
    setNewTag('');
    toast.success('Tag added');
  };

  const handleRemoveTag = (index: number) => {
    const updatedTags = tags.filter((_, i) => i !== index);
    onUpdate(updatedTags);
    toast.success('Tag removed');
  };

  const handleEditTag = (index: number) => {
    setEditingIndex(index);
    setEditValue(tags[index]);
  };

  const handleSaveEdit = (index: number) => {
    const trimmed = editValue.trim();
    if (!trimmed) {
      toast.error('Tag cannot be empty');
      return;
    }
    if (trimmed !== tags[index] && tags.includes(trimmed)) {
      toast.warning('Tag already exists');
      return;
    }
    const updatedTags = tags.map((t, i) => i === index ? trimmed : t);
    onUpdate(updatedTags);
    setEditingIndex(null);
    toast.success('Tag updated');
  };

  const handleBulkAdd = (suggestion: string) => {
    if (!tags.includes(suggestion)) {
      onUpdate([...tags, suggestion]);
      toast.success(`Added "${suggestion}"`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const filteredTags = tags.filter(tag =>
    tag.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSuggestions = suggestions.filter(s =>
    s.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !tags.includes(s)
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Add tags to help categorize and find products
        </p>
      </div>

      {/* Search and Add */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search or add tags..."
            className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {canManage && (
          <div className="flex gap-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="New tag..."
              className="w-32 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAddTag}
              disabled={!newTag.trim()}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Suggestions */}
      {filteredSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">Suggestions:</span>
          {filteredSuggestions.slice(0, 5).map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => handleBulkAdd(suggestion)}
              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              + {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Tags List */}
      {tags.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <Tag className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No tags added yet</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {filteredTags.map((tag, index) => {
            const isEditing = editingIndex === index;

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-full group hover:shadow-sm transition-shadow"
              >
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-24 px-1 py-0.5 text-sm bg-transparent border-b border-blue-300 focus:outline-none focus:border-blue-600"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveEdit(index);
                        } else if (e.key === 'Escape') {
                          setEditingIndex(null);
                        }
                      }}
                    />
                    <button
                      onClick={() => handleSaveEdit(index)}
                      className="p-0.5 hover:bg-green-100 rounded"
                    >
                      <Check className="w-3 h-3 text-green-600" />
                    </button>
                    <button
                      onClick={() => setEditingIndex(null)}
                      className="p-0.5 hover:bg-red-100 rounded"
                    >
                      <X className="w-3 h-3 text-red-600" />
                    </button>
                  </>
                ) : (
                  <>
                    <Tag className="w-3 h-3 text-blue-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{tag}</span>
                    {canManage && (
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEditTag(index)}
                          className="p-0.5 hover:bg-blue-100 rounded"
                        >
                          <Edit className="w-3 h-3 text-blue-500" />
                        </button>
                        <button
                          onClick={() => handleRemoveTag(index)}
                          className="p-0.5 hover:bg-red-100 rounded"
                        >
                          <X className="w-3 h-3 text-red-500" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Stats */}
      {tags.length > 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {tags.length} tag{tags.length > 1 ? 's' : ''} • {tags.length > 0 ? 'Click to manage' : ''}
        </div>
      )}
    </div>
  );
}
