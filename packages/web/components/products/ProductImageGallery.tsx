'use client';

// D:\Projects\Kalwanga\packages\web\components\products\ProductImageGallery.tsx

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Image as ImageIcon,
  Upload,
  X,
  Plus,
  Trash2,
  GripVertical,
  Check,
  AlertCircle,
  Loader2,
  Download,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from '../../utils/toast-manager';

// ============================================
// BACKEND CONTRACT
// ============================================
//
// The backend normalizes `Product.images` (a `ProductImage[]` relation)
// to a flat `string[]` on the wire. The array order IS the display
// order — index 0 is primary. There is no separate isPrimary field on
// the wire.
//
// Storage rules:
//   • Data URLs are persisted to disk by `persistImages()` on the
//     inventory-create path. The DB stores the resulting short URL.
//   • On the non-inventory create/update path, the raw string is
//     written to `ProductImage.url`, which is `VarChar(2048)`. A
//     longer string triggers a Postgres P2000.
//   • The frontend's `productService` always routes through the
//     inventory path when `inventoryId` is present. We assume that
//     path but still enforce the 2048-char ceiling as a safety net.
//
// `updateProductSchema.images` in validators.ts:
//   z.array(z.string().max(5000000)).max(10).optional()
// The `.max(5000000)` is a soft cap — the real constraint is the
// VarChar(2048) column.

const BACKEND_MAX_IMAGES = 10;
const BACKEND_MAX_IMAGE_URL_CHARS = 2048;

// Client-side targets. These are deliberately stricter than the
// backend so uploads stay fast.
const TARGET_IMAGE_SIZE = 200 * 1024; // 200 KB post-compression
const TARGET_IMAGE_DIMENSION = 1200; // 1200 px max side
const MAX_ORIGINAL_FILE_SIZE = 5 * 1024 * 1024; // 5 MB — matches backend

const PLACEHOLDER_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// ============================================
// TYPES
// ============================================

interface ProductImageGalleryProps {
  images: string[];
  onUpdate: (images: string[]) => void;
  canManage?: boolean;
  /**
   * Client-side cap. Defaults to the backend's `MAX_IMAGES` of 10 so
   * the UI can never produce a payload the service would silently
   * truncate.
   */
  maxImages?: number;
}

// ============================================
// HELPERS
// ============================================

