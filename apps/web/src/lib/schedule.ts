export const WEEK_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];

/** "07:30" or "17:05" (from a time input) -> "7:30 AM" / "5:05 PM"; other text is shown as is */
export function formatTime(value: string | null | undefined): string {
  if (!value) return '';
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return value;
  const hours = Number(match[1]);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${match[2]} ${suffix}`;
}

/** Days in week order, whatever order they were saved in */
export function sortDays(days: string[]): string[] {
  const order = (day: string) => {
    const index = WEEK_DAYS.indexOf(day as WeekDay);
    return index === -1 ? WEEK_DAYS.length : index;
  };
  return [...days].sort((a, b) => order(a) - order(b));
}

/**
 * Indian academic session, which starts in April: on 24 Sep 2026 it is "2026-27", on
 * 10 Feb 2027 still "2026-27".
 */
export function currentAcademicYear(now: Date = new Date()): string {
  const [year, month] = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  })
    .format(now)
    .split('-')
    .map(Number) as [number, number];
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}
