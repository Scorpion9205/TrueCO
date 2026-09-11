import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ReportService } from './report.service.js';
import { RequestContextService } from '../../common/services/request-context.service.js';
import { reportFilterSchema } from './validators/report.validator.js';

export class ReportController {
  public constructor(private readonly reportService: ReportService) {}

  public getFeeReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coachingId = RequestContextService.getCoachingId()!;
      const userId = RequestContextService.getUserId();
      const traceId = RequestContextService.getTraceId();

      const filter = reportFilterSchema.parse(req.query);
      const result = await this.reportService.generateFeeReport(coachingId, filter, userId, traceId);

      if (filter.format === 'csv' && result.csv) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="fee-defaulters-report.csv"');
        res.status(StatusCodes.OK).send(result.csv);
        return;
      }

      res.status(StatusCodes.OK).json({ data: result.data });
    } catch (err) {
      next(err);
    }
  };

  public getAttendanceReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coachingId = RequestContextService.getCoachingId()!;
      const userId = RequestContextService.getUserId();
      const traceId = RequestContextService.getTraceId();

      const filter = reportFilterSchema.parse(req.query);
      const result = await this.reportService.generateAttendanceReport(coachingId, filter, userId, traceId);

      if (filter.format === 'csv' && result.csv) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="attendance-report.csv"');
        res.status(StatusCodes.OK).send(result.csv);
        return;
      }

      res.status(StatusCodes.OK).json({ data: result.data });
    } catch (err) {
      next(err);
    }
  };

  public getProfitLossReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coachingId = RequestContextService.getCoachingId()!;
      const userId = RequestContextService.getUserId();
      const traceId = RequestContextService.getTraceId();

      const filter = reportFilterSchema.parse(req.query);
      const result = await this.reportService.generateProfitLossReport(coachingId, filter, userId, traceId);

      if (filter.format === 'csv' && result.csv) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="pnl-summary-report.csv"');
        res.status(StatusCodes.OK).send(result.csv);
        return;
      }

      res.status(StatusCodes.OK).json({ data: result.data });
    } catch (err) {
      next(err);
    }
  };
}
