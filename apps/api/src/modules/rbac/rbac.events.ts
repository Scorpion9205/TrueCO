import { DomainEvent } from '@vargly/types';

export interface RoleAssignedPayload {
  readonly userId: string;
  readonly roleCode: string;
  readonly coachingId: string;
  readonly assignedBy?: string;
}

export const RBAC_EVENTS = {
  ROLE_ASSIGNED: 'RoleAssigned',
} as const;

export function createRoleAssignedEvent(
  payload: RoleAssignedPayload,
  correlationId: string,
): DomainEvent<RoleAssignedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: RBAC_EVENTS.ROLE_ASSIGNED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: {
      correlationId,
      userId: payload.assignedBy,
    },
  };
}
