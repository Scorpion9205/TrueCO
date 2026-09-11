 import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditService } from '../../modules/audit/audit.service.js';
import {
  IAuditRepository,
  CreateAuditLogInput,
  AuditLogFilterOptions,
} from '../../modules/audit/audit.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { AUDIT_EVENTS } from '../../modules/audit/audit.events.js';

class InMemoryAuditRepository implements IAuditRepository {
  public logs: Array<any> = [];

  public async create(input: CreateAuditLogInput): Promise<any> {
    const log = {
      id: `audit-${Date.now()}-${Math.random()}`,
      coachingId: input.coachingId,
      userId: input.userId,
      action: input.action,
      entityName: input.entityName,
      entityId: input.entityId,
      beforeState: input.beforeState || null,
      afterState: input.afterState || null,
      ipAddress: input.ipAddress || null,
      userAgent: input.userAgent || null,
      createdAt: new Date(),
    };
    this.logs.push(log);
    return log;
  }

  public async findMany(coachingId: string, options?: AuditLogFilterOptions): Promise<any[]> {
    let list = this.logs.filter((l) => l.coachingId === coachingId);
    if (options?.entityName) {
      list = list.filter((l) => l.entityName === options.entityName);
    }
    if (options?.action) {
      list = list.filter((l) => l.action === options.action);
    }
    if (options?.userId) {
      list = list.filter((l) => l.userId === options.userId);
    }
    return list;
  }
}

describe('AuditService (Phase 3 Domain Unit Tests)', () => {
  let auditService: AuditService;
  let auditRepo: InMemoryAuditRepository;
  let mockEventBus: IEventBus;

  beforeEach(() => {
    auditRepo = new InMemoryAuditRepository();
    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      publishBatch: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };
    auditService = new AuditService(auditRepo, mockEventBus);
  });

  it('should successfully record an audit log and emit AuditLogCreated', async () => {
    const result = await auditService.recordLog(
      {
        userId: 'user-admin',
        action: 'STUDENT_ENROLLED',
        entityName: 'Student',
        entityId: 'student-999',
        afterState: { firstName: 'Rohan', rollNumber: 'R-12' },
        ipAddress: '192.168.1.1',
      },
      'coaching-1',
    );

    expect(result).toBeDefined();
    expect(result.action).toBe('STUDENT_ENROLLED');
    expect(result.entityName).toBe('Student');
    expect(result.entityId).toBe('student-999');
    expect(result.userId).toBe('user-admin');

    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: AUDIT_EVENTS.AUDIT_LOG_CREATED,
        coachingId: 'coaching-1',
        payload: expect.objectContaining({
          action: 'STUDENT_ENROLLED',
          entityName: 'Student',
        }),
      }),
    );
  });

  it('should filter audit logs by entityName and action', async () => {
    await auditService.recordLog(
      {
        userId: 'teacher-1',
        action: 'ATTENDANCE_MARKED',
        entityName: 'AttendanceSession',
        entityId: 'session-1',
      },
      'coaching-1',
    );

    await auditService.recordLog(
      {
        userId: 'admin-1',
        action: 'BATCH_CREATED',
        entityName: 'Batch',
        entityId: 'batch-1',
      },
      'coaching-1',
    );

    const all = await auditService.getAuditLogs('coaching-1');
    expect(all).toHaveLength(2);

    const filtered = await auditService.getAuditLogs('coaching-1', {
      entityName: 'AttendanceSession',
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].action).toBe('ATTENDANCE_MARKED');
  });
});
