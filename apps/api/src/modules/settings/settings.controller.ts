import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { SettingsService } from './settings.service.js';
import { RequestContextService } from '../../common/services/request-context.service.js';
import { updateSettingsSchema } from './validators/settings.validator.js';

export class SettingsController {
  public constructor(private readonly settingsService: SettingsService) {}

  public get = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coachingId = RequestContextService.getCoachingId()!;
      const settings = await this.settingsService.getSettings(coachingId);

      res.status(StatusCodes.OK).json({ data: settings });
    } catch (err) {
      next(err);
    }
  };

  public update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coachingId = RequestContextService.getCoachingId()!;
      const userId = RequestContextService.getUserId();
      const traceId = RequestContextService.getTraceId();

      const validated = updateSettingsSchema.parse(req.body);
      const updated = await this.settingsService.updateSettings(
        validated,
        coachingId,
        userId,
        traceId,
      );

      res.status(StatusCodes.OK).json({ data: updated });
    } catch (err) {
      next(err);
    }
  };
}
