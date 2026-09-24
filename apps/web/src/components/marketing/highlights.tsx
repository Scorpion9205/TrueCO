import { getTranslations } from 'next-intl/server';
import { formatCurrency } from '@/lib/format';
import { TRIAL_DAYS } from '@/lib/site';
import { cn } from '@/lib/utils';

/**
 * Blue band of product facts. Only true, checkable facts go here (trial length, real starting
 * price) — customer counts or ratings get added once there are real numbers to show.
 */
export async function Highlights({ startingPrice }: { startingPrice: number | null }) {
  const t = await getTranslations('Highlights');
  const items = [
    { value: t('trialValue', { days: TRIAL_DAYS }), label: t('trial') },
    ...(startingPrice ? [{ value: formatCurrency(startingPrice), label: t('startingPrice') }] : []),
    { value: t('whatsappValue'), label: t('whatsapp') },
    { value: t('privacyValue'), label: t('privacy') },
  ];

  return (
    <section aria-label={t('label')} className="px-4 sm:px-6">
      <dl
        className={cn(
          'mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-8 rounded-xl bg-band px-6 py-10 text-band-foreground sm:px-10',
          items.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3',
        )}
      >
        {items.map((item) => (
          <div key={item.label} className="flex flex-col-reverse gap-1 text-center">
            <dt className="text-sm text-band-foreground/80">{item.label}</dt>
            <dd className="text-2xl font-extrabold tracking-tight sm:text-3xl">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
