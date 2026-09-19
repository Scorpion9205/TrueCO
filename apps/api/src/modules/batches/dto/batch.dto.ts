export interface CreateBatchDto {
  readonly name: string;
  readonly subject?: string;
  readonly academicYear: string;
  readonly startTime?: string;
  readonly endTime?: string;
  readonly daysOfWeek?: string[];
  readonly teacherIds?: string[];
}

export interface EnrollStudentInBatchDto {
  readonly studentId: string;
}

export interface AssignTeacherToBatchDto {
  readonly teacherId: string;
  readonly isPrimary?: boolean;
}

export interface TransferStudentBatchDto {
  readonly studentId: string;
  readonly targetBatchId: string;
  readonly reason?: string;
}

export interface BatchResponseDto {
  readonly id: string;
  readonly coachingId: string;
  readonly name: string;
  readonly subject?: string | null;
  readonly academicYear: string;
  readonly startTime?: string | null;
  readonly endTime?: string | null;
  readonly daysOfWeek: string[];
  readonly isActive: boolean;
  readonly activeStudentCount?: number;
  readonly teachers?: Array<{
    readonly teacherId: string;
    readonly teacherName: string;
    readonly isPrimary: boolean;
  }>;
  readonly createdAt: Date;
}
