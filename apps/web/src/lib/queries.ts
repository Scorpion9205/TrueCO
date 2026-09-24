'use client';

import { useQuery } from '@tanstack/react-query';
import type { CoachingProfile, OwnerDashboard, TeacherDashboard } from './api-types';
import { api } from './auth/session';
import { useSession } from './auth/use-session';

/**
 * Query keys start with the signed-in user's id, so cached data can never be shown to the next
 * person who signs in on the same device (the cache is also cleared on sign-out).
 */
export function useQueryScope(): string {
  return useSession()?.user.id ?? 'anonymous';
}

export function useCoachingProfile() {
  const scope = useQueryScope();
  return useQuery({
    queryKey: [scope, 'coaching', 'me'],
    queryFn: ({ signal }) => api.get<CoachingProfile>('/coachings/me', { signal }),
    staleTime: 5 * 60_000,
  });
}

export function useOwnerDashboard(enabled = true) {
  const scope = useQueryScope();
  return useQuery({
    queryKey: [scope, 'dashboard', 'owner'],
    queryFn: ({ signal }) => api.get<OwnerDashboard>('/dashboard/owner', { signal }),
    enabled,
  });
}

export function useTeacherDashboard(enabled = true) {
  const scope = useQueryScope();
  return useQuery({
    queryKey: [scope, 'dashboard', 'teacher'],
    queryFn: ({ signal }) => api.get<TeacherDashboard>('/dashboard/teacher', { signal }),
    enabled,
  });
}
