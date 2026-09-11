import { IEventBus } from '../../events/event-bus.interface.js';
import {
  ASSISTANT_EVENTS,
  AssistantRepliedPayload,
  InboundMessageReceivedPayload,
} from './whatsapp-assistant.events.js';
import { DomainEvent } from '@trueco/types';
import { logger } from '../../common/logger/logger.service.js';

export class WhatsAppAssistantSubscribers {
  public static register(eventBus: IEventBus): void {
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
      (event: DomainEvent<AssistantRepliedPayload>) => {
        logger.info(
          `[AssistantSubscribers] Automated reply sent to ${event.payload.to} for intent ${event.payload.intent}`,
        );
      },
    );
  }
}
