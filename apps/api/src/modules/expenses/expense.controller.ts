import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ExpenseService } from './expense.service.js';
import {
  createExpenseSchema,
  expenseFilterSchema,
  updateExpenseSchema,
} from './validators/expense.validator.js';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/expense.dto.js';
import { RequestContextService } from '../../common/services/request-context.service.js';

export class ExpenseController {
  public constructor(private readonly expenseService: ExpenseService) {}

  public create = async (req: Request, res: Response): Promise<void> => {
    const validated = createExpenseSchema.parse(req.body) as CreateExpenseDto;
    const coachingId = RequestContextService.getRequiredCoachingId();
    const userId = RequestContextService.getUserId();
    const traceId = RequestContextService.getTraceId();

    const result = await this.expenseService.recordExpense(validated, coachingId, userId, traceId);
    res.status(StatusCodes.CREATED).json({ data: result });
  };

  public update = async (req: Request, res: Response): Promise<void> => {
    const validated = updateExpenseSchema.parse(req.body) as UpdateExpenseDto;
    const coachingId = RequestContextService.getRequiredCoachingId();
    const userId = RequestContextService.getUserId();
    const traceId = RequestContextService.getTraceId();

    const result = await this.expenseService.updateExpense(
      req.params.id,
      validated,
      coachingId,
      userId,
      traceId,
    );
    res.status(StatusCodes.OK).json({ data: result });
  };

  public getById = async (req: Request, res: Response): Promise<void> => {
    const result = await this.expenseService.getExpenseById(req.params.id);
    res.status(StatusCodes.OK).json({ data: result });
  };

  public list = async (req: Request, res: Response): Promise<void> => {
    const coachingId = RequestContextService.getRequiredCoachingId();
    const filter = expenseFilterSchema.parse(req.query);

    const result = await this.expenseService.listExpenses(coachingId, filter);
    res.status(StatusCodes.OK).json({ data: result });
  };

  public delete = async (req: Request, res: Response): Promise<void> => {
    const coachingId = RequestContextService.getRequiredCoachingId();
    const userId = RequestContextService.getUserId();

    await this.expenseService.deleteExpense(req.params.id, coachingId, userId);
    res.status(StatusCodes.NO_CONTENT).send();
  };

  public summary = async (req: Request, res: Response): Promise<void> => {
    const coachingId = RequestContextService.getRequiredCoachingId();
    const month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();

    const result = await this.expenseService.getExpenseSummary(coachingId, month, year);
    res.status(StatusCodes.OK).json({ data: result });
  };
}
