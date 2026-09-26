import { IEventBus } from '../../events/event-bus.interface.js';
import {
  HOMEWORK_EVENTS,
  HomeworkCreatedPayload,
  HomeworkUpdatedPayload,
} from './homework.events.js';
import { logger } from '../../common/logger/logger.service.js';
import { DomainEvent } from '@vargly/types';

export class HomeworkSubscribers {
  public static register(eventBus: IEventBus): void {
    eventBus.subscribe(
      HOMEWORK_EVENTS.HOMEWORK_CREATED,
      (event: DomainEvent<HomeworkCreatedPayload>) => {
        logger.info(
          `[HomeworkSubscribers] Homework created: ${event.payload.title} (ID: ${event.payload.homeworkId}) for batch ${event.payload.batchId}`,
        );
      },
    );

    eventBus.subscribe(
      HOMEWORK_EVENTS.HOMEWORK_UPDATED,
      (event: DomainEvent<HomeworkUpdatedPayload>) => {
        logger.info(
          `[HomeworkSubscribers] Homework updated: ${event.payload.title} (ID: ${event.payload.homeworkId}) for batch ${event.payload.batchId}`,
        );
      },
    );
  }
}
