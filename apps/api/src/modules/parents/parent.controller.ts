import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ParentService } from './parent.service.js';
import { createParentSchema, linkStudentParentSchema } from './validators/parent.validator.js';
import { CreateParentDto, LinkStudentParentDto } from './dto/parent.dto.js';
import { RequestContextService } from '../../common/services/request-context.service.js';
import { taughtBatchScope } from '../../common/decorators/require-batch-access.decorator.js';

export class ParentController {
  public constructor(private readonly parentService: ParentService) {}

  public create = async (req: Request, res: Response): Promise<void> => {
    const validated = createParentSchema.parse(req.body) as CreateParentDto;
    const coachingId = RequestContextService.getRequiredCoachingId();
    const userId = RequestContextService.getUserId();
    const traceId = RequestContextService.getTraceId();

    const parent = await this.parentService.createParent(validated, coachingId, userId, traceId);
    res.status(StatusCodes.CREATED).json({ data: parent });
  };

  public linkStudent = async (req: Request, res: Response): Promise<void> => {
    const validated = linkStudentParentSchema.parse(req.body) as LinkStudentParentDto;
    const coachingId = RequestContextService.getRequiredCoachingId();
    const userId = RequestContextService.getUserId();
    const traceId = RequestContextService.getTraceId();

    await this.parentService.linkStudent(validated, coachingId, userId, traceId);
    res.status(StatusCodes.OK).json({ data: { message: 'Student successfully linked to parent' } });
  };

  public getById = async (req: Request, res: Response): Promise<void> => {
    // Teachers reach only the parents of their own batches' students (others read as not found)
    const parent = await this.parentService.getParentById(
      req.params.id,
      (await taughtBatchScope()) ?? undefined,
    );
    res.status(StatusCodes.OK).json({ data: parent });
  };

  public list = async (req: Request, res: Response): Promise<void> => {
    const search = req.query.search as string | undefined;
    const parents = await this.parentService.listParents(
      search,
      (await taughtBatchScope()) ?? undefined,
    );
    res.status(StatusCodes.OK).json({ data: parents });
  };
}
