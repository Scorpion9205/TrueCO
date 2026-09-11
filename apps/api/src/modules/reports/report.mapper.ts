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
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(','),
    );

    return [headerLine, ...dataLines].join('\n');
  }
}
