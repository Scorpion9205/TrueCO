import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { CoachingService } from './coaching.service.js';
import { registerCoachingSchema, updateCoachingSchema } from './validators/coaching.validator.js';
import { RegisterCoachingDto } from './dto/coaching.dto.js';
import { RequestContextService } from '../../common/services/request-context.service.js';

export class CoachingController {
  public constructor(private readonly coachingService: CoachingService) {}

  public register = async (req: Request, res: Response): Promise<void> => {
    const validated = registerCoachingSchema.parse(req.body) as RegisterCoachingDto;
    const traceId = RequestContextService.getTraceId();

    const result = await this.coachingService.registerCoaching(validated, traceId);
    res.status(StatusCodes.CREATED).json({ data: result });
  };

  public getProfile = async (_req: Request, res: Response): Promise<void> => {
    const coachingId = RequestContextService.getRequiredCoachingId();
    const result = await this.coachingService.getCoachingById(coachingId);
    res.status(StatusCodes.OK).json({ data: result });
  };

  public updateProfile = async (req: Request, res: Response): Promise<void> => {
    const changes = updateCoachingSchema.parse(req.body);
    const coachingId = RequestContextService.getRequiredCoachingId();
    const result = await this.coachingService.updateCoaching(coachingId, changes);
    res.status(StatusCodes.OK).json({ data: result });
  };
}
