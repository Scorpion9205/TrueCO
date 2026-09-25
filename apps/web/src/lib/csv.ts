export interface CsvColumn<T> {
  label: string;
  value: (row: T) => string | number | null | undefined;
}

// Excel and Sheets run a cell starting with these as a formula; typed names must not
const FORMULA = /^[=+\-@\t\r]/;

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  const text = typeof value === 'string' && FORMULA.test(value) ? `'${value}` : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((column) => cell(column.label)).join(',')];
  for (const row of rows) lines.push(columns.map((column) => cell(column.value(row))).join(','));
  return lines.join('\r\n');
}

/** Saves a CSV file; the byte-order mark makes Excel read ₹ and Indian names correctly */
export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
