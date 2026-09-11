export interface RecordTimelineEntryDto {
  readonly studentId: string;
  readonly eventType: string; // e.g. "STUDENT_ENROLLED", "ATTENDANCE_MARKED", "TEST_RESULT"
  readonly summary: string;
  readonly referenceId?: string;
  readonly metadata?: Record<string, unknown>;
  readonly occurredAt?: Date;
}

export interface TimelineResponseDto {
  readonly id: string;
  readonly coachingId: string;
  readonly studentId: string;
  readonly eventType: string;
  readonly summary: string;
  readonly referenceId?: string | null;
  readonly metadata?: Record<string, unknown> | null;
  readonly occurredAt: Date;
  readonly createdAt: Date;
}

export interface TimelineFilterDto {
  readonly eventType?: string;
  readonly limit?: number;
  readonly offset?: number;
}
