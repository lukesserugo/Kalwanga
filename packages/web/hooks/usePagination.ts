// src/hooks/usePagination.ts
import { useState, useCallback } from 'react';

interface UsePaginationOptions {
  initialPage?: number;
  initialLimit?: number;
  total?: number;
}

export function usePagination({ initialPage = 1, initialLimit = 10, total = 0 }: UsePaginationOptions = {}) {
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [totalItems, setTotalItems] = useState(total);

  const totalPages = Math.ceil(totalItems / limit);

  const nextPage = useCallback(() => {
    setPage(prev => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setPage(prev => Math.max(prev - 1, 1));
  }, []);

  const goToPage = useCallback((page: number) => {
    setPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);

  const setTotal = useCallback((total: number) => {
    setTotalItems(total);
  }, []);

  const reset = useCallback(() => {
    setPage(initialPage);
    setLimit(initialLimit);
  }, [initialPage, initialLimit]);

  const getOffset = useCallback(() => {
    return (page - 1) * limit;
  }, [page, limit]);

  const getPagination = useCallback(() => {
    return {
      page,
      limit,
      total: totalItems,
      totalPages,
      offset: getOffset(),
    };
  }, [page, limit, totalItems, totalPages, getOffset]);

  return {
    page,
    limit,
    totalItems,
    totalPages,
    nextPage,
    prevPage,
    goToPage,
    setPage,
    setLimit,
    setTotal,
    reset,
    getOffset,
    getPagination,
  };
}
