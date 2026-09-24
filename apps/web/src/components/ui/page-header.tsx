import type { ReactNode } from 'react';

/** Page title with an optional subtitle and actions (which wrap below the title on phones) */
export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** A link back to the parent list, shown above the title */
  back?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4">
      {back}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight break-words sm:text-3xl">
            {title}
          </h1>
          {subtitle ? <div className="mt-1 text-muted-foreground">{subtitle}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
