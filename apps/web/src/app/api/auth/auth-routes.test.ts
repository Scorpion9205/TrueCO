// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { NextRequest } from 'next/server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { API_URL } from '@/lib/api';
import { REFRESH_COOKIE, SESSION_FLAG_COOKIE } from '@/lib/auth/cookies';
import { POST as login } from './login/route';
import { POST as logout } from './logout/route';
import { POST as refresh } from './refresh/route';
import { POST as register } from './register/route';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const user = {
  id: 'u1',
  coachingId: 'c1',
  name: 'Asha',
  email: 'asha@example.com',
  phone: '9876543210',
  roles: ['OWNER'],
  permissions: [],
};
const tokens = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  tokenType: 'Bearer',
  expiresIn: 900,
};

function post(path: string, body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3000/api/auth/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', host: 'localhost:3000', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const withRefreshCookie = { cookie: `${REFRESH_COOKIE}=refresh-old` };

describe('POST /api/auth/login', () => {
  it('keeps the refresh token in an httpOnly cookie and passes on the visitor IP', async () => {
    let forwardedFor: string | null = null;
    let sentBody: unknown;
    server.use(
      http.post(`${API_URL}/auth/login`, async ({ request }) => {
        forwardedFor = request.headers.get('x-forwarded-for');
        sentBody = await request.json();
        return HttpResponse.json({ data: { user, tokens } });
      }),
    );

    const response = await login(
      post(
        'login',
        { email: 'asha@example.com', password: 'secret123', extra: 'dropped' },
        { 'x-forwarded-for': '203.0.113.7', origin: 'http://localhost:3000' },
      ),
    );

    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data).toEqual({ user, accessToken: 'access-1', expiresIn: 900 });
    expect(JSON.stringify(data)).not.toContain('refresh-1');

    const cookie = response.cookies.get(REFRESH_COOKIE);
    expect(cookie).toMatchObject({
      value: 'refresh-1',
      httpOnly: true,
      sameSite: 'strict',
      path: '/api/auth',
    });
    expect(response.cookies.get(SESSION_FLAG_COOKIE)?.value).toBe('1');
    expect(forwardedFor).toBe('203.0.113.7');
    expect(sentBody).toEqual({ email: 'asha@example.com', password: 'secret123' });
  });

  it('passes API errors through in the same envelope', async () => {
    server.use(
      http.post(`${API_URL}/auth/login`, () =>
        HttpResponse.json(
          { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
          { status: 401 },
        ),
      ),
    );

    const response = await login(post('login', { email: 'a@b.co', password: 'x' }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
    });
    expect(response.cookies.get(REFRESH_COOKIE)).toBeUndefined();
  });

  it('rejects requests from other sites', async () => {
    const response = await login(
      post('login', { email: 'a@b.co', password: 'x' }, { origin: 'https://evil.example' }),
    );
    expect(response.status).toBe(403);
  });

  it('reports an unreachable API as a gateway error', async () => {
    server.use(http.post(`${API_URL}/auth/login`, () => HttpResponse.error()));
    const response = await login(post('login', { email: 'a@b.co', password: 'x' }));
    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe('NETWORK_ERROR');
  });
});

describe('POST /api/auth/register', () => {
  it('creates the institute and signs the owner in', async () => {
    let loginBody: unknown;
    server.use(
      http.post(`${API_URL}/coachings/register`, () =>
        HttpResponse.json({ data: {} }, { status: 201 }),
      ),
      http.post(`${API_URL}/auth/login`, async ({ request }) => {
        loginBody = await request.json();
        return HttpResponse.json({ data: { user, tokens } });
      }),
    );

    const response = await register(
      post('register', {
        coachingName: 'Sharma Classes',
        coachingCode: 'Sharma-Classes',
        phone: '9876543210',
        email: 'asha@example.com',
        ownerName: 'Asha',
        ownerEmail: 'asha@example.com',
        ownerPhone: '9876543210',
        ownerPassword: 'secret123',
      }),
    );

    expect(response.status).toBe(201);
    expect((await response.json()).data.accessToken).toBe('access-1');
    expect(loginBody).toEqual({
      email: 'asha@example.com',
      password: 'secret123',
      coachingCode: 'sharma-classes',
    });
    expect(response.cookies.get(REFRESH_COOKIE)?.value).toBe('refresh-1');
  });

  it('reports success without a session when signing in afterwards fails', async () => {
    server.use(
      http.post(`${API_URL}/coachings/register`, () =>
        HttpResponse.json({ data: {} }, { status: 201 }),
      ),
      http.post(`${API_URL}/auth/login`, () =>
        HttpResponse.json({ error: { code: 'RATE_LIMITED' } }, { status: 429 }),
      ),
    );

    const response = await register(post('register', { ownerEmail: 'a@b.co', ownerPassword: 'x' }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ data: { signedIn: false } });
  });
});

describe('POST /api/auth/refresh', () => {
  it('rotates the refresh cookie and returns the user with a new access token', async () => {
    let sentToken: unknown;
    let meAuth: string | null = null;
    server.use(
      http.post(`${API_URL}/auth/refresh`, async ({ request }) => {
        sentToken = ((await request.json()) as { refreshToken: string }).refreshToken;
        return HttpResponse.json({ data: { ...tokens, refreshToken: 'refresh-2' } });
      }),
      http.get(`${API_URL}/auth/me`, ({ request }) => {
        meAuth = request.headers.get('authorization');
        return HttpResponse.json({ data: user });
      }),
    );

    const response = await refresh(post('refresh', undefined, withRefreshCookie));

    expect(response.status).toBe(200);
    expect((await response.json()).data.user).toEqual(user);
    expect(sentToken).toBe('refresh-old');
    expect(meAuth).toBe('Bearer access-1');
    expect(response.cookies.get(REFRESH_COOKIE)?.value).toBe('refresh-2');
  });

  it('answers 401 without calling the API when there is no cookie', async () => {
    const response = await refresh(post('refresh'));
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe('NO_SESSION');
  });

  it('ends the session when the API rejects the token', async () => {
    server.use(
      http.post(`${API_URL}/auth/refresh`, () =>
        HttpResponse.json({ error: { code: 'TOKEN_REUSED', message: 'Reuse' } }, { status: 401 }),
      ),
    );

    const response = await refresh(post('refresh', undefined, withRefreshCookie));

    expect(response.status).toBe(401);
    expect(response.cookies.get(REFRESH_COOKIE)?.value).toBe('');
    expect(response.cookies.get(SESSION_FLAG_COOKIE)?.value).toBe('');
  });

  it('keeps the session when the API is down', async () => {
    server.use(http.post(`${API_URL}/auth/refresh`, () => HttpResponse.error()));

    const response = await refresh(post('refresh', undefined, withRefreshCookie));

    expect(response.status).toBe(502);
    expect(response.cookies.get(REFRESH_COOKIE)).toBeUndefined();
  });
});

describe('POST /api/auth/logout', () => {
  it('revokes the token and clears the cookies, even if the API is unreachable', async () => {
    server.use(http.post(`${API_URL}/auth/logout`, () => HttpResponse.error()));

    const response = await logout(post('logout', undefined, withRefreshCookie));

    expect(response.status).toBe(200);
    expect(response.cookies.get(REFRESH_COOKIE)?.value).toBe('');
    expect(response.cookies.get(SESSION_FLAG_COOKIE)?.value).toBe('');
  });
});
