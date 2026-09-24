import Link from 'next/link';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  /** Where the logo links to; pass null to render it without a link */
  href?: string | null;
}

/** Text wordmark until there is a designed logo: "True" in the text colour, "CO" in brand orange. */
export function Logo({ className, href = '/' }: LogoProps) {
  const mark = (
    <span className={cn('text-xl font-extrabold tracking-tight', className)}>
      True<span className="text-brand">CO</span>
    </span>
  );
  if (href === null) return mark;
  return (
    <Link href={href} aria-label="TrueCO home" className="rounded-sm">
      {mark}
    </Link>
  );
}
