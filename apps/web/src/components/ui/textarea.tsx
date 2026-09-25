import * as React from 'react';
import { cn } from '@/lib/utils';

export function Textarea({ className, rows = 4, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      rows={rows}
      className={cn(
        // 16px text on phones stops iOS Safari zooming into the field on focus
        'flex w-full min-w-0 resize-y rounded-md border border-input bg-background px-4 py-3 text-base transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive sm:text-sm',
        className,
      )}
      {...props}
    />
  );
}
