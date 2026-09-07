// D:\Projects\Kalwanga\packages\web\components\products\ProductSEO.tsx
'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Globe, Search, FileText, Link, Eye,
  RefreshCw, Check, AlertCircle, ChevronDown,
  Copy, Edit, Save, X
} from 'lucide-react';
import { toast } from '../../utils/toast-manager';

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

export function ProductSEO({ productName, sku, seo, onUpdate, canManage = true }: ProductSEOProps) {
  const [formData, setFormData] = useState<SEOData>({
    title: seo.title || '',
    description: seo.description || '',
    keywords: seo.keywords || [],
    slug: seo.slug || '',
    ogTitle: seo.ogTitle || '',
    ogDescription: seo.ogDescription || '',
    ogImage: seo.ogImage || '',
    canonicalUrl: seo.canonicalUrl || '',
    noIndex: seo.noIndex || false,
    noFollow: seo.noFollow || false,
  });
  const [keywordInput, setKeywordInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const generateSlug = () => {
    const slug = productName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setFormData({ ...formData, slug });
    toast.success('Slug generated');
  };

  const generateMetaTitle = () => {
    const title = `${productName} - SKU: ${sku}`;
    setFormData({ ...formData, title });
    toast.success('Meta title generated');
  };

  const addKeyword = () => {
    const trimmed = keywordInput.trim();
    if (!trimmed) return;
    if (formData.keywords?.includes(trimmed)) {
      toast.warning('Keyword already exists');
      return;
    }
    setFormData({
      ...formData,
      keywords: [...(formData.keywords || []), trimmed],
    });
    setKeywordInput('');
  };

  const removeKeyword = (index: number) => {
    setFormData({
      ...formData,
      keywords: formData.keywords?.filter((_, i) => i !== index) || [],
    });
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      onUpdate(formData);
      setSaving(false);
      setIsEditing(false);
      toast.success('SEO settings saved');
    }, 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addKeyword();
    }
  };

  const previewTitle = formData.title || productName;
  const previewDescription = formData.description || 'No description provided';
  const previewSlug = formData.slug || `${productName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-500" />
            SEO & Metadata
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
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      title: seo.title || '',
                      description: seo.description || '',
                      keywords: seo.keywords || [],
                      slug: seo.slug || '',
                      ogTitle: seo.ogTitle || '',
                      ogDescription: seo.ogDescription || '',
                      ogImage: seo.ogImage || '',
                      canonicalUrl: seo.canonicalUrl || '',
                      noIndex: seo.noIndex || false,
                      noFollow: seo.noFollow || false,
                    });
                  }}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </button>
              </>
            ) : (
              <button
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
            {previewSlug ? `https://example.com/products/${previewSlug}` : 'https://example.com/products/...'}
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
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter meta title"
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
              <p className="text-xs text-gray-400 mt-1">
                {formData.title?.length || 0} / 60 characters
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
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter meta description"
            />
            <p className="text-xs text-gray-400 mt-1">
              {formData.description?.length || 0} / 160 characters
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
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.keywords?.map((keyword, index) => (
                <span
                  key={index}
                  className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm"
                >
                  {keyword}
                  <button
                    type="button"
                    onClick={() => removeKeyword(index)}
                    className="p-0.5 hover:bg-red-100 rounded"
                  >
                    <X className="w-3 h-3 text-red-500" />
                  </button>
                </span>
              ))}
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
                onChange={(e) => setFormData({ ...formData, ogTitle: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, ogImage: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, ogDescription: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, canonicalUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="https://example.com/canonical-url"
            />
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.noIndex}
                onChange={(e) => setFormData({ ...formData, noIndex: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">No Index</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.noFollow}
                onChange={(e) => setFormData({ ...formData, noFollow: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">No Follow</span>
            </label>
          </div>
        </motion.div>
      )}
    </div>
  );
}
