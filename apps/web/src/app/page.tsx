import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Logo } from '@/components/brand/logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Placeholder home until the public site (Phase 7.2) replaces it
export default async function HomePage() {
  const t = await getTranslations('Home');
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 sm:px-6">
      <header className="flex h-16 items-center justify-between">
        <Logo />
        <Button asChild variant="outline" size="sm">
          <Link href="/login">{t('signIn')}</Link>
        </Button>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
        <Badge tone="brand">{t('badge')}</Badge>
        <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">
          {t('headline')}
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground text-pretty">{t('subhead')}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/login">
              {t('signIn')} <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="mailto:hello@trueco.in">{t('contact')}</a>
          </Button>
        </div>
      </section>
    </main>
  );
}
