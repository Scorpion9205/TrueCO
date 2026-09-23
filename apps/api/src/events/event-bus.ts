import { DomainEvent } from '@trueco/types';
import { EventHandler, IEventBus } from './event-bus.interface.js';
import { HandlerFailure, IEventStore } from './event-store.js';
import { logger } from '../common/logger/logger.service.js';
import { RequestContextService } from '../common/services/request-context.service.js';
import { isUuid } from '../common/validation/is-uuid.js';

interface RegisteredHandler {
  readonly name: string;
  readonly handler: EventHandler<any>;
}

/**
 * In-process event bus with an optional durable store.
 *
 * With a store attached, every event is recorded before its handlers run and each handler's
 * outcome is saved. Failed handlers (and events interrupted by a crash) are retried later by
 * redeliverDue(), which re-runs only the handlers that have not succeeded, so handlers must
 * tolerate running again after a failure.
 *
 * Handlers get stable names from their registration order ("EventName#0", "EventName#1", ...)
 * unless one is given; every process must therefore register subscribers in the same order
 * (see bootstrap/modules.ts).
 */
export class EventBus implements IEventBus {
  private static instance: EventBus;
  private readonly handlers = new Map<string, RegisteredHandler[]>();
  private store?: IEventStore;

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /** Enables durable delivery. Without a store, events are delivered in memory only. */
  public useStore(store: IEventStore): void {
    this.store = store;
  }

  public async publish<T = unknown>(event: DomainEvent<T>): Promise<void> {
    logger.debug(`[EventBus] Publishing event: ${event.eventName}`, {
      eventId: event.eventId,
      eventName: event.eventName,
      coachingId: event.coachingId,
    });

    const handlers = this.handlers.get(event.eventName) ?? [];
    if (handlers.length === 0) {
      logger.debug(`[EventBus] No listeners for event: ${event.eventName}`);
      return;
    }

    let recorded = false;
    if (this.store) {
      try {
        await this.store.record(event as DomainEvent<unknown>);
        recorded = true;
      } catch (err) {
        // Delivery still happens in memory; only the retry safety net is lost for this event
        logger.error(`[EventBus] Could not record ${event.eventName}; delivering without retry`, err, {
          eventId: event.eventId,
        });
      }
    }

    const outcome = await this.dispatch(event, handlers);
    if (recorded) await this.saveOutcome(event.eventId, outcome);
  }

  public async publishBatch<T = unknown>(events: DomainEvent<T>[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  public subscribe<T = unknown>(eventName: string, handler: EventHandler<T>, name?: string): void {
    const list = this.handlers.get(eventName) ?? [];
    const handlerName = name ?? `${eventName}#${list.length}`;
    if (list.some((h) => h.name === handlerName)) {
      throw new Error(`[EventBus] Duplicate handler name "${handlerName}"`);
    }
    list.push({ name: handlerName, handler: handler as EventHandler<any> });
    this.handlers.set(eventName, list);
    logger.info(`[EventBus] Registered subscriber ${handlerName}`);
  }

  public unsubscribe<T = unknown>(eventName: string, handler: EventHandler<T>): void {
    const list = this.handlers.get(eventName) ?? [];
    this.handlers.set(
      eventName,
      list.filter((h) => h.handler !== handler),
    );
  }

  /**
   * Retries events whose handlers failed or were interrupted. Runs in the worker process,
   * which registers the same subscribers as the API. Returns the number of events processed.
   */
  public async redeliverDue(limit = 100): Promise<number> {
    if (!this.store) return 0;
    const due = await this.store.claimDue(limit);

    for (const { event, completedHandlers } of due) {
      const pending = (this.handlers.get(event.eventName) ?? []).filter(
        (h) => !completedHandlers.includes(h.name),
      );
      const outcome = pending.length ? await this.dispatch(event, pending) : { succeeded: [], failures: [] };
      await this.saveOutcome(event.eventId, outcome);
      logger.info(`[EventBus] Redelivered ${event.eventName} (${event.eventId})`, {
        retried: pending.map((h) => h.name),
        failed: outcome.failures.map((f) => f.handler),
      });
    }
    return due.length;
  }

  private async dispatch(
    event: DomainEvent<any>,
    handlers: RegisteredHandler[],
  ): Promise<{ succeeded: string[]; failures: HandlerFailure[] }> {
    // Subscribers act on behalf of the event's coaching, whoever published it (a request,
    // a queue job, a webhook or a cross-tenant scheduler), so their queries are confined to it.
    // Platform-level events use placeholder ids such as 'platform' or 'SYSTEM'; those keep the
    // publisher's context.
    const run = (h: RegisteredHandler) =>
      isUuid(event.coachingId)
        ? RequestContextService.runForTenant(event.coachingId, () => h.handler(event))
        : h.handler(event);

    const succeeded: string[] = [];
    const failures: HandlerFailure[] = [];
    await Promise.all(
      handlers.map(async (h) => {
        try {
          await run(h);
          succeeded.push(h.name);
        } catch (err) {
          failures.push({ handler: h.name, error: (err as Error)?.message ?? String(err) });
          logger.error(`[EventBus] Handler ${h.name} failed`, err, { eventId: event.eventId });
        }
      }),
    );
    return { succeeded, failures };
  }

  private async saveOutcome(
    eventId: string,
    outcome: { succeeded: string[]; failures: HandlerFailure[] },
  ): Promise<void> {
    try {
      await this.store!.markResult(eventId, outcome.succeeded, outcome.failures);
    } catch (err) {
      // The event stays pending and will be picked up by the relay as interrupted
      logger.error('[EventBus] Could not save handler outcome', err, { eventId });
    }
  }
}

export const eventBus = EventBus.getInstance();
