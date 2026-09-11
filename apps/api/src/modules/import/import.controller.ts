import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ImportService } from './import.service.js';
import { RequestContextService } from '../../common/services/request-context.service.js';
import { bulkImportSchema } from './validators/import.validator.js';

export class ImportController {
  public constructor(private readonly importService: ImportService) {}

  public importBulkData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coachingId = RequestContextService.getCoachingId()!;
      const userId = RequestContextService.getUserId();
      const traceId = RequestContextService.getTraceId();

      const validated = bulkImportSchema.parse(req.body);
      const result = await this.importService.importData(
        validated as any,
        coachingId,
        userId,
        traceId,
      );

      res.status(StatusCodes.OK).json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}
