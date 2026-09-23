/**
 * Gap-free document numbers (fee receipts, TrueCO invoices).
 *
 * Numbers come from a counter row that is incremented inside the caller's transaction. The
 * row stays locked until that transaction ends, so concurrent issuers queue up, and a rolled
 * back payment returns its number instead of leaving a gap. Must be called with an interactive
 * transaction client.
 */

/** Indian financial year label (April to March), e.g. "2026-27", in the given time zone. */
export function financialYearLabel(date: Date, timeZone = 'Asia/Kolkata'): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: 'numeric' }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const startYear = month >= 4 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/**
 * @param scope  who the numbering belongs to: a coaching id for receipts, "platform" for invoices
 * @param prefix document type, e.g. "RCT" or "INV"
 */
export async function nextDocumentNumber(
  tx: any,
  scope: string,
  prefix: string,
  date: Date = new Date(),
): Promise<string> {
  const series = `${prefix}/${financialYearLabel(date)}`;
  const rows: Array<{ last_value: number }> = await tx.$queryRaw`
    INSERT INTO document_sequences (scope, series, last_value, updated_at)
    VALUES (${scope}, ${series}, 1, now())
    ON CONFLICT (scope, series)
    DO UPDATE SET last_value = document_sequences.last_value + 1, updated_at = now()
    RETURNING last_value
  `;
  return `${series}/${String(rows[0].last_value).padStart(5, '0')}`;
}
