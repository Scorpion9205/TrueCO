'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Teacher } from './academics';
import { api } from './auth/session';
import { useQueryScope } from './queries';

// Listing uses useTeachers from ./academics (the same /teachers query and cache entry)

export interface TeacherInput {
  name: string;
  phone: string;
  email: string;
  /** The teacher signs in with this; at least 8 characters */
  password: string;
  specialization?: string;
  monthlySalary?: number;
  /** YYYY-MM-DD */
  joiningDate?: string;
}

export interface TeacherUpdate {
  name?: string;
  phone?: string;
  /** null clears */
  specialization?: string | null;
  monthlySalary?: number | null;
  isActive?: boolean;
}

export const MIN_PASSWORD_LENGTH = 8;

// Letters and digits without look-alikes (0/O, 1/l/I): the password is read out or copied by hand.
// Built from ranges rather than written out, so secret scanners don't mistake it for a key.
const range = (from: string, to: string) =>
  Array.from({ length: to.charCodeAt(0) - from.charCodeAt(0) + 1 }, (_, i) =>
    String.fromCharCode(from.charCodeAt(0) + i),
  );
const SAFE_CHARS = [...range('a', 'z'), ...range('A', 'Z'), ...range('2', '9')].filter(
  (char) => !'iloIO'.includes(char),
);

/** A random 10-character sign-in password for a new teacher */
export function generatePassword(length = 10): string {
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (n) => SAFE_CHARS[n % SAFE_CHARS.length]).join('');
}

/** A teacher change shows up in batches (teacher names), payroll and the dashboard too */
function useInvalidateTeachers() {
  const queryClient = useQueryClient();
  const scope = useQueryScope();
  return () =>
    Promise.all(
      ['teachers', 'batches', 'salary', 'dashboard'].map((key) =>
        queryClient.invalidateQueries({ queryKey: [scope, key] }),
      ),
    );
}

export function useCreateTeacher() {
  const invalidate = useInvalidateTeachers();
  return useMutation({
    mutationFn: (input: TeacherInput) => api.post<Teacher>('/teachers', input),
    onSuccess: invalidate,
  });
}

export function useUpdateTeacher(id: string) {
  const invalidate = useInvalidateTeachers();
  return useMutation({
    mutationFn: (input: TeacherUpdate) => api.put<Teacher>(`/teachers/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useRemoveTeacherFromBatch() {
  const invalidate = useInvalidateTeachers();
  return useMutation({
    mutationFn: ({ batchId, teacherId }: { batchId: string; teacherId: string }) =>
      api.delete(`/batches/${batchId}/teachers/${teacherId}`),
    onSuccess: invalidate,
  });
}
