'use client';

import { useQuery } from '@tanstack/react-query';
import { monthRange, shiftMonth } from './attendance';
import { api } from './auth/session';
import { useQueryScope } from './queries';

// apps/api reports DTOs; money in rupees, days as YYYY-MM-DD

export interface FeeDefaulter {
  studentId: string;
  studentName: string;
  studentPhone: string;
  parentName?: string;
  parentPhone?: string;
  pendingAmount: number;
  overdueDays: number;
  installmentDueDate: string;
}

export interface FeeReport {
  totalExpected: number;
  totalCollected: number;
  totalWaived: number;
  totalPending: number;
  totalOverdue: number;
  collectionPercentage: number | null;
  defaulterCount: number;
  defaulters: FeeDefaulter[];
}

export interface StudentAttendance {
  studentId: string;
  studentName: string;
  totalClasses: number;
  attendedClasses: number;
  percentage: number;
}

export interface AttendanceReport {
  totalSessions: number;
  threshold: number;
  averageAttendancePercentage: number | null;
  defaultersCount: number;
  students: StudentAttendance[];
  defaulters: StudentAttendance[];
}

export interface ProfitLossReport {
  totalRevenue: number;
  teacherSalaryExpenses: number;
  generalExpenses: number;
  totalExpenses: number;
  netProfit: number;
  profitMarginPercentage: number | null;
}

// ---------- Periods ----------

export const PERIODS = ['thisMonth', 'lastMonth', 'thisYear', 'lastYear', 'custom'] as const;
export type Period = (typeof PERIODS)[number];

/** The Indian financial year (April to March) a day falls in, as its first calendar year */
function financialYear(day: string): number {
  const year = Number(day.slice(0, 4));
  return Number(day.slice(5, 7)) >= 4 ? year : year - 1;
}

/**
 * First and last day of a period, never past today. Custom ranges come from the caller and
 * are put in order; an empty end means "up to today".
 */
export function periodRange(
  period: Period,
  today: string,
  custom: { from?: string | null; to?: string | null } = {},
): [string, string] {
  const month = today.slice(0, 7);
  const fy = financialYear(today);
  switch (period) {
    case 'thisMonth':
      return [monthRange(month)[0], today];
    case 'lastMonth':
      return monthRange(shiftMonth(month, -1));
    case 'thisYear':
      return [`${fy}-04-01`, today];
    case 'lastYear':
      return [`${fy - 1}-04-01`, `${fy}-03-31`];
    case 'custom': {
      const from = custom.from || monthRange(month)[0];
      const to = custom.to && custom.to < today ? custom.to : today;
      return from <= to ? [from, to] : [to, from];
    }
  }
}

/** "1 Apr 2026 – 25 Sep 2026" style label for a range */
export function rangeLabel([from, to]: [string, string]): string {
  const format = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const day = (value: string) => format.format(new Date(`${value}T00:00:00Z`));
  return from === to ? day(from) : `${day(from)} – ${day(to)}`;
}

// ---------- Queries ----------

// Reports sum up data changed on other pages, so each visit fetches them fresh
const FRESH = { staleTime: 0 } as const;

export function useFeeReport(enabled = true) {
  const scope = useQueryScope();
  return useQuery({
    queryKey: [scope, 'reports', 'fees'],
    queryFn: ({ signal }) => api.get<FeeReport>('/reports/fees', { signal }),
    enabled,
    ...FRESH,
  });
}

export function useAttendanceReport(
  range: [string, string],
  batchId: string | null,
  threshold: number,
  enabled = true,
) {
  const scope = useQueryScope();
  return useQuery({
    queryKey: [scope, 'reports', 'attendance', range, batchId, threshold],
    queryFn: ({ signal }) =>
      api.get<AttendanceReport>('/reports/attendance', {
        signal,
        query: {
          startDate: range[0],
          endDate: range[1],
          batchId: batchId ?? undefined,
          threshold,
        },
      }),
    enabled,
    ...FRESH,
    placeholderData: (previous) => previous,
  });
}

export function useProfitLossReport(range: [string, string], enabled = true) {
  const scope = useQueryScope();
  return useQuery({
    queryKey: [scope, 'reports', 'pnl', range],
    queryFn: ({ signal }) =>
      api.get<ProfitLossReport>('/reports/pnl', {
        signal,
        query: { startDate: range[0], endDate: range[1] },
      }),
    enabled,
    ...FRESH,
    placeholderData: (previous) => previous,
  });
}
