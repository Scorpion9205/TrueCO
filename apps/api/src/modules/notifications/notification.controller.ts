import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { NotificationService } from './notification.service.js';
import { failedNotificationQuerySchema } from './validators/notification.validator.js';
import { RequestContextService } from '../../common/services/request-context.service.js';
import { envConfig } from '../../config/env.config.js';
import { NotificationStatus } from '@trueco/types';
import { logger } from '../../common/logger/logger.service.js';

import crypto from 'node:crypto';
import { WhatsAppAssistantService } from '../whatsapp-assistant/whatsapp-assistant.service.js';

export class NotificationController {
  public constructor(
    private readonly notificationService: NotificationService,
    private readonly assistantService?: WhatsAppAssistantService,
  ) {}

  public verifyWebhook = (req: Request, res: Response): void => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const expectedToken = envConfig.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN');

    if (mode === 'subscribe' && token === expectedToken) {
      logger.info('[NotificationController] Meta WhatsApp webhook handshake verified successfully');
      res.status(StatusCodes.OK).send(challenge);
    } else {
      logger.warn('[NotificationController] Meta WhatsApp webhook handshake failed token verification');
      res.status(StatusCodes.FORBIDDEN).send('Forbidden');
    }
  };

  private verifySignature(req: Request): boolean {
    const appSecret = envConfig.get('WHATSAPP_APP_SECRET');
    if (!appSecret) return true; // dev mode fallback

    const signature = req.headers['x-hub-signature-256'] as string;
    if (!signature) return false;

    const rawPayload = (req as any).rawBody || JSON.stringify(req.body);
    const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawPayload).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  public handleWebhook = async (req: Request, res: Response): Promise<void> => {
    if (!this.verifySignature(req)) {
      logger.warn('[NotificationController] WhatsApp webhook rejected due to invalid HMAC signature');
      res.status(StatusCodes.UNAUTHORIZED).json({ error: 'INVALID_SIGNATURE' });
      return;
    }

    try {
      const body = req.body;

      if (body.object === 'whatsapp_business_account') {
        const entries = body.entry || [];
        for (const entry of entries) {
          const changes = entry.changes || [];
          for (const change of changes) {
            const value = change.value;

            // 1. Process Delivery Statuses (SENT, DELIVERED, READ, FAILED)
            const statuses = value?.statuses || [];
            for (const statusObj of statuses) {
              const providerMessageId = statusObj.id;
              const metaStatus = statusObj.status; // 'sent', 'delivered', 'read', 'failed'

              let targetStatus: NotificationStatus | undefined;
              if (metaStatus === 'delivered') targetStatus = NotificationStatus.DELIVERED;
              else if (metaStatus === 'read') targetStatus = NotificationStatus.READ;
              else if (metaStatus === 'failed') targetStatus = NotificationStatus.FAILED;

              if (targetStatus) {
                const errorMsg = statusObj.errors?.[0]?.title || statusObj.errors?.[0]?.message;
                await this.notificationService.handleWebhookStatus(
                  providerMessageId,
                  targetStatus,
                  errorMsg,
                );
              }
            }

            // 2. Process Incoming Messages from Parents/Students
            const messages = value?.messages || [];
            for (const msg of messages) {
              if (msg.type === 'text' && msg.text?.body && this.assistantService) {
                try {
                  await this.assistantService.processInboundMessage({
                    messageId: msg.id,
                    from: msg.from,
                    body: msg.text.body,
                    timestamp: msg.timestamp ? Number(msg.timestamp) : Date.now(),
                  });
                } catch (err) {
                  logger.error(`[NotificationController] Error processing inbound WhatsApp message ${msg.id}:`, err);
                }
              }
            }
          }
        }
      }

      res.status(StatusCodes.OK).json({ status: 'EVENT_RECEIVED' });
    } catch (err) {
      logger.error('[NotificationController] Error processing WhatsApp webhook payload:', err);
      res.status(StatusCodes.OK).json({ status: 'EVENT_RECEIVED' }); // Meta requires 200 to prevent retries
    }
  };

  public getFailed = async (req: Request, res: Response): Promise<void> => {
    const coachingId = RequestContextService.getRequiredCoachingId();
    const query = failedNotificationQuerySchema.parse(req.query);

    const result = await this.notificationService.getFailedNotifications(coachingId, query);
    res.status(StatusCodes.OK).json({ data: result });
  };

  public retry = async (req: Request, res: Response): Promise<void> => {
    const coachingId = RequestContextService.getRequiredCoachingId();
    const result = await this.notificationService.retryNotification(req.params.id, coachingId);
    res.status(StatusCodes.OK).json({ data: result });
  };
}
