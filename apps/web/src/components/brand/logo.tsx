import Link from 'next/link';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  /** Where the logo links to; pass null to render it without a link */
  href?: string | null;
}

/**
 * Text wordmark until there is a designed logo: "Varg" in the text colour, "ly" in brand orange.
 * Keep it at text-xl or larger: the vivid orange passes contrast only as large text (3:1).
 */
export function Logo({ className, href = '/' }: LogoProps) {
  const mark = (
    <span className={cn('text-xl font-extrabold tracking-tight', className)}>
      Varg<span className="text-brand">ly</span>
    </span>
  );
  if (href === null) return mark;
  return (
    <Link href={href} aria-label="Vargly home" className="rounded-sm">
      {mark}
    </Link>
  );
}
