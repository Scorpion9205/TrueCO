import { ChevronDown } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Native select, styled like Input. Native beats a custom listbox here: phones show their own
 * picker, and keyboard and screen reader support come for free.
 */
export function Select({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(
          'flex h-11 w-full appearance-none rounded-md border border-input bg-background pr-10 pl-4 text-base transition-colors disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive sm:text-sm',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
