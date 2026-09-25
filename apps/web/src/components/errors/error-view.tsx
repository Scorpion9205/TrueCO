'use client';

import { RotateCcw, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/**
 * What a route error boundary shows: an apology, a retry, and a way out. The error itself is
 * logged for developers; users see its reference (digest) only, to quote to support.
 */
export function ErrorView({
  error,
  reset,
  homeHref,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  homeHref: string;
}) {
  const t = useTranslations('Errors');
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center"
    >
      <span className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-6" aria-hidden />
      </span>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="text-muted-foreground">{t('body')}</p>
      {error.digest ? (
        <p className="text-xs text-muted-foreground">{t('reference', { id: error.digest })}</p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={reset}>
          <RotateCcw aria-hidden />
          {t('retry')}
        </Button>
        <Button asChild variant="outline">
          <Link href={homeHref}>{t(homeHref === '/app' ? 'dashboard' : 'home')}</Link>
        </Button>
      </div>
    </div>
  );
}
