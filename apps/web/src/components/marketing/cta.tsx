import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TRIAL_DAYS } from '@/lib/site';

/**
 * Closing call to action. A plain GET form to /signup?email=..., so it works without JavaScript
 * and the signup page can prefill the address.
 */
export async function Cta() {
  const t = await getTranslations('Cta');

  return (
    <section aria-labelledby="cta-title" className="px-4 py-16 sm:px-6 sm:py-24">
      <div className="reveal relative mx-auto max-w-6xl overflow-hidden rounded-xl bg-foreground px-6 py-12 text-center text-background sm:px-12 sm:py-16">
        <div
          aria-hidden
          className="absolute -top-24 -right-24 size-64 rounded-full bg-brand/30 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-24 -left-24 size-64 rounded-full bg-brand/20 blur-3xl"
        />

        <div className="relative mx-auto flex max-w-xl flex-col items-center gap-4">
          <h2
            id="cta-title"
            className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl"
          >
            {t('title')}
          </h2>
          <p className="text-lg text-background/75">{t('subtitle', { days: TRIAL_DAYS })}</p>

          <form
            action="/signup"
            method="get"
            className="mt-4 flex w-full flex-col gap-3 sm:flex-row"
          >
            <label htmlFor="cta-email" className="sr-only">
              {t('emailLabel')}
            </label>
            <Input
              id="cta-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder={t('emailPlaceholder')}
              className="h-12 flex-1 rounded-full border-transparent bg-background px-5 text-foreground"
            />
            <Button type="submit" size="lg">
              {t('submit')} <ArrowRight />
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
