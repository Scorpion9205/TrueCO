import { IEventBus } from '../../events/event-bus.interface.js';
import { SETTINGS_EVENTS, SettingsUpdatedPayload } from './settings.events.js';
import { DomainEvent } from '@vargly/types';
import { logger } from '../../common/logger/logger.service.js';

export class SettingsSubscribers {
  public static register(eventBus: IEventBus): void {
    eventBus.subscribe(SETTINGS_EVENTS.SETTINGS_UPDATED, (event: DomainEvent<SettingsUpdatedPayload>) => {
      logger.info(
        `[SettingsSubscribers] Settings updated for coaching ${event.payload.coachingId}. Timezone: ${event.payload.config.timezone || 'default'}`,
      );
    });
  }
}
