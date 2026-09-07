// D:\Projects\Kalwanga\packages\web\components\products\ProductReviews.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Star, User, ThumbsUp, Flag, Loader2, AlertCircle, CheckCircle, Upload, X, Image as ImageIcon } from 'lucide-react';
import { productService } from '../../services/productService';
import { useAuth } from '../../hooks/useAuth';
import { toast } from '../../utils/toast-manager';
import { formatTimeAgo } from '../../utils/formatters';

interface Review {
  id: string;
  rating: number;
  title?: string | null;
  comment?: string | null;
  images?: string[];
  isVerified: boolean;
  helpfulCount: number;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: string;
}

interface ReviewStats {
  average: number;
  total: number;
  distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

interface ProductReviewsProps {
  productId: string;
  canManage?: boolean;
}

const DEFAULT_STATS: ReviewStats = {
  average: 0,
  total: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

// Image compression constants
const MAX_IMAGE_SIZE = 150 * 1024; // 150KB target
const MAX_IMAGE_DIMENSION = 800; // 800px max dimension
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB max original
const MAX_REVIEW_IMAGES = 3; // Max 3 images per review

export function ProductReviews({ productId, canManage = false }: ProductReviewsProps) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [newReview, setNewReview] = useState({
    rating: 5,
    title: '',
    comment: '',
    images: [] as string[],
  });
  const [submitting, setSubmitting] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'highest' | 'lowest'>('newest');
  const [uploadingImages, setUploadingImages] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showLightbox, setShowLightbox] = useState(false);
  const reviewFileInputRef = useRef<HTMLInputElement>(null);

