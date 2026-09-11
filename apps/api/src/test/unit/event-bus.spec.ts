import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../events/event-bus.js';
import { DomainEvent } from '@trueco/types';

describe('EventBus (Phase 0 Foundation)', () => {
  it('should dispatch an event to registered subscribers', async () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.subscribe('StudentEnrolled', handler);

    const event: DomainEvent<{ studentId: string }> = {
      eventId: 'evt-1',
      eventName: 'StudentEnrolled',
      coachingId: 'coaching-1',
      occurredAt: new Date(),
      payload: { studentId: 'stu-1' },
      metadata: { correlationId: 'corr-1' },
    };

    await bus.publish(event);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('should continue executing other subscribers if one throws an error', async () => {
    const bus = new EventBus();
    const failingHandler = vi.fn().mockRejectedValue(new Error('Subscriber failure'));
    const passingHandler = vi.fn().mockResolvedValue(undefined);

    bus.subscribe('AttendanceMarked', failingHandler);
    bus.subscribe('AttendanceMarked', passingHandler);

    const event: DomainEvent<{ batchId: string }> = {
      eventId: 'evt-2',
      eventName: 'AttendanceMarked',
      coachingId: 'coaching-1',
      occurredAt: new Date(),
      payload: { batchId: 'batch-1' },
      metadata: { correlationId: 'corr-2' },
    };

    await bus.publish(event);

    expect(failingHandler).toHaveBeenCalledTimes(1);
    expect(passingHandler).toHaveBeenCalledTimes(1);
  });
});
