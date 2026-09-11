import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuditService } from './audit.service.js';
import { auditLogFilterSchema } from './validators/audit.validator.js';
import { RequestContextService } from '../../common/services/request-context.service.js';

export class AuditController {
  public constructor(private readonly auditService: AuditService) {}

  public list = async (req: Request, res: Response): Promise<void> => {
    const coachingId = RequestContextService.getRequiredCoachingId();
    const filter = auditLogFilterSchema.parse(req.query);

    const result = await this.auditService.getAuditLogs(coachingId, filter);
    res.status(StatusCodes.OK).json({ data: result });
  };
}
