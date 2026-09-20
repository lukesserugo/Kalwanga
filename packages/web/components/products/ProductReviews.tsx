// D:\Projects\Kalwanga\packages\web\components\products\ProductReviews.tsx

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Star,
  ThumbsUp,
  Loader2,
  CheckCircle,
  Clock,
  XCircle,
  Trash2,
  X,
  LogIn,
} from 'lucide-react';
import { productService } from '../../services/productService';
import { useAuth } from '../../hooks/useAuth';
import { toast } from '../../utils/toast-manager';
import { formatTimeAgo } from '../../utils/formatters';

// ============================================
// TYPES
// ============================================

type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED';

interface Review {
  id: string;
  productId: string;
  rating: number;
  title?: string | null;
  comment?: string | null;
  images: string[];
  isVerified: boolean;
  helpfulCount: number;
  status: ReviewStatus;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
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
  /**
   * Mirrors the backend route gate `requireInventoryPermission('inventory:delete')`.
   * When false, the Delete button is hidden for every review.
   */
  canManage?: boolean;
}

const DEFAULT_STATS: ReviewStats = {
  average: 0,
  total: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

// ============================================
// HELPERS
// ============================================

function safeDistribution(
  dist: ReviewStats['distribution'] | undefined,
): ReviewStats['distribution'] {
  const base = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (!dist) return base;
  for (const k of [1, 2, 3, 4, 5] as const) {
    const value = (dist as any)[k] ?? (dist as any)[String(k)] ?? 0;
    base[k] = Number(value) || 0;
  }
  return base;
}

function statusLabel(status: ReviewStatus): {
  label: string;
  className: string;
  Icon: React.ComponentType<{ className?: string }>;
} | null {
  switch (status) {
    case 'PENDING':
      return {
        label: 'Pending approval',
        className:
          'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
        Icon: Clock,
      };
    case 'REJECTED':
      return {
        label: 'Rejected',
        className:
          'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
        Icon: XCircle,
      };
    case 'FLAGGED':
      return {
        label: 'Flagged',
        className:
          'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
        Icon: XCircle,
      };
    default:
      return null;
  }
}

/**
 * Coerce an unknown value to a valid rating integer (1–5) or `null`.
 * Used defensively wherever a rating enters or leaves this component,
 * so a stray string from a form input can never reach the API as a
 * non-number.
 */
function coerceRating(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const int = Math.trunc(n);
  if (int < 1 || int > 5) return null;
  return int;
}

// ============================================
// COMPONENT
// ============================================

export function ProductReviews({
  productId,
  canManage = false,
}: ProductReviewsProps) {
  const { user, isAuthenticated } = useAuth();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // ✅ Guests can't read reviews today — the backend only exposes them
  //    on an authenticated route. Track that here so we can render a
  //    "Sign in to see reviews" prompt instead of a misleading
  //    "No reviews yet."
  const [authRequired, setAuthRequired] = useState(false);

  const [newReview, setNewReview] = useState<{
    rating: number;
    title: string;
    comment: string;
  }>({
    rating: 5,
    title: '',
    comment: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'highest' | 'lowest'>(
    'newest',
  );

  const [markedHelpful, setMarkedHelpful] = useState<Set<string>>(new Set());
  const [hasUserReviewed, setHasUserReviewed] = useState(false);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ============================================
  // DATA LOADING
  // ============================================

  const loadReviews = useCallback(async () => {
    try {
      setLoading(true);
      setAuthRequired(false);

      const result = await productService.getProductReviews(productId, {
        page,
        limit: 10,
      });

      if (!isMountedRef.current) return;

      const reviewsData: Review[] = result?.reviews || [];

      setReviews((prev) =>
        page === 1 ? reviewsData : [...prev, ...reviewsData],
      );

      if (user?.id && reviewsData.some((r) => r.user?.id === user.id)) {
        setHasUserReviewed(true);
      }

      const statsData = result?.stats || DEFAULT_STATS;
      setStats({
        average: Number(statsData.average) || 0,
        total: Number(statsData.total) || 0,
        distribution: safeDistribution(statsData.distribution),
      });

      const total = result?.pagination?.totalPages || 1;
      setTotalPages(total);
      setHasMore(page < total);
    } catch (error: any) {
      if (!isMountedRef.current) return;

      // ✅ 401/403 means the user isn't authenticated. Show a prompt
      //    instead of an error toast — this is expected for guests.
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        setAuthRequired(true);
        setReviews([]);
        setStats(DEFAULT_STATS);
        return;
      }

      console.error('Failed to load reviews:', error);
      toast.error('Failed to load reviews');
      setStats(DEFAULT_STATS);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [productId, page, user?.id]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('Please sign in to submit a review');
      return;
    }

    if (hasUserReviewed) {
      toast.error('You have already reviewed this product');
      return;
    }

    // ✅ Coerce and validate before hitting the API. `newReview.rating`
    //    may have been set from an input that yields a string; the
    //    backend schema expects a real number.
    const rating = coerceRating(newReview.rating);

    if (rating === null) {
      toast.error('Please select a rating between 1 and 5');
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
        rating, // ← guaranteed number
        title: newReview.title.trim() || undefined,
        comment: newReview.comment.trim(),
      });

      toast.success('Review submitted for approval');
      setNewReview({ rating: 5, title: '', comment: '' });
      setShowReviewForm(false);
      setHasUserReviewed(true);
      setPage(1);
      loadReviews();
    } catch (error: any) {
      console.error('Failed to submit review:', error);
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to submit review';
      toast.error(message);

      if (/already reviewed/i.test(message)) {
        setHasUserReviewed(true);
        setShowReviewForm(false);
      }
    } finally {
      if (isMountedRef.current) setSubmitting(false);
    }
  };

  const handleMarkHelpful = async (reviewId: string) => {
    if (!isAuthenticated) {
      toast.info('Sign in to mark reviews as helpful');
      return;
    }

    if (markedHelpful.has(reviewId)) return;

    try {
      const result = await productService.markReviewHelpful(reviewId);

      const nextCount =
        typeof result?.helpfulCount === 'number'
          ? result.helpfulCount
          : undefined;

      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId
            ? {
                ...r,
                helpfulCount:
                  nextCount ?? (r.helpfulCount || 0) + 1,
              }
            : r,
        ),
      );

      setMarkedHelpful((prev) => new Set(prev).add(reviewId));
    } catch (error) {
      console.error('Failed to mark review as helpful:', error);
      toast.error('Failed to mark review');
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm('Are you sure you want to delete this review?')) return;

    try {
      await productService.deleteProductReview(reviewId);
      toast.success('Review deleted');
      setPage(1);
      loadReviews();
    } catch (error: any) {
      console.error('Failed to delete review:', error);
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to delete review';
      toast.error(message);
    }
  };

  const sortedReviews = useCallback(
    (reviewsList: Review[]) => {
      const sorted = [...reviewsList];
      switch (sortBy) {
        case 'newest':
          return sorted.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() -
              new Date(a.createdAt).getTime(),
          );
        case 'highest':
          return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        case 'lowest':
          return sorted.sort((a, b) => (a.rating || 0) - (b.rating || 0));
        default:
          return sorted;
      }
    },
    [sortBy],
  );

  // ============================================
  // RENDER HELPERS
  // ============================================

  const renderStars = (rating: number) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${
            star <= rating
              ? 'text-yellow-400 fill-current'
              : 'text-gray-300 dark:text-gray-600'
          }`}
        />
      ))}
    </div>
  );

  const renderStarSelector = () => (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() =>
            setNewReview((prev) => ({ ...prev, rating: star }))
          }
          className="focus:outline-none"
        >
          <Star
            className={`w-6 h-6 ${
              star <= newReview.rating
                ? 'text-yellow-400 fill-current'
                : 'text-gray-300 dark:text-gray-600'
            } transition-colors hover:text-yellow-400`}
          />
        </button>
      ))}
      <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
        {newReview.rating}/5
      </span>
    </div>
  );

  const getInitials = (firstName: string, lastName: string) =>
    `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || 'U';

  // ============================================
  // RENDER
  // ============================================

  if (loading && reviews.length === 0 && !authRequired) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Loading reviews...
        </p>
      </div>
    );
  }

  // ✅ Guests see a sign-in prompt instead of an empty state.
  if (authRequired) {
    return (
      <div className="text-center py-12 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-700">
        <LogIn className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
          Sign in to view reviews
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Customer reviews are only visible to signed-in users.
        </p>
        <a
          href={`/login?redirect_url=${encodeURIComponent(
            typeof window !== 'undefined'
              ? window.location.pathname
              : `/shop/${productId}`,
          )}`}
          className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <LogIn className="w-4 h-4" />
          Sign In
        </a>
      </div>
    );
  }

  const dist = safeDistribution(stats?.distribution);
  const displayReviews = sortedReviews(reviews);

  const canWriteReview =
    isAuthenticated && !hasUserReviewed && !showReviewForm;

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="flex flex-wrap items-start gap-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
        <div className="text-center">
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats?.average > 0 ? stats.average.toFixed(1) : 'N/A'}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Average Rating
          </div>
        </div>
        <div className="flex-1">
          <div className="space-y-1">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = dist[rating as 1 | 2 | 3 | 4 | 5] || 0;
              const percentage =
                stats?.total > 0 ? (count / stats.total) * 100 : 0;
              return (
                <div key={rating} className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400 w-4">
                    {rating}
                  </span>
                  <Star className="w-3 h-3 text-yellow-400 fill-current" />
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-400 rounded-full transition-all"
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {stats?.total || 0}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Total Reviews
          </div>
        </div>
      </div>

      {/* Write Review */}
      {canWriteReview && (
        <button
          onClick={() => setShowReviewForm(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Write a Review
        </button>
      )}

      {/* Sign-in prompt for guests who can't write */}
      {!isAuthenticated && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          <a
            href={`/login?redirect_url=${encodeURIComponent(
              typeof window !== 'undefined'
                ? window.location.pathname
                : `/shop/${productId}`,
            )}`}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Sign in
          </a>{' '}
          to write a review.
        </div>
      )}

      {hasUserReviewed && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          You have already reviewed this product.
        </div>
      )}

      {/* Review Form */}
      {showReviewForm && (
        <form
          onSubmit={handleSubmitReview}
          className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900 dark:text-white">
              Write a Review
            </h4>
            <button
              type="button"
              onClick={() => setShowReviewForm(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Rating
            </label>
            {renderStarSelector()}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title
            </label>
            <input
              type="text"
              value={newReview.title}
              onChange={(e) =>
                setNewReview((prev) => ({
                  ...prev,
                  title: e.target.value,
                }))
              }
              placeholder="Summarize your experience"
              maxLength={200}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Comment
            </label>
            <textarea
              value={newReview.comment}
              onChange={(e) =>
                setNewReview((prev) => ({
                  ...prev,
                  comment: e.target.value,
                }))
              }
              placeholder="Share your experience with this product"
              rows={4}
              maxLength={2000}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400">
            Reviews are reviewed by our team before appearing publicly.
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
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {reviews.length} reviews
          </p>
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
          {isAuthenticated && !hasUserReviewed && (
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
          {displayReviews.map((review) => {
            const isOwnReview = !!user?.id && review.user?.id === user.id;
            const canDelete = canManage;
            const statusBadge = statusLabel(review.status);
            const alreadyMarkedHelpful = markedHelpful.has(review.id);

            return (
              <div
                key={review.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 font-medium">
                      {getInitials(
                        review.user?.firstName || '',
                        review.user?.lastName || '',
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {review.user?.firstName || 'Unknown'}{' '}
                          {review.user?.lastName || ''}
                        </span>
                        {isOwnReview && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            (you)
                          </span>
                        )}
                        {review.isVerified && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                        {statusBadge && canManage && (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${statusBadge.className}`}
                          >
                            <statusBadge.Icon className="w-3 h-3" />
                            {statusBadge.label}
                          </span>
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
                  {canDelete && (
                    <button
                      onClick={() => handleDeleteReview(review.id)}
                      className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1"
                      title="Delete review"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  )}
                </div>

                {review.title && (
                  <h5 className="font-medium text-gray-900 dark:text-white mt-2">
                    {review.title}
                  </h5>
                )}
                <p className="text-gray-600 dark:text-gray-300 mt-1">
                  {review.comment}
                </p>

                {review.images.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {review.images.map((url, idx) => (
                      <img
                        key={idx}
                        src={url}
                        alt={`Review image ${idx + 1}`}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-4 mt-3">
                  <button
                    onClick={() => handleMarkHelpful(review.id)}
                    disabled={alreadyMarkedHelpful || !isAuthenticated}
                    className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-gray-500"
                    title={
                      !isAuthenticated
                        ? 'Sign in to mark reviews as helpful'
                        : alreadyMarkedHelpful
                        ? 'You already marked this as helpful'
                        : 'Mark as helpful'
                    }
                  >
                    <ThumbsUp className="w-4 h-4" />
                    <span>{review.helpfulCount || 0}</span>
                    <span>
                      {alreadyMarkedHelpful ? 'Helpful' : 'Helpful?'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load More */}
      {hasMore && (
        <button
          onClick={() => setPage((prev) => prev + 1)}
          disabled={loading}
          className="w-full py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          ) : (
            'Load More Reviews'
          )}
        </button>
      )}
    </div>
  );
}

export default ProductReviews;
