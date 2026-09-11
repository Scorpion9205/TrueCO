import { DomainEvent, RoleType } from '@trueco/types';

export interface UserLoggedInPayload {
  readonly userId: string;
  readonly coachingId?: string;
  readonly email: string;
  readonly roles: RoleType[];
  readonly ipAddress?: string;
}

export interface UserLoggedOutPayload {
  readonly userId: string;
  readonly coachingId?: string;
  readonly reason: 'EXPLICIT_LOGOUT' | 'ALL_DEVICES_LOGOUT' | 'TOKEN_REVOCATION';
}

export interface UserLockedOutPayload {
  readonly email: string;
  readonly ipAddress?: string;
  readonly lockDurationMinutes: number;
}

export const AUTH_EVENTS = {
  USER_LOGGED_IN: 'UserLoggedIn',
  USER_LOGGED_OUT: 'UserLoggedOut',
  USER_LOCKED_OUT: 'UserLockedOut',
} as const;

export function createUserLoggedInEvent(
  payload: UserLoggedInPayload,
  correlationId: string,
): DomainEvent<UserLoggedInPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: AUTH_EVENTS.USER_LOGGED_IN,
    coachingId: payload.coachingId || 'platform',
    occurredAt: new Date(),
    payload,
    metadata: {
      correlationId,
      userId: payload.userId,
    },
  };
}

export function createUserLoggedOutEvent(
  payload: UserLoggedOutPayload,
  correlationId: string,
): DomainEvent<UserLoggedOutPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: AUTH_EVENTS.USER_LOGGED_OUT,
    coachingId: payload.coachingId || 'platform',
    occurredAt: new Date(),
    payload,
    metadata: {
      correlationId,
      userId: payload.userId,
    },
  };
}
