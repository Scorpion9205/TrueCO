/**
 * Report ranges. A plain day (YYYY-MM-DD) means that whole day in India: timestamps (payments)
 * run from 00:00 IST on the first day to before 00:00 IST after the last, and date-only columns
 * (attendance sessions, expenses) compare against the days themselves. A full ISO time is used
 * exactly as given.
 */
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export interface ReportRange {
  readonly startDate?: string;
  readonly endDate?: string;
}

function nextDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Prisma filter for a timestamp column, or undefined when the range is open on both ends */
export function timestampRange(range: ReportRange): { gte?: Date; lt?: Date; lte?: Date } | undefined {
  const filter: { gte?: Date; lt?: Date; lte?: Date } = {};
  if (range.startDate) {
    filter.gte = new Date(DAY.test(range.startDate) ? `${range.startDate}T00:00:00+05:30` : range.startDate);
  }
  if (range.endDate) {
    if (DAY.test(range.endDate)) filter.lt = new Date(`${nextDay(range.endDate)}T00:00:00+05:30`);
    else filter.lte = new Date(range.endDate);
  }
  return Object.keys(filter).length ? filter : undefined;
}

/** Prisma filter for a date-only column (stored as midnight UTC of the day) */
export function dateRange(range: ReportRange): { gte?: Date; lte?: Date } | undefined {
  const asDay = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00Z`);
  const filter: { gte?: Date; lte?: Date } = {};
  if (range.startDate) filter.gte = asDay(range.startDate);
  if (range.endDate) filter.lte = asDay(range.endDate);
  return Object.keys(filter).length ? filter : undefined;
}

/** Today in India as YYYY-MM-DD */
export function todayInIndia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
}

/** Whole days from one YYYY-MM-DD to another */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}
