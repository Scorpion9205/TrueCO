import { ApiError, createApiClient, isApiError } from '@vargly/api-client';
import { type NextRequest, NextResponse } from 'next/server';
import { API_URL } from '@/lib/api';
import { REFRESH_COOKIE, REFRESH_MAX_AGE_SECONDS, SESSION_FLAG_COOKIE } from './cookies';
import type { Session, SessionUser } from './types';

// Server-only helpers for the /api/auth route handlers ("backend for frontend"). The browser
// never sees the refresh token: these handlers keep it in an httpOnly cookie and hand the page a
// short-lived access token instead.

/** The API as seen from the web server; a private address avoids a trip through the internet */
const SERVER_API_URL = process.env.API_INTERNAL_URL ?? API_URL;

/** apps/api AuthTokensDto */
interface ApiTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * API client that speaks for the visitor. The API rate-limits and locks out logins per client IP,
 * so the visitor's address is passed on; otherwise every user would share the web server's IP.
 * The API must trust this server as a proxy (TRUST_PROXY) for the header to count.
 */
export function apiFor(request: NextRequest, accessToken?: string) {
  const headers: Record<string, string> = {};
  const clientIp =
    request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined;
  if (clientIp) headers['X-Forwarded-For'] = clientIp;
  const userAgent = request.headers.get('user-agent');
  if (userAgent) headers['User-Agent'] = userAgent;

  return createApiClient({
    baseUrl: SERVER_API_URL,
    defaultHeaders: headers,
    getAccessToken: () => accessToken,
    fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
  });
}

/**
 * Cross-site requests must not be able to sign a visitor in or out. The cookies are SameSite,
 * and this rejects any request whose Origin is another site as a second line of defence.
 */
export function isCrossSite(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

export function forbiddenCrossSite() {
  return NextResponse.json(
    { error: { code: 'CROSS_SITE_REQUEST', message: 'Cross-site request blocked' } },
    { status: 403 },
  );
}

/** Returns the session to the page and stores the (rotated) refresh token */
export function sessionResponse(user: SessionUser, tokens: ApiTokens, status = 200) {
  const session: Session = { user, accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  const response = NextResponse.json({ data: session }, { status });
  setSessionCookies(response, tokens.refreshToken);
  return response;
}

export function setSessionCookies(response: NextResponse, refreshToken: string) {
  const secure = process.env.NODE_ENV === 'production';
  response.cookies.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });
  response.cookies.set(SESSION_FLAG_COOKIE, '1', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set(REFRESH_COOKIE, '', { path: '/api/auth', maxAge: 0 });
  response.cookies.set(SESSION_FLAG_COOKIE, '', { path: '/', maxAge: 0 });
}

/** Passes an API failure through in the API's own error envelope, so the page sees one format */
export function errorResponse(error: unknown) {
  const apiError = isApiError(error)
    ? error
    : new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
  if (!isApiError(error)) console.error('[auth] unexpected error', error);

  // A network failure reaching the API is a gateway problem, not the visitor's fault
  const status = apiError.status === 0 ? 502 : apiError.status;
  return NextResponse.json(
    {
      error: {
        code: apiError.code,
        message: apiError.message,
        ...(apiError.details !== undefined ? { details: apiError.details } : {}),
      },
    },
    { status },
  );
}

export async function readJson(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export type { ApiTokens };
