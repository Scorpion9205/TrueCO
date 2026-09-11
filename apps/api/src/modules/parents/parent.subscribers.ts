import { IEventBus } from '../../events/event-bus.interface.js';
import { PARENT_EVENTS, ParentCreatedPayload, StudentParentLinkedPayload } from './parent.events.js';
import { logger } from '../../common/logger/logger.service.js';
import { DomainEvent } from '@trueco/types';

export class ParentSubscribers {
  public static register(eventBus: IEventBus): void {
    eventBus.subscribe(PARENT_EVENTS.PARENT_CREATED, (event: DomainEvent<ParentCreatedPayload>) => {
      logger.info(`[ParentSubscribers] Parent registered: ${event.payload.name} (${event.payload.phone})`);
    });

    eventBus.subscribe(PARENT_EVENTS.STUDENT_PARENT_LINKED, (event: DomainEvent<StudentParentLinkedPayload>) => {
      logger.info(`[ParentSubscribers] Linked student ${event.payload.studentId} to parent ${event.payload.parentId}`);
    });
  }
}
