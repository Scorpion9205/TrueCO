import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { WhatsAppAssistantService } from './whatsapp-assistant.service.js';
import { inboundWhatsAppMessageSchema } from './validators/whatsapp-assistant.validator.js';

export class WhatsAppAssistantController {
  public constructor(private readonly assistantService: WhatsAppAssistantService) {}

  public handleInbound = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = inboundWhatsAppMessageSchema.parse(req.body);
      const reply = await this.assistantService.processInboundMessage(validated);

      res.status(StatusCodes.OK).json({
        status: 'SUCCESS',
        data: reply,
      });
    } catch (err) {
      next(err);
    }
  };
}
