'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import { shiftMonth } from '@/lib/attendance';
import { todayInIndia } from '@/lib/dates';
import { Button } from './button';
import { Input } from './input';

const MONTH = /^\d{4}-\d{2}$/;

/**
 * The month a page shows, kept in the URL (?month=YYYY-MM). Defaults to the current month in
 * India; future months cannot be chosen.
 */
export function useMonthParam(): [string, (month: string) => void] {
  const current = todayInIndia().slice(0, 7);
  const [value, setValue] = useQueryState('month', parseAsString);
  const month = value && MONTH.test(value) && value <= current ? value : current;
  return [month, (next) => void setValue(next === current ? null : next)];
}

export function MonthPicker({
  month,
  onChange,
}: {
  month: string;
  onChange: (month: string) => void;
}) {
  const t = useTranslations('Common.month');
  const current = todayInIndia().slice(0, 7);
  return (
    <div className="flex items-end gap-2">
      <Button
        variant="outline"
        size="icon"
        className="h-11"
        aria-label={t('previous')}
        onClick={() => onChange(shiftMonth(month, -1))}
      >
        <ChevronLeft aria-hidden />
      </Button>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t('label')}</span>
        <Input
          type="month"
          value={month}
          max={current}
          onChange={(event) => event.target.value && onChange(event.target.value)}
        />
      </label>
      <Button
        variant="outline"
        size="icon"
        className="h-11"
        aria-label={t('next')}
        disabled={month >= current}
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        <ChevronRight aria-hidden />
      </Button>
    </div>
  );
}
