import { StatusCodes } from 'http-status-codes';
import { money, Money, toRupees } from '../../common/money/money.js';
import { IExpenseRepository } from './expense.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { AppError } from '../../common/middleware/error-handler.middleware.js';
import {
  CreateExpenseDto,
  ExpenseFilterDto,
  ExpenseResponseDto,
  UpdateExpenseDto,
} from './dto/expense.dto.js';
import { ExpenseMapper } from './expense.mapper.js';
import { createExpenseRecordedEvent, createExpenseUpdatedEvent } from './expense.events.js';

export class ExpenseService {
  public constructor(
    private readonly expenseRepository: IExpenseRepository,
    private readonly eventBus: IEventBus,
  ) {}

  public async recordExpense(
    dto: CreateExpenseDto,
    coachingId: string,
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<ExpenseResponseDto> {
    const expenseDate = new Date(dto.expenseDate);

    const expense = await this.expenseRepository.create({
      coachingId,
      title: dto.title,
      category: dto.category,
      amount: dto.amount,
      expenseDate,
      paymentMethod: dto.paymentMethod,
      receiptUrl: dto.receiptUrl,
      remarks: dto.remarks,
      createdBy: userId,
    });

    const responseDto = ExpenseMapper.toResponseDto(expense);

    await this.eventBus.publish(
      createExpenseRecordedEvent(
        {
          expenseId: responseDto.id,
          coachingId,
          title: responseDto.title,
          category: responseDto.category,
          amount: responseDto.amount,
        },
        correlationId,
        userId,
      ),
    );

    return responseDto;
  }

  public async updateExpense(
    id: string,
    dto: UpdateExpenseDto,
    coachingId: string,
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<ExpenseResponseDto> {
    const existing = await this.expenseRepository.findById(id);
    if (!existing || existing.coachingId !== coachingId) {
      throw new AppError('EXPENSE_NOT_FOUND', 'Expense record not found', StatusCodes.NOT_FOUND);
    }

    const expenseDate = dto.expenseDate ? new Date(dto.expenseDate) : undefined;

    const updated = await this.expenseRepository.update(id, {
      title: dto.title,
      category: dto.category,
      amount: dto.amount,
      expenseDate,
      paymentMethod: dto.paymentMethod,
      receiptUrl: dto.receiptUrl,
      remarks: dto.remarks,
      updatedBy: userId,
    });

    const responseDto = ExpenseMapper.toResponseDto(updated);

    await this.eventBus.publish(
      createExpenseUpdatedEvent(
        {
          expenseId: responseDto.id,
          coachingId,
          title: responseDto.title,
          amount: responseDto.amount,
        },
        correlationId,
        userId,
      ),
    );

    return responseDto;
  }

  public async getExpenseById(id: string): Promise<ExpenseResponseDto> {
    const expense = await this.expenseRepository.findById(id);
    if (!expense) {
      throw new AppError('EXPENSE_NOT_FOUND', 'Expense record not found', StatusCodes.NOT_FOUND);
    }
    return ExpenseMapper.toResponseDto(expense);
  }

  public async listExpenses(
    coachingId: string,
    filter?: ExpenseFilterDto,
  ): Promise<ExpenseResponseDto[]> {
    const startDate = filter?.startDate ? new Date(filter.startDate) : undefined;
    const endDate = filter?.endDate ? new Date(filter.endDate) : undefined;

    const list = await this.expenseRepository.findMany(coachingId, {
      category: filter?.category,
      startDate,
      endDate,
      limit: filter?.limit,
      offset: filter?.offset,
    });

    return list.map(ExpenseMapper.toResponseDto);
  }

  /** A page of expenses plus how many match in total */
  public async listExpensesPage(
    coachingId: string,
    filter?: ExpenseFilterDto,
  ): Promise<{ expenses: ExpenseResponseDto[]; total: number }> {
    const options = {
      category: filter?.category,
      startDate: filter?.startDate ? new Date(filter.startDate) : undefined,
      endDate: filter?.endDate ? new Date(filter.endDate) : undefined,
    };
    const [expenses, total] = await Promise.all([
      this.listExpenses(coachingId, filter),
      this.expenseRepository.count(coachingId, options),
    ]);
    return { expenses, total };
  }

  public async deleteExpense(id: string, coachingId: string, userId?: string): Promise<void> {
    const existing = await this.expenseRepository.findById(id);
    if (!existing || existing.coachingId !== coachingId) {
      throw new AppError('EXPENSE_NOT_FOUND', 'Expense record not found', StatusCodes.NOT_FOUND);
    }
    await this.expenseRepository.softDelete(id, userId);
  }

  public async getExpenseSummary(
    coachingId: string,
    month: number,
    year: number,
  ): Promise<{ total: number; count: number; byCategory: Record<string, number> }> {
    // expenseDate is a calendar date (stored at UTC midnight), so the month is taken in UTC
    // rather than in whatever time zone the server happens to run
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0));

    const expenses = await this.expenseRepository.getSummary(coachingId, startDate, endDate);

    // Exact decimals: adding JavaScript numbers drifts by fractions of a paisa
    let total = money(0);
    const byCategory: Record<string, Money> = {};
    for (const exp of expenses) {
      total = total.plus(money(exp.amount));
      byCategory[exp.category] = (byCategory[exp.category] ?? money(0)).plus(money(exp.amount));
    }

    return {
      total: toRupees(total),
      count: expenses.length,
      byCategory: Object.fromEntries(
        Object.entries(byCategory).map(([category, amount]) => [category, toRupees(amount)]),
      ),
    };
  }
}
