import {
  BookOpenCheck,
  BriefcaseBusiness,
  type LucideIcon,
  MessageCircle,
  ReceiptIndianRupee,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { cn } from '@/lib/utils';
import { SectionHeading } from './section-heading';

type FeatureKey = 'whatsapp' | 'attendance' | 'fees' | 'academics' | 'insights' | 'office';

// Bento layout: WhatsApp (the product's centre) takes a 2x2 tile on large screens
const FEATURES: ReadonlyArray<{ key: FeatureKey; icon: LucideIcon; className?: string }> = [
  { key: 'whatsapp', icon: MessageCircle, className: 'md:col-span-2 lg:row-span-2' },
  { key: 'attendance', icon: UserCheck },
  { key: 'fees', icon: ReceiptIndianRupee },
  { key: 'academics', icon: BookOpenCheck },
  { key: 'insights', icon: Sparkles },
  { key: 'office', icon: BriefcaseBusiness },
];

export async function Features() {
  const t = await getTranslations('Features');

  return (
    <section id="features" aria-labelledby="features-title" className="bg-muted/60">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeading
          id="features-title"
          eyebrow={t('eyebrow')}
          title={t('title')}
          subtitle={t('subtitle')}
        />

        <ul className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ key, icon: Icon, className }) => {
            const featured = key === 'whatsapp';
            return (
              <li
                key={key}
                className={cn(
                  'flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-card',
                  featured && 'border-transparent bg-foreground text-background sm:p-8',
                  className,
                )}
              >
                <span
                  className={cn(
                    'grid size-11 place-items-center rounded-full bg-brand-soft text-primary',
                    featured && 'size-12 bg-brand text-white',
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className={cn('text-lg font-bold', featured && 'text-2xl sm:text-3xl')}>
                  {t(`${key}.title`)}
                </h3>
                <p
                  className={cn(
                    'text-muted-foreground',
                    featured && 'max-w-md text-lg text-background/75',
                  )}
                >
                  {t(`${key}.body`)}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
