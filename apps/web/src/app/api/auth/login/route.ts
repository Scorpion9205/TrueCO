import type { NextRequest } from 'next/server';
import {
  type ApiTokens,
  apiFor,
  errorResponse,
  forbiddenCrossSite,
  isCrossSite,
  readJson,
  sessionResponse,
} from '@/lib/auth/bff';
import type { SessionUser } from '@/lib/auth/types';

export async function POST(request: NextRequest) {
  if (isCrossSite(request)) return forbiddenCrossSite();
  const { email, password, coachingCode } = await readJson(request);

  try {
    // Only the known fields are forwarded: the API rejects unknown ones (strict schema)
    const result = await apiFor(request).post<{ user: SessionUser; tokens: ApiTokens }>(
      '/auth/login',
      { email, password, ...(coachingCode ? { coachingCode } : {}) },
    );
    return sessionResponse(result.user, result.tokens);
  } catch (error) {
    return errorResponse(error);
  }
}
