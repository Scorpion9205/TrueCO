'use client';

import { useQuery } from '@tanstack/react-query';
import type { TeacherDashboard } from './api-types';
import { type Batch, useBatches } from './academics';
import { api } from './auth/session';
import { can } from './auth/permissions';
import { useSession } from './auth/use-session';
import { useQueryScope } from './queries';

/** A batch the user teaches or runs (enough to pick it from a list) */
export type TeachingBatch = Pick<Batch, 'id' | 'name' | 'subject'>;

/**
 * Batches the user can take attendance, tests and homework for. The API only lets teachers act
 * on their own batches, so teachers get the batches assigned to them (from their dashboard)
 * instead of every batch; owners get all active batches.
 */
export function useTeachingBatches() {
  const user = useSession()?.user;
  const scope = useQueryScope();
  const isTeacherOnly = can(user, 'dashboard:teacher') && !can(user, 'dashboard:owner');

  const all = useBatches(!isTeacherOnly);
  const mine = useQuery({
    queryKey: [scope, 'dashboard', 'teacher'],
    queryFn: ({ signal }) => api.get<TeacherDashboard>('/dashboard/teacher', { signal }),
    enabled: isTeacherOnly,
  });

  if (isTeacherOnly) {
    return {
      ...mine,
      data: mine.data?.assignedBatches.map((batch): TeachingBatch => ({
        id: batch.batchId,
        name: batch.batchName,
        subject: batch.subject,
      })),
    };
  }
  return { ...all, data: all.data?.filter((batch) => batch.isActive) };
}
