import { IEventBus } from '../../events/event-bus.interface.js';
import { DASHBOARD_EVENTS, DashboardViewedPayload } from './dashboard.events.js';
import { DomainEvent } from '@vargly/types';
import { logger } from '../../common/logger/logger.service.js';

export class DashboardSubscribers {
  public static register(eventBus: IEventBus): void {
    eventBus.subscribe(
      DASHBOARD_EVENTS.DASHBOARD_VIEWED,
      (event: DomainEvent<DashboardViewedPayload>) => {
        logger.debug(
          `[DashboardSubscribers] ${event.payload.portal} dashboard viewed for coaching ${event.payload.coachingId}`,
        );
      },
    );
  }
}
