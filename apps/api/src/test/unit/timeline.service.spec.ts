import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TimelineService } from '../../modules/timeline/timeline.service.js';
import {
  ITimelineRepository,
  CreateTimelineEntryInput,
} from '../../modules/timeline/timeline.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { TIMELINE_EVENTS } from '../../modules/timeline/timeline.events.js';

class InMemoryTimelineRepository implements ITimelineRepository {
  public entries: Array<any> = [];

  public async create(input: CreateTimelineEntryInput): Promise<any> {
    const entry = {
      id: `tl-${Date.now()}-${Math.random()}`,
      coachingId: input.coachingId,
      studentId: input.studentId,
      eventType: input.eventType,
      summary: input.summary,
      referenceId: input.referenceId,
      metadata: input.metadata || {},
      occurredAt: input.occurredAt || new Date(),
      createdAt: new Date(),
    };
    this.entries.push(entry);
    return entry;
  }

  public async findByStudent(
    studentId: string,
    options?: { limit?: number; offset?: number; eventType?: string },
  ): Promise<any[]> {
    let list = this.entries.filter((e) => e.studentId === studentId);
    if (options?.eventType) {
      list = list.filter((e) => e.eventType === options.eventType);
    }
    return list;
  }
}

describe('TimelineService (Phase 3 Domain Unit Tests)', () => {
  let timelineService: TimelineService;
  let timelineRepo: InMemoryTimelineRepository;
  let mockEventBus: IEventBus;

  beforeEach(() => {
    timelineRepo = new InMemoryTimelineRepository();
    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      publishBatch: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };
    timelineService = new TimelineService(timelineRepo, mockEventBus);
  });

  it('should successfully record a student timeline entry and emit TimelineEntryRecorded', async () => {
    const result = await timelineService.recordEntry(
      {
        studentId: 'student-101',
        eventType: 'ATTENDANCE_MARKED',
        summary: 'Marked PRESENT for Mathematics on 11 Sep 2026',
        referenceId: 'session-555',
        metadata: { status: 'PRESENT' },
      },
      'coaching-1',
      'teacher-1',
    );

    expect(result).toBeDefined();
    expect(result.studentId).toBe('student-101');
    expect(result.eventType).toBe('ATTENDANCE_MARKED');
    expect(result.summary).toContain('PRESENT');

    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: TIMELINE_EVENTS.TIMELINE_ENTRY_RECORDED,
        coachingId: 'coaching-1',
        payload: expect.objectContaining({
          studentId: 'student-101',
          eventType: 'ATTENDANCE_MARKED',
        }),
      }),
    );
  });

  it('should retrieve student timeline history with eventType filtering', async () => {
    await timelineService.recordEntry(
      {
        studentId: 'student-101',
        eventType: 'STUDENT_ENROLLED',
        summary: 'Enrolled in Class 10',
      },
      'coaching-1',
    );

    await timelineService.recordEntry(
      {
        studentId: 'student-101',
        eventType: 'TEST_RESULT_RECORDED',
        summary: 'Scored 92/100 in Physics Test',
      },
      'coaching-1',
    );

    const allEntries = await timelineService.getStudentTimeline('student-101');
    expect(allEntries).toHaveLength(2);

    const testOnly = await timelineService.getStudentTimeline('student-101', {
      eventType: 'TEST_RESULT_RECORDED',
    });
    expect(testOnly).toHaveLength(1);
    expect(testOnly[0].eventType).toBe('TEST_RESULT_RECORDED');
  });
});
