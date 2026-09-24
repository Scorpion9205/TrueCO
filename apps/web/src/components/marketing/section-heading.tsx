import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionHeadingProps {
  id?: string;
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  className?: string;
}

/** Centered eyebrow + title + subtitle used at the top of each public-site section */
export function SectionHeading({ id, eyebrow, title, subtitle, className }: SectionHeadingProps) {
  return (
    <div
      className={cn('mx-auto flex max-w-2xl flex-col items-center gap-3 text-center', className)}
    >
      <p className="text-sm font-semibold tracking-wide text-primary uppercase">{eyebrow}</p>
      <h2 id={id} className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {subtitle ? <p className="text-lg text-muted-foreground text-pretty">{subtitle}</p> : null}
    </div>
  );
}
