import { DomainEvent } from '@trueco/types';
import { AssistantIntent } from './dto/whatsapp-assistant.dto.js';

export interface InboundMessageReceivedPayload {
  readonly messageId: string;
  readonly from: string;
  readonly body: string;
}

export interface AssistantRepliedPayload {
  readonly to: string;
  readonly intent: AssistantIntent;
  readonly studentId?: string;
  readonly replyText: string;
}

export const ASSISTANT_EVENTS = {
  INBOUND_MESSAGE_RECEIVED: 'InboundMessageReceived',
  ASSISTANT_REPLIED: 'AssistantReplied',
} as const;

export function createInboundMessageReceivedEvent(
  payload: InboundMessageReceivedPayload,
  correlationId: string,
): DomainEvent<InboundMessageReceivedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: ASSISTANT_EVENTS.INBOUND_MESSAGE_RECEIVED,
    coachingId: 'SYSTEM',
    occurredAt: new Date(),
    payload,
    metadata: { correlationId },
  };
}

export function createAssistantRepliedEvent(
  payload: AssistantRepliedPayload,
  coachingId: string,
  correlationId: string,
): DomainEvent<AssistantRepliedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: ASSISTANT_EVENTS.ASSISTANT_REPLIED,
    coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId },
  };
}
