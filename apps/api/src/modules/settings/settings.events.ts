import { DomainEvent } from '@vargly/types';
import { CoachingConfig } from './dto/settings.dto.js';

export interface SettingsUpdatedPayload {
  readonly coachingId: string;
  readonly config: CoachingConfig;
}

export const SETTINGS_EVENTS = {
  SETTINGS_UPDATED: 'SettingsUpdated',
} as const;

export function createSettingsUpdatedEvent(
  payload: SettingsUpdatedPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<SettingsUpdatedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: SETTINGS_EVENTS.SETTINGS_UPDATED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}
