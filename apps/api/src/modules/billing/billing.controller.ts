import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { BillingService } from './billing.service.js';
import { purchaseCreditsSchema, upgradePlanSchema } from './validators/billing.validator.js';
import { PurchaseCreditsDto, UpgradePlanDto } from './dto/billing.dto.js';
import { RequestContextService } from '../../common/services/request-context.service.js';
import { z } from 'zod';

const createBillingOrderSchema = z.object({
  type: z.enum(['PLAN_UPGRADE', 'AI_CREDITS']),
  planCode: z.string().optional(),
  billingCycle: z.enum(['MONTHLY', 'ANNUAL']).optional(),
  credits: z.number().int().positive().optional(),
  amount: z.number().positive(),
});

export class BillingController {
  public constructor(private readonly billingService: BillingService) {}

  public getSubscription = async (_req: Request, res: Response): Promise<void> => {
    const coachingId = RequestContextService.getRequiredCoachingId();
    const result = await this.billingService.getCurrentSubscription(coachingId);
    res.status(StatusCodes.OK).json({ data: result });
  };

  public listPlans = async (_req: Request, res: Response): Promise<void> => {
    const result = await this.billingService.getPlans();
    res.status(StatusCodes.OK).json({ data: result });
  };

  public upgrade = async (req: Request, res: Response): Promise<void> => {
    const validated = upgradePlanSchema.parse(req.body) as UpgradePlanDto;
    const coachingId = RequestContextService.getRequiredCoachingId();
    const userId = RequestContextService.getUserId();
    const traceId = RequestContextService.getTraceId();

    const result = await this.billingService.upgradePlan(validated, coachingId, userId, traceId);
    res.status(StatusCodes.OK).json({ data: result });
  };

  public purchaseCredits = async (req: Request, res: Response): Promise<void> => {
    const validated = purchaseCreditsSchema.parse(req.body) as PurchaseCreditsDto;
    const coachingId = RequestContextService.getRequiredCoachingId();
    const userId = RequestContextService.getUserId();
    const traceId = RequestContextService.getTraceId();

    const result = await this.billingService.purchaseCredits(validated, coachingId, userId, traceId);
    res.status(StatusCodes.OK).json({ data: result });
  };

  public createOrder = async (req: Request, res: Response): Promise<void> => {
    const validated = createBillingOrderSchema.parse(req.body);
    const coachingId = RequestContextService.getRequiredCoachingId();
    const result = await this.billingService.createOrder(validated, coachingId);
    res.status(StatusCodes.CREATED).json({ data: result });
  };

  public handleWebhook = async (req: Request, res: Response): Promise<void> => {
    const signature = (req.headers['x-razorpay-signature'] as string) || '';
    const rawBody = (req as any).rawBody;
    const result = await this.billingService.handleWebhook(req.body, signature, rawBody);
    res.status(StatusCodes.OK).json(result);
  };
}
