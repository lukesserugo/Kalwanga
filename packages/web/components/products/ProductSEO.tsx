'use client';

// D:\Projects\Kalwanga\packages\web\components\products\ProductSEO.tsx

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Globe, Search, RefreshCw, Edit, Save, X } from 'lucide-react';
import { toast } from '../../utils/toast-manager';

// ============================================
// TYPES
// ============================================

interface SEOData {
  title?: string;
  description?: string;
  keywords?: string[];
  slug?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonicalUrl?: string;
  noIndex?: boolean;
  noFollow?: boolean;
}

interface ProductSEOProps {
  productName: string;
  sku: string;
  seo: SEOData;
  onUpdate: (seo: SEOData) => void;
  canManage?: boolean;
}

// ============================================
// HELPERS
// ============================================

function buildFormData(source: SEOData | null | undefined): SEOData {
  return {
    title: source?.title || '',
    description: source?.description || '',
    keywords: Array.isArray(source?.keywords) ? source!.keywords : [],
    slug: source?.slug || '',
    ogTitle: source?.ogTitle || '',
    ogDescription: source?.ogDescription || '',
    ogImage: source?.ogImage || '',
    canonicalUrl: source?.canonicalUrl || '',
    noIndex: source?.noIndex || false,
    noFollow: source?.noFollow || false,
  };
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Build the payload to persist. This is a **full replacement** of the
 * `seo` object — Prisma writes whatever JSON you send.
 *
 * Rules:
 *   • String fields are trimmed. Empty strings are kept as `undefined`
 *     so the stored object doesn't accumulate `""` keys.
 *   • `keywords` is deduped and trimmed; empty array is dropped.
 *   • Booleans are only emitted when `true`. Absent = false.
 */
function buildSavePayload(form: SEOData): SEOData {
  const payload: SEOData = {};

  const title = form.title?.trim();
  if (title) payload.title = title;

  const description = form.description?.trim();
  if (description) payload.description = description;

  const slug = form.slug?.trim();
  if (slug) payload.slug = slug;

  const keywords = Array.from(
    new Set(
      (form.keywords || [])
        .map((k) => k.trim())
        .filter((k) => k.length > 0),
    ),
  );
  if (keywords.length > 0) payload.keywords = keywords;

  const ogTitle = form.ogTitle?.trim();
  if (ogTitle) payload.ogTitle = ogTitle;

  const ogDescription = form.ogDescription?.trim();
  if (ogDescription) payload.ogDescription = ogDescription;

  const ogImage = form.ogImage?.trim();
  if (ogImage) payload.ogImage = ogImage;

  const canonicalUrl = form.canonicalUrl?.trim();
  if (canonicalUrl) payload.canonicalUrl = canonicalUrl;

  if (form.noIndex) payload.noIndex = true;
  if (form.noFollow) payload.noFollow = true;

  return payload;
}

// ============================================
// COMPONENT
// ============================================

export function ProductSEO({
  productName,
  sku,
  seo,
  onUpdate,
  canManage = true,
}: ProductSEOProps) {
  const [formData, setFormData] = useState<SEOData>(() =>
    buildFormData(seo),
  );
  const [keywordInput, setKeywordInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Re-sync when the parent passes a new `seo` object. Skip while
  // editing so we don't clobber in-progress input.
  useEffect(() => {
    if (!isEditing) {
      setFormData(buildFormData(seo));
    }
  }, [seo, isEditing]);

  // ============================================
  // GENERATORS
  // ============================================

  const generateSlug = () => {
    const slug = slugify(productName);
    setFormData((prev) => ({ ...prev, slug }));
    toast.success('Slug generated');
  };

  const generateMetaTitle = () => {
    const title = `${productName} - SKU: ${sku}`;
    setFormData((prev) => ({ ...prev, title }));
    toast.success('Meta title generated');
  };

  // ============================================
  // KEYWORDS
  // ============================================

  const addKeyword = () => {
    const trimmed = keywordInput.trim();
    if (!trimmed) return;
    if (formData.keywords?.includes(trimmed)) {
      toast.warning('Keyword already exists');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      keywords: [...(prev.keywords || []), trimmed],
    }));
    setKeywordInput('');
  };

  const removeKeyword = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      keywords: (prev.keywords || []).filter((_, i) => i !== index),
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addKeyword();
    }
  };

  // ============================================
  // SAVE / CANCEL
  // ============================================

  const handleSave = () => {
    setSaving(true);

    // ✅ Full-replacement payload. Prisma writes whatever JSON you send,
    //    so this is the only way to actually clear a field the user
    //    blanked out. Empty strings/arrays/booleans are dropped so we
    //    don't accumulate `""` or `[]` keys, but a cleared field stays
    //    cleared because the value is *absent* from the new object.
    const payload = buildSavePayload(formData);

    // The `setTimeout` delay in the original version was cosmetic.
    // Call the parent immediately so state updates don't race with
    // the toast.
    try {
      onUpdate(payload);
      setIsEditing(false);
      toast.success('SEO settings saved');
    } catch (err) {
      console.error('Failed to save SEO:', err);
      toast.error('Failed to save SEO settings');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData(buildFormData(seo));
  };

  // ============================================
  // PREVIEW
  // ============================================

  const previewTitle = formData.title?.trim() || productName;
  const previewDescription =
    formData.description?.trim() || 'No description provided';
  const previewSlug = formData.slug?.trim() || slugify(productName);

  const titleLength = formData.title?.length || 0;
  const descriptionLength = formData.description?.length || 0;

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-500" />
            SEO &amp; Metadata
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Optimize your product for search engines
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50"
                >
                  {saving ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            )}
          </div>
        )}
      </div>

      {/* Search Preview */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
          <Search className="w-3 h-3" />
          Search Engine Preview
        </p>
        <div className="space-y-1">
          <p className="text-lg text-blue-600 hover:underline cursor-pointer">
            {previewTitle}
          </p>
          <p className="text-sm text-green-700 dark:text-green-400">
            {previewSlug
              ? `https://example.com/products/${previewSlug}`
              : 'https://example.com/products/...'}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
            {previewDescription}
          </p>
        </div>
      </div>

      {/* SEO Form */}
      {isEditing && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Meta Title
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter meta title"
                  maxLength={200}
                />
                <button
                  type="button"
                  onClick={generateMetaTitle}
                  className="px-3 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300"
                  title="Generate from product name"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              <p
                className={`text-xs mt-1 ${
                  titleLength > 60
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-gray-400'
                }`}
              >
                {titleLength} / 60 characters
                {titleLength > 60 ? ' — longer titles may be truncated' : ''}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                URL Slug
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.slug || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      slug: e.target.value,
                    }))
                  }
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter URL slug"
                />
                <button
                  type="button"
                  onClick={generateSlug}
                  className="px-3 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300"
                  title="Generate from product name"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Meta Description
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter meta description"
              maxLength={400}
            />
            <p
              className={`text-xs mt-1 ${
                descriptionLength > 160
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-gray-400'
              }`}
            >
              {descriptionLength} / 160 characters
              {descriptionLength > 160
                ? ' — longer descriptions may be truncated'
                : ''}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Keywords
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Add keyword..."
              />
              <button
                type="button"
                onClick={addKeyword}
                disabled={!keywordInput.trim()}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.keywords && formData.keywords.length > 0 ? (
                formData.keywords.map((keyword, index) => (
                  <span
                    key={`${keyword}-${index}`}
                    className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm"
                  >
                    {keyword}
                    <button
                      type="button"
                      onClick={() => removeKeyword(index)}
                      className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                      aria-label={`Remove keyword ${keyword}`}
                    >
                      <X className="w-3 h-3 text-red-500" />
                    </button>
                  </span>
                ))
              ) : (
                <p className="text-xs text-gray-400">
                  No keywords added yet
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                OG Title
              </label>
              <input
                type="text"
                value={formData.ogTitle || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    ogTitle: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Open Graph title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                OG Image URL
              </label>
              <input
                type="text"
                value={formData.ogImage || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    ogImage: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="https://example.com/og-image.jpg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              OG Description
            </label>
            <textarea
              value={formData.ogDescription || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  ogDescription: e.target.value,
                }))
              }
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Open Graph description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Canonical URL
            </label>
            <input
              type="text"
              value={formData.canonicalUrl || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  canonicalUrl: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="https://example.com/canonical-url"
            />
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!formData.noIndex}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    noIndex: e.target.checked,
                  }))
                }
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                No Index
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!formData.noFollow}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    noFollow: e.target.checked,
                  }))
                }
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                No Follow
              </span>
            </label>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default ProductSEO;
