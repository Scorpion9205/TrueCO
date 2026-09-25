import { getPrismaClient, ExtendedPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';
import { PaymentMethod } from '@trueco/types';

export interface CreateExpenseInput {
  coachingId: string;
  title: string;
  category: string;
  amount: number;
  expenseDate: Date;
  paymentMethod: PaymentMethod;
  receiptUrl?: string;
  remarks?: string;
  createdBy?: string;
}

export interface UpdateExpenseInput {
  title?: string;
  category?: string;
  amount?: number;
  expenseDate?: Date;
  paymentMethod?: PaymentMethod;
  receiptUrl?: string;
  remarks?: string;
  updatedBy?: string;
}

export interface ExpenseFilterOptions {
  category?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface IExpenseRepository {
  create(input: CreateExpenseInput): Promise<any>;
  findById(id: string): Promise<any | null>;
  findMany(coachingId: string, filter?: ExpenseFilterOptions): Promise<any[]>;
  /** How many expenses match the filter (ignoring limit/offset), for paging */
  count(coachingId: string, filter?: ExpenseFilterOptions): Promise<number>;
  update(id: string, input: UpdateExpenseInput): Promise<any>;
  softDelete(id: string, userId?: string): Promise<void>;
  getSummary(coachingId: string, startDate: Date, endDate: Date): Promise<any[]>;
}

export class PrismaExpenseRepository implements IExpenseRepository {
  public constructor(private readonly prisma: ExtendedPrismaClient = getPrismaClient()) {}

  public async create(input: CreateExpenseInput): Promise<any> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.expense.create({
      data: {
        coachingId: input.coachingId,
        title: input.title,
        category: input.category,
        amount: input.amount,
        expenseDate: input.expenseDate,
        paymentMethod: input.paymentMethod,
        receiptUrl: input.receiptUrl,
        remarks: input.remarks,
        createdBy: input.createdBy,
      },
    });
  }

  public async findById(id: string): Promise<any | null> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.expense.findFirst({
      where: { id, deletedAt: null },
    });
  }

  public async findMany(coachingId: string, filter?: ExpenseFilterOptions): Promise<any[]> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.expense.findMany({
      where: this.filterWhere(coachingId, filter),
      // Newest first, with a tiebreak so paging never repeats or skips a same-day expense
      orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
      take: filter?.limit || 50,
      skip: filter?.offset || 0,
    });
  }

  public async count(coachingId: string, filter?: ExpenseFilterOptions): Promise<number> {
    return (this.prisma as any).expense.count({ where: this.filterWhere(coachingId, filter) });
  }

  private filterWhere(coachingId: string, filter?: ExpenseFilterOptions): any {
    // Both bounds go into one condition; spreading them separately let the end date
    // overwrite the start date, so a month filter returned everything before the month too
    const expenseDate: Record<string, Date> = {};
    if (filter?.startDate) expenseDate.gte = filter.startDate;
    if (filter?.endDate) expenseDate.lte = filter.endDate;
    return {
      coachingId,
      deletedAt: null,
      ...(filter?.category && { category: filter.category }),
      ...(Object.keys(expenseDate).length && { expenseDate }),
    };
  }

  public async update(id: string, input: UpdateExpenseInput): Promise<any> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.expense.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.amount !== undefined && { amount: input.amount }),
        ...(input.expenseDate !== undefined && { expenseDate: input.expenseDate }),
        ...(input.paymentMethod !== undefined && { paymentMethod: input.paymentMethod }),
        ...(input.receiptUrl !== undefined && { receiptUrl: input.receiptUrl }),
        ...(input.remarks !== undefined && { remarks: input.remarks }),
        ...(input.updatedBy !== undefined && { updatedBy: input.updatedBy }),
      },
    });
  }

  public async softDelete(id: string, userId?: string): Promise<void> {
    const rawPrisma = this.prisma as any;
    await rawPrisma.expense.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedBy: userId,
      },
    });
  }

  public async getSummary(coachingId: string, startDate: Date, endDate: Date): Promise<any[]> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.expense.findMany({
      where: {
        coachingId,
        deletedAt: null,
        expenseDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    });
  }
}
