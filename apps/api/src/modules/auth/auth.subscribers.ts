import { IEventBus } from '../../events/event-bus.interface.js';
import { AUTH_EVENTS, UserLoggedInPayload, UserLoggedOutPayload } from './auth.events.js';
import { logger } from '../../common/logger/logger.service.js';
import { DomainEvent } from '@vargly/types';
import { COACHING_EVENTS, CoachingCreatedPayload } from '../coaching/coaching.events.js';
import type { AuthService } from './auth.service.js';

export class AuthSubscribers {
  public static register(eventBus: IEventBus, authService?: AuthService): void {
    eventBus.subscribe(AUTH_EVENTS.USER_LOGGED_IN, (event: DomainEvent<UserLoggedInPayload>) => {
      logger.info(`[Audit] User login recorded for: ${event.payload.email}`, {
        userId: event.payload.userId,
        coachingId: event.payload.coachingId,
        ip: event.payload.ipAddress,
      });
    });

    // New institutes start with an unverified owner email; issue its single-use verification link
    if (authService) {
      eventBus.subscribe(
        COACHING_EVENTS.COACHING_CREATED,
        async (event: DomainEvent<CoachingCreatedPayload>) => {
          await authService.issueEmailVerification(event.payload.ownerId, event.payload.ownerEmail);
        },
      );
    }

    eventBus.subscribe(AUTH_EVENTS.USER_LOGGED_OUT, (event: DomainEvent<UserLoggedOutPayload>) => {
      logger.info(`[Audit] User logout recorded for: ${event.payload.userId}`, {
        reason: event.payload.reason,
      });
    });
  }
}