function detectImageExtension(image: string): string {
  if (image.startsWith('data:image/')) {
    const match = /^data:image\/([a-zA-Z0-9+.-]+)/.exec(image);
    if (match) {
      const sub = match[1].toLowerCase();
      if (sub === 'jpeg') return 'jpg';
      if (sub === 'svg+xml') return 'svg';
      return sub;
    }
  }
  try {
    const url = new URL(image, 'https://placeholder.local');
    const ext = url.pathname.split('.').pop()?.toLowerCase();
    if (ext && ext.length <= 5) return ext;
  } catch {
    // not a URL
  }
  return 'jpg';
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function compressImageDataUrl(
  dataUrl: string,
  maxDimension: number,
  quality: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;

        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = (maxDimension / width) * height;
            width = maxDimension;
          } else {
            width = (maxDimension / height) * width;
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Compress a data URL so its string length is under the target.
 * Starts at quality 0.85 and steps down by 0.1 until it fits or
 * quality reaches 0.3. Falls back to a smaller canvas if needed.
 */
async function processImageFile(file: File): Promise<string> {
  const original = await readFileAsDataURL(file);

  let quality = 0.85;
  let compressed = await compressImageDataUrl(
    original,
    TARGET_IMAGE_DIMENSION,
    quality,
  );

  let attempts = 0;
  while (
    compressed.length > TARGET_IMAGE_SIZE &&
    quality > 0.3 &&
    attempts < 6
  ) {
    quality -= 0.1;
    compressed = await compressImageDataUrl(
      original,
      TARGET_IMAGE_DIMENSION,
      quality,
    );
    attempts++;
  }

  if (compressed.length > TARGET_IMAGE_SIZE) {
    compressed = await compressImageDataUrl(original, 800, 0.5);
  }

  return compressed;
}

/**
 * Does this string fit inside `ProductImage.url` (VarChar(2048))?
 * Data URLs that survive compression are almost always under this
 * limit, but a pathological input could exceed it. The inventory
 * create path persists images to disk and stores short URLs, but
 * other paths write directly.
 */
function fitsInDatabase(url: string): boolean {
  return url.length <= BACKEND_MAX_IMAGE_URL_CHARS;
}

// ============================================
// COMPONENT
// ============================================

export function ProductImageGallery({
  images,
  onUpdate,
  canManage = true,
  maxImages = BACKEND_MAX_IMAGES,
}: ProductImageGalleryProps) {
  const effectiveMax = Math.min(maxImages, BACKEND_MAX_IMAGES);

  const [uploading, setUploading] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null,
  );
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ✅ Debounce for drag-reorder. `onDragOver` fires many times per
  //    second; without batching, each pixel crossed triggers onUpdate.
  const dragRafRef = useRef<number | null>(null);
  const pendingReorderRef = useRef<{
    from: number;
    to: number;
  } | null>(null);

  // ============================================
  // DERIVED
  // ============================================

  // Stable keys for the grid. Two identical strings in `images` would
  // otherwise collide on `${index}-${image.slice(0, 40)}`.
  const imageKeys = useMemo(() => {
    const seen = new Map<string, number>();
    return images.map((image, index) => {
      const count = seen.get(image) ?? 0;
      seen.set(image, count + 1);
      return `${index}-${count}-${image.slice(0, 24)}`;
    });
  }, [images]);

  // ============================================
  // SAFETY NET — clamp over-limit arrays
  // ============================================
  //
  // If the parent ever passes more images than the backend accepts
  // (e.g. data migrated from another system), trim on mount.

  useEffect(() => {
    if (images.length > effectiveMax) {
      console.warn(
        `ProductImageGallery: images.length (${images.length}) exceeds maxImages (${effectiveMax}). Trimming.`,
      );
      onUpdate(images.slice(0, effectiveMax));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length, effectiveMax]);

  // ============================================
  // UPLOAD
  // ============================================

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const remainingSlots = effectiveMax - images.length;
      if (remainingSlots <= 0) {
        toast.error(`Maximum ${effectiveMax} images allowed`);
        e.target.value = '';
        return;
      }

      const candidates = Array.from(files);
      const accepted: File[] = [];

      for (const file of candidates) {
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} is not an image file`);
          continue;
        }
        if (file.size > MAX_ORIGINAL_FILE_SIZE) {
          toast.error(
            `${file.name} exceeds the ${
              MAX_ORIGINAL_FILE_SIZE / 1024 / 1024
            } MB limit`,
          );
          continue;
        }
        if (accepted.length >= remainingSlots) {
          toast.warning(
            `Only ${remainingSlots} more image${
              remainingSlots === 1 ? '' : 's'
            } allowed, skipping the rest`,
          );
          break;
        }
        accepted.push(file);
      }

      if (accepted.length === 0) {
        e.target.value = '';
        return;
      }

      setUploading(true);
      setUploadProgress({ current: 0, total: accepted.length });

      const newImages: string[] = [];
      let tooLargeCount = 0;

      for (let i = 0; i < accepted.length; i++) {
        setUploadProgress({ current: i + 1, total: accepted.length });
        try {
          const compressed = await processImageFile(accepted[i]);

          // ✅ Safety net for the VarChar(2048) ceiling.
          if (!fitsInDatabase(compressed)) {
            console.warn(
              `Image "${accepted[i].name}" compressed to ${compressed.length} chars — exceeds the ${BACKEND_MAX_IMAGE_URL_CHARS}-char DB limit. Skipping.`,
            );
            tooLargeCount++;
            continue;
          }

          newImages.push(compressed);
        } catch (err) {
          console.error(`Failed to process ${accepted[i].name}:`, err);
          toast.error(`Failed to process ${accepted[i].name}`);
        }
      }

      if (newImages.length > 0) {
        const merged = [...images, ...newImages].slice(0, effectiveMax);
        onUpdate(merged);
        toast.success(
          `${newImages.length} image${
            newImages.length === 1 ? '' : 's'
          } added`,
        );
      }

      if (tooLargeCount > 0) {
        toast.warning(
          `${tooLargeCount} image${
            tooLargeCount === 1 ? '' : 's'
          } exceeded the storage limit and were skipped`,
        );
      }

      if (newImages.length === 0 && tooLargeCount === 0) {
        toast.error('No images were processed successfully');
      }

      setUploading(false);
      setUploadProgress(null);
      e.target.value = '';
    },
    [images, effectiveMax, onUpdate],
  );

  // ============================================
  // REMOVE / REORDER / PRIMARY
  // ============================================

  const handleRemoveImage = useCallback(
    (index: number) => {
      const next = images.filter((_, i) => i !== index);
      onUpdate(next);

      setSelectedImageIndex((prev) => {
        if (prev === null) return null;
        if (prev === index) return null;
        if (prev > index) return prev - 1;
        return prev;
      });

      toast.success('Image removed');
    },
    [images, onUpdate],
  );

  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= images.length ||
        toIndex >= images.length
      ) {
        return;
      }

      const next = [...images];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      onUpdate(next);
    },
    [images, onUpdate],
  );

  const handleSetPrimary = useCallback(
    (index: number) => {
      if (index === 0) return;
      handleReorder(index, 0);
      toast.success('Primary image set');
    },
    [handleReorder],
  );

  // ============================================
  // DRAG HANDLERS
  // ============================================
  //
  // HTML5 drag events. Desktop-only. Touch reorder would require
  // pointer-events.

  const flushPendingReorder = useCallback(() => {
    dragRafRef.current = null;
    const pending = pendingReorderRef.current;
    pendingReorderRef.current = null;
    if (pending) {
      handleReorder(pending.from, pending.to);
    }
  }, [handleReorder]);

  const scheduleReorder = useCallback(
    (from: number, to: number) => {
      pendingReorderRef.current = { from, to };
      if (dragRafRef.current === null) {
        dragRafRef.current = requestAnimationFrame(flushPendingReorder);
      }
    },
    [flushPendingReorder],
  );

  useEffect(() => {
    return () => {
      if (dragRafRef.current !== null) {
        cancelAnimationFrame(dragRafRef.current);
      }
    };
  }, []);

  const handleDragStart = (index: number) => {
    if (!canManage || uploading) return;
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    scheduleReorder(dragIndex, index);
    setDragIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    pendingReorderRef.current = null;
  };

  // ============================================
  // IMAGE ERROR HANDLING
  // ============================================

  const handleImageError = useCallback((image: string) => {
    setBrokenImages((prev) => {
      if (prev.has(image)) return prev;
      const next = new Set(prev);
      next.add(image);
      return next;
    });
  }, []);

  const resolveImageSrc = useCallback(
    (image: string): string => {
      if (brokenImages.has(image)) return PLACEHOLDER_IMAGE;
      return image;
    },
    [brokenImages],
  );

  // ============================================
  // DOWNLOAD
  // ============================================

  const handleDownloadImage = (image: string, index: number) => {
    try {
      const ext = detectImageExtension(image);
      const link = document.createElement('a');
      link.href = image;
      link.download = `product-image-${index + 1}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Image downloaded');
    } catch (err) {
      console.error('Failed to download image:', err);
      toast.error('Failed to download image');
    }
  };

  // ============================================
  // LIGHTBOX
  // ============================================

  const openLightbox = (index: number) => {
    setSelectedImageIndex(index);
  };

  const closeLightbox = useCallback(() => {
    setSelectedImageIndex(null);
  }, []);

  const handlePrevImage = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      setSelectedImageIndex((prev) => {
        if (prev === null || images.length === 0) return prev;
        return prev > 0 ? prev - 1 : images.length - 1;
      });
    },
    [images.length],
  );

  const handleNextImage = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      setSelectedImageIndex((prev) => {
        if (prev === null || images.length === 0) return prev;
        return prev < images.length - 1 ? prev + 1 : 0;
      });
    },
    [images.length],
  );

  // ✅ Keyboard navigation while the lightbox is open.
  useEffect(() => {
    if (selectedImageIndex === null) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') handlePrevImage();
      else if (e.key === 'ArrowRight') handleNextImage();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    selectedImageIndex,
    closeLightbox,
    handlePrevImage,
    handleNextImage,
  ]);

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Product Images
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {images.length} / {effectiveMax} images • Drag to reorder • Max{' '}
            {MAX_ORIGINAL_FILE_SIZE / 1024 / 1024} MB per file
          </p>
        </div>
        {canManage && images.length < effectiveMax && (
          <label className="cursor-pointer">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {uploading ? 'Uploading...' : 'Add Images'}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        )}
      </div>

      {/* Upload Progress */}
      {uploading && uploadProgress && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span className="text-sm text-blue-700 dark:text-blue-300">
              Processing image {uploadProgress.current} of{' '}
              {uploadProgress.total}...
            </span>
          </div>
          <div className="w-full bg-blue-100 dark:bg-blue-900/50 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${
                  (uploadProgress.current / uploadProgress.total) * 100
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Image Grid */}
      {images.length === 0 ? (
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
          <ImageIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            No images uploaded
          </p>
          {canManage && (
            <label className="cursor-pointer mt-2 inline-block">
              <span className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                Upload your first image
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {images.map((image, index) => {
            const src = resolveImageSrc(image);
            const key = imageKeys[index];
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                draggable={canManage && !uploading}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`relative group aspect-square rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 transition-colors ${
                  index === 0 ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                } ${dragIndex === index ? 'opacity-50' : ''}`}
              >
                <img
                  src={src}
                  alt={`Product image ${index + 1}`}
                  className="w-full h-full object-cover"
                  onError={() => handleImageError(image)}
                  loading="lazy"
                />

                <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/50 text-white text-xs rounded">
                  {index + 1}
                </div>

                {index === 0 && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-blue-600 text-white text-xs rounded">
                    Primary
                  </div>
                )}

                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => openLightbox(index)}
                    className="p-1.5 bg-white/20 text-white rounded-lg hover:bg-white/30"
                    title="Preview"
                    aria-label={`Preview image ${index + 1}`}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadImage(image, index)}
                    className="p-1.5 bg-white/20 text-white rounded-lg hover:bg-white/30"
                    title="Download"
                    aria-label={`Download image ${index + 1}`}
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  {canManage && index !== 0 && (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(index)}
                      className="p-1.5 bg-green-600/80 text-white rounded-lg hover:bg-green-700"
                      title="Set as primary"
                      aria-label={`Set image ${index + 1} as primary`}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="p-1.5 bg-red-600/80 text-white rounded-lg hover:bg-red-700"
                      title="Remove image"
                      aria-label={`Remove image ${index + 1}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {canManage && (
                  <div className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                    <GripVertical className="w-4 h-4" />
                  </div>
                )}
              </motion.div>
            );
          })}

          {/* Add More Tile */}
          {canManage && images.length < effectiveMax && !uploading && (
            <label className="aspect-square rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 transition-colors cursor-pointer flex flex-col items-center justify-center">
              <Plus className="w-8 h-8 text-gray-400" />
              <span className="text-sm text-gray-500 mt-2">Add Image</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          )}
        </div>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {selectedImageIndex !== null && images[selectedImageIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            onClick={closeLightbox}
            role="dialog"
            aria-modal="true"
            aria-label="Image preview"
          >
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
              aria-label="Close preview"
            >
              <X className="w-6 h-6" />
            </button>

            {images.length > 1 && (
              <button
                type="button"
                onClick={handlePrevImage}
                className="absolute left-4 p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            <img
              src={resolveImageSrc(images[selectedImageIndex])}
              alt={`Full size ${selectedImageIndex + 1}`}
              className="max-w-[90vw] max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
              onError={() => handleImageError(images[selectedImageIndex])}
            />

            {images.length > 1 && (
              <button
                type="button"
                onClick={handleNextImage}
                className="absolute right-4 p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                aria-label="Next image"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-3">
              <span className="text-white text-sm">
                {selectedImageIndex + 1} / {images.length}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadImage(
                    images[selectedImageIndex],
                    selectedImageIndex,
                  );
                }}
                className="p-1.5 bg-white/20 text-white rounded-lg hover:bg-white/30"
                title="Download this image"
                aria-label="Download this image"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ProductImageGallery;
