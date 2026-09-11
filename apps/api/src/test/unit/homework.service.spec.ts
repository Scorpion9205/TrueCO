import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HomeworkService } from '../../modules/homework/homework.service.js';
import {
  IHomeworkRepository,
  CreateHomeworkInput,
  UpdateHomeworkInput,
} from '../../modules/homework/homework.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { AppError } from '../../common/middleware/error-handler.middleware.js';
import { HOMEWORK_EVENTS } from '../../modules/homework/homework.events.js';

class InMemoryHomeworkRepository implements IHomeworkRepository {
  public items: Map<string, any> = new Map();

  public async create(input: CreateHomeworkInput): Promise<any> {
    const hw = {
      id: `hw-${Date.now()}-${Math.random()}`,
      coachingId: input.coachingId,
      batchId: input.batchId,
      title: input.title,
      description: input.description,
      dueDate: input.dueDate,
      attachmentUrl: input.attachmentUrl,
      createdBy: input.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.items.set(hw.id, hw);
    return hw;
  }

  public async findById(id: string): Promise<any | null> {
    const item = this.items.get(id);
    if (!item || item.deletedAt) return null;
    return item;
  }

  public async findByBatch(batchId: string): Promise<any[]> {
    return Array.from(this.items.values()).filter((h) => h.batchId === batchId && !h.deletedAt);
  }

  public async update(id: string, input: UpdateHomeworkInput): Promise<any> {
    const item = this.items.get(id);
    if (!item) throw new Error('Not found');
    const updated = {
      ...item,
      ...input,
      updatedAt: new Date(),
    };
    this.items.set(id, updated);
    return updated;
  }

  public async softDelete(id: string, deletedBy?: string): Promise<void> {
    const item = this.items.get(id);
    if (item) {
      item.deletedAt = new Date();
      item.updatedBy = deletedBy;
      this.items.set(id, item);
    }
  }
}

describe('HomeworkService (Phase 2 Domain Unit Tests)', () => {
  let homeworkService: HomeworkService;
  let homeworkRepo: InMemoryHomeworkRepository;
  let mockEventBus: IEventBus;

  beforeEach(() => {
    homeworkRepo = new InMemoryHomeworkRepository();
    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      publishBatch: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };
    homeworkService = new HomeworkService(homeworkRepo, mockEventBus);
  });

  it('should successfully create homework and emit HomeworkCreated event', async () => {
    const result = await homeworkService.createHomework(
      {
        batchId: 'batch-1',
        title: 'Exercise 5.2 Problems 1-10',
        description: 'Complete all trigonometry problems',
        dueDate: '2026-09-15',
        attachmentUrl: 'https://cdn.example.com/homework1.pdf',
      },
      'coaching-1',
      'teacher-1',
    );

    expect(result).toBeDefined();
    expect(result.title).toBe('Exercise 5.2 Problems 1-10');
    expect(result.batchId).toBe('batch-1');

    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: HOMEWORK_EVENTS.HOMEWORK_CREATED,
        coachingId: 'coaching-1',
        payload: expect.objectContaining({
          homeworkId: result.id,
          title: 'Exercise 5.2 Problems 1-10',
        }),
      }),
    );
  });

  it('should update homework and emit HomeworkUpdated event', async () => {
    const created = await homeworkService.createHomework(
      {
        batchId: 'batch-1',
        title: 'Draft Title',
        description: 'Initial instructions',
        dueDate: '2026-09-15',
      },
      'coaching-1',
    );

    const updated = await homeworkService.updateHomework(
      created.id,
      {
        title: 'Final Title',
        description: 'Updated instructions with hints',
      },
      'coaching-1',
      'teacher-1',
    );

    expect(updated.title).toBe('Final Title');
    expect(updated.description).toBe('Updated instructions with hints');

    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: HOMEWORK_EVENTS.HOMEWORK_UPDATED,
        payload: expect.objectContaining({
          homeworkId: created.id,
          title: 'Final Title',
        }),
      }),
    );
  });

  it('should throw NOT_FOUND when homework is not found', async () => {
    await expect(homeworkService.getHomeworkById('missing-id')).rejects.toThrow(AppError);
  });

  it('should soft delete homework', async () => {
    const created = await homeworkService.createHomework(
      {
        batchId: 'batch-1',
        title: 'To Delete',
        description: 'Desc',
        dueDate: '2026-09-15',
      },
      'coaching-1',
    );

    await homeworkService.deleteHomework(created.id, 'user-admin');

    await expect(homeworkService.getHomeworkById(created.id)).rejects.toThrow(AppError);
  });
});
