import { NextResponse, type NextRequest } from 'next/server';
import {
  type ApiTokens,
  apiFor,
  clearSessionCookies,
  errorResponse,
  forbiddenCrossSite,
  isCrossSite,
  sessionResponse,
} from '@/lib/auth/bff';
import { REFRESH_COOKIE } from '@/lib/auth/cookies';
import type { SessionUser } from '@/lib/auth/types';
import { isApiError } from '@trueco/api-client';

/**
 * Swaps the refresh cookie for a new access token (and a rotated refresh token). Called when the
 * app loads and whenever the API rejects an expired access token.
 */
export async function POST(request: NextRequest) {
  if (isCrossSite(request)) return forbiddenCrossSite();

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return signedOut('NO_SESSION', 'Not signed in');

  try {
    const tokens = await apiFor(request).post<ApiTokens>('/auth/refresh', { refreshToken });
    const user = await apiFor(request, tokens.accessToken).get<SessionUser>('/auth/me');
    return sessionResponse(user, tokens);
  } catch (error) {
    // Expired, revoked or reused token: the session is over. Anything else (API down) keeps the
    // cookie so the visitor is not signed out by an outage.
    if (isApiError(error) && error.isUnauthorized) return signedOut(error.code, error.message);
    return errorResponse(error);
  }
}

function signedOut(code: string, message: string) {
  const response = NextResponse.json({ error: { code, message } }, { status: 401 });
  clearSessionCookies(response);
  return response;
}
