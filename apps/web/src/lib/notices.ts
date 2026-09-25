'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './auth/session';
import { todayInIndia } from './dates';
import { useQueryScope } from './queries';

// apps/api notice-board DTOs; dates are ISO strings

export const AUDIENCES = ['ALL', 'STUDENTS', 'PARENTS', 'TEACHERS'] as const;
export type Audience = (typeof AUDIENCES)[number];

export interface Notice {
  id: string;
  title: string;
  content: string;
  batchId?: string | null;
  batchName?: string | null;
  targetAudience: Audience;
  isPinned: boolean;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NoticeInput {
  title: string;
  content: string;
  /** null = the whole institute */
  batchId: string | null;
  targetAudience: Audience;
  isPinned: boolean;
  /** ISO time; null = never */
  expiresAt: string | null;
}

export interface NoticeFilter {
  /** Omit for every audience; a specific audience also includes notices for everyone */
  audience?: Audience;
  includeExpired?: boolean;
}

/** A notice shown "until" a day stays up to the end of that day in India */
export function endOfDayInIndia(day: string): string {
  return new Date(`${day}T23:59:59+05:30`).toISOString();
}

/** The India day an expiry falls on, for the date input */
export function expiryDay(expiresAt: string | null | undefined): string {
  return expiresAt ? todayInIndia(new Date(expiresAt)) : '';
}

export function isExpired(notice: Pick<Notice, 'expiresAt'>, now = new Date()): boolean {
  return Boolean(notice.expiresAt && new Date(notice.expiresAt) <= now);
}

export function useNotices(filter: NoticeFilter) {
  const scope = useQueryScope();
  return useQuery({
    queryKey: [scope, 'notices', 'list', filter],
    queryFn: ({ signal }) =>
      api.get<Notice[]>('/notices', {
        signal,
        query: {
          targetAudience: filter.audience,
          includeExpired: filter.includeExpired ? 'true' : undefined,
        },
      }),
  });
}

function useInvalidateNotices() {
  const queryClient = useQueryClient();
  const scope = useQueryScope();
  return () => queryClient.invalidateQueries({ queryKey: [scope, 'notices'] });
}

export function useCreateNotice() {
  const invalidate = useInvalidateNotices();
  return useMutation({
    mutationFn: (input: NoticeInput) => api.post<Notice>('/notices', input),
    onSuccess: invalidate,
  });
}

export function useUpdateNotice(id: string) {
  const invalidate = useInvalidateNotices();
  return useMutation({
    mutationFn: (input: Partial<NoticeInput>) => api.put<Notice>(`/notices/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteNotice() {
  const invalidate = useInvalidateNotices();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/notices/${id}`),
    onSuccess: invalidate,
  });
}
