'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './auth/session';
import { useQueryScope } from './queries';

// ---------- Types (apps/api students, parents, batches, teachers DTOs; dates are ISO strings) ----

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export interface Student {
  id: string;
  rollNumber?: string | null;
  firstName: string;
  lastName: string;
  gender?: Gender | null;
  dob?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  joiningDate: string;
  isActive: boolean;
  createdAt: string;
  /** Only on the single-student response */
  parents?: StudentParent[];
  /** Current batches; only on the single-student response */
  batches?: Array<{ id: string; name: string; subject?: string | null }>;
}

export interface StudentParent {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  relation: string;
  isPrimary: boolean;
}

/** POST /students body; empty optional fields must be left out, not sent as "" */
export interface StudentInput {
  firstName: string;
  lastName: string;
  rollNumber?: string;
  gender?: Gender;
  dob?: string;
  phone?: string;
  email?: string;
  address?: string;
  joiningDate?: string;
}

/** PUT /students/:id body: an omitted field is unchanged, null clears an optional detail */
export type StudentUpdate = {
  [K in keyof Omit<StudentInput, 'joiningDate'>]?: StudentInput[K] | null;
} & { isActive?: boolean };

/** PUT /batches/:id body: an omitted field is unchanged, null clears subject or times */
export interface BatchUpdate {
  name?: string;
  subject?: string | null;
  academicYear?: string;
  startTime?: string | null;
  endTime?: string | null;
  daysOfWeek?: string[];
  isActive?: boolean;
}

export interface ParentInput {
  name: string;
  phone: string;
  relation: string;
  email?: string;
  studentId: string;
  isPrimary?: boolean;
}

export interface Batch {
  id: string;
  name: string;
  subject?: string | null;
  academicYear: string;
  startTime?: string | null;
  endTime?: string | null;
  daysOfWeek: string[];
  isActive: boolean;
  activeStudentCount?: number;
  teachers?: Array<{ teacherId: string; teacherName: string; isPrimary: boolean }>;
  createdAt: string;
}

export interface BatchInput {
  name: string;
  subject?: string;
  academicYear: string;
  startTime?: string;
  endTime?: string;
  daysOfWeek: string[];
  teacherIds?: string[];
}

export interface Teacher {
  id: string;
  name: string;
  phone: string;
  email: string;
  specialization?: string | null;
  isActive: boolean;
}

export const STUDENTS_PAGE_SIZE = 25;

export type StudentStatus = 'active' | 'inactive' | 'all';

export function fullName(student: Pick<Student, 'firstName' | 'lastName'>): string {
  return `${student.firstName} ${student.lastName}`.trim();
}

/** Drops empty strings so optional fields are omitted (the API rejects "" for dates and emails) */
export function compact<T extends object>(values: T): T {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== '' && value !== undefined),
  ) as T;
}

// ---------- Queries ----------

export function useStudents(params: { search: string; status: StudentStatus; page: number }) {
  const scope = useQueryScope();
  return useQuery({
    queryKey: [scope, 'students', 'list', params],
    queryFn: ({ signal }) =>
      api.getPage<Student>('/students', {
        signal,
        query: {
          search: params.search,
          isActive: params.status === 'all' ? undefined : params.status === 'active',
          page: params.page,
          limit: STUDENTS_PAGE_SIZE,
        },
      }),
    // Keep the current page on screen while the next one loads, instead of flashing a skeleton
    placeholderData: keepPreviousData,
  });
}

export function useStudent(id: string) {
  const scope = useQueryScope();
  return useQuery({
    queryKey: [scope, 'students', 'detail', id],
    queryFn: ({ signal }) => api.get<Student>(`/students/${id}`, { signal }),
  });
}

export function useBatches() {
  const scope = useQueryScope();
  return useQuery({
    queryKey: [scope, 'batches', 'list'],
    queryFn: ({ signal }) => api.get<Batch[]>('/batches', { signal }),
  });
}

export function useBatch(id: string) {
  const scope = useQueryScope();
  return useQuery({
    queryKey: [scope, 'batches', 'detail', id],
    queryFn: ({ signal }) => api.get<Batch>(`/batches/${id}`, { signal }),
  });
}

