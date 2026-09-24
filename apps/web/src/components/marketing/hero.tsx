import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TRIAL_DAYS } from '@/lib/site';
import { ProductPreview } from './product-preview';

export async function Hero() {
  const t = await getTranslations('Hero');

  return (
    <section aria-labelledby="hero-title" className="overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:py-28">
        <div className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
          <Badge tone="brand">{t('badge')}</Badge>
          <h1
            id="hero-title"
            className="text-4xl font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl"
          >
            {t('headline')}
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground text-pretty">{t('subhead')}</p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button asChild size="lg">
              <Link href="/signup">
                {t('primary', { days: TRIAL_DAYS })} <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="#how-it-works">{t('secondary')}</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{t('note')}</p>
        </div>

        <ProductPreview />
      </div>
    </section>
  );
}
