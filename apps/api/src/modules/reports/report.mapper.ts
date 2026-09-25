export class ReportMapper {
  public static toCsv(rows: Record<string, any>[], headers: { key: string; label: string }[]): string {
    if (!rows || rows.length === 0) {
      return headers.map((h) => `"${h.label}"`).join(',') + '\n';
    }

    const headerLine = headers.map((h) => `"${h.label}"`).join(',');
    const dataLines = rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h.key];
          if (val === null || val === undefined) return '""';
          if (val instanceof Date) return `"${val.toISOString().slice(0, 10)}"`;
          // A cell starting with = + - @ (or a tab/CR) runs as a formula in Excel and Sheets;
          // names typed by users must not be able to do that
          const text = String(val);
          const safe = typeof val === 'string' && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
          const str = safe.replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(','),
    );

    return [headerLine, ...dataLines].join('\n');
  }
}
