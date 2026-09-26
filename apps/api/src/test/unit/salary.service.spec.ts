import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SalaryService } from '../../modules/salary/salary.service.js';
import {
  CreateSalaryInput,
  ISalaryRepository,
  RecordSalaryPaymentInput,
} from '../../modules/salary/salary.repository.js';
import { SalaryFilterDto } from '../../modules/salary/dto/salary.dto.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { AppError } from '../../common/middleware/error-handler.middleware.js';
import { PaymentMethod } from '@vargly/types';
import { SALARY_EVENTS } from '../../modules/salary/salary.events.js';

const SALARY_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
} as const;

class InMemorySalaryRepository implements ISalaryRepository {
  public salaries: Map<string, any> = new Map();
  public teacherSalaries: Map<string, number | null> = new Map();

  public async create(input: CreateSalaryInput): Promise<any> {
    const id = `sal-${crypto.randomUUID()}`;
    const record = {
      id,
      coachingId: input.coachingId,
      teacherId: input.teacherId,
      amount: input.amount,
      month: input.month,
      year: input.year,
      status: SALARY_STATUS.PENDING,
      paymentMethod: null,
      paidAt: null,
      remarks: input.remarks || null,
      teacher: { firstName: 'Prof', lastName: 'Kumar' },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.salaries.set(id, record);
    return record;
  }

  public async findById(id: string): Promise<any | null> {
    return this.salaries.get(id) || null;
  }

  public async findMany(coachingId: string, filter?: SalaryFilterDto): Promise<any[]> {
    return Array.from(this.salaries.values()).filter((s) => {
      if (s.coachingId !== coachingId) return false;
      if (filter?.teacherId && s.teacherId !== filter.teacherId) return false;
      if (filter?.month && s.month !== filter.month) return false;
      if (filter?.year && s.year !== filter.year) return false;
      if (filter?.status && s.status !== filter.status) return false;
      return true;
    });
  }

  public async findByTeacher(teacherId: string): Promise<any[]> {
    return Array.from(this.salaries.values()).filter((s) => s.teacherId === teacherId);
  }

  public async recordPayment(
    id: string,
    data: RecordSalaryPaymentInput,
  ): Promise<any> {
    const record = this.salaries.get(id);
    if (!record) throw new Error('Not found');
    record.status = SALARY_STATUS.PAID;
    record.paymentMethod = data.paymentMethod;
    record.paidAt = data.paidAt || new Date();
    if (data.remarks) record.remarks = data.remarks;
    return record;
  }

  public async getTeacherMonthlySalary(teacherId: string): Promise<number | null> {
    return this.teacherSalaries.get(teacherId) ?? null;
  }
}

describe('SalaryService (Phase 4 Domain Unit Tests)', () => {
  let salaryService: SalaryService;
  let salaryRepo: InMemorySalaryRepository;
  let mockEventBus: IEventBus;

  const testCoachingId = '11111111-1111-1111-1111-111111111111';
  const testTeacherId = '44444444-4444-4444-4444-444444444444';
  const testUserId = '33333333-3333-3333-3333-333333333333';

  beforeEach(() => {
    salaryRepo = new InMemorySalaryRepository();
    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      publishBatch: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };
    salaryService = new SalaryService(salaryRepo, mockEventBus);
  });

  describe('generateSalary', () => {
    it('generates salary with explicit amount and emits SalaryGenerated event', async () => {
      const result = await salaryService.generateSalary(
        {
          teacherId: testTeacherId,
          amount: 35000,
          month: 3,
          year: 2026,
          remarks: 'March 2026 Salary',
        },
        testCoachingId,
        testUserId,
      );

      expect(result.id).toBeDefined();
      expect(result.amount).toBe(35000);
      expect(result.status).toBe(SALARY_STATUS.PENDING);
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: SALARY_EVENTS.SALARY_GENERATED,
          payload: expect.objectContaining({
            salaryId: result.id,
            teacherId: testTeacherId,
            amount: 35000,
            month: 3,
            year: 2026,
          }),
        }),
      );
    });

    it('uses teacher default monthly salary if amount is omitted', async () => {
      salaryRepo.teacherSalaries.set(testTeacherId, 40000);

      const result = await salaryService.generateSalary(
        {
          teacherId: testTeacherId,
          month: 4,
          year: 2026,
        },
        testCoachingId,
        testUserId,
      );

      expect(result.amount).toBe(40000);
    });

    it('throws SALARY_AMOUNT_REQUIRED if amount is omitted and teacher has no default salary', async () => {
      await expect(
        salaryService.generateSalary(
          {
            teacherId: testTeacherId,
            month: 4,
            year: 2026,
          },
          testCoachingId,
          testUserId,
        ),
      ).rejects.toThrow(AppError);
    });
  });

  describe('paySalary', () => {
    it('marks salary as PAID and emits SalaryPaid event', async () => {
      const generated = await salaryService.generateSalary(
        {
          teacherId: testTeacherId,
          amount: 30000,
          month: 3,
          year: 2026,
        },
        testCoachingId,
        testUserId,
      );

      const paid = await salaryService.paySalary(
        {
          salaryId: generated.id,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          remarks: 'NEFT Ref #998877',
        },
        testCoachingId,
        testUserId,
      );

      expect(paid.status).toBe(SALARY_STATUS.PAID);
      expect(paid.paymentMethod).toBe(PaymentMethod.BANK_TRANSFER);
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: SALARY_EVENTS.SALARY_PAID,
          payload: expect.objectContaining({
            salaryId: generated.id,
            amount: 30000,
            paymentMethod: PaymentMethod.BANK_TRANSFER,
          }),
        }),
      );
    });

    it('throws SALARY_ALREADY_PAID if salary is already paid', async () => {
      const generated = await salaryService.generateSalary(
        {
          teacherId: testTeacherId,
          amount: 25000,
          month: 3,
          year: 2026,
        },
        testCoachingId,
        testUserId,
      );

      await salaryService.paySalary(
        { salaryId: generated.id, paymentMethod: PaymentMethod.CASH },
        testCoachingId,
        testUserId,
      );

      await expect(
        salaryService.paySalary(
          { salaryId: generated.id, paymentMethod: PaymentMethod.CASH },
          testCoachingId,
          testUserId,
        ),
      ).rejects.toThrow(AppError);
    });
  });
});
