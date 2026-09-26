import { createApiClient, isApiError } from '@vargly/api-client';
import { API_URL } from '@/lib/api';
import type { LoginInput, RegisterInput, RegisterResult, Session } from './types';

// Browser session. The access token lives only in memory (never localStorage, where any script
// could read it); a page reload gets a new one from the refresh cookie via /api/auth/refresh.

type Listener = () => void;

/**
 * Why the last session ended: the user signed out (possibly after changing their password or
 * signing out everywhere), or the server stopped accepting it
 */
export type SessionEnd = 'signedOut' | 'passwordChanged' | 'signedOutEverywhere' | 'expired';

let current: Session | null = null;
let endedBy: SessionEnd | null = null;
const listeners = new Set<Listener>();

function setSession(next: Session | null, reason: SessionEnd = 'expired') {
  current = next;
  endedBy = next ? null : reason;
  listeners.forEach((listener) => listener());
}

export function getSessionEnd(): SessionEnd | null {
  return endedBy;
}

export function getSession(): Session | null {
  return current;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The web server's auth routes (same origin; they manage the refresh cookie) */
const authApi = createApiClient({ baseUrl: '/api/auth' });

export async function signIn(input: LoginInput): Promise<Session> {
  const session = await authApi.post<Session>('/login', input);
  setSession(session);
  return session;
}

export async function register(input: RegisterInput): Promise<RegisterResult> {
  const result = await authApi.post<RegisterResult>('/register', input);
  if ('accessToken' in result) setSession(result);
  return result;
}

export async function signOut(reason: Exclude<SessionEnd, 'expired'> = 'signedOut'): Promise<void> {
  try {
    await authApi.post('/logout');
  } finally {
    setSession(null, reason);
  }
}

let inflight: Promise<Session | null> | null = null;

/**
 * Gets a new access token from the refresh cookie. Resolves to null when the session is over
 * (and clears it); rejects on other failures such as the network, keeping the user signed in.
 *
 * The API rotates refresh tokens and treats a replayed (already used) one as theft, revoking the
 * whole session. Refreshes are therefore serialised: one at a time within this tab (shared
 * promise) and across tabs (Web Locks), so a tab never sends a token another tab just used.
 */
export function refreshSession(): Promise<Session | null> {
  inflight ??= withRefreshLock(async () => {
    try {
      const session = await authApi.post<Session>('/refresh');
      setSession(session);
      return session;
    } catch (error) {
      if (!isApiError(error) || !error.isUnauthorized) throw error;
      setSession(null);
      return null;
    }
  }).finally(() => {
    inflight = null;
  });
  return inflight;
}

function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request('vargly-auth-refresh', task) as Promise<T>;
  }
  return task();
}

/**
 * Client for the Vargly API with the signed-in user's token, renewing it once when it expires.
 * An ended session is cleared by refreshSession, which sends the app back to the login page.
 */
export const api = createApiClient({
  baseUrl: API_URL,
  getAccessToken: () => current?.accessToken,
  refreshAccessToken: async () => (await refreshSession())?.accessToken ?? null,
});

/** Test hook: signs a user in without the server */
export function __setSessionForTests(session: Session | null) {
  setSession(session);
}

/** Test hook: resets the in-memory session between tests */
export function __resetSessionForTests() {
  current = null;
  endedBy = null;
  inflight = null;
  listeners.clear();
}
