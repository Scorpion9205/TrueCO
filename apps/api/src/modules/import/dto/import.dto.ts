export type ImportEntityType = 'STUDENTS' | 'BATCHES';

export interface ImportRowError {
  readonly rowNumber: number;
  readonly field?: string;
  readonly message: string;
}

export interface BulkImportDto {
  readonly entityType: ImportEntityType;
  readonly rows: Record<string, any>[];
  readonly dryRun?: boolean;
}

export interface ImportResultDto {
  readonly entityType: ImportEntityType;
  readonly totalRows: number;
  readonly successCount: number;
  readonly errorCount: number;
  readonly errors: ImportRowError[];
  readonly dryRun: boolean;
  readonly importedIds: string[];
}
