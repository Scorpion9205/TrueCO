export interface RecordAuditLogDto {
  readonly userId?: string;
  readonly action: string; // e.g. "STUDENT_CREATED", "ATTENDANCE_MARKED"
  readonly entityName: string;
  readonly entityId: string;
  readonly beforeState?: Record<string, unknown>;
  readonly afterState?: Record<string, unknown>;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

export interface AuditLogResponseDto {
  readonly id: string;
  readonly coachingId: string;
  readonly userId?: string | null;
  readonly action: string;
  readonly entityName: string;
  readonly entityId: string;
  readonly beforeState?: Record<string, unknown> | null;
  readonly afterState?: Record<string, unknown> | null;
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
  readonly createdAt: Date;
}

export interface AuditLogFilterDto {
  readonly entityName?: string;
  readonly action?: string;
  readonly userId?: string;
  readonly limit?: number;
  readonly offset?: number;
}
