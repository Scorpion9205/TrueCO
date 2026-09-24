import { ApiError, createApiClient } from '@trueco/api-client';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const BASE = 'http://api.test/api/v1';
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('createApiClient', () => {
  it('unwraps the { data } envelope and sends the access token', async () => {
    let auth: string | null = null;
    server.use(
      http.get(`${BASE}/students`, ({ request }) => {
        auth = request.headers.get('authorization');
        return HttpResponse.json({ data: [{ id: 's1' }] });
      }),
    );
    const api = createApiClient({ baseUrl: BASE, getAccessToken: () => 'tok' });

    await expect(api.get('/students')).resolves.toEqual([{ id: 's1' }]);
    expect(auth).toBe('Bearer tok');
  });

  it('sends query parameters, skipping empty filters', async () => {
    let search = '';
    server.use(
      http.get(`${BASE}/students`, ({ request }) => {
        search = new URL(request.url).search;
        return HttpResponse.json({ data: [] });
      }),
    );
    const api = createApiClient({ baseUrl: `${BASE}/` });

    await api.get('students', { query: { page: 2, batchId: undefined, q: '', status: ['ACTIVE', 'LEFT'] } });
    expect(search).toBe('?page=2&status=ACTIVE&status=LEFT');
  });

  it('turns the error envelope into an ApiError', async () => {
    server.use(
      http.post(`${BASE}/fees`, () =>
        HttpResponse.json(
          { error: { code: 'TRIAL_EXPIRED', message: 'Trial ended', upgradeUrl: '/billing/upgrade' } },
          { status: 402 },
        ),
      ),
    );
    const api = createApiClient({ baseUrl: BASE });

    const error = await api.post('/fees', { amount: '100' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 402, code: 'TRIAL_EXPIRED', upgradeUrl: '/billing/upgrade' });
    expect((error as ApiError).isPaymentRequired).toBe(true);
    expect((error as ApiError).isRetryable).toBe(false);
  });

  it('reports a rejected session to onUnauthorized', async () => {
    server.use(
      http.get(`${BASE}/me`, () =>
        HttpResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in' } }, { status: 401 }),
      ),
    );
    const onUnauthorized = vi.fn();
    const api = createApiClient({ baseUrl: BASE, onUnauthorized });

    await expect(api.get('/me')).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('handles error responses that are not JSON (e.g. a proxy error page)', async () => {
    server.use(http.get(`${BASE}/me`, () => new HttpResponse('<html>Bad gateway</html>', { status: 502 })));
    const api = createApiClient({ baseUrl: BASE });

    await expect(api.get('/me')).rejects.toMatchObject({ status: 502, code: 'HTTP_502', isRetryable: true });
  });

  it('turns network failures into a retryable NETWORK_ERROR', async () => {
    server.use(http.get(`${BASE}/me`, () => HttpResponse.error()));
    const api = createApiClient({ baseUrl: BASE });

    await expect(api.get('/me')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR', isRetryable: true });
  });
});
