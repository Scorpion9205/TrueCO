import { NextResponse, type NextRequest } from 'next/server';
import {
  type ApiTokens,
  apiFor,
  errorResponse,
  forbiddenCrossSite,
  isCrossSite,
  readJson,
  sessionResponse,
} from '@/lib/auth/bff';
import type { RegisterInput, SessionUser } from '@/lib/auth/types';

const FIELDS: ReadonlyArray<keyof RegisterInput> = [
  'coachingName',
  'coachingCode',
  'phone',
  'email',
  'city',
  'ownerName',
  'ownerEmail',
  'ownerPhone',
  'ownerPassword',
];

/** Creates the institute, then signs its owner in so signup lands straight in the app */
export async function POST(request: NextRequest) {
  if (isCrossSite(request)) return forbiddenCrossSite();
  const body = await readJson(request);
  const input = Object.fromEntries(
    FIELDS.filter((field) => body[field] !== undefined && body[field] !== '').map((field) => [
      field,
      body[field],
    ]),
  ) as Partial<RegisterInput>;

  const api = apiFor(request);
  try {
    await api.post('/coachings/register', input);
  } catch (error) {
    return errorResponse(error);
  }

  try {
    const result = await api.post<{ user: SessionUser; tokens: ApiTokens }>('/auth/login', {
      email: input.ownerEmail,
      password: input.ownerPassword,
      coachingCode: input.coachingCode?.trim().toLowerCase(),
    });
    return sessionResponse(result.user, result.tokens, 201);
  } catch {
    // The institute exists; the owner can sign in from the login page
    return NextResponse.json({ data: { signedIn: false } }, { status: 201 });
  }
}
