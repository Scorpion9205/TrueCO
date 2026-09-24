import * as React from 'react';
import { cn } from '@/lib/utils';

/** Placeholder shown while data loads; sized by the caller to match the content it stands in for. */
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}
