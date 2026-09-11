import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { HomeworkService } from './homework.service.js';
import { createHomeworkSchema, updateHomeworkSchema } from './validators/homework.validator.js';
import { CreateHomeworkDto, UpdateHomeworkDto } from './dto/homework.dto.js';
import { RequestContextService } from '../../common/services/request-context.service.js';

export class HomeworkController {
  public constructor(private readonly homeworkService: HomeworkService) {}

  public create = async (req: Request, res: Response): Promise<void> => {
    const validated = createHomeworkSchema.parse(req.body) as CreateHomeworkDto;
    const coachingId = RequestContextService.getRequiredCoachingId();
    const userId = RequestContextService.getUserId();
    const traceId = RequestContextService.getTraceId();

    const result = await this.homeworkService.createHomework(validated, coachingId, userId, traceId);
    res.status(StatusCodes.CREATED).json({ data: result });
  };

  public update = async (req: Request, res: Response): Promise<void> => {
    const validated = updateHomeworkSchema.parse(req.body) as UpdateHomeworkDto;
    const coachingId = RequestContextService.getRequiredCoachingId();
    const userId = RequestContextService.getUserId();
    const traceId = RequestContextService.getTraceId();

    const result = await this.homeworkService.updateHomework(
      req.params.id,
      validated,
      coachingId,
      userId,
      traceId,
    );
    res.status(StatusCodes.OK).json({ data: result });
  };

  public getById = async (req: Request, res: Response): Promise<void> => {
    const result = await this.homeworkService.getHomeworkById(req.params.id);
    res.status(StatusCodes.OK).json({ data: result });
  };

  public getByBatch = async (req: Request, res: Response): Promise<void> => {
    const result = await this.homeworkService.getHomeworkByBatch(req.params.batchId);
    res.status(StatusCodes.OK).json({ data: result });
  };

  public delete = async (req: Request, res: Response): Promise<void> => {
    const userId = RequestContextService.getUserId();
    await this.homeworkService.deleteHomework(req.params.id, userId);
    res.status(StatusCodes.NO_CONTENT).send();
  };
}
