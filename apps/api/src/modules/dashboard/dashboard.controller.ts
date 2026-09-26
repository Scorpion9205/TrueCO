import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { DashboardService } from './dashboard.service.js';
import { RequestContextService } from '../../common/services/request-context.service.js';
import { teacherDashboardQuerySchema } from './validators/dashboard.validator.js';
import { AppError } from '../../common/middleware/error-handler.middleware.js';
import { RoleType } from '@vargly/types';

export class DashboardController {
  public constructor(private readonly dashboardService: DashboardService) {}

  public getOwnerDashboard = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coachingId = RequestContextService.getCoachingId()!;
      const userId = RequestContextService.getUserId();
      const traceId = RequestContextService.getTraceId();

      const dashboard = await this.dashboardService.getOwnerOverview(coachingId, userId, traceId);

      res.status(StatusCodes.OK).json({ data: dashboard });
    } catch (err) {
      next(err);
    }
  };

  public getTeacherDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coachingId = RequestContextService.getCoachingId()!;
      const userId = RequestContextService.getUserId();
      const traceId = RequestContextService.getTraceId();

      const query = teacherDashboardQuerySchema.parse(req.query);
      // Teachers always see their own dashboard; only owners may look at another teacher's.
      // The signed-in user's id is not the teacher's id, so the profile is looked up.
      const roles = RequestContextService.getRoles();
      const teacherId = await this.dashboardService.resolveTeacherId(
        userId,
        query.teacherId,
        roles.includes(RoleType.OWNER) || roles.includes(RoleType.SUPER_ADMIN),
      );

      if (!teacherId) {
        throw new AppError(
          'TEACHER_NOT_FOUND',
          'No teacher profile for this account',
          StatusCodes.NOT_FOUND,
        );
      }

      const dashboard = await this.dashboardService.getTeacherOverview(
        coachingId,
        teacherId,
        userId,
        traceId,
      );

      res.status(StatusCodes.OK).json({ data: dashboard });
    } catch (err) {
      next(err);
    }
  };
}
