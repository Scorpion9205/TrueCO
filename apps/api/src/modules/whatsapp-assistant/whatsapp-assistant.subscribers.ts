import { IEventBus } from '../../events/event-bus.interface.js';
import {
  ASSISTANT_EVENTS,
  AssistantRepliedPayload,
  InboundMessageReceivedPayload,
} from './whatsapp-assistant.events.js';
import { DomainEvent } from '@vargly/types';
import { logger } from '../../common/logger/logger.service.js';

import { NotificationService } from '../notifications/notification.service.js';
import { NotificationChannel } from '@vargly/types';

export class WhatsAppAssistantSubscribers {
  public static register(eventBus: IEventBus, notificationService?: NotificationService): void {
    eventBus.subscribe(
      ASSISTANT_EVENTS.INBOUND_MESSAGE_RECEIVED,
      (event: DomainEvent<InboundMessageReceivedPayload>) => {
        logger.debug(
          `[AssistantSubscribers] Inbound message ${event.payload.messageId} received from ${event.payload.from}`,
        );
      },
    );

    eventBus.subscribe(
      ASSISTANT_EVENTS.ASSISTANT_REPLIED,
      async (event: DomainEvent<AssistantRepliedPayload>) => {
        logger.info(
          `[AssistantSubscribers] Automated reply generated for ${event.payload.to} [intent: ${event.payload.intent}]`,
        );

        if (notificationService) {
          try {
            const idempotencyKey = `assistant.reply.${event.payload.to}.${event.metadata?.correlationId || Date.now()}`;
            await notificationService.enqueueNotification(
              {
                channel: NotificationChannel.WHATSAPP,
                recipient: event.payload.to,
                recipientType: 'PARENT',
                content: event.payload.replyText,
                idempotencyKey,
              },
              event.coachingId || '',
              event.metadata?.correlationId,
            );
          } catch (err) {
            logger.error('[AssistantSubscribers] Failed to enqueue assistant reply to whatsapp-queue:', err);
          }
        }
      },
    );
  }
}
