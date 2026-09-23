import { DomainEvent } from '@trueco/types';

export type EventHandler<T = unknown> = (event: DomainEvent<T>) => Promise<void> | void;

export interface IEventBus {
  publish<T = unknown>(event: DomainEvent<T>): Promise<void>;
  publishBatch<T = unknown>(events: DomainEvent<T>[]): Promise<void>;
  /** `name` identifies the handler for retries; defaults to "<eventName>#<registration index>". */
  subscribe<T = unknown>(eventName: string, handler: EventHandler<T>, name?: string): void;
  unsubscribe<T = unknown>(eventName: string, handler: EventHandler<T>): void;
}
