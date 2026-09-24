// Display formatting for India: rupees with lakh/crore grouping, dates as "24 Sept 2026".

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});
const inrWhole = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
const date = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});
const dateTime = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});

/** The API sends money as decimal strings ("1500.50") to avoid float rounding. */
function toNumber(value: number | string): number {
  return typeof value === 'number' ? value : Number(value);
}

/** 150000 -> "₹1,50,000"; paise shown only when present. */
export function formatCurrency(value: number | string): string {
  const n = toNumber(value);
  if (!Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? inrWhole.format(n) : inr.format(n);
}

/** 1500000 -> "15L" style short numbers for KPI cards. */
export function formatCompact(value: number): string {
  return Number.isFinite(value) ? compact.format(value) : '—';
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? '—' : date.format(d);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? '—' : dateTime.format(d);
}
