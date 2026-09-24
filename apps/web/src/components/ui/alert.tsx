import { cva, type VariantProps } from 'class-variance-authority';
import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  'flex gap-3 rounded-lg border p-4 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0',
  {
    variants: {
      tone: {
        info: 'border-info/30 bg-info/5 text-foreground [&>svg]:text-info',
        success: 'border-success/30 bg-success/5 text-foreground [&>svg]:text-success',
        danger: 'border-destructive/30 bg-destructive/5 text-foreground [&>svg]:text-destructive',
      },
    },
    defaultVariants: { tone: 'info' },
  },
);

const ICONS = { info: Info, success: CircleCheck, danger: CircleAlert } as const;

export interface AlertProps
  extends React.ComponentProps<'div'>, VariantProps<typeof alertVariants> {}

/** Inline message; danger alerts are announced to screen readers as soon as they appear */
export function Alert({ className, tone, children, ...props }: AlertProps) {
  const Icon = ICONS[tone ?? 'info'];
  return (
    <div
      data-slot="alert"
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(alertVariants({ tone }), className)}
      {...props}
    >
      <Icon aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
