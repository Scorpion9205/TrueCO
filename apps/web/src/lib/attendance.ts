'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './auth/session';
import { useQueryScope } from './queries';

// ---------- Types (apps/api attendance DTOs; dates are ISO strings) ----------

export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  status: AttendanceStatus;
  remarks?: string | null;
}

export interface AttendanceSession {
  id: string;
  batchId: string;
  sessionDate: string;
  totalStudents: number;
  /** Present + late, as the API counts it */
  presentCount: number;
  absentCount: number;
  records: AttendanceRecord[];
}

export interface MarkAttendanceInput {
  batchId: string;
  /** YYYY-MM-DD */
  sessionDate: string;
  records: Array<{ studentId: string; status: AttendanceStatus }>;
}

/** Below this share of classes attended, a student is flagged (a common coaching/board rule) */
export const LOW_ATTENDANCE_PERCENT = 75;

// ---------- Dates (all in India time, as YYYY-MM-DD) ----------

/** The calendar day of an API date in India: "2026-09-24T18:30:00.000Z" -> "2026-09-25" */
export function toDay(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(iso));
}

export function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

/** First and last day of the month containing `day`: "2026-09-25" -> ["2026-09-01", "2026-09-30"] */
export function monthRange(month: string): [string, string] {
  const [year, m] = month.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return [`${year}-${mm}-01`, `${year}-${mm}-${String(last).padStart(2, '0')}`];
}

export function shiftMonth(month: string, amount: number): string {
  const [year, m] = month.split('-').map(Number) as [number, number];
  const date = new Date(Date.UTC(year, m - 1 + amount, 1));
  return date.toISOString().slice(0, 7);
}

// ---------- Summaries ----------

export interface StudentAttendanceSummary {
  studentId: string;
  studentName: string;
  /** Classes the student was marked for */
  marked: number;
  /** Present or late */
  attended: number;
  absent: number;
  percent: number;
}

/** Per-student totals over a set of sessions, lowest attendance first */
export function summariseByStudent(sessions: AttendanceSession[]): StudentAttendanceSummary[] {
  const byStudent = new Map<string, StudentAttendanceSummary>();
  for (const session of sessions) {
    for (const record of session.records) {
      const row = byStudent.get(record.studentId) ?? {
        studentId: record.studentId,
        studentName: record.studentName,
        marked: 0,
        attended: 0,
        absent: 0,
        percent: 0,
      };
      row.marked += 1;
      if (record.status === 'PRESENT' || record.status === 'LATE') row.attended += 1;
      if (record.status === 'ABSENT') row.absent += 1;
      byStudent.set(record.studentId, row);
    }
  }
  return [...byStudent.values()]
    .map((row) => ({
      ...row,
      percent: row.marked ? Math.round((row.attended / row.marked) * 100) : 0,
    }))
    .sort((a, b) => a.percent - b.percent || a.studentName.localeCompare(b.studentName));
}

// ---------- Queries ----------

/** Sessions of a batch between two days (inclusive), newest first */
export function useAttendanceSessions(batchId: string | null, from: string, to: string) {
  const scope = useQueryScope();
  return useQuery({
    queryKey: [scope, 'attendance', batchId, from, to],
    queryFn: ({ signal }) =>
      api.get<AttendanceSession[]>(`/attendance/batches/${batchId}`, {
        signal,
        query: { startDate: from, endDate: to },
      }),
    enabled: Boolean(batchId),
  });
}

export function useMarkAttendance() {
  const queryClient = useQueryClient();
  const scope = useQueryScope();
  return useMutation({
    mutationFn: (input: MarkAttendanceInput) => api.post<AttendanceSession>('/attendance', input),
    onSuccess: () =>
      Promise.all(
        ['attendance', 'dashboard'].map((key) =>
          queryClient.invalidateQueries({ queryKey: [scope, key] }),
        ),
      ),
  });
}
