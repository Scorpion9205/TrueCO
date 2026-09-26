import { IEventBus } from '../../events/event-bus.interface.js';
import { ATTENDANCE_EVENTS, AttendanceMarkedPayload } from './attendance.events.js';
import { logger } from '../../common/logger/logger.service.js';
import { DomainEvent } from '@vargly/types';

export class AttendanceSubscribers {
  public static register(eventBus: IEventBus): void {
    eventBus.subscribe(ATTENDANCE_EVENTS.ATTENDANCE_MARKED, (event: DomainEvent<AttendanceMarkedPayload>) => {
      logger.info(
        `[AttendanceSubscribers] Attendance marked for batch ${event.payload.batchId}: ${event.payload.records.length} records`,
      );
    });
  }
}
