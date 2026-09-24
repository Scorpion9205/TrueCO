import { CheckCheck, IndianRupee, UserCheck } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { formatCurrency } from '@/lib/format';

/**
 * Illustrative dashboard snippets for the hero, drawn with the design system instead of a
 * screenshot so it stays sharp, themed and light. Figures are sample values, not claims.
 */
export async function ProductPreview() {
  const t = await getTranslations('Preview');
  const present = 42;
  const absent = 3;
  const rate = Math.round((present / (present + absent)) * 100);

  return (
    <div
      role="img"
      aria-label={t('label')}
      className="relative mx-auto w-full max-w-md lg:max-w-none"
    >
      <div aria-hidden className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-brand-soft" />

      <div aria-hidden className="grid gap-4">
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-brand-soft text-primary">
              <UserCheck className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{t('attendance')}</p>
              <p className="truncate text-xs text-muted-foreground">{t('attendanceValue')}</p>
            </div>
            <p className="ml-auto text-2xl font-extrabold">{rate}%</p>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-brand" style={{ width: `${rate}%` }} />
          </div>
          <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">{present}</span> {t('present')}
            </span>
            <span>
              <span className="font-semibold text-foreground">{absent}</span> {t('absent')}
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-foreground p-5 text-background shadow-card">
            <IndianRupee className="size-5 text-brand" />
            <p className="mt-3 text-xs opacity-70">{t('fees')}</p>
            <p className="mt-1 text-2xl font-extrabold">{formatCurrency(184500)}</p>
            <p className="mt-1 text-xs opacity-70">
              {formatCurrency(21000)} {t('due')}
            </p>
          </div>

          <div className="flex flex-col rounded-xl border bg-card p-4 shadow-card">
            <div className="rounded-lg rounded-tl-none bg-whatsapp/10 p-3 text-xs leading-relaxed">
              {t('message')}
            </div>
            <p className="mt-auto flex items-center gap-1.5 pt-3 text-xs font-medium text-whatsapp">
              <CheckCheck className="size-4" />
              {t('delivered')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
