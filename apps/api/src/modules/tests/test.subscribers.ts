import { IEventBus } from '../../events/event-bus.interface.js';
import {
  TEST_EVENTS,
  TestCreatedPayload,
  MarksUploadedPayload,
  TestResultReadyPayload,
} from './test.events.js';
import { logger } from '../../common/logger/logger.service.js';
import { DomainEvent } from '@trueco/types';

export class TestSubscribers {
  public static register(eventBus: IEventBus): void {
    eventBus.subscribe(TEST_EVENTS.TEST_CREATED, (event: DomainEvent<TestCreatedPayload>) => {
      logger.info(
        `[TestSubscribers] Test created: ${event.payload.title} (ID: ${event.payload.testId}) in batch ${event.payload.batchId}`,
      );
    });

    eventBus.subscribe(TEST_EVENTS.MARKS_UPLOADED, (event: DomainEvent<MarksUploadedPayload>) => {
      logger.info(
        `[TestSubscribers] Marks uploaded for test ${event.payload.testId}: ${event.payload.resultsCount} student records`,
      );
    });

    eventBus.subscribe(TEST_EVENTS.TEST_RESULT_READY, (event: DomainEvent<TestResultReadyPayload>) => {
      logger.debug(
        `[TestSubscribers] Result ready for student ${event.payload.studentId} in test ${event.payload.testId}: ${event.payload.marksObtained}/${event.payload.totalMarks} (${event.payload.percentage}%)`,
      );
    });
  }
}
