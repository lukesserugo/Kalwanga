// D:\Projects\Kalwanga\packages\web\components\products\ProductTags.tsx
'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Tag, Plus, X, Check, Search, Edit } from 'lucide-react';
import { toast } from '../../utils/toast-manager';

// ============================================
// BACKEND CONTRACT
// ============================================
//
//   Product.tags  →  String[]  @default([])
//
//   Writes go through:
//     POST /products          (createProductSchema:  tags: string[].max(50) each)
//     PUT  /products/:id      (updateProductSchema:  tags: string[] — no max)
//
//   The service (`prepareCreateData` / `updateProduct`) filters the
//   array on both paths:
//     • Drops non-string entries.
//     • Drops entries whose `.trim()` is empty.
//     • No deduplication.
//     • No case-folding.
//     • No internal-whitespace normalization.
//
//   Reads come from:
//     GET /products/:id  →  product.tags
//     GET /products/tags →  [{ name, count }, ...]  derived per-call
//
// There is no separate tag table and no `/products/:id/tags` endpoint.
// The array on the product row is the only source of truth.

const MAX_TAG_LENGTH = 50;

interface ProductTagsProps {
  tags: string[];
  onUpdate: (tags: string[]) => void;
  canManage?: boolean;
  suggestions?: string[];
}

export function ProductTags({
  tags,
  onUpdate,
  canManage = true,
  suggestions = [],
}: ProductTagsProps) {
  const [newTag, setNewTag] = useState('');
  // Track the tag being edited by VALUE, not index. Filtering the list
  // shifts indices, and an index-based edit would silently modify the
  // wrong tag whenever a search is active.
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // ============================================
  // VALIDATION
  // ============================================

  const normalize = (s: string): string => s.trim();

  const findCaseInsensitiveDuplicate = (
    candidate: string,
    list: string[],
    ignore?: string
  ): string | null => {
    const lower = candidate.toLowerCase();
    for (const existing of list) {
      if (ignore && existing === ignore) continue;
      if (existing.toLowerCase() === lower) return existing;
    }
    return null;
  };

  const validateTag = (
    raw: string,
    options: { ignore?: string; existing: string[] }
  ): { ok: true; value: string } | { ok: false; reason: string } => {
    const value = normalize(raw);

    if (!value) {
      return { ok: false, reason: 'Tag cannot be empty' };
    }

    if (value.length > MAX_TAG_LENGTH) {
      return {
        ok: false,
        reason: `Tag must be ${MAX_TAG_LENGTH} characters or fewer`,
      };
    }

    const dupe = findCaseInsensitiveDuplicate(
      value,
      options.existing,
      options.ignore
    );
    if (dupe) {
      return { ok: false, reason: `Tag "${dupe}" already exists` };
    }

    return { ok: true, value };
  };

  // ============================================
  // ADD
  // ============================================

  const handleAddTag = () => {
    const result = validateTag(newTag, { existing: tags });
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }

    onUpdate([...tags, result.value]);
    setNewTag('');
    toast.success('Tag added');
  };

  const handleAddSuggestion = (suggestion: string) => {
    const result = validateTag(suggestion, { existing: tags });
    if (!result.ok) {
      // Silently skip — the suggestion list is filtered against the
      // current tags, so a failure here means a case-insensitive dupe
      // (e.g. 'Electronics' vs 'electronics'). No toast needed.
      return;
    }

    onUpdate([...tags, result.value]);
    toast.success(`Added "${result.value}"`);
  };

  // ============================================
  // REMOVE
  // ============================================

  const handleRemoveTag = (tag: string) => {
    onUpdate(tags.filter((t) => t !== tag));
    toast.success('Tag removed');
  };

  // ============================================
  // EDIT
  // ============================================

  const handleStartEdit = (tag: string) => {
    setEditingTag(tag);
    setEditValue(tag);
  };

  const handleCancelEdit = () => {
    setEditingTag(null);
    setEditValue('');
  };

  const handleSaveEdit = () => {
    if (editingTag === null) return;

    const result = validateTag(editValue, {
      existing: tags,
      ignore: editingTag,
    });

    if (!result.ok) {
      toast.error(result.reason);
      return;
    }

    if (result.value === editingTag) {
      // No change; just close the editor.
      handleCancelEdit();
      return;
    }

    onUpdate(tags.map((t) => (t === editingTag ? result.value : t)));
    handleCancelEdit();
    toast.success('Tag updated');
  };

  // ============================================
  // INPUT HANDLERS
  // ============================================

  const handleAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === 'Escape') {
      setNewTag('');
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  // ============================================
  // FILTERS
  // ============================================

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredTags = useMemo(() => {
    if (!normalizedSearch) return tags;
    return tags.filter((tag) =>
      tag.toLowerCase().includes(normalizedSearch)
    );
  }, [tags, normalizedSearch]);

  const filteredSuggestions = useMemo(() => {
    const lower = new Set(tags.map((t) => t.toLowerCase()));
    return suggestions
      .filter((s) => {
        if (lower.has(s.toLowerCase())) return false;
        if (!normalizedSearch) return true;
        return s.toLowerCase().includes(normalizedSearch);
      })
      .slice(0, 5);
  }, [suggestions, tags, normalizedSearch]);

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tags
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Add tags to help categorize and find products. Maximum{' '}
          {MAX_TAG_LENGTH} characters each.
        </p>
      </div>

      {/* Search + Add */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tags..."
            className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
          />
        </div>

        {canManage && (
          <div className="flex gap-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleAddKeyDown}
              placeholder="New tag..."
              maxLength={MAX_TAG_LENGTH}
              className="w-32 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
            />
            <button
              type="button"
              onClick={handleAddTag}
              disabled={!newTag.trim()}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              aria-label="Add tag"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Suggestions */}
      {canManage && filteredSuggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Suggestions:
          </span>
          {filteredSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => handleAddSuggestion(suggestion)}
              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              + {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Tags list */}
      {tags.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <Tag className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No tags added yet
          </p>
        </div>
      ) : filteredTags.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No tags match &ldquo;{searchQuery}&rdquo;
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {filteredTags.map((tag) => {
            const isEditing = editingTag === tag;

            return (
              <motion.div
                key={tag}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-full group hover:shadow-sm transition-shadow"
              >
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      maxLength={MAX_TAG_LENGTH}
                      className="w-24 px-1 py-0.5 text-sm bg-transparent border-b border-blue-300 focus:outline-none focus:border-blue-600 text-gray-900 dark:text-white"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="p-0.5 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                      aria-label="Save tag"
                    >
                      <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                      aria-label="Cancel edit"
                    >
                      <X className="w-3 h-3 text-red-600 dark:text-red-400" />
                    </button>
                  </>
                ) : (
                  <>
                    <Tag className="w-3 h-3 text-blue-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {tag}
                    </span>
                    {canManage && (
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(tag)}
                          className="p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded"
                          aria-label={`Edit tag ${tag}`}
                        >
                          <Edit className="w-3 h-3 text-blue-500" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                          aria-label={`Remove tag ${tag}`}
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
          {tags.length} tag{tags.length === 1 ? '' : 's'}
          {normalizedSearch && (
            <>
              {' • '}
              {filteredTags.length} shown
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default ProductTags;
