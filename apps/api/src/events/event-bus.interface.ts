import { DomainEvent } from '@trueco/types';

export type EventHandler<T = unknown> = (event: DomainEvent<T>) => Promise<void> | void;

export interface IEventBus {
  publish<T = unknown>(event: DomainEvent<T>): Promise<void>;
  publishBatch<T = unknown>(events: DomainEvent<T>[]): Promise<void>;
  subscribe<T = unknown>(eventName: string, handler: EventHandler<T>): void;
  unsubscribe<T = unknown>(eventName: string, handler: EventHandler<T>): void;
}
