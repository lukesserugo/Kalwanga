// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\catalog\tags\page.tsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { TagIcon, PlusIcon, XMarkIcon, TrashIcon } from '@heroicons/react/24/outline';
import { usePermission } from '../../../../../hooks/usePermission';
import { productService } from '../../../../../services/productService';
import { toast } from '../../../../../utils/toast-manager';
import { Lock, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { PermissionResource } from '../../../../../types/enums';

interface Tag {
  name: string;
  count: number;
}

export default function TagsPage() {
  const router = useRouter();
  const { canManage, isLoading: permissionLoading } = usePermission();
  
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManageTags = canManage(PermissionResource.PRODUCT);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && canManageTags) {
      loadTags();
    } else if (isClient && !canManageTags) {
      setLoading(false);
    }
  }, [isClient, canManageTags]);

  const loadTags = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      const data = await productService.getProductTags();
      setTags(data || []);
    } catch (error) {
      console.error('Failed to load tags:', error);
      setError('Failed to load tags. Please try again.');
      toast.error('Failed to load tags');
      setTags([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTags(false);
    toast.success('Tags refreshed');
  };

  const handleAddTag = async () => {
    const trimmedTag = newTag.trim();
    if (!trimmedTag) {
      toast.warning('Please enter a tag name');
      return;
    }

    if (tags.some(t => t.name.toLowerCase() === trimmedTag.toLowerCase())) {
      toast.warning(`Tag "${trimmedTag}" already exists`);
      return;
    }

    setSubmitting(true);
    try {
      const newTagObj: Tag = { name: trimmedTag, count: 0 };
      setTags(prev => [...prev, newTagObj].sort((a, b) => a.name.localeCompare(b.name)));
      
      toast.success(`Tag "${trimmedTag}" added successfully`);
      setNewTag('');
      await loadTags(false);
    } catch (error) {
      console.error('Failed to add tag:', error);
      toast.error('Failed to add tag');
      await loadTags(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTag = async (tagName: string) => {
    if (!confirm(`Are you sure you want to remove tag "${tagName}"? This will remove it from all products.`)) {
      return;
    }

    try {
      setTags(prev => prev.filter(t => t.name !== tagName));
      toast.success(`Tag "${tagName}" removed successfully`);
      await loadTags(false);
    } catch (error) {
      console.error('Failed to remove tag:', error);
      toast.error('Failed to remove tag');
      await loadTags(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
    if (e.key === 'Escape') {
      setNewTag('');
    }
  };

  if (permissionLoading || !isClient) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (!canManageTags) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to manage tags. Please contact your administrator.
        </p>
        <button
          onClick={() => router.push('/admin/catalog')}
          className="mt-4 px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors shadow-brand focus-ring"
        >
          Back to Catalog
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <TagIcon className="w-6 h-6 text-brand-500" />
            Tags
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 tabular-nums">
            {tags.length} tags • Manage your product tags
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors disabled:opacity-50 focus-ring"
          title="Refresh tags"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-brand-accent-50 dark:bg-brand-accent-950/20 border border-brand-accent-200 dark:border-brand-accent-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-brand-accent-500 flex-shrink-0" />
          <span className="text-brand-accent-700 dark:text-brand-accent-300">{error}</span>
          <button
            onClick={() => loadTags(false)}
            className="ml-auto px-3 py-1 bg-brand-accent-100 dark:bg-brand-accent-800/30 text-brand-accent-700 dark:text-brand-accent-300 rounded-lg hover:bg-brand-accent-200 dark:hover:bg-brand-accent-800/50 transition-colors text-sm focus-ring"
          >
            Retry
          </button>
        </div>
      )}

      {/* Add Tag */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <TagIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter new tag name..."
              disabled={submitting}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors disabled:opacity-50"
            />
            {newTag && (
              <button
                onClick={() => setNewTag('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus-ring"
                aria-label="Clear input"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={handleAddTag}
            disabled={submitting || !newTag.trim()}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors min-w-[120px] shadow-brand focus-ring"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <PlusIcon className="w-4 h-4" />
                Add Tag
              </>
            )}
          </button>
        </div>
        {newTag.trim() && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Press Enter to add tag
          </p>
        )}
      </div>

      {/* Tags List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {tags.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <TagIcon className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No tags found</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Add your first tag to start organizing your products
            </p>
            <button
              onClick={() => document.querySelector('input')?.focus()}
              className="mt-4 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors inline-flex items-center gap-2 shadow-brand focus-ring"
            >
              <PlusIcon className="w-4 h-4" />
              Add Your First Tag
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {tags.map((tag) => (
              <div
                key={tag.name}
                className="flex items-center justify-between p-4 hover:bg-brand-50/50 dark:hover:bg-brand-950/10 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-brand-50 dark:bg-brand-950/20 rounded-lg flex-shrink-0">
                    <TagIcon className="w-5 h-5 text-brand-500 dark:text-brand-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {tag.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                      {tag.count} {tag.count === 1 ? 'product' : 'products'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteTag(tag.name)}
                  className="p-2 text-brand-accent-500 hover:bg-brand-accent-50 dark:hover:bg-brand-accent-950/30 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 focus-ring"
                  aria-label={`Delete tag "${tag.name}"`}
                  title={`Delete tag "${tag.name}"`}
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tag Count Summary */}
      {tags.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              Total tags: <strong className="text-gray-900 dark:text-white tabular-nums">{tags.length}</strong>
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              Total products tagged: <strong className="text-gray-900 dark:text-white tabular-nums">
                {tags.reduce((sum, tag) => sum + tag.count, 0)}
              </strong>
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              Most used tag: <strong className="text-gray-900 dark:text-white">
                {tags.length > 0 ? tags.sort((a, b) => b.count - a.count)[0]?.name : 'N/A'}
              </strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
