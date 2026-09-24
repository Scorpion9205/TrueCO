import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { API_URL } from '@/lib/api';
import {
  __resetSessionForTests,
  api,
  getSession,
  getSessionEnd,
  refreshSession,
  signIn,
  signOut,
} from './session';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => __resetSessionForTests());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const user = { id: 'u1', name: 'Asha', email: 'a@b.co', phone: '', roles: [], permissions: [] };
const session = (accessToken: string) => ({ user, accessToken, expiresIn: 900 });
const BFF = `${location.origin}/api/auth`;

describe('browser session', () => {
  it('sends one refresh at a time, however many callers ask', async () => {
    let calls = 0;
    server.use(
      http.post(`${BFF}/refresh`, () => {
        calls += 1;
        return HttpResponse.json({ data: session('fresh') });
      }),
    );

    const results = await Promise.all([refreshSession(), refreshSession(), refreshSession()]);

    expect(calls).toBe(1);
    expect(results.map((s) => s?.accessToken)).toEqual(['fresh', 'fresh', 'fresh']);
    expect(getSession()?.accessToken).toBe('fresh');
  });

  it('clears the session when the server ends it', async () => {
    server.use(
      http.post(`${BFF}/login`, () => HttpResponse.json({ data: session('a') })),
      http.post(`${BFF}/refresh`, () =>
        HttpResponse.json({ error: { code: 'TOKEN_EXPIRED' } }, { status: 401 }),
      ),
    );
    await signIn({ email: 'a@b.co', password: 'x' });

    await expect(refreshSession()).resolves.toBeNull();
    expect(getSession()).toBeNull();
    expect(getSessionEnd()).toBe('expired');
  });

  it('stays signed in when the refresh fails for another reason (offline)', async () => {
    server.use(
      http.post(`${BFF}/login`, () => HttpResponse.json({ data: session('a') })),
      http.post(`${BFF}/refresh`, () => HttpResponse.error()),
    );
    await signIn({ email: 'a@b.co', password: 'x' });

    await expect(refreshSession()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(getSession()?.accessToken).toBe('a');
  });

  it('records a sign-out as such, even if the server cannot be reached', async () => {
    server.use(
      http.post(`${BFF}/login`, () => HttpResponse.json({ data: session('a') })),
      http.post(`${BFF}/logout`, () => HttpResponse.error()),
    );
    await signIn({ email: 'a@b.co', password: 'x' });

    await signOut().catch(() => {});
    expect(getSession()).toBeNull();
    expect(getSessionEnd()).toBe('signedOut');
  });

  it('lets API calls renew an expired access token transparently', async () => {
    server.use(
      http.post(`${BFF}/login`, () => HttpResponse.json({ data: session('expired') })),
      http.post(`${BFF}/refresh`, () => HttpResponse.json({ data: session('fresh') })),
      http.get(`${API_URL}/students`, ({ request }) =>
        request.headers.get('authorization') === 'Bearer fresh'
          ? HttpResponse.json({ data: ['s1'] })
          : HttpResponse.json({ error: { code: 'UNAUTHENTICATED' } }, { status: 401 }),
      ),
    );
    await signIn({ email: 'a@b.co', password: 'x' });

    await expect(api.get('/students')).resolves.toEqual(['s1']);
    expect(getSession()?.accessToken).toBe('fresh');
  });
});
