import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestService } from '../../modules/tests/test.service.js';
import { ITestRepository, CreateTestInput } from '../../modules/tests/test.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { AppError } from '../../common/middleware/error-handler.middleware.js';
import { TEST_EVENTS } from '../../modules/tests/test.events.js';
import { StudentMarkEntryDto } from '../../modules/tests/dto/test.dto.js';

class InMemoryTestRepository implements ITestRepository {
  public tests: Map<string, any> = new Map();

  public async create(input: CreateTestInput): Promise<any> {
    const test = {
      id: `test-${Date.now()}-${Math.random()}`,
      coachingId: input.coachingId,
      batchId: input.batchId,
      title: input.title,
      subject: input.subject,
      testDate: input.testDate,
      totalMarks: input.totalMarks,
      passingMarks: input.passingMarks,
      createdBy: input.createdBy,
      createdAt: new Date(),
      results: [],
    };
    this.tests.set(test.id, test);
    return test;
  }

  public async findById(id: string): Promise<any | null> {
    const t = this.tests.get(id);
    if (!t || t.deletedAt) return null;
    return t;
  }

  public async findByBatch(batchId: string): Promise<any[]> {
    return Array.from(this.tests.values()).filter((t) => t.batchId === batchId && !t.deletedAt);
  }

  public async upsertMarks(testId: string, coachingId: string, entries: StudentMarkEntryDto[]): Promise<any> {
    const test = this.tests.get(testId);
    if (!test) throw new Error('Test not found');

    test.results = entries.map((e, idx) => ({
      id: `res-${testId}-${e.studentId}`,
      coachingId,
      testId,
      studentId: e.studentId,
      marksObtained: e.marksObtained,
      isAbsent: e.isAbsent ?? false,
      remarks: e.remarks,
      student: { firstName: 'Student', lastName: `${idx + 1}` },
    }));

    this.tests.set(testId, test);
    return test;
  }

  public async findByStudent(studentId: string): Promise<any[]> {
    const results: any[] = [];
    for (const test of this.tests.values()) {
      for (const res of test.results || []) {
        if (res.studentId === studentId) {
          results.push({ ...res, test });
        }
      }
    }
    return results;
  }
}

describe('TestService (Phase 2 Domain Unit Tests)', () => {
  let testService: TestService;
  let testRepo: InMemoryTestRepository;
  let mockEventBus: IEventBus;

  beforeEach(() => {
    testRepo = new InMemoryTestRepository();
    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      publishBatch: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };
    testService = new TestService(testRepo, mockEventBus);
  });

  it('should successfully create a test and emit TestCreated event', async () => {
    const result = await testService.createTest(
      {
        batchId: 'batch-101',
        title: 'Midterm Physics',
        subject: 'Physics',
        testDate: '2026-09-20',
        totalMarks: 100,
        passingMarks: 40,
      },
      'coaching-1',
      'teacher-1',
    );

    expect(result).toBeDefined();
    expect(result.title).toBe('Midterm Physics');
    expect(result.totalMarks).toBe(100);
    expect(result.passingMarks).toBe(40);

    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: TEST_EVENTS.TEST_CREATED,
        coachingId: 'coaching-1',
        payload: expect.objectContaining({
          testId: result.id,
          title: 'Midterm Physics',
        }),
      }),
    );
  });

  it('should throw BAD_REQUEST when passing marks exceed total marks', async () => {
    await expect(
      testService.createTest(
        {
          batchId: 'batch-101',
          title: 'Quiz',
          subject: 'Math',
          testDate: '2026-09-20',
          totalMarks: 50,
          passingMarks: 60, // Invalid!
        },
        'coaching-1',
      ),
    ).rejects.toThrow(AppError);
  });

  it('should upload marks, compute average/highest stats, and emit MarksUploaded & TestResultReady', async () => {
    const created = await testService.createTest(
      {
        batchId: 'batch-101',
        title: 'Weekly Test',
        subject: 'Chemistry',
        testDate: '2026-09-20',
        totalMarks: 100,
      },
      'coaching-1',
    );

    const updated = await testService.uploadMarks(
      created.id,
      {
        results: [
          { studentId: 'stu-1', marksObtained: 80 },
          { studentId: 'stu-2', marksObtained: 90 },
          { studentId: 'stu-3', marksObtained: 0, isAbsent: true },
        ],
      },
      'coaching-1',
      'teacher-1',
    );

    expect(updated.results).toHaveLength(3);
    expect(updated.averageScore).toBe(85); // (80 + 90) / 2
    expect(updated.highestScore).toBe(90);

    // Event checking
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: TEST_EVENTS.MARKS_UPLOADED,
        payload: expect.objectContaining({
          testId: created.id,
          resultsCount: 3,
        }),
      }),
    );

    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: TEST_EVENTS.TEST_RESULT_READY,
        payload: expect.objectContaining({
          studentId: 'stu-2',
          marksObtained: 90,
          percentage: 90,
        }),
      }),
    );
  });

  it('should reject marks upload if any mark exceeds totalMarks', async () => {
    const created = await testService.createTest(
      {
        batchId: 'batch-101',
        title: 'Quick Test',
        subject: 'English',
        testDate: '2026-09-20',
        totalMarks: 50,
      },
      'coaching-1',
    );

    await expect(
      testService.uploadMarks(
        created.id,
        {
          results: [{ studentId: 'stu-1', marksObtained: 55 }], // Exceeds 50!
        },
        'coaching-1',
      ),
    ).rejects.toThrow(AppError);
  });
});