export function useBatchStudents(id: string) {
  const scope = useQueryScope();
  return useQuery({
    queryKey: [scope, 'batches', 'students', id],
    queryFn: ({ signal }) => api.get<Student[]>(`/batches/${id}/students`, { signal }),
  });
}

export function useTeachers(enabled = true) {
  const scope = useQueryScope();
  return useQuery({
    queryKey: [scope, 'teachers', 'list'],
    queryFn: ({ signal }) => api.get<Teacher[]>('/teachers', { signal }),
    enabled,
    staleTime: 5 * 60_000,
  });
}

// ---------- Mutations ----------

/** Refreshes everything a change to students or batches can affect, including dashboard counts */
function useInvalidateAcademics() {
  const queryClient = useQueryClient();
  const scope = useQueryScope();
  return () =>
    Promise.all(
      ['students', 'batches', 'dashboard'].map((key) =>
        queryClient.invalidateQueries({ queryKey: [scope, key] }),
      ),
    );
}

export function useCreateStudent() {
  const invalidate = useInvalidateAcademics();
  return useMutation({
    mutationFn: (input: StudentInput) => api.post<Student>('/students', compact(input)),
    onSuccess: invalidate,
  });
}

export function useUpdateStudent(id: string) {
  const invalidate = useInvalidateAcademics();
  return useMutation({
    mutationFn: (input: StudentUpdate) => api.put<Student>(`/students/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteStudent() {
  const invalidate = useInvalidateAcademics();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/students/${id}`),
    onSuccess: invalidate,
  });
}

export function useAddParent() {
  const invalidate = useInvalidateAcademics();
  return useMutation({
    mutationFn: (input: ParentInput) => api.post('/parents', compact(input)),
    onSuccess: invalidate,
  });
}

export function useCreateBatch() {
  const invalidate = useInvalidateAcademics();
  return useMutation({
    mutationFn: (input: BatchInput) => api.post<Batch>('/batches', compact(input)),
    onSuccess: invalidate,
  });
}

export function useUpdateBatch(id: string) {
  const invalidate = useInvalidateAcademics();
  return useMutation({
    mutationFn: (input: BatchUpdate) => api.put<Batch>(`/batches/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteBatch() {
  const invalidate = useInvalidateAcademics();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/batches/${id}`),
    onSuccess: invalidate,
  });
}

/**
 * The changes to send for an edit form: fields that differ from the saved record, with a
 * now-empty optional field sent as null so the API clears it. Unchanged fields are left out.
 */
export function changedFields<T extends object>(
  saved: Record<string, unknown>,
  edited: T,
): Partial<{ [K in keyof T]: T[K] | null }> {
  const changes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(edited)) {
    const before = saved[key] ?? '';
    const after = value ?? '';
    if (Array.isArray(after)) {
      if (JSON.stringify(after) !== JSON.stringify(before ?? [])) changes[key] = after;
    } else if (after !== before) {
      changes[key] = after === '' ? null : after;
    }
  }
  return changes as Partial<{ [K in keyof T]: T[K] | null }>;
}

export function useEnrolStudent() {
  const invalidate = useInvalidateAcademics();
  return useMutation({
    mutationFn: ({ batchId, studentId }: { batchId: string; studentId: string }) =>
      api.post(`/batches/${batchId}/students`, { studentId }),
    onSuccess: invalidate,
  });
}

export function useWithdrawStudent() {
  const invalidate = useInvalidateAcademics();
  return useMutation({
    mutationFn: ({ batchId, studentId }: { batchId: string; studentId: string }) =>
      api.delete(`/batches/${batchId}/students/${studentId}`),
    onSuccess: invalidate,
  });
}

export function useAssignTeacher() {
  const invalidate = useInvalidateAcademics();
  return useMutation({
    mutationFn: ({ batchId, teacherId }: { batchId: string; teacherId: string }) =>
      api.post(`/batches/${batchId}/teachers`, { teacherId, isPrimary: true }),
    onSuccess: invalidate,
  });
}
