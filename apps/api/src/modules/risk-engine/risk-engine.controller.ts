import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { RiskEngineService } from './risk-engine.service.js';
import { RequestContextService } from '../../common/services/request-context.service.js';
import { riskFilterSchema } from './validators/risk-engine.validator.js';

export class RiskEngineController {
  public constructor(private readonly riskService: RiskEngineService) {}

  public getStudentRisk = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coachingId = RequestContextService.getCoachingId()!;
      const studentId = req.params.studentId;

      const risk = await this.riskService.getStudentRisk(studentId, coachingId);

      res.status(StatusCodes.OK).json({ data: risk });
    } catch (err) {
      next(err);
    }
  };

  public listHighRisk = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coachingId = RequestContextService.getCoachingId()!;
      const filter = riskFilterSchema.parse(req.query);

      const list = await this.riskService.listRiskScores(coachingId, filter);

      res.status(StatusCodes.OK).json({ data: list });
    } catch (err) {
      next(err);
    }
  };

  public recompute = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coachingId = RequestContextService.getCoachingId()!;
      const studentId = req.params.studentId;
      const traceId = RequestContextService.getTraceId();

      const computed = await this.riskService.computeStudentRisk(studentId, coachingId, traceId);

      res.status(StatusCodes.OK).json({ data: computed });
    } catch (err) {
      next(err);
    }
  };

  public recomputeAll = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coachingId = RequestContextService.getCoachingId()!;
      const count = await this.riskService.recomputeAll(coachingId);

      res.status(StatusCodes.OK).json({
        status: 'SUCCESS',
        message: `Recomputed risk scores for ${count} students`,
      });
    } catch (err) {
      next(err);
    }
  };
}
