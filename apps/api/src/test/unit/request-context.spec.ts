import { describe, it, expect } from 'vitest';
import { RequestContextService } from '../../common/services/request-context.service.js';
import { RoleType } from '@vargly/types';

describe('RequestContextService (Phase 0 Foundation)', () => {
  it('should isolate context across different asynchronous execution paths', async () => {
    const runTask1 = () =>
      new Promise<string>((resolve) => {
        RequestContextService.run(
          {
            coachingId: 'coaching-alpha',
            traceId: 'trace-1',
            roles: [RoleType.OWNER],
            permissions: ['attendance:mark'],
            features: [],
          },
          () => {
            setTimeout(() => {
              resolve(RequestContextService.getRequiredCoachingId());
            }, 10);
          },
        );
      });

    const runTask2 = () =>
      new Promise<string>((resolve) => {
        RequestContextService.run(
          {
            coachingId: 'coaching-beta',
            traceId: 'trace-2',
            roles: [RoleType.TEACHER],
            permissions: ['attendance:read'],
            features: [],
          },
          () => {
            setTimeout(() => {
              resolve(RequestContextService.getRequiredCoachingId());
            }, 5);
          },
        );
      });

    const [result1, result2] = await Promise.all([runTask1(), runTask2()]);

    expect(result1).toBe('coaching-alpha');
    expect(result2).toBe('coaching-beta');
  });

  it('should throw an error when required coachingId is missing', () => {
    expect(() => RequestContextService.getRequiredCoachingId()).toThrow(
      'Tenant context missing: coachingId is required for this operation',
    );
  });
});
