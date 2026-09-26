import { IEventBus } from '../../../events/event-bus.interface.js';
import { KnowledgeBaseService } from './knowledge-base.service.js';
import { NOTICE_EVENTS, NoticeCreatedPayload } from '../../notice-board/notice.events.js';
import { HOMEWORK_EVENTS, HomeworkCreatedPayload } from '../../homework/homework.events.js';
import { TEST_EVENTS, TestCreatedPayload } from '../../tests/test.events.js';
import { DomainEvent } from '@vargly/types';
import { logger } from '../../../common/logger/logger.service.js';

export class KnowledgeSyncSubscriber {
  public constructor(
    private readonly knowledgeBaseService: KnowledgeBaseService,
    private readonly eventBus: IEventBus,
  ) {}

  public register(): void {
    this.eventBus.subscribe<NoticeCreatedPayload>(
      NOTICE_EVENTS.NOTICE_CREATED,
      this.handleNoticeCreated.bind(this),
    );

    this.eventBus.subscribe<HomeworkCreatedPayload>(
      HOMEWORK_EVENTS.HOMEWORK_CREATED,
      this.handleHomeworkCreated.bind(this),
    );

    this.eventBus.subscribe<TestCreatedPayload>(
      TEST_EVENTS.TEST_CREATED,
      this.handleTestCreated.bind(this),
    );

    logger.info('[KnowledgeSyncSubscriber] Registered event-driven auto-sync subscribers for RAG');
  }

  private async handleNoticeCreated(event: DomainEvent<NoticeCreatedPayload>): Promise<void> {
    try {
      const { coachingId, title, targetAudience, noticeId } = event.payload;

      await this.knowledgeBaseService.ingestDocument(
        {
          title: `[Notice] ${title}`,
          type: 'GENERAL_NOTICE',
          rawContent: `Official Announcement / Notice:\nTitle: ${title}\nTarget Audience: ${targetAudience}`,
          description: `Auto-synced from Notice Board (Notice ID: ${noticeId})`,
        },
        coachingId,
        event.metadata?.userId,
        event.metadata?.correlationId,
      );

      logger.info(`[KnowledgeSyncSubscriber] Auto-synced notice "${title}" into RAG Knowledge Base`);
    } catch (err) {
      logger.error('[KnowledgeSyncSubscriber] Error auto-syncing notice:', err);
    }
  }

  private async handleHomeworkCreated(event: DomainEvent<HomeworkCreatedPayload>): Promise<void> {
    try {
      const { coachingId, title, dueDate, homeworkId } = event.payload;
      const dueDateFormatted = new Date(dueDate).toLocaleDateString('en-IN');

      await this.knowledgeBaseService.ingestDocument(
        {
          title: `[Homework] ${title}`,
          type: 'SYLLABUS',
          rawContent: `Homework Assignment:\nTitle: ${title}\nDue Date: ${dueDateFormatted}`,
          description: `Auto-synced from Homework Module (Homework ID: ${homeworkId})`,
        },
        coachingId,
        event.metadata?.userId,
        event.metadata?.correlationId,
      );

      logger.info(`[KnowledgeSyncSubscriber] Auto-synced homework "${title}" into RAG Knowledge Base`);
    } catch (err) {
      logger.error('[KnowledgeSyncSubscriber] Error auto-syncing homework:', err);
    }
  }

  private async handleTestCreated(event: DomainEvent<TestCreatedPayload>): Promise<void> {
    try {
      const { coachingId, title, subject, testDate, totalMarks, testId } = event.payload;
      const testDateFormatted = new Date(testDate).toLocaleDateString('en-IN');

      await this.knowledgeBaseService.ingestDocument(
        {
          title: `[Test Schedule] ${title} - ${subject}`,
          type: 'SCHEDULE',
          rawContent: `Upcoming Examination / Test:\nTitle: ${title}\nSubject: ${subject}\nScheduled Date: ${testDateFormatted}\nTotal Marks: ${totalMarks}`,
          description: `Auto-synced from Test Module (Test ID: ${testId})`,
        },
        coachingId,
        event.metadata?.userId,
        event.metadata?.correlationId,
      );

      logger.info(`[KnowledgeSyncSubscriber] Auto-synced test schedule "${title}" into RAG Knowledge Base`);
    } catch (err) {
      logger.error('[KnowledgeSyncSubscriber] Error auto-syncing test schedule:', err);
    }
  }
}
