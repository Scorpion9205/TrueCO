import { IEventBus } from '../../events/event-bus.interface.js';
import { REPORT_EVENTS, ReportGeneratedPayload } from './report.events.js';
import { DomainEvent } from '@vargly/types';
import { logger } from '../../common/logger/logger.service.js';

export class ReportSubscribers {
  public static register(eventBus: IEventBus): void {
    eventBus.subscribe(REPORT_EVENTS.REPORT_GENERATED, (event: DomainEvent<ReportGeneratedPayload>) => {
      logger.info(
        `[ReportSubscribers] Report "${event.payload.reportType}" generated for coaching ${event.payload.coachingId} in format "${event.payload.format}"`,
      );
    });
  }
}
