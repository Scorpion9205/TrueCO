import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { BillingService } from './billing.service.js';
import { createBillingOrderSchema } from './validators/billing.validator.js';
import { RequestContextService } from '../../common/services/request-context.service.js';


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

  public createOrder = async (req: Request, res: Response): Promise<void> => {
    const validated = createBillingOrderSchema.parse(req.body);
    const coachingId = RequestContextService.getRequiredCoachingId();
    const result = await this.billingService.createOrder(
      validated,
      coachingId,
      RequestContextService.getUserId(),
    );
    res.status(StatusCodes.CREATED).json({ data: result });
  };

  public listPayments = async (_req: Request, res: Response): Promise<void> => {
    const coachingId = RequestContextService.getRequiredCoachingId();
    res.status(StatusCodes.OK).json({ data: await this.billingService.listPayments(coachingId) });
  };

  public simulatePayment = async (req: Request, res: Response): Promise<void> => {
    const coachingId = RequestContextService.getRequiredCoachingId();
    const result = await this.billingService.simulatePayment(req.params.orderId, coachingId);
    res.status(StatusCodes.OK).json({ data: result });
  };

  public handleWebhook = async (req: Request, res: Response): Promise<void> => {
    const signature = (req.headers['x-razorpay-signature'] as string) || '';
    const rawBody = (req as any).rawBody;
    const result = await this.billingService.handleWebhook(req.body, signature, rawBody);
    res.status(StatusCodes.OK).json(result);
  };
}
