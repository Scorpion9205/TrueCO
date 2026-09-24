import { NextResponse, type NextRequest } from 'next/server';
import { apiFor, clearSessionCookies, forbiddenCrossSite, isCrossSite } from '@/lib/auth/bff';
import { REFRESH_COOKIE } from '@/lib/auth/cookies';

export async function POST(request: NextRequest) {
  if (isCrossSite(request)) return forbiddenCrossSite();

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    // Revoke on the server too; the visitor is signed out locally even if the API is unreachable
    await apiFor(request)
      .post('/auth/logout', { refreshToken })
      .catch((error: unknown) => console.warn('[auth] logout revoke failed', error));
  }

  const response = NextResponse.json({ data: { signedOut: true } });
  clearSessionCookies(response);
  return response;
}
