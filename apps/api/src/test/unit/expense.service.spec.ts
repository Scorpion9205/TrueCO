import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExpenseService } from '../../modules/expenses/expense.service.js';
import {
  CreateExpenseInput,
  ExpenseFilterOptions,
  IExpenseRepository,
  UpdateExpenseInput,
} from '../../modules/expenses/expense.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { AppError } from '../../common/middleware/error-handler.middleware.js';
import { PaymentMethod } from '@trueco/types';
import { EXPENSE_EVENTS } from '../../modules/expenses/expense.events.js';

const TEST_CATEGORIES = {
  ELECTRICITY: 'ELECTRICITY',
  RENT: 'RENT',
  MARKETING: 'MARKETING',
  STATIONERY: 'STATIONERY',
  SNACKS: 'SNACKS',
} as const;

class InMemoryExpenseRepository implements IExpenseRepository {
  public expenses: Map<string, any> = new Map();

  public async create(input: CreateExpenseInput): Promise<any> {
    const id = `exp-${crypto.randomUUID()}`;
    const record = {
      id,
      coachingId: input.coachingId,
      title: input.title,
      category: input.category,
      amount: input.amount,
      expenseDate: input.expenseDate,
      paymentMethod: input.paymentMethod,
      receiptUrl: input.receiptUrl || null,
      remarks: input.remarks || null,
      createdBy: input.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    this.expenses.set(id, record);
    return record;
  }

  public async findById(id: string): Promise<any | null> {
    const record = this.expenses.get(id);
    if (!record || record.deletedAt) return null;
    return record;
  }

  public async update(id: string, input: UpdateExpenseInput): Promise<any> {
    const record = this.expenses.get(id);
    if (!record || record.deletedAt) throw new Error('Not found');

    if (input.title !== undefined) record.title = input.title;
    if (input.category !== undefined) record.category = input.category;
    if (input.amount !== undefined) record.amount = input.amount;
    if (input.expenseDate !== undefined) record.expenseDate = input.expenseDate;
    if (input.paymentMethod !== undefined) record.paymentMethod = input.paymentMethod;
    if (input.receiptUrl !== undefined) record.receiptUrl = input.receiptUrl;
    if (input.remarks !== undefined) record.remarks = input.remarks;
    record.updatedAt = new Date();

    return record;
  }

  public async softDelete(id: string, _userId?: string): Promise<void> {
    const record = this.expenses.get(id);
    if (record) {
      record.deletedAt = new Date();
    }
  }

  public async findMany(coachingId: string, filter?: ExpenseFilterOptions): Promise<any[]> {
    return Array.from(this.expenses.values()).filter((e) => {
      if (e.coachingId !== coachingId || e.deletedAt) return false;
      if (filter?.category && e.category !== filter.category) return false;
      if (filter?.startDate && e.expenseDate < filter.startDate) return false;
      if (filter?.endDate && e.expenseDate > filter.endDate) return false;
      return true;
    });
  }

  public async getSummary(coachingId: string, startDate: Date, endDate: Date): Promise<any[]> {
    return Array.from(this.expenses.values()).filter(
      (e) =>
        e.coachingId === coachingId &&
        !e.deletedAt &&
        e.expenseDate >= startDate &&
        e.expenseDate <= endDate,
    );
  }
}

describe('ExpenseService (Phase 4 Domain Unit Tests)', () => {
  let expenseService: ExpenseService;
  let expenseRepo: InMemoryExpenseRepository;
  let mockEventBus: IEventBus;

  const testCoachingId = '11111111-1111-1111-1111-111111111111';
  const testUserId = '33333333-3333-3333-3333-333333333333';

  beforeEach(() => {
    expenseRepo = new InMemoryExpenseRepository();
    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      publishBatch: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };
    expenseService = new ExpenseService(expenseRepo, mockEventBus);
  });

  describe('recordExpense', () => {
    it('records an expense and publishes ExpenseRecorded event', async () => {
      const result = await expenseService.recordExpense(
        {
          title: 'Classroom AC Electricity Bill',
          category: TEST_CATEGORIES.ELECTRICITY,
          amount: 8500,
          expenseDate: '2026-03-01T10:00:00.000Z',
          paymentMethod: PaymentMethod.UPI,
          remarks: 'March bill paid via GPay',
        },
        testCoachingId,
        testUserId,
      );

      expect(result.id).toBeDefined();
      expect(result.amount).toBe(8500);
      expect(result.category).toBe(TEST_CATEGORIES.ELECTRICITY);
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: EXPENSE_EVENTS.EXPENSE_RECORDED,
          payload: expect.objectContaining({
            expenseId: result.id,
            title: 'Classroom AC Electricity Bill',
            amount: 8500,
          }),
        }),
      );
    });
  });

  describe('updateExpense', () => {
    it('updates expense fields and publishes ExpenseUpdated event', async () => {
      const recorded = await expenseService.recordExpense(
        {
          title: 'Whiteboard markers',
          category: TEST_CATEGORIES.STATIONERY,
          amount: 500,
          expenseDate: '2026-03-02T10:00:00.000Z',
          paymentMethod: PaymentMethod.CASH,
        },
        testCoachingId,
        testUserId,
      );

      const updated = await expenseService.updateExpense(
        recorded.id,
        {
          amount: 650,
          remarks: 'Added 2 duster pads',
        },
        testCoachingId,
        testUserId,
      );

      expect(updated.amount).toBe(650);
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: EXPENSE_EVENTS.EXPENSE_UPDATED,
          payload: expect.objectContaining({
            expenseId: recorded.id,
            amount: 650,
          }),
        }),
      );
    });

    it('throws EXPENSE_NOT_FOUND when updating non-existent expense', async () => {
      await expect(
        expenseService.updateExpense(
          'non-existent-id',
          { amount: 100 },
          testCoachingId,
          testUserId,
        ),
      ).rejects.toThrow(AppError);
    });
  });

  describe('deleteExpense and getExpenseSummary', () => {
    it('soft-deletes an expense so it cannot be found', async () => {
      const recorded = await expenseService.recordExpense(
        {
          title: 'Office Tea & Snacks',
          category: TEST_CATEGORIES.SNACKS,
          amount: 1200,
          expenseDate: '2026-03-03T10:00:00.000Z',
          paymentMethod: PaymentMethod.CASH,
        },
        testCoachingId,
        testUserId,
      );

      await expenseService.deleteExpense(recorded.id, testCoachingId, testUserId);

      await expect(expenseService.getExpenseById(recorded.id)).rejects.toThrow(AppError);
    });

    it('aggregates expenses by category correctly', async () => {
      await expenseService.recordExpense(
        {
          title: 'Main Hall Rent',
          category: TEST_CATEGORIES.RENT,
          amount: 25000,
          expenseDate: '2026-03-05T00:00:00.000Z',
          paymentMethod: PaymentMethod.BANK_TRANSFER,
        },
        testCoachingId,
        testUserId,
      );

      await expenseService.recordExpense(
        {
          title: 'Pamphlet Distribution',
          category: TEST_CATEGORIES.MARKETING,
          amount: 5000,
          expenseDate: '2026-03-10T00:00:00.000Z',
          paymentMethod: PaymentMethod.CASH,
        },
        testCoachingId,
        testUserId,
      );

      const summary = await expenseService.getExpenseSummary(testCoachingId, 3, 2026);

      expect(summary.total).toBe(30000);
      expect(summary.count).toBe(2);
      expect(summary.byCategory[TEST_CATEGORIES.RENT]).toBe(25000);
      expect(summary.byCategory[TEST_CATEGORIES.MARKETING]).toBe(5000);
    });
  });
});
