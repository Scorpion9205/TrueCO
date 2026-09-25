'use client';

import { useTranslations } from 'next-intl';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';
import { AttendanceReportView } from './attendance-report';
import { FeeReportView } from './fee-report';
import { ProfitLossView } from './profit-loss-report';

const TABS = ['fees', 'attendance', 'pnl'] as const;

export function ReportsPage() {
  const t = useTranslations('Reports');
  const [tab, setTab] = useQueryState('tab', parseAsStringLiteral(TABS).withDefault('fees'));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div
        role="tablist"
        aria-label={t('tabs.label')}
        className="flex gap-1 overflow-x-auto border-b"
      >
        {TABS.map((value) => (
          <button
            key={value}
            id={`report-tab-${value}`}
            type="button"
            role="tab"
            aria-selected={tab === value}
            aria-controls="report-panel"
            // Changing report keeps the chosen period, so the same months compare across tabs
            onClick={() => void setTab(value === 'fees' ? null : value)}
            className={cn(
              '-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors',
              tab === value
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`tabs.${value}`)}
          </button>
        ))}
      </div>

      <div id="report-panel" role="tabpanel" aria-labelledby={`report-tab-${tab}`}>
        {tab === 'fees' ? (
          <FeeReportView />
        ) : tab === 'attendance' ? (
          <AttendanceReportView />
        ) : (
          <ProfitLossView />
        )}
      </div>
    </div>
  );
}
