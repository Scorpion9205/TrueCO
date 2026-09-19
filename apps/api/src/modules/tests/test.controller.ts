import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { TestService } from './test.service.js';
import { createTestSchema, uploadMarksSchema } from './validators/test.validator.js';
import { CreateTestDto, UploadMarksDto } from './dto/test.dto.js';
import { RequestContextService } from '../../common/services/request-context.service.js';

export class TestController {
  public constructor(private readonly testService: TestService) {}

  public create = async (req: Request, res: Response): Promise<void> => {
    const validated = createTestSchema.parse(req.body) as CreateTestDto;
    const coachingId = RequestContextService.getRequiredCoachingId();
    const userId = RequestContextService.getUserId();
    const traceId = RequestContextService.getTraceId();

    const result = await this.testService.createTest(validated, coachingId, userId, traceId);
    res.status(StatusCodes.CREATED).json({ data: result });
  };

  public uploadMarks = async (req: Request, res: Response): Promise<void> => {
    const validated = uploadMarksSchema.parse(req.body) as UploadMarksDto;
    const coachingId = RequestContextService.getRequiredCoachingId();
    const userId = RequestContextService.getUserId();
    const traceId = RequestContextService.getTraceId();

    const result = await this.testService.uploadMarks(
      req.params.id,
      validated,
      coachingId,
      userId,
      traceId,
    );
    res.status(StatusCodes.OK).json({ data: result });
  };

  public getById = async (req: Request, res: Response): Promise<void> => {
    const result = await this.testService.getTestById(req.params.id);
    res.status(StatusCodes.OK).json({ data: result });
  };

  public getByBatch = async (req: Request, res: Response): Promise<void> => {
    const result = await this.testService.getTestsByBatch(req.params.batchId);
    res.status(StatusCodes.OK).json({ data: result });
  };

  public getByStudent = async (req: Request, res: Response): Promise<void> => {
    const result = await this.testService.getResultsByStudent(req.params.studentId);
    res.status(StatusCodes.OK).json({ data: result });
  };
}
