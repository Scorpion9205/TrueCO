import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AttendanceService } from './attendance.service.js';
import { markAttendanceSchema } from './validators/attendance.validator.js';
import { MarkAttendanceDto } from './dto/attendance.dto.js';
import { RequestContextService } from '../../common/services/request-context.service.js';

export class AttendanceController {
  public constructor(private readonly attendanceService: AttendanceService) {}

  public mark = async (req: Request, res: Response): Promise<void> => {
    const validated = markAttendanceSchema.parse(req.body) as MarkAttendanceDto;
    const coachingId = RequestContextService.getRequiredCoachingId();
    const userId = RequestContextService.getUserId();
    const traceId = RequestContextService.getTraceId();

    const result = await this.attendanceService.markAttendance(validated, coachingId, userId, traceId);
    res.status(StatusCodes.OK).json({ data: result });
  };

  public getSession = async (req: Request, res: Response): Promise<void> => {
    const result = await this.attendanceService.getSessionById(req.params.id);
    res.status(StatusCodes.OK).json({ data: result });
  };

  public getBatchHistory = async (req: Request, res: Response): Promise<void> => {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const result = await this.attendanceService.getBatchAttendanceHistory(req.params.batchId, startDate, endDate);
    res.status(StatusCodes.OK).json({ data: result });
  };
}
