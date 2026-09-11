import { IEventBus } from '../../events/event-bus.interface.js';
import { NotificationService } from './notification.service.js';
import { ATTENDANCE_EVENTS, AttendanceMarkedPayload } from '../attendance/attendance.events.js';
import { TEST_EVENTS, TestResultReadyPayload } from '../tests/test.events.js';
import { HOMEWORK_EVENTS, HomeworkCreatedPayload } from '../homework/homework.events.js';
import { NotificationChannel, DomainEvent, AttendanceStatus } from '@trueco/types';
import { logger } from '../../common/logger/logger.service.js';

export class NotificationSubscribers {
  public static register(eventBus: IEventBus, notificationService: NotificationService): void {
    // 1. Attendance Marked -> Queue WhatsApp for Absent students
    eventBus.subscribe(
      ATTENDANCE_EVENTS.ATTENDANCE_MARKED,
      async (event: DomainEvent<AttendanceMarkedPayload>) => {
        const { coachingId, sessionId, records } = event.payload;

        for (const record of records) {
          if (record.status === AttendanceStatus.ABSENT) {
            const idempotencyKey = `attendance.absent.${sessionId}.${record.studentId}`;
            try {
              await notificationService.enqueueNotification(
                {
                  channel: NotificationChannel.WHATSAPP,
                  recipient: `student:${record.studentId}:parent`, // Worker will resolve primary parent phone
                  recipientType: 'PARENT',
                  content: `Dear Parent, your child was marked ABSENT today. Please contact coaching office if this is an error.`,
                  templateName: 'student_absent_alert',
                  templateLanguage: 'en',
                  templateVariables: {
                    status: 'ABSENT',
                  },
                  idempotencyKey,
                },
                coachingId,
                event.metadata?.correlationId,
              );
            } catch (err) {
              logger.error(`[NotificationSubscribers] Failed enqueuing absent alert:`, err);
            }
          }
        }
      },
    );

    // 2. Test Result Ready -> Queue WhatsApp score card to parent
    eventBus.subscribe(
      TEST_EVENTS.TEST_RESULT_READY,
      async (event: DomainEvent<TestResultReadyPayload>) => {
        const { coachingId, testId, studentId, marksObtained, totalMarks, percentage, isAbsent } = event.payload;
        const idempotencyKey = `test.result.${testId}.${studentId}`;

        const textContent = isAbsent
          ? `Dear Parent, test results have been declared. Your child was marked absent for this test.`
          : `Dear Parent, your child scored ${marksObtained}/${totalMarks} (${percentage}%) in the recent test.`;

        try {
          await notificationService.enqueueNotification(
            {
              channel: NotificationChannel.WHATSAPP,
              recipient: `student:${studentId}:parent`,
              recipientType: 'PARENT',
              content: textContent,
              templateName: 'test_score_update',
              templateLanguage: 'en',
              templateVariables: {
                marks: `${marksObtained}/${totalMarks}`,
                percentage: `${percentage}%`,
              },
              idempotencyKey,
            },
            coachingId,
            event.metadata?.correlationId,
          );
        } catch (err) {
          logger.error(`[NotificationSubscribers] Failed enqueuing test result alert:`, err);
        }
      },
    );

    // 3. Homework Created -> Queue WhatsApp homework alert
    eventBus.subscribe(
      HOMEWORK_EVENTS.HOMEWORK_CREATED,
      async (event: DomainEvent<HomeworkCreatedPayload>) => {
        const { coachingId, homeworkId, batchId, title, dueDate } = event.payload;
        const idempotencyKey = `homework.created.${homeworkId}`;
        const dueDateStr = new Date(dueDate).toLocaleDateString('en-IN');

        try {
          await notificationService.enqueueNotification(
            {
              channel: NotificationChannel.WHATSAPP,
              recipient: `batch:${batchId}:students`,
              recipientType: 'STUDENT',
              content: `New homework assigned: "${title}". Due date: ${dueDateStr}.`,
              templateName: 'homework_assigned',
              templateLanguage: 'en',
              templateVariables: {
                title,
                dueDate: dueDateStr,
              },
              idempotencyKey,
            },
            coachingId,
            event.metadata?.correlationId,
          );
        } catch (err) {
          logger.error(`[NotificationSubscribers] Failed enqueuing homework alert:`, err);
        }
      },
    );
  }
}
