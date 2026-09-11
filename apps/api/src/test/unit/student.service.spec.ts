import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StudentService } from '../../modules/students/student.service.js';
import { IStudentRepository } from '../../modules/students/student.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { AppError } from '../../common/middleware/error-handler.middleware.js';
import { STUDENT_EVENTS } from '../../modules/students/student.events.js';

class InMemoryStudentRepository implements IStudentRepository {
  public students: Map<string, any> = new Map();

  public async create(data: any): Promise<any> {
    const student = {
      id: `student-${Date.now()}-${Math.random()}`,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    };
    this.students.set(student.id, student);
    return student;
  }

  public async findById(id: string): Promise<any | null> {
    const s = this.students.get(id);
    if (!s || s.deletedAt) return null;
    return s;
  }

  public async findMany(filters?: { isActive?: boolean; search?: string }): Promise<any[]> {
    let list = Array.from(this.students.values()).filter((s) => !s.deletedAt);
    if (filters?.isActive !== undefined) {
      list = list.filter((s) => s.isActive === filters.isActive);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (s) =>
          s.firstName.toLowerCase().includes(q) ||
          s.lastName.toLowerCase().includes(q) ||
          (s.rollNumber && s.rollNumber.toLowerCase().includes(q)),
      );
    }
    return list;
  }

  public async update(id: string, data: any): Promise<any> {
    const existing = this.students.get(id);
    if (!existing) throw new Error('Not found');
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.students.set(id, updated);
    return updated;
  }

  public async softDelete(id: string): Promise<void> {
    const existing = this.students.get(id);
    if (existing) {
      existing.deletedAt = new Date();
      this.students.set(id, existing);
    }
  }
}

describe('StudentService (Phase 2 Domain Unit Tests)', () => {
  let studentService: StudentService;
  let studentRepo: InMemoryStudentRepository;
  let mockEventBus: IEventBus;

  beforeEach(() => {
    studentRepo = new InMemoryStudentRepository();
    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      publishBatch: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };
    studentService = new StudentService(studentRepo, mockEventBus);
  });

  it('should successfully enroll a student and emit StudentCreated event', async () => {
    const result = await studentService.enrollStudent(
      {
        firstName: 'Aarav',
        lastName: 'Sharma',
        rollNumber: 'ROLL-101',
        phone: '+919876543210',
        email: 'aarav@example.com',
        gender: 'MALE',
      },
      'coaching-1',
      'user-admin',
    );

    expect(result).toBeDefined();
    expect(result.firstName).toBe('Aarav');
    expect(result.lastName).toBe('Sharma');
    expect(result.rollNumber).toBe('ROLL-101');
    expect(result.coachingId).toBe('coaching-1');

    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: STUDENT_EVENTS.STUDENT_CREATED,
        coachingId: 'coaching-1',
        payload: expect.objectContaining({
          firstName: 'Aarav',
          lastName: 'Sharma',
        }),
      }),
    );
  });

  it('should throw NOT_FOUND when looking up a non-existent student', async () => {
    await expect(studentService.getStudentById('invalid-id')).rejects.toThrow(AppError);
  });

  it('should update student details and emit StudentUpdated event', async () => {
    const created = await studentService.enrollStudent(
      {
        firstName: 'Priya',
        lastName: 'Verma',
        phone: '+919876543211',
      },
      'coaching-1',
    );

    const updated = await studentService.updateStudent(
      created.id,
      {
        lastName: 'Patel',
      },
      'coaching-1',
      'user-admin',
    );

    expect(updated.lastName).toBe('Patel');
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: STUDENT_EVENTS.STUDENT_UPDATED,
        payload: expect.objectContaining({
          studentId: created.id,
          changes: { lastName: 'Patel' },
        }),
      }),
    );
  });
});
