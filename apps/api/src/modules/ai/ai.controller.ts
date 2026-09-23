import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AiService, InsufficientAiCreditsError } from './ai.service.js';
import { RequestContextService } from '../../common/services/request-context.service.js';
import {
  aiPaginationSchema,
  generateAiCompletionSchema,
  generateParentReportCardSchema,
  generateStudentNarrativeSchema,
  generateTeacherInsightSchema,
} from './validators/ai.validator.js';

export class AiController {
  public constructor(private readonly aiService: AiService) {}

  public getWalletBalance = async (_req: Request, res: Response): Promise<void> => {
    try {
      const coachingId = RequestContextService.getCoachingId();
      if (!coachingId) {
        res.status(StatusCodes.UNAUTHORIZED).json({
          error: { code: 'UNAUTHENTICATED', message: 'Tenant context missing' },
        });
        return;
      }

      const wallet = await this.aiService.getWalletBalance(coachingId);
      res.status(StatusCodes.OK).json({ data: wallet });
    } catch (err) {
      this.handleError(res, err);
    }
  };

  public getUsageLogs = async (req: Request, res: Response): Promise<void> => {
    try {
      const coachingId = RequestContextService.getCoachingId();
      if (!coachingId) {
        res.status(StatusCodes.UNAUTHORIZED).json({
          error: { code: 'UNAUTHENTICATED', message: 'Tenant context missing' },
        });
        return;
      }

      const { limit, offset } = aiPaginationSchema.parse(req.query);
      const result = await this.aiService.getUsageLogs(coachingId, limit, offset);
      res.status(StatusCodes.OK).json({
        data: result.logs,
        meta: { total: result.total, limit, offset },
      });
    } catch (err) {
      this.handleError(res, err);
    }
  };

  public generateCompletion = async (req: Request, res: Response): Promise<void> => {
    try {
      const coachingId = RequestContextService.getCoachingId();
      const userId = RequestContextService.getUserId();
      if (!coachingId) {
        res.status(StatusCodes.UNAUTHORIZED).json({
          error: { code: 'UNAUTHENTICATED', message: 'Tenant context missing' },
        });
        return;
      }

      const dto = generateAiCompletionSchema.parse(req.body);
      const result = await this.aiService.generateCompletion(dto, coachingId, userId);
      res.status(StatusCodes.OK).json({ data: result });
    } catch (err) {
      this.handleError(res, err);
    }
  };

  public generateStudentNarrative = async (req: Request, res: Response): Promise<void> => {
    try {
      const coachingId = RequestContextService.getCoachingId();
      const userId = RequestContextService.getUserId();
      if (!coachingId) {
        res.status(StatusCodes.UNAUTHORIZED).json({
          error: { code: 'UNAUTHENTICATED', message: 'Tenant context missing' },
        });
        return;
      }

      const dto = generateStudentNarrativeSchema.parse(req.body);
      const result = await this.aiService.generateStudentMonthlyProgress(dto, coachingId, userId);
      res.status(StatusCodes.OK).json({ data: result });
    } catch (err) {
      this.handleError(res, err);
    }
  };

  public generateParentReportCard = async (req: Request, res: Response): Promise<void> => {
    try {
      const coachingId = RequestContextService.getCoachingId();
      const userId = RequestContextService.getUserId();
      if (!coachingId) {
        res.status(StatusCodes.UNAUTHORIZED).json({
          error: { code: 'UNAUTHENTICATED', message: 'Tenant context missing' },
        });
        return;
      }

      const dto = generateParentReportCardSchema.parse(req.body);
      const result = await this.aiService.generateParentWhatsAppReportCard(dto, coachingId, userId);
      res.status(StatusCodes.OK).json({ data: result });
    } catch (err) {
      this.handleError(res, err);
    }
  };

  public generateTeacherInsight = async (req: Request, res: Response): Promise<void> => {
    try {
      const coachingId = RequestContextService.getCoachingId();
      const userId = RequestContextService.getUserId();
      if (!coachingId) {
        res.status(StatusCodes.UNAUTHORIZED).json({
          error: { code: 'UNAUTHENTICATED', message: 'Tenant context missing' },
        });
        return;
      }

      const dto = generateTeacherInsightSchema.parse(req.body);
      const result = await this.aiService.generateTeacherPerformanceInsight(dto, coachingId, userId);
      res.status(StatusCodes.OK).json({ data: result });
    } catch (err) {
      this.handleError(res, err);
    }
  };

  private handleError(res: Response, err: unknown): void {
    if (err instanceof InsufficientAiCreditsError) {
      res.status(StatusCodes.PAYMENT_REQUIRED).json({
        error: {
          code: err.code,
          message: err.message,
          currentBalance: err.currentBalance,
          requiredCredits: err.requiredCredits,
          upgradeUrl: err.buyCreditsUrl,
        },
      });
      return;
    }

    const message = (err as Error).message || 'Internal AI service error';
    res.status(StatusCodes.BAD_REQUEST).json({
      error: { code: 'AI_SERVICE_ERROR', message },
    });
  }
}
