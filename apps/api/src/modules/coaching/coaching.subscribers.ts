import { IEventBus } from '../../events/event-bus.interface.js';
import { COACHING_EVENTS, CoachingCreatedPayload } from './coaching.events.js';
import { logger } from '../../common/logger/logger.service.js';
import { DomainEvent } from '@vargly/types';

export class CoachingSubscribers {
  public static register(eventBus: IEventBus): void {
    eventBus.subscribe(COACHING_EVENTS.COACHING_CREATED, (event: DomainEvent<CoachingCreatedPayload>) => {
      logger.info(`[Audit] New coaching institute registered: ${event.payload.coachingName} (${event.payload.coachingCode})`, {
        coachingId: event.payload.coachingId,
        ownerEmail: event.payload.ownerEmail,
        trialEndsAt: event.payload.trialEndsAt,
      });
    });
  }
}
