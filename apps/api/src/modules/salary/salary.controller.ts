import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { SalaryService } from './salary.service.js';
import {
  generateSalarySchema,
  recordSalaryPaymentSchema,
  salaryFilterSchema,
} from './validators/salary.validator.js';
import { GenerateSalaryDto, RecordSalaryPaymentDto } from './dto/salary.dto.js';
import { RequestContextService } from '../../common/services/request-context.service.js';

export class SalaryController {
  public constructor(private readonly salaryService: SalaryService) {}

  public generate = async (req: Request, res: Response): Promise<void> => {
    const validated = generateSalarySchema.parse(req.body) as GenerateSalaryDto;
    const coachingId = RequestContextService.getRequiredCoachingId();
    const userId = RequestContextService.getUserId();
    const traceId = RequestContextService.getTraceId();

    const result = await this.salaryService.generateSalary(validated, coachingId, userId, traceId);
    res.status(StatusCodes.CREATED).json({ data: result });
  };

  public pay = async (req: Request, res: Response): Promise<void> => {
    const validated = recordSalaryPaymentSchema.parse(req.body) as RecordSalaryPaymentDto;
    const coachingId = RequestContextService.getRequiredCoachingId();
    const userId = RequestContextService.getUserId();
    const traceId = RequestContextService.getTraceId();

    const result = await this.salaryService.paySalary(validated, coachingId, userId, traceId);
    res.status(StatusCodes.OK).json({ data: result });
  };

  public list = async (req: Request, res: Response): Promise<void> => {
    const coachingId = RequestContextService.getRequiredCoachingId();
    const filter = salaryFilterSchema.parse(req.query);

    const result = await this.salaryService.getSalaries(coachingId, filter);
    res.status(StatusCodes.OK).json({ data: result });
  };

  public getByTeacher = async (req: Request, res: Response): Promise<void> => {
    const result = await this.salaryService.getTeacherSalaries(req.params.teacherId);
    res.status(StatusCodes.OK).json({ data: result });
  };
}
