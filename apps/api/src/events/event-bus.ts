import { EventEmitter } from 'node:events';
import { DomainEvent } from '@trueco/types';
import { EventHandler, IEventBus } from './event-bus.interface.js';
import { logger } from '../common/logger/logger.service.js';

export class EventBus implements IEventBus {
  private static instance: EventBus;
  private readonly emitter: EventEmitter;

  public constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public async publish<T = unknown>(event: DomainEvent<T>): Promise<void> {
    logger.debug(`[EventBus] Publishing event: ${event.eventName}`, {
      eventId: event.eventId,
      eventName: event.eventName,
      coachingId: event.coachingId,
    });

    const listeners = this.emitter.listeners(event.eventName) as EventHandler<T>[];
    if (listeners.length === 0) {
      logger.debug(`[EventBus] No listeners for event: ${event.eventName}`);
      return;
    }

    // Execute all subscribers concurrently without blocking the main write path
    const promises = listeners.map(async (handler) => {
      try {
        await handler(event);
      } catch (err) {
        logger.error(`[EventBus] Error executing subscriber for ${event.eventName}:`, err, {
          eventId: event.eventId,
          eventName: event.eventName,
        });
      }
    });

    await Promise.allSettled(promises);
  }

  public async publishBatch<T = unknown>(events: DomainEvent<T>[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  public subscribe<T = unknown>(eventName: string, handler: EventHandler<T>): void {
    logger.info(`[EventBus] Registered subscriber for: ${eventName}`);
    this.emitter.on(eventName, handler as (...args: unknown[]) => void);
  }

  public unsubscribe<T = unknown>(eventName: string, handler: EventHandler<T>): void {
    this.emitter.off(eventName, handler as (...args: unknown[]) => void);
  }
}

export const eventBus = EventBus.getInstance();
