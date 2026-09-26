import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AttendanceService } from '../../modules/attendance/attendance.service.js';
import { IAttendanceRepository, UpsertAttendanceSessionInput } from '../../modules/attendance/attendance.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { AppError } from '../../common/middleware/error-handler.middleware.js';
import { AttendanceStatus } from '@vargly/types';
import { ATTENDANCE_EVENTS } from '../../modules/attendance/attendance.events.js';

class InMemoryAttendanceRepository implements IAttendanceRepository {
  public sessions: Map<string, any> = new Map();

  public async upsertSessionWithRecords(input: UpsertAttendanceSessionInput): Promise<any> {
    const sessionId = `session-${input.batchId}-${input.sessionDate.toISOString().slice(0, 10)}`;

    const records = input.records.map((r, idx) => ({
      id: `record-${sessionId}-${idx}`,
      sessionId,
      studentId: r.studentId,
      status: r.status,
      remarks: r.remarks,
      student: { firstName: 'Student', lastName: `${idx + 1}` },
    }));

    const session = {
      id: sessionId,
      coachingId: input.coachingId,
      batchId: input.batchId,
      sessionDate: input.sessionDate,
      slot: input.slot,
      markedById: input.markedById,
      remarks: input.remarks,
      records,
      createdAt: new Date(),
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  public async findSessionById(id: string): Promise<any | null> {
    return this.sessions.get(id) || null;
  }

  public async findSessionsByBatch(batchId: string, _startDate?: Date, _endDate?: Date): Promise<any[]> {
    return Array.from(this.sessions.values()).filter((s) => s.batchId === batchId);
  }
}

describe('AttendanceService (Phase 2 Domain Unit Tests)', () => {
  let attendanceService: AttendanceService;
  let attendanceRepo: InMemoryAttendanceRepository;
  let mockEventBus: IEventBus;

  beforeEach(() => {
    attendanceRepo = new InMemoryAttendanceRepository();
    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      publishBatch: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };
    attendanceService = new AttendanceService(attendanceRepo, mockEventBus);
  });

  it('should mark attendance, calculate present/absent stats, and publish AttendanceMarked event', async () => {
    const result = await attendanceService.markAttendance(
      {
        batchId: 'batch-101',
        sessionDate: '2026-09-11',
        records: [
          { studentId: 'stu-1', status: AttendanceStatus.PRESENT },
          { studentId: 'stu-2', status: AttendanceStatus.ABSENT, remarks: 'Sick leave' },
          { studentId: 'stu-3', status: AttendanceStatus.LATE },
        ],
      },
      'coaching-1',
      'teacher-1',
    );

    expect(result).toBeDefined();
    expect(result.batchId).toBe('batch-101');
    expect(result.totalStudents).toBe(3);
    expect(result.presentCount).toBe(2); // PRESENT + LATE
    expect(result.absentCount).toBe(1);

    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: ATTENDANCE_EVENTS.ATTENDANCE_MARKED,
        coachingId: 'coaching-1',
        payload: expect.objectContaining({
          batchId: 'batch-101',
          records: expect.arrayContaining([
            expect.objectContaining({ studentId: 'stu-1', status: AttendanceStatus.PRESENT }),
            expect.objectContaining({ studentId: 'stu-2', status: AttendanceStatus.ABSENT }),
          ]),
        }),
      }),
    );
  });

  it('should throw NOT_FOUND when requesting a non-existent session', async () => {
    await expect(attendanceService.getSessionById('missing-session-id')).rejects.toThrow(AppError);
  });
});
