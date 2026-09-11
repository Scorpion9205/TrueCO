import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { DashboardService } from './dashboard.service.js';
import { RequestContextService } from '../../common/services/request-context.service.js';
import { teacherDashboardQuerySchema } from './validators/dashboard.validator.js';
import { AppError } from '../../common/middleware/error-handler.middleware.js';

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
      const teacherId = query.teacherId || userId;

      if (!teacherId) {
        throw new AppError(
          'TEACHER_ID_REQUIRED',
          'teacherId must be provided in query or from authenticated context',
          StatusCodes.BAD_REQUEST,
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
