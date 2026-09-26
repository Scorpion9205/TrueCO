import { IEventBus } from '../../events/event-bus.interface.js';
import { TimelineService } from './timeline.service.js';
import { STUDENT_EVENTS, StudentCreatedPayload } from '../students/student.events.js';
import { ATTENDANCE_EVENTS, AttendanceMarkedPayload } from '../attendance/attendance.events.js';
import { TEST_EVENTS, TestResultReadyPayload } from '../tests/test.events.js';
import { BATCH_EVENTS, StudentEnrolledInBatchPayload, StudentTransferredBatchPayload } from '../batches/batch.events.js';
import { FEE_EVENTS, FeePaidPayload } from '../fees/fee.events.js';
import { DomainEvent } from '@vargly/types';
import { logger } from '../../common/logger/logger.service.js';

export class TimelineSubscribers {
  public static register(eventBus: IEventBus, timelineService: TimelineService): void {
    // 1. Student Enrolled
    eventBus.subscribe(
      STUDENT_EVENTS.STUDENT_CREATED,
      async (event: DomainEvent<StudentCreatedPayload>) => {
        try {
          await timelineService.recordEntry(
            {
              studentId: event.payload.studentId,
              eventType: 'STUDENT_ENROLLED',
              summary: `Student ${event.payload.firstName} ${event.payload.lastName} enrolled in the institute`,
              referenceId: event.payload.studentId,
              metadata: {
                phone: event.payload.phone,
                email: event.payload.email,
              },
            },
            event.payload.coachingId,
            event.metadata?.userId,
            event.metadata?.correlationId,
          );
        } catch (err) {
          logger.error('[TimelineSubscribers] Error recording STUDENT_ENROLLED timeline entry:', err);
        }
      },
    );

    // 2. Attendance Marked
    eventBus.subscribe(
      ATTENDANCE_EVENTS.ATTENDANCE_MARKED,
      async (event: DomainEvent<AttendanceMarkedPayload>) => {
        const { coachingId, sessionId, batchId, sessionDate, records } = event.payload;

        for (const record of records) {
          try {
            await timelineService.recordEntry(
              {
                studentId: record.studentId,
                eventType: 'ATTENDANCE_MARKED',
                summary: `Marked ${record.status} for session on ${new Date(sessionDate).toLocaleDateString('en-IN')}`,
                referenceId: sessionId,
                metadata: {
                  batchId,
                  status: record.status,
                  remarks: record.remarks,
                },
                occurredAt: new Date(sessionDate),
              },
              coachingId,
              event.metadata?.userId,
              event.metadata?.correlationId,
            );
          } catch (err) {
            logger.error('[TimelineSubscribers] Error recording ATTENDANCE_MARKED timeline entry:', err);
          }
        }
      },
    );

    // 3. Test Result Ready
    eventBus.subscribe(
      TEST_EVENTS.TEST_RESULT_READY,
      async (event: DomainEvent<TestResultReadyPayload>) => {
        const { coachingId, testId, studentId, marksObtained, totalMarks, percentage, isAbsent } = event.payload;

        const summary = isAbsent
          ? 'Marked absent for test'
          : `Scored ${marksObtained}/${totalMarks} (${percentage}%) in test`;

        try {
          await timelineService.recordEntry(
            {
              studentId,
              eventType: 'TEST_RESULT_RECORDED',
              summary,
              referenceId: testId,
              metadata: {
                testId,
                marksObtained,
                totalMarks,
                percentage,
                isAbsent,
              },
            },
            coachingId,
            event.metadata?.userId,
            event.metadata?.correlationId,
          );
        } catch (err) {
          logger.error('[TimelineSubscribers] Error recording TEST_RESULT_RECORDED timeline entry:', err);
        }
      },
    );

    // 4. Student Assigned to Batch
    eventBus.subscribe(
      BATCH_EVENTS.STUDENT_ENROLLED_IN_BATCH,
      async (event: DomainEvent<StudentEnrolledInBatchPayload>) => {
        try {
          await timelineService.recordEntry(
            {
              studentId: event.payload.studentId,
              eventType: 'BATCH_ASSIGNED',
              summary: `Assigned to batch ${event.payload.batchId}`,
              referenceId: event.payload.batchId,
              occurredAt: new Date(event.payload.joinedAt),
            },
            event.payload.coachingId,
            event.metadata?.userId,
            event.metadata?.correlationId,
          );
        } catch (err) {
          logger.error('[TimelineSubscribers] Error recording BATCH_ASSIGNED timeline entry:', err);
        }
      },
    );

    // 4b. Student Transferred to Another Batch
    eventBus.subscribe(
      BATCH_EVENTS.STUDENT_TRANSFERRED_BATCH,
      async (event: DomainEvent<StudentTransferredBatchPayload>) => {
        try {
          await timelineService.recordEntry(
            {
              studentId: event.payload.studentId,
              eventType: 'BATCH_TRANSFERRED',
              summary: `Transferred from batch ${event.payload.fromBatchId} to batch ${event.payload.toBatchId}${event.payload.reason ? ` (${event.payload.reason})` : ''}`,
              referenceId: event.payload.toBatchId,
              metadata: {
                fromBatchId: event.payload.fromBatchId,
                toBatchId: event.payload.toBatchId,
                reason: event.payload.reason,
              },
              occurredAt: new Date(event.payload.transferredAt),
            },
            event.payload.coachingId,
            event.metadata?.userId,
            event.metadata?.correlationId,
          );
        } catch (err) {
          logger.error('[TimelineSubscribers] Error recording BATCH_TRANSFERRED timeline entry:', err);
        }
      },
    );

    // 5. Fee Paid
    eventBus.subscribe(
      FEE_EVENTS.FEE_PAID,
      async (event: DomainEvent<FeePaidPayload>) => {
        try {
          await timelineService.recordEntry(
            {
              studentId: event.payload.studentId,
              eventType: 'FEE_PAID',
              summary: `Paid ₹${event.payload.amount} (Receipt #${event.payload.receiptNumber})`,
              referenceId: event.payload.installmentId,
              metadata: {
                amount: event.payload.amount,
                receiptNumber: event.payload.receiptNumber,
                remainingBalance: event.payload.remainingBalance,
              },
            },
            event.payload.coachingId,
            event.metadata?.userId,
            event.metadata?.correlationId,
          );
        } catch (err) {
          logger.error('[TimelineSubscribers] Error recording FEE_PAID timeline entry:', err);
        }
      },
    );
  }
}
