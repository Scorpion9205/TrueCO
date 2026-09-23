import { IEventBus } from '../../events/event-bus.interface.js';
import { NotificationService } from './notification.service.js';
import { ATTENDANCE_EVENTS, AttendanceMarkedPayload } from '../attendance/attendance.events.js';
import { TEST_EVENTS, TestResultReadyPayload } from '../tests/test.events.js';
import { HOMEWORK_EVENTS, HomeworkCreatedPayload } from '../homework/homework.events.js';
import {
  FEE_EVENTS,
  FeePaidPayload,
  FeeReminderTriggeredPayload,
} from '../fees/fee.events.js';
import { NOTICE_EVENTS, NoticeCreatedPayload } from '../notice-board/notice.events.js';
import { RISK_EVENTS, RiskDetectedPayload } from '../risk-engine/risk-engine.events.js';
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
                  recipient: `student:${record.studentId}:parent`,
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

    // 4. Fee Payment Recorded -> Queue WhatsApp Payment Confirmation
    eventBus.subscribe(
      FEE_EVENTS.FEE_PAID,
      async (event: DomainEvent<FeePaidPayload>) => {
        const { coachingId, studentId, amount, receiptNumber, remainingBalance } = event.payload;
        const idempotencyKey = `fee.paid.${receiptNumber}`;
        const content = `Payment Received: ₹${amount} received for student receipt #${receiptNumber}. Remaining balance: ₹${remainingBalance}. Thank you!`;

        try {
          await notificationService.enqueueNotification(
            {
              channel: NotificationChannel.WHATSAPP,
              recipient: `student:${studentId}:parent`,
              recipientType: 'PARENT',
              content,
              templateName: 'fee_payment_confirmation',
              templateLanguage: 'en',
              templateVariables: {
                amount: `₹${amount}`,
                receipt: receiptNumber,
                balance: `₹${remainingBalance}`,
              },
              idempotencyKey,
            },
            coachingId,
            event.metadata?.correlationId,
          );
        } catch (err) {
          logger.error(`[NotificationSubscribers] Failed enqueuing fee payment confirmation:`, err);
        }
      },
    );

    // 5. Fee Reminder Triggered -> Queue Reminder Alert
    eventBus.subscribe(
      FEE_EVENTS.FEE_REMINDER_TRIGGERED,
      async (event: DomainEvent<FeeReminderTriggeredPayload>) => {
        const { coachingId, studentId, installmentId, amount, dueDate, daysUntilDue } = event.payload;
        // Keyed by stage, not by date: each stage (D-7, D-3, D0, D+3, ...) reaches a parent once
        const idempotencyKey = `fee.reminder.${installmentId}.${event.payload.stage}`;
        const dueDateStr = new Date(dueDate).toLocaleDateString('en-IN');
        const dueText = daysUntilDue < 0 ? `is OVERDUE by ${Math.abs(daysUntilDue)} days` : `is due on ${dueDateStr}`;
        const content = `Fee Reminder: A payment of ₹${amount} ${dueText}. Please pay promptly.`;

        try {
          await notificationService.enqueueNotification(
            {
              channel: NotificationChannel.WHATSAPP,
              recipient: `student:${studentId}:parent`,
              recipientType: 'PARENT',
              content,
              templateName: 'fee_payment_reminder',
              templateLanguage: 'en',
              templateVariables: {
                amount: `₹${amount}`,
                dueDate: dueDateStr,
              },
              idempotencyKey,
            },
            coachingId,
            event.metadata?.correlationId,
          );
        } catch (err) {
          logger.error(`[NotificationSubscribers] Failed enqueuing fee reminder:`, err);
        }
      },
    );

    // 6. Notice Created -> Queue Announcement Broadcast
    eventBus.subscribe(
      NOTICE_EVENTS.NOTICE_CREATED,
      async (event: DomainEvent<NoticeCreatedPayload>) => {
        const { coachingId, noticeId, title, batchId } = event.payload;
        const idempotencyKey = `notice.created.${noticeId}`;
        const recipient = batchId ? `batch:${batchId}:students` : `batch:all:students`;

        try {
          await notificationService.enqueueNotification(
            {
              channel: NotificationChannel.WHATSAPP,
              recipient,
              recipientType: 'STUDENT',
              content: `📢 Announcement: *${title}*`,
              idempotencyKey,
            },
            coachingId,
            event.metadata?.correlationId,
          );
        } catch (err) {
          logger.error(`[NotificationSubscribers] Failed enqueuing notice broadcast:`, err);
        }
      },
    );

    // 7. Student Risk Detected -> Alert Coaching Owner
    eventBus.subscribe(
      RISK_EVENTS.RISK_DETECTED,
      async (event: DomainEvent<RiskDetectedPayload>) => {
        const { coachingId, studentId, score, level, narrative } = event.payload;
        const idempotencyKey = `risk.alert.${studentId}.${new Date().toISOString().slice(0, 10)}`;

        try {
          await notificationService.enqueueNotification(
            {
              channel: NotificationChannel.WHATSAPP,
              recipient: `coaching:${coachingId}:owner`,
              recipientType: 'TEACHER',
              content: `⚠️ Risk Alert: Student ${studentId} flagged at ${level} risk (score: ${score}). Narrative: ${narrative}`,
              idempotencyKey,
            },
            coachingId,
            event.metadata?.correlationId,
          );
        } catch (err) {
          logger.error(`[NotificationSubscribers] Failed enqueuing risk alert:`, err);
        }
      },
    );
  }
}
