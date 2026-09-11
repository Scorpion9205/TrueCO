import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NoticeService } from '../../modules/notice-board/notice.service.js';
import {
  CreateNoticeInput,
  INoticeRepository,
  NoticeFilterOptions,
  UpdateNoticeInput,
} from '../../modules/notice-board/notice.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { AppError } from '../../common/middleware/error-handler.middleware.js';
import { NOTICE_EVENTS } from '../../modules/notice-board/notice.events.js';

class InMemoryNoticeRepository implements INoticeRepository {
  public notices: Map<string, any> = new Map();

  public async create(input: CreateNoticeInput): Promise<any> {
    const id = `notice-${crypto.randomUUID()}`;
    const record = {
      id,
      coachingId: input.coachingId,
      title: input.title,
      content: input.content,
      batchId: input.batchId || null,
      targetAudience: input.targetAudience || 'ALL',
      isPinned: input.isPinned ?? false,
      expiresAt: input.expiresAt || null,
      createdBy: input.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    this.notices.set(id, record);
    return record;
  }

  public async findById(id: string): Promise<any | null> {
    const record = this.notices.get(id);
    if (!record || record.deletedAt) return null;
    return record;
  }

  public async update(id: string, input: UpdateNoticeInput): Promise<any> {
    const record = this.notices.get(id);
    if (!record || record.deletedAt) throw new Error('Not found');

    if (input.title !== undefined) record.title = input.title;
    if (input.content !== undefined) record.content = input.content;
    if (input.batchId !== undefined) record.batchId = input.batchId;
    if (input.targetAudience !== undefined) record.targetAudience = input.targetAudience;
    if (input.isPinned !== undefined) record.isPinned = input.isPinned;
    if (input.expiresAt !== undefined) record.expiresAt = input.expiresAt;
    record.updatedAt = new Date();

    return record;
  }

  public async softDelete(id: string): Promise<void> {
    const record = this.notices.get(id);
    if (record) {
      record.deletedAt = new Date();
    }
  }

  public async findMany(coachingId: string, filter?: NoticeFilterOptions): Promise<any[]> {
    return Array.from(this.notices.values()).filter((n) => {
      if (n.coachingId !== coachingId || n.deletedAt) return false;
      if (filter?.batchId && n.batchId && n.batchId !== filter.batchId) return false;
      if (filter?.targetAudience && n.targetAudience !== 'ALL' && n.targetAudience !== filter.targetAudience)
        return false;
      return true;
    });
  }
}

describe('NoticeService (Phase 5 Notice Board Unit Tests)', () => {
  let noticeService: NoticeService;
  let noticeRepo: InMemoryNoticeRepository;
  let mockEventBus: IEventBus;

  const testCoachingId = '11111111-1111-1111-1111-111111111111';
  const testBatchId = '22222222-2222-2222-2222-222222222222';
  const testUserId = '33333333-3333-3333-3333-333333333333';

  beforeEach(() => {
    noticeRepo = new InMemoryNoticeRepository();
    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      publishBatch: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };
    noticeService = new NoticeService(noticeRepo, mockEventBus);
  });

  describe('createNotice', () => {
    it('creates an institute-wide pinned notice and emits NoticeCreated event', async () => {
      const result = await noticeService.createNotice(
        {
          title: 'Holi Holiday Notice',
          content: 'Classes remain closed on 25th March on account of Holi.',
          targetAudience: 'ALL',
          isPinned: true,
        },
        testCoachingId,
        testUserId,
      );

      expect(result.id).toBeDefined();
      expect(result.title).toBe('Holi Holiday Notice');
      expect(result.isPinned).toBe(true);
      expect(result.batchId).toBeNull();
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: NOTICE_EVENTS.NOTICE_CREATED,
          payload: expect.objectContaining({
            noticeId: result.id,
            coachingId: testCoachingId,
            title: 'Holi Holiday Notice',
            targetAudience: 'ALL',
          }),
        }),
      );
    });

    it('creates a batch-specific notice targeted to students only', async () => {
      const result = await noticeService.createNotice(
        {
          title: 'Class 12th Physics Extra Class',
          content: 'Extra class on Thermodynamics at 5 PM this Friday.',
          batchId: testBatchId,
          targetAudience: 'STUDENTS',
        },
        testCoachingId,
        testUserId,
      );

      expect(result.batchId).toBe(testBatchId);
      expect(result.targetAudience).toBe('STUDENTS');
    });
  });

  describe('updateNotice and deleteNotice', () => {
    it('updates notice and publishes NoticeUpdated event', async () => {
      const created = await noticeService.createNotice(
        {
          title: 'Tentative Exam Date',
          content: 'Exams start on 10th May.',
        },
        testCoachingId,
        testUserId,
      );

      const updated = await noticeService.updateNotice(
        created.id,
        {
          title: 'Finalized Exam Date',
          content: 'Exams start on 12th May.',
        },
        testCoachingId,
        testUserId,
      );

      expect(updated.title).toBe('Finalized Exam Date');
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: NOTICE_EVENTS.NOTICE_UPDATED,
          payload: expect.objectContaining({
            noticeId: created.id,
            title: 'Finalized Exam Date',
          }),
        }),
      );
    });

    it('soft deletes notice and emits NoticeDeleted event', async () => {
      const created = await noticeService.createNotice(
        {
          title: 'Old Notice',
          content: 'To be removed',
        },
        testCoachingId,
        testUserId,
      );

      await noticeService.deleteNotice(created.id, testCoachingId, testUserId);

      await expect(noticeService.getNoticeById(created.id, testCoachingId)).rejects.toThrow(
        AppError,
      );
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: NOTICE_EVENTS.NOTICE_DELETED,
          payload: expect.objectContaining({
            noticeId: created.id,
            coachingId: testCoachingId,
          }),
        }),
      );
    });
  });
});
