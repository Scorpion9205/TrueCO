import { describe, it, expect, vi } from 'vitest';
import { DomainEvent } from '@vargly/types';
import { EventBus } from '../../events/event-bus.js';
import {
  decodeFromStorage,
  encodeForStorage,
  HandlerFailure,
  IEventStore,
  StoredEvent,
} from '../../events/event-store.js';

/** Store that mimics domain_events: records, outcomes and due-event leasing. */
class InMemoryEventStore implements IEventStore {
  public rows = new Map<string, { event: DomainEvent<unknown>; completed: string[]; attempts: number; status: string }>();

  public async record(event: DomainEvent<unknown>): Promise<void> {
    if (!this.rows.has(event.eventId)) {
      this.rows.set(event.eventId, {
        event: decodeFromStorage(JSON.parse(JSON.stringify(encodeForStorage(event)))) as DomainEvent<unknown>,
        completed: [],
        attempts: 0,
        status: 'PENDING',
      });
    }
  }

  public async markResult(eventId: string, succeeded: string[], failures: HandlerFailure[]): Promise<void> {
    const row = this.rows.get(eventId)!;
    row.completed = [...new Set([...row.completed, ...succeeded])];
    row.attempts++;
    row.status = failures.length ? 'FAILED' : 'DISPATCHED';
  }

  public async claimDue(): Promise<StoredEvent[]> {
    return [...this.rows.values()]
      .filter((r) => r.status === 'FAILED' || r.status === 'PENDING')
      .map((r) => ({ event: r.event, completedHandlers: r.completed, attempts: r.attempts }));
  }
}

const event = (id = 'evt-1'): DomainEvent<{ dueDate: Date; n: number }> => ({
  eventId: id,
  eventName: 'FeePaid',
  coachingId: 'platform',
  occurredAt: new Date('2026-09-24T10:00:00Z'),
  payload: { dueDate: new Date('2026-10-01T00:00:00Z'), n: 1 },
  metadata: { correlationId: 'corr' },
});

describe('Durable event bus', () => {
  it('records the event and marks it dispatched when every handler succeeds', async () => {
    const store = new InMemoryEventStore();
    const bus = new EventBus();
    bus.useStore(store);
    bus.subscribe('FeePaid', vi.fn());
    bus.subscribe('FeePaid', vi.fn());

    await bus.publish(event());
    expect(store.rows.get('evt-1')).toMatchObject({ status: 'DISPATCHED', completed: ['FeePaid#0', 'FeePaid#1'] });
  });

  it('retries only the failed handler, never re-running the ones that succeeded', async () => {
    const store = new InMemoryEventStore();
    const bus = new EventBus();
    bus.useStore(store);
    const sendWhatsApp = vi.fn();
    const writeTimeline = vi.fn().mockRejectedValueOnce(new Error('db blip')).mockResolvedValue(undefined);
    bus.subscribe('FeePaid', sendWhatsApp);
    bus.subscribe('FeePaid', writeTimeline);

    await bus.publish(event());
    expect(store.rows.get('evt-1')?.status).toBe('FAILED');

    expect(await bus.redeliverDue()).toBe(1);
    expect(sendWhatsApp).toHaveBeenCalledTimes(1);
    expect(writeTimeline).toHaveBeenCalledTimes(2);
    expect(store.rows.get('evt-1')?.status).toBe('DISPATCHED');
  });

  it('recovers an event whose process died before its handlers finished', async () => {
    const store = new InMemoryEventStore();
    // Recorded by a process that crashed before dispatching
    await store.record(event('evt-crashed'));

    // A fresh process (the worker) with the same subscribers picks it up
    const bus = new EventBus();
    bus.useStore(store);
    const handler = vi.fn();
    bus.subscribe('FeePaid', handler);

    await bus.redeliverDue();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(store.rows.get('evt-crashed')?.status).toBe('DISPATCHED');
  });

  it('gives redelivered handlers real Date objects', async () => {
    const store = new InMemoryEventStore();
    const bus = new EventBus();
    bus.useStore(store);
    let received: any;
    bus.subscribe('FeePaid', vi.fn().mockRejectedValueOnce(new Error('x')).mockImplementation((e: any) => (received = e)));

    await bus.publish(event());
    await bus.redeliverDue();
    expect(received.payload.dueDate).toBeInstanceOf(Date);
    expect(received.payload.dueDate.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('still delivers in memory when the store is unavailable', async () => {
    const bus = new EventBus();
    bus.useStore({
      record: vi.fn().mockRejectedValue(new Error('db down')),
      markResult: vi.fn(),
      claimDue: vi.fn(),
    });
    const handler = vi.fn();
    bus.subscribe('FeePaid', handler);

    await bus.publish(event());
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('refuses two handlers with the same explicit name', () => {
    const bus = new EventBus();
    bus.subscribe('FeePaid', vi.fn(), 'notify-parent');
    expect(() => bus.subscribe('FeePaid', vi.fn(), 'notify-parent')).toThrow(/Duplicate handler name/);
  });
});
