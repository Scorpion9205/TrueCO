import { Check } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/logo';
import { TRIAL_DAYS } from '@/lib/site';

/** Split screen: the form on the left, a brand panel on the right (hidden on small screens) */
export default async function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  const t = await getTranslations('Auth.panel');

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="flex flex-col px-4 py-6 sm:px-8">
        <Logo />
        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>

      <aside className="relative hidden overflow-hidden bg-foreground p-12 text-background lg:flex lg:flex-col lg:justify-end">
        <div
          aria-hidden
          className="absolute -top-32 -right-32 size-96 rounded-full bg-brand/40 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute bottom-40 -left-24 size-72 rounded-full bg-brand/20 blur-3xl"
        />
        <div className="relative max-w-md">
          <h2 className="text-4xl font-extrabold tracking-tight text-balance">{t('title')}</h2>
          <p className="mt-4 text-lg text-background/75">{t('body')}</p>
          <ul className="mt-8 flex flex-col gap-3">
            {[t('point1', { days: TRIAL_DAYS }), t('point2'), t('point3')].map((point) => (
              <li key={point} className="flex items-center gap-3">
                <span className="grid size-6 place-items-center rounded-full bg-brand text-white">
                  <Check className="size-3.5" aria-hidden />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
