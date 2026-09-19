import { DomainEvent, AiProviderType } from '@trueco/types';

export const AI_EVENTS = {
  CREDITS_DEDUCTED: 'AiCreditsDeducted',
  CREDITS_ADDED: 'AiCreditsAdded',
  GENERATION_COMPLETED: 'AiGenerationCompleted',
  GENERATION_FAILED: 'AiGenerationFailed',
  KNOWLEDGE_INGESTED: 'KnowledgeIngested',
} as const;

export interface AiCreditsDeductedPayload {
  readonly coachingId: string;
  readonly walletId: string;
  readonly creditsDeducted: number;
  readonly balanceRemaining: number;
  readonly feature: string;
  readonly provider: AiProviderType;
  readonly model: string;
}

export interface AiCreditsAddedPayload {
  readonly coachingId: string;
  readonly walletId: string;
  readonly creditsAdded: number;
  readonly newBalance: number;
  readonly reason?: string;
  readonly allocatedBy?: string;
}

export interface AiGenerationCompletedPayload {
  readonly coachingId: string;
  readonly walletId: string;
  readonly feature: string;
  readonly provider: AiProviderType;
  readonly model: string;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly creditsDeducted: number;
  readonly isCached: boolean;
}

export interface AiGenerationFailedPayload {
  readonly coachingId: string;
  readonly feature: string;
  readonly error: string;
}

export function createAiCreditsDeductedEvent(
  payload: AiCreditsDeductedPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<AiCreditsDeductedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: AI_EVENTS.CREDITS_DEDUCTED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}

export function createAiCreditsAddedEvent(
  payload: AiCreditsAddedPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<AiCreditsAddedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: AI_EVENTS.CREDITS_ADDED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}

export function createAiGenerationCompletedEvent(
  payload: AiGenerationCompletedPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<AiGenerationCompletedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: AI_EVENTS.GENERATION_COMPLETED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}

export function createAiGenerationFailedEvent(
  payload: AiGenerationFailedPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<AiGenerationFailedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: AI_EVENTS.GENERATION_FAILED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}

export interface KnowledgeIngestedPayload {
  readonly coachingId: string;
  readonly documentId: string;
  readonly title: string;
  readonly type: string;
  readonly totalChunks: number;
}

export function createKnowledgeIngestedEvent(
  payload: KnowledgeIngestedPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<KnowledgeIngestedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: AI_EVENTS.KNOWLEDGE_INGESTED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}

