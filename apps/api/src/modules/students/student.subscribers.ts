import { IEventBus } from '../../events/event-bus.interface.js';
import { STUDENT_EVENTS, StudentCreatedPayload } from './student.events.js';
import { logger } from '../../common/logger/logger.service.js';
import { DomainEvent } from '@trueco/types';

export class StudentSubscribers {
  public static register(eventBus: IEventBus): void {
    eventBus.subscribe(STUDENT_EVENTS.STUDENT_CREATED, (event: DomainEvent<StudentCreatedPayload>) => {
      logger.info(`[StudentSubscribers] Student created: ${event.payload.firstName} ${event.payload.lastName} (${event.payload.studentId})`, {
        coachingId: event.payload.coachingId,
      });
    });
  }
}
