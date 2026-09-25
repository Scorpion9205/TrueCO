import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { API_URL } from '@/lib/api';
import type { Batch } from '@/lib/academics';
import type { Homework } from '@/lib/assessments';
import { addDays } from '@/lib/attendance';
import { __resetSessionForTests } from '@/lib/auth/session';
import { todayInIndia } from '@/lib/dates';
import { renderWithIntl } from '@/test/render';
import { OWNER, signInAs, TEACHER } from '@/test/session';
import { dueStatus, HomeworkPage } from './homework-page';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => __resetSessionForTests());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const batch: Batch = {
  id: 'b1',
  name: 'Class 10 Morning',
  subject: 'Physics',
  academicYear: '2026-27',
  daysOfWeek: [],
  isActive: true,
  createdAt: '2026-06-01T00:00:00.000Z',
};
const today = todayInIndia();
const homework = (id: string, title: string, dueDay: string, extra: Partial<Homework> = {}) => ({
  id,
  batchId: 'b1',
  title,
  description: 'Solve questions 1–10',
  dueDate: `${dueDay}T00:00:00.000Z`,
  attachmentUrl: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  ...extra,
});

function api(items: Homework[]) {
  server.use(
    http.get(`${API_URL}/batches`, () => HttpResponse.json({ data: [batch] })),
    http.get(`${API_URL}/homework/batch/b1`, () => HttpResponse.json({ data: items })),
  );
}

describe('HomeworkPage', () => {
  it('splits current and past work, soonest due first', async () => {
    api([
      homework('h1', 'Old worksheet', addDays(today, -3)),
      homework('h2', 'Next week', addDays(today, 5)),
      homework('h3', 'Tonight', today, { attachmentUrl: 'https://example.com/sheet.pdf' }),
    ]);
    signInAs(OWNER);
    renderWithIntl(<HomeworkPage />);

    const titles = (await screen.findAllByRole('heading', { level: 3 })).map((h) => h.textContent);
    expect(titles).toEqual(['Tonight', 'Next week', 'Old worksheet']);
    expect(screen.getByText('Due today')).toBeInTheDocument();
    expect(screen.getByText('Past due')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Attachment' })).toHaveAttribute(
      'href',
      'https://example.com/sheet.pdf',
    );
  });

  it('assigns homework due tomorrow by default', async () => {
    api([]);
    let body: unknown;
    server.use(
      http.post(`${API_URL}/homework`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: homework('h9', 'Ex 4.2', today) }, { status: 201 });
      }),
    );
    signInAs(OWNER);
    renderWithIntl(<HomeworkPage />);

    await userEvent.click((await screen.findAllByRole('button', { name: 'Assign homework' }))[0]!);
    const dialog = screen.getByRole('dialog', { name: 'Assign homework' });
    await userEvent.type(within(dialog).getByLabelText('Title'), 'Ex 4.2');
    await userEvent.type(within(dialog).getByLabelText('Instructions'), 'Questions 1 to 10');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Assign' }));

    await waitFor(() =>
      expect(body).toEqual({
        batchId: 'b1',
        title: 'Ex 4.2',
        description: 'Questions 1 to 10',
        dueDate: addDays(today, 1),
      }),
    );
  });

  it('rejects a link that is not a web address', async () => {
    api([]);
    signInAs(OWNER);
    renderWithIntl(<HomeworkPage />);

    await userEvent.click((await screen.findAllByRole('button', { name: 'Assign homework' }))[0]!);
    const dialog = screen.getByRole('dialog', { name: 'Assign homework' });
    await userEvent.type(within(dialog).getByLabelText('Title'), 'Ex 4.2');
    await userEvent.type(within(dialog).getByLabelText('Instructions'), 'Questions');
    await userEvent.type(within(dialog).getByLabelText(/Link to worksheet/), 'drive folder');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Assign' }));

    expect(await within(dialog).findByText(/full link starting with https/)).toBeInTheDocument();
  });

  it('removes a link when it is cleared on edit', async () => {
    api([homework('h1', 'Tonight', today, { attachmentUrl: 'https://example.com/a.pdf' })]);
    let body: unknown;
    server.use(
      http.put(`${API_URL}/homework/h1`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: homework('h1', 'Tonight', today) });
      }),
    );
    signInAs(OWNER);
    renderWithIntl(<HomeworkPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit homework' });
    await userEvent.clear(within(dialog).getByLabelText(/Link to worksheet/));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(body).toEqual({ attachmentUrl: '' }));
  });

  it('deletes after confirming', async () => {
    api([homework('h1', 'Tonight', today)]);
    let deleted = false;
    server.use(
      http.delete(`${API_URL}/homework/h1`, () => {
        deleted = true;
        return HttpResponse.json({ data: {} });
      }),
    );
    signInAs(OWNER);
    renderWithIntl(<HomeworkPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    await waitFor(() => expect(deleted).toBe(true));
  });

  it('lets teachers manage homework for their own batches', async () => {
    server.use(
      http.get(`${API_URL}/dashboard/teacher`, () =>
        HttpResponse.json({
          data: {
            assignedBatches: [{ batchId: 'b1', batchName: 'Class 10 Morning', studentCount: 3 }],
            todaySessions: [],
            activeHomeworkCount: 0,
          },
        }),
      ),
      http.get(`${API_URL}/homework/batch/b1`, () =>
        HttpResponse.json({ data: [homework('h1', 'Tonight', today)] }),
      ),
    );
    signInAs(TEACHER);
    renderWithIntl(<HomeworkPage />);

    expect(await screen.findByRole('heading', { name: 'Tonight' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });
});

describe('dueStatus', () => {
  it.each([
    ['2026-09-24', 'overdue'],
    ['2026-09-25', 'today'],
    ['2026-09-26', 'tomorrow'],
    ['2026-10-01', 'upcoming'],
  ])('%s is %s on 25 Sep', (day, expected) => {
    expect(dueStatus(day, '2026-09-25')).toBe(expected);
  });
});
