import { describe, it, expect } from 'vitest';
import type { Job } from 'bullmq';
import { DomainEvent } from '@vargly/types';
import { RequestContextService } from '../../common/services/request-context.service.js';
import { EventBus } from '../../events/event-bus.js';
import { runJobForTenant, runJobAsSystem } from '../../workers/job-context.js';

const TENANT = '3f2c1a9e-6b4d-4e8a-9c1f-2a7b5d8e0f13';

function event(coachingId: string): DomainEvent<{ n: number }> {
  return {
    eventId: 'evt',
    eventName: 'Probe',
    coachingId,
    occurredAt: new Date(),
    payload: { n: 1 },
    metadata: { correlationId: 'corr' },
  };
}

describe('RequestContextService tenant helpers', () => {
  it('runForTenant sets the tenant and keeps the trace', () => {
    RequestContextService.run({ traceId: 'trace-1', roles: [], permissions: [], features: [] }, () => {
      RequestContextService.runForTenant(TENANT, () => {
        expect(RequestContextService.getCoachingId()).toBe(TENANT);
        expect(RequestContextService.getTraceId()).toBe('trace-1');
        expect(RequestContextService.isSystemContext()).toBe(false);
      });
    });
  });

  it('runAsSystem clears the tenant and marks the context', () => {
    RequestContextService.runForTenant(TENANT, () => {
      RequestContextService.runAsSystem('probe', () => {
        expect(RequestContextService.getCoachingId()).toBeUndefined();
        expect(RequestContextService.isSystemContext()).toBe(true);
        expect(RequestContextService.getSystemReason()).toBe('probe');
      });
    });
  });

  it('starts lazy thenables inside the context (Prisma queries execute on first then)', async () => {
    let seenTenant: string | undefined;
    const lazyQuery = {
      then(resolve: (v: string) => void) {
        seenTenant = RequestContextService.getCoachingId();
        resolve('ok');
      },
    };

    const result = await RequestContextService.runForTenant(TENANT, () => lazyQuery as unknown as Promise<string>);
    expect(result).toBe('ok');
    expect(seenTenant).toBe(TENANT);
  });
});

describe('EventBus tenant context', () => {
  it("runs subscribers in the event's coaching even when published from a system context", async () => {
    const bus = new EventBus();
    let seen: string | undefined;
    bus.subscribe('Probe', async () => {
      seen = RequestContextService.getCoachingId();
    });

    await RequestContextService.runAsSystem('scheduler', () => bus.publish(event(TENANT)));
    expect(seen).toBe(TENANT);
  });

  it('keeps the publisher context for platform events with placeholder ids', async () => {
    const bus = new EventBus();
    let system = false;
    bus.subscribe('Probe', async () => {
      system = RequestContextService.isSystemContext();
    });

    await RequestContextService.runAsSystem('platform', () => bus.publish(event('platform')));
    expect(system).toBe(true);
  });
});

describe('queue job context', () => {
  const job = (data: Record<string, unknown>) => ({ id: '1', name: 'j', queueName: 'q', data }) as unknown as Job<any>;

  it('runs tenant jobs inside their coaching', async () => {
    const coachingId = await runJobForTenant(job({ coachingId: TENANT }), async () => RequestContextService.getCoachingId());
    expect(coachingId).toBe(TENANT);
  });

  it('fails tenant jobs that carry no coachingId instead of running unscoped', () => {
    expect(() => runJobForTenant(job({}), async () => 'ran')).toThrow(/no coachingId/);
  });

  it('runs system jobs with an explicit system context', async () => {
    expect(await runJobAsSystem(job({}), async () => RequestContextService.isSystemContext())).toBe(true);
  });
});
