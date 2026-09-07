// D:\Projects\Kalwanga\packages\web\components\products\ProductImageGallery.tsx
'use client';

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Image as ImageIcon, Upload, X, Plus, Trash2,
  Move, GripVertical, RefreshCw, Check, AlertCircle,
  Loader2, Download, Eye, ZoomIn, ZoomOut
} from 'lucide-react';
import { toast } from '../../utils/toast-manager';

interface ProductImageGalleryProps {
  images: string[];
  onUpdate: (images: string[]) => void;
  canManage?: boolean;
  maxImages?: number;
}

// Image compression constants
const MAX_IMAGE_SIZE = 150 * 1024; // 150KB target
const MAX_IMAGE_DIMENSION = 800; // 800px max dimension
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB max original

export function ProductImageGallery({ 
  images, 
  onUpdate, 
  canManage = true,
  maxImages = 10 
}: ProductImageGalleryProps) {
  const [uploading, setUploading] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showLightbox, setShowLightbox] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🔥 NEW: Image compression function
  const compressImage = (
    dataUrl: string,
    maxWidth: number = MAX_IMAGE_DIMENSION,
    maxHeight: number = MAX_IMAGE_DIMENSION,
    quality: number = 0.8
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Resize if too large
          if (width > maxWidth) {
            height = (maxWidth / width) * height;
            width = maxWidth;
          }
          if (height > maxHeight) {
            width = (maxHeight / height) * width;
            height = maxHeight;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
          } else {
            reject(new Error('Could not get canvas context'));
          }
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  };

  const processImageFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const result = reader.result as string;
          let quality = 0.8;
          let compressed = await compressImage(result, MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, quality);
          
          // Progressive compression
          let attempts = 0;
          while (compressed.length > MAX_IMAGE_SIZE && quality > 0.1 && attempts < 10) {
            quality -= 0.07;
            compressed = await compressImage(result, MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, quality);
            attempts++;
          }
          
          // Final fallback with smaller dimensions
          if (compressed.length > MAX_IMAGE_SIZE) {
            compressed = await compressImage(result, 500, 500, 0.3);
          }
          
          resolve(compressed);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Check max images
    if (images.length + files.length > maxImages) {
      toast.error(`Maximum ${maxImages} images allowed. You can add ${maxImages - images.length} more.`);
      e.target.value = '';
      return;
    }

    // Validate files
    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image file`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} exceeds the ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      e.target.value = '';
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress({ current: 0, total: validFiles.length });

    try {
      const newImages: string[] = [];
      
      for (let i = 0; i < validFiles.length; i++) {
        setUploadProgress({ current: i + 1, total: validFiles.length });
        try {
          const compressed = await processImageFile(validFiles[i]);
          newImages.push(compressed);
        } catch (error) {
          console.error(`Failed to process ${validFiles[i].name}:`, error);
          toast.error(`Failed to process ${validFiles[i].name}`);
        }
      }

      if (newImages.length > 0) {
        const updatedImages = [...images, ...newImages];
        onUpdate(updatedImages);
        toast.success(`${newImages.length} image${newImages.length > 1 ? 's' : ''} added successfully`);
      } else {
        toast.error('No images were processed successfully');
      }
    } catch (error) {
      setError('Failed to upload images');
      toast.error('Failed to upload images');
    } finally {
      setUploading(false);
      setUploadProgress(null);
      e.target.value = '';
    }
  }, [images, maxImages, onUpdate]);

  const handleRemoveImage = useCallback((index: number) => {
    const updatedImages = images.filter((_, i) => i !== index);
    onUpdate(updatedImages);
    toast.success('Image removed');
  }, [images, onUpdate]);

  const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const updatedImages = [...images];
    const [moved] = updatedImages.splice(fromIndex, 1);
    updatedImages.splice(toIndex, 0, moved);
    onUpdate(updatedImages);
  }, [images, onUpdate]);

  const handleSetPrimary = useCallback((index: number) => {
    if (index === 0) return;
    const updatedImages = [...images];
    const [primary] = updatedImages.splice(index, 1);
    updatedImages.unshift(primary);
    onUpdate(updatedImages);
    toast.success('Primary image set');
  }, [images, onUpdate]);

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== index) {
      handleReorder(dragIndex, index);
      setDragIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = '/placeholder-image.png';
  };

  const handleDownloadImage = (image: string, index: number) => {
    const link = document.createElement('a');
    link.href = image;
    link.download = `product-image-${index + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Image downloaded');
  };

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedImage || images.length === 0) return;
    const currentIndex = images.indexOf(selectedImage);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
    setSelectedImage(images[prevIndex]);
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedImage || images.length === 0) return;
    const currentIndex = images.indexOf(selectedImage);
    const nextIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
    setSelectedImage(images[nextIndex]);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Product Images</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {images.length} / {maxImages} images • Drag to reorder • Max 5MB per image
          </p>
        </div>
        {canManage && images.length < maxImages && (
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
              Processing image {uploadProgress.current} of {uploadProgress.total}...
            </span>
          </div>
          <div className="w-full bg-blue-100 dark:bg-blue-900/50 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4 text-red-500" />
          </button>
        </div>
      )}

      {/* Image Grid */}
      {images.length === 0 ? (
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
          <ImageIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No images uploaded</p>
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
          {images.map((image, index) => (
            <motion.div
              key={`${index}-${image.slice(0, 50)}`}
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
                src={image}
                alt={`Product image ${index + 1}`}
                className="w-full h-full object-cover"
                onError={handleImageError}
                loading="lazy"
              />
              
              {/* Image Number Badge */}
              <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/50 text-white text-xs rounded">
                {index + 1}
              </div>

              {/* Badge */}
              {index === 0 && (
                <div className="absolute top-2 left-2 px-2 py-0.5 bg-blue-600 text-white text-xs rounded">
                  Primary
                </div>
              )}

              {/* Overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  onClick={() => {
                    setSelectedImage(image);
                    setShowLightbox(true);
                  }}
                  className="p-1.5 bg-white/20 text-white rounded-lg hover:bg-white/30"
                  title="Preview"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDownloadImage(image, index)}
                  className="p-1.5 bg-white/20 text-white rounded-lg hover:bg-white/30"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
                {canManage && index !== 0 && (
                  <button
                    onClick={() => handleSetPrimary(index)}
                    className="p-1.5 bg-green-600/80 text-white rounded-lg hover:bg-green-700"
                    title="Set as primary"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
                {canManage && (
                  <button
                    onClick={() => handleRemoveImage(index)}
                    className="p-1.5 bg-red-600/80 text-white rounded-lg hover:bg-red-700"
                    title="Remove image"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Drag Handle */}
              {canManage && (
                <div className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                  <GripVertical className="w-4 h-4" />
                </div>
              )}
            </motion.div>
          ))}

          {/* Add More */}
          {canManage && images.length < maxImages && !uploading && (
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
        {showLightbox && selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            onClick={() => setShowLightbox(false)}
          >
            <button
              onClick={() => setShowLightbox(false)}
              className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
              aria-label="Close lightbox"
            >
              <X className="w-6 h-6" />
            </button>
            
            {/* Previous Button */}
            <button
              onClick={handlePrevImage}
              className="absolute left-4 p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
              aria-label="Previous image"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <img
              src={selectedImage}
              alt="Full size"
              className="max-w-[90vw] max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            
            {/* Next Button */}
            <button
              onClick={handleNextImage}
              className="absolute right-4 p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
              aria-label="Next image"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Image Counter */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2">
              <span className="text-white text-sm">
                {images.indexOf(selectedImage) + 1} / {images.length}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
