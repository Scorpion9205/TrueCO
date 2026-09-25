'use client';

import { useTranslations } from 'next-intl';
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { todayInIndia } from '@/lib/dates';
import { type Period, PERIODS, periodRange, rangeLabel } from '@/lib/reports';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The report period, kept in the URL (?period=lastMonth, or custom with ?from=&to=) */
export function usePeriod(defaultPeriod: Period = 'thisMonth') {
  const [params, setParams] = useQueryStates({
    period: parseAsStringLiteral(PERIODS).withDefault(defaultPeriod),
    from: parseAsString,
    to: parseAsString,
  });
  const today = todayInIndia();
  const clean = (value: string | null) => (value && DAY.test(value) ? value : null);
  const range = periodRange(params.period, today, {
    from: clean(params.from),
    to: clean(params.to),
  });
  return { period: params.period, range, setParams, today };
}

export function PeriodPicker({ defaultPeriod = 'thisMonth' }: { defaultPeriod?: Period }) {
  const t = useTranslations('Reports.period');
  const { period, range, setParams, today } = usePeriod(defaultPeriod);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex flex-col gap-2 sm:w-52">
        <span className="text-sm font-medium">{t('label')}</span>
        <Select
          value={period}
          onChange={(event) => {
            const next = event.target.value as Period;
            // Custom starts from the range on screen, so switching does not jump elsewhere
            void setParams(
              next === 'custom'
                ? { period: next, from: range[0], to: range[1] }
                : { period: next === defaultPeriod ? null : next, from: null, to: null },
            );
          }}
        >
          {PERIODS.map((value) => (
            <option key={value} value={value}>
              {t(value)}
            </option>
          ))}
        </Select>
      </label>
      {period === 'custom' ? (
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t('from')}</span>
            <Input
              type="date"
              max={today}
              value={range[0]}
              onChange={(event) =>
                event.target.value && void setParams({ from: event.target.value })
              }
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t('to')}</span>
            <Input
              type="date"
              max={today}
              value={range[1]}
              onChange={(event) => event.target.value && void setParams({ to: event.target.value })}
            />
          </label>
        </div>
      ) : (
        <p className="pb-3 text-sm text-muted-foreground">{rangeLabel(range)}</p>
      )}
    </div>
  );
}
