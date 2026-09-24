'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';

interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  labels: { previous: string; next: string; range: string; nav: string };
}

/** "21–40 of 124" with previous/next; hidden when everything fits on one page */
export function Pagination({ page, limit, total, onPageChange, labels }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;

  return (
    <nav aria-label={labels.nav} className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground tabular-nums">{labels.range}</p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft aria-hidden />
          <span className="sr-only sm:not-sr-only">{labels.previous}</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          <span className="sr-only sm:not-sr-only">{labels.next}</span>
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  );
}

/** First and last item numbers on a page, for "21–40 of 124" */
export function pageRange(
  page: number,
  limit: number,
  total: number,
): { from: number; to: number } {
  if (total === 0) return { from: 0, to: 0 };
  const from = (page - 1) * limit + 1;
  return { from, to: Math.min(total, page * limit) };
}
