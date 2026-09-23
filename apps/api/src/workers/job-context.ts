import { Job } from 'bullmq';
import { RequestContextService } from '../common/services/request-context.service.js';

/**
 * Queue jobs run outside any HTTP request, so the database layer has no tenant for them.
 * Tenant jobs must carry their coachingId; a job without one fails instead of running
 * with cross-tenant access.
 */
export function runJobForTenant<T>(job: Job<{ coachingId?: string }>, process: () => Promise<T>): Promise<T> {
  const coachingId = job.data?.coachingId;
  if (!coachingId) {
    throw new Error(`Job ${job.queueName}/${job.id} has no coachingId; tenant jobs must include one`);
  }
  return RequestContextService.runForTenant(coachingId, process);
}

/** For jobs that deliberately span every tenant (schedulers, maintenance). */
export function runJobAsSystem<T>(job: Job, process: () => Promise<T>): Promise<T> {
  return RequestContextService.runAsSystem(`job:${job.queueName}:${job.name}`, process);
}