  const loadReviews = useCallback(async () => {
    try {
      setLoading(true);
      const result = await productService.getProductReviews(productId, {
        page,
        limit: 10,
      });
      
      const reviewsData = result?.reviews || [];
      setReviews(prev => page === 1 ? reviewsData : [...prev, ...reviewsData]);
      
      const statsData = result?.stats || DEFAULT_STATS;
      setStats({
        average: statsData.average || 0,
        total: statsData.total || 0,
        distribution: statsData.distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      });
      
      setTotalPages(result?.pagination?.totalPages || 1);
      setHasMore(page < (result?.pagination?.totalPages || 1));
    } catch (error) {
      console.error('Failed to load reviews:', error);
      toast.error('Failed to load reviews');
      setStats(DEFAULT_STATS);
    } finally {
      setLoading(false);
    }
  }, [productId, page]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  // 🔥 NEW: Image compression function
  const compressImage = (
    dataUrl: string,
    maxWidth: number = MAX_IMAGE_DIMENSION,
    maxHeight: number = MAX_IMAGE_DIMENSION,
    quality: number = 0.7
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
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
          let quality = 0.7;
          let compressed = await compressImage(result, MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, quality);
          
          let attempts = 0;
          while (compressed.length > MAX_IMAGE_SIZE && quality > 0.1 && attempts < 10) {
            quality -= 0.06;
            compressed = await compressImage(result, MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, quality);
            attempts++;
          }
          
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

  // 🔥 NEW: Handle review image upload
  const handleReviewImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (newReview.images.length >= MAX_REVIEW_IMAGES) {
      toast.error(`Maximum ${MAX_REVIEW_IMAGES} images per review`);
      e.target.value = '';
      return;
    }

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
      if (newReview.images.length + validFiles.length >= MAX_REVIEW_IMAGES) {
        toast.warning(`Maximum ${MAX_REVIEW_IMAGES} images per review, skipping remaining`);
        break;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      e.target.value = '';
      return;
    }

    setUploadingImages(true);
    const newImages: string[] = [];
    
    for (const file of validFiles) {
      try {
        const compressed = await processImageFile(file);
        newImages.push(compressed);
      } catch (error) {
        console.error('Failed to process review image:', error);
        toast.error(`Failed to process ${file.name}`);
      }
    }

    if (newImages.length > 0) {
      setNewReview(prev => ({
        ...prev,
        images: [...prev.images, ...newImages]
      }));
      toast.success(`${newImages.length} image(s) added`);
    }

    setUploadingImages(false);
    e.target.value = '';
  };

  const removeReviewImage = (index: number) => {
    setNewReview(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  // ============================================
  // HANDLERS
  // ============================================

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please login to submit a review');
      return;
    }

    if (!newReview.comment?.trim()) {
      toast.error('Please write a comment');
      return;
    }

    setSubmitting(true);
    try {
      await productService.createProductReview({
        productId,
        userId: user.id,
        rating: newReview.rating,
        title: newReview.title || undefined,
        comment: newReview.comment,
        images: newReview.images || [], // 🔥 Include images
      });
      
      toast.success('Review submitted successfully!');
      setNewReview({ rating: 5, title: '', comment: '', images: [] });
      setShowReviewForm(false);
      setPage(1);
      loadReviews();
    } catch (error: any) {
      console.error('Failed to submit review:', error);
      toast.error(error?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkHelpful = async (reviewId: string) => {
    try {
      const result = await productService.markReviewHelpful(reviewId);
      if (result?.helpful) {
        setReviews(prev => prev.map(r => 
          r.id === reviewId ? { ...r, helpfulCount: (r.helpfulCount || 0) + 1 } : r
        ));
        toast.success('Marked as helpful');
      }
    } catch (error) {
      console.error('Failed to mark review as helpful:', error);
      toast.error('Failed to mark review');
    }
  };

  const handleReport = async (reviewId: string) => {
    const reason = prompt('Please enter a reason for reporting this review:');
    if (!reason) return;
    
    try {
      await productService.reportReview(reviewId, reason);
      toast.success('Review reported successfully');
    } catch (error) {
      console.error('Failed to report review:', error);
      toast.error('Failed to report review');
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm('Are you sure you want to delete this review?')) return;
    
    try {
      await productService.deleteProductReview(reviewId);
      toast.success('Review deleted');
      loadReviews();
    } catch (error) {
      console.error('Failed to delete review:', error);
      toast.error('Failed to delete review');
    }
  };

  // 🔥 NEW: Sort reviews
  const sortedReviews = useCallback((reviewsList: Review[]) => {
    const sorted = [...reviewsList];
    switch (sortBy) {
      case 'newest':
        return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case 'highest':
        return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      case 'lowest':
        return sorted.sort((a, b) => (a.rating || 0) - (b.rating || 0));
      default:
        return sorted;
    }
  }, [sortBy]);

  // ============================================
  // RENDER HELPERS
  // ============================================

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300 dark:text-gray-600'}`}
          />
        ))}
      </div>
    );
  };

  const renderStarSelector = () => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setNewReview({ ...newReview, rating: star })}
            className="focus:outline-none"
          >
            <Star
              className={`w-6 h-6 ${star <= newReview.rating ? 'text-yellow-400 fill-current' : 'text-gray-300 dark:text-gray-600'} transition-colors hover:text-yellow-400`}
            />
          </button>
        ))}
        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">{newReview.rating}/5</span>
      </div>
    );
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || 'U';
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading && reviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-gray-500 dark:text-gray-400 mt-2">Loading reviews...</p>
      </div>
    );
  }

  const safeDistribution = stats?.distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const displayReviews = sortedReviews(reviews);

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="flex flex-wrap items-start gap-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
        <div className="text-center">
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats?.average > 0 ? stats.average.toFixed(1) : 'N/A'}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Average Rating</div>
        </div>
        <div className="flex-1">
          <div className="space-y-1">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = safeDistribution[rating as keyof typeof safeDistribution] || 0;
              const percentage = stats?.total > 0 ? (count / stats.total) * 100 : 0;
              return (
                <div key={rating} className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400 w-4">{rating}</span>
                  <Star className="w-3 h-3 text-yellow-400 fill-current" />
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-400 rounded-full transition-all"
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-gray-900 dark:text-white">{stats?.total || 0}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Reviews</div>
        </div>
      </div>

      {/* Write Review Button */}
      {user && !showReviewForm && (
        <button
          onClick={() => setShowReviewForm(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Write a Review
        </button>
      )}

      {/* Review Form */}
      {showReviewForm && (
        <form onSubmit={handleSubmitReview} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900 dark:text-white">Write a Review</h4>
            <button
              type="button"
              onClick={() => setShowReviewForm(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rating</label>
            {renderStarSelector()}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
            <input
              type="text"
              value={newReview.title}
              onChange={(e) => setNewReview({ ...newReview, title: e.target.value })}
              placeholder="Summarize your experience"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Comment</label>
            <textarea
              value={newReview.comment}
              onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
              placeholder="Share your experience with this product"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>
          
          {/* 🔥 NEW: Review Images Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Images (Max {MAX_REVIEW_IMAGES})
            </label>
            <div className="flex flex-wrap gap-3">
              {newReview.images.map((img, index) => (
                <div key={index} className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-gray-200">
                  <img 
                    src={img} 
                    alt={`Review image ${index + 1}`} 
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => {
                      setSelectedImage(img);
                      setShowLightbox(true);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removeReviewImage(index)}
                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {newReview.images.length < MAX_REVIEW_IMAGES && (
                <label className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-500 cursor-pointer flex flex-col items-center justify-center text-gray-400">
                  {uploadingImages ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                  <span className="text-[10px] mt-1">Upload</span>
                  <input
                    type="file"
                    ref={reviewFileInputRef}
                    accept="image/*"
                    multiple
                    onChange={handleReviewImageUpload}
                    className="hidden"
                    disabled={uploadingImages}
                  />
                </label>
              )}
            </div>
          </div>
          
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowReviewForm(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit Review
            </button>
          </div>
        </form>
      )}

      {/* Sort */}
      {reviews.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">{reviews.length} reviews</p>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="newest">Newest First</option>
            <option value="highest">Highest Rated</option>
            <option value="lowest">Lowest Rated</option>
          </select>
        </div>
      )}

      {/* Reviews List */}
      {displayReviews.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">📝</div>
          <p className="text-gray-500 dark:text-gray-400">No reviews yet</p>
          {user && (
            <button
              onClick={() => setShowReviewForm(true)}
              className="mt-2 text-blue-600 dark:text-blue-400 hover:underline"
            >
              Be the first to review
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {displayReviews.map((review) => (
            <div key={review.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 font-medium">
                    {getInitials(review.user?.firstName || '', review.user?.lastName || '')}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {review.user?.firstName || 'Unknown'} {review.user?.lastName || ''}
                      </span>
                      {review.isVerified && (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {renderStars(review.rating || 0)}
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatTimeAgo(review.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
                {canManage && (
                  <button
                    onClick={() => handleDeleteReview(review.id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Delete
                  </button>
                )}
              </div>
              
              {review.title && (
                <h5 className="font-medium text-gray-900 dark:text-white mt-2">{review.title}</h5>
              )}
              <p className="text-gray-600 dark:text-gray-300 mt-1">{review.comment}</p>
              
              {/* 🔥 UPDATED: Review images with lightbox */}
              {review.images && review.images.length > 0 && (
                <div className="flex gap-2 mt-2">
                  {review.images.map((img, idx) => (
                    <img 
                      key={idx} 
                      src={img} 
                      alt={`Review image ${idx + 1}`} 
                      className="w-16 h-16 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => {
                        setSelectedImage(img);
                        setShowLightbox(true);
                      }}
                    />
                  ))}
                </div>
              )}
              
              <div className="flex items-center gap-4 mt-3">
                <button
                  onClick={() => handleMarkHelpful(review.id)}
                  className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <ThumbsUp className="w-4 h-4" />
                  <span>{review.helpfulCount || 0}</span>
                  <span>Helpful</span>
                </button>
                <button
                  onClick={() => handleReport(review.id)}
                  className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  <Flag className="w-4 h-4" />
                  Report
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load More */}
      {hasMore && (
        <button
          onClick={() => setPage(prev => prev + 1)}
          disabled={loading}
          className="w-full py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Load More Reviews'}
        </button>
      )}

      {/* 🔥 NEW: Image Lightbox */}
      {showLightbox && selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <button
            onClick={() => setShowLightbox(false)}
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Close lightbox"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={selectedImage}
            alt="Full size"
            className="max-w-[90vw] max-h-[90vh] object-contain"
          />
        </div>
      )}
    </div>
  );
}

export default ProductReviews;
