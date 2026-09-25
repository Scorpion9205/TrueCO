import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Batch } from '@/lib/academics';
import { API_URL } from '@/lib/api';
import { __resetSessionForTests } from '@/lib/auth/session';
import { todayInIndia } from '@/lib/dates';
import { endOfDayInIndia, expiryDay, isExpired, type Notice } from '@/lib/notices';
import { renderWithIntl } from '@/test/render';
import { OWNER, signInAs } from '@/test/session';
import { NoticesPage } from './notices-page';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => __resetSessionForTests());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const notice = (id: string, overrides: Partial<Notice> = {}): Notice => ({
  id,
  title: 'Diwali holiday',
  content: 'Classes are closed on Monday.\nThey resume on Tuesday.',
  batchId: null,
  batchName: null,
  targetAudience: 'ALL',
  isPinned: false,
  expiresAt: null,
  createdAt: '2026-09-20T05:00:00.000Z',
  updatedAt: '2026-09-20T05:00:00.000Z',
  ...overrides,
});

const batch = (id: string, name: string): Batch => ({
  id,
  name,
  academicYear: '2026-27',
  daysOfWeek: [],
  isActive: true,
  createdAt: '2026-04-01T00:00:00.000Z',
});

function noticesApi(items: Notice[]) {
  const requests: URLSearchParams[] = [];
  server.use(
    http.get(`${API_URL}/notices`, ({ request }) => {
      requests.push(new URL(request.url).searchParams);
      return HttpResponse.json({ data: items });
    }),
    http.get(`${API_URL}/batches`, () =>
      HttpResponse.json({ data: [batch('b1', 'Class 10 Maths')] }),
    ),
  );
  return requests;
}

describe('NoticesPage', () => {
  it('shows notices with audience, batch, pin and dates', async () => {
    noticesApi([
      notice('n1', { isPinned: true }),
      notice('n2', {
        title: 'Unit test',
        targetAudience: 'PARENTS',
        batchId: 'b1',
        batchName: 'Class 10 Maths',
        expiresAt: '2099-01-01T18:29:59.000Z',
      }),
    ]);
    signInAs(OWNER);
    renderWithIntl(<NoticesPage />);

    expect(await screen.findByText('Diwali holiday')).toBeInTheDocument();
    expect(screen.getByText('Pinned')).toBeInTheDocument();
    expect(screen.getByText('Whole institute')).toBeInTheDocument();
    expect(screen.getByText('Class 10 Maths')).toBeInTheDocument();
    expect(screen.getByText(/Showing until/)).toBeInTheDocument();
  });

  it('filters by audience and can include ended notices', async () => {
    const requests = noticesApi([]);
    signInAs(OWNER);
    renderWithIntl(<NoticesPage />);

    await screen.findByText('No notices yet');
    await userEvent.selectOptions(screen.getByLabelText('Show notices for'), 'PARENTS');
    await userEvent.click(screen.getByLabelText('Show ended notices'));

    await waitFor(() => {
      const last = requests.at(-1)!;
      expect(last.get('targetAudience')).toBe('PARENTS');
      expect(last.get('includeExpired')).toBe('true');
    });
    expect(requests[0]!.has('targetAudience')).toBe(false);
  });

  it('posts a batch notice for parents, shown until the end of a day', async () => {
    noticesApi([]);
    let body: Record<string, unknown> = {};
    server.use(
      http.post(`${API_URL}/notices`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: notice('n9') }, { status: 201 });
      }),
    );
    signInAs(OWNER);
    renderWithIntl(<NoticesPage />);

    await userEvent.click((await screen.findAllByRole('button', { name: 'New notice' }))[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'New notice' });
    await userEvent.type(within(dialog).getByLabelText('Title'), '  PTM on Saturday ');
    await userEvent.type(within(dialog).getByLabelText('Message'), 'Please come at 10 AM.');
    await userEvent.click(within(dialog).getByLabelText('Parents'));
    await userEvent.selectOptions(await within(dialog).findByLabelText('Batch'), 'b1');
    const day = '2099-10-20';
    await userEvent.type(within(dialog).getByLabelText(/Show until/), day);
    await userEvent.click(within(dialog).getByLabelText(/Pin to the top/));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Post notice' }));

    await waitFor(() =>
      expect(body).toEqual({
        title: 'PTM on Saturday',
        content: 'Please come at 10 AM.',
        targetAudience: 'PARENTS',
        batchId: 'b1',
        isPinned: true,
        expiresAt: '2099-10-20T18:29:59.000Z',
      }),
    );
  });

  it('checks the title and message before posting', async () => {
    noticesApi([]);
    signInAs(OWNER);
    renderWithIntl(<NoticesPage />);

    await userEvent.click((await screen.findAllByRole('button', { name: 'New notice' }))[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'New notice' });
    await userEvent.type(within(dialog).getByLabelText('Title'), 'Hi');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Post notice' }));

    expect(await within(dialog).findByText('Enter at least 3 characters.')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter at least 5 characters.')).toBeInTheDocument();
  });

  it('sends only what changed on edit, and can remove the end date', async () => {
    noticesApi([notice('n1', { expiresAt: '2099-01-01T18:29:59.000Z' })]);
    let body: unknown;
    server.use(
      http.put(`${API_URL}/notices/n1`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: notice('n1') });
      }),
    );
    signInAs(OWNER);
    renderWithIntl(<NoticesPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Edit: Diwali holiday' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit notice' });
    await userEvent.clear(within(dialog).getByLabelText(/Show until/));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(body).toEqual({ expiresAt: null }));
  });

  it('pins and deletes', async () => {
    noticesApi([notice('n1')]);
    const calls: string[] = [];
    server.use(
      http.put(`${API_URL}/notices/n1`, async ({ request }) => {
        calls.push(`put ${JSON.stringify(await request.json())}`);
        return HttpResponse.json({ data: notice('n1', { isPinned: true }) });
      }),
      http.delete(`${API_URL}/notices/n1`, () => {
        calls.push('delete');
        return new HttpResponse(null, { status: 204 });
      }),
    );
    signInAs(OWNER);
    renderWithIntl(<NoticesPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Pin' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete: Diwali holiday' }));
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    await waitFor(() => expect(calls).toEqual(['put {"isPinned":true}', 'delete']));
  });

  it('shows teachers the notices meant for them, without managing them', async () => {
    const requests = noticesApi([notice('n1')]);
    signInAs({ ...OWNER, permissions: ['notices:read'] });
    renderWithIntl(<NoticesPage />);

    await screen.findByText('Diwali holiday');
    expect(requests[0]!.get('targetAudience')).toBe('TEACHERS');
    expect(screen.queryByRole('button', { name: 'New notice' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Edit/ })).toBeNull();
    expect(screen.queryByLabelText('Show notices for')).toBeNull();
  });
});

describe('notice dates', () => {
  it('keeps a notice until the end of the chosen day in India', () => {
    expect(endOfDayInIndia('2026-10-20')).toBe('2026-10-20T18:29:59.000Z');
    expect(expiryDay('2026-10-20T18:29:59.000Z')).toBe('2026-10-20');
    expect(expiryDay(null)).toBe('');
  });

  it('knows when a notice has ended', () => {
    const now = new Date('2026-10-20T18:30:00.000Z');
    expect(isExpired({ expiresAt: '2026-10-20T18:29:59.000Z' }, now)).toBe(true);
    expect(isExpired({ expiresAt: null }, now)).toBe(false);
    expect(todayInIndia(now)).toBe('2026-10-21');
  });
});
