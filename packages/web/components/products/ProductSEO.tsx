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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-brand-500 dark:text-brand-400" />
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
                  className="btn-secondary disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-brand disabled:opacity-50"
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
                className="btn-secondary"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            )}
          </div>
        )}
      </div>

      {/* Search Preview */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
        <p className="text-2xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1 eyebrow">
          <Search className="w-3 h-3" />
          Search Engine Preview
        </p>
        <div className="space-y-1">
          <p className="text-lg text-brand-600 dark:text-brand-400 hover:underline cursor-pointer">
            {previewTitle}
          </p>
          <p className="text-sm text-success-700 dark:text-success-400 tabular-nums">
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
          className="space-y-4 animate-slide-down"
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
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
                  placeholder="Enter meta title"
                  maxLength={200}
                />
                <button
                  type="button"
                  onClick={generateMetaTitle}
                  className="px-3 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition duration-250 focus-ring"
                  title="Generate from product name"
                  aria-label="Generate meta title"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              <p
                className={`text-2xs mt-1 tabular-nums ${
                  titleLength > 60
                    ? 'text-warning-600 dark:text-warning-400'
                    : 'text-gray-400 dark:text-gray-500'
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
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
                  placeholder="Enter URL slug"
                />
                <button
                  type="button"
                  onClick={generateSlug}
                  className="px-3 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition duration-250 focus-ring"
                  title="Generate from product name"
                  aria-label="Generate URL slug"
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
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 resize-none"
              placeholder="Enter meta description"
              maxLength={400}
            />
            <p
              className={`text-2xs mt-1 tabular-nums ${
                descriptionLength > 160
                  ? 'text-warning-600 dark:text-warning-400'
                  : 'text-gray-400 dark:text-gray-500'
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
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
                placeholder="Add keyword..."
              />
              <button
                type="button"
                onClick={addKeyword}
                disabled={!keywordInput.trim()}
                className="btn-brand disabled:opacity-50"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.keywords && formData.keywords.length > 0 ? (
                formData.keywords.map((keyword, index) => (
                  <span
                    key={`${keyword}-${index}`}
                    className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-xl text-sm"
                  >
                    {keyword}
                    <button
                      type="button"
                      onClick={() => removeKeyword(index)}
                      className="p-0.5 hover:bg-danger-100 dark:hover:bg-danger-900/30 rounded transition duration-250 focus-ring"
                      aria-label={`Remove keyword ${keyword}`}
                    >
                      <X className="w-3 h-3 text-danger-500" />
                    </button>
                  </span>
                ))
              ) : (
                <p className="text-2xs text-gray-400 dark:text-gray-500">
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
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
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 resize-none"
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
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
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
                className="w-4 h-4 text-brand-600 rounded border-gray-300 dark:border-gray-600 focus:ring-brand-500 bg-white dark:bg-gray-700 transition duration-250"
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
                className="w-4 h-4 text-brand-600 rounded border-gray-300 dark:border-gray-600 focus:ring-brand-500 bg-white dark:bg-gray-700 transition duration-250"
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
