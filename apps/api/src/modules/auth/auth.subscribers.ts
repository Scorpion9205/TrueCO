import { IEventBus } from '../../events/event-bus.interface.js';
import { AUTH_EVENTS, UserLoggedInPayload, UserLoggedOutPayload } from './auth.events.js';
import { logger } from '../../common/logger/logger.service.js';
import { DomainEvent } from '@trueco/types';

export class AuthSubscribers {
  public static register(eventBus: IEventBus): void {
    eventBus.subscribe(AUTH_EVENTS.USER_LOGGED_IN, (event: DomainEvent<UserLoggedInPayload>) => {
      logger.info(`[Audit] User login recorded for: ${event.payload.email}`, {
        userId: event.payload.userId,
        coachingId: event.payload.coachingId,
        ip: event.payload.ipAddress,
      });
    });

    eventBus.subscribe(AUTH_EVENTS.USER_LOGGED_OUT, (event: DomainEvent<UserLoggedOutPayload>) => {
      logger.info(`[Audit] User logout recorded for: ${event.payload.userId}`, {
        reason: event.payload.reason,
      });
    });
  }
}
