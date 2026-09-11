import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { RbacService } from './rbac.service.js';
import { assignRoleSchema } from './validators/rbac.validator.js';
import { AssignRoleDto } from './dto/rbac.dto.js';
import { RequestContextService } from '../../common/services/request-context.service.js';

export class RbacController {
  public constructor(private readonly rbacService: RbacService) {}

  public getRoles = async (_req: Request, res: Response): Promise<void> => {
    const coachingId = RequestContextService.getCoachingId();
    const roles = await this.rbacService.getRoles(coachingId);
    res.status(StatusCodes.OK).json({ data: roles });
  };

  public getPermissions = async (_req: Request, res: Response): Promise<void> => {
    const permissions = await this.rbacService.getPermissions();
    res.status(StatusCodes.OK).json({ data: permissions });
  };

  public assignRole = async (req: Request, res: Response): Promise<void> => {
    const validated = assignRoleSchema.parse(req.body) as Pick<AssignRoleDto, 'roleCode'>;
    const userId = req.params.userId;
    const coachingId = RequestContextService.getRequiredCoachingId();
    const callerId = RequestContextService.getUserId();
    const callerRoles = RequestContextService.getRoles();
    const traceId = RequestContextService.getTraceId();

    const result = await this.rbacService.assignRoleToUser(
      userId,
      validated.roleCode,
      coachingId,
      callerId,
      callerRoles,
      traceId,
    );

    res.status(StatusCodes.OK).json({ data: result });
  };
}
