import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RiskEngineService } from '../../modules/risk-engine/risk-engine.service.js';
import {
  IRiskEngineRepository,
  UpsertRiskScoreInput,
} from '../../modules/risk-engine/risk-engine.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { FeeInstallmentStatus, RiskLevel } from '@vargly/types';
import { RISK_EVENTS } from '../../modules/risk-engine/risk-engine.events.js';

class InMemoryRiskEngineRepository implements IRiskEngineRepository {
  public academicData = new Map<string, any>();
  public riskScores = new Map<string, any>();

  public async getStudentAcademicData(studentId: string): Promise<any | null> {
    return this.academicData.get(studentId) || null;
  }

  public async upsertRiskScore(input: UpsertRiskScoreInput): Promise<any> {
    const record = {
      id: `risk-${crypto.randomUUID()}`,
      coachingId: input.coachingId,
      studentId: input.studentId,
      score: input.score,
      level: input.level,
      attendanceFactor: input.attendanceFactor,
      marksFactor: input.marksFactor,
      feeFactor: input.feeFactor,
      homeworkFactor: input.homeworkFactor,
      narrative: input.narrative || null,
      computedAt: new Date(),
    };
    this.riskScores.set(input.studentId, record);
    return record;
  }

  public async findByStudentId(studentId: string): Promise<any | null> {
    return this.riskScores.get(studentId) || null;
  }

  public async findMany(coachingId: string, filter?: any): Promise<any[]> {
    return Array.from(this.riskScores.values()).filter((r) => {
      if (r.coachingId !== coachingId) return false;
      if (filter?.level && r.level !== filter.level) return false;
      return true;
    });
  }

  public async getAllActiveStudentIds(_coachingId: string): Promise<string[]> {
    return Array.from(this.academicData.keys());
  }
}

describe('RiskEngineService (Phase 6 Student Risk Unit Tests)', () => {
  let riskService: RiskEngineService;
  let riskRepo: InMemoryRiskEngineRepository;
  let mockEventBus: IEventBus;

  const testCoachingId = '11111111-1111-1111-1111-111111111111';
  const healthyStudentId = 'student-healthy';
  const atRiskStudentId = 'student-at-risk';

  beforeEach(() => {
    riskRepo = new InMemoryRiskEngineRepository();
    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      publishBatch: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };
    riskService = new RiskEngineService(riskRepo, mockEventBus);
  });

  it('computes LOW risk level for student with strong attendance, good marks, and paid fees', async () => {
    riskRepo.academicData.set(healthyStudentId, {
      student: { id: healthyStudentId, coachingId: testCoachingId, firstName: 'Aarav', lastName: 'Gupta' },
      attendanceRecords: [
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'PRESENT' },
      ], // 100% attendance
      testResults: [
        { marksObtained: 90, test: { totalMarks: 100 } },
        { marksObtained: 85, test: { totalMarks: 100 } },
      ], // 87.5% avg
      feeInstallments: [
        { amount: 5000, paidAmount: 5000, status: FeeInstallmentStatus.PAID, dueDate: new Date() },
      ], // No overdue
      homeworkList: [],
    });

    const result = await riskService.computeStudentRisk(healthyStudentId, testCoachingId);

    expect(result.score).toBeLessThanOrEqual(25);
    expect(result.level).toBe(RiskLevel.LOW);
    expect(result.factors.attendanceFactor).toBe(0);
    expect(result.factors.marksFactor).toBe(0);
    expect(result.factors.feeFactor).toBe(0);

    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: RISK_EVENTS.RISK_COMPUTED,
        payload: expect.objectContaining({
          studentId: healthyStudentId,
          level: RiskLevel.LOW,
        }),
      }),
    );
    // RiskDetected should NOT be called for LOW level
    expect(mockEventBus.publish).not.toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: RISK_EVENTS.RISK_DETECTED,
      }),
    );
  });

  it('computes HIGH/CRITICAL risk level and emits RiskDetected when indicators collapse', async () => {
    const overduePastDate = new Date();
    overduePastDate.setDate(overduePastDate.getDate() - 30);

    riskRepo.academicData.set(atRiskStudentId, {
      student: { id: atRiskStudentId, coachingId: testCoachingId, firstName: 'Karan', lastName: 'Mehra' },
      attendanceRecords: [
        { status: 'ABSENT' },
        { status: 'ABSENT' },
        { status: 'ABSENT' },
        { status: 'PRESENT' },
      ], // 25% attendance (< 75%)
      testResults: [
        { marksObtained: 20, test: { totalMarks: 100 } },
        { marksObtained: 15, test: { totalMarks: 100 } },
      ], // 17.5% avg (< 60%)
      feeInstallments: [
        {
          amount: 8000,
          paidAmount: 0,
          status: FeeInstallmentStatus.PENDING,
          dueDate: overduePastDate,
        },
      ], // 30 days overdue
      homeworkList: [
        { dueDate: overduePastDate },
        { dueDate: overduePastDate },
      ], // Missed homework
    });

    const result = await riskService.computeStudentRisk(atRiskStudentId, testCoachingId);

    expect(result.score).toBeGreaterThan(50);
    expect([RiskLevel.HIGH, RiskLevel.CRITICAL]).toContain(result.level);
    expect(result.narrative).toContain('Low attendance');
    expect(result.narrative).toContain('Declining test performance');
    expect(result.narrative).toContain('fee installment(s) overdue');

    // Verifies RiskDetected domain event was published!
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: RISK_EVENTS.RISK_DETECTED,
        payload: expect.objectContaining({
          studentId: atRiskStudentId,
          level: result.level,
        }),
      }),
    );
  });

  it('recomputeAll executes batch evaluations across all students', async () => {
    riskRepo.academicData.set(healthyStudentId, {
      student: { id: healthyStudentId, coachingId: testCoachingId },
      attendanceRecords: [],
      testResults: [],
      feeInstallments: [],
      homeworkList: [],
    });

    const count = await riskService.recomputeAll(testCoachingId);
    expect(count).toBe(1);
    expect(riskRepo.riskScores.has(healthyStudentId)).toBe(true);
  });
});
