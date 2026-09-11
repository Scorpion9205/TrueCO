import { AttendanceStatus } from '@trueco/types';

export interface StudentAttendanceEntryDto {
  readonly studentId: string;
  readonly status: AttendanceStatus;
  readonly remarks?: string;
}

export interface MarkAttendanceDto {
  readonly batchId: string;
  readonly sessionDate: string; // YYYY-MM-DD
  readonly slot?: string;
  readonly remarks?: string;
  readonly records: StudentAttendanceEntryDto[];
}

export interface AttendanceRecordDto {
  readonly id: string;
  readonly studentId: string;
  readonly studentName: string;
  readonly status: AttendanceStatus;
  readonly remarks?: string | null;
}

export interface AttendanceSessionResponseDto {
  readonly id: string;
  readonly coachingId: string;
  readonly batchId: string;
  readonly sessionDate: Date;
  readonly slot?: string | null;
  readonly remarks?: string | null;
  readonly totalStudents: number;
  readonly presentCount: number;
  readonly absentCount: number;
  readonly records: AttendanceRecordDto[];
  readonly createdAt: Date;
}
