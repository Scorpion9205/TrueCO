import { IEventBus } from '../../events/event-bus.interface.js';
import { TEACHER_EVENTS, TeacherCreatedPayload } from './teacher.events.js';
import { logger } from '../../common/logger/logger.service.js';
import { DomainEvent } from '@trueco/types';

export class TeacherSubscribers {
  public static register(eventBus: IEventBus): void {
    eventBus.subscribe(TEACHER_EVENTS.TEACHER_CREATED, (event: DomainEvent<TeacherCreatedPayload>) => {
      logger.info(`[TeacherSubscribers] Faculty profile established: ${event.payload.name} (${event.payload.email})`);
    });
  }
}
