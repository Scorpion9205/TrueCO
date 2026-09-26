import { IEventBus } from '../../events/event-bus.interface.js';
import { BATCH_EVENTS, BatchCreatedPayload, StudentEnrolledInBatchPayload } from './batch.events.js';
import { logger } from '../../common/logger/logger.service.js';
import { DomainEvent } from '@vargly/types';

export class BatchSubscribers {
  public static register(eventBus: IEventBus): void {
    eventBus.subscribe(BATCH_EVENTS.BATCH_CREATED, (event: DomainEvent<BatchCreatedPayload>) => {
      logger.info(`[BatchSubscribers] Batch created: ${event.payload.name} (${event.payload.batchId})`);
    });

    eventBus.subscribe(BATCH_EVENTS.STUDENT_ENROLLED_IN_BATCH, (event: DomainEvent<StudentEnrolledInBatchPayload>) => {
      logger.info(`[BatchSubscribers] Student ${event.payload.studentId} enrolled in batch ${event.payload.batchId}`);
    });
  }
}
