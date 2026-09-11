import { IEventBus } from '../../events/event-bus.interface.js';
import {
  NOTICE_EVENTS,
  NoticeCreatedPayload,
  NoticeDeletedPayload,
  NoticeUpdatedPayload,
} from './notice.events.js';
import { DomainEvent } from '@trueco/types';
import { logger } from '../../common/logger/logger.service.js';

export class NoticeSubscribers {
  public static register(eventBus: IEventBus): void {
    eventBus.subscribe(NOTICE_EVENTS.NOTICE_CREATED, (event: DomainEvent<NoticeCreatedPayload>) => {
      logger.info(
        `[NoticeSubscribers] New notice created: "${event.payload.title}" (Audience: ${event.payload.targetAudience}) in coaching ${event.payload.coachingId}`,
      );
    });

    eventBus.subscribe(NOTICE_EVENTS.NOTICE_UPDATED, (event: DomainEvent<NoticeUpdatedPayload>) => {
      logger.info(
        `[NoticeSubscribers] Notice updated: "${event.payload.title}" (ID: ${event.payload.noticeId})`,
      );
    });

    eventBus.subscribe(NOTICE_EVENTS.NOTICE_DELETED, (event: DomainEvent<NoticeDeletedPayload>) => {
      logger.info(
        `[NoticeSubscribers] Notice deleted: ID ${event.payload.noticeId} from coaching ${event.payload.coachingId}`,
      );
    });
  }
}
