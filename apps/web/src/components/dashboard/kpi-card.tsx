import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  /** Emphasises a figure that needs attention (e.g. students at risk) */
  tone?: 'default' | 'attention';
  className?: string;
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = 'default',
  className,
}: KpiCardProps) {
  return (
    <div className={cn('flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-full',
            tone === 'attention'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-brand-soft text-primary',
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="text-2xl font-extrabold tracking-tight tabular-nums sm:text-3xl">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
